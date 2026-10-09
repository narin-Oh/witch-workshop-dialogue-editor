using System;
using System.Collections.Generic;
using NUnit.Framework;
using static WitchWorkshop.Dialogue.Tests.DialogueBuilder;

namespace WitchWorkshop.Dialogue.Tests
{
    public class DialogueEventArgsTests
    {
        private static DialogueEventArgs Args()
        {
            return new DialogueEventArgs("GiveItem", new[] { Param("itemId", "herb"), Param("amount", 3), Param("firstTime", true) });
        }

        [Test]
        public void TypedAccessRequiresTheExactType()
        {
            var a = Args();
            Assert.IsTrue(a.TryGetString("itemId", out var s)); Assert.AreEqual("herb", s);
            Assert.IsTrue(a.TryGetInt("amount", out var n)); Assert.AreEqual(3, n);
            Assert.IsTrue(a.TryGetBool("firstTime", out var b)); Assert.IsTrue(b);
            Assert.IsFalse(a.TryGetInt("itemId", out _), "a string is not an int");
            Assert.IsFalse(a.TryGetString("amount", out _), "an int is not a string");
            Assert.IsFalse(a.TryGetBool("amount", out _));
            Assert.IsFalse(a.TryGetString("missing", out _));
        }

        [Test]
        public void GettersFallBackAndKeysIgnoreCase()
        {
            var a = Args();
            Assert.AreEqual("none", a.GetString("missing", "none"));
            Assert.AreEqual(9, a.GetInt("itemId", 9));
            Assert.AreEqual("herb", a.GetString("ITEMID"));
            Assert.IsTrue(a.Has("Amount"));
            Assert.IsTrue(a.TryGetValue("amount", out var v));
            Assert.AreEqual(DialogueValue.FromInt(3), v);
            Assert.AreEqual("GiveItem(itemId=herb, amount=3, firstTime=true)", a.ToString());
        }
    }

    public class DialogueEventRegistryTests
    {
        private static DialogueEventArgs Args(string name, params DialogueEventParam[] p) { return new DialogueEventArgs(name, p); }

        [Test]
        public void RegisterUnregisterAndRaise()
        {
            var reg = new DialogueEventRegistry();
            int calls = 0;
            Action<DialogueEventArgs> h = _ => calls++;
            reg.Register("A", h);
            Assert.IsTrue(reg.IsRegistered("A"));
            Assert.IsFalse(reg.IsRegistered("B"));
            Assert.IsTrue(reg.Raise(Args("A")));
            Assert.IsFalse(reg.Raise(Args("B")), "no handler -> false");
            Assert.IsTrue(reg.Unregister("A", h));
            Assert.IsFalse(reg.Raise(Args("A")));
            Assert.AreEqual(1, calls);
        }

        [Test]
        public void RegisterValidatesArguments()
        {
            var reg = new DialogueEventRegistry();
            Assert.Throws<ArgumentException>(() => reg.Register("", _ => { }));
            Assert.Throws<ArgumentNullException>(() => reg.Register("A", null));
        }

        [Test]
        public void HandlersMayRegisterWhileRunning()
        {
            var reg = new DialogueEventRegistry();
            int late = 0;
            reg.Register("A", _ => reg.Register("A", __ => late++));
            reg.Raise(Args("A"));
            Assert.AreEqual(0, late, "handlers added during a raise run next time");
            reg.Raise(Args("A"));
            Assert.AreEqual(1, late);
        }

        // ---- attribute based, typed parameter binding ----

        private sealed class Game
        {
            public readonly List<string> Log = new List<string>();

            [DialogueEventHandler("GiveItem")]
            public void GiveItem(string itemId, int amount) { Log.Add($"give {itemId} x{amount}"); }

            [DialogueEventHandler("OpenShop")]
            private void OpenShop(string shopId, bool firstVisit = false) { Log.Add($"shop {shopId} first={firstVisit}"); }

            [DialogueEventHandler("Raw")]
            public void Raw(DialogueEventArgs args) { Log.Add("raw " + args.Name); }

            [DialogueEventHandler("A")]
            [DialogueEventHandler("B")]
            public void Both(DialogueEventArgs args) { Log.Add("both " + args.Name); }

            [DialogueEventHandler("Throws")]
            public void Throws(string x) { throw new InvalidOperationException("inner failure"); }
        }

