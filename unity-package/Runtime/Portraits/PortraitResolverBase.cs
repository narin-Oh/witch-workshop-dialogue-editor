using UnityEngine;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// Turns a portrait ID and expression from the dialogue JSON into a sprite.
    /// Derive from this to load art from Addressables, an atlas or your own character system.
    /// </summary>
    public abstract class PortraitResolverBase : MonoBehaviour
    {
        /// <summary>Returns true and a sprite if something should be shown. Must not throw for unknown ids.</summary>
        public abstract bool TryResolve(string portraitId, string expression, out Sprite sprite);
    }
}
