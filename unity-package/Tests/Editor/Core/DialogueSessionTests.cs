using System;
using System.Collections.Generic;
using NUnit.Framework;
using static WitchWorkshop.Dialogue.Tests.DialogueBuilder;

namespace WitchWorkshop.Dialogue.Tests
{
    public class DialogueSessionTests
    {
        private static DialogueSession Make(DialogueBuilder b, IVariableStore store = null, DialogueEventRegistry events = null)
        {
            return new DialogueSession(b.Graph(), store, events);
        }

        // ------------------------------------------------------------ basic flow

        [Test]
        public void LinearConversationPlaysToTheEnd()
        {
            var b = new DialogueBuilder().Start("a").Line("a", "Hello", "b", displayName: "Customer").Line("b", "Bye", "end").End("end", "Done");
            var s = Make(b);
            var lines = new List<string>();
            string ending = null;
            s.LineShown += l => lines.Add(l.DisplayName + ": " + l.Text);
            s.Ended += e => ending = e;

            s.Start();
            Assert.AreEqual(DialogueSessionState.WaitingForAdvance, s.State);
            Assert.AreEqual("Mira", s.CurrentLine.Speaker);
            Assert.AreEqual("Customer", s.CurrentLine.DisplayName, "display name override wins");
            Assert.IsTrue(s.Advance());
            Assert.AreEqual("Mira", s.CurrentLine.DisplayName, "falls back to the speaker");
            Assert.IsTrue(s.Advance());
            Assert.AreEqual(DialogueSessionState.Finished, s.State);
            Assert.AreEqual("Done", ending);
            Assert.AreEqual("Done", s.EndingName);
            CollectionAssert.AreEqual(new[] { "Customer: Hello", "Mira: Bye" }, lines);
        }

        [Test]
        public void AdvanceAndChooseDoNothingWhenNothingIsWaiting()
        {
            var b = new DialogueBuilder().Start("a").Line("a", "Hi", "end").End("end");
            var s = Make(b);
            Assert.IsFalse(s.Advance(), "not started");
            Assert.IsFalse(s.Choose(0));
            s.Start();
            Assert.IsFalse(s.Choose(0), "a line is waiting, not a choice");
            Assert.AreEqual(DialogueSessionState.WaitingForAdvance, s.State);
        }

        [Test]
        public void ChoicesBranchAndIgnoreBadIndexes()
        {
            var b = new DialogueBuilder().Start("c")
                .Choice("c", ("left", "l"), ("right", "r"))
                .Line("l", "L", "end").Line("r", "R", "end").End("end");
            var s = Make(b);
            IReadOnlyList<DialogueChoice> shown = null;
            s.ChoicesShown += c => shown = c;
            s.Start();
            Assert.AreEqual(DialogueSessionState.WaitingForChoice, s.State);
            Assert.AreEqual(2, shown.Count);
            Assert.AreEqual("right", shown[1].Text);
            Assert.AreEqual(1, shown[1].Index);
            Assert.IsFalse(s.Choose(-1));
            Assert.IsFalse(s.Choose(2));
            Assert.AreEqual(DialogueSessionState.WaitingForChoice, s.State);
            Assert.IsTrue(s.Choose(1));
            Assert.AreEqual("R", s.CurrentLine.Text);
        }

        [Test]
        public void LoopsThatWaitForThePlayerAreFine()
        {
            var b = new DialogueBuilder().Start("a").Line("a", "again?", "a");
            var s = Make(b);
            s.Start();
            for (int i = 0; i < 100; i++) Assert.IsTrue(s.Advance());
            Assert.AreEqual(DialogueSessionState.WaitingForAdvance, s.State);
        }

        [Test]
        public void ListenerCanAdvanceSynchronously()
        {
            var b = new DialogueBuilder().Start("a").Line("a", "1", "b").Line("b", "2", "end").End("end", "auto");
            var s = Make(b);
            s.LineShown += _ => s.Advance(); // an "auto-play" view
            s.Start();
            Assert.AreEqual(DialogueSessionState.Finished, s.State);
            Assert.AreEqual("auto", s.EndingName);
        }

