using NUnit.Framework;
using static WitchWorkshop.Dialogue.Tests.DialogueBuilder;

namespace WitchWorkshop.Dialogue.Tests
{
    /// <summary>Dialogue display modes: Character Dialogue, Narration, Scene Transition Text, and compatibility with older exports.</summary>
    public class DisplayModeTests
    {
        private const string OldExport = @"{
  ""schemaVersion"": 1, ""id"": ""old"", ""name"": ""Old"", ""startNodeId"": ""a"", ""variables"": [],
  ""nodes"": [
    { ""id"": ""a"", ""type"": ""dialogue"", ""speaker"": ""Mira"", ""displayName"": ""Mira"", ""text"": ""Hi"", ""portraitId"": ""mira"", ""expression"": ""happy"", ""next"": ""b"" },
    { ""id"": ""b"", ""type"": ""end"", ""endingName"": ""Done"" }
  ]
}";

        private const string NewExport = @"{
  ""schemaVersion"": 1, ""id"": ""new"", ""name"": ""New"", ""startNodeId"": ""a"", ""variables"": [],
  ""nodes"": [
    { ""id"": ""a"", ""type"": ""dialogue"", ""displayMode"": ""narration"", ""text"": ""The shop is quiet."", ""next"": ""b"" },
    { ""id"": ""b"", ""type"": ""dialogue"", ""displayMode"": ""sceneTransition"", ""text"": ""10 minutes later..."", ""next"": ""c"" },
    { ""id"": ""c"", ""type"": ""dialogue"", ""displayMode"": ""character"", ""speaker"": ""Mira"", ""displayName"": ""Mira"", ""text"": ""You're back."", ""portraitId"": ""mira"", ""expression"": ""happy"", ""next"": ""d"" },
    { ""id"": ""d"", ""type"": ""end"", ""endingName"": ""Done"" }
  ]
}";

        [Test]
        public void ExportsWithoutDisplayModeAreCharacterDialogue()
        {
            var data = TestSupport.FromJson<DialogueData>(OldExport);
            var session = new DialogueSession(new DialogueGraph(data));
            session.Start();
            Assert.AreEqual(DialogueDisplayMode.Character, session.CurrentLine.Mode);
            Assert.AreEqual("Mira", session.CurrentLine.DisplayName);
            Assert.AreEqual("mira", session.CurrentLine.PortraitId);
            Assert.AreEqual("happy", session.CurrentLine.Expression);
            Assert.IsEmpty(DialogueValidator.Validate(data), "older exports still validate");
        }

        [Test]
        public void UnknownOrEmptyModesFallBackToCharacter()
        {
            Assert.AreEqual(DialogueDisplayMode.Character, DialogueLine.ParseMode(""));
            Assert.AreEqual(DialogueDisplayMode.Character, DialogueLine.ParseMode(null));
            Assert.AreEqual(DialogueDisplayMode.Character, DialogueLine.ParseMode("subtitle-from-the-future"));
            Assert.AreEqual(DialogueDisplayMode.Narration, DialogueLine.ParseMode("narration"));
            Assert.AreEqual(DialogueDisplayMode.SceneTransition, DialogueLine.ParseMode("sceneTransition"));
        }

        [Test]
        public void ModesReachTheViewInOrderAndAdvanceNormally()
        {
            var data = TestSupport.FromJson<DialogueData>(NewExport);
            var session = new DialogueSession(new DialogueGraph(data));
            session.Start();
            Assert.AreEqual(DialogueDisplayMode.Narration, session.CurrentLine.Mode);
            Assert.AreEqual("The shop is quiet.", session.CurrentLine.Text);
            Assert.AreEqual(DialogueSessionState.WaitingForAdvance, session.State);

            Assert.IsTrue(session.Advance());
            Assert.AreEqual(DialogueDisplayMode.SceneTransition, session.CurrentLine.Mode);
            Assert.AreEqual("10 minutes later...", session.CurrentLine.Text);
            // No timer: the scene text waits for the normal advance and nothing else moves the session on.
            Assert.AreEqual(DialogueSessionState.WaitingForAdvance, session.State);

            Assert.IsTrue(session.Advance());
            Assert.AreEqual(DialogueDisplayMode.Character, session.CurrentLine.Mode);
            Assert.AreEqual("Mira", session.CurrentLine.DisplayName);
            Assert.AreEqual("mira", session.CurrentLine.PortraitId);

            Assert.IsTrue(session.Advance());
            Assert.AreEqual(DialogueSessionState.Finished, session.State);
        }

        [Test]
        public void NarrationAndSceneLinesCarryNoSpeakerOrPortrait()
        {
            // Even hand-edited data that still has speaker/portrait values must not leak them into these modes.
            var leftovers = new DialogueNodeData { id = "n", type = "dialogue", displayMode = "narration", speaker = "Mira", displayName = "Mira", portraitId = "mira", expression = "happy", text = "Wind." };
            var line = new DialogueLine(leftovers);
            Assert.AreEqual("", line.Speaker);
            Assert.AreEqual("", line.DisplayName);
            Assert.AreEqual("", line.PortraitId);
            Assert.AreEqual("", line.Expression);
            Assert.AreEqual("Wind.", line.Text);

            leftovers.displayMode = "sceneTransition";
            Assert.AreEqual("", new DialogueLine(leftovers).DisplayName);
        }

        [Test]
        public void ChoicesAndEventsStillWorkAroundSceneText()
        {
            var b = new DialogueBuilder().Start("a")
                .Node(new DialogueNodeData { id = "a", type = "dialogue", displayMode = "sceneTransition", text = "Later...", next = "c" })
                .Choice("c", ("Yes", "e"), ("No", "e"))
                .End("e", "Done");
            var s = new DialogueSession(b.Graph());
            s.Start();
            Assert.AreEqual(DialogueDisplayMode.SceneTransition, s.CurrentLine.Mode);
            Assert.IsTrue(s.Advance());
            Assert.AreEqual(DialogueSessionState.WaitingForChoice, s.State);
            Assert.IsTrue(s.Choose(0));
            Assert.AreEqual(DialogueSessionState.Finished, s.State);
        }
    }
}
