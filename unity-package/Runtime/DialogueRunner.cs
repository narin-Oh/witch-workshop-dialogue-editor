using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// Loads and executes dialogue graphs. It has no UI: it exposes events (C# and UnityEvent) that a view listens to, and
    /// Advance / Choose that a view calls. Usually you use it through <see cref="DialogueManager"/>.
    /// </summary>
    [AddComponentMenu("Witch Workshop/Dialogue/Dialogue Runner")]
    public class DialogueRunner : MonoBehaviour, IDialogueController
    {
        [Tooltip("Where GLOBAL (persistent) variables live. Leave empty to use an in-memory store that lasts as long as this component.")]
        [SerializeField] private VariableStoreBase variableStore;

        [Tooltip("Where dialogue events (GiveItem, OpenShop, ...) are handled. Leave empty to ignore events (a warning is logged).")]
        [SerializeField] private EventDispatcher eventDispatcher;

        [Tooltip("What to do if StartDialogue is called while a conversation is already running.")]
        [SerializeField] private bool interruptRunningDialogue;

        [SerializeField] private bool logWarnings = true;
        [SerializeField] private bool logErrors = true;

        [Header("UnityEvents (optional)")]
        public UnityEvent<string> onDialogueStarted = new UnityEvent<string>();
        [Tooltip("Passes the ending name (empty if none or if the conversation was stopped).")]
        public UnityEvent<string> onDialogueEnded = new UnityEvent<string>();
        public UnityEvent<string> onError = new UnityEvent<string>();

        private InMemoryVariableStore fallbackStore;

        public DialogueSession Session { get; private set; }
        public bool IsRunning { get { return Session != null && Session.IsRunning; } }

        public event Action<DialogueGraph> DialogueStarted;
        public event Action<DialogueLine> LineShown;
        public event Action<IReadOnlyList<DialogueChoice>> ChoicesShown;
        /// <summary>The ending name, or null if the conversation was stopped.</summary>
        public event Action<string> DialogueEnded;
        public event Action<DialogueError> Failed;

        /// <summary>Connects stores programmatically (for code-built setups). Pass null to keep the current value.</summary>
        public void Configure(VariableStoreBase store, EventDispatcher dispatcher)
        {
            if (store != null) variableStore = store;
            if (dispatcher != null) eventDispatcher = dispatcher;
        }

        public bool HasVariableStore { get { return variableStore != null; } }
        public bool HasEventDispatcher { get { return eventDispatcher != null; } }

        private IVariableStore ActiveStore
        {
            get
            {
                if (variableStore != null) return variableStore;
                return fallbackStore ?? (fallbackStore = new InMemoryVariableStore());
            }
        }

        // ---------------------------------------------------------------- start

        public bool StartDialogue(TextAsset asset)
        {
            if (!DialogueLoader.TryLoad(asset, out var graph, out var error)) { ReportLoadError(error); return false; }
            return StartDialogue(graph);
        }

        public bool StartDialogue(string json)
        {
            if (!DialogueLoader.TryParse(json, out var graph, out var error)) { ReportLoadError(error); return false; }
            return StartDialogue(graph);
        }

        public bool StartDialogue(DialogueGraph graph)
        {
            if (graph == null) { ReportLoadError("No dialogue to start."); return false; }
            if (IsRunning)
            {
                if (!interruptRunningDialogue)
                {
                    if (logWarnings) Debug.LogWarning("StartDialogue ignored: a conversation is already running.", this);
                    return false;
                }
                Stop();
            }

            var session = new DialogueSession(graph, ActiveStore, eventDispatcher != null ? eventDispatcher.Registry : null);
            session.LineShown += l => LineShown?.Invoke(l);
            session.ChoicesShown += c => ChoicesShown?.Invoke(c);
            session.Ended += e =>
            {
                DialogueEnded?.Invoke(e);
                onDialogueEnded.Invoke(e ?? "");
            };
            session.ErrorOccurred += e =>
            {
                if (logErrors) Debug.LogError($"Dialogue \"{graph.Name}\" failed: {e}", this);
                Failed?.Invoke(e);
                onError.Invoke(e.Message);
            };
            session.Warning += w => { if (logWarnings) Debug.LogWarning($"Dialogue \"{graph.Name}\": {w}", this); };

            Session = session;
            DialogueStarted?.Invoke(graph);
            onDialogueStarted.Invoke(graph.Name);
            session.Start();
            return true;
        }

        private void ReportLoadError(string message)
        {
            if (logErrors) Debug.LogError(message, this);
            onError.Invoke(message);
            Failed?.Invoke(new DialogueError(DialogueErrorCode.InvalidData, message, ""));
        }

        // ---------------------------------------------------------------- control

        public bool Advance() { return Session != null && Session.Advance(); }
        public bool Choose(int index) { return Session != null && Session.Choose(index); }

        /// <summary>Ends the current conversation (the ending is reported as null / empty).</summary>
        public void Stop() { if (Session != null) Session.Stop(); }

        private void OnDestroy()
        {
            // Do not raise events while the scene is being torn down.
            Session = null;
        }
    }
}
