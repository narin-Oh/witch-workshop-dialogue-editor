using System;
using System.Collections.Generic;

namespace WitchWorkshop.Dialogue
{
    public sealed class DialogueIssue
    {
        public string Code { get; }
        public string Message { get; }
        public string NodeId { get; }

        public DialogueIssue(string code, string message, string nodeId)
        {
            Code = code;
            Message = message;
            NodeId = nodeId ?? "";
        }

        public override string ToString() { return NodeId.Length > 0 ? $"{Message} (node {NodeId})" : Message; }
    }

    /// <summary>
    /// Structural validation of dialogue data (schema version, links, variable references, types).
    /// Files exported by the web editor are already validated there; this guards against hand-edited or corrupt files.
    /// </summary>
    public static class DialogueValidator
    {
        public static List<DialogueIssue> Validate(DialogueData data)
        {
            var issues = new List<DialogueIssue>();
            void Add(string code, string message, string node = "") { issues.Add(new DialogueIssue(code, message, node)); }

            if (data == null) { Add("NULL_DATA", "Dialogue data is null."); return issues; }
            if (data.schemaVersion != DialogueSchema.SupportedVersion)
                Add("UNSUPPORTED_SCHEMA", $"Unsupported schemaVersion {data.schemaVersion} (this package reads version {DialogueSchema.SupportedVersion}).");

            var nodes = new Dictionary<string, DialogueNodeData>(StringComparer.Ordinal);
            foreach (var n in data.nodes ?? new DialogueNodeData[0])
            {
                if (n == null || string.IsNullOrEmpty(n.id)) { Add("NODE_NO_ID", "A node has no id."); continue; }
                if (nodes.ContainsKey(n.id)) Add("DUPLICATE_NODE", $"Duplicate node id \"{n.id}\".", n.id);
                else nodes[n.id] = n;
            }
            if (nodes.Count == 0) Add("NO_NODES", "The dialogue has no nodes.");

            var vars = new Dictionary<string, DialogueVariableDef>(StringComparer.Ordinal);
            foreach (var v in data.variables ?? new DialogueVariableDef[0])
            {
                if (v == null || string.IsNullOrEmpty(v.name)) { Add("VARIABLE_NO_NAME", "A variable has no name."); continue; }
                if (vars.ContainsKey(v.name)) { Add("DUPLICATE_VARIABLE", $"Duplicate variable \"{v.name}\"."); continue; }
                vars[v.name] = v;
                if (v.scope != DialogueSchema.ScopeGlobal && v.scope != DialogueSchema.ScopeLocal)
                    Add("VARIABLE_SCOPE", $"Variable \"{v.name}\" has unknown scope \"{v.scope}\".");
                if (!DialogueValue.TryParseType(v.valueType, out var vt)) Add("VARIABLE_TYPE", $"Variable \"{v.name}\" has unknown type \"{v.valueType}\".");
                else if (v.initial == null || v.initial.valueType != v.valueType) Add("VARIABLE_INITIAL", $"Variable \"{v.name}\" has an initial value that does not match its type.");
            }

            if (string.IsNullOrEmpty(data.startNodeId) || !nodes.ContainsKey(data.startNodeId))
                Add("START_MISSING", $"startNodeId \"{data.startNodeId}\" does not match any node.");

            void CheckLink(DialogueNodeData n, string link, string what)
            {
                if (string.IsNullOrEmpty(link)) Add("LINK_EMPTY", $"{what} is not connected.", n.id);
                else if (!nodes.ContainsKey(link)) Add("LINK_BROKEN", $"{what} points to unknown node \"{link}\".", n.id);
            }

            DialogueVariableDef Var(DialogueNodeData n)
            {
                if (!vars.TryGetValue(n.variable ?? "", out var def)) { Add("VARIABLE_UNDEFINED", $"Uses undefined variable \"{n.variable}\".", n.id); return null; }
                return def;
            }

            foreach (var n in nodes.Values)
            {
                switch (n.type)
                {
                    case DialogueSchema.NodeDialogue:
                        CheckLink(n, n.next, "Dialogue \"next\"");
                        break;
                    case DialogueSchema.NodeChoice:
                        if (n.choices == null || n.choices.Length == 0) Add("CHOICE_NONE", "Choice node has no choices.", n.id);
                        else for (int i = 0; i < n.choices.Length; i++) CheckLink(n, n.choices[i]?.next, $"Choice {i + 1}");
                        break;
                    case DialogueSchema.NodeCondition:
                    {
                        CheckLink(n, n.nextTrue, "Condition True branch");
                        CheckLink(n, n.nextFalse, "Condition False branch");
                        var def = Var(n);
                        if (def == null) break;
                        if (!ConditionEvaluator.IsOperatorValid(n.@operator)) { Add("OPERATOR_INVALID", $"Unknown operator \"{n.@operator}\".", n.id); break; }
                        if (DialogueValue.TryParseType(def.valueType, out var vt))
                        {
                            if (n.compare == null || n.compare.valueType != def.valueType) Add("CONDITION_TYPE", $"Compared value does not match the type of \"{def.name}\".", n.id);
                            else if (!ConditionEvaluator.IsOperatorAllowedFor(vt, n.@operator)) Add("OPERATOR_TYPE", $"Operator \"{n.@operator}\" cannot be used with {def.valueType}.", n.id);
                        }
                        break;
                    }
                    case DialogueSchema.NodeVariable:
                    {
                        CheckLink(n, n.next, "Variable \"next\"");
                        var def = Var(n);
                        if (def == null) break;
                        if (!VariableOperations.IsOperationValid(n.operation)) { Add("OPERATION_INVALID", $"Unknown operation \"{n.operation}\".", n.id); break; }
                        if (n.operand == null || n.operand.valueType != def.valueType) Add("OPERAND_TYPE", $"Operand does not match the type of \"{def.name}\".", n.id);
                        else if (n.operation != DialogueSchema.OpSet && def.valueType != DialogueSchema.TypeInt) Add("OPERATION_TYPE", $"\"{n.operation}\" requires an int variable.", n.id);
                        break;
                    }
                    case DialogueSchema.NodeEvent:
                    {
                        CheckLink(n, n.next, "Event \"next\"");
                        if (string.IsNullOrEmpty(n.eventName)) Add("EVENT_NO_NAME", "Event node has no name.", n.id);
                        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        foreach (var p in n.eventParams ?? new DialogueEventParam[0])
                        {
                            if (p == null || string.IsNullOrEmpty(p.key)) { Add("PARAM_NO_KEY", "Event parameter without a key.", n.id); continue; }
                            if (!keys.Add(p.key)) Add("PARAM_DUPLICATE", $"Duplicate event parameter \"{p.key}\".", n.id);
                            if (!DialogueValue.TryParseType(p.valueType, out _)) Add("PARAM_TYPE", $"Parameter \"{p.key}\" has unknown type \"{p.valueType}\".", n.id);
                        }
                        break;
                    }
                    case DialogueSchema.NodeEnd:
                        break;
                    default:
                        Add("NODE_TYPE", $"Unknown node type \"{n.type}\".", n.id);
                        break;
                }
            }
            return issues;
        }
    }
}
