# Changelog

## Unreleased

* Dialogue display modes: Character Dialogue, Narration and Scene Transition Text (`displayMode` in the JSON, `DialogueLine.Mode` in code).
  Exports without `displayMode` still load and play as Character Dialogue; `schemaVersion` is unchanged.
* `DialogueUI`: narration hides the name plate and portrait; scene transition text hides the normal UI and shows a separate black overlay with centered text
  (new optional fields *Scene Overlay Root / Text / Advance Button* and *Normal Ui Root*). It advances through the normal input - there is no timer.
* `DefaultDialogueUIBuilder` now builds a `Dialogue UI` container (panel, choices and the scene text overlay as children).
* Not yet compiled or run in Unity (see `Documentation~/TestingStatus.md`).

## 0.1.0 - initial version

* Engine-independent core: `DialogueSession`, conditions, variable operations, event registry with typed parameter binding, portrait catalog, validator.
* Unity components: `DialogueLoader`, `DialogueRunner`, `DialogueManager`, `DialogueTrigger`, `EventDispatcher`, variable stores, portrait resolver and sets.
* `DialogueUI` (configurable uGUI/TextMeshPro view), `DialogueViewBase`, optional generated demo UI and placeholder art.
* Samples: Potion Customer demo, game events example (Apprentice Quest).
* Tests: core tests (run in Unity and in a standalone .NET harness), golden playthroughs recorded from the web editor, PlayMode integration tests.
* **Not yet verified in the Unity Editor.** See Documentation~/TestingStatus.md.
