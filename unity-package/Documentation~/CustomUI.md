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
| **Name Plate Root** | Your name-plate frame (the pixel-art ribbon/box) | Hidden automatically for lines without a speaker (narration). |
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
| **Speaker Styles** | Optional per-speaker colours and name-plate sprite | Matches display name, speaker or portrait ID, case-insensitive. |
| **Events** | `onShown`, `onHidden`, `onLineShown`, `onChoicesShown` | Hook audio, animations or screen shake. |

4. Select the **Dialogue Manager** and drag the `DialogueUI` into **View**.
5. Press Play. The `DialogueUI` inspector shows warnings for anything unassigned, and a button **Auto-assign empty fields from child names**
   fills obvious ones (children named *Name*, *Body/Text*, *Portrait*, *Choices*, *Next*...). It only fills empty fields.

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
