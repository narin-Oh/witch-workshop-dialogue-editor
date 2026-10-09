namespace WitchWorkshop.Dialogue
{
    /// <summary>Evaluates condition nodes. Mirrors the web editor's preview runner.</summary>
    public static class ConditionEvaluator
    {
        public static bool IsOperatorValid(string op)
        {
            return op == "==" || op == "!=" || op == ">" || op == "<" || op == ">=" || op == "<=";
        }

        /// <summary>Operators usable with a type: all six for int, only == and != for bool and string.</summary>
        public static bool IsOperatorAllowedFor(DialogueValueType type, string op)
        {
            if (!IsOperatorValid(op)) return false;
            return type == DialogueValueType.Int || op == "==" || op == "!=";
        }

        /// <summary>Evaluates <c>left op right</c>. Throws <see cref="DialogueException"/> on a type mismatch or an operator that is invalid for the type.</summary>
        public static bool Evaluate(DialogueValue left, string op, DialogueValue right)
        {
            if (left.Type != right.Type)
                throw new DialogueException(DialogueErrorCode.TypeMismatch, $"Cannot compare {DialogueValue.TypeName(left.Type)} with {DialogueValue.TypeName(right.Type)}.");
            if (!IsOperatorValid(op))
                throw new DialogueException(DialogueErrorCode.InvalidOperator, $"Unknown operator \"{op}\".");
            if (!IsOperatorAllowedFor(left.Type, op))
                throw new DialogueException(DialogueErrorCode.InvalidOperator, $"Operator \"{op}\" is not valid for {DialogueValue.TypeName(left.Type)}.");

            switch (op)
            {
                case "==": return left.Equals(right);
                case "!=": return !left.Equals(right);
                case ">": return left.IntValue > right.IntValue;
                case "<": return left.IntValue < right.IntValue;
                case ">=": return left.IntValue >= right.IntValue;
                default: return left.IntValue <= right.IntValue; // "<="
            }
        }
    }

    /// <summary>Applies variable-node operations (set / add / subtract).</summary>
    public static class VariableOperations
    {
        public static bool IsOperationValid(string operation)
        {
            return operation == DialogueSchema.OpSet || operation == DialogueSchema.OpAdd || operation == DialogueSchema.OpSubtract;
        }

        public static DialogueValue Apply(DialogueValue current, string operation, DialogueValue operand)
        {
            if (current.Type != operand.Type)
                throw new DialogueException(DialogueErrorCode.TypeMismatch, $"Cannot apply {DialogueValue.TypeName(operand.Type)} value to {DialogueValue.TypeName(current.Type)} variable.");
            switch (operation)
            {
                case DialogueSchema.OpSet:
                    return operand;
                case DialogueSchema.OpAdd:
                case DialogueSchema.OpSubtract:
                    if (current.Type != DialogueValueType.Int)
                        throw new DialogueException(DialogueErrorCode.InvalidOperation, $"\"{operation}\" requires an int variable.");
                    return DialogueValue.FromInt(operation == DialogueSchema.OpAdd ? unchecked(current.IntValue + operand.IntValue) : unchecked(current.IntValue - operand.IntValue));
                default:
                    throw new DialogueException(DialogueErrorCode.InvalidOperation, $"Unknown operation \"{operation}\".");
            }
        }
    }
}
