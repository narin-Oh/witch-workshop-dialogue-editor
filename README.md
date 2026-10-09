# Witch Workshop — Dialogue & Event Graph Editor

A browser-based visual editor for branching dialogue and event graphs for the Unity game *Witch Workshop*.
Build conversations on a node canvas, manage variables, preview them without Unity, and export JSON that Unity can read with `JsonUtility`.
Everything runs locally in the browser — no backend.

**한국어 사용자라면:** UI는 기본적으로 한국어이며 [`docs/USER_GUIDE_KO.md`](docs/USER_GUIDE_KO.md)에 초보자용 사용 설명서와 단계별 튜토리얼이 있습니다. (The UI defaults to Korean; switch with the **한국어 | EN** toggle in the toolbar. A full Korean user guide with a hands-on tutorial lives in `docs/USER_GUIDE_KO.md`.)

**Stack:** React 18 · TypeScript (strict) · Vite · `@xyflow/react` (React Flow) · Zustand · Tailwind CSS · Vitest

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # run the unit tests
npm run build      # type-check + production build into dist/
```
Requires Node 18+ (developed on Node 22).

## Unity package

[`unity-package/`](unity-package/README.md) is a Unity 6 (UPM) package that **plays the exported dialogue**: runner, replaceable uGUI/TextMeshPro
dialogue UI (reuse your own pixel-art panels), portraits with expressions, global/local variables with save-system integration, typed game-event
handlers, an NPC trigger, samples and tests. It follows the exported schema exactly; a generated golden test suite replays playthroughs recorded
from this editor's preview runner on the C# engine.

* Install: Package Manager > *Add package from git URL* with `https://github.com/narin-Oh/witch-workshop-dialogue-editor.git?path=/unity-package`, or *Add package from disk* with `unity-package/package.json`.
* Docs: `unity-package/README.md`, `unity-package/Documentation~/` (setup, custom UI, portraits, events, save integration, schema).
* **Verification status:** the engine-independent core is tested outside Unity (`dotnet test unity-package/Tests~/DotnetHarness`, 85 tests); the Unity-facing code has **not** been compiled or run in the Unity Editor. See `unity-package/Documentation~/TestingStatus.md`.
* Maintenance scripts: `npm run export:unity-samples` regenerates the sample dialogues and golden test data from the editor code (a vitest check fails if they are stale); `npm run unity:meta` regenerates the package's `.meta` files.

## Using the editor

| Area | What it does |
|---|---|
| **Left sidebar** | *Notes*: add nodes (click, or drag onto the canvas). *Dialogues*: manage multiple graphs in the project. *Variables*: define global / local variables. |
| **Canvas** | Drag nodes, connect an output handle to a node's input, pan (drag background), zoom (wheel / controls), box-select with <kbd>Shift</kbd>+drag, multi-select with <kbd>Ctrl/⌘</kbd>-click. Each output holds one connection (a new one replaces it). New nodes appear to the right of the selected node (or at the center of the view) and are nudged down so they never overlap. |
| **Inspector (right)** | Edit the selected node. Validation issues for that node are listed at the top. |
| **Toolbar** | Undo/redo, New, Open, Samples, Save (project file), **Export for Unity**, **Preview**, and the **한국어 / EN** language switch. |
| **Bottom panel** | *Validation* (click an entry to jump to the node) and *Preview log* (dialogue, variable changes, events from the last preview run). |

### Node types
Start (mint) · Dialogue (lavender) · Choice (yellow, one output per choice) · Condition (blue, True/False) · Variable (peach) · Event (pink) · End (mauve).

### Variables: global vs local
* **Global** — persistent game state; integrates with Unity save data and is **never reset when a dialogue starts**. Its default is only a fallback.
* **Local** — exists for one dialogue session, starts at its initial value.
* In **Preview → Edit starting values** you can set any variable's starting value to test branches (preview-only; not exported).

### Shortcuts
<kbd>Ctrl/⌘</kbd>+<kbd>C</kbd> copy · <kbd>V</kbd> paste · <kbd>D</kbd> duplicate · <kbd>Z</kbd> undo · <kbd>Shift+Z</kbd>/<kbd>Y</kbd> redo · <kbd>S</kbd> save project · <kbd>Delete</kbd> remove selection · <kbd>Esc</kbd> close preview.
Shortcuts are ignored while typing in a field. The Start node cannot be copied (one per graph).
Undo is predictable: a drag is one step, rapid typing in one field is one step, each structural change is one step.

### Language (Korean / English)
Korean is the default. The toolbar toggle switches the whole interface (labels, tooltips, validation messages, preview, dialogs); the choice is remembered in `localStorage`.
Only **UI text** is translated. Node type ids, JSON property names, event names, variable names, ids, project files and the Unity export are identical in both languages (covered by tests), so existing files stay compatible. Your own dialogue text is never translated.

### Saving, loading, autosave
* **Save** downloads `<project>.witchproj.json` (the full editor project: all graphs, positions, variables, preview values). **Open** loads it; files are structurally validated and bad files are rejected with a message.
* **Autosave** writes to `localStorage` (debounced, and flushed when the tab is hidden/closed). After a refresh your last state is restored with a notice. If storage fails (full/blocked) a banner tells you to save to a file. A corrupt autosave is moved aside, not deleted.
* **Export for Unity** (Korean: Unity 내보내기) writes `<graph>.dialogue.json`. **Export is blocked while the graph has validation errors**, so invalid data can't be exported silently. Warnings (e.g. loops, unreachable nodes) ask for confirmation.

