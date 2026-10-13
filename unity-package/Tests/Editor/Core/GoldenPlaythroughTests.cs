using System.Collections.Generic;
using NUnit.Framework;

namespace WitchWorkshop.Dialogue.Tests
{
    /// <summary>
    /// Replays playthroughs recorded from the web editor's own preview runner (Golden/*.golden.json) against the C# engine.
    /// If these pass, the Unity runtime behaves exactly like the editor's preview for the sample dialogues:
    /// same lines, choices, variable results, events and endings.
    /// </summary>
    public class GoldenPlaythroughTests
    {
        private static readonly string[] Files = { "potion-customer.golden.json", "apprentice-quest.golden.json" };

        private static IEnumerable<TestCaseData> AllScenarios()
        {
            foreach (var file in Files)
            {
                var golden = TestSupport.FromJson<GoldenFile>(TestSupport.ReadGolden(file));
                for (int i = 0; i < golden.scenarios.Length; i++)
                    yield return new TestCaseData(file, i).SetName($"{golden.dialogueId}: {golden.scenarios[i].name}");
            }
        }

        [TestCaseSource(nameof(AllScenarios))]
        public void MatchesEditorPreview(string file, int index)
        {
            var golden = TestSupport.FromJson<GoldenFile>(TestSupport.ReadGolden(file));
            var scenario = golden.scenarios[index];
            var graph = new DialogueGraph(TestSupport.LoadDialogue(golden.dialogueFile));

            var store = new InMemoryVariableStore();
            foreach (var o in scenario.globalOverrides) store.Set(o.name, o.ToValue());

            var session = new DialogueSession(graph, store, new DialogueEventRegistry());
            var raised = new List<DialogueEventArgs>();
            session.EventRaised += raised.Add;
            session.Warning += _ => { }; // no handlers registered here: unhandled-event warnings are expected

            session.Start();
            var actual = new List<GoldenStep>();
            int pickIndex = 0;
            for (int guard = 0; guard < 500; guard++)
            {
                if (session.State == DialogueSessionState.Error) Assert.Fail("Session error: " + session.Error);
                if (session.State == DialogueSessionState.Finished)
                {
                    actual.Add(new GoldenStep { kind = "end", ending = session.EndingName });
                    break;
                }
                if (session.State == DialogueSessionState.WaitingForAdvance)
                {
                    var l = session.CurrentLine;
                    actual.Add(new GoldenStep { kind = "line", displayMode = ModeName(l.Mode), displayName = l.DisplayName, text = l.Text, portraitId = l.PortraitId, expression = l.Expression });
                    Assert.IsTrue(session.Advance());
                }
                else
                {
                    var texts = new List<string>();
                    foreach (var c in session.CurrentChoices) texts.Add(c.Text);
                    actual.Add(new GoldenStep { kind = "choices", choices = texts.ToArray() });
                    int pick = scenario.picks[pickIndex++];
                    actual.Add(new GoldenStep { kind = "pick", pick = pick, text = session.CurrentChoices[pick].Text });
                    Assert.IsTrue(session.Choose(pick));
                }
            }

            // steps
            Assert.AreEqual(scenario.steps.Length, actual.Count, "number of steps");
            for (int i = 0; i < actual.Count; i++)
            {
                var e = scenario.steps[i];
                var a = actual[i];
                string at = $"step {i} ({e.kind})";
                Assert.AreEqual(e.kind, a.kind, at + " kind");
                switch (e.kind)
                {
                    case "line":
                        Assert.AreEqual(e.displayMode, a.displayMode, at + " displayMode");
                        Assert.AreEqual(e.displayName, a.displayName, at + " displayName");
                        Assert.AreEqual(e.text, a.text, at + " text");
                        Assert.AreEqual(e.portraitId, a.portraitId, at + " portraitId");
                        Assert.AreEqual(e.expression, a.expression, at + " expression");
                        break;
                    case "choices":
                        CollectionAssert.AreEqual(e.choices, a.choices, at + " choices");
                        break;
                    case "pick":
                        Assert.AreEqual(e.pick, a.pick, at + " pick");
                        Assert.AreEqual(e.text, a.text, at + " picked text");
                        break;
                    case "end":
                        Assert.AreEqual(e.ending, a.ending, at + " ending");
                        break;
                }
            }
            Assert.AreEqual(scenario.picks.Length, pickIndex, "all picks used");

            // events, with typed parameters
            Assert.AreEqual(scenario.events.Length, raised.Count, "number of events");
            for (int i = 0; i < raised.Count; i++)
            {
                Assert.AreEqual(scenario.events[i].name, raised[i].Name, $"event {i} name");
                Assert.AreEqual(scenario.events[i].parameters.Length, raised[i].Parameters.Count, $"event {i} parameter count");
                for (int p = 0; p < raised[i].Parameters.Count; p++)
                {
                    var exp = scenario.events[i].parameters[p];
                    Assert.IsTrue(raised[i].TryGetValue(exp.key, out var got), $"event {i} param {exp.key} present");
                    Assert.AreEqual(exp.ToValue(), got, $"event {i} param {exp.key}");
                }
            }

            // final variable values (locals live in the session, globals in the store)
            foreach (var v in scenario.finalVars)
            {
                Assert.IsTrue(session.TryGetVariable(v.name, out var value), "variable " + v.name);
                Assert.AreEqual(v.ToValue(), value, "final value of " + v.name);
            }
        }

        private static string ModeName(DialogueDisplayMode m)
        {
            return m == DialogueDisplayMode.Narration ? "narration" : m == DialogueDisplayMode.SceneTransition ? "sceneTransition" : "character";
        }

        [Test]
        public void SampleDialoguesPassValidation()
        {
            foreach (var file in new[] { "potion-customer.dialogue.json", "apprentice-quest.dialogue.json" })
                Assert.IsEmpty(DialogueValidator.Validate(TestSupport.LoadDialogue(file)), file);
        }
    }
}
