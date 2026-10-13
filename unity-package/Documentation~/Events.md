# Game events

An **Event node** in the editor has a name (`OpenShop`) and typed parameters (`shopId = "back_room"`). The package dispatches it to your C# code. The package
contains no game systems: events nobody handles only log a warning, and a handler that throws is contained (the conversation continues).

Standard names the editor offers: `OpenShop(shopId)`, `GiveItem(itemId, amount)`, `StartQuest(questId)`, `CompleteQuest(questId)`, `ChangeScene(sceneName)`,
`UnlockRecipe(recipeId)`. You can also type any custom name in the editor.

## 1. Attribute handlers with typed parameters (recommended)

```csharp
public class GameEvents : MonoBehaviour
{
    [DialogueEventHandler("GiveItem")]
    void GiveItem(string itemId, int amount = 1) => Inventory.Add(itemId, amount);

    [DialogueEventHandler("OpenShop")]
    void OpenShop(string shopId) => ShopUI.Open(shopId);

    [DialogueEventHandler("PlaySound")]
    void PlaySound(DialogueEventArgs args) => Audio.Play(args.GetString("clip"));   // or take the raw args
}
```
* Parameters are matched to the event's parameters **by name** (case-insensitive). Supported types: `string`, `int`, `bool`, `DialogueEventArgs`.
* A parameter with a default value (`int amount = 1`) is optional. A missing required parameter or one with the wrong type is reported as a warning and the
  handler is not called.
* Register: add the component to **EventDispatcher > Handler Objects**, or `dispatcher.RegisterHandlers(this)` in code.
* Private methods work. If you build with **IL2CPP and managed code stripping**, mark handler classes with `[UnityEngine.Scripting.Preserve]` (or add a link.xml entry) because they are found by reflection.

## 2. Code registration

```csharp
dispatcher.Register("OpenShop", args => ShopUI.Open(args.GetString("shopId")));
dispatcher.Unregister("OpenShop", handler);   // keep the delegate to unregister
```
`DialogueEventArgs`: `Name`, `Parameters`, `TryGetString/Int/Bool` (strictly typed), `GetString/GetInt/GetBool(key, fallback)`, `Has(key)`, `TryGetValue(key, out DialogueValue)`.

## 3. Inspector bindings

On the `EventDispatcher`, add a **Binding**: type the event name and wire a `UnityEvent<DialogueEventArgs>` to a method (for designers who do not write code).

## Notes

* Handlers run synchronously, in registration order, before the conversation continues. To wait for something (a shop UI closing), stop the dialogue or
  design the graph so the event is the last node before an End.
* A handler may call `manager.StopDialogue()` (for example `ChangeScene`): the rest of the graph is skipped and the end event reports no ending.
* Examples: `Samples~/GameEventsExample/ExampleGameEvents.cs` (GiveItem, OpenShop, UnlockRecipe, StartQuest, CompleteQuest, ChangeScene against minimal interfaces) and
  `Samples~/PotionCustomer/PotionShopEvents.cs`.
