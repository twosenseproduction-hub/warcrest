---
name: lowpoly-building-forge
description: >
  Procedurally generate and refine Bitgem-style stylized low-poly 3D BUILDINGS and
  structures in Three.js from code — houses, towers, walls, barracks, forges,
  castles, town centers, elf tree-buildings — themed per faction. Use when the user
  asks to make or refine low-poly buildings, architecture, bases, towers, walls, kit
  pieces, RTS/grid buildings, faction-themed structures, or game-ready .glb/sprite
  building assets. Companion to lowpoly-character-forge; reuses its toon materials,
  lighting, render harness, and export.
license: MIT
version: 0.1.0
---

# lowpoly-building-forge

Build faction-themed stylized low-poly buildings from code, sharing one kit of parts
reskinned + accented per race. Companion to `lowpoly-character-forge` (reuses its
`materials.js`, `lighting.js`, vendored Three.js + bloom + GLTFExporter, and the
headless render loop). Same browser-global `window.LPF` namespace; no build step.

## Faction personality (Warcrest)

- **human** (Iron Crown): grey stone + brown timber framing + **blue shingled gable
  roofs**, chimneys, banners, warm windows. Clean medieval.
- **orc** (Raider Horde): tan stone + **red cloth/tent roofs** + **white bone spikes**,
  lashed timber, **forge-lava glow** + red windows. Savage.
- **elf** (Rimwalkers): stone + **green leaf-blob canopies**, gnarled roots/timber,
  **gold glowing runes/orbs**, leaf-cross windows. Organic.

## What's here

```
scripts/
  lib/kit-parts.js       # foundation, walls, gable/cone/tent roofs, windows, door,
                         #   canopy (leaf blobs), bone spike, banner, chimney, beam
  lib/build-building.js  # LPF.buildBuilding(faction, kind) + per-faction theming + setNight
  lib/materials.js,parts.js,lighting.js   # copied from the character forge
  render-building.html   # in-browser harness (loads vendor + lib; ?faction=&kind=&night=)
  render_buildings.py    # headless render N angles + .glb export (Chromium/swiftshader)
  vendor/                # three r144 + bloom passes + GLTFExporter
renders/                 # output PNGs + .glb
```

## Workflow (per the staged plan)

1. **Footprint/grid** — declare a tile footprint (`userData.footprint`), facing +Z.
2. **Foundation** — chunky stone base anchored at y=0 (`K.foundation`).
3. **Massing/walls** — boxes/towers at final proportions; validate footprint early.
4. **Roof** — `K.gableRoof` / `K.coneRoof` / `K.tentRoof` with overhang.
5. **Props/foliage** — `K.canopy` (elf), `K.boneSpike` (orc), cauldron/banner/chimney.
6. **Faction palette** — role-tinted materials per `FACTIONS` in build-building.js.
7. **Emissive / day-night** — tag glow meshes into `userData.glowMeshes`; `LPF.setNight`.
8. **Outline** — inverted-hull (reused from the character forge).
9. **Render + critique** — `python3 scripts/render_buildings.py --faction <f> --kind <k>
   [--night 1] [--angles 0,45,...]`; compare to reference, fix one knob at a time.
10. **Export** — `--export renders/<name>.glb` (bakes to standard materials; the
    cel/outline shaders are render-time only and don't serialize — reapplied in-game).

## Acceptance criteria (critique loop)

silhouette readable at RTS distance · footprint within declared tiles · base at y≈0 ·
roof/wall proportion (roof not dwarfing walls, overhang present) · faction palette
correct · windows/pots dark by day, glow at night (only those, not whole building).

## Key facts

- Grid-locked kit: `K.TILE`, center pivots (`geometry.center()`), base at y=0.
- Gable roof = extruded triangle; **center along X after `rotateY`** (a translate-axis
  bug otherwise offsets it). Tent/cone roofs = low-seg cones; canopy = clustered
  faceted icospheres (two-tone).
- glTF export can't serialize `onBeforeCompile`/`ShaderMaterial` (toon ramp, outline);
  bake to `MeshToonMaterial`/`emissive` + `KHR_materials_emissive_strength` for night.
- Budget ~400–1,500 tris/building (≤3,500 hero); merge static same-material geometry,
  instance repeated props, one material per faction palette.
