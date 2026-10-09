using System;
using System.Collections.Generic;

namespace WitchWorkshop.Dialogue
{
    public enum DialogueSessionState
    {
        NotStarted,
        /// <summary>Executing non-interactive nodes (conditions, variables, events). Only observable from inside callbacks.</summary>
        Running,
        /// <summary>A dialogue line is showing; call <see cref="DialogueSession.Advance"/>.</summary>
        WaitingForAdvance,
        /// <summary>Choices are showing; call <see cref="DialogueSession.Choose"/>.</summary>
        WaitingForChoice,
        Finished,
        Error,
    }

    /// <summary>A line to display. Contains no UI types: presentation is entirely up to the view.</summary>
    public sealed class DialogueLine
    {
        public string NodeId { get; }
        public string Speaker { get; }
        /// <summary>The name to show (the editor's "speaker name override" if set, otherwise the speaker).</summary>
        public string DisplayName { get; }
        public string Text { get; }
        public string PortraitId { get; }
        public string Expression { get; }

        public DialogueLine(DialogueNodeData n)
        {
            NodeId = n.id;
            Speaker = n.speaker ?? "";
            DisplayName = string.IsNullOrEmpty(n.displayName) ? Speaker : n.displayName;
            Text = n.text ?? "";
            PortraitId = n.portraitId ?? "";
            Expression = n.expression ?? "";
        }
    }

    public sealed class DialogueChoice
    {
        public int Index { get; }
        public string Id { get; }
        public string Text { get; }

        public DialogueChoice(int index, string id, string text)
        {
            Index = index;
            Id = id;
            Text = text ?? "";
        }
    }

    /// <summary>
    /// Executes one conversation: a state machine over <see cref="DialogueGraph"/>. It has no dependency on Unity or any UI.
    /// Semantics mirror the web editor's preview runner (condition / variable / event handling, loop guards).
    /// Start / Advance / Choose never throw for bad data: they move the session to <see cref="DialogueSessionState.Error"/>
    /// and raise <see cref="ErrorOccurred"/>.
    /// </summary>
    public sealed class DialogueSession : IDialogueController
    {
        /// <summary>Consecutive non-interactive nodes allowed before the session assumes an infinite loop.</summary>
        public const int MaxAutoSteps = 200;
        /// <summary>Total nodes allowed in one session.</summary>
        public const int MaxTotalSteps = 5000;

        private readonly DialogueGraph graph;
        private readonly IVariableStore globals;
        private readonly DialogueEventRegistry events;
        private readonly Dictionary<string, DialogueValue> locals = new Dictionary<string, DialogueValue>(StringComparer.Ordinal);
        private DialogueNodeData currentNode;
        private DialogueChoice[] choices = new DialogueChoice[0];

        public DialogueGraph Graph { get { return graph; } }
        public DialogueSessionState State { get; private set; } = DialogueSessionState.NotStarted;
        public DialogueLine CurrentLine { get; private set; }
        public IReadOnlyList<DialogueChoice> CurrentChoices { get { return choices; } }
        /// <summary>Ending name when the session finished at an end node (may be empty). Null if aborted or not finished.</summary>
        public string EndingName { get; private set; }
        public bool WasAborted { get; private set; }
        public DialogueError Error { get; private set; }
        public int Steps { get; private set; }

        public bool IsRunning { get { return State == DialogueSessionState.Running || State == DialogueSessionState.WaitingForAdvance || State == DialogueSessionState.WaitingForChoice; } }
        public bool IsFinished { get { return State == DialogueSessionState.Finished || State == DialogueSessionState.Error; } }

        public event Action<DialogueLine> LineShown;
        public event Action<IReadOnlyList<DialogueChoice>> ChoicesShown;
        public event Action<DialogueChoice> ChoiceChosen;
        /// <summary>Raised when the conversation ends normally or is stopped (see <see cref="WasAborted"/>).</summary>
        public event Action<string> Ended;
        public event Action<DialogueError> ErrorOccurred;
        /// <summary>(variable name, old value, new value, isGlobal)</summary>
        public event Action<string, DialogueValue, DialogueValue, bool> VariableChanged;
        /// <summary>Raised before handlers run, for every event node (even if nothing handles it).</summary>
        public event Action<DialogueEventArgs> EventRaised;
        /// <summary>Non-fatal problems (e.g. an event with no registered handler, a handler that threw).</summary>
        public event Action<string> Warning;

        /// <param name="graph">The dialogue to run.</param>
        /// <param name="globals">Store for global variables (your save system). May be null: globals then behave like locals for this session only.</param>
        /// <param name="events">Registered event handlers. May be null: events are then reported as unhandled.</param>
        public DialogueSession(DialogueGraph graph, IVariableStore globals = null, DialogueEventRegistry events = null)
        {
            this.graph = graph ?? throw new ArgumentNullException(nameof(graph));
            this.globals = globals;
            this.events = events;
        }

