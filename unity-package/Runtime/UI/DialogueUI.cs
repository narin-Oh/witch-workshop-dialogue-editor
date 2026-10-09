using System;
using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// A configurable uGUI + TextMeshPro dialogue view. It owns NO layout and NO art: assign the parts of YOUR existing
    /// dialogue panel (name plate, text, portrait, choice button prefab) to the fields below.
    /// Every reference is optional except the body text, so a minimal UI (just a text box) works too.
    /// For a completely different look, derive from <see cref="DialogueViewBase"/> instead.
    /// </summary>
    [AddComponentMenu("Witch Workshop/Dialogue/Dialogue UI")]
    public class DialogueUI : DialogueViewBase
    {
        [Serializable]
        public class SpeakerStyle
        {
            [Tooltip("Matches the line's display name, speaker or portrait ID (case-insensitive).")]
            public string match;
            public Color nameColor = Color.white;
            public Color bodyColor = Color.white;
            [Tooltip("Optional: replaces the name plate sprite for this speaker.")]
            public Sprite namePlateSprite;
        }

        [Header("Panel")]
        [Tooltip("The object shown while a conversation runs. Defaults to this GameObject. Hidden at the end.")]
        [SerializeField] private GameObject panelRoot;
        [SerializeField] private bool hideOnAwake = true;

        [Header("Speaker name")]
        [SerializeField] private TMP_Text nameText;
        [Tooltip("Your name-plate object. Hidden when the line has no speaker.")]
        [SerializeField] private GameObject namePlateRoot;
        [Tooltip("Optional: the Image of your name plate, so per-speaker sprites below can swap it.")]
        [SerializeField] private Image namePlateImage;

        [Header("Dialogue text")]
        [SerializeField] private TMP_Text bodyText;
        [Tooltip("0 = show the whole line at once. Otherwise reveals this many characters per second.")]
        [SerializeField] private float charactersPerSecond;
        [Tooltip("When the player presses 'next' while text is still appearing, finish the line instead of advancing.")]
        [SerializeField] private bool completeLineBeforeAdvancing = true;
        [Tooltip("Shown when the line is complete and waiting for input (e.g. a blinking arrow).")]
        [SerializeField] private GameObject continueIndicator;

        [Header("Portrait")]
        [SerializeField] private Image portraitImage;
        [Tooltip("Optional frame object hidden together with the portrait.")]
        [SerializeField] private GameObject portraitRoot;
        [SerializeField] private PortraitResolverBase portraitResolver;
        [SerializeField] private bool preserveAspect = true;
        [Tooltip("Pixel art: resize the Image to the sprite's native size.")]
        [SerializeField] private bool setNativeSize;
        [Tooltip("Hide the portrait when no sprite is found (otherwise keep the previous one).")]
        [SerializeField] private bool hidePortraitWhenMissing = true;

        [Header("Choices")]
        [Tooltip("Parent of the choice buttons. Give it a Vertical Layout Group to stack them.")]
        [SerializeField] private RectTransform choiceContainer;
        [Tooltip("YOUR choice button prefab (a Button with a TextMeshPro label). ChoiceButtonView on it is optional.")]
        [SerializeField] private Button choiceButtonPrefab;
        [SerializeField] private bool selectFirstChoice = true;
        [Tooltip("Keep the last line visible while choices are shown.")]
        [SerializeField] private bool keepLineVisibleDuringChoices = true;

        [Header("Advance input")]
        [Tooltip("Clicked to advance (a 'next' button, or a full-screen invisible button over the panel).")]
        [SerializeField] private Button advanceButton;
        [Tooltip("Also advance with Space / Enter (only with the legacy Input Manager; with the new Input System see Documentation~/CustomUI.md).")]
        [SerializeField] private bool advanceWithKeys = true;

        [Header("Speaker styles (optional)")]
        [SerializeField] private List<SpeakerStyle> speakerStyles = new List<SpeakerStyle>();

        [Header("Events (optional)")]
        public UnityEvent onShown = new UnityEvent();
        public UnityEvent onHidden = new UnityEvent();
        public UnityEvent onLineShown = new UnityEvent();
        public UnityEvent onChoicesShown = new UnityEvent();

        private readonly List<Button> choiceButtons = new List<Button>();
        private Coroutine typing;
        private bool lineAnimating;
        private bool waitingForAdvance;
        private Color defaultNameColor = Color.white;
        private Color defaultBodyColor = Color.white;
        private Sprite defaultNamePlateSprite;
        private bool defaultsCaptured;

        // ---------------------------------------------------------------- public configuration (code-built UIs)

        public GameObject PanelRoot { get { return panelRoot != null ? panelRoot : gameObject; } }
        public PortraitResolverBase PortraitResolver { get { return portraitResolver; } set { portraitResolver = value; } }
        public float CharactersPerSecond { get { return charactersPerSecond; } set { charactersPerSecond = value; } }
        public bool IsLineAnimating { get { return lineAnimating; } }

        /// <summary>Assigns the parts of the UI from code (the Inspector does the same for scene-built UIs).</summary>
        public void Configure(TMP_Text name, TMP_Text body, Image portrait, RectTransform choicesParent, Button choicePrefab, Button advance, GameObject namePlate = null, GameObject indicator = null)
        {
            nameText = name;
            bodyText = body;
            portraitImage = portrait;
            choiceContainer = choicesParent;
            choiceButtonPrefab = choicePrefab;
            advanceButton = advance;
            namePlateRoot = namePlate;
            continueIndicator = indicator;
            WireAdvanceButton();
        }

        /// <summary>Reports missing references. Used by the inspector and Awake.</summary>
        public void CollectProblems(List<string> problems)
        {
            if (bodyText == null) problems.Add("Body Text is not assigned: dialogue lines have nowhere to appear.");
            if (choiceButtonPrefab != null && choiceContainer == null) problems.Add("Choice Button Prefab is set but Choice Container is not.");
            if (choiceButtonPrefab == null && choiceContainer != null) problems.Add("Choice Container is set but Choice Button Prefab is not: choices cannot be shown.");
            if (choiceButtonPrefab == null) problems.Add("No Choice Button Prefab: dialogues with choices will show nothing to pick (assign your choice button prefab).");
            if (choiceButtonPrefab != null && choiceButtonPrefab.gameObject.scene.IsValid() && choiceButtonPrefab.gameObject.activeInHierarchy)
                problems.Add("Choice Button Prefab is an active scene object; it is used as a template and will be hidden at runtime.");
            if (advanceButton == null) problems.Add("No Advance Button: players can only advance with keys or by calling OnAdvanceInput().");
        }

        // ---------------------------------------------------------------- lifecycle

        private void Awake()
        {
            CaptureDefaults();
            WireAdvanceButton();
            if (choiceButtonPrefab != null && choiceButtonPrefab.gameObject.scene.IsValid()) choiceButtonPrefab.gameObject.SetActive(false);
            var problems = new List<string>();
            if (bodyText == null) { problems.Add("Body Text is not assigned."); }
            foreach (var p in problems) Debug.LogError("DialogueUI: " + p, this);
            if (hideOnAwake) PanelRoot.SetActive(false);
        }

        private void CaptureDefaults()
        {
            if (defaultsCaptured) return;
            defaultsCaptured = true;
            if (nameText != null) defaultNameColor = nameText.color;
            if (bodyText != null) defaultBodyColor = bodyText.color;
            if (namePlateImage != null) defaultNamePlateSprite = namePlateImage.sprite;
        }

        private void WireAdvanceButton()
        {
            if (advanceButton == null) return;
            advanceButton.onClick.RemoveListener(OnAdvanceInput);
            advanceButton.onClick.AddListener(OnAdvanceInput);
        }

        private void Update()
        {
            if (!advanceWithKeys || !PanelRoot.activeInHierarchy) return;
            if (!waitingForAdvance && !lineAnimating) return;
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter)) OnAdvanceInput();
#endif
        }

        public override void SetPortraitResolverIfMissing(PortraitResolverBase resolver)
        {
            if (portraitResolver == null) portraitResolver = resolver;
        }

        // ---------------------------------------------------------------- DialogueViewBase

        public override void Show()
        {
            CaptureDefaults();
            PanelRoot.SetActive(true);
            ClearChoices();
            if (continueIndicator != null) continueIndicator.SetActive(false);
            onShown.Invoke();
        }

        public override void Hide()
        {
            StopTyping();
            waitingForAdvance = false;
            ClearChoices();
            if (continueIndicator != null) continueIndicator.SetActive(false);
            PanelRoot.SetActive(false);
            onHidden.Invoke();
        }

        public override void ShowLine(DialogueLine line)
        {
            CaptureDefaults();
            ClearChoices();
            ApplySpeaker(line);
            ApplyPortrait(line);

            if (bodyText != null)
            {
                bodyText.text = line.Text;
                bodyText.color = StyleFor(line)?.bodyColor ?? defaultBodyColor;
            }
            StopTyping();
            waitingForAdvance = false;
            if (continueIndicator != null) continueIndicator.SetActive(false);

            if (bodyText != null && charactersPerSecond > 0f && isActiveAndEnabled)
            {
                typing = StartCoroutine(TypeText());
            }
            else
            {
                if (bodyText != null) bodyText.maxVisibleCharacters = int.MaxValue;
                FinishLine();
            }
            onLineShown.Invoke();
        }

        public override void ShowChoices(IReadOnlyList<DialogueChoice> choices)
        {
            StopTyping();
            waitingForAdvance = false;
            if (continueIndicator != null) continueIndicator.SetActive(false);
            if (!keepLineVisibleDuringChoices && bodyText != null) bodyText.text = "";
            if (bodyText != null) bodyText.maxVisibleCharacters = int.MaxValue;

            if (choiceButtonPrefab == null || choiceContainer == null)
            {
                Debug.LogError("DialogueUI: cannot show choices; assign Choice Container and Choice Button Prefab.", this);
                return;
            }

            ClearChoices();
            for (int i = 0; i < choices.Count; i++)
            {
                int index = choices[i].Index;
                var button = GetChoiceButton(i);
                button.gameObject.SetActive(true);
                var view = button.GetComponent<ChoiceButtonView>();
                if (view != null) view.Setup(index, choices[i].Text);
                else SetLabel(button, choices[i].Text);
                button.onClick.RemoveAllListeners();
                button.onClick.AddListener(() => RequestChoice(index));
            }
            if (selectFirstChoice && choiceButtons.Count > 0 && EventSystem.current != null)
                EventSystem.current.SetSelectedGameObject(choiceButtons[0].gameObject);
            onChoicesShown.Invoke();
        }

        public override void ShowError(string message)
        {
            // Errors are logged by the runner. A custom UI could show a message here.
        }

        // ---------------------------------------------------------------- input

        /// <summary>Called by the advance button, Space/Enter, or your own input code.</summary>
        public override void OnAdvanceInput()
        {
            if (lineAnimating)
            {
                if (completeLineBeforeAdvancing) { CompleteLine(); return; }
            }
            if (waitingForAdvance || lineAnimating) RequestAdvance();
        }

        // ---------------------------------------------------------------- internals

        private SpeakerStyle StyleFor(DialogueLine line)
        {
            foreach (var s in speakerStyles)
            {
                if (s == null || string.IsNullOrEmpty(s.match)) continue;
                if (string.Equals(s.match, line.DisplayName, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(s.match, line.Speaker, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(s.match, line.PortraitId, StringComparison.OrdinalIgnoreCase)) return s;
            }
            return null;
        }

        private void ApplySpeaker(DialogueLine line)
        {
            bool hasName = !string.IsNullOrEmpty(line.DisplayName);
            if (namePlateRoot != null) namePlateRoot.SetActive(hasName);
            var style = StyleFor(line);
            if (nameText != null)
            {
                nameText.text = line.DisplayName;
                nameText.color = style?.nameColor ?? defaultNameColor;
            }
            if (namePlateImage != null) namePlateImage.sprite = style != null && style.namePlateSprite != null ? style.namePlateSprite : defaultNamePlateSprite;
        }

        private void ApplyPortrait(DialogueLine line)
        {
            if (portraitImage == null) return;
            Sprite sprite = null;
            bool found = portraitResolver != null && portraitResolver.TryResolve(line.PortraitId, line.Expression, out sprite) && sprite != null;
            if (found)
            {
                portraitImage.sprite = sprite;
                portraitImage.preserveAspect = preserveAspect;
                portraitImage.enabled = true;
                if (setNativeSize) portraitImage.SetNativeSize();
                if (portraitRoot != null) portraitRoot.SetActive(true);
            }
            else if (hidePortraitWhenMissing)
            {
                portraitImage.enabled = false;
                if (portraitRoot != null) portraitRoot.SetActive(false);
            }
        }

        private IEnumerator TypeText()
        {
            lineAnimating = true;
            bodyText.maxVisibleCharacters = 0;
            bodyText.ForceMeshUpdate();
            int total = bodyText.textInfo.characterCount;
            float shown = 0f;
            while (shown < total)
            {
                shown += charactersPerSecond * Time.unscaledDeltaTime;
                bodyText.maxVisibleCharacters = Mathf.Min(total, Mathf.FloorToInt(shown));
                yield return null;
            }
            typing = null;
            FinishLine();
        }

        private void CompleteLine()
        {
            StopTyping();
            if (bodyText != null) bodyText.maxVisibleCharacters = int.MaxValue;
            FinishLine();
        }

        private void FinishLine()
        {
            lineAnimating = false;
            waitingForAdvance = true;
            if (continueIndicator != null) continueIndicator.SetActive(true);
        }

        private void StopTyping()
        {
            if (typing != null) { StopCoroutine(typing); typing = null; }
            lineAnimating = false;
        }

        private Button GetChoiceButton(int i)
        {
            while (choiceButtons.Count <= i)
            {
                var b = Instantiate(choiceButtonPrefab, choiceContainer);
                b.gameObject.name = choiceButtonPrefab.gameObject.name + " " + (choiceButtons.Count + 1);
                choiceButtons.Add(b);
            }
            return choiceButtons[i];
        }

        private void ClearChoices()
        {
            foreach (var b in choiceButtons)
            {
                if (b == null) continue;
                b.onClick.RemoveAllListeners();
                b.gameObject.SetActive(false);
            }
        }

        private static void SetLabel(Button button, string text)
        {
            var tmp = button.GetComponentInChildren<TMP_Text>(true);
            if (tmp != null) { tmp.text = text; return; }
            var legacy = button.GetComponentInChildren<Text>(true);
            if (legacy != null) legacy.text = text;
        }
    }
}
