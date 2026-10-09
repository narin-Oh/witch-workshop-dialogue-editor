# Testing status - what is verified, and what still needs the Unity Editor

**No Unity Editor was available when this package was written.** Nothing that depends on `UnityEngine`, `UnityEditor`, uGUI or TextMeshPro has been compiled
by Unity or run in Unity. Everything below is split into what was actually executed in a sandbox and what is still unverified.

## Verified in the sandbox (executed, with results)

| What | How | Result when last run |
|---|---|---|
| Engine-independent core (`Runtime/Core`): session state machine, conditions, variables (global vs local, no reset), events with typed parameters, portrait lookup, validator, stores | `dotnet test unity-package/Tests~/DotnetHarness` (net8.0, C# 9, warnings as errors) running the **same NUnit test files** Unity's Test Runner will run (`Tests/Editor/Core`) | 85 / 85 passed |
| Parity with the web editor | Golden playthroughs recorded from the editor's preview runner for every ending of both sample dialogues, replayed on the C# engine; schema contract test against the editor's real export | included in the 85 |
| Sample data and golden files are in sync with the exporter | `npm test` (vitest `unityExport.test.ts`), `npm run export:unity-samples` | passed |
| Wiring logic of the Unity-facing components (runner, manager, trigger, DialogueUI, resolver, stores) | `dotnet test unity-package/Tests~/StubCheck`: the real source files compiled against a **hand-written stub of the Unity API** | 23 / 23 passed |
| Syntax and type consistency of all Runtime scripts and both samples | same stub build | compiles |
| Package structure (manifest valid, asmdef JSON valid, every file has a unique `.meta`) | `npm test` (vitest `unityPackage.test.ts`) | passed |

**Limits of the above:** the .NET harness deserializes with `System.Text.Json`, not `JsonUtility`. The stub project proves our files are consistent with *our understanding* of the
Unity API; it cannot detect a wrong signature, a renamed API, a missing assembly reference or different runtime behaviour. A pass there is **not** a Unity compile.

## Not verified - needs the Unity Editor (please run these)

| Area | What to check |
|---|---|
| **Compilation** | Import the package into a Unity 6 project: no compile errors in `WitchWorkshop.Dialogue`, `.Editor`, `.Tests.*`, `.InputSystem` (the latter only with the Input System package installed), or samples. Watch for assembly-reference names (`Unity.TextMeshPro`, `UnityEngine.UI`, `Unity.InputSystem`), obsolete-API warnings in TMP/uGUI 2.0, and `FindFirstObjectByType` availability. |
| **JsonUtility** | Window > General > Test Runner > EditMode > run **all** tests (core tests use real `JsonUtility`): checks the `@operator` field, nested arrays, and field initializers. Also run Assets > Witch Workshop > Validate Dialogue JSON on both sample JSON files. |
| **PlayMode tests** | Test Runner > PlayMode: `RuntimeIntegrationTests` (generated UI end to end, typewriter, portraits). |
| **Demos** | Import both samples; run Potion Customer demo and Quest Demo: UI appears, text/name/portrait show, choices work, events logged, endings reachable, global state persists between restarts. |
| **Your own UI** | Add `DialogueUI` to a real pixel-art panel; verify name plate hide/show, portrait Set Native Size, choice button prefab (including selection by keyboard/gamepad), per-speaker styles. |
| **Typewriter** | `Characters Per Second` > 0 with rich text; *next* completes the line then advances. |
| **Input** | Legacy Input Manager (Space/Enter), new Input System with `InputSystemAdvanceInput`, uGUI button clicks. Check the generated `EventSystem` uses the right input module. |
| **Editor tools** | GameObject > Witch Workshop > Dialogue Manager (+ Sample UI); `DialogueUI` and `DialogueManager` inspector buttons; Undo behaviour. |
| **Triggers** | `DialogueTrigger` in all start modes; 2D and 3D trigger enter; tag filter (an undefined tag throws in `CompareTag`). If your project disables the 2D Physics module the trigger script will not compile (remove `OnTriggerEnter2D`). |
| **Build targets** | IL2CPP with managed stripping: `[DialogueEventHandler]` classes are found by reflection and may need `[Preserve]`. Check one real build. |
| **Persistence** | `JsonFileVariableStore` on target platforms (file path, write permissions). |

## Minimal acceptance checklist (about 15 minutes)

1. Add the package (git URL or disk). Console has no errors.
2. Test Runner > EditMode > Run All: expect every test green.
3. Import *Potion Customer demo*; assign the JSON; Play; finish three different endings (use *Reputation +3* for the back room).
4. In a scratch scene: Dialogue Manager, your `DialogueUI`, a Portrait Set, a `DialogueTrigger` with a test JSON, an event handler logging a message.
5. Report any compile errors or red tests; the fixes are expected to be small (API signature or assembly-name adjustments).