        [Test]
        public void StartRestartsFromTheBeginning()
        {
            var b = new DialogueBuilder().Start("a").Line("a", "1", "b").Line("b", "2", "end").End("end");
            var s = Make(b);
            s.Start(); s.Advance();
            Assert.AreEqual("2", s.CurrentLine.Text);
            s.Start();
            Assert.AreEqual("1", s.CurrentLine.Text);
            Assert.AreEqual(1, s.Steps);
        }

        // ------------------------------------------------------------ conditions and variables

        [TestCase("==", 5, true)]
        [TestCase("!=", 5, false)]
        [TestCase(">", 4, true)]
        [TestCase("<", 4, false)]
        [TestCase(">=", 5, true)]
        [TestCase("<=", 4, false)]
        public void IntConditionOperators(string op, int compare, bool expectTrue)
        {
            var b = new DialogueBuilder().Start("c").Var("gold", "global", Int(5))
                .Cond("c", "gold", op, Int(compare), "t", "f").Line("t", "TRUE", "end").Line("f", "FALSE", "end").End("end");
            var s = Make(b, new InMemoryVariableStore());
            s.Start();
            Assert.AreEqual(expectTrue ? "TRUE" : "FALSE", s.CurrentLine.Text);
        }

        [Test]
        public void BoolAndStringConditions()
        {
            var b = new DialogueBuilder().Start("c1").Var("flag", "local", Bool(true)).Var("mood", "local", Str("happy"))
                .Cond("c1", "flag", "==", Bool(true), "c2", "bad")
                .Cond("c2", "mood", "!=", Str("sad"), "ok", "bad")
                .Line("ok", "OK", "end").Line("bad", "BAD", "end").End("end");
            var s = Make(b);
            s.Start();
            Assert.AreEqual("OK", s.CurrentLine.Text);
        }

        [Test]
        public void VariableNodesSetAddAndSubtract()
        {
            var b = new DialogueBuilder().Start("v1").Var("n", "local", Int(10)).Var("flag", "local", Bool(false))
                .Set("v1", "n", "add", Int(5), "v2").Set("v2", "n", "subtract", Int(3), "v3").Set("v3", "flag", "set", Bool(true), "end").End("end");
            var s = Make(b);
            var changes = new List<string>();
            s.VariableChanged += (name, o, n, g) => changes.Add($"{name}:{o}->{n}:{g}");
            s.Start();
            Assert.AreEqual(DialogueSessionState.Finished, s.State);
            Assert.IsTrue(s.TryGetVariable("n", out var n));
            Assert.AreEqual(DialogueValue.FromInt(12), n);
            Assert.IsTrue(s.TryGetVariable("flag", out var f));
            Assert.AreEqual(DialogueValue.FromBool(true), f);
            CollectionAssert.AreEqual(new[] { "n:10->15:False", "n:15->12:False", "flag:false->true:False" }, changes);
        }

        // ------------------------------------------------------------ global vs local

        [Test]
        public void GlobalUsesDefaultUntilStoredThenStoreWins()
        {
            var b = new DialogueBuilder().Start("c").Var("gold", "global", Int(100))
                .Cond("c", "gold", ">=", Int(50), "rich", "poor").Line("rich", "RICH", "end").Line("poor", "POOR", "end").End("end");
            var store = new InMemoryVariableStore();
            var s1 = Make(b, store);
            s1.Start();
            Assert.AreEqual("RICH", s1.CurrentLine.Text, "no stored value: exported default (100) applies");
            Assert.AreEqual(0, store.Count, "reading must not write the default into the save");

            store.Set("gold", DialogueValue.FromInt(10)); // the game's save says 10
            var s2 = Make(b, store);
            s2.Start();
            Assert.AreEqual("POOR", s2.CurrentLine.Text, "the stored value beats the default");
        }

