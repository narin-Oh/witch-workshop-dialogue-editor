using System.Collections.Generic;
using TMPro;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace WitchWorkshop.Dialogue.Editor
{
    /// <summary>
    /// Inspector for <see cref="DialogueUI"/>: shows what is still unassigned and can fill obvious references from the
    /// children of your own panel prefab by name (Name, Body/Text, Portrait, Choices, Next/Advance).
    /// It only fills EMPTY fields and never changes your prefab's art or layout.
    /// </summary>
    [CustomEditor(typeof(DialogueUI))]
    public class DialogueUIEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();

            var ui = (DialogueUI)target;
            var problems = new List<string>();
            ui.CollectProblems(problems);

            EditorGUILayout.Space();
            if (problems.Count == 0) EditorGUILayout.HelpBox("All parts are assigned.", MessageType.None);
            foreach (var p in problems) EditorGUILayout.HelpBox(p, p.StartsWith("Body Text") ? MessageType.Error : MessageType.Warning);

            if (GUILayout.Button("Auto-assign empty fields from child names"))
            {
                AutoAssign(ui);
            }
        }

        private static void AutoAssign(DialogueUI ui)
        {
            var so = new SerializedObject(ui);
            Undo.RecordObject(ui, "Auto-assign Dialogue UI");
            var assigned = new List<string>();

            void Set(string field, Object value)
            {
                var prop = so.FindProperty(field);
                if (prop != null && prop.objectReferenceValue == null && value != null)
                {
                    prop.objectReferenceValue = value;
                    assigned.Add(field);
                }
            }

            TMP_Text Text(params string[] keys)
            {
                foreach (var t in ui.GetComponentsInChildren<TMP_Text>(true))
                    foreach (var k in keys)
                        if (t.name.ToLowerInvariant().Contains(k)) return t;
                return null;
            }

            Component Child<T>(params string[] keys) where T : Component
            {
                foreach (var c in ui.GetComponentsInChildren<T>(true))
                    foreach (var k in keys)
                        if (c.name.ToLowerInvariant().Contains(k)) return c;
                return null;
            }

            Set("nameText", Text("name", "speaker"));
            Set("bodyText", Text("body", "dialogue", "message", "content", "text"));
            Set("portraitImage", Child<Image>("portrait", "face", "avatar"));
            Set("choiceContainer", Child<RectTransform>("choice"));
            Set("choiceButtonPrefab", Child<Button>("choice"));
            Set("advanceButton", Child<Button>("next", "advance", "continue"));
            var overlay = Child<RectTransform>("scene text overlay", "scene overlay", "scene");
            Set("sceneOverlayRoot", overlay != null ? overlay.gameObject : null);
            Set("sceneOverlayText", overlay != null ? overlay.GetComponentInChildren<TMP_Text>(true) : null);
            Set("sceneAdvanceButton", overlay != null ? overlay.GetComponent<Button>() : null);

            so.ApplyModifiedProperties();
            EditorUtility.SetDirty(ui);
            Debug.Log(assigned.Count == 0 ? "Dialogue UI: nothing to assign (fields already set, or no child names matched)." : "Dialogue UI: assigned " + string.Join(", ", assigned) + ". Check them in the Inspector.", ui);
        }
    }
}