        // ---------------------------------------------------------------- control

        /// <summary>Begins (or restarts) the conversation. Local variables are reset to their initial values; global variables are NOT touched.</summary>
        public void Start()
        {
            locals.Clear();
            foreach (var v in graph.Variables)
            {
                if (v.scope != DialogueSchema.ScopeGlobal || globals == null)
                {
                    try { locals[v.name] = DialogueValue.FromTyped(v.initial); }
                    catch (DialogueException) { /* reported when the variable is first used */ }
                }
            }
            CurrentLine = null;
            choices = new DialogueChoice[0];
            currentNode = null;
            EndingName = null;
            WasAborted = false;
            Error = null;
            Steps = 0;
            State = DialogueSessionState.Running;
            Run(graph.StartNodeId);
        }

        /// <summary>Continues after a dialogue line. Returns false (and does nothing) if no line is waiting.</summary>
        public bool Advance()
        {
            if (State != DialogueSessionState.WaitingForAdvance || currentNode == null) return false;
            string next = currentNode.next;
            State = DialogueSessionState.Running;
            if (string.IsNullOrEmpty(next)) { Fail(DialogueErrorCode.MissingLink, "Dialogue line is not connected to a next node.", currentNode.id); return true; }
            Run(next);
            return true;
        }

        /// <summary>Picks a choice by index. Returns false (and does nothing) if no choices are waiting or the index is out of range.</summary>
        public bool Choose(int index)
        {
            if (State != DialogueSessionState.WaitingForChoice || currentNode == null || index < 0 || index >= choices.Length) return false;
            var picked = choices[index];
            string next = currentNode.choices[index].next;
            string nodeId = currentNode.id;
            State = DialogueSessionState.Running;
            ChoiceChosen?.Invoke(picked);
            if (State != DialogueSessionState.Running) return true; // a listener stopped the session
            if (string.IsNullOrEmpty(next)) { Fail(DialogueErrorCode.MissingLink, $"Choice \"{picked.Text}\" is not connected to a node.", nodeId); return true; }
            Run(next);
            return true;
        }

        /// <summary>Ends the conversation immediately (for example if the player walks away). Raises <see cref="Ended"/> with a null ending.</summary>
        public void Stop()
        {
            if (!IsRunning) return;
            State = DialogueSessionState.Finished;
            WasAborted = true;
            EndingName = null;
            CurrentLine = null;
            choices = new DialogueChoice[0];
            Ended?.Invoke(null);
        }

        // ---------------------------------------------------------------- variables

        /// <summary>Current value of a variable used by this dialogue (local value, or the store's value for globals with the exported default as fallback).</summary>
        public bool TryGetVariable(string name, out DialogueValue value)
        {
            try { value = ReadVariable(name); return true; }
            catch (DialogueException) { value = default; return false; }
        }

        private DialogueValue ReadVariable(string name)
        {
            if (!graph.TryGetVariable(name, out var def))
                throw new DialogueException(DialogueErrorCode.UndefinedVariable, $"Variable \"{name}\" is not defined in this dialogue.");
            if (locals.TryGetValue(name, out var local)) return local;
            if (def.scope == DialogueSchema.ScopeLocal || globals == null) return DialogueValue.FromTyped(def.initial); // throws if the initial value is invalid
            if (globals.TryGet(name, out var stored))
            {
                if (DialogueValue.TryParseType(def.valueType, out var expected) && stored.Type != expected)
                    throw new DialogueException(DialogueErrorCode.TypeMismatch, $"Stored value of \"{name}\" is {DialogueValue.TypeName(stored.Type)} but the dialogue expects {def.valueType}.");
                return stored;
            }
            return DialogueValue.FromTyped(def.initial); // global with no stored value yet: use the editor default
        }

        private void WriteVariable(string name, DialogueValue value)
        {
            var old = ReadVariable(name); // also validates that the variable exists
            graph.TryGetVariable(name, out var def);
            bool isGlobal = globals != null && def.scope == DialogueSchema.ScopeGlobal;
            if (isGlobal) globals.Set(name, value);
            else locals[name] = value;
            VariableChanged?.Invoke(name, old, value, isGlobal);
        }

        // ---------------------------------------------------------------- execution

