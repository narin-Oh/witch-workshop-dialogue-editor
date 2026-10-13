using System.Collections;
using System.Collections.Generic;
using NUnit.Framework;
using TMPro;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace WitchWorkshop.Dialogue.Tests
{
    /// <summary>
    /// PlayMode tests that need the real Unity runtime (JsonUtility, uGUI, TextMeshPro, MonoBehaviour lifecycle).
    /// They have NOT been run: no Unity Editor was available when they were written (see Documentation~/TestingStatus.md).
    /// </summary>
    public class RuntimeIntegrationTests
    {
        private const string Json =
            "{\"schemaVersion\":1,\"id\":\"t\",\"name\":\"Test\",\"startNodeId\":\"a\"," +
            "\"variables\":[{\"name\":\"rep\",\"scope\":\"global\",\"valueType\":\"int\",\"initial\":{\"valueType\":\"int\",\"intValue\":0,\"boolValue\":false,\"stringValue\":\"\"}}]," +
            "\"nodes\":[" +
            "{\"id\":\"a\",\"type\":\"dialogue\",\"speaker\":\"Mira\",\"displayName\":\"Mira\",\"text\":\"Hello!\",\"portraitId\":\"mira\",\"expression\":\"happy\",\"next\":\"c\"}," +
            "{\"id\":\"c\",\"type\":\"choice\",\"choices\":[{\"id\":\"c1\",\"text\":\"Buy\",\"next\":\"v\"},{\"id\":\"c2\",\"text\":\"Leave\",\"next\":\"e2\"}]}," +
            "{\"id\":\"v\",\"type\":\"variable\",\"variable\":\"rep\",\"operation\":\"add\",\"operand\":{\"valueType\":\"int\",\"intValue\":1,\"boolValue\":false,\"stringValue\":\"\"},\"next\":\"ev\"}," +
            "{\"id\":\"ev\",\"type\":\"event\",\"eventName\":\"Ping\",\"eventParams\":[{\"key\":\"who\",\"valueType\":\"string\",\"stringValue\":\"Mira\"}],\"next\":\"e1\"}," +
            "{\"id\":\"e1\",\"type\":\"end\",\"endingName\":\"Bought\"}," +
            "{\"id\":\"e2\",\"type\":\"end\",\"endingName\":\"Left\"}]}";

        private readonly List<GameObject> created = new List<GameObject>();

        [TearDown]
        public void TearDown()
        {
            foreach (var go in created) if (go != null) Object.Destroy(go);
            created.Clear();
        }

        private GameObject NewObject(string name)
        {
            var go = new GameObject(name);
            created.Add(go);
            return go;
        }

        [Test]
        public void JsonUtilityReadsTheExportedFormat()
        {
            Assert.IsTrue(DialogueLoader.TryParse(Json, out var graph, out var error), error);
            Assert.AreEqual("Test", graph.Name);
            Assert.IsTrue(graph.TryGetNode("c", out var choice));
            Assert.AreEqual(2, choice.choices.Length);
            Assert.IsTrue(graph.TryGetNode("ev", out var ev));
            Assert.AreEqual("who", ev.eventParams[0].key);
        }

        [UnityTest]
        public IEnumerator DefaultUiRunsAConversationEndToEnd()
        {
            var root = NewObject("Dialogue System");
            var runner = root.AddComponent<DialogueRunner>();
            var dispatcher = root.AddComponent<EventDispatcher>();
            var store = root.AddComponent<InMemoryVariableStoreComponent>();
            var built = DefaultDialogueUIBuilder.Build(root.transform, ensureEventSystem: true);
            created.Add(built.Canvas.gameObject);
            var manager = root.AddComponent<DialogueManager>();
            manager.Setup(runner, built.UI, store, dispatcher);

            var events = new List<string>();
            dispatcher.Register("Ping", a => events.Add(a.GetString("who")));
            string ending = null;
            manager.DialogueEnded += e => ending = e;

            Assert.IsTrue(manager.StartDialogue(Json));
            yield return null;
            Assert.IsTrue(built.UI.PanelRoot.activeInHierarchy, "panel is visible during the conversation");
            var texts = built.UI.GetComponentsInChildren<TMP_Text>(false);
            Assert.IsTrue(System.Array.Exists(texts, t => t.text == "Hello!"));

            built.UI.OnAdvanceInput();
            yield return null;
            var choiceButtons = built.UI.GetComponentsInChildren<Button>(false);
            Assert.IsTrue(System.Array.Exists(choiceButtons, b => b.GetComponentInChildren<TMP_Text>()?.text == "Buy"));

            foreach (var b in choiceButtons)
                if (b.GetComponentInChildren<TMP_Text>()?.text == "Buy") { b.onClick.Invoke(); break; }
            yield return null;

            Assert.AreEqual("Bought", ending);
            CollectionAssert.AreEqual(new[] { "Mira" }, events);
            Assert.IsTrue(store.TryGet("rep", out var rep));
            Assert.AreEqual(1, rep.IntValue, "global variable written to the store");
            Assert.IsFalse(built.UI.PanelRoot.activeInHierarchy, "panel hides when the conversation ends");
        }

        [UnityTest]
        public IEnumerator TypewriterCompletesTheLineBeforeAdvancing()
        {
            var built = DefaultDialogueUIBuilder.Build(null, ensureEventSystem: false);
            created.Add(built.Canvas.gameObject);
            var controller = new CountingController();
            built.UI.Bind(controller);
            built.UI.CharactersPerSecond = 5f;
            built.UI.Show();
            built.UI.ShowLine(new DialogueLine(new DialogueNodeData { id = "n", type = "dialogue", speaker = "A", displayName = "A", text = "A fairly long line of text" }));
            yield return null;
            Assert.IsTrue(built.UI.IsLineAnimating);
            built.UI.OnAdvanceInput();
            Assert.IsFalse(built.UI.IsLineAnimating, "first press completes the line");
            Assert.AreEqual(0, controller.Advances);
            built.UI.OnAdvanceInput();
            Assert.AreEqual(1, controller.Advances, "second press advances");
        }

        [UnityTest]
        public IEnumerator SceneTransitionTextShowsABlackOverlayAndRestoresTheNormalUi()
        {
            var built = DefaultDialogueUIBuilder.Build(null, ensureEventSystem: false);
            created.Add(built.Canvas.gameObject);
            var controller = new CountingController();
            built.UI.Bind(controller);
            built.UI.Show();
            built.UI.ShowLine(new DialogueLine(new DialogueNodeData { id = "s", type = "dialogue", displayMode = "sceneTransition", text = "10 minutes later..." }));
            yield return null;
            Assert.IsTrue(built.UI.IsSceneTextShowing);
            var panel = built.UI.transform.Find("Dialogue Panel");
            var overlay = built.UI.transform.Find("Scene Text Overlay");
            Assert.IsFalse(panel.gameObject.activeSelf, "normal dialogue UI is hidden");
            Assert.IsTrue(overlay.gameObject.activeSelf);
            Assert.AreEqual(Color.black, overlay.GetComponent<Image>().color);
            Assert.AreEqual("10 minutes later...", overlay.GetComponentInChildren<TMP_Text>().text);

            built.UI.OnAdvanceInput();
            Assert.AreEqual(1, controller.Advances, "scene text advances through the normal input");

            built.UI.ShowLine(new DialogueLine(new DialogueNodeData { id = "c", type = "dialogue", displayMode = "character", speaker = "A", displayName = "A", text = "Back" }));
            yield return null;
            Assert.IsFalse(overlay.gameObject.activeSelf);
            Assert.IsTrue(panel.gameObject.activeSelf, "normal UI is restored");
        }

        [Test]
        public void PortraitResolverReturnsASpriteAndNeverThrowsForUnknownIds()
        {
            var tex = new Texture2D(4, 4);
            var sprite = Sprite.Create(tex, new Rect(0, 0, 4, 4), new Vector2(0.5f, 0.5f));
            var set = ScriptableObject.CreateInstance<PortraitSet>();
            set.PortraitId = "mira";
            set.AddExpression("happy", sprite);
            var go = NewObject("resolver");
            var resolver = go.AddComponent<CharacterPortraitResolver>();
            resolver.PortraitSets.Add(set);
            Assert.AreEqual(PortraitMatch.Exact, resolver.Resolve("mira", "happy", out var found));
            Assert.AreSame(sprite, found);
            LogAssert.ignoreFailingMessages = true; // the resolver logs a warning for missing art
            Assert.AreEqual(PortraitMatch.None, resolver.Resolve("nobody", "x", out found));
            Assert.IsNull(found);
            LogAssert.ignoreFailingMessages = false;
            Object.DestroyImmediate(set);
            Object.DestroyImmediate(tex);
        }

        private sealed class CountingController : IDialogueController
        {
            public int Advances;
            public bool IsRunning { get { return true; } }
            public bool Advance() { Advances++; return true; }
            public bool Choose(int index) { return true; }
        }
    }
}
