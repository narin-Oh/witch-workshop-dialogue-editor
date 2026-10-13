// Behaviour tests of the UnityEngine-facing components, running on hand-written STUBS of the Unity API (see Stubs.cs).
// They verify our wiring logic (event order, error handling, state flags), NOT real Unity behaviour.
using System;
using System.Collections.Generic;
using System.Reflection;
using NUnit.Framework;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using WitchWorkshop.Dialogue;

namespace WitchWorkshop.Dialogue.StubTests
{
    internal static class U
    {
        public static void Set(object target, string field, object value)
        {
            var f = target.GetType().GetField(field, BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
            if (f == null) { var b = target.GetType().BaseType; f = b?.GetField(field, BindingFlags.Instance | BindingFlags.NonPublic); }
            Assert.IsNotNull(f, "field " + field);
            f.SetValue(target, value);
        }

        public static void Call(object target, string method, params object[] args)
        {
            var m = target.GetType().GetMethod(method, BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
            Assert.IsNotNull(m, "method " + method);
            m.Invoke(target, args);
        }

        public static T Make<T>(GameObject go = null) where T : Component
        {
            go = go ?? new GameObject("go");
            return go.AddComponent<T>();
        }

        public static string Json(string name)
        {
            return System.IO.File.ReadAllText(System.IO.Path.Combine(AppContext.BaseDirectory, "Golden", name));
        }
    }

    /// <summary>A view that records what it is asked to display.</summary>
    internal sealed class FakeView : DialogueViewBase
    {
        public readonly List<string> Log = new List<string>();
        public int Binds;
        public override void Bind(IDialogueController c) { base.Bind(c); Binds++; }
        public override void Show() { Log.Add("show"); }
        public override void Hide() { Log.Add("hide"); }
        public override void ShowLine(DialogueLine line) { Log.Add("line:" + line.Text); }
        public override void ShowChoices(IReadOnlyList<DialogueChoice> c) { Log.Add("choices:" + c.Count); }
        public override void ShowError(string m) { Log.Add("error"); }
        public bool Advance() { return RequestAdvance(); }
        public bool Pick(int i) { return RequestChoice(i); }
    }

    public class LoaderTests
    {
        [Test]
        public void ParsesTheExportedSample()
        {
            Assert.IsTrue(DialogueLoader.TryParse(U.Json("potion-customer.dialogue.json"), out var graph, out var error), error);
            Assert.AreEqual("potion-customer", graph.Id);
            Assert.Greater(graph.NodeCount, 10);
        }

        [Test]
        public void GivesReadableErrors()
        {
            Assert.IsFalse(DialogueLoader.TryParse("", out _, out var e1)); StringAssert.Contains("empty", e1);
            Assert.IsFalse(DialogueLoader.TryParse("{ not json", out _, out var e2)); StringAssert.Contains("not valid JSON", e2);
            Assert.IsFalse(DialogueLoader.TryParse("{\"schemaVersion\":2}", out _, out var e3)); StringAssert.Contains("schemaVersion", e3);
            Assert.IsFalse(DialogueLoader.TryLoad(null, out _, out var e4)); StringAssert.Contains("No dialogue asset", e4);
            Assert.Throws<DialogueLoadException>(() => DialogueLoader.Parse("[]"));
        }
    }

    public class RunnerAndManagerTests
    {
        private const string Simple = "{\"schemaVersion\":1,\"id\":\"s\",\"name\":\"Simple\",\"startNodeId\":\"a\",\"variables\":[{\"name\":\"rep\",\"scope\":\"global\",\"valueType\":\"int\",\"initial\":{\"valueType\":\"int\",\"intValue\":0,\"boolValue\":false,\"stringValue\":\"\"}}],\"nodes\":[" +
            "{\"id\":\"a\",\"type\":\"dialogue\",\"speaker\":\"Mira\",\"displayName\":\"Mira\",\"text\":\"Hi\",\"next\":\"v\"}," +
            "{\"id\":\"v\",\"type\":\"variable\",\"variable\":\"rep\",\"operation\":\"add\",\"operand\":{\"valueType\":\"int\",\"intValue\":1,\"boolValue\":false,\"stringValue\":\"\"},\"next\":\"c\"}," +
            "{\"id\":\"c\",\"type\":\"choice\",\"choices\":[{\"id\":\"c1\",\"text\":\"Bye\",\"next\":\"e\"},{\"id\":\"c2\",\"text\":\"Stay\",\"next\":\"e\"}]}," +
            "{\"id\":\"e\",\"type\":\"end\",\"endingName\":\"Done\"}]}";

        private static (DialogueManager manager, DialogueRunner runner, FakeView view) Scene()
        {
            var go = new GameObject("manager");
            var runner = go.AddComponent<DialogueRunner>();
            var view = go.AddComponent<FakeView>();
            var manager = go.AddComponent<DialogueManager>();
            U.Call(manager, "AutoAssign");
            U.Call(manager, "OnEnable");
            return (manager, runner, view);
        }

        [Test]
        public void ManagerDrivesTheViewThroughAConversation()
        {
            var (manager, runner, view) = Scene();
            var ends = new List<string>();
            manager.DialogueEnded += e => ends.Add(e ?? "<null>");

            Assert.IsTrue(manager.StartDialogue(Simple));
            CollectionAssert.AreEqual(new[] { "show", "line:Hi" }, view.Log);
            Assert.IsTrue(manager.IsRunning);
            Assert.IsTrue(view.Advance());
            Assert.AreEqual("choices:2", view.Log[view.Log.Count - 1]);
            Assert.IsFalse(view.Advance(), "cannot advance while choices are showing");
            Assert.IsTrue(view.Pick(1));
            CollectionAssert.AreEqual(new[] { "show", "line:Hi", "choices:2", "hide" }, view.Log);
            CollectionAssert.AreEqual(new[] { "Done" }, ends);
            Assert.IsFalse(manager.IsRunning);
        }

        [Test]
        public void InvalidJsonRaisesNoStartOrEndEventsAndKeepsTheUiHidden()
        {
            var (manager, runner, view) = Scene();
            int started = 0, ended = 0;
            manager.DialogueStarted += _ => started++;
            manager.DialogueEnded += _ => ended++;
            Assert.IsFalse(manager.StartDialogue("{ nope"));
            Assert.AreEqual(0, started);
            Assert.AreEqual(0, ended, "a dialogue that never started never ends");
            CollectionAssert.Contains(view.Log, "error");
            CollectionAssert.DoesNotContain(view.Log, "show");
        }

        [Test]
        public void ErrorInsideAConversationEndsItExactlyOnceAndHidesTheView()
        {
            var (manager, runner, view) = Scene();
            // Structurally valid (passes validation) but loops forever without player input: fails at runtime.
            const string loop = "{\"schemaVersion\":1,\"id\":\"l\",\"name\":\"Loop\",\"startNodeId\":\"a\",\"variables\":[{\"name\":\"n\",\"scope\":\"local\",\"valueType\":\"int\",\"initial\":{\"valueType\":\"int\"}}],\"nodes\":[" +
                "{\"id\":\"a\",\"type\":\"variable\",\"variable\":\"n\",\"operation\":\"add\",\"operand\":{\"valueType\":\"int\",\"intValue\":1},\"next\":\"b\"}," +
                "{\"id\":\"b\",\"type\":\"variable\",\"variable\":\"n\",\"operation\":\"add\",\"operand\":{\"valueType\":\"int\",\"intValue\":1},\"next\":\"a\"}]}";
            int ended = 0; string ending = "unset";
            manager.DialogueEnded += e => { ended++; ending = e; };
            Assert.IsTrue(manager.StartDialogue(loop), "the data is valid, so the conversation starts");
            Assert.AreEqual(1, ended);
            Assert.IsNull(ending);
            CollectionAssert.AreEqual(new[] { "show", "error", "hide" }, view.Log);
            Assert.IsFalse(manager.IsRunning);
            Assert.AreEqual(DialogueErrorCode.LoopDetected, runner.Session.Error.Code);
        }

        [Test]
        public void SecondStartIsIgnoredWhileRunningUnlessInterruptIsEnabled()
        {
            var (manager, runner, view) = Scene();
            Assert.IsTrue(manager.StartDialogue(Simple));
            Assert.IsFalse(manager.StartDialogue(Simple), "already running");
            U.Set(runner, "interruptRunningDialogue", true);
            Assert.IsTrue(manager.StartDialogue(Simple));
            Assert.AreEqual(2, view.Log.FindAll(l => l == "show").Count);
        }

        [Test]
        public void GlobalsPersistAcrossConversationsEvenWithoutAStoreComponent()
        {
            var (manager, runner, view) = Scene();
            for (int i = 0; i < 3; i++)
            {
                Assert.IsTrue(manager.StartDialogue(Simple));
                view.Advance(); view.Pick(0);
            }
            runner.Session.TryGetVariable("rep", out var rep);
            Assert.AreEqual(3, rep.IntValue, "the in-memory fallback store is not reset by starting a dialogue");
        }

        [Test]
        public void EventDispatcherBindingsAndAttributedHandlersRunDuringTheConversation()
        {
            var go = new GameObject("manager");
            var runner = go.AddComponent<DialogueRunner>();
            var dispatcher = go.AddComponent<EventDispatcher>();
            var view = go.AddComponent<FakeView>();
            var manager = go.AddComponent<DialogueManager>();
            var seen = new List<string>();
            dispatcher.Register("Ping", a => seen.Add("ping:" + a.GetString("who")));
            U.Call(manager, "AutoAssign");
            U.Call(manager, "OnEnable");
            const string json = "{\"schemaVersion\":1,\"id\":\"e\",\"name\":\"E\",\"startNodeId\":\"ev\",\"nodes\":[{\"id\":\"ev\",\"type\":\"event\",\"eventName\":\"Ping\",\"eventParams\":[{\"key\":\"who\",\"valueType\":\"string\",\"stringValue\":\"Mira\"}],\"next\":\"end\"},{\"id\":\"end\",\"type\":\"end\"}]}";
            Assert.IsTrue(manager.StartDialogue(json));
            CollectionAssert.AreEqual(new[] { "ping:Mira" }, seen);
            Assert.IsFalse(manager.IsRunning);
        }
    }

    public class TriggerTests
    {
        private const string OneLine = "{\"schemaVersion\":1,\"id\":\"t\",\"name\":\"T\",\"startNodeId\":\"a\",\"nodes\":[{\"id\":\"a\",\"type\":\"dialogue\",\"text\":\"Hello\",\"next\":\"e\"},{\"id\":\"e\",\"type\":\"end\",\"endingName\":\"Fin\"}]}";

        private static (DialogueTrigger trigger, DialogueManager manager, FakeView view) Setup(bool oneShot = false)
        {
            var mgrGo = new GameObject("manager");
            mgrGo.AddComponent<DialogueRunner>();
            var view = mgrGo.AddComponent<FakeView>();
            var manager = mgrGo.AddComponent<DialogueManager>();
            U.Call(manager, "AutoAssign");
            U.Call(manager, "OnEnable");
            var trigger = new GameObject("npc").AddComponent<DialogueTrigger>();
            U.Set(trigger, "dialogue", new TextAsset(OneLine));
            U.Set(trigger, "manager", manager);
            U.Set(trigger, "oneShot", oneShot);
            return (trigger, manager, view);
        }

        [Test]
        public void BeginStartsTheAssignedDialogueAndReportsTheEnding()
        {
            var (trigger, manager, view) = Setup();
            int started = 0; string finished = null;
            trigger.onStarted.AddListener(() => started++);
            trigger.onFinished.AddListener(e => finished = e);
            Assert.IsTrue(trigger.Begin());
            Assert.AreEqual(1, started);
            Assert.IsNull(finished);
            Assert.IsTrue(view.Advance());
            Assert.AreEqual("Fin", finished);
        }

        [Test]
        public void CannotStartWhileAnotherConversationRuns()
        {
            var (trigger, manager, view) = Setup();
            Assert.IsTrue(trigger.Begin());
            Assert.IsFalse(trigger.Begin());
        }

        [Test]
        public void OneShotTriggersFireOnceUntilReset()
        {
            var (trigger, manager, view) = Setup(oneShot: true);
            Assert.IsTrue(trigger.Begin());
            view.Advance();
            Assert.IsFalse(trigger.Begin(), "one-shot already used");
            trigger.ResetTrigger();
            Assert.IsTrue(trigger.Begin());
        }

        [Test]
        public void MissingAssetOrInvalidJsonDoesNotFireEvents()
        {
            var (trigger, manager, view) = Setup();
            int started = 0, finished = 0;
            trigger.onStarted.AddListener(() => started++);
            trigger.onFinished.AddListener(_ => finished++);
            U.Set(trigger, "dialogue", null);
            Assert.IsFalse(trigger.Begin());
            Assert.IsFalse(trigger.Begin(new TextAsset("{ broken")));
            Assert.AreEqual(0, started);
            Assert.AreEqual(0, finished);
        }

        [Test]
        public void TagFilterAppliesToPhysicsEntry()
        {
            var (trigger, manager, view) = Setup();
            U.Set(trigger, "startMode", DialogueTrigger.StartMode.OnTriggerEnter);
            var other = new GameObject("rock") { tag = "Untagged" };
            var col = other.AddComponent<Collider>();
            U.Call(trigger, "OnTriggerEnter", col);
            Assert.IsFalse(manager.IsRunning, "wrong tag");
            other.tag = "Player";
            U.Call(trigger, "OnTriggerEnter", col);
            Assert.IsTrue(manager.IsRunning);
        }
    }

    public class DialogueUITests
    {
        private sealed class FakeResolver : PortraitResolverBase
        {
            public override bool TryResolve(string id, string expr, out Sprite sprite)
            {
                sprite = id == "mira" ? new Sprite { name = "mira_" + expr } : null;
                return sprite != null;
            }
        }

        private sealed class Controller : IDialogueController
        {
            public int Advances; public List<int> Picks = new List<int>();
            public bool IsRunning { get { return true; } }
            public bool Advance() { Advances++; return true; }
            public bool Choose(int i) { Picks.Add(i); return true; }
        }

        private static (DialogueUI ui, TextMeshProUGUI name, TextMeshProUGUI body, Image portrait, Button prefab, Controller ctl) Make()
        {
            var go = new GameObject("ui");
            var ui = go.AddComponent<DialogueUI>();
            var name = new GameObject("Name").AddComponent<TextMeshProUGUI>();
            var body = new GameObject("Body").AddComponent<TextMeshProUGUI>();
            var portrait = new GameObject("Portrait").AddComponent<Image>();
            var prefab = new GameObject("Choice").AddComponent<Button>();
            var container = new GameObject("Choices").AddComponent<RectTransform>();
            ui.Configure(name, body, portrait, container, prefab, new GameObject("Next").AddComponent<Button>());
            var ctl = new Controller();
            ui.Bind(ctl);
            return (ui, name, body, portrait, prefab, ctl);
        }

        private static DialogueLine Line(string speaker, string text, string portrait = "", string expr = "")
        {
            return new DialogueLine(new DialogueNodeData { id = "n", type = "dialogue", speaker = speaker, displayName = speaker, text = text, portraitId = portrait, expression = expr });
        }

        [Test]
        public void ShowsNameTextAndPortrait()
        {
            var (ui, name, body, portrait, _, _) = Make();
            var resolver = new GameObject("r").AddComponent<FakeResolver>();
            ui.PortraitResolver = resolver;
            ui.Show();
            ui.ShowLine(Line("Mira", "Hello there", "mira", "happy"));
            Assert.AreEqual("Mira", name.text);
            Assert.AreEqual("Hello there", body.text);
            Assert.AreEqual("mira_happy", portrait.sprite.name);
            Assert.IsTrue(portrait.enabled);
        }

        [Test]
        public void MissingPortraitHidesTheImageInsteadOfFailing()
        {
            var (ui, _, body, portrait, _, _) = Make();
            ui.PortraitResolver = new GameObject("r").AddComponent<FakeResolver>();
            ui.ShowLine(Line("Ghost", "Boo", "ghost", "x"));
            Assert.IsFalse(portrait.enabled);
            Assert.AreEqual("Boo", body.text);
            ui.PortraitResolver = null; // no resolver at all
            Assert.DoesNotThrow(() => ui.ShowLine(Line("Mira", "Still fine", "mira", "happy")));
        }

        [Test]
        public void AdvanceInputIsForwardedOnlyWhileALineIsWaiting()
        {
            var (ui, _, _, _, _, ctl) = Make();
            ui.OnAdvanceInput();
            Assert.AreEqual(0, ctl.Advances, "nothing is showing yet");
            ui.ShowLine(Line("Mira", "Hi"));
            ui.OnAdvanceInput();
            Assert.AreEqual(1, ctl.Advances);
        }

        [Test]
        public void ChoiceButtonsAreCreatedReusedAndRoutedToTheController()
        {
            var (ui, _, _, _, prefab, ctl) = Make();
            var choices = new List<DialogueChoice> { new DialogueChoice(0, "c0", "Yes"), new DialogueChoice(1, "c1", "No") };
            ui.ShowChoices(choices);
            var container = (RectTransform)typeof(DialogueUI).GetField("choiceContainer", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(ui);
            var buttons = (List<Button>)typeof(DialogueUI).GetField("choiceButtons", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(ui);
            Assert.AreEqual(2, buttons.Count);
            buttons[1].onClick.Invoke();
            CollectionAssert.AreEqual(new[] { 1 }, ctl.Picks);

            ui.ShowChoices(new List<DialogueChoice> { new DialogueChoice(0, "c0", "Only") });
            Assert.AreEqual(2, buttons.Count, "buttons are pooled, not recreated");
            Assert.IsTrue(buttons[0].gameObject.activeInHierarchy);
            Assert.IsFalse(buttons[1].gameObject.activeInHierarchy, "surplus buttons are hidden");

            ui.ShowLine(Line("Mira", "Next line"));
            Assert.IsFalse(buttons[0].gameObject.activeInHierarchy, "choices hide when a line is shown");
        }

        [Test]
        public void ReportsMissingReferences()
        {
            var ui = new GameObject("ui").AddComponent<DialogueUI>();
            var problems = new List<string>();
            ui.CollectProblems(problems);
            Assert.IsTrue(problems.Exists(p => p.StartsWith("Body Text")));
            Assert.IsTrue(problems.Exists(p => p.Contains("Choice Button Prefab")));
        }

        // ---- display modes (stub-level wiring checks; NOT real Unity rendering) ----

        private static DialogueLine ModeLine(string mode, string text)
        {
            return new DialogueLine(new DialogueNodeData { id = "n", type = "dialogue", displayMode = mode, speaker = "Mira", displayName = "Mira", text = text, portraitId = "mira", expression = "happy" });
        }

        private sealed class SceneRig
        {
            public DialogueUI ui; public GameObject host, panel, choices, overlay; public TextMeshProUGUI body, name, sceneText; public Image portrait; public GameObject plate; public Controller ctl;
        }

        /// <summary>The default-builder layout: host container with the normal UI (panel, choices) and the overlay as direct children.</summary>
        private static SceneRig MakeScene(bool overlayIsDirectChild = true)
        {
            var r = new SceneRig();
            r.host = new GameObject("Dialogue UI");
            r.ui = r.host.AddComponent<DialogueUI>();
            r.panel = new GameObject("Dialogue Panel"); r.panel.transform.SetParent(r.host.transform);
            r.choices = new GameObject("Choices"); r.choices.transform.SetParent(r.host.transform);
            r.overlay = new GameObject("Overlay"); r.overlay.transform.SetParent(overlayIsDirectChild ? r.host.transform : r.panel.transform);
            r.overlay.SetActive(false);
            r.name = new GameObject("Name").AddComponent<TextMeshProUGUI>();
            r.body = new GameObject("Body").AddComponent<TextMeshProUGUI>();
            r.portrait = new GameObject("Portrait").AddComponent<Image>();
            r.plate = new GameObject("Plate");
            r.sceneText = new GameObject("SceneText").AddComponent<TextMeshProUGUI>();
            var prefab = new GameObject("Choice").AddComponent<Button>();
            r.ui.Configure(r.name, r.body, r.portrait, new GameObject("c").AddComponent<RectTransform>(), prefab, new GameObject("Next").AddComponent<Button>(), r.plate);
            var sceneButton = new GameObject("SceneButton").AddComponent<Button>();
            r.ui.ConfigureSceneText(r.overlay, r.sceneText, sceneButton);
            r.ctl = new Controller();
            r.ui.Bind(r.ctl);
            r.ui.PortraitResolver = new GameObject("r").AddComponent<FakeResolver>();
            return r;
        }

        [Test]
        public void CharacterLineShowsNameAndPortraitAndKeepsTheOverlayHidden()
        {
            var r = MakeScene();
            r.ui.Show();
            r.ui.ShowLine(ModeLine("character", "Hello"));
            Assert.AreEqual("Mira", r.name.text);
            Assert.IsTrue(r.plate.activeSelf);
            Assert.IsTrue(r.portrait.enabled);
            Assert.IsFalse(r.overlay.activeSelf);
            Assert.IsFalse(r.ui.IsSceneTextShowing);
        }

        [Test]
        public void NarrationHidesNameAndPortraitButKeepsThePanel()
        {
            var r = MakeScene();
            r.ui.Show();
            r.ui.ShowLine(ModeLine("character", "Hi"));
            r.ui.ShowLine(ModeLine("narration", "Wind blows."));
            Assert.AreEqual("Wind blows.", r.body.text);
            Assert.IsFalse(r.plate.activeSelf, "no name plate");
            Assert.IsFalse(r.portrait.enabled, "no portrait, and the previous one does not linger");
            Assert.IsTrue(r.panel.activeSelf, "the dialogue panel stays");
            Assert.IsFalse(r.overlay.activeSelf);
            r.ui.ShowLine(ModeLine("character", "Back"));
            Assert.IsTrue(r.plate.activeSelf);
            Assert.IsTrue(r.portrait.enabled, "the portrait returns for the next character line");
        }

        [Test]
        public void SceneTextHidesTheNormalUiShowsTheOverlayAndRestoresOnAdvance()
        {
            var r = MakeScene();
            r.ui.Show();
            r.ui.ShowLine(ModeLine("character", "Hi"));
            r.ui.ShowLine(ModeLine("sceneTransition", "10 minutes later..."));
            Assert.IsTrue(r.ui.IsSceneTextShowing);
            Assert.IsTrue(r.overlay.activeSelf);
            Assert.AreEqual("10 minutes later...", r.sceneText.text);
            Assert.IsFalse(r.panel.activeSelf, "normal dialogue panel hidden");
            Assert.IsFalse(r.choices.activeSelf, "normal choices area hidden");

            r.ui.OnAdvanceInput(); // normal advance input, no timer
            Assert.AreEqual(1, r.ctl.Advances);

            r.ui.ShowLine(ModeLine("character", "Welcome back"));
            Assert.IsFalse(r.ui.IsSceneTextShowing);
            Assert.IsFalse(r.overlay.activeSelf, "overlay gone");
            Assert.IsTrue(r.panel.activeSelf && r.choices.activeSelf, "normal UI restored");
            Assert.AreEqual("Welcome back", r.body.text);
        }

        [Test]
        public void ConsecutiveSceneLinesKeepTheOverlayAndHideRestoresTheNormalUi()
        {
            var r = MakeScene();
            r.ui.Show();
            r.ui.ShowLine(ModeLine("sceneTransition", "One"));
            r.ui.ShowLine(ModeLine("sceneTransition", "Two"));
            Assert.AreEqual("Two", r.sceneText.text);
            Assert.IsFalse(r.panel.activeSelf);
            r.ui.Hide(); // e.g. the conversation ends right after the scene text
            Assert.IsFalse(r.overlay.activeSelf);
            Assert.IsTrue(r.panel.activeSelf, "next conversation starts with the normal UI back");
            Assert.IsFalse(r.ui.IsSceneTextShowing);
        }

        [Test]
        public void ChoicesAfterSceneTextRestoreTheNormalUi()
        {
            var r = MakeScene();
            r.ui.Show();
            r.ui.ShowLine(ModeLine("sceneTransition", "Later..."));
            r.ui.ShowChoices(new List<DialogueChoice> { new DialogueChoice(0, "c0", "Yes") });
            Assert.IsFalse(r.overlay.activeSelf);
            Assert.IsTrue(r.panel.activeSelf && r.choices.activeSelf);
        }

        [Test]
        public void SceneTextWithoutAnOverlayFallsBackToTheNormalPanel()
        {
            var (ui, name, body, portrait, _, _) = Make();
            ui.Show();
            ui.ShowLine(ModeLine("sceneTransition", "Later..."));
            Assert.AreEqual("Later...", body.text);
            Assert.IsFalse(portrait.enabled);
            Assert.IsFalse(ui.IsSceneTextShowing);
        }

        [Test]
        public void ReportsAnOverlayThatWouldBeHiddenWithTheNormalUi()
        {
            var r = MakeScene(overlayIsDirectChild: false);
            var problems = new List<string>();
            r.ui.CollectProblems(problems);
            Assert.IsTrue(problems.Exists(p => p.Contains("Scene Overlay Root")), string.Join(" | ", problems));
            var ok = MakeScene();
            var okProblems = new List<string>();
            ok.ui.CollectProblems(okProblems);
            Assert.IsFalse(okProblems.Exists(p => p.Contains("Scene Overlay Root")));
        }

        [Test]
        public void SpeakerStylesAreMatchedCaseInsensitively()
        {
            var (ui, name, body, _, _, _) = Make();
            var styles = (List<DialogueUI.SpeakerStyle>)typeof(DialogueUI).GetField("speakerStyles", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(ui);
            name.color = Color.white; body.color = Color.white; // the stub's default colour is transparent black; real TMP text defaults to white
            styles.Add(new DialogueUI.SpeakerStyle { match = "MIRA", nameColor = new Color(1, 0, 0), bodyColor = new Color(0, 1, 0) });
            ui.ShowLine(Line("Mira", "Styled"));
            Assert.AreEqual(1f, name.color.r);
            Assert.AreEqual(1f, body.color.g);
            ui.ShowLine(Line("Lumi", "Plain"));
            Assert.AreEqual(1f, name.color.g, "falls back to the captured default colour");
        }
    }

    public class ResolverComponentTests
    {
        [Test]
        public void CharacterPortraitResolverUsesSetsAndFallsBackGracefully()
        {
            var set = ScriptableObject.CreateInstance<PortraitSet>();
            set.PortraitId = "mira";
            set.DefaultSprite = new Sprite { name = "mira_default" };
            set.AddExpression("neutral", new Sprite { name = "mira_neutral" });
            set.AddExpression("happy", new Sprite { name = "mira_happy" });
            var resolver = new GameObject("r").AddComponent<CharacterPortraitResolver>();
            resolver.PortraitSets.Add(set);
            U.Set(resolver, "fallbackSprite", new Sprite { name = "fallback" });
            U.Set(resolver, "logMissing", false);

            Assert.IsTrue(resolver.TryResolve("mira", "happy", out var s)); Assert.AreEqual("mira_happy", s.name);
            Assert.AreEqual(PortraitMatch.DefaultExpression, resolver.Resolve("mira", "angry", out s)); Assert.AreEqual("mira_neutral", s.name);
            Assert.AreEqual(PortraitMatch.Fallback, resolver.Resolve("stranger", "x", out s)); Assert.AreEqual("fallback", s.name);
        }

        [Test]
        public void PlaceholderArtBuildsPortraitSetsWithoutArtwork()
        {
            var set = PlaceholderArt.CreatePortraitSet("mira", new Color(1, 0.8f, 0.7f), new[] { "happy", "sad" });
            Assert.AreEqual("mira", set.PortraitId);
            Assert.AreEqual(2, set.Expressions.Count);
        }
    }

    public class StoreComponentTests
    {
        [Test]
        public void SeededInMemoryStoreComponentProvidesSavedValues()
        {
            var comp = new GameObject("s").AddComponent<InMemoryVariableStoreComponent>();
            var seeds = (List<InMemoryVariableStoreComponent.SeedValue>)typeof(InMemoryVariableStoreComponent).GetField("seedValues", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(comp);
            seeds.Add(new InMemoryVariableStoreComponent.SeedValue { name = "gold", value = new DialogueTypedValue { valueType = "int", intValue = 42 } });
            seeds.Add(new InMemoryVariableStoreComponent.SeedValue { name = "bad", value = new DialogueTypedValue { valueType = "float" } });
            Assert.IsTrue(comp.TryGet("gold", out var v)); Assert.AreEqual(42, v.IntValue);
            Assert.IsFalse(comp.TryGet("bad", out _), "an invalid seed is ignored with a warning");
        }

        [Test]
        public void JsonFileStoreRoundTripsThroughTheFileSystem()
        {
            var dir = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "ww-store-" + Guid.NewGuid().ToString("N"));
            System.IO.Directory.CreateDirectory(dir);
            // Application.persistentDataPath is "." in the stub; run inside a temp working directory.
            var old = System.IO.Directory.GetCurrentDirectory();
            System.IO.Directory.SetCurrentDirectory(dir);
            try
            {
                var a = new GameObject("a").AddComponent<JsonFileVariableStore>();
                a.Set("gold", DialogueValue.FromInt(7));
                a.Set("flag", DialogueValue.FromBool(true));
                a.Set("mood", DialogueValue.FromString("happy"));
                var b = new GameObject("b").AddComponent<JsonFileVariableStore>();
                b.Load();
                Assert.IsTrue(b.TryGet("gold", out var g)); Assert.AreEqual(7, g.IntValue);
                Assert.IsTrue(b.TryGet("flag", out var f)); Assert.IsTrue(f.BoolValue);
                Assert.IsTrue(b.TryGet("mood", out var m)); Assert.AreEqual("happy", m.StringValue);
                b.DeleteSave();
                Assert.IsFalse(System.IO.File.Exists(b.FilePath));
            }
            finally
            {
                System.IO.Directory.SetCurrentDirectory(old);
                System.IO.Directory.Delete(dir, true);
            }
        }
    }
}
