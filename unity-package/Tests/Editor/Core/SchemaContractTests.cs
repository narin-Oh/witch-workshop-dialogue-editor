using System;
using System.Linq;
using System.Reflection;
using NUnit.Framework;

namespace WitchWorkshop.Dialogue.Tests
{
    /// <summary>
    /// Locks the C# DTOs to the exact field sets the web editor exports (Golden/schema.golden.json is generated from the
    /// editor's real export code). If the editor's export format changes, these tests fail until the DTOs are updated.
    /// </summary>
    public class SchemaContractTests
    {
        private static SchemaGolden Schema { get { return TestSupport.FromJson<SchemaGolden>(TestSupport.ReadGolden("schema.golden.json")); } }

        private static string[] Fields(Type t)
        {
            return t.GetFields(BindingFlags.Public | BindingFlags.Instance).Select(f => f.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray();
        }

        private static string[] Sorted(string[] names) { return names.OrderBy(n => n, StringComparer.Ordinal).ToArray(); }

        [Test] public void SchemaVersionIsSupported() { Assert.AreEqual(DialogueSchema.SupportedVersion, Schema.schemaVersion); }
        [Test] public void RootFields() { CollectionAssert.AreEqual(Sorted(Schema.rootFields), Fields(typeof(DialogueData))); }
        [Test] public void NodeFields() { CollectionAssert.AreEqual(Sorted(Schema.nodeFields), Fields(typeof(DialogueNodeData))); }
        [Test] public void TypedValueFields() { CollectionAssert.AreEqual(Sorted(Schema.typedValueFields), Fields(typeof(DialogueTypedValue))); }
        [Test] public void VariableFields() { CollectionAssert.AreEqual(Sorted(Schema.variableFields), Fields(typeof(DialogueVariableDef))); }
        [Test] public void ChoiceFields() { CollectionAssert.AreEqual(Sorted(Schema.choiceFields), Fields(typeof(DialogueChoiceData))); }
        [Test] public void EventParamFields() { CollectionAssert.AreEqual(Sorted(Schema.eventParamFields), Fields(typeof(DialogueEventParam))); }

        [Test]
        public void OperatorFieldIsNamedOperator()
        {
            // "operator" is a C# keyword; the DTO uses @operator, whose reflection name must still be "operator".
            Assert.IsNotNull(typeof(DialogueNodeData).GetField("operator"));
        }

        [Test]
        public void EveryExportedNodeTypeIsHandled()
        {
            var handled = new[] { DialogueSchema.NodeDialogue, DialogueSchema.NodeChoice, DialogueSchema.NodeCondition, DialogueSchema.NodeVariable, DialogueSchema.NodeEvent, DialogueSchema.NodeEnd };
            foreach (var t in Schema.nodeTypes) CollectionAssert.Contains(handled, t);
        }

        [Test]
        public void SamplesExportDisplayModes()
        {
            var data = TestSupport.LoadDialogue("apprentice-quest.dialogue.json");
            var modes = data.nodes.Where(n => n.type == "dialogue").Select(n => n.displayMode).Distinct().OrderBy(m => m, StringComparer.Ordinal).ToArray();
            CollectionAssert.AreEqual(new[] { "character", "narration", "sceneTransition" }, modes);
            Assert.IsTrue(data.nodes.Where(n => n.type != "dialogue").All(n => n.displayMode == ""), "other node types export an empty displayMode");
        }

        [Test]
        public void SampleJsonDeserializesWithoutLoss()
        {
            var data = TestSupport.LoadDialogue("potion-customer.dialogue.json");
            Assert.AreEqual(1, data.schemaVersion);
            Assert.AreEqual("potion-customer", data.id);
            Assert.IsNotEmpty(data.nodes);
            var cond = data.nodes.First(n => n.type == "condition" && n.variable == "reputation");
            Assert.AreEqual(">=", cond.@operator);
            Assert.AreEqual("int", cond.compare.valueType);
            var ev = data.nodes.First(n => n.type == "event" && n.eventName == "OpenShop");
            Assert.AreEqual("shopId", ev.eventParams[0].key);
            Assert.AreEqual("back_room", ev.eventParams[0].stringValue);
            Assert.AreEqual("local", data.variables.First(v => v.name == "haggle").scope);
        }
    }
}
