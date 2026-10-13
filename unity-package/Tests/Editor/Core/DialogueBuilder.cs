using System.Collections.Generic;

namespace WitchWorkshop.Dialogue.Tests
{
    /// <summary>Tiny helper to build DialogueData by hand in tests.</summary>
    public sealed class DialogueBuilder
    {
        private readonly List<DialogueNodeData> nodes = new List<DialogueNodeData>();
        private readonly List<DialogueVariableDef> vars = new List<DialogueVariableDef>();
        private string start = "";

        public static DialogueTypedValue Int(int v) { return new DialogueTypedValue { valueType = "int", intValue = v }; }
        public static DialogueTypedValue Bool(bool v) { return new DialogueTypedValue { valueType = "bool", boolValue = v }; }
        public static DialogueTypedValue Str(string v) { return new DialogueTypedValue { valueType = "string", stringValue = v }; }

        public DialogueBuilder Start(string id) { start = id; return this; }

        public DialogueBuilder Var(string name, string scope, DialogueTypedValue initial)
        {
            vars.Add(new DialogueVariableDef { name = name, scope = scope, valueType = initial.valueType, initial = initial });
            return this;
        }

        public DialogueBuilder Line(string id, string text, string next, string speaker = "Mira", string portrait = "mira", string expression = "neutral", string displayName = "")
        {
            nodes.Add(new DialogueNodeData { id = id, type = "dialogue", speaker = speaker, displayName = displayName, text = text, portraitId = portrait, expression = expression, next = next });
            return this;
        }

        public DialogueBuilder Choice(string id, params (string text, string next)[] options)
        {
            var list = new List<DialogueChoiceData>();
            for (int i = 0; i < options.Length; i++) list.Add(new DialogueChoiceData { id = id + "_c" + i, text = options[i].text, next = options[i].next });
            nodes.Add(new DialogueNodeData { id = id, type = "choice", choices = list.ToArray() });
            return this;
        }

        public DialogueBuilder Cond(string id, string variable, string op, DialogueTypedValue compare, string whenTrue, string whenFalse)
        {
            nodes.Add(new DialogueNodeData { id = id, type = "condition", variable = variable, @operator = op, compare = compare, nextTrue = whenTrue, nextFalse = whenFalse });
            return this;
        }

        public DialogueBuilder Set(string id, string variable, string operation, DialogueTypedValue operand, string next)
        {
            nodes.Add(new DialogueNodeData { id = id, type = "variable", variable = variable, operation = operation, operand = operand, next = next });
            return this;
        }

        public DialogueBuilder Event(string id, string name, string next, params DialogueEventParam[] parameters)
        {
            nodes.Add(new DialogueNodeData { id = id, type = "event", eventName = name, eventParams = parameters, next = next });
            return this;
        }

        public DialogueBuilder End(string id, string ending = "")
        {
            nodes.Add(new DialogueNodeData { id = id, type = "end", endingName = ending });
            return this;
        }

        public DialogueBuilder Node(DialogueNodeData node) { nodes.Add(node); return this; }

        public DialogueData Data()
        {
            return new DialogueData { schemaVersion = 1, id = "test", name = "Test", startNodeId = start, variables = vars.ToArray(), nodes = nodes.ToArray() };
        }

        public DialogueGraph Graph() { return new DialogueGraph(Data()); }

        public static DialogueEventParam Param(string key, string value) { return new DialogueEventParam { key = key, valueType = "string", stringValue = value }; }
        public static DialogueEventParam Param(string key, int value) { return new DialogueEventParam { key = key, valueType = "int", intValue = value }; }
        public static DialogueEventParam Param(string key, bool value) { return new DialogueEventParam { key = key, valueType = "bool", boolValue = value }; }
    }
}
