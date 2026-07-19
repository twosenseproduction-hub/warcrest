# Warcrest character reference — T-pose, weaponless

Concept/reference art for the character roster, authored in **T-pose with empty
hands** so each body can be auto-rigged cleanly and have its weapon attached
separately (see the `weapon` block on `RTS.Render3D.registerUnitModel`).

These are **reference images only** — not loaded by the game, not deployed.
They are the inputs for the Tripo image-to-model pipeline when we generate
game-ready `.glb` units. `_contact_sheet.jpg` is a labeled grid of all 51.

## Roster (by faction)

**Iron Crown / Human (current faction)**
- Human peasant · Human priest · Knight (mounted) · Human Paladin · Man in grey armor / grey plate · Human Archmage (mounted)

**Raider Horde / Orc (current faction)**
- Orc peon · Orc Blademaster · Orc Shaman · Orc rider on wyvern (mounted)

**Rimwalkers / Night Elf (current faction)**
- Night Elf Archer · Dryad (centaur) · Huntress on panther (mounted) · Demon Hunter ·
  Druid · Keeper of the Grove · Warden · rider on hippogryph (mounted)

**High Elf (new)** — Blood Mage · Sorceress · Spell Breaker · rider on dragonhawk (mounted)

**Dwarven (new)** — Gryphon Rider (mounted) · Mortar Team · Mountain King

**Tauren (new)** — Spirit Walker · Tauren warrior

**Troll (new)** — Batrider (mounted) · Shadow Hunter · Witch Doctor

**Undead (new, ~full faction)** — Death Knight (+mounted) · Banshee · Crypt Fiend ·
  Crypt Lord · Dreadlord · Lich · Necromancer · Abomination · Acolyte · Gargoyle ·
  Ghoul · skeleton archer · skeleton warrior

**Demonic (new)** — Demonic golem (×2)

## Notes for when we generate these

- Two-legged units rig normally (idle/walk/attack).
- **Mounted / centaur units** (any "rider on …", Dryad, Huntress-on-panther) hit
  Tripo's biped-vs-quadruped misclassification, so they come in as static "bob"
  models rather than walk-cycled — same limitation we saw on the first Rimwalker pass.
- Generate the **weapon separately** and mount it via the model's `weapon` block.
