# Using your own dialogue UI (pixel-art panels, name plates, portraits, choice buttons)

The dialogue system never draws anything itself. A **view** receives "show this line / show these choices" and reports back "the player
pressed next" or "the player picked choice 2". Everything visual - sprites, 9-slice panels, fonts, animations - stays in **your** prefabs.
You assign your existing objects to a `DialogueUI` component; no package code is edited.

```
DialogueManager ──► DialogueViewBase  (abstract)
                         ├── DialogueUI   ← configure with your prefabs (this page)
                         └── YourView     ← or write a view from scratch (bottom of this page)
```

## Quick path: connect an existing panel

1. Open your dialogue panel prefab (or scene object).
2. **Add Component > Witch Workshop > Dialogue UI** to the panel root (any object works; the panel root is assigned separately).
3. Fill the fields (everything except *Body Text* is optional):

| Section / field | Assign this | Notes |
|---|---|---|
| **Panel Root** | The object to show/hide per conversation | Empty = the DialogueUI's own GameObject. Hidden at start (**Hide On Awake**) and when the conversation ends. |
| **Name Text** | Your speaker-name `TMP_Text` | Shows the editor's *speaker name override*, otherwise the speaker. |
| **Name Plate Root** | Your name-plate frame (the pixel-art ribbon/box) | Hidden automatically for lines without a speaker, and for Narration / Scene Transition Text lines. |
| **Name Plate Image** | The plate's `Image` | Only needed if you want per-speaker plate sprites (*Speaker Styles*). |
| **Body Text** | Your dialogue `TMP_Text` | **Required.** Rich-text tags work. |
| **Characters Per Second** | `0` = instant, e.g. `40` = typewriter | Pressing *next* while text is appearing completes the line first (**Complete Line Before Advancing**). |
| **Continue Indicator** | Your blinking "next" arrow | Shown when the line is complete and waiting. |
| **Portrait Image** / **Portrait Root** | The portrait `Image` and its frame | The frame is hidden when no sprite is found (**Hide Portrait When Missing**). |
| **Portrait Resolver** | Leave empty to use the manager's `CharacterPortraitResolver` | Or assign a different one for this UI. |
| **Preserve Aspect**, **Set Native Size** | Pixel art: tick *Set Native Size* to keep the sprite's pixel size | Use your portrait's import settings (Point filter, no compression) for crisp pixels. |
| **Choice Container** | The parent of the choice buttons (e.g. an object with a `Vertical Layout Group`) | |
| **Choice Button Prefab** | **Your** pixel-art button prefab | A `Button` with a TextMeshPro (or legacy `Text`) label somewhere inside. |
| **Advance Button** | A `Button` that means "next" | Often a full-screen transparent button behind the panel, or the dialogue box itself. |
| **Advance With Keys** | Space / Enter | Legacy Input Manager only; see "Input" below. |
| **Scene Overlay Root** / **Scene Overlay Text** / **Scene Advance Button** | A full-screen **black** object, its centered `TMP_Text`, and an optional full-screen `Button` | For *Scene Transition Text* lines (see "Display modes"). Optional, but without it such lines fall back to the normal panel. |
| **Normal Ui Root** | The object holding your normal dialogue UI | Hidden while scene text shows (see "Display modes" for the default). |
| **Speaker Styles** | Optional per-speaker colours and name-plate sprite | Matches display name, speaker or portrait ID, case-insensitive. |
| **Events** | `onShown`, `onHidden`, `onLineShown`, `onChoicesShown` | Hook audio, animations or screen shake. |

4. Select the **Dialogue Manager** and drag the `DialogueUI` into **View**.
5. Press Play. The `DialogueUI` inspector shows warnings for anything unassigned, and a button **Auto-assign empty fields from child names**
   fills obvious ones (children named *Name*, *Body/Text*, *Portrait*, *Choices*, *Next*...). It only fills empty fields.

### Display modes: Character Dialogue, Narration, Scene Transition Text

Each dialogue line carries a mode (`DialogueLine.Mode`: `Character`, `Narration`, `SceneTransition`) chosen in the web editor.
Exports from before the editor had this setting have no mode and play as `Character`.