        [Test]
        public void GlobalVariablesPersistAndAreNeverResetBetweenConversations()
        {
            var b = new DialogueBuilder().Start("v").Var("rep", "global", Int(0))
                .Set("v", "rep", "add", Int(2), "end").End("end");
            var store = new InMemoryVariableStore();
            Make(b, store).Start();
            Make(b, store).Start();
            Make(b, store).Start();
            Assert.IsTrue(store.TryGet("rep", out var rep));
            Assert.AreEqual(DialogueValue.FromInt(6), rep, "three conversations, +2 each; starting a dialogue never resets the global");
        }

        [Test]
        public void LocalVariablesAreResetEachConversationAndNeverReachTheStore()
        {
            var b = new DialogueBuilder().Start("v").Var("tries", "local", Int(0))
                .Set("v", "tries", "add", Int(1), "end").End("end");
            var store = new InMemoryVariableStore();
            var s1 = Make(b, store);
            s1.Start();
            Assert.IsTrue(s1.TryGetVariable("tries", out var t1));
            Assert.AreEqual(DialogueValue.FromInt(1), t1);
            var s2 = Make(b, store);
            s2.Start();
            Assert.IsTrue(s2.TryGetVariable("tries", out var t2));
            Assert.AreEqual(DialogueValue.FromInt(1), t2, "a new session starts from the initial value, not 2");
            Assert.AreEqual(0, store.Count, "locals are not persisted");

            s2.Start(); // restart within the same session also resets locals
            Assert.IsTrue(s2.TryGetVariable("tries", out var t3));
            Assert.AreEqual(DialogueValue.FromInt(1), t3);
        }

        [Test]
        public void WithoutAStoreGlobalsActLikeSessionLocals()
        {
            var b = new DialogueBuilder().Start("v").Var("g", "global", Int(1)).Set("v", "g", "add", Int(1), "c")
                .Cond("c", "g", "==", Int(2), "yes", "no").Line("yes", "YES", "end").Line("no", "NO", "end").End("end");
            var s = Make(b);
            s.Start();
            Assert.AreEqual("YES", s.CurrentLine.Text);
        }

        [Test]
        public void DelegateStoreIntegratesWithExistingSaveCode()
        {
            var save = new Dictionary<string, int> { { "gold", 7 } }; // pretend this is the game's save system
            var store = new DelegateVariableStore(
                (string name, out DialogueValue v) => { bool ok = save.TryGetValue(name, out var i); v = ok ? DialogueValue.FromInt(i) : default; return ok; },
                (name, v) => save[name] = v.IntValue);
            var b = new DialogueBuilder().Start("v").Var("gold", "global", Int(100)).Set("v", "gold", "add", Int(5), "end").End("end");
            Make(b, store).Start();
            Assert.AreEqual(12, save["gold"]);
        }

        // ------------------------------------------------------------ graceful errors

        private static DialogueError Run(DialogueBuilder b, IVariableStore store = null)
        {
            var s = Make(b, store);
            DialogueError raised = null;
            s.ErrorOccurred += e => raised = e;
            s.Start();
            Assert.AreEqual(DialogueSessionState.Error, s.State);
            Assert.IsNotNull(s.Error);
            Assert.AreSame(s.Error, raised, "ErrorOccurred is raised exactly with the session error");
            Assert.IsFalse(s.IsRunning);
            Assert.IsFalse(s.Advance());
            return s.Error;
        }

        [Test]
        public void UnknownStartNodeIsAGracefulError()
        {
            Assert.AreEqual(DialogueErrorCode.UnknownNode, Run(new DialogueBuilder().Start("nope").End("end")).Code);
        }

        [Test]
        public void BrokenLinkIsAGracefulError()
        {
            var s = Make(new DialogueBuilder().Start("a").Line("a", "x", "ghost"));
            DialogueError raised = null;
            s.ErrorOccurred += e => raised = e;
            s.Start();
            Assert.AreEqual(DialogueSessionState.WaitingForAdvance, s.State);
            Assert.IsTrue(s.Advance());
            Assert.AreEqual(DialogueSessionState.Error, s.State, "the bad link is only hit when advancing");
            Assert.AreEqual(DialogueErrorCode.UnknownNode, raised.Code);
            Assert.AreEqual("a", raised.NodeId, "the error names the node that holds the bad link");
        }

