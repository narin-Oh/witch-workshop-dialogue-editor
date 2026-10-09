using System;
using System.Collections.Generic;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// Storage for GLOBAL (persistent) dialogue variables. Implement this on top of your own save system.
    /// The dialogue system never resets global variables: it only reads them (falling back to the exported default
    /// when <see cref="TryGet"/> returns false) and writes them when a variable node runs.
    /// </summary>
    public interface IVariableStore
    {
        /// <summary>Returns true and the stored value if the game has a value for <paramref name="name"/>.</summary>
        bool TryGet(string name, out DialogueValue value);

        /// <summary>Stores a new value. Called when a variable node changes a global variable.</summary>
        void Set(string name, DialogueValue value);
    }

    /// <summary>A simple dictionary-backed store. Fine for tests, prototypes and as a base for your own persistence.</summary>
    public class InMemoryVariableStore : IVariableStore
    {
        private readonly Dictionary<string, DialogueValue> values = new Dictionary<string, DialogueValue>(StringComparer.Ordinal);

        /// <summary>Raised after every <see cref="Set"/> (name, old value or null, new value).</summary>
        public event Action<string, DialogueValue?, DialogueValue> Changed;

        public int Count { get { return values.Count; } }

        public bool TryGet(string name, out DialogueValue value) { return values.TryGetValue(name, out value); }

        public void Set(string name, DialogueValue value)
        {
            DialogueValue? old = values.TryGetValue(name, out var o) ? o : (DialogueValue?)null;
            values[name] = value;
            Changed?.Invoke(name, old, value);
        }

        public bool Remove(string name) { return values.Remove(name); }
        public void Clear() { values.Clear(); }

        /// <summary>A copy of all stored values (for saving).</summary>
        public Dictionary<string, DialogueValue> Snapshot() { return new Dictionary<string, DialogueValue>(values, StringComparer.Ordinal); }

        /// <summary>Replaces the contents (for loading a save).</summary>
        public void Restore(IEnumerable<KeyValuePair<string, DialogueValue>> entries)
        {
            values.Clear();
            foreach (var kv in entries) values[kv.Key] = kv.Value;
        }
    }

    /// <summary>Adapts existing save-system code to <see cref="IVariableStore"/> with two delegates.</summary>
    public sealed class DelegateVariableStore : IVariableStore
    {
        public delegate bool TryGetDelegate(string name, out DialogueValue value);

        private readonly TryGetDelegate tryGet;
        private readonly Action<string, DialogueValue> set;

        public DelegateVariableStore(TryGetDelegate tryGet, Action<string, DialogueValue> set)
        {
            this.tryGet = tryGet ?? throw new ArgumentNullException(nameof(tryGet));
            this.set = set ?? throw new ArgumentNullException(nameof(set));
        }

        public bool TryGet(string name, out DialogueValue value) { return tryGet(name, out value); }
        public void Set(string name, DialogueValue value) { set(name, value); }
    }
}
