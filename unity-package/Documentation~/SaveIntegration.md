# Persistent variables and your save system

Dialogue variables come in two kinds (set per variable in the editor):

| | Global | Local |
|---|---|---|
| Lives in | your game's save data (through `IVariableStore`) | the running conversation |
| At conversation start | **never reset** | reset to the exported initial value |
| Exported "initial" means | *fallback only if the store has no value yet* | the starting value |

The package never writes a default into your save just because a dialogue read it: a global is only written when a Variable node changes it.

## The contract

```csharp
public interface IVariableStore
{
    bool TryGet(string name, out DialogueValue value);   // does the game have a value for this name?
    void Set(string name, DialogueValue value);           // a Variable node changed it
}
```
`DialogueValue` is an immutable int / bool / string (`DialogueValue.FromInt(5)`, `.Type`, `.IntValue`, `.BoolValue`, `.StringValue`).
If the store returns a value of the wrong type for a variable, the conversation stops with a readable error instead of corrupting data.

## Connect your existing save system

**Option A - derive from `VariableStoreBase`** (a MonoBehaviour you can assign in the Inspector):

```csharp
public class MySaveVariableStore : VariableStoreBase
{
    public override bool TryGet(string name, out DialogueValue value)
    {
        if (MySave.Current.Ints.TryGetValue(name, out var i)) { value = DialogueValue.FromInt(i); return true; }
        if (MySave.Current.Flags.TryGetValue(name, out var b)) { value = DialogueValue.FromBool(b); return true; }
        value = default; return false;
    }

    public override void Set(string name, DialogueValue value)
    {
        switch (value.Type)
        {
            case DialogueValueType.Int: MySave.Current.Ints[name] = value.IntValue; break;
            case DialogueValueType.Bool: MySave.Current.Flags[name] = value.BoolValue; break;
            default: MySave.Current.Strings[name] = value.StringValue; break;
        }
    }
}
```
Assign it to **Dialogue Manager > Variable Store**.

**Option B - no new class:** `new DelegateVariableStore(tryGet, set)` adapts two delegates; pass it to `new DialogueSession(graph, store, registry)` if you drive sessions yourself.

**Option C - map to existing variable names.** If your save uses different keys, translate in `TryGet`/`Set` (for example prefix `"dlg."`).

## Provided stores

* `InMemoryVariableStoreComponent` (default): in memory; **Seed Values** let you pretend the save already has values (handy for testing).
  `.Store.Snapshot()` / `.Store.Restore(...)` let you copy its contents into and out of your own save file.
* `JsonFileVariableStore`: writes a small JSON file under `Application.persistentDataPath` (`Save()`, `Load()`, `DeleteSave()`); a working example of persistence.

If no store is assigned, the runner uses an in-memory store that lives as long as the `DialogueRunner`, so globals still persist between conversations
during play (but not between sessions).

## Reading and writing variables from game code

```csharp
store.Set("reputation", DialogueValue.FromInt(3));   // your game changes a persistent value; the next conversation sees it
manager.Runner.Session.TryGetVariable("haggle", out var v);   // inspect a running conversation's local/global
```
