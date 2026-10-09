using System;
using System.Collections.Generic;
using UnityEngine;

namespace WitchWorkshop.Dialogue.Samples
{
    // ---------------------------------------------------------------------------------------------------------------
    // Minimal "game systems" for the demo. The dialogue package does NOT contain or assume any of these: replace each
    // interface implementation with your real inventory / shop / recipe book / quest log / scene loader.
    // ---------------------------------------------------------------------------------------------------------------
    public interface IInventory { void Add(string itemId, int amount); }
    public interface IShopService { void Open(string shopId); }
    public interface IRecipeBook { void Unlock(string recipeId); }
    public interface IQuestLog { void Start(string questId); void Complete(string questId); }
    public interface ISceneLoader { void Load(string sceneName); }

    /// <summary>
    /// Handlers for the standard events the web editor offers: GiveItem, OpenShop, UnlockRecipe, StartQuest, CompleteQuest, ChangeScene.
    /// Typed parameters are matched BY NAME to the event's parameters (itemId, amount, shopId, ...). Missing or wrongly typed
    /// parameters are reported as warnings and never break the conversation. Register with:
    ///     dispatcher.RegisterHandlers(gameEvents);        // or assign this component under "Handler Objects" on the EventDispatcher
    /// </summary>
    public class ExampleGameEvents : MonoBehaviour
    {
        public IInventory Inventory { get; set; }
        public IShopService Shop { get; set; }
        public IRecipeBook Recipes { get; set; }
        public IQuestLog Quests { get; set; }
        public ISceneLoader Scenes { get; set; }

        /// <summary>Every handled event as text (for the demo HUD).</summary>
        public readonly List<string> Log = new List<string>();
        public event Action<string> Logged;

        private void Awake()
        {
            // Defaults that only log, so the demo runs without any game systems. Replace them from your game code.
            if (Inventory == null) Inventory = new LoggingSystems(this);
            var logging = new LoggingSystems(this);
            if (Shop == null) Shop = logging;
            if (Recipes == null) Recipes = logging;
            if (Quests == null) Quests = logging;
            if (Scenes == null) Scenes = logging;
        }

        [DialogueEventHandler("GiveItem")]
        private void GiveItem(string itemId, int amount = 1) { Inventory.Add(itemId, amount); }

        [DialogueEventHandler("OpenShop")]
        private void OpenShop(string shopId) { Shop.Open(shopId); }

        [DialogueEventHandler("UnlockRecipe")]
        private void UnlockRecipe(string recipeId) { Recipes.Unlock(recipeId); }

        [DialogueEventHandler("StartQuest")]
        private void StartQuest(string questId) { Quests.Start(questId); }

        [DialogueEventHandler("CompleteQuest")]
        private void CompleteQuest(string questId) { Quests.Complete(questId); }

        [DialogueEventHandler("ChangeScene")]
        private void ChangeScene(string sceneName) { Scenes.Load(sceneName); }

        private void Write(string message)
        {
            Log.Add(message);
            Debug.Log(message, this);
            Logged?.Invoke(message);
        }

        private sealed class LoggingSystems : IInventory, IShopService, IRecipeBook, IQuestLog, ISceneLoader
        {
            private readonly ExampleGameEvents owner;
            public LoggingSystems(ExampleGameEvents owner) { this.owner = owner; }
            public void Add(string itemId, int amount) { owner.Write($"GiveItem: +{amount} {itemId}"); }
            public void Open(string shopId) { owner.Write($"OpenShop: {shopId}"); }
            public void Unlock(string recipeId) { owner.Write($"UnlockRecipe: {recipeId}"); }
            public void Start(string questId) { owner.Write($"StartQuest: {questId}"); }
            public void Complete(string questId) { owner.Write($"CompleteQuest: {questId}"); }
            public void Load(string sceneName) { owner.Write($"ChangeScene: {sceneName} (not loaded in the demo)"); }
        }
    }
}
