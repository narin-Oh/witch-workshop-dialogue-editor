using UnityEngine;
using UnityEngine.Events;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// Starts a conversation from an NPC, door, sign or cutscene. Assign the dialogue JSON in the Inspector, then either
    /// call <see cref="Begin()"/> from your interaction code, or let it start on scene start / when the player enters a trigger.
    /// </summary>
    [AddComponentMenu("Witch Workshop/Dialogue/Dialogue Trigger")]
    public class DialogueTrigger : MonoBehaviour
    {
        public enum StartMode
        {
            /// <summary>Only when your code calls Begin() (e.g. from an interaction/"press E" script).</summary>
            Manual,
            OnStart,
            /// <summary>When a collider with the Required Tag enters this object's trigger collider (2D or 3D).</summary>
            OnTriggerEnter,
        }

        [Tooltip("The dialogue JSON exported from the web editor.")]
        [SerializeField] private TextAsset dialogue;

        [Tooltip("Leave empty to use DialogueManager.Default (or the first manager in the scene).")]
        [SerializeField] private DialogueManager manager;

        [SerializeField] private StartMode startMode = StartMode.Manual;

        [Tooltip("For OnTriggerEnter: only objects with this tag start the conversation. Empty = any object.")]
        [SerializeField] private string requiredTag = "Player";

        [Tooltip("Start only once per play session (call ResetTrigger() to allow it again).")]
        [SerializeField] private bool oneShot;

        public UnityEvent onStarted = new UnityEvent();
        [Tooltip("Passes the ending name (empty if stopped).")]
        public UnityEvent<string> onFinished = new UnityEvent<string>();

        private bool used;
        private DialogueManager listening;

        public TextAsset Dialogue { get { return dialogue; } set { dialogue = value; } }
        public bool HasStarted { get { return used; } }

        private void Start()
        {
            if (startMode == StartMode.OnStart) Begin();
        }

        /// <summary>Starts the assigned dialogue. Returns false if it could not start (no asset, already running, one-shot used...).</summary>
        public bool Begin()
        {
            return Begin(dialogue);
        }

        /// <summary>Starts a specific dialogue (lets one trigger choose between dialogues from code).</summary>
        public bool Begin(TextAsset asset)
        {
            if (oneShot && used) return false;
            if (asset == null)
            {
                Debug.LogWarning("DialogueTrigger has no dialogue assigned.", this);
                return false;
            }
            var m = ResolveManager();
            if (m == null)
            {
                Debug.LogError("No DialogueManager found. Add one to the scene (GameObject > Witch Workshop > Dialogue Manager).", this);
                return false;
            }
            if (m.IsRunning) return false;

            Unlisten();
            m.DialogueEnded += OnFinished;
            listening = m;
            if (!m.StartDialogue(asset)) { Unlisten(); return false; }
            used = true;
            onStarted.Invoke();
            return true;
        }

        /// <summary>Allows a one-shot trigger to start again.</summary>
        public void ResetTrigger() { used = false; }

        private DialogueManager ResolveManager()
        {
            if (manager != null) return manager;
            if (DialogueManager.Default != null) return DialogueManager.Default;
            return FindFirstObjectByType<DialogueManager>();
        }

        private void OnFinished(string ending)
        {
            Unlisten();
            onFinished.Invoke(ending ?? "");
        }

        private void Unlisten()
        {
            if (listening != null) listening.DialogueEnded -= OnFinished;
            listening = null;
        }

        private void OnDisable() { Unlisten(); }

        private bool TagMatches(GameObject other)
        {
            return string.IsNullOrEmpty(requiredTag) || other.CompareTag(requiredTag);
        }

        private void OnTriggerEnter(Collider other)
        {
            if (startMode == StartMode.OnTriggerEnter && TagMatches(other.gameObject)) Begin();
        }

        private void OnTriggerEnter2D(Collider2D other)
        {
            if (startMode == StartMode.OnTriggerEnter && TagMatches(other.gameObject)) Begin();
        }
    }
}
