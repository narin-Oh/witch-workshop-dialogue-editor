# Witch Workshop — Dialogue & Event Graph Editor

A browser-based visual editor for branching dialogue and event graphs for the Unity game *Witch Workshop*.
Build conversations on a node canvas, manage variables, preview them without Unity, and export JSON that Unity can read with `JsonUtility`.
Everything runs locally in the browser — no backend.

**Stack:** React 18 · TypeScript (strict) · Vite · `@xyflow/react` (React Flow) · Zustand · Tailwind CSS · Vitest

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # run the unit tests
npm run build      # type-check + production build into dist/
```
Requires Node 18+ (developed on Node 22).

## Using the editor

| Area | What it does |
|---|---|
| **Left sidebar** | *Notes*: add nodes (click, or drag onto the canvas). *Dialogues*: manage multiple graphs in the project. *Variables*: define global / local variables. |
| **Canvas** | Drag nodes, connect an output handle to a node's input, pan (drag background), zoom (wheel / controls), box-select with <kbd>Shift</kbd>+drag, multi-select with <kbd>Ctrl/⌘</kbd>-click. Each output holds one connection (a new one replaces it). |
| **Inspector (right)** | Edit the selected node. Validation issues for that node are listed at the top. |
| **Toolbar** | Undo/redo, New, Open, Samples, Save (project file), **Export Unity JSON**, **Preview**. |
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

### Saving, loading, autosave
* **Save** downloads `<project>.witchproj.json` (the full editor project: all graphs, positions, variables, preview values). **Open** loads it; files are structurally validated and bad files are rejected with a message.
* **Autosave** writes to `localStorage` (debounced, and flushed when the tab is hidden/closed). After a refresh your last state is restored with a notice. If storage fails (full/blocked) a banner tells you to save to a file. A corrupt autosave is moved aside, not deleted.
* **Export Unity JSON** writes `<graph>.dialogue.json`. **Export is blocked while the graph has validation errors**, so invalid data can't be exported silently. Warnings (e.g. loops, unreachable nodes) ask for confirmation.

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
  hooks/       useAutosave, useShortcuts
docs/UNITY_INTEGRATION.md   runtime schema + C# loader/runner sketch
```

Key decisions
* **Editor data ≠ runtime data.** `EditorProject` (saved files) holds positions, preview values and an editor-only Start node. `exportRuntime()` produces `RuntimeDialogue`: a flat node list with one fixed field set, typed values (`valueType`/`intValue`/`boolValue`/`stringValue`), no nulls, no polymorphism — deserializable by `JsonUtility`. The Start node is resolved: `startNodeId` is the first executable node.
* **Stable, collision-safe IDs.** Nodes, edges, choices, graphs, variables and params use full 128-bit UUIDs (`crypto.randomUUID`, with a `getRandomValues` fallback). Pasting remaps every id.
* **Output handles** (`next`, `true`/`false`, `choice:<id>`) are defined once in `logic/graphUtils.ts` and shared by the UI, validation, preview and export.
* **Pure logic, thin UI.** Everything testable lives outside React; the store only wires logic to history.
* **Theme tokens** are CSS variables in `src/index.css`, exposed to Tailwind; `theme.test.ts` checks WCAG AA contrast of the palette.

Runtime JSON and C# integration: see [`docs/UNITY_INTEGRATION.md`](docs/UNITY_INTEGRATION.md).

## Tests
`npm test` runs Vitest: conditions, variables, history (undo/redo/coalescing), graph editing (connect/copy/paste/delete), validation (every issue type), preview runner (branching, conditions, loops, invalid transitions), project file round-trip, autosave failure handling, runtime export schema contract, sample conversations (all endings reachable), and theme contrast.

## Known limitations
* One comparison per Condition node (chain nodes for AND/OR).
* No localization tables; dialogue text is a single string per node.
* Portraits are shown as placeholders in the preview (IDs only; no image assets).
* Autosave is per-browser `localStorage` (a single slot); use **Save** for backups.
* The C# in the docs is reference code and was not compiled against Unity in this repository.
* Layout is designed for desktop widths (≥ 1200px).
