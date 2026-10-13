using System;
using System.Collections.Generic;

namespace WitchWorkshop.Dialogue
{
    /// <summary>An indexed, read-only view over <see cref="DialogueData"/> for fast node and variable lookup.</summary>
    public sealed class DialogueGraph
    {
        private readonly Dictionary<string, DialogueNodeData> nodes = new Dictionary<string, DialogueNodeData>(StringComparer.Ordinal);
        private readonly Dictionary<string, DialogueVariableDef> variables = new Dictionary<string, DialogueVariableDef>(StringComparer.Ordinal);

        public DialogueData Data { get; }
        public string Id { get { return Data.id; } }
        public string Name { get { return Data.name; } }
        public string StartNodeId { get { return Data.startNodeId; } }
        public IReadOnlyCollection<DialogueVariableDef> Variables { get { return variables.Values; } }
        public int NodeCount { get { return nodes.Count; } }

        /// <summary>Indexes the data. Null arrays/entries are tolerated; duplicate ids or names throw (see <see cref="DialogueValidator"/> for a full check).</summary>
        public DialogueGraph(DialogueData data)
        {
            Data = data ?? throw new ArgumentNullException(nameof(data));
            if (data.nodes != null)
            {
                foreach (var n in data.nodes)
                {
                    if (n == null || string.IsNullOrEmpty(n.id)) continue;
                    if (nodes.ContainsKey(n.id)) throw new DialogueException(DialogueErrorCode.InvalidData, $"Duplicate node id \"{n.id}\".");
                    nodes[n.id] = n;
                }
            }
            if (data.variables != null)
            {
                foreach (var v in data.variables)
                {
                    if (v == null || string.IsNullOrEmpty(v.name)) continue;
                    if (variables.ContainsKey(v.name)) throw new DialogueException(DialogueErrorCode.InvalidData, $"Duplicate variable \"{v.name}\".");
                    variables[v.name] = v;
                }
            }
        }

        public bool TryGetNode(string id, out DialogueNodeData node)
        {
            if (id == null) { node = null; return false; }
            return nodes.TryGetValue(id, out node);
        }

        public bool TryGetVariable(string name, out DialogueVariableDef def)
        {
            if (name == null) { def = null; return false; }
            return variables.TryGetValue(name, out def);
        }
    }
}
