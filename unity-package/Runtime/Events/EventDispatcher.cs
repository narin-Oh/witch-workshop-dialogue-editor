using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// Maps event identifiers from the dialogue JSON (e.g. "GiveItem") to game code.
    /// Register handlers three ways:
    ///   1. In code:           dispatcher.Register("OpenShop", args => ...);
    ///   2. With attributes:   [DialogueEventHandler("GiveItem")] void GiveItem(string itemId, int amount)  (assign the component under "Handler Objects")
    ///   3. In the Inspector:  add a binding (event name -> UnityEvent) under "Bindings".
    /// The dispatcher does not assume any game system exists: an event nobody handles only logs a warning.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Witch Workshop/Dialogue/Event Dispatcher")]
    public class EventDispatcher : MonoBehaviour
    {
        [Serializable] public class DialogueUnityEvent : UnityEvent<DialogueEventArgs> { }

        [Serializable]
        public class EventBinding
        {
            [Tooltip("The event name exactly as written in the editor's Event node, e.g. OpenShop.")]
            public string eventName;
            public DialogueUnityEvent onRaised = new DialogueUnityEvent();
        }

        [Tooltip("Inspector bindings: when the event runs, these UnityEvents are invoked. The method receives a DialogueEventArgs.")]
        [SerializeField] private List<EventBinding> bindings = new List<EventBinding>();

        [Tooltip("Components whose methods are marked with [DialogueEventHandler(\"EventName\")]. They are registered automatically.")]
        [SerializeField] private List<MonoBehaviour> handlerObjects = new List<MonoBehaviour>();

        private DialogueEventRegistry registry;
        private bool configured;

        /// <summary>The underlying registry (the runner passes it to the session).</summary>
        public DialogueEventRegistry Registry
        {
            get
            {
                if (registry == null)
                {
                    registry = new DialogueEventRegistry();
                    registry.HandlerFailed += (name, e) => Debug.LogWarning($"Dialogue event \"{name}\" handler failed: {e.Message}", this);
                }
                ConfigureOnce();
                return registry;
            }
        }

        private void Awake() { ConfigureOnce(); }

        private void ConfigureOnce()
        {
            if (configured || registry == null) return;
            configured = true;
            foreach (var b in bindings)
            {
                if (b == null || string.IsNullOrEmpty(b.eventName) || b.onRaised == null) continue;
                var evt = b.onRaised;
                registry.Register(b.eventName, args => evt.Invoke(args));
            }
            foreach (var target in handlerObjects)
            {
                if (target == null) continue;
                try { registry.RegisterAttributed(target); }
                catch (InvalidOperationException e) { Debug.LogError(e.Message, target); }
            }
        }

        public void Register(string eventName, Action<DialogueEventArgs> handler) { Registry.Register(eventName, handler); }
        public bool Unregister(string eventName, Action<DialogueEventArgs> handler) { return Registry.Unregister(eventName, handler); }

        /// <summary>Registers every [DialogueEventHandler] method on <paramref name="target"/> (typed parameters are bound by name).</summary>
        public int RegisterHandlers(object target) { return Registry.RegisterAttributed(target); }
    }
}
