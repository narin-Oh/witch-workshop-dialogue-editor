# Unity Integration Guide

The editor exports **runtime dialogue JSON** (schema version 1) that Unity can read with `UnityEngine.JsonUtility`.
Editor-only data (node positions, selection, Start node, preview values) is **not** in this file.

> The C# below is reference code for you to adapt. It could not be compiled in this repository (Unity is not
> installed here). It uses only `JsonUtility`-compatible types.

## 1. Export format

Exported via **Export Unity JSON** in the toolbar (one file per dialogue graph, `<name>.dialogue.json`).
Export is **blocked** while the graph has validation errors; warnings can be confirmed. Nodes unreachable from Start are omitted.

```jsonc
{
  "schemaVersion": 1,
  "id": "g_…",                // graph id (stable)
  "name": "Potion Customer",
  "startNodeId": "n_…",       // first EXECUTABLE node (the editor-only Start node is resolved away)
  "variables": [ /* only the variables this dialogue uses */ ],
  "nodes":     [ /* flat list; every node has the same fields */ ]
}
```

### JsonUtility-safe design rules
* One `DialogueNode` class with a `type` string; **every** field is always present. Unused fields hold `""`, `0`, `false`, `[]`.
* No `null`, no polymorphism, no `Dictionary`, no mixed-type values. Enums are strings.
* Typed values use an explicit struct: read the field matching `valueType` (`"int"`, `"bool"`, `"string"`).
* Links (`next`, `nextTrue`, `nextFalse`, `choices[].next`) are node ids. They are never empty on nodes that need them (validated before export).

### Variables
| field | meaning |
|---|---|
| `name` | Unique name used by nodes. |
| `scope` | `"global"`: persistent game state (save data). **Starting a dialogue never resets it.** `"local"`: exists for one dialogue session only. |
| `valueType` | `"int"` \| `"bool"` \| `"string"` |
| `initial` | Local: the starting value. Global: **fallback** only when your game store has no value for that name yet. |

### Node types (`type`)
| type | fields used | behavior |
|---|---|---|
| `dialogue` | `speaker`, `displayName`, `text`, `portraitId`, `expression`, `next` | Show a line (`displayName` = override if set, else `speaker`), wait for input, go to `next`. |
| `choice` | `choices[] { id, text, next }` | Show options; go to the picked choice's `next`. |
| `condition` | `variable`, `operator`, `compare`, `nextTrue`, `nextFalse` | Evaluate `variable <operator> compare`. Operators: `==` `!=` `>` `<` `>=` `<=` (`bool`/`string` support only `==`/`!=`). |
| `variable` | `variable`, `operation`, `operand`, `next` | `operation`: `set`, `add`, `subtract` (`add`/`subtract` are int only). Boolean flags use `set`. |
| `event` | `eventName`, `eventParams[]`, `next` | Raise a named game event (see §3), then go to `next`. |
| `end` | `endingName` | Finish the dialogue. |

Known event names from the editor catalog: `OpenShop(shopId)`, `GiveItem(itemId, amount)`, `StartQuest(questId)`,
`CompleteQuest(questId)`, `ChangeScene(sceneName)`, `UnlockRecipe(recipeId)`. Custom names are allowed.

## 2. C# data classes

```csharp
using System;

[Serializable] public class TypedValue {
    public string valueType;   // "int" | "bool" | "string"
    public int intValue;
    public bool boolValue;
    public string stringValue;
}
[Serializable] public class EventParam {
    public string key;
    public string valueType;
    public int intValue;
    public bool boolValue;
    public string stringValue;
}
[Serializable] public class DialogueVariable {
    public string name;
    public string scope;       // "global" | "local"
    public string valueType;
    public TypedValue initial;
}
[Serializable] public class DialogueChoice { public string id; public string text; public string next; }
[Serializable] public class DialogueNode {
    public string id;
    public string type;        // dialogue | choice | condition | variable | event | end
    public string speaker, displayName, text, portraitId, expression;
    public DialogueChoice[] choices;
    public string variable, @operator;
    public TypedValue compare;
    public string nextTrue, nextFalse;
    public string operation;
    public TypedValue operand;
    public string eventName;
    public EventParam[] eventParams;
    public string next;
    public string endingName;
}
[Serializable] public class DialogueData {
    public int schemaVersion;
    public string id, name, startNodeId;
    public DialogueVariable[] variables;
    public DialogueNode[] nodes;
}
```

> `operator` is a C# keyword; `@operator` maps to the JSON key `operator`. If your Unity version has trouble with it,
> keep the verbatim identifier or post-process the JSON.

Load it:

```csharp
var data = JsonUtility.FromJson<DialogueData>(textAsset.text);
if (data.schemaVersion != 1) throw new Exception("Unsupported dialogue schema");
```

## 3. Runner sketch with events and persistent variables

