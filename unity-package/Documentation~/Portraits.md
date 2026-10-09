# Character portraits and expressions

The dialogue JSON carries two strings per line: **`portraitId`** (which character art) and **`expression`** (which face). The package turns them
into a `Sprite` through a **portrait resolver**. You supply the sprites; nothing is required to exist.

## Portrait Sets

**Assets > Create > Witch Workshop > Dialogue > Portrait Set** (one per character):

| Field | Meaning |
|---|---|
| **Portrait Id** | Exactly the ID typed in the editor's Dialogue node (case-insensitive), e.g. `mira`. |
| **Default Sprite** | Used when a line asks for an expression this set lacks (and there is no `neutral`). |
| **Expressions** | One entry per expression name (`neutral`, `happy`, `worried`, ...) with its sprite. |

Add the sets to **`CharacterPortraitResolver > Portrait Sets`** on the manager (or on any object, then assign it to the manager / DialogueUI).

## Lookup order and fallbacks

A missing image never breaks a conversation. For `portraitId` + `expression` the resolver tries:

1. the exact expression of that character
2. the resolver's **Default Expression** (`neutral`) for that character
3. the character's **Default Sprite**
4. the resolver's **Fallback Sprite** (shown for unknown characters)
5. nothing: `DialogueUI` hides the portrait (or keeps the previous one, see *Hide Portrait When Missing*)

A warning is logged once per missing combination (turn off with *Log Missing*), naming the character, the expression and which fallback was used,
so you can find missing art without playing every conversation.

## Custom resolvers (Addressables, atlases, Spine...)

Derive from `PortraitResolverBase` and implement `TryResolve(portraitId, expression, out Sprite)`; assign it to the manager's *Portrait Resolver*
or the `DialogueUI`'s. For non-sprite portraits (animated characters) write a custom `DialogueViewBase` that reads `line.PortraitId` / `line.Expression`.

## Tips

* Names are matched case-insensitively but must otherwise match the editor exactly.
* Keep expression names consistent across characters (`neutral`, `happy`, `sad`...) so the default-expression fallback works everywhere.
* Pixel art: import with *Filter Mode: Point*, *Compression: None*, and tick *Set Native Size* on the `DialogueUI`.