        [Test]
        public void MissingLinksAreReported()
        {
            Assert.AreEqual(DialogueErrorCode.MissingLink, Run(new DialogueBuilder().Start("v").Var("n", "local", Int(0)).Set("v", "n", "add", Int(1), "")).Code);
            Assert.AreEqual(DialogueErrorCode.MissingLink, Run(new DialogueBuilder().Start("e").Event("e", "X", "")).Code);
            Assert.AreEqual(DialogueErrorCode.MissingLink, Run(new DialogueBuilder().Start("c").Var("n", "local", Int(0)).Cond("c", "n", "==", Int(0), "", "")).Code);
        }

        [Test]
        public void MissingChoiceLinkIsReportedWhenChosen()
        {
            var s = Make(new DialogueBuilder().Start("c").Choice("c", ("a", "")));
            s.Start();
            Assert.IsTrue(s.Choose(0));
            Assert.AreEqual(DialogueErrorCode.MissingLink, s.Error.Code);
        }

        [Test]
        public void UndefinedVariableAndTypeMismatchesAreGraceful()
        {
            Assert.AreEqual(DialogueErrorCode.UndefinedVariable, Run(new DialogueBuilder().Start("c").Cond("c", "ghost", "==", Int(1), "e", "e").End("e")).Code);
            Assert.AreEqual(DialogueErrorCode.TypeMismatch, Run(new DialogueBuilder().Start("c").Var("flag", "local", Bool(true)).Cond("c", "flag", "==", Int(1), "e", "e").End("e")).Code);
            Assert.AreEqual(DialogueErrorCode.InvalidOperator, Run(new DialogueBuilder().Start("c").Var("flag", "local", Bool(true)).Cond("c", "flag", ">", Bool(true), "e", "e").End("e")).Code);
            Assert.AreEqual(DialogueErrorCode.InvalidOperation, Run(new DialogueBuilder().Start("v").Var("flag", "local", Bool(true)).Set("v", "flag", "add", Bool(true), "e").End("e")).Code);
            Assert.AreEqual(DialogueErrorCode.InvalidOperation, Run(new DialogueBuilder().Start("v").Var("n", "local", Int(1)).Set("v", "n", "multiply", Int(2), "e").End("e")).Code);
        }

        [Test]
        public void WrongTypeInTheSaveIsReportedNotCrashed()
        {
            var store = new InMemoryVariableStore();
            store.Set("gold", DialogueValue.FromString("lots"));
            var e = Run(new DialogueBuilder().Start("c").Var("gold", "global", Int(1)).Cond("c", "gold", ">", Int(0), "x", "x").End("x"), store);
            Assert.AreEqual(DialogueErrorCode.TypeMismatch, e.Code);
        }

        [Test]
        public void UnknownNodeTypeAndEmptyChoiceNodeAreGraceful()
        {
            var weird = new DialogueBuilder().Start("w").Node(new DialogueNodeData { id = "w", type = "teleport" });
            Assert.AreEqual(DialogueErrorCode.UnknownNodeType, Run(weird).Code);
            var empty = new DialogueBuilder().Start("c").Node(new DialogueNodeData { id = "c", type = "choice", choices = new DialogueChoiceData[0] });
            Assert.AreEqual(DialogueErrorCode.NoChoices, Run(empty).Code);
        }

        [Test]
        public void RunawayAutomaticLoopIsStopped()
        {
            var b = new DialogueBuilder().Start("a").Var("n", "local", Int(0)).Set("a", "n", "add", Int(1), "b").Set("b", "n", "add", Int(1), "a");
            var e = Run(b);
            Assert.AreEqual(DialogueErrorCode.LoopDetected, e.Code);
            var s = Make(b);
            s.Start();
            Assert.LessOrEqual(s.Steps, DialogueSession.MaxAutoSteps + 1);
        }

