using System;
using System.Text;
using UnityEngine;

namespace WitchWorkshop.Dialogue
{
    /// <summary>Thrown by <see cref="DialogueLoader.Parse"/> when JSON cannot be turned into a runnable dialogue.</summary>
    public sealed class DialogueLoadException : Exception
    {
        public DialogueLoadException(string message) : base(message) { }
    }

    /// <summary>Turns exported dialogue JSON (a TextAsset or a string) into a validated <see cref="DialogueGraph"/>.</summary>
    public static class DialogueLoader
    {
        private const int MaxIssuesInMessage = 5;

        /// <summary>Parses and validates. Throws <see cref="DialogueLoadException"/> with a readable message on failure.</summary>
        public static DialogueGraph Parse(string json, string sourceName = "dialogue JSON")
        {
            if (string.IsNullOrWhiteSpace(json)) throw new DialogueLoadException($"{sourceName} is empty.");

            DialogueData data;
            try
            {
                data = JsonUtility.FromJson<DialogueData>(json);
            }
            catch (Exception e)
            {
                throw new DialogueLoadException($"{sourceName} is not valid JSON: {e.Message}");
            }
            if (data == null) throw new DialogueLoadException($"{sourceName} could not be read.");

            var issues = DialogueValidator.Validate(data);
            if (issues.Count > 0)
            {
                var sb = new StringBuilder();
                sb.Append(sourceName).Append(" is not a valid Witch Workshop dialogue (").Append(issues.Count).Append(issues.Count == 1 ? " problem" : " problems").Append("):");
                for (int i = 0; i < issues.Count && i < MaxIssuesInMessage; i++) sb.Append("\n  - ").Append(issues[i]);
                if (issues.Count > MaxIssuesInMessage) sb.Append("\n  ... and ").Append(issues.Count - MaxIssuesInMessage).Append(" more");
                throw new DialogueLoadException(sb.ToString());
            }

            try { return new DialogueGraph(data); }
            catch (DialogueException e) { throw new DialogueLoadException($"{sourceName}: {e.Message}"); }
        }

        public static bool TryParse(string json, out DialogueGraph graph, out string error, string sourceName = "dialogue JSON")
        {
            try { graph = Parse(json, sourceName); error = null; return true; }
            catch (DialogueLoadException e) { graph = null; error = e.Message; return false; }
        }

        public static bool TryLoad(TextAsset asset, out DialogueGraph graph, out string error)
        {
            if (asset == null) { graph = null; error = "No dialogue asset assigned."; return false; }
            return TryParse(asset.text, out graph, out error, asset.name);
        }
    }
}
