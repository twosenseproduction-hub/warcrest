# Puny Characters (unit sprites)

- **Pack:** 16x16 Puny Characters (+ Sprites), v2.1
- **Author:** Shade (merchant-shade)
- **Source:** https://merchant-shade.itch.io/16x16-puny-characters-plus-sprites
- **License:** paid asset — used under the pack's license for this game. Do NOT
  redistribute the raw pack; only the game-ready sprites needed by Warcrest are
  included here.

Each `<faction>/<role>.png` is a pre-made character sheet (29 cols x 8 rows of
32px frames; 8 rows = 8 facings). Drawn in-engine by `src/puny-units.js`:

| role | aurex (Human) | rimwalker (Elf) | cinder (Orc) |
|------|---------------|------------------|--------------|
| pawn    | Recruit  | Recruit | Worker  |
| warrior | Soldier  | Soldier | Grunt   |
| archer  | Archer   | Ranger  | Shaman  |
| lancer  | Fighter  | Warrior | Warrior |
| monk    | Mage     | Mage    | Mage    |

Frame columns: idle 0-1 · walk 5-8 · sword 13-15 · bow 16-18 · staff 19-21 ·
throw 22-24 · hurt/death 25-27.

The **rimwalker (Night Elf)** sheets are the pack's pale Elf sheets with the
skin pixels remapped to the pack's `Layer 0 - Skins/NightElf1` palette
(human tan → night-elf purple/lavender), so the units read as night elves.
