# Faction building art pipeline

Warcrest's top-down faction buildings are generated from the **CC0 Puny World
tileset** (`assets/tilesets/puny-world/`, by Shade) rather than drawn from
scratch. Each faction is a re-skin of the same base building.

## The recipe

`tools/art/puny_faction_art.py` does the core work:

1. **Grab** a base building (the modular castle/house tiles) from the tileset.
2. **Remap materials by luminance** — every WALL (stone) pixel and ROOF/timber
   (warm) pixel is mapped onto a faction material ramp, so shading survives but
   the material changes:
   - **Human** → blue-grey stone walls + blue roofs
   - **Elf** → wood-brown walls + green roofs
   - **Orc** → bone walls + red roofs
3. **Accents** — banners/crest (Human), climbing vines + leaf cluster (Elf),
   bone spikes + skull (Orc).

`tools/art/puny_keeps.py` takes it further for the hero **Town Halls**, growing
race-structure into the surrounding space: a pine canopy + root-bushes (Elf),
chunky bone horns + skull totem (Orc), stone buttress towers + boulders (Human).

## Commands

```
python3 tools/art/puny_faction_art.py sheet         # 6 buildings x 3 factions -> docs/art/building_sheet.png
python3 tools/art/puny_faction_art.py export DIR    # one PNG per (faction, building type)
python3 tools/art/puny_keeps.py                     # extravagant keeps -> docs/art/faction_keeps.png
```

Reference renders live in `docs/art/`.

## Status / open questions

- This is **top-down** art (matches the current engine). It is the reason to
  stay top-down rather than go isometric — there is no matching iso art.
- The **units** would come from the companion *16x16 Puny Characters* pack
  (8-directional, paid — not yet purchased; not in this repo).
- The flat sheet over-grabs height on some buildings (stacks two tiers); the
  per-building crops want a tidy pass before final.

Requires Pillow: `pip install pillow`.
