# Witch Workshop Dialogue (Unity package)

Runs the dialogue graphs you build in the **Witch Workshop Dialogue & Event Graph Editor** (the web tool in this repository).
Export a graph with **Export for Unity** (Korean UI: *Unity 내보내기*), drop the `.dialogue.json` into Unity, and play it with your own UI.

* Branching dialogue, choices, conditions and variables (**global** = persistent game state, **local** = this conversation only)
* Game events (`GiveItem`, `OpenShop`, ...) dispatched to your C# handlers with typed parameters
* Character portraits with several expressions per character and graceful fallbacks
* **Presentation is separate from execution**: reuse your existing pixel-art panels, name plates, portraits and choice buttons
  by assigning them in the Inspector. The generated demo UI is an optional starting point.
* Unity 6 (6000.0+), C#, uGUI + TextMeshPro. No other dependencies.

> **Status:** the engine-independent core is covered by automated tests that run outside Unity (see
> [`Documentation~/TestingStatus.md`](Documentation~/TestingStatus.md)). The Unity-facing components (UI, MonoBehaviours, Editor
> menus) have **not been compiled or run in the Unity Editor yet**. Please read that page before relying on the package.

## Install

**From Git (Package Manager > + > Add package from git URL):**

```
https://github.com/narin-Oh/witch-workshop-dialogue-editor.git?path=/unity-package#claude/bold-feynman-1o3u3q
```
(Use your default branch or a tag instead of `#claude/bold-feynman-1o3u3q` once this is merged.)

**From disk (Package Manager > + > Add package from disk...):** choose `unity-package/package.json` in a clone of this repository.
For development you can also copy the `unity-package` folder into your project's `Packages/` folder as `com.witchworkshop.dialogue`.

TextMeshPro: on first use Unity asks to import *TMP Essential Resources*; accept (or Window > TextMeshPro > Import TMP Essential Resources).

## Five-minute demo

1. Package Manager > *Witch Workshop Dialogue* > **Samples** > import **Potion Customer demo**.
2. Empty GameObject > add **Witch Workshop > Samples > Potion Customer Demo**, assign `potion-customer.dialogue.json`, press Play.

Details: `Samples~/PotionCustomer/README.md`.

## Use it in your game

1. **GameObject > Witch Workshop > Dialogue Manager** adds the manager (runner, variable store, event dispatcher, portrait resolver).
2. **Connect your UI:** add `DialogueUI` to your dialogue panel and assign your name plate, text, portrait and choice-button prefab.
   Drag it into the manager's **View** field. See [`Documentation~/CustomUI.md`](Documentation~/CustomUI.md).
3. **Portraits:** create a *Portrait Set* per character (portrait ID + one sprite per expression) and add it to the resolver.
   See [`Documentation~/Portraits.md`](Documentation~/Portraits.md).
4. **Events:** mark game methods with `[DialogueEventHandler("OpenShop")]` or add Inspector bindings.
   See [`Documentation~/Events.md`](Documentation~/Events.md).
5. **Start a conversation:** put a `DialogueTrigger` on the NPC, assign the JSON, and call `Begin()` from your interaction code.
6. **Persistence:** connect your save system through `IVariableStore`. See [`Documentation~/SaveIntegration.md`](Documentation~/SaveIntegration.md).

Full walkthrough: [`Documentation~/Setup.md`](Documentation~/Setup.md).
한국어 초보자 가이드 (설치부터 Play까지 전체 흐름): [`Documentation~/GettingStarted_KO.md`](Documentation~/GettingStarted_KO.md).

## Architecture

```
 dialogue.json ──► DialogueLoader ──► DialogueGraph
                                          │
        ┌──────────────── Core (no UnityEngine) ───────────────┐
        │  DialogueSession  (state machine: lines, choices,    │
        │   conditions, variables, events, loop guards)        │
        │      │ uses IVariableStore      │ uses DialogueEventRegistry
        └──────┼──────────────────────────┼────────────────────┘
               ▼                          ▼
   VariableStoreBase (your save)    EventDispatcher (your game code)

 DialogueRunner (MonoBehaviour: owns the session, raises events)
        │  lines / choices / ended                ▲ Advance() / Choose(i)
        ▼                                         │
 DialogueManager ───────────────►  DialogueViewBase  ◄── DialogueUI (configurable) or your own view
                                          │ uses PortraitResolverBase ► CharacterPortraitResolver ► PortraitSet sprites
 DialogueTrigger (NPC / door / sign) ─► DialogueManager.StartDialogue(textAsset)
```

| Folder | Contents |
|---|---|
| `Runtime/Core` | Engine-independent logic (`WitchWorkshop.Dialogue.Core` assembly, no UnityEngine). Tested outside Unity. |
| `Runtime` | Unity components: loader, runner, manager, trigger, stores, event dispatcher, portraits |
| `Runtime/UI` | `DialogueViewBase`, `DialogueUI`, `ChoiceButtonView`, and `Defaults/` (optional generated UI + placeholder art) |
| `Runtime/InputSystem` | Optional Input System bridge (compiled only if that package is installed) |
| `Editor` | Menu items, inspectors, JSON validation |
| `Tests` | Unity Test Framework tests (EditMode core + PlayMode integration) |
| `Tests~` | Standalone .NET harnesses used to verify the core outside Unity (not imported by Unity) |
| `Samples~` | Potion Customer demo, game events example |
| `Documentation~` | Guides |

## Compatibility with the editor

The package follows the editor's runtime schema version 1 exactly. A generated golden test locks the C# data classes to the editor's real
export code, and replays playthroughs recorded from the editor's own preview runner. If the export format ever changes, the tests fail.
See [`Documentation~/Schema.md`](Documentation~/Schema.md).
