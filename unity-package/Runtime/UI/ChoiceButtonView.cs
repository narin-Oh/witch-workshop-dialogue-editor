using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// OPTIONAL helper for a choice-button prefab. Without it, <see cref="DialogueUI"/> finds the first TextMeshPro
    /// (or legacy Text) label inside the prefab by itself. Add this component when your button needs more than one label
    /// (for example a number badge) or custom setup; derive from it to run your own animation.
    /// </summary>
    [AddComponentMenu("Witch Workshop/Dialogue/Choice Button View")]
    public class ChoiceButtonView : MonoBehaviour
    {
        [Tooltip("Shows the choice text. Optional: the first TMP_Text inside the prefab is used if empty.")]
        [SerializeField] private TMP_Text label;

        [Tooltip("Optional: shows 1, 2, 3 ... for keyboard shortcuts.")]
        [SerializeField] private TMP_Text numberLabel;

        public TMP_Text Label { get { return label; } }

        /// <summary>Called whenever the button is (re)used for a choice.</summary>
        public virtual void Setup(int index, string text)
        {
            var target = label != null ? label : GetComponentInChildren<TMP_Text>(true);
            if (target != null) target.text = text;
            else
            {
                var legacy = GetComponentInChildren<Text>(true);
                if (legacy != null) legacy.text = text;
            }
            if (numberLabel != null) numberLabel.text = (index + 1).ToString();
        }
    }
}
