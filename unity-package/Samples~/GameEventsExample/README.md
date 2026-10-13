# Game events example (and the Apprentice Quest dialogue)

Shows how game code plugs into the dialogue system **without the dialogue package knowing anything about your game**.

* `ExampleGameEvents` handles every standard event the web editor offers: `GiveItem`, `OpenShop`, `UnlockRecipe`, `StartQuest`,
  `CompleteQuest`, `ChangeScene`. It talks to five tiny interfaces (`IInventory`, `IShopService`, ...). The demo defaults only log;
  replace them with your own systems.
* Handlers are plain methods with typed parameters matched by name, marked with `[DialogueEventHandler("EventName")]`.
* `QuestDemo` plays `apprentice-quest.dialogue.json` and shows the persistent quest state.

## Run it

1. Package Manager > Witch Workshop Dialogue > Samples > **Import** *Game events example*. Import TMP Essential Resources if asked.
2. Empty GameObject > add **Witch Workshop > Samples > Quest Demo**; assign `apprentice-quest.dialogue.json`; press Play.
3. Accept the quest ("Quest Accepted" ending, `StartQuest` event), click **Collect 5 moonpetals**, restart the conversation: the quest completes
   (`GiveItem`, `CompleteQuest`, `ChangeScene` events, 40 gold reward).

## Using the handlers in your own scene

Either call `dispatcher.RegisterHandlers(yourComponent)` from code, or drag the component into **Handler Objects** on the `EventDispatcher`.
Or skip attributes and register explicitly:

```csharp
dispatcher.Register("OpenShop", args => ShopUI.Open(args.GetString("shopId")));
```
