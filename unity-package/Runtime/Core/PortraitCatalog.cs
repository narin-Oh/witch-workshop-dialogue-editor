using System;
using System.Collections.Generic;

namespace WitchWorkshop.Dialogue
{
    /// <summary>How a portrait lookup was satisfied (useful for debugging missing art).</summary>
    public enum PortraitMatch
    {
        /// <summary>The exact portraitId + expression.</summary>
        Exact,
        /// <summary>The character exists but not that expression; its default expression (e.g. "neutral") was used.</summary>
        DefaultExpression,
        /// <summary>The character exists but neither expression; the character's default sprite was used.</summary>
        CharacterDefault,
        /// <summary>The character is unknown; the global fallback sprite was used.</summary>
        Fallback,
        /// <summary>Nothing matched and there is no fallback.</summary>
        None,
    }

    /// <summary>
    /// Engine-independent portrait lookup (generic over the sprite type so it can be unit-tested without Unity).
    /// Order: exact expression → default expression → character default → global fallback → none.
    /// Ids and expressions are matched case-insensitively.
    /// </summary>
    public sealed class PortraitCatalog<TSprite> where TSprite : class
    {
        private sealed class Entry
        {
            public TSprite CharacterDefault;
            public readonly Dictionary<string, TSprite> Expressions = new Dictionary<string, TSprite>(StringComparer.OrdinalIgnoreCase);
        }

        private readonly Dictionary<string, Entry> sets = new Dictionary<string, Entry>(StringComparer.OrdinalIgnoreCase);

        /// <summary>Expression tried when the requested one is missing. Default "neutral".</summary>
        public string DefaultExpression { get; set; } = "neutral";

        /// <summary>Used when the character is unknown. May be null.</summary>
        public TSprite FallbackSprite { get; set; }

        public int CharacterCount { get { return sets.Count; } }

        /// <summary>Adds or replaces a character. Null sprites are treated as missing.</summary>
        public void SetCharacter(string portraitId, TSprite characterDefault, IEnumerable<KeyValuePair<string, TSprite>> expressions)
        {
            if (string.IsNullOrEmpty(portraitId)) return;
            var entry = new Entry { CharacterDefault = characterDefault };
            if (expressions != null)
                foreach (var kv in expressions)
                    if (!string.IsNullOrEmpty(kv.Key) && kv.Value != null) entry.Expressions[kv.Key] = kv.Value;
            sets[portraitId] = entry;
        }

        public void Clear() { sets.Clear(); }

        public bool HasCharacter(string portraitId) { return !string.IsNullOrEmpty(portraitId) && sets.ContainsKey(portraitId); }

        public PortraitMatch Resolve(string portraitId, string expression, out TSprite sprite)
        {
            if (!string.IsNullOrEmpty(portraitId) && sets.TryGetValue(portraitId, out var entry))
            {
                if (!string.IsNullOrEmpty(expression) && entry.Expressions.TryGetValue(expression, out sprite) && sprite != null)
                    return PortraitMatch.Exact;
                if (!string.IsNullOrEmpty(DefaultExpression) && entry.Expressions.TryGetValue(DefaultExpression, out sprite) && sprite != null)
                    return PortraitMatch.DefaultExpression;
                if (entry.CharacterDefault != null)
                {
                    sprite = entry.CharacterDefault;
                    return PortraitMatch.CharacterDefault;
                }
            }

            sprite = FallbackSprite;
            return sprite != null ? PortraitMatch.Fallback : PortraitMatch.None;
        }
    }
}
