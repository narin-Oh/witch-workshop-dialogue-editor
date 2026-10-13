using System;

namespace WitchWorkshop.Dialogue
{
    // DTOs that mirror the runtime JSON exported by the Witch Workshop web editor (schemaVersion 1).
    // They are plain [Serializable] classes so Unity's JsonUtility can fill them. Field names MUST match
    // the JSON property names exactly. See Documentation~/Schema.md.

    /// <summary>A typed value: read the field that matches <see cref="valueType"/> ("int", "bool" or "string").</summary>
    [Serializable]
    public class DialogueTypedValue
    {
        public string valueType = "int";
        public int intValue;
        public bool boolValue;
        public string stringValue = "";
    }

    /// <summary>A typed event parameter (a <see cref="DialogueTypedValue"/> plus a key).</summary>
    [Serializable]
    public class DialogueEventParam
    {
        public string key = "";
        public string valueType = "string";
        public int intValue;
        public bool boolValue;
        public string stringValue = "";
    }

    [Serializable]
    public class DialogueVariableDef
    {
        public string name = "";
        /// <summary>"global" (persistent game state) or "local" (this conversation only).</summary>
        public string scope = "global";
        public string valueType = "int";
        public DialogueTypedValue initial = new DialogueTypedValue();
    }

    [Serializable]
    public class DialogueChoiceData
    {
        public string id = "";
        public string text = "";
        public string next = "";
    }

    /// <summary>One node. Every node has every field; fields a node type does not use hold their defaults.</summary>
    [Serializable]
    public class DialogueNodeData
    {
        public string id = "";
        /// <summary>dialogue | choice | condition | variable | event | end</summary>
        public string type = "";

        // dialogue
        /// <summary>"character" | "narration" | "sceneTransition". Exports from before this field existed omit it: the default keeps them Character Dialogue.</summary>
        public string displayMode = "character";
        public string speaker = "";
        public string displayName = "";
        public string text = "";
        public string portraitId = "";
        public string expression = "";

        // choice
        public DialogueChoiceData[] choices = new DialogueChoiceData[0];

        // condition
        public string variable = "";
        /// <summary>One of == != &gt; &lt; &gt;= &lt;=. Declared with @ because "operator" is a C# keyword; the field name is still "operator".</summary>
        public string @operator = "";
        public DialogueTypedValue compare = new DialogueTypedValue();
        public string nextTrue = "";
        public string nextFalse = "";

        // variable
        /// <summary>"set" | "add" | "subtract"</summary>
        public string operation = "";
        public DialogueTypedValue operand = new DialogueTypedValue();

        // event
        public string eventName = "";
        public DialogueEventParam[] eventParams = new DialogueEventParam[0];

        // dialogue / variable / event
        public string next = "";

        // end
        public string endingName = "";
    }

    [Serializable]
    public class DialogueData
    {
        public int schemaVersion;
        public string id = "";
        public string name = "";
        /// <summary>First executable node. (The editor-only Start node is already resolved away.)</summary>
        public string startNodeId = "";
        public DialogueVariableDef[] variables = new DialogueVariableDef[0];
        public DialogueNodeData[] nodes = new DialogueNodeData[0];
    }

    /// <summary>String constants for the schema's enumerations (they are plain strings in the JSON).</summary>
    public static class DialogueSchema
    {
        public const int SupportedVersion = 1;

        public const string NodeDialogue = "dialogue";
        public const string NodeChoice = "choice";
        public const string NodeCondition = "condition";
        public const string NodeVariable = "variable";
        public const string NodeEvent = "event";
        public const string NodeEnd = "end";

        public const string ModeCharacter = "character";
        public const string ModeNarration = "narration";
        public const string ModeSceneTransition = "sceneTransition";

        public const string ScopeGlobal = "global";
        public const string ScopeLocal = "local";

        public const string TypeInt = "int";
        public const string TypeBool = "bool";
        public const string TypeString = "string";

        public const string OpSet = "set";
        public const string OpAdd = "add";
        public const string OpSubtract = "subtract";
    }
}
