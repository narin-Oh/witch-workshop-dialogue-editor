using System.Collections.Generic;
using UnityEngine;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// The presentation side of a conversation. A view only DISPLAYS dialogue and reports player input back through
    /// <see cref="Controller"/> (Advance / Choose). It never touches variables, conditions or events.
    /// Derive from this to build a completely custom UI, or use the configurable <see cref="DialogueUI"/>.
    /// </summary>
    public abstract class DialogueViewBase : MonoBehaviour
    {
        /// <summary>Set by <see cref="DialogueManager"/> (or call <see cref="Bind"/> yourself).</summary>
        public IDialogueController Controller { get; private set; }

        public virtual void Bind(IDialogueController controller) { Controller = controller; }

        /// <summary>A conversation started: make the dialogue UI visible.</summary>
        public abstract void Show();

        /// <summary>The conversation ended or was stopped: hide the dialogue UI.</summary>
        public abstract void Hide();

        public abstract void ShowLine(DialogueLine line);

        public abstract void ShowChoices(IReadOnlyList<DialogueChoice> choices);

        /// <summary>A problem occurred (bad data etc.). The default does nothing; override to display it.</summary>
        public virtual void ShowError(string message) { }

        /// <summary>Lets the manager provide a shared portrait resolver if the view has none of its own.</summary>
        public virtual void SetPortraitResolverIfMissing(PortraitResolverBase resolver) { }

        /// <summary>Call from your own input code to advance (e.g. from a PlayerInput event or a custom button).</summary>
        public virtual void OnAdvanceInput() { RequestAdvance(); }

        protected bool RequestAdvance() { return Controller != null && Controller.Advance(); }
        protected bool RequestChoice(int index) { return Controller != null && Controller.Choose(index); }
    }
}