        [Test]
        public void AttributedHandlersBindParametersByName()
        {
            var game = new Game();
            var reg = new DialogueEventRegistry();
            Assert.AreEqual(6, reg.RegisterAttributed(game));
            reg.Raise(Args("GiveItem", Param("amount", 2), Param("itemId", "herb")));
            reg.Raise(Args("OpenShop", Param("shopId", "main")));
            reg.Raise(Args("OpenShop", Param("shopId", "main"), Param("firstVisit", true)));
            reg.Raise(Args("Raw"));
            reg.Raise(Args("A"));
            reg.Raise(Args("B"));
            CollectionAssert.AreEqual(new[] { "give herb x2", "shop main first=False", "shop main first=True", "raw Raw", "both A", "both B" }, game.Log);
        }

        [Test]
        public void MissingOrWrongTypedParametersAreReportedNotThrown()
        {
            var game = new Game();
            var reg = new DialogueEventRegistry();
            reg.RegisterAttributed(game);
            var failures = new List<string>();
            reg.HandlerFailed += (name, e) => failures.Add(name + ": " + e.Message);

            Assert.DoesNotThrow(() => reg.Raise(Args("GiveItem", Param("itemId", "herb")))); // amount missing
            Assert.DoesNotThrow(() => reg.Raise(Args("GiveItem", Param("itemId", "herb"), Param("amount", "three")))); // wrong type
            Assert.DoesNotThrow(() => reg.Raise(Args("Throws", Param("x", "y"))));

            Assert.AreEqual(3, failures.Count);
            StringAssert.Contains("amount", failures[0]);
            StringAssert.Contains("missing", failures[0]);
            StringAssert.Contains("different type", failures[1]);
            StringAssert.Contains("inner failure", failures[2], "the handler's own exception is unwrapped");
            Assert.IsEmpty(game.Log, "a handler is not called with bad parameters");
        }

        private sealed class BadSignature
        {
            [DialogueEventHandler("X")] public void M(float f) { }
        }

        [Test]
        public void UnsupportedHandlerSignaturesFailAtRegistration()
        {
            Assert.Throws<InvalidOperationException>(() => new DialogueEventRegistry().RegisterAttributed(new BadSignature()));
        }
    }

    public class PortraitCatalogTests
    {
        private static PortraitCatalog<string> Make()
        {
            var c = new PortraitCatalog<string> { FallbackSprite = "FALLBACK" };
            c.SetCharacter("mira", "mira_default", new Dictionary<string, string> { { "neutral", "mira_neutral" }, { "happy", "mira_happy" }, { "empty", null } });
            c.SetCharacter("lumi", "lumi_default", new Dictionary<string, string> { { "smile", "lumi_smile" } });
            c.SetCharacter("pip", null, new Dictionary<string, string> { { "happy", "pip_happy" } });
            return c;
        }

        [Test]
        public void ExactExpressionWins()
        {
            Assert.AreEqual(PortraitMatch.Exact, Make().Resolve("mira", "happy", out var s));
            Assert.AreEqual("mira_happy", s);
        }

        [Test]
        public void IdsAndExpressionsAreCaseInsensitive()
        {
            Assert.AreEqual(PortraitMatch.Exact, Make().Resolve("MIRA", "Happy", out var s));
            Assert.AreEqual("mira_happy", s);
        }

        [Test]
        public void MissingExpressionUsesTheDefaultExpression()
        {
            Assert.AreEqual(PortraitMatch.DefaultExpression, Make().Resolve("mira", "furious", out var s));
            Assert.AreEqual("mira_neutral", s);
            Assert.AreEqual(PortraitMatch.DefaultExpression, Make().Resolve("mira", "", out s), "empty expression");
            Assert.AreEqual(PortraitMatch.DefaultExpression, Make().Resolve("mira", "empty", out s), "an expression with a null sprite counts as missing");
        }

        [Test]
        public void NoDefaultExpressionUsesTheCharacterDefault()
        {
            Assert.AreEqual(PortraitMatch.CharacterDefault, Make().Resolve("lumi", "angry", out var s));
            Assert.AreEqual("lumi_default", s);
        }

