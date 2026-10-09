using System;
using System.IO;
using UnityEngine;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// Persists global dialogue variables to a small JSON file in Application.persistentDataPath.
    /// A ready-to-use example of a persistent store. Replace it with your own <see cref="VariableStoreBase"/> to write into your save system.
    /// </summary>
    [AddComponentMenu("Witch Workshop/Dialogue/JSON File Variable Store")]
    public class JsonFileVariableStore : VariableStoreBase
    {
        [Serializable]
        private class StoredValue
        {
            public string name;
            public DialogueTypedValue value;
        }

        [Serializable]
        private class SaveFile
        {
            public int version = 1;
            public StoredValue[] values = new StoredValue[0];
        }

        [SerializeField] private string fileName = "dialogue-variables.json";
        [Tooltip("Write the file every time a variable changes. Turn off to call Save() yourself (for example when your game saves).")]
        [SerializeField] private bool saveOnEveryChange = true;
        [SerializeField] private bool loadOnAwake = true;

        private readonly InMemoryVariableStore store = new InMemoryVariableStore();

        public string FilePath { get { return Path.Combine(Application.persistentDataPath, fileName); } }
        public InMemoryVariableStore Store { get { return store; } }

        private void Awake()
        {
            if (loadOnAwake) Load();
        }

        public override bool TryGet(string name, out DialogueValue value) { return store.TryGet(name, out value); }

        public override void Set(string name, DialogueValue value)
        {
            store.Set(name, value);
            if (saveOnEveryChange) Save();
        }

        public void Save()
        {
            var file = new SaveFile();
            var snapshot = store.Snapshot();
            file.values = new StoredValue[snapshot.Count];
            int i = 0;
            foreach (var kv in snapshot) file.values[i++] = new StoredValue { name = kv.Key, value = kv.Value.ToTyped() };
            try
            {
                string tmp = FilePath + ".tmp";
                File.WriteAllText(tmp, JsonUtility.ToJson(file, true));
                if (File.Exists(FilePath)) File.Delete(FilePath);
                File.Move(tmp, FilePath);
            }
            catch (Exception e)
            {
                Debug.LogError($"Could not save dialogue variables to {FilePath}: {e.Message}", this);
            }
        }

        public void Load()
        {
            if (!File.Exists(FilePath)) return;
            try
            {
                var file = JsonUtility.FromJson<SaveFile>(File.ReadAllText(FilePath));
                var entries = new System.Collections.Generic.List<System.Collections.Generic.KeyValuePair<string, DialogueValue>>();
                if (file?.values != null)
                    foreach (var v in file.values)
                        if (v != null && !string.IsNullOrEmpty(v.name) && v.value != null)
                            entries.Add(new System.Collections.Generic.KeyValuePair<string, DialogueValue>(v.name, DialogueValue.FromTyped(v.value)));
                store.Restore(entries); // replaces the in-memory contents with the file's
            }
            catch (Exception e)
            {
                Debug.LogError($"Could not read dialogue variables from {FilePath}: {e.Message}", this);
            }
        }

        public void DeleteSave()
        {
            store.Clear();
            try { if (File.Exists(FilePath)) File.Delete(FilePath); }
            catch (Exception e) { Debug.LogError($"Could not delete {FilePath}: {e.Message}", this); }
        }

        private void OnApplicationPause(bool paused) { if (paused && !saveOnEveryChange) Save(); }
        private void OnApplicationQuit() { if (!saveOnEveryChange) Save(); }
    }
}
