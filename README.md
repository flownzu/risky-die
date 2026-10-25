# Risky Die

Foundry VTT module (v14, also runs on v13): players can choose a **risky d20** for a roll. It has more ones and more twenties; the faces next to them are removed.

| "Count" setting | Faces | Chance of 1 / 20 |
|---|---|---|
| 2 (default) | 1, 1, 3 … 18, 20, 20 | 10% each |
| 3 | 1, 1, 1, 4 … 17, 20, 20, 20 | 15% each |
| 10 | ten 1s, ten 20s | 50% each |

The average always stays 10.5. The die is not better, just riskier.

The interface is available in English and German.

## Usage

- A **"Risky d20"** button appears above the player list (bottom left). One click arms it; the next d20 roll is risky. Afterwards it resets (can be turned off).
- A risky roll gets a note in the chat, so the table can see which die was used.
- An optional keybinding is available (Settings → Controls → "Arm / cancel risky d20").

### Availability (GM setting)

- **Only when the GM unlocks it** (default): the GM toggles access with the same button, for example for a specific scene. Shift+click lets the GM roll risky themselves.
- **Always**: players can choose it at any time.
- **Never**: the module is effectively off.

### Which rolls

By default only d20 tests of the dnd5e system: attacks, ability checks, skill checks and saving throws (checked against the source code of dnd5e 5.3 and 6.0, not yet tested in play). dnd5e detects critical hits and fumbles as usual.

Two restrictions keep the die from being too strong:

- **No advantage or disadvantage.** A roll with advantage or disadvantage (including Elven Accuracy and `2d20kh`) is rolled normally. The risky d20 stays armed for the next eligible roll, and the player gets a notification.
- **No rerolls.** Reroll modifiers such as Halfling Lucky (`r1=1`) are removed from a risky d20. A feat like the 2014 Lucky, where the player rolls another d20 by hand, cannot be prevented by the module; the chat note still shows the GM that the roll was risky. The 2024 Lucky grants advantage and is covered by the first rule.

If the "Only d20 tests" setting is turned off, the risky die applies to every d20, including `/r 1d20`.

## How it works

The die is rolled normally. The result is then mapped onto the risky faces: with count 2, a 2 becomes a 1 and a 19 becomes a 20. Since every face is equally likely, this is exactly the same as rolling the relabelled die. It also works for Dice So Nice and manually entered rolls. Dice So Nice shows the mapped result.

A small API is available for macros:

```js
const api = game.modules.get("risky-die").api;
api.arm();              // roll the next d20 risky
api.disarm();
api.toggle();
api.setUnlocked(true);  // GM only: set access
api.faceList(3);        // [1, 1, 1, 4, …, 17, 20, 20, 20]
```

## Installation

**Manifest URL:**

```
https://github.com/flownzu/risky-die/releases/latest/download/module.json
```

A release is created when a tag like `v0.1.0` is pushed (`git tag v0.1.0 && git push origin v0.1.0`), or when the "Release" workflow is started by hand under Actions on GitHub with a version. The `release.yml` workflow then builds `module.json` and `risky-die.zip` and creates the release.

**For testing without a release:** copy the folder to `Data/modules/risky-die/` and enable the module in the world.

## Development

```
npm test
```

The dice logic (`scripts/mapping.mjs`) and the patches (`scripts/core.mjs`) can be tested without Foundry. `scripts/main.mjs` connects them to settings, button and chat.

## Known limitations of the prototype

- The check whether a player may roll risky runs in the player's browser. That is enough for a table among friends; the chat note makes every risky roll visible.
- Access applies to all players together, not per character.
- Advantage is detected from the dice modifiers and the dnd5e roll option. Other systems that model advantage differently are not detected.
- Dice So Nice shows a normal d20 with the mapped result, not custom faces with two 20s.
