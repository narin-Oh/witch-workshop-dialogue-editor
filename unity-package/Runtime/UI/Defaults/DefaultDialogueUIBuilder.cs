using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// OPTIONAL starting point: builds a plain, readable dialogue UI (dark panel, name plate, portrait, text, choice buttons)
    /// from code, wired to a <see cref="DialogueUI"/>. Use it for prototypes and to see which parts to assign when you
    /// connect your own pixel-art panel. Nothing in the dialogue system depends on it; delete this folder if you do not need it.
    /// Requires TextMeshPro's default font (Window &gt; TextMeshPro &gt; Import TMP Essential Resources).
    /// </summary>
    public static class DefaultDialogueUIBuilder
    {
        public sealed class Result
        {
            public Canvas Canvas;
            public DialogueUI UI;
        }

        /// <summary>Creates a screen-space canvas with the UI. If <paramref name="parent"/> is given the canvas is parented to it.</summary>
        public static Result Build(Transform parent = null, bool ensureEventSystem = true)
        {
            var canvasGo = new GameObject("Dialogue Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            if (parent != null) canvasGo.transform.SetParent(parent, false);
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 100;
            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280, 720);
            scaler.matchWidthOrHeight = 0.5f;

            // full-screen container that holds the DialogueUI component: the panel, the choices and the scene-text overlay are its
            // children, so scene transition text can hide the normal UI (the panel + choices) and show the black overlay on top.
            var container = Rect("Dialogue UI", canvasGo.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            container.offsetMin = Vector2.zero;
            container.offsetMax = Vector2.zero;

            // panel: bottom strip, full width
            var panel = Rect("Dialogue Panel", container, new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 0), new Vector2(0, 210));
            panel.pivot = new Vector2(0.5f, 0f);
            panel.offsetMin = new Vector2(40, 24);
            panel.offsetMax = new Vector2(-40, 234);
            var panelImage = panel.gameObject.AddComponent<Image>();
            panelImage.color = new Color(0.13f, 0.1f, 0.2f, 0.94f);

            // full-panel invisible button: click anywhere on the panel to advance
            var advance = panel.gameObject.AddComponent<Button>();
            advance.transition = Selectable.Transition.None;

            // portrait (left, overlapping the panel's top)
            var portraitFrame = Rect("Portrait", panel, new Vector2(0, 0), new Vector2(0, 1), Vector2.zero, Vector2.zero);
            portraitFrame.pivot = new Vector2(0f, 0.5f);
            portraitFrame.offsetMin = new Vector2(16, 16);
            portraitFrame.offsetMax = new Vector2(176, -16);
            var portraitImage = portraitFrame.gameObject.AddComponent<Image>();
            portraitImage.preserveAspect = true;
            portraitImage.raycastTarget = false;

            // name plate (above the text, left)
            var plate = Rect("Name Plate", panel, new Vector2(0, 1), new Vector2(0, 1), new Vector2(190, 22), new Vector2(260, 40));
            plate.pivot = new Vector2(0f, 0f);
            plate.anchoredPosition = new Vector2(190, -6);
            var plateImage = plate.gameObject.AddComponent<Image>();
            plateImage.color = new Color(0.56f, 0.46f, 0.78f, 1f);
            plateImage.raycastTarget = false;
            var nameText = Text("Name", plate, 24, FontStyles.Bold, TextAlignmentOptions.Center);
            Stretch(nameText.rectTransform, 8, 2, 8, 2);
            nameText.color = Color.white;

            // body text
            var bodyText = Text("Body", panel, 26, FontStyles.Normal, TextAlignmentOptions.TopLeft);
            bodyText.rectTransform.anchorMin = Vector2.zero;
            bodyText.rectTransform.anchorMax = Vector2.one;
            bodyText.rectTransform.offsetMin = new Vector2(192, 20);
            bodyText.rectTransform.offsetMax = new Vector2(-24, -34);
            bodyText.color = new Color(0.97f, 0.94f, 0.88f, 1f);

            // continue indicator
            var indicator = Text("Continue", panel, 28, FontStyles.Normal, TextAlignmentOptions.BottomRight);
            Stretch(indicator.rectTransform, 0, 8, 20, 8);
            indicator.text = "▼";
            indicator.color = new Color(0.97f, 0.89f, 0.66f, 1f);
            indicator.raycastTarget = false;

            // choices: stacked above the panel
            var choices = Rect("Choices", container, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 250), new Vector2(760, 0));
            choices.pivot = new Vector2(0.5f, 0f);
            var layout = choices.gameObject.AddComponent<VerticalLayoutGroup>();
            layout.spacing = 10;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            var fitter = choices.gameObject.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            // choice button template (inactive, kept under the choices container and cloned per choice)
            var buttonPrefab = BuildChoiceButtonTemplate(choices);

            // view
            var ui = container.gameObject.AddComponent<DialogueUI>();
            ui.Configure(nameText, bodyText, portraitImage, choices, buttonPrefab, advance, plate.gameObject, indicator.gameObject);

            // scene transition text: opaque black, centered text, click anywhere to advance (last child = drawn on top)
            var overlay = Rect("Scene Text Overlay", container, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            overlay.offsetMin = Vector2.zero;
            overlay.offsetMax = Vector2.zero;
            var overlayImage = overlay.gameObject.AddComponent<Image>();
            overlayImage.color = Color.black;
            var overlayButton = overlay.gameObject.AddComponent<Button>();
            overlayButton.transition = Selectable.Transition.None;
            var sceneText = Text("Scene Text", overlay, 40, FontStyles.Normal, TextAlignmentOptions.Center);
            Stretch(sceneText.rectTransform, 80, 80, 80, 80);
            sceneText.color = Color.white;
            overlay.gameObject.SetActive(false);
            ui.ConfigureSceneText(overlay.gameObject, sceneText, overlayButton);

            if (ensureEventSystem) EnsureEventSystem();
            return new Result { Canvas = canvas, UI = ui };
        }

        private static Button BuildChoiceButtonTemplate(RectTransform parent)
        {
            var rt = Rect("Choice Button", parent, Vector2.zero, Vector2.one, Vector2.zero, new Vector2(0, 56));
            var image = rt.gameObject.AddComponent<Image>();
            image.color = new Color(0.98f, 0.92f, 0.66f, 0.97f);
            var button = rt.gameObject.AddComponent<Button>();
            var colors = button.colors;
            colors.highlightedColor = new Color(1f, 0.97f, 0.8f, 1f);
            colors.selectedColor = new Color(1f, 0.97f, 0.8f, 1f);
            colors.pressedColor = new Color(0.9f, 0.82f, 0.5f, 1f);
            button.colors = colors;
            var le = rt.gameObject.AddComponent<LayoutElement>();
            le.minHeight = 56;
            le.preferredHeight = 56;
            var label = Text("Label", rt, 24, FontStyles.Normal, TextAlignmentOptions.Center);
            Stretch(label.rectTransform, 16, 4, 16, 4);
            label.color = new Color(0.22f, 0.16f, 0.3f, 1f);
            label.raycastTarget = false;
            rt.gameObject.AddComponent<ChoiceButtonView>();
            rt.gameObject.SetActive(false);
            return button;
        }

        private static RectTransform Rect(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPosition, Vector2 sizeDelta)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.anchoredPosition = anchoredPosition;
            rt.sizeDelta = sizeDelta;
            return rt;
        }

        private static void Stretch(RectTransform rt, float left, float bottom, float right, float top)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(left, bottom);
            rt.offsetMax = new Vector2(-right, -top);
        }

        private static TextMeshProUGUI Text(string name, Transform parent, float size, FontStyles style, TextAlignmentOptions alignment)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer));
            go.transform.SetParent(parent, false);
            var t = go.AddComponent<TextMeshProUGUI>();
            t.fontSize = size;
            t.fontStyle = style;
            t.alignment = alignment;
            t.raycastTarget = false;
            return t;
        }

        private static void EnsureEventSystem()
        {
            if (Object.FindFirstObjectByType<EventSystem>() != null) return;
            var go = new GameObject("EventSystem", typeof(EventSystem));
            // Use the new Input System's UI module when that package is installed, otherwise the classic one.
            var inputSystemModule = System.Type.GetType("UnityEngine.InputSystem.UI.InputSystemUIInputModule, Unity.InputSystem");
            go.AddComponent(inputSystemModule != null ? inputSystemModule : typeof(StandaloneInputModule));
        }
    }
}
