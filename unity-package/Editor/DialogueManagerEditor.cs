using UnityEditor;
using UnityEngine;

namespace WitchWorkshop.Dialogue.Editor
{
    [CustomEditor(typeof(DialogueManager))]
    public class DialogueManagerEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();
            var manager = (DialogueManager)target;
            EditorGUILayout.Space();
            if (GUILayout.Button("Auto-assign missing references from this object's children"))
            {
                Undo.RecordObject(manager, "Auto-assign Dialogue Manager");
                manager.AutoAssign();
                EditorUtility.SetDirty(manager);
            }
            if (manager.View == null)
                EditorGUILayout.HelpBox("No View assigned. Drag in the DialogueUI on your dialogue panel (or any DialogueViewBase).", MessageType.Warning);
        }
    }
}
