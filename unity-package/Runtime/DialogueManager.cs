using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// The one component to add to a scene. It wires a <see cref="DialogueRunner"/> (execution) to a
    /// <see cref="DialogueViewBase"/> (your UI), and optionally to a variable store, an event dispatcher and a portrait resolver.
    /// Execution and presentation stay separate: the runner knows nothing about the UI, and the UI only reports player input.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Witch Workshop/Dialogue/Dialogue Manager")]
    public class DialogueManager : MonoBehaviour
    {
        [Header("Required")]
        [Tooltip("Executes the dialogue. Added automatically if missing.")]
        [SerializeField] private DialogueRunner runner;
        [Tooltip("Displays the dialogue: the provided DialogueUI wired to YOUR panel, or any DialogueViewBase subclass.")]
        [SerializeField] private DialogueViewBase view;

        [Header("Optional")]
        [Tooltip("Global (persistent) variables. Leave empty for an in-memory store.")]
        [SerializeField] private VariableStoreBase variableStore;
        [Tooltip("Handles event nodes (GiveItem, OpenShop, ...).")]
        [SerializeField] private EventDispatcher eventDispatcher;
        [Tooltip("Maps portrait IDs/expressions to sprites. Used by the view if the view has no resolver of its own.")]
        [SerializeField] private PortraitResolverBase portraitResolver;

        [Header("Behaviour")]
        [Tooltip("Lets DialogueTrigger and other scripts find this manager with DialogueManager.Default.")]
        [SerializeField] private bool registerAsDefault = true;
        [SerializeField] private bool dontDestroyOnLoad;

        [Header("Events (optional)")]
        public UnityEvent<string> onDialogueStarted = new UnityEvent<string>();
        public UnityEvent<string> onDialogueEnded = new UnityEvent<string>();

        private bool bound;
        private bool active; // a conversation has started and not yet ended

        /// <summary>The most recently enabled manager that has "Register As Default" ticked.</summary>
        public static DialogueManager Default { get; private set; }

        public DialogueRunner Runner { get { return runner; } }
        public DialogueViewBase View { get { return view; } }
        public bool IsRunning { get { return runner != null && runner.IsRunning; } }

        /// <summary>Raised with the ending name when a conversation ends (null if it was stopped).</summary>
        public event Action<string> DialogueEnded;
        public event Action<DialogueGraph> DialogueStarted;

        // ---------------------------------------------------------------- setup

        /// <summary>Called by the Inspector when the component is added: fills in references found on this object or its children.</summary>
        private void Reset()
        {
            AutoAssign();
        }

        /// <summary>Finds missing references on this GameObject and its children (including inactive ones).</summary>
        public void AutoAssign()
        {
            if (runner == null) runner = GetComponentInChildren<DialogueRunner>(true);
            if (view == null) view = GetComponentInChildren<DialogueViewBase>(true);
            if (variableStore == null) variableStore = GetComponentInChildren<VariableStoreBase>(true);
            if (eventDispatcher == null) eventDispatcher = GetComponentInChildren<EventDispatcher>(true);
            if (portraitResolver == null) portraitResolver = GetComponentInChildren<PortraitResolverBase>(true);
        }

        /// <summary>Connects everything from code (the Inspector does this for scene-built setups).</summary>
        public void Setup(DialogueRunner runner, DialogueViewBase view, VariableStoreBase store = null, EventDispatcher dispatcher = null, PortraitResolverBase portraits = null)
        {
            Unbind();
            this.runner = runner;
            this.view = view;
            variableStore = store;
            eventDispatcher = dispatcher;
            portraitResolver = portraits;
            if (isActiveAndEnabled) Bind();
        }

        private void Awake()
        {
            if (dontDestroyOnLoad)
            {
                transform.SetParent(null);
                DontDestroyOnLoad(gameObject);
            }
        }

        private void OnEnable()
        {
            if (registerAsDefault) Default = this;
            Bind();
        }

        private void OnDisable()
        {
            Unbind();
            if (Default == this) Default = null;
        }

        private void Bind()
        {
            if (bound) return;
            if (runner == null) runner = GetComponent<DialogueRunner>() ?? gameObject.AddComponent<DialogueRunner>();
            runner.Configure(variableStore, eventDispatcher);
            if (view == null)
            {
                Debug.LogWarning("DialogueManager has no view assigned: the dialogue will run but nothing will be displayed. Assign a DialogueUI (or your own DialogueViewBase).", this);
            }
            else
            {
                view.Bind(runner);
                if (portraitResolver != null) view.SetPortraitResolverIfMissing(portraitResolver);
            }
            runner.DialogueStarted += OnStarted;
            runner.LineShown += OnLine;
            runner.ChoicesShown += OnChoices;
            runner.DialogueEnded += OnEnded;
            runner.Failed += OnFailed;
            bound = true;
        }

        private void Unbind()
        {
            if (!bound) return;
            if (runner != null)
            {
                runner.DialogueStarted -= OnStarted;
                runner.LineShown -= OnLine;
                runner.ChoicesShown -= OnChoices;
                runner.DialogueEnded -= OnEnded;
                runner.Failed -= OnFailed;
            }
            bound = false;
        }

        // ---------------------------------------------------------------- API

        public bool StartDialogue(TextAsset asset) { return EnsureReady() && runner.StartDialogue(asset); }
        public bool StartDialogue(string json) { return EnsureReady() && runner.StartDialogue(json); }
        public bool StartDialogue(DialogueGraph graph) { return EnsureReady() && runner.StartDialogue(graph); }

        public void StopDialogue() { if (runner != null) runner.Stop(); }

        private bool EnsureReady()
        {
            if (!bound && isActiveAndEnabled) Bind();
            if (!bound)
            {
                Debug.LogError("DialogueManager is not enabled.", this);
                return false;
            }
            return true;
        }

        // ---------------------------------------------------------------- runner -> view

        private void OnStarted(DialogueGraph graph)
        {
            active = true;
            if (view != null) view.Show();
            DialogueStarted?.Invoke(graph);
            onDialogueStarted.Invoke(graph.Name);
        }

        private void OnLine(DialogueLine line) { if (view != null) view.ShowLine(line); }
        private void OnChoices(IReadOnlyList<DialogueChoice> choices) { if (view != null) view.ShowChoices(choices); }

        private void OnEnded(string ending)
        {
            active = false;
            if (view != null) view.Hide();
            DialogueEnded?.Invoke(ending);
            onDialogueEnded.Invoke(ending ?? "");
        }

        private void OnFailed(DialogueError error)
        {
            bool wasActive = active;
            active = false;
            if (view != null)
            {
                view.ShowError(error.Message);
                if (wasActive) view.Hide();
            }
            // A conversation that failed while running also counts as ended, so triggers and game code are never left waiting.
            // (A dialogue that never started - e.g. invalid JSON - raises no start/end events.)
            if (wasActive)
            {
                DialogueEnded?.Invoke(null);
                onDialogueEnded.Invoke("");
            }
        }
    }
}
