using System;
using System.Globalization;

namespace WitchWorkshop.Dialogue
{
    public enum DialogueValueType
    {
        Int,
        Bool,
        String,
    }

    /// <summary>An immutable typed value (int, bool or string). Used for variables, comparisons and event parameters.</summary>
    public readonly struct DialogueValue : IEquatable<DialogueValue>
    {
        public DialogueValueType Type { get; }
        public int IntValue { get; }
        public bool BoolValue { get; }
        public string StringValue { get; }

        private DialogueValue(DialogueValueType type, int i, bool b, string s)
        {
            Type = type;
            IntValue = i;
            BoolValue = b;
            StringValue = s ?? "";
        }

        public static DialogueValue FromInt(int value) { return new DialogueValue(DialogueValueType.Int, value, false, ""); }
        public static DialogueValue FromBool(bool value) { return new DialogueValue(DialogueValueType.Bool, 0, value, ""); }
        public static DialogueValue FromString(string value) { return new DialogueValue(DialogueValueType.String, 0, false, value); }

        public static bool TryParseType(string valueType, out DialogueValueType type)
        {
            switch (valueType)
            {
                case DialogueSchema.TypeInt: type = DialogueValueType.Int; return true;
                case DialogueSchema.TypeBool: type = DialogueValueType.Bool; return true;
                case DialogueSchema.TypeString: type = DialogueValueType.String; return true;
                default: type = DialogueValueType.Int; return false;
            }
        }

        public static string TypeName(DialogueValueType type)
        {
            switch (type)
            {
                case DialogueValueType.Int: return DialogueSchema.TypeInt;
                case DialogueValueType.Bool: return DialogueSchema.TypeBool;
                default: return DialogueSchema.TypeString;
            }
        }

        /// <summary>Builds a value from the exported {valueType,intValue,boolValue,stringValue} fields.</summary>
        public static DialogueValue FromTyped(string valueType, int intValue, bool boolValue, string stringValue)
        {
            if (!TryParseType(valueType, out var type))
                throw new DialogueException(DialogueErrorCode.InvalidValueType, $"Unknown value type \"{valueType}\".");
            switch (type)
            {
                case DialogueValueType.Int: return FromInt(intValue);
                case DialogueValueType.Bool: return FromBool(boolValue);
                default: return FromString(stringValue);
            }
        }

        public static DialogueValue FromTyped(DialogueTypedValue v)
        {
            if (v == null) throw new DialogueException(DialogueErrorCode.InvalidData, "Missing typed value.");
            return FromTyped(v.valueType, v.intValue, v.boolValue, v.stringValue);
        }

        public static DialogueValue FromTyped(DialogueEventParam p)
        {
            return FromTyped(p.valueType, p.intValue, p.boolValue, p.stringValue);
        }

        public DialogueTypedValue ToTyped()
        {
            return new DialogueTypedValue { valueType = TypeName(Type), intValue = IntValue, boolValue = BoolValue, stringValue = StringValue };
        }

        /// <summary>The value as a boxed int, bool or string.</summary>
        public object ToObject()
        {
            switch (Type)
            {
                case DialogueValueType.Int: return IntValue;
                case DialogueValueType.Bool: return BoolValue;
                default: return StringValue;
            }
        }

        public bool Equals(DialogueValue other)
        {
            if (Type != other.Type) return false;
            switch (Type)
            {
                case DialogueValueType.Int: return IntValue == other.IntValue;
                case DialogueValueType.Bool: return BoolValue == other.BoolValue;
                default: return string.Equals(StringValue, other.StringValue, StringComparison.Ordinal);
            }
        }

        public override bool Equals(object obj) { return obj is DialogueValue v && Equals(v); }

        public override int GetHashCode()
        {
            switch (Type)
            {
                case DialogueValueType.Int: return IntValue.GetHashCode() ^ 1;
                case DialogueValueType.Bool: return BoolValue.GetHashCode() ^ 2;
                default: return StringValue.GetHashCode() ^ 3;
            }
        }

        public static bool operator ==(DialogueValue a, DialogueValue b) { return a.Equals(b); }
        public static bool operator !=(DialogueValue a, DialogueValue b) { return !a.Equals(b); }

        /// <summary>Plain text: 5, true, hello.</summary>
        public override string ToString()
        {
            switch (Type)
            {
                case DialogueValueType.Int: return IntValue.ToString(CultureInfo.InvariantCulture);
                case DialogueValueType.Bool: return BoolValue ? "true" : "false";
                default: return StringValue;
            }
        }
    }
}