```csharp
using System;
using System.Collections.Generic;

/// Backed by your save system. Global variables live here and survive across dialogues.
public interface IGlobalVariableStore {
    bool TryGet(string name, out TypedValue value);
    void Set(string name, TypedValue value);
}

/// Extensible event bus: game scripts register handlers by event name.
public static class DialogueEvents {
    static readonly Dictionary<string, Action<EventParam[]>> handlers = new();
    public static void Register(string name, Action<EventParam[]> h) =>
        handlers[name] = handlers.TryGetValue(name, out var existing) ? existing + h : h;
    public static void Raise(string name, EventParam[] p) {
        if (handlers.TryGetValue(name, out var h)) h(p);
        else UnityEngine.Debug.LogWarning($"No handler registered for dialogue event '{name}'");
    }
}

public class DialogueRunner {
    readonly DialogueData data;
    readonly Dictionary<string, DialogueNode> nodes = new();
    readonly Dictionary<string, DialogueVariable> defs = new();
    readonly Dictionary<string, TypedValue> locals = new();
    readonly IGlobalVariableStore globals;
    DialogueNode current;

    public event Action<DialogueNode> OnLine;       // show dialogue.displayName / text / portraitId / expression
    public event Action<DialogueChoice[]> OnChoices;
    public event Action<string> OnEnd;               // endingName

    public DialogueRunner(DialogueData data, IGlobalVariableStore globals) {
        this.data = data; this.globals = globals;
        foreach (var n in data.nodes) nodes[n.id] = n;
        foreach (var v in data.variables) {
            defs[v.name] = v;
            if (v.scope == "local") locals[v.name] = v.initial;   // globals are NOT reset
        }
    }

    public void Start() => Run(data.startNodeId);
    public void Advance() { if (current?.type == "dialogue") Run(current.next); }
    public void Choose(int index) { if (current?.type == "choice") Run(current.choices[index].next); }

    void Run(string id) {
        for (int guard = 0; guard < 1000; guard++) {            // protect against runaway loops
            current = nodes[id];
            switch (current.type) {
                case "dialogue": OnLine?.Invoke(current); return;
                case "choice":   OnChoices?.Invoke(current.choices); return;
                case "condition":
                    id = Compare(Get(current.variable), current.@operator, current.compare) ? current.nextTrue : current.nextFalse;
                    break;
                case "variable": Apply(current); id = current.next; break;
                case "event":    DialogueEvents.Raise(current.eventName, current.eventParams); id = current.next; break;
                case "end":      OnEnd?.Invoke(current.endingName); return;
                default: throw new Exception($"Unknown node type {current.type}");
            }
        }
        throw new Exception("Dialogue loop did not reach a line, choice or end");
    }

    TypedValue Get(string name) {
        var d = defs[name];
        if (d.scope == "local") return locals[name];
        return globals.TryGet(name, out var v) ? v : d.initial;   // fallback to the editor default
    }
    void Set(string name, TypedValue v) {
        if (defs[name].scope == "local") locals[name] = v; else globals.Set(name, v);
    }

    static bool Compare(TypedValue a, string op, TypedValue b) {
        switch (a.valueType) {
            case "int":
                return op switch { "==" => a.intValue == b.intValue, "!=" => a.intValue != b.intValue, ">" => a.intValue > b.intValue,
                                   "<" => a.intValue < b.intValue, ">=" => a.intValue >= b.intValue, "<=" => a.intValue <= b.intValue,
                                   _ => throw new Exception("bad operator " + op) };
            case "bool":   return op == "==" ? a.boolValue == b.boolValue : a.boolValue != b.boolValue;
            default:       return op == "==" ? a.stringValue == b.stringValue : a.stringValue != b.stringValue;
        }
    }

    void Apply(DialogueNode n) {
        var cur = Get(n.variable);
        var next = new TypedValue { valueType = cur.valueType, intValue = cur.intValue, boolValue = cur.boolValue, stringValue = cur.stringValue };
        switch (n.operation) {
            case "set":      next.intValue = n.operand.intValue; next.boolValue = n.operand.boolValue; next.stringValue = n.operand.stringValue; break;
            case "add":      next.intValue += n.operand.intValue; break;
            case "subtract": next.intValue -= n.operand.intValue; break;
        }
        Set(n.variable, next);
    }
}
```

Register game handlers once at startup:

```csharp
DialogueEvents.Register("OpenShop", p => ShopUI.Open(Param(p, "shopId")));
DialogueEvents.Register("UnlockRecipe", p => RecipeBook.Unlock(Param(p, "recipeId")));
// static string Param(EventParam[] ps, string key) => Array.Find(ps, x => x.key == key)?.stringValue;
```

## 4. Compatibility notes
* The editor's own preview (`src/preview/runner.ts`) implements the same semantics, including the loop guard, so a conversation that previews correctly should behave the same in Unity.
* Node and choice ids are full UUID-based strings and stay stable across re-exports of the same graph.
* A future schema change will bump `schemaVersion`; check it on load.
