using System.Text;
using UnityEditor;
using UnityEngine;

namespace WitchWorkshop.Dialogue.Editor
{
    /// <summary>Menu items: create a Dialogue Manager in the scene and validate dialogue JSON assets.</summary>
    public static class DialogueMenu
    {
        [MenuItem("GameObject/Witch Workshop/Dialogue Manager", false, 10)]
        private static void CreateManager(MenuCommand command) { Create(command, false); }

        [MenuItem("GameObject/Witch Workshop/Dialogue Manager + Sample UI", false, 11)]
        private static void CreateManagerWithUi(MenuCommand command) { Create(command, true); }

        private static void Create(MenuCommand command, bool withSampleUi)
        {
            var go = new GameObject("Dialogue Manager");
            GameObjectUtility.SetParentAndAlign(go, command.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Dialogue Manager");

            Undo.AddComponent<DialogueRunner>(go);
            Undo.AddComponent<InMemoryVariableStoreComponent>(go);
            Undo.AddComponent<EventDispatcher>(go);
            Undo.AddComponent<CharacterPortraitResolver>(go);
            var manager = Undo.AddComponent<DialogueManager>(go);

            if (withSampleUi)
            {
                var built = DefaultDialogueUIBuilder.Build(go.transform, true);
                Undo.RegisterCreatedObjectUndo(built.Canvas.gameObject, "Create Sample Dialogue UI");
            }

            manager.AutoAssign();
            EditorUtility.SetDirty(manager);
            Selection.activeGameObject = go;
        }

        [MenuItem("Assets/Witch Workshop/Validate Dialogue JSON", true)]
        private static bool ValidateEnabled()
        {
            foreach (var o in Selection.objects) if (o is TextAsset) return true;
            return false;
        }

        [MenuItem("Assets/Witch Workshop/Validate Dialogue JSON", false, 2000)]
        private static void ValidateSelected()
        {
            foreach (var o in Selection.objects)
            {
                if (!(o is TextAsset asset)) continue;
                DialogueData data = null;
                try { data = JsonUtility.FromJson<DialogueData>(asset.text); }
                catch (System.Exception e) { Debug.LogError($"{asset.name}: not valid JSON ({e.Message})", asset); continue; }

                var issues = DialogueValidator.Validate(data);
                if (issues.Count == 0)
                {
                    Debug.Log($"{asset.name}: OK - \"{data.name}\", {data.nodes.Length} nodes, {data.variables.Length} variables.", asset);
                    continue;
                }
                var sb = new StringBuilder();
                sb.Append(asset.name).Append(": ").Append(issues.Count).Append(" problem(s)");
                foreach (var i in issues) sb.Append("\n  - ").Append(i);
                Debug.LogError(sb.ToString(), asset);
            }
        }
    }
}
