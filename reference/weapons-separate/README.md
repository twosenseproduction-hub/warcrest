# Warcrest weapons reference — separate, isolated

Companion to `../characters-tpose/`. Each weapon is rendered **on its own** (on a
magenta backdrop for easy background removal) so it can be generated as a
standalone `.glb` and mounted onto a unit's hand bone via the `weapon` block on
`RTS.Render3D.registerUnitModel` — letting it follow the hand through animation
and, for projectiles, detach and fly.

**Reference images only** — not loaded by the game, not deployed.
`_contact_sheet.jpg` is a labeled grid of all 30.

## Rough weapon → unit mapping (to refine when we generate)

- **Bows:** Elven longbow (Night Elf Archer) · Skeletal bone bow (Undead skeleton archer)
- **Swords:** Elven sword(s) · Iron / Steel blade (Human/grey-armor) · Knight/Paladin blade
- **Glaives / thrown:** green defensive warglaives (Demon Hunter) · ornate double-ended glaive (Huntress) · three-pronged throwing weapon (moon-glaive projectile)
- **Staves:** golden+crystal & blue-crystal (mages/priests) · frozen bone staff (Lich/Necromancer) · skull-totem & tiki-mask & moon-crystal staves (Troll/Druid/Shaman) · light-wood staff
- **Hammers / axes:** golden ceremonial hammer (Paladin/Mountain King) · war hammers · orcish felling axe
- **Other:** bear-claw gauntlet · kite shield (cross motif, Human) · rusty chain w/ meat hook (Abomination) · spiked log & wooden/mining construction implements (worker tools) · hunting/leaf spears (Huntress/peon)

Mapping above is a first guess from filenames + silhouettes; confirm against the
actual units when wiring.
