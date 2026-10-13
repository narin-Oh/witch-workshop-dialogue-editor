#if WW_HAS_INPUT_SYSTEM
using UnityEngine;
using UnityEngine.InputSystem;

namespace WitchWorkshop.Dialogue.InputSystem
{
    /// <summary>
    /// Compiled only when the Input System package is installed. Advances the dialogue from an InputAction
    /// (for example your "Interact" or "Submit" action) so you do not need the legacy Input Manager.
    /// </summary>
    [AddComponentMenu("Witch Workshop/Dialogue/Input System Advance Input")]
    public class InputSystemAdvanceInput : MonoBehaviour
    {
        [SerializeField] private DialogueViewBase view;
        [Tooltip("An action that fires once per press, e.g. UI/Submit or Player/Interact.")]
        [SerializeField] private InputActionReference advanceAction;

        private void OnEnable()
        {
            if (advanceAction == null) return;
            advanceAction.action.performed += OnPerformed;
            advanceAction.action.Enable();
        }

        private void OnDisable()
        {
            if (advanceAction == null) return;
            advanceAction.action.performed -= OnPerformed;
        }

        private void OnPerformed(InputAction.CallbackContext _)
        {
            if (view != null) view.OnAdvanceInput();
        }
    }
}
#endif