        [Test]
        public void CountingLoopThatTerminatesIsAllowed()
        {
            var b = new DialogueBuilder().Start("c").Var("n", "local", Int(0))
                .Cond("c", "n", ">=", Int(50), "done", "inc").Set("inc", "n", "add", Int(1), "c").Line("done", "done", "end").End("end");
            var s = Make(b);
            s.Start();
            Assert.AreEqual(DialogueSessionState.WaitingForAdvance, s.State);
            Assert.IsTrue(s.TryGetVariable("n", out var n));
            Assert.AreEqual(50, n.IntValue);
        }

        // ------------------------------------------------------------ events

        [Test]
        public void EventsReachHandlersWithTypedParametersInOrder()
        {
            var b = new DialogueBuilder().Start("e1")
                .Event("e1", "GiveItem", "e2", Param("itemId", "herb"), Param("amount", 3))
                .Event("e2", "OpenShop", "end", Param("shopId", "main"), Param("firstVisit", true)).End("end");
            var reg = new DialogueEventRegistry();
            var seen = new List<string>();
            reg.Register("GiveItem", a => seen.Add($"give {a.GetString("itemId")} x{a.GetInt("amount")}"));
            reg.Register("OpenShop", a => seen.Add($"shop {a.GetString("shopId")} first={a.GetBool("firstVisit")}"));
            var s = Make(b, null, reg);
            s.Start();
            Assert.AreEqual(DialogueSessionState.Finished, s.State);
            CollectionAssert.AreEqual(new[] { "give herb x3", "shop main first=True" }, seen);
        }

        [Test]
        public void UnhandledEventWarnsAndContinues()
        {
            var b = new DialogueBuilder().Start("e").Event("e", "Unknown", "end").End("end");
            var s = Make(b, null, new DialogueEventRegistry());
            var warnings = new List<string>();
            s.Warning += warnings.Add;
            s.Start();
            Assert.AreEqual(DialogueSessionState.Finished, s.State);
            Assert.AreEqual(1, warnings.Count);
            StringAssert.Contains("Unknown", warnings[0]);

            var s2 = Make(b); // no registry at all
            s2.Start();
            Assert.AreEqual(DialogueSessionState.Finished, s2.State);
        }

        [Test]
        public void ThrowingHandlerIsContainedAndReported()
        {
            var b = new DialogueBuilder().Start("e").Event("e", "Boom", "end").End("end");
            var reg = new DialogueEventRegistry();
            reg.Register("Boom", _ => throw new InvalidOperationException("kaboom"));
            var after = false;
            reg.Register("Boom", _ => after = true);
            var s = Make(b, null, reg);
            var warnings = new List<string>();
            s.Warning += warnings.Add;
            s.Start();
            Assert.AreEqual(DialogueSessionState.Finished, s.State, "the conversation survives a faulty game handler");
            Assert.IsTrue(after, "other handlers still run");
            Assert.AreEqual(1, warnings.Count);
            StringAssert.Contains("kaboom", warnings[0]);
        }

        [Test]
        public void HandlerCanStopTheConversation()
        {
            var b = new DialogueBuilder().Start("e").Event("e", "ChangeScene", "l").Line("l", "never shown", "end").End("end");
            var reg = new DialogueEventRegistry();
            DialogueSession session = null;
            reg.Register("ChangeScene", _ => session.Stop());
            session = Make(b, null, reg);
            bool lineShown = false;
            bool aborted = false;
            session.LineShown += _ => lineShown = true;
            session.Ended += e => aborted = e == null;
            session.Start();
            Assert.IsFalse(lineShown);
            Assert.IsTrue(aborted);
            Assert.IsTrue(session.WasAborted);
            Assert.AreEqual(DialogueSessionState.Finished, session.State);
        }

        [Test]
        public void StopEndsAWaitingConversation()
        {
            var b = new DialogueBuilder().Start("a").Line("a", "x", "end").End("end", "Real");
            var s = Make(b);
            string ending = "unset";
            s.Ended += e => ending = e;
            s.Start();
            s.Stop();
            Assert.IsNull(ending);
            Assert.IsTrue(s.WasAborted);
            Assert.IsNull(s.CurrentLine);
            Assert.IsFalse(s.Advance());
            s.Stop(); // second stop is a no-op
        }
    }
}
