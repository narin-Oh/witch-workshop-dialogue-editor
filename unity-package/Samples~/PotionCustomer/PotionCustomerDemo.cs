using System.Collections.Generic;
using UnityEngine;

namespace WitchWorkshop.Dialogue.Samples
{
    /// <summary>
    /// One-component demo. Add this to an empty GameObject, assign potion-customer.dialogue.json and press Play.
    /// It builds a complete dialogue setup in code (runner, in-memory "save", events, portraits with generated placeholder art
    /// and a basic UI) so you can see the whole pipeline working with no artwork and no scene setup.
    /// In your own game you assemble the same pieces in the Inspector instead (see Documentation~/Setup.md).
    /// </summary>
    [AddComponentMenu("Witch Workshop/Samples/Potion Customer Demo")]
    public class PotionCustomerDemo : MonoBehaviour
    {
        [Tooltip("potion-customer.dialogue.json from this sample.")]
        [SerializeField] private TextAsset dialogue;

        [Tooltip("Optional: use YOUR DialogueUI instead of the generated one.")]
        [SerializeField] private DialogueUI customUi;

        [SerializeField] private bool startOnPlay = true;

        [Header("The game's saved state when the conversation starts")]
        [SerializeField] private int gold = 100;
        [SerializeField] private int reputation;
        [SerializeField] private bool knowsCoughRecipe;

        private DialogueManager manager;
        private InMemoryVariableStoreComponent store;
        private PotionShopEvents shop;
        private readonly List<string> eventLog = new List<string>();
        private Vector2 logScroll;

        private void Awake()
        {
            var root = new GameObject("Dialogue System (demo)");
            root.transform.SetParent(transform, false);

            // Execution
            var runner = root.AddComponent<DialogueRunner>();
            store = root.AddComponent<InMemoryVariableStoreComponent>();
            var dispatcher = root.AddComponent<EventDispatcher>();
            ResetSave();

            // Game-side event handlers (your game code, discovered by [DialogueEventHandler] attributes)
            shop = root.AddComponent<PotionShopEvents>();
            shop.Logged += m => eventLog.Add(m);
            dispatcher.RegisterHandlers(shop);

            // Portraits: generated placeholder faces. Use CharacterPortraitResolver + your own PortraitSet assets in a real game.
            var portraits = root.AddComponent<CharacterPortraitResolver>();
            string[] expressions = { "worried", "smile", "happy", "delighted", "hopeful", "cheeky", "sad", "embarrassed", "excited", "nervous", "smirk", "stern" };
            portraits.PortraitSets.Add(PlaceholderArt.CreatePortraitSet("mira", new Color(1f, 0.82f, 0.74f), expressions));
            portraits.PortraitSets.Add(PlaceholderArt.CreatePortraitSet("lumi", new Color(0.82f, 0.76f, 1f), expressions));
            portraits.Rebuild();

            // Presentation: generated UI, or yours.
            DialogueViewBase view;
            if (customUi != null) view = customUi;
            else
            {
                var built = DefaultDialogueUIBuilder.Build(root.transform);
                view = built.UI;
            }

            manager = root.AddComponent<DialogueManager>();
            manager.Setup(runner, view, store, dispatcher, portraits);
            manager.DialogueEnded += ending => eventLog.Add($"Conversation ended: {(string.IsNullOrEmpty(ending) ? "(stopped)" : ending)}");
        }

        private void Start()
        {
            if (startOnPlay) Begin();
        }

        public void Begin()
        {
            if (dialogue == null) { Debug.LogError("Assign potion-customer.dialogue.json to the demo.", this); return; }
            manager.StartDialogue(dialogue);
        }

        private void ResetSave()
        {
            store.Store.Clear();
            store.Store.Set("gold", DialogueValue.FromInt(gold));
            store.Store.Set("reputation", DialogueValue.FromInt(reputation));
            store.Store.Set("knowsCoughRecipe", DialogueValue.FromBool(knowsCoughRecipe));
        }

        // A tiny IMGUI panel that shows the game's side of things: the persistent variables and the events that were handled.
        private void OnGUI()
        {
            GUILayout.BeginArea(new Rect(10, 10, 360, 330), GUI.skin.box);
            GUILayout.Label("Potion Customer demo - game state (persistent variables)");
            GUILayout.Label($"gold: {Read("gold")}    reputation: {Read("reputation")}    knows cough recipe: {Read("knowsCoughRecipe")}");
            GUILayout.Label($"open shop: {(string.IsNullOrEmpty(shop.OpenShopId) ? "-" : shop.OpenShopId)}    recipes: {string.Join(", ", shop.UnlockedRecipes)}");
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Restart conversation")) { manager.StopDialogue(); Begin(); }
            if (GUILayout.Button("Reputation +3")) store.Set("reputation", DialogueValue.FromInt(Int("reputation") + 3));
            if (GUILayout.Button("Reset save")) { manager.StopDialogue(); ResetSave(); eventLog.Clear(); shop.UnlockedRecipes.Clear(); }
            GUILayout.EndHorizontal();
            GUILayout.Label("Events and endings:");
            logScroll = GUILayout.BeginScrollView(logScroll);
            foreach (var line in eventLog) GUILayout.Label(line);
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        private string Read(string name) { return store.TryGet(name, out var v) ? v.ToString() : "?"; }
        private int Int(string name) { return store.TryGet(name, out var v) ? v.IntValue : 0; }
    }
}
