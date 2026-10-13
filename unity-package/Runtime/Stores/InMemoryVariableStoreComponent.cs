using System;
using System.Collections.Generic;
using UnityEngine;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// Keeps global dialogue variables in memory for the lifetime of the scene object (not saved to disk).
    /// Useful for prototypes and as the default store. Initial values can be seeded in the Inspector.
    /// </summary>
    [AddComponentMenu("Witch Workshop/Dialogue/In-Memory Variable Store")]
    public class InMemoryVariableStoreComponent : VariableStoreBase
    {
        [Serializable]
        public class SeedValue
        {
            public string name;
            public DialogueTypedValue value = new DialogueTypedValue();
        }

        [Tooltip("Values the game 'already has' when the scene starts (e.g. gold = 100). Leave empty to rely on the defaults exported from the editor.")]
        [SerializeField] private List<SeedValue> seedValues = new List<SeedValue>();

        private InMemoryVariableStore store;

        /// <summary>The underlying store (e.g. to snapshot it into your own save file).</summary>
        public InMemoryVariableStore Store
        {
            get
            {
                if (store == null)
                {
                    store = new InMemoryVariableStore();
                    foreach (var s in seedValues)
                    {
                        if (s == null || string.IsNullOrEmpty(s.name) || s.value == null) continue;
                        try { store.Set(s.name, DialogueValue.FromTyped(s.value)); }
                        catch (DialogueException e) { Debug.LogWarning($"Seed value \"{s.name}\" ignored: {e.Message}", this); }
                    }
                }
                return store;
            }
        }

        public override bool TryGet(string name, out DialogueValue value) { return Store.TryGet(name, out value); }
        public override void Set(string name, DialogueValue value) { Store.Set(name, value); }
    }
}