        private void Run(string firstId)
        {
            string id = firstId;
            int auto = 0;
            try
            {
                while (true)
                {
                    if (!graph.TryGetNode(id, out var node))
                    {
                        Fail(DialogueErrorCode.UnknownNode, $"A link points to a node that does not exist (\"{id}\").", currentNode?.id);
                        return;
                    }
                    if (Steps >= MaxTotalSteps) { Fail(DialogueErrorCode.LoopDetected, $"Stopped after {MaxTotalSteps} steps: possible infinite loop.", id); return; }
                    if (auto >= MaxAutoSteps) { Fail(DialogueErrorCode.LoopDetected, $"Stopped after {MaxAutoSteps} automatic steps without player input: infinite loop.", id); return; }
                    Steps++;
                    currentNode = node;

                    switch (node.type)
                    {
                        case DialogueSchema.NodeDialogue:
                        {
                            CurrentLine = new DialogueLine(node);
                            choices = new DialogueChoice[0];
                            State = DialogueSessionState.WaitingForAdvance;
                            LineShown?.Invoke(CurrentLine);
                            return;
                        }
                        case DialogueSchema.NodeChoice:
                        {
                            if (node.choices == null || node.choices.Length == 0) { Fail(DialogueErrorCode.NoChoices, "Choice node has no choices.", node.id); return; }
                            var list = new DialogueChoice[node.choices.Length];
                            for (int i = 0; i < list.Length; i++) list[i] = new DialogueChoice(i, node.choices[i]?.id ?? "", node.choices[i]?.text ?? "");
                            choices = list;
                            CurrentLine = null;
                            State = DialogueSessionState.WaitingForChoice;
                            ChoicesShown?.Invoke(choices);
                            return;
                        }
                        case DialogueSchema.NodeCondition:
                        {
                            var left = ReadVariable(node.variable);
                            bool result = ConditionEvaluator.Evaluate(left, node.@operator, DialogueValue.FromTyped(node.compare));
                            id = result ? node.nextTrue : node.nextFalse;
                            if (string.IsNullOrEmpty(id)) { Fail(DialogueErrorCode.MissingLink, $"The {(result ? "True" : "False")} branch of a condition is not connected.", node.id); return; }
                            auto++;
                            break;
                        }
                        case DialogueSchema.NodeVariable:
                        {
                            var current = ReadVariable(node.variable);
                            var updated = VariableOperations.Apply(current, node.operation, DialogueValue.FromTyped(node.operand));
                            WriteVariable(node.variable, updated);
                            id = node.next;
                            if (string.IsNullOrEmpty(id)) { Fail(DialogueErrorCode.MissingLink, "Variable node is not connected to a next node.", node.id); return; }
                            auto++;
                            break;
                        }
                        case DialogueSchema.NodeEvent:
                        {
                            var args = new DialogueEventArgs(node.eventName, node.eventParams);
                            EventRaised?.Invoke(args);
                            DispatchEvent(args);
                            if (State != DialogueSessionState.Running) return; // a handler or listener stopped the session
                            id = node.next;
                            if (string.IsNullOrEmpty(id)) { Fail(DialogueErrorCode.MissingLink, "Event node is not connected to a next node.", node.id); return; }
                            auto++;
                            break;
                        }
                        case DialogueSchema.NodeEnd:
                        {
                            State = DialogueSessionState.Finished;
                            EndingName = node.endingName ?? "";
                            CurrentLine = null;
                            choices = new DialogueChoice[0];
                            Ended?.Invoke(EndingName);
                            return;
                        }
                        default:
                            Fail(DialogueErrorCode.UnknownNodeType, $"Unknown node type \"{node.type}\".", node.id);
                            return;
                    }
                    if (State != DialogueSessionState.Running) return; // VariableChanged/other listener stopped the session
                }
            }
            catch (DialogueException e)
            {
                Fail(e.Code, e.Message, currentNode?.id);
            }
        }

        private void DispatchEvent(DialogueEventArgs args)
        {
            if (events == null || !events.IsRegistered(args.Name))
            {
                Warning?.Invoke($"No handler registered for dialogue event \"{args.Name}\".");
                return;
            }
            // Handler failures are collected by the registry; surface them as warnings for this raise only.
            Action<string, Exception> relay = (name, e) => Warning?.Invoke($"Handler for event \"{name}\" failed: {e.Message}");
            events.HandlerFailed += relay;
            try { events.Raise(args); }
            finally { events.HandlerFailed -= relay; }
        }

        private void Fail(DialogueErrorCode code, string message, string nodeId)
        {
            State = DialogueSessionState.Error;
            Error = new DialogueError(code, message, nodeId);
            CurrentLine = null;
            choices = new DialogueChoice[0];
            ErrorOccurred?.Invoke(Error);
        }
    }

    /// <summary>
    /// The boundary between dialogue execution and presentation: a view calls these to move the conversation on.
    /// </summary>
    public interface IDialogueController
    {
        bool IsRunning { get; }
        bool Advance();
        bool Choose(int index);
    }
}
