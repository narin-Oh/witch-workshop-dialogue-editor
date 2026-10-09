using System;
using System.IO;
#if !UNITY_EDITOR
using System.Text.Json;
#endif

namespace WitchWorkshop.Dialogue.Tests
{
    /// <summary>
    /// File and JSON helpers shared by the Unity EditMode tests and the standalone .NET harness (Tests~/DotnetHarness).
    /// In Unity, JSON goes through UnityEngine.JsonUtility (the real production path). In the harness it goes through
    /// System.Text.Json with the same field-based mapping.
    /// </summary>
    public static class TestSupport
    {
        public static string ReadGolden(string fileName)
        {
#if UNITY_EDITOR
            var info = UnityEditor.PackageManager.PackageInfo.FindForAssembly(typeof(TestSupport).Assembly);
            var path = Path.Combine(info.resolvedPath, "Tests", "Editor", "Core", "Golden", fileName);
#else
            var path = Path.Combine(AppContext.BaseDirectory, "Golden", fileName);
#endif
            return File.ReadAllText(path);
        }

        public static T FromJson<T>(string json)
        {
#if UNITY_EDITOR
            return UnityEngine.JsonUtility.FromJson<T>(json);
#else
            return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { IncludeFields = true });
#endif
        }

        public static DialogueData LoadDialogue(string fileName)
        {
            return FromJson<DialogueData>(ReadGolden(fileName));
        }
    }

    // ---- golden playthrough DTOs (arrays and plain fields only, so JsonUtility can read them) ----

    [Serializable]
    public class GoldenValue
    {
        public string name;
        public string key;
        public string valueType;
        public int intValue;
        public bool boolValue;
        public string stringValue;

        public DialogueValue ToValue() { return DialogueValue.FromTyped(valueType, intValue, boolValue, stringValue); }
    }

    [Serializable]
    public class GoldenStep
    {
        public string kind;
        public string displayName;
        public string text;
        public string portraitId;
        public string expression;
        public string[] choices;
        public int pick;
        public string ending;
    }

    [Serializable]
    public class GoldenEvent
    {
        public string name;
        public GoldenValue[] parameters;
    }

    [Serializable]
    public class GoldenScenario
    {
        public string name;
        public GoldenValue[] globalOverrides;
        public int[] picks;
        public GoldenStep[] steps;
        public GoldenEvent[] events;
        public GoldenValue[] finalVars;
    }

    [Serializable]
    public class GoldenFile
    {
        public string dialogueFile;
        public string dialogueId;
        public GoldenScenario[] scenarios;
    }

    [Serializable]
    public class SchemaGolden
    {
        public int schemaVersion;
        public string[] rootFields;
        public string[] nodeFields;
        public string[] typedValueFields;
        public string[] variableFields;
        public string[] choiceFields;
        public string[] eventParamFields;
        public string[] nodeTypes;
    }
}
