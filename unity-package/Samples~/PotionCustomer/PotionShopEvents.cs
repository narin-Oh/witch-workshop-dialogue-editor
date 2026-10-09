using System;
using System.Collections.Generic;
using UnityEngine;

namespace WitchWorkshop.Dialogue.Samples
{
    /// <summary>
    /// EXAMPLE game-side handlers for the events used by the Potion Customer dialogue. This is the kind of class YOU write in
    /// your game: the dialogue package knows nothing about shops or recipes, it only calls these methods by event name.
    /// Typed parameters are matched by name: "shopId" and "recipeId" come from the Event nodes in the web editor.
    /// </summary>
    public class PotionShopEvents : MonoBehaviour
    {
        public readonly List<string> Log = new List<string>();
        public readonly HashSet<string> UnlockedRecipes = new HashSet<string>();
        public string OpenShopId { get; private set; } = "";

        public event Action<string> Logged;

        [DialogueEventHandler("OpenShop")]
        private void OpenShop(string shopId)
        {
            OpenShopId = shopId;
            Write($"OpenShop: shop \"{shopId}\" is now open (replace this with your shop UI).");
        }

        [DialogueEventHandler("UnlockRecipe")]
        private void UnlockRecipe(string recipeId)
        {
            bool added = UnlockedRecipes.Add(recipeId);
            Write(added ? $"UnlockRecipe: learned \"{recipeId}\"." : $"UnlockRecipe: \"{recipeId}\" was already known.");
        }

        private void Write(string message)
        {
            Log.Add(message);
            Debug.Log(message, this);
            Logged?.Invoke(message);
        }
    }
}