| Mode | What `DialogueUI` does |
|---|---|
| `Character` | Name plate, portrait and text, exactly as before. |
| `Narration` | Text in your normal dialogue panel; the name plate is hidden and the portrait is hidden (an earlier line's portrait does not linger). `DisplayName`, `Speaker`, `PortraitId` and `Expression` are empty. |
| `SceneTransition` | Hides your **normal dialogue UI**, shows the **black overlay** with the centered text, and waits for the normal advance input. When the next line or the choices arrive (or the conversation ends) the overlay is hidden and your normal UI is restored. |

**Scene transition text is not a timed delay.** "10 minutes later..." is only text. The overlay stays until the player advances with the same input
as any other line: the **Scene Advance Button** (your normal Advance Button is hidden together with the panel), Space/Enter with the legacy Input Manager,
or `OnAdvanceInput()` from your own input code. Nothing in the package waits for time to pass.

Setting up the overlay in your own UI:

1. Add a full-screen `Image` (colour **black**, alpha 1) as an object that is **not inside** the part of your UI that gets hidden - for example a sibling of your dialogue panel under the same canvas, drawn on top. Put a centered `TMP_Text` inside it and optionally a full-screen `Button` (Transition: None).
2. Assign it to **Scene Overlay Root**, **Scene Overlay Text** and **Scene Advance Button**. Leave the overlay's own activation to the component (it is hidden at start).
3. Tell the component what to hide while the overlay shows:
   * **Normal Ui Root** assigned: that object is hidden (and restored later).
   * Otherwise, if **Panel Root** is a different object than the `DialogueUI`'s own GameObject: the Panel Root is hidden.
   * Otherwise (the generated demo UI uses this): the *direct children* of the `DialogueUI`'s GameObject that are active are hidden, except the overlay. In this mode the overlay must be a direct child. A graphic on the `DialogueUI`'s own GameObject (for example a panel `Image` on the same object) cannot be hidden this way; put your panel visuals in a child, or assign **Normal Ui Root**.
4. The inspector warns if the overlay would be hidden together with the normal UI, or if it is not assigned. **Auto-assign** also looks for a child named *Scene Text Overlay*.

`DefaultDialogueUIBuilder` already builds this layout (`Dialogue UI` container > `Dialogue Panel`, `Choices`, `Scene Text Overlay`).
For a custom view derived from `DialogueViewBase`, branch on `line.Mode` in `ShowLine` yourself.

> Verification status: the logic is covered by the .NET harness and by stub-based wiring tests; it has **not** been compiled or run inside Unity. See `TestingStatus.md`.

### Your choice button prefab

* Any `Button` prefab works. The text is set on the first `TMP_Text` found inside (or the first legacy `Text`).
* Need more (a number badge, an icon, a custom animation)? Add **`ChoiceButtonView`** to the prefab, assign its *Label* and optional *Number Label*,
  or derive from it and override `Setup(int index, string text)`.
* Buttons are created once and reused. The template you assign may be a prefab asset or an inactive scene object.
* Keyboard/gamepad: the first choice is selected automatically (**Select First Choice**), so your `EventSystem` navigation works with your button
  `Navigation` settings.

### Pixel-art tips

* **Fonts:** create a TMP Font Asset from your pixel font (Window > TextMeshPro > Font Asset Creator; *Atlas population: Static*, render mode
  *Raster* for crisp pixels, or a bitmap-style SDF). Assign it to your TMP texts in the prefab; the package does not set fonts.
* **Sprites:** set *Filter Mode: Point* and *Compression: None*. For the panel use a sliced `Image` in your prefab as usual.
* **Pixel perfect:** use your project's *Canvas Scaler* and *Pixel Perfect Camera* settings; the package does not touch the canvas.
* **Portraits:** tick **Set Native Size** so a 64x64 portrait stays 64x64 canvas units (and scale the whole canvas for your resolution).

### Input

* **Buttons** work with any input setup through uGUI's `EventSystem`.
* **Legacy Input Manager:** Space/Enter advance (toggle *Advance With Keys*).
* **New Input System:** add `InputSystemAdvanceInput` (appears when the Input System package is installed), assign the `DialogueUI` and an
  `InputActionReference`. Or bind any callback to `dialogueUI.OnAdvanceInput()` (for example a `PlayerInput` Unity event).

## Several UIs, or switching UIs

`DialogueManager` has one **View**. For a different look in different places (e.g. a bubble over an NPC vs a bottom panel) create several managers,
or switch the view at runtime with `manager.Setup(runner, otherView, ...)`.

## Writing a completely custom view

Derive from `DialogueViewBase`. A view receives plain data (`DialogueLine`, `DialogueChoice`) and calls `RequestAdvance()` / `RequestChoice(i)`.
It cannot affect variables, conditions or events, so presentation bugs can never corrupt conversation logic.

```csharp
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using WitchWorkshop.Dialogue;

public class PixelDialogueView : DialogueViewBase
{
    [SerializeField] GameObject root;
    [SerializeField] TMP_Text speaker, body;
    [SerializeField] Image face;
    [SerializeField] PortraitResolverBase portraits;      // optional
    [SerializeField] Button[] choiceButtons;               // e.g. 4 fixed pixel-art buttons
    [SerializeField] Button nextButton;

    void Awake() { nextButton.onClick.AddListener(() => RequestAdvance()); root.SetActive(false); }

    public override void Show() { root.SetActive(true); }
    public override void Hide() { root.SetActive(false); }

    public override void ShowLine(DialogueLine line)
    {
        foreach (var b in choiceButtons) b.gameObject.SetActive(false);
        // line.Mode: Character / Narration (no name, no portrait) / SceneTransition (e.g. show a black screen with centered text)
        speaker.text = line.DisplayName;
        body.text = line.Text;
        if (portraits != null && portraits.TryResolve(line.PortraitId, line.Expression, out var sprite)) face.sprite = sprite;
        face.enabled = face.sprite != null;
    }

    public override void ShowChoices(IReadOnlyList<DialogueChoice> choices)
    {
        for (int i = 0; i < choiceButtons.Length; i++)
        {
            bool used = i < choices.Count;
            choiceButtons[i].gameObject.SetActive(used);
            if (!used) continue;
            int index = choices[i].Index;
            choiceButtons[i].GetComponentInChildren<TMP_Text>().text = choices[i].Text;
            choiceButtons[i].onClick.RemoveAllListeners();
            choiceButtons[i].onClick.AddListener(() => RequestChoice(index));
        }
    }
}
```
Assign it to **Dialogue Manager > View**. Override `ShowError(string)` to display problems and `SetPortraitResolverIfMissing` to receive the manager's resolver.

## The generated demo UI

`GameObject > Witch Workshop > Dialogue Manager + Sample UI` and the sample demos use `DefaultDialogueUIBuilder`, which builds a plain panel with the same
`DialogueUI` component. It is only a starting point: read `Runtime/UI/Defaults/DefaultDialogueUIBuilder.cs` to see which parts get assigned, then do the same
with your art. Nothing depends on it; the whole `Runtime/UI/Defaults` folder can be deleted.
