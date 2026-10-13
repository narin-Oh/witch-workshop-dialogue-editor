using System.Collections.Generic;
using UnityEngine;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// Generates tiny procedural sprites so demos run without any artwork. NOT meant for your game: use your own
    /// pixel-art portraits via <see cref="PortraitSet"/>. Safe to delete together with the rest of UI/Defaults.
    /// </summary>
    public static class PlaceholderArt
    {
        /// <summary>A 32x32 point-filtered "face" sprite whose colour and mouth change with the expression.</summary>
        public static Sprite CreateFace(Color skin, string expression)
        {
            const int size = 32;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "Placeholder " + expression };
            var clear = new Color(0, 0, 0, 0);
            var pixels = new Color[size * size];
            for (int i = 0; i < pixels.Length; i++) pixels[i] = clear;

            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float dx = x - 15.5f, dy = y - 15.5f;
                    if (dx * dx + dy * dy < 14f * 14f) pixels[y * size + x] = skin;
                }
            Color ink = new Color(0.15f, 0.1f, 0.2f, 1f);
            void Px(int x, int y) { if (x >= 0 && x < size && y >= 0 && y < size) pixels[y * size + x] = ink; }
            // eyes
            for (int dy = 0; dy < 3; dy++) { Px(11, 19 + dy); Px(12, 19 + dy); Px(19, 19 + dy); Px(20, 19 + dy); }
            // mouth by expression
            switch (Normalize(expression))
            {
                case "happy": case "smile": case "delighted": case "excited":
                    for (int x = 11; x <= 20; x++) Px(x, x == 11 || x == 20 ? 12 : 10);
                    break;
                case "sad": case "worried": case "embarrassed": case "nervous":
                    for (int x = 11; x <= 20; x++) Px(x, x == 11 || x == 20 ? 9 : 11);
                    break;
                default:
                    for (int x = 12; x <= 19; x++) Px(x, 10);
                    break;
            }
            tex.SetPixels(pixels);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 32f);
        }

        private static string Normalize(string s) { return (s ?? "").Trim().ToLowerInvariant(); }

        /// <summary>Builds a portrait set with a few expressions for a placeholder character.</summary>
        public static PortraitSet CreatePortraitSet(string portraitId, Color skin, IEnumerable<string> expressions)
        {
            var set = ScriptableObject.CreateInstance<PortraitSet>();
            set.name = portraitId;
            set.PortraitId = portraitId;
            set.DefaultSprite = CreateFace(skin, "neutral");
            foreach (var e in expressions) set.AddExpression(e, CreateFace(skin, e));
            return set;
        }
    }
}
