# Potion Customer demo

A customer visits the workshop and asks for a potion. This is the dialogue built in the web editor
(`potion-customer.dialogue.json`, exported with **Export for Unity**): multiple choices, conditions on global and local
variables, variable changes, `UnlockRecipe` / `OpenShop` events and eight endings.

## Run it (about a minute)

1. In **Window > Package Manager > Witch Workshop Dialogue > Samples**, click **Import** next to *Potion Customer demo*.
2. The first time you use TextMeshPro, Unity asks to import **TMP Essential Resources**. Accept (Window > TextMeshPro > Import TMP Essential Resources).
3. Create an empty GameObject in an empty scene and add **Witch Workshop > Samples > Potion Customer Demo**.
4. Drag `potion-customer.dialogue.json` into the **Dialogue** field.
5. Press **Play**.

The demo generates a basic UI and placeholder portraits (coloured faces whose mouth changes with the expression), so you do not need any artwork.

## Things to try

* Pick *"Do you have anything... stronger?"* : with reputation 0 the customer is declined. Click **Reputation +3** in the corner panel, then **Restart conversation**: the back room opens (`OpenShop` event).
* Choose *"A cough remedy"*, then *"Pay 50 gold"*: `gold` drops by 50 in the persistent state and `UnlockRecipe` fires. The recipe flag stays set for the next conversation, because **global variables are never reset when a dialogue starts**.
* Choose *"Let her haggle"* twice: the *local* variable `haggle` counts up during the conversation and is forgotten afterwards.

## Using your own UI

Assign your `DialogueUI` to **Custom Ui** on the demo component, or follow `Documentation~/CustomUI.md` to wire your pixel-art panels in a real scene.
