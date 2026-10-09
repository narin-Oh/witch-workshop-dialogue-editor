# Setup guide

This guide wires the package into an existing scene using the Inspector. Nothing here modifies the package: your game-specific
UI, sprites and event handlers live in your own project.

## 0. Prerequisites

* Unity 6 (6000.0+). The package depends on `com.unity.ugui` (includes TextMeshPro); Package Manager installs it automatically.
* Import TMP Essential Resources when Unity offers it.
* A dialogue file exported from the web editor: **Export for Unity** gives `<name>.dialogue.json`. Put it anywhere under `Assets/`.
  Unity imports it as a *Text Asset*. (Select it, then Assets > Witch Workshop > Validate Dialogue JSON checks it.)

## 1. Add the Dialogue Manager

**GameObject > Witch Workshop > Dialogue Manager** creates one object with:

| Component | Role |
|---|---|
| `DialogueManager` | Connects execution to presentation. The only thing you talk to from game code. |
| `DialogueRunner` | Runs the conversation (no UI). |
| `InMemoryVariableStoreComponent` | Holds *global* (persistent) variables. Replace with your save system later. |
| `EventDispatcher` | Receives the editor's Event nodes. |
| `CharacterPortraitResolver` | Maps portrait IDs + expressions to your sprites. |

(`Dialogue Manager + Sample UI` additionally builds a plain demo UI as a starting point.) Only `DialogueManager` and its **View** are required;
the other components are optional and can be removed.

## 2. Connect your dialogue UI

Your existing panels stay as they are. Add **`DialogueUI`** to the root of your dialogue panel (or any object) and assign the parts.
Full field-by-field guide: [CustomUI.md](CustomUI.md). Then drag that `DialogueUI` into **Dialogue Manager > View**.

## 3. Assign character sprites and expressions

For each character: **Assets > Create > Witch Workshop > Dialogue > Portrait Set**. Set **Portrait Id** to the ID typed in the editor's
Dialogue node (for example `mira`), add one entry per expression (`neutral`, `happy`, `worried`, ...), then add the set to the
`CharacterPortraitResolver`. Details and fallbacks: [Portraits.md](Portraits.md).

## 4. Register game events

Choose any of: attribute handlers, code registration, or Inspector bindings. All three are described in [Events.md](Events.md). Example:

```csharp
public class ShopEvents : MonoBehaviour
{
    [DialogueEventHandler("OpenShop")]
    void OpenShop(string shopId) { /* your shop UI */ }

    [DialogueEventHandler("GiveItem")]
    void GiveItem(string itemId, int amount = 1) { /* your inventory */ }
}
```
Add the component to the `EventDispatcher > Handler Objects` list. No game system is required: unhandled events only log a warning.

## 5. Start a conversation from an NPC

Add **`DialogueTrigger`** to the NPC, assign the dialogue JSON under **Dialogue**, and call `Begin()` from your interaction code:

```csharp
public class Npc : MonoBehaviour
{
    [SerializeField] DialogueTrigger dialogue;

    // called by your existing "press E to talk" system
    public void Interact() { dialogue.Begin(); }
}
```
Other start modes: *On Start*, or *On Trigger Enter* (collider with the **Required Tag**, default `Player`). Tick **One Shot** for
once-only conversations. `onStarted` / `onFinished(ending)` UnityEvents let you freeze player input and react to the ending.

Without a trigger: `DialogueManager.Default.StartDialogue(textAsset);`

## 6. Global and local variables

* **Global** variables (e.g. `gold`, `reputation`, `knowsCoughRecipe`) are persistent game state. The dialogue only reads/writes them
  through the store; **starting a conversation never resets them**. If the store has no value yet, the default exported from the editor is used.
* **Local** variables (e.g. `haggle`) exist for one conversation and start from their exported initial value each time.

Connect your own save data: [SaveIntegration.md](SaveIntegration.md).

## 7. Check it works

* Select the dialogue JSON > Assets > Witch Workshop > Validate Dialogue JSON.
* Press Play, trigger the NPC. If something is missing the Console explains it (missing view, unregistered event, missing portrait, bad JSON).
* The `DialogueUI` inspector lists unassigned parts.

## Starting a conversation from code

```csharp
var manager = DialogueManager.Default;            // the manager in the scene
manager.DialogueEnded += ending => Debug.Log($"Ended: {ending}");   // ending name, or null if stopped
manager.StartDialogue(dialogueAsset);              // TextAsset, string JSON, or DialogueGraph
manager.StopDialogue();                            // e.g. the player walked away
```
