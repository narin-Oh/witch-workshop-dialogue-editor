using System.Collections.Generic;
using UnityEngine;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// Maps portrait IDs and expressions to your sprites using <see cref="PortraitSet"/> assets.
    /// Lookup order: exact expression, then the default expression ("neutral"), then the character's default sprite,
    /// then the fallback sprite, then nothing (the view hides the portrait). A missing image never breaks a conversation.
    /// </summary>
    [AddComponentMenu("Witch Workshop/Dialogue/Character Portrait Resolver")]
    public class CharacterPortraitResolver : PortraitResolverBase
    {
        [SerializeField] private List<PortraitSet> portraitSets = new List<PortraitSet>();

        [Tooltip("Tried when a line's expression is missing for a character.")]
        [SerializeField] private string defaultExpression = "neutral";

        [Tooltip("Shown for characters that have no Portrait Set. Leave empty to hide the portrait instead.")]
        [SerializeField] private Sprite fallbackSprite;

        [SerializeField] private bool logMissing = true;

        private PortraitCatalog<Sprite> catalog;
        private readonly HashSet<string> alreadyLogged = new HashSet<string>();

        public IList<PortraitSet> PortraitSets { get { return portraitSets; } }

        /// <summary>Rebuilds the lookup table. Call after changing sets at runtime.</summary>
        public void Rebuild()
        {
            catalog = new PortraitCatalog<Sprite> { DefaultExpression = defaultExpression, FallbackSprite = Real(fallbackSprite) };
            foreach (var set in portraitSets)
            {
                if (set == null || string.IsNullOrEmpty(set.PortraitId)) continue;
                var expressions = new List<KeyValuePair<string, Sprite>>();
                foreach (var e in set.Expressions) expressions.Add(new KeyValuePair<string, Sprite>(e.expression, Real(e.sprite)));
                catalog.SetCharacter(set.PortraitId, Real(set.DefaultSprite), expressions);
            }
        }

        // Unity's "destroyed object" null is not a C# null; convert so the catalog's null checks work.
        private static Sprite Real(Sprite s) { return s ? s : null; }

        private void OnValidate() { catalog = null; }

        /// <summary>Resolves a sprite and reports how the match was made (useful for debugging missing art).</summary>
        public PortraitMatch Resolve(string portraitId, string expression, out Sprite sprite)
        {
            if (catalog == null) Rebuild();
            var match = catalog.Resolve(portraitId, expression, out sprite);
            if (logMissing && match != PortraitMatch.Exact && !string.IsNullOrEmpty(portraitId))
            {
                string key = portraitId + "/" + expression + "/" + match;
                if (alreadyLogged.Add(key))
                    Debug.LogWarning($"Portrait \"{portraitId}\" expression \"{expression}\": {Describe(match)}", this);
            }
            return match;
        }

        public override bool TryResolve(string portraitId, string expression, out Sprite sprite)
        {
            Resolve(portraitId, expression, out sprite);
            return sprite != null;
        }

        private static string Describe(PortraitMatch m)
        {
            switch (m)
            {
                case PortraitMatch.DefaultExpression: return "expression not found, used the default expression.";
                case PortraitMatch.CharacterDefault: return "expression not found, used the character's default sprite.";
                case PortraitMatch.Fallback: return "character not found, used the fallback sprite.";
                default: return "no portrait found, the portrait will be hidden.";
            }
        }
    }
}
