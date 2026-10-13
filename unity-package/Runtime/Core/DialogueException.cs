using System;

namespace WitchWorkshop.Dialogue
{
    public enum DialogueErrorCode
    {
        InvalidData,
        UnsupportedSchema,
        UnknownNode,
        UnknownNodeType,
        MissingLink,
        UndefinedVariable,
        TypeMismatch,
        InvalidOperator,
        InvalidOperation,
        NoChoices,
        LoopDetected,
        InvalidValueType,
        MissingEventParameter,
    }

    /// <summary>Thrown by the low-level helpers; <see cref="DialogueSession"/> converts it into a graceful error state.</summary>
    public class DialogueException : Exception
    {
        public DialogueErrorCode Code { get; }

        public DialogueException(DialogueErrorCode code, string message) : base(message)
        {
            Code = code;
        }
    }

    /// <summary>A recoverable problem reported by a session (it never throws out of Start/Advance/Choose).</summary>
    public sealed class DialogueError
    {
        public DialogueErrorCode Code { get; }
        public string Message { get; }
        public string NodeId { get; }

        public DialogueError(DialogueErrorCode code, string message, string nodeId)
        {
            Code = code;
            Message = message;
            NodeId = nodeId ?? "";
        }

        public override string ToString()
        {
            return NodeId.Length > 0 ? $"[{Code}] {Message} (node {NodeId})" : $"[{Code}] {Message}";
        }
    }
}