        [Test]
        public void UnknownCharacterUsesTheFallbackSprite()
        {
            Assert.AreEqual(PortraitMatch.Fallback, Make().Resolve("ghost", "happy", out var s));
            Assert.AreEqual("FALLBACK", s);
            Assert.AreEqual(PortraitMatch.Fallback, Make().Resolve("", "", out s));
            Assert.AreEqual(PortraitMatch.Fallback, Make().Resolve(null, null, out s));
        }

        [Test]
        public void CharacterWithNothingUsableFallsBackThenNone()
        {
            var c = Make();
            Assert.AreEqual(PortraitMatch.Fallback, c.Resolve("pip", "sad", out var s), "pip has no neutral and no default");
            Assert.AreEqual("FALLBACK", s);
            c.FallbackSprite = null;
            Assert.AreEqual(PortraitMatch.None, c.Resolve("pip", "sad", out s));
            Assert.IsNull(s);
            Assert.AreEqual(PortraitMatch.None, c.Resolve("ghost", "x", out s));
        }

        [Test]
        public void CustomDefaultExpression()
        {
            var c = Make();
            c.DefaultExpression = "happy";
            Assert.AreEqual(PortraitMatch.DefaultExpression, c.Resolve("mira", "furious", out var s));
            Assert.AreEqual("mira_happy", s);
        }
    }

    public class VariableStoreTests
    {
        [Test]
        public void InMemoryStoreStoresRaisesChangesAndSnapshots()
        {
            var store = new InMemoryVariableStore();
            var changes = new List<string>();
            store.Changed += (n, old, v) => changes.Add($"{n}:{(old.HasValue ? old.Value.ToString() : "-")}->{v}");
            Assert.IsFalse(store.TryGet("gold", out _));
            store.Set("gold", DialogueValue.FromInt(1));
            store.Set("gold", DialogueValue.FromInt(2));
            Assert.IsTrue(store.TryGet("gold", out var v));
            Assert.AreEqual(2, v.IntValue);
            CollectionAssert.AreEqual(new[] { "gold:-->1", "gold:1->2" }, changes);

            var snap = store.Snapshot();
            store.Clear();
            Assert.AreEqual(0, store.Count);
            store.Restore(snap);
            Assert.IsTrue(store.TryGet("gold", out v));
            Assert.AreEqual(2, v.IntValue);
            Assert.IsTrue(store.Remove("gold"));
        }

        [Test]
        public void DelegateStoreRequiresBothDelegates()
        {
            Assert.Throws<ArgumentNullException>(() => new DelegateVariableStore(null, (n, v) => { }));
            Assert.Throws<ArgumentNullException>(() => new DelegateVariableStore((string n, out DialogueValue v) => { v = default; return false; }, null));
        }

        [Test]
        public void ValuesCompareByTypeAndContent()
        {
            Assert.AreEqual(DialogueValue.FromInt(1), DialogueValue.FromInt(1));
            Assert.AreNotEqual(DialogueValue.FromInt(1), DialogueValue.FromBool(true));
            Assert.AreNotEqual(DialogueValue.FromString("1"), DialogueValue.FromInt(1));
            Assert.AreEqual("true", DialogueValue.FromBool(true).ToString());
            Assert.AreEqual("", DialogueValue.FromString(null).StringValue);
            Assert.Throws<DialogueException>(() => DialogueValue.FromTyped("float", 0, false, ""));
            var typed = DialogueValue.FromString("x").ToTyped();
            Assert.AreEqual("string", typed.valueType);
            Assert.AreEqual("x", typed.stringValue);
        }
    }

    public class ConditionAndOperationTests
    {
        [Test]
        public void ConditionRejectsMismatchedTypesAndBadOperators()
        {
            Assert.Throws<DialogueException>(() => ConditionEvaluator.Evaluate(DialogueValue.FromInt(1), "==", DialogueValue.FromString("1")));
            Assert.Throws<DialogueException>(() => ConditionEvaluator.Evaluate(DialogueValue.FromBool(true), ">", DialogueValue.FromBool(false)));
            Assert.Throws<DialogueException>(() => ConditionEvaluator.Evaluate(DialogueValue.FromString("a"), "<", DialogueValue.FromString("b")));
            Assert.Throws<DialogueException>(() => ConditionEvaluator.Evaluate(DialogueValue.FromInt(1), "=~", DialogueValue.FromInt(1)));
            Assert.IsTrue(ConditionEvaluator.Evaluate(DialogueValue.FromString("a"), "!=", DialogueValue.FromString("b")));
        }

