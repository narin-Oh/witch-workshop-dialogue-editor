# Dialogue JSON schema (version 1)

The package reads exactly what the web editor's **Export for Unity** writes (source of truth: `src/model/runtime.ts` and `src/io/runtimeExport.ts` in this
repository). The C# classes are in `Runtime/Core/DialogueData.cs`; their field names are the JSON property names.

* `JsonUtility`-friendly: one `DialogueNodeData` class for all node types, **every field always present**, no `null`, no polymorphism, no dictionaries,
  no mixed-type values. Unused fields hold `""`, `0`, `false` or `[]`.
* The editor-only **Start node is not exported**: `startNodeId` is the first executable node.
* Only the variables the dialogue uses are listed. Nodes unreachable from Start are omitted.
* The editor refuses to export graphs that have validation errors. `DialogueValidator` re-checks anyway (hand-edited or corrupt files).

## Root (`DialogueData`)

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | int | Must be `1`. Other versions are rejected with a clear message. |
| `id`, `name` | string | The graph's id and display name. |
| `startNodeId` | string | First node to run. |
| `variables` | `DialogueVariableDef[]` | Variables used by this dialogue. |
| `nodes` | `DialogueNodeData[]` | All nodes. |

## Variables (`DialogueVariableDef`)

`name`, `scope` (`"global"` persistent / `"local"` per conversation), `valueType` (`"int"|"bool"|"string"`), `initial` (`DialogueTypedValue`).

## Typed values (`DialogueTypedValue`, and `DialogueEventParam` = same + `key`)

`valueType` says which field is meaningful: `intValue`, `boolValue` or `stringValue`; the other two hold defaults.

## Nodes (`DialogueNodeData`)

| `type` | Fields used | Behaviour |
|---|---|---|
| `dialogue` | `displayMode`, `speaker`, `displayName`, `text`, `portraitId`, `expression`, `next` | Show a line; `displayName` is the name to show (speaker override if set). `displayMode` says how (below). |
| `choice` | `choices[] {id, text, next}` | Show choices; continue at the picked choice's `next`. |
| `condition` | `variable`, `operator`, `compare`, `nextTrue`, `nextFalse` | `==` `!=` `>` `<` `>=` `<=`; bool and string support only `==` / `!=`. |
| `variable` | `variable`, `operation`, `operand`, `next` | `set`, `add`, `subtract` (add/subtract: int only; flags use `set`). |
| `event` | `eventName`, `eventParams[]`, `next` | Dispatch to registered handlers, then continue. |
| `end` | `endingName` | Finish; `endingName` is reported to your code. |

### Dialogue display mode (`displayMode`)

| Value | Meaning | `speaker` / `displayName` / `portraitId` / `expression` |
|---|---|---|
| `"character"` | Speaker name, portrait and text (the default). | exported as authored |
| `"narration"` | Text in the dialogue panel without a name or portrait. | exported as `""` |
| `"sceneTransition"` | Text centered on a black screen (e.g. "10 minutes later..."). Advances like any line - it is **not** a timed delay. | exported as `""` |

* Nodes that are not `dialogue` export `displayMode: ""`.
* **Older exports have no `displayMode`.** The C# field defaults to `"character"`, so they load and play as before, and an empty or unknown value is also treated as Character
  (`DialogueLine.ParseMode`). `schemaVersion` stays `1`: the field is an addition.
* `DialogueLine.Mode` (`Character`, `Narration`, `SceneTransition`) exposes it to views, and the session itself ignores any leftover speaker/portrait values in non-character lines.

`operator` is a C# keyword, so the field is declared `@operator`; its serialized name is still `operator`.

## Semantics implemented by the runtime (same as the editor's preview)

* Conditions and variable operations are type-checked; a mismatch stops the conversation with an error (never a crash).
* **Loop guards:** more than 200 consecutive non-interactive nodes (conditions/variables/events without a line or choice in between) or 5000 nodes in total
  stop the conversation with a `LoopDetected` error. Loops that wait for the player are fine.
* Global variables: read from the `IVariableStore`, falling back to `initial` when the store has no value; written to the store by variable nodes. Local variables
  start from `initial` each conversation.
* Missing links, unknown nodes/types and undefined variables stop the conversation with a descriptive `DialogueError` (`runner.Failed`, Console).

## Staying compatible

* `Tests/Editor/Core/Golden/schema.golden.json` is generated from the editor's real export; `SchemaContractTests` fail if the C# classes drift from it.
* `Tests/Editor/Core/Golden/*.golden.json` are playthroughs recorded from the editor's preview runner; `GoldenPlaythroughTests` replay them on the C# engine.
* Regenerate all of this from the repository root with `npm run export:unity-samples` (a vitest check fails if the committed files are stale).