### Validation
Missing/duplicate Start, Start without exactly one valid outgoing link, broken links, unconnected outputs, unreachable nodes (warning), empty dialogue text, choices without text or links, invalid conditions (unknown variable, bad operator or value type, missing True/False), invalid variable operations, missing required event parameters (from the event catalog), duplicate/invalid variable names, loops (warning), no reachable End (warning).

## Sample content
Open **Samples** to load two complete conversations:
* **Potion Customer** — a customer asks for a potion. Multiple choices, conditions on global/local variables, variable changes (gold, reputation, haggling), `UnlockRecipe` and `OpenShop` events, 8 endings (the *Back Room Open* ending needs `reputation ≥ 3`; set it under *Edit starting values* in the preview).
* **Apprentice Quest** — `StartQuest`, `GiveItem`, `CompleteQuest`, `ChangeScene`, quest-state branching, 4 endings.
Unit tests verify both validate cleanly and that every ending is reachable in the preview runner.

## Architecture

```
src/
  model/       types.ts (editor model), runtime.ts (Unity schema), factory, ids, eventCatalog   — no React
  logic/       conditions, variables, values, graphUtils, graphEdit, history, validation, projectOps — pure, tested
  preview/     runner.ts — immutable state machine (start/advance/choose), loop guards
  io/          projectFile (save/load + validation), runtimeExport (editor → Unity), autosave, files (browser helpers)
  samples/     GraphBuilder DSL + the two sample conversations
  store/       editorStore.ts — Zustand store: project history (undo/redo), selection, clipboard, UI state
  components/  canvas/ (React Flow, node cards) · sidebar/ · inspector/ · preview/ · validation/ · toolbar/ · ui/ (primitives, motifs)
  i18n/        en.ts (key source of truth), ko.ts, translate.ts (pure), index.ts (language store + useT/getT)
  hooks/       useAutosave, useShortcuts
docs/UNITY_INTEGRATION.md   runtime schema + C# loader/runner sketch
```

Key decisions
* **Editor data ≠ runtime data.** `EditorProject` (saved files) holds positions, preview values and an editor-only Start node. `exportRuntime()` produces `RuntimeDialogue`: a flat node list with one fixed field set, typed values (`valueType`/`intValue`/`boolValue`/`stringValue`), no nulls, no polymorphism — deserializable by `JsonUtility`. The Start node is resolved: `startNodeId` is the first executable node.
* **Stable, collision-safe IDs.** Nodes, edges, choices, graphs, variables and params use full 128-bit UUIDs (`crypto.randomUUID`, with a `getRandomValues` fallback). Pasting remaps every id.
* **Output handles** (`next`, `true`/`false`, `choice:<id>`) are defined once in `logic/graphUtils.ts` and shared by the UI, validation, preview and export.
* **Pure logic, thin UI.** Everything testable lives outside React; the store only wires logic to history.
* **Localization without a framework.** `src/i18n/` holds two typed dictionaries (`en.ts` defines the keys, `ko.ts` must match them) and a ~30-line `translate()` with `{param}` interpolation. Logic modules stay language-independent: validation issues, preview-runner messages and file errors carry an i18n `key` + `params` (plus an English `message` for logs/tests) and the UI translates at display time, so switching language re-renders everything, including the existing validation list and preview log. Tests enforce identical keys/placeholders in both languages, that every `t('…')` key used in the source exists, and that no Korean text lives outside `src/i18n/`.
* **Theme tokens** are CSS variables in `src/index.css`, exposed to Tailwind; `theme.test.ts` checks WCAG AA contrast of the palette.

User manual (Korean): [`docs/USER_GUIDE_KO.md`](docs/USER_GUIDE_KO.md) · example project + export from its tutorial: `docs/examples/`.
Runtime JSON and C# integration: see [`docs/UNITY_INTEGRATION.md`](docs/UNITY_INTEGRATION.md).

## Tests
`npm test` runs Vitest (101 tests): conditions, variables, history (undo/redo/coalescing), graph editing (connect/copy/paste/delete), validation (every issue type), preview runner (branching, conditions, loops, invalid transitions), project file round-trip, autosave failure handling, runtime export schema contract, sample conversations (all endings reachable), the tutorial example from the user guide, i18n dictionaries/coverage/language persistence, backward compatibility with older project files, and theme contrast, Unity-package structure (manifest, assembly definitions, `.meta` files, sample/golden data sync) and documentation links.

## Known limitations
* One comparison per Condition node (chain nodes for AND/OR).
* No localization tables; dialogue text is a single string per node.
* Portraits are shown as placeholders in the preview (IDs only; no image assets).
* Autosave is per-browser `localStorage` (a single slot); use **Save** for backups.
* The C# in the docs is reference code and was not compiled against Unity in this repository.
* Layout is designed for desktop widths (≥ 1200px).
* The built-in sample conversations are written in English (they are sample *content*, not UI text).
* Toasts already on screen keep their language until dismissed.