        [Test]
        public void OperationsRespectTypes()
        {
            Assert.AreEqual(DialogueValue.FromInt(7), VariableOperations.Apply(DialogueValue.FromInt(5), "add", DialogueValue.FromInt(2)));
            Assert.AreEqual(DialogueValue.FromInt(3), VariableOperations.Apply(DialogueValue.FromInt(5), "subtract", DialogueValue.FromInt(2)));
            Assert.AreEqual(DialogueValue.FromString("b"), VariableOperations.Apply(DialogueValue.FromString("a"), "set", DialogueValue.FromString("b")));
            Assert.Throws<DialogueException>(() => VariableOperations.Apply(DialogueValue.FromString("a"), "add", DialogueValue.FromString("b")));
            Assert.Throws<DialogueException>(() => VariableOperations.Apply(DialogueValue.FromInt(1), "set", DialogueValue.FromBool(true)));
            Assert.Throws<DialogueException>(() => VariableOperations.Apply(DialogueValue.FromInt(1), "divide", DialogueValue.FromInt(1)));
        }

        [Test]
        public void IntegerOverflowWrapsInsteadOfThrowing()
        {
            Assert.AreEqual(int.MinValue, VariableOperations.Apply(DialogueValue.FromInt(int.MaxValue), "add", DialogueValue.FromInt(1)).IntValue);
        }
    }

    public class DialogueValidatorTests
    {
        private static DialogueData Valid()
        {
            return new DialogueBuilder().Start("a").Var("n", "global", Int(0)).Line("a", "x", "c")
                .Cond("c", "n", ">", Int(0), "e", "e").Event("e", "Ev", "end", Param("k", "v")).End("end").Data();
        }

        private static List<string> Codes(DialogueData d)
        {
            var codes = new List<string>();
            foreach (var i in DialogueValidator.Validate(d)) codes.Add(i.Code);
            return codes;
        }

        [Test] public void ValidDataHasNoIssues() { Assert.IsEmpty(DialogueValidator.Validate(Valid())); }
        [Test] public void NullData() { CollectionAssert.Contains(Codes(null), "NULL_DATA"); }

        [Test]
        public void SchemaVersionMustMatch()
        {
            var d = Valid(); d.schemaVersion = 2;
            CollectionAssert.Contains(Codes(d), "UNSUPPORTED_SCHEMA");
        }

        [Test]
        public void StartAndLinksMustResolve()
        {
            var d = Valid(); d.startNodeId = "ghost";
            CollectionAssert.Contains(Codes(d), "START_MISSING");
            d = Valid(); d.nodes[0].next = "ghost";
            CollectionAssert.Contains(Codes(d), "LINK_BROKEN");
            d = Valid(); d.nodes[0].next = "";
            CollectionAssert.Contains(Codes(d), "LINK_EMPTY");
        }

        [Test]
        public void VariablesAndTypesAreChecked()
        {
            var d = Valid(); d.nodes[1].variable = "ghost";
            CollectionAssert.Contains(Codes(d), "VARIABLE_UNDEFINED");
            d = Valid(); d.nodes[1].compare = Bool(true);
            CollectionAssert.Contains(Codes(d), "CONDITION_TYPE");
            d = Valid(); d.nodes[1].@operator = "=~";
            CollectionAssert.Contains(Codes(d), "OPERATOR_INVALID");
            d = Valid(); d.variables[0].scope = "universe";
            CollectionAssert.Contains(Codes(d), "VARIABLE_SCOPE");
            d = Valid(); d.nodes[2].eventName = "";
            CollectionAssert.Contains(Codes(d), "EVENT_NO_NAME");
        }

        [Test]
        public void DuplicatesAndUnknownTypesAreFlagged()
        {
            var d = Valid(); d.nodes[1].id = "a";
            CollectionAssert.Contains(Codes(d), "DUPLICATE_NODE");
            d = Valid(); d.nodes[3].type = "teleport";
            CollectionAssert.Contains(Codes(d), "NODE_TYPE");
        }

        [Test]
        public void GraphRejectsDuplicateIdsWhenIndexing()
        {
            var d = Valid(); d.nodes[1].id = "a";
            Assert.Throws<DialogueException>(() => new DialogueGraph(d));
        }
    }
}
