using System.Collections.Generic;
using UnityEngine;

namespace WitchWorkshop.Dialogue.Samples
{
    /// <summary>
    /// Demo for the Apprentice Quest dialogue: shows persistent quest state (moonpetalQuestStarted, moonpetals) and how
    /// ExampleGameEvents handles StartQuest, GiveItem, CompleteQuest and ChangeScene. Add to an empty GameObject, assign
    /// apprentice-quest.dialogue.json and press Play. Reuses the generated placeholder UI.
    /// </summary>
    [AddComponentMenu("Witch Workshop/Samples/Quest Demo")]
    public class QuestDemo : MonoBehaviour
    {
        [SerializeField] private TextAsset dialogue;
        [SerializeField] private bool startOnPlay = true;

        private DialogueManager manager;
        private InMemoryVariableStoreComponent store;
        private ExampleGameEvents events;
        private Vector2 scroll;

        private void Awake()
        {
            var root = new GameObject("Dialogue System (quest demo)");
            root.transform.SetParent(transform, false);
            var runner = root.AddComponent<DialogueRunner>();
            store = root.AddComponent<InMemoryVariableStoreComponent>();
            var dispatcher = root.AddComponent<EventDispatcher>();
            events = root.AddComponent<ExampleGameEvents>();
            dispatcher.RegisterHandlers(events);

            var portraits = root.AddComponent<CharacterPortraitResolver>();
            portraits.PortraitSets.Add(PlaceholderArt.CreatePortraitSet("pip", new Color(0.78f, 0.95f, 0.8f), new[] { "worried", "happy", "delighted", "sad", "hopeful" }));
            portraits.Rebuild();

            var built = DefaultDialogueUIBuilder.Build(root.transform);
            manager = root.AddComponent<DialogueManager>();
            manager.Setup(runner, built.UI, store, dispatcher, portraits);
        }

        private void Start() { if (startOnPlay) Begin(); }

        public void Begin()
        {
            if (dialogue == null) { Debug.LogError("Assign apprentice-quest.dialogue.json to the demo.", this); return; }
            manager.StartDialogue(dialogue);
        }

        private void OnGUI()
        {
            GUILayout.BeginArea(new Rect(10, 10, 360, 300), GUI.skin.box);
            GUILayout.Label("Quest demo - persistent state");
            GUILayout.Label($"moonpetalQuestStarted: {Read("moonpetalQuestStarted")}   moonpetals: {Read("moonpetals")}   goldQuest: {Read("goldQuest")}");
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Restart conversation")) { manager.StopDialogue(); Begin(); }
            if (GUILayout.Button("Collect 5 moonpetals")) store.Set("moonpetals", DialogueValue.FromInt(5));
            if (GUILayout.Button("Reset save")) { manager.StopDialogue(); store.Store.Clear(); events.Log.Clear(); }
            GUILayout.EndHorizontal();
            GUILayout.Label("Handled events:");
            scroll = GUILayout.BeginScrollView(scroll);
            foreach (var line in events.Log) GUILayout.Label(line);
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        // When the game's save has no value yet, the dialogue uses the defaults exported from the editor.
        private string Read(string name) { return store.TryGet(name, out var v) ? v.ToString() : "(default)"; }
    }
}
