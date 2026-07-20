---
name: blender-reference-character
description: >
  Build and iteratively refine stylized low-poly 3D characters in Blender from a
  reference image using a locked reference card, parametric bpy builders, headless
  turntable renders, and a one-knob critique loop. Use when the user asks to make,
  model, craft, match, or refine a character in Blender from a concept/reference
  image; or when exporting a T-pose/A-pose .glb for later Warcrest rigging. Companion
  to lowpoly-character-forge (Three.js look-dev) and tools/rig/ (donor skeleton bind).
license: MIT
version: 0.1.0
---

# blender-reference-character

Craft Blender characters **from a reference** without jumping straight to geometry.
The quality unlock is a locked **reference card** (palette · proportions · landmarks)
plus a **render → critique → one-knob refine** loop — the same convergence pattern as
`lowpoly-character-forge`, but targeting headless Blender + GLB.

An LLM cannot emit a high-quality mesh the way a 3D-gen model does. It *can*
reliably write parametric builders and converge when each miss maps to one named
param. This skill enforces that.

## When to use

- User provides a character reference (image and/or description) and wants a
  **Blender** model / T-pose GLB.
- Refining an existing procedural Blender character toward a reference.
- Preparing a static hero/troop mesh for later bind via `tools/rig/`.

**Not** for: pure Three.js look-dev (use `lowpoly-character-forge`); buildings
(use `lowpoly-building-forge`); replacing shipped `assets/heroes/` sprite strips
(see `AGENTS.md` art rules).

## What's here

```
references/
  reference-card.md      # MUST fill before writing geometry
  blender-cookbook.md    # safe primitives, axis conventions, materials
  critique-checklist.md  # scoring rubric + one-knob refine rule
scripts/
  lib/primitives.py      # shared bpy helpers (importable from Blender)
  build_from_card.py     # parametric builder driven by a JSON card
  render_views.py        # headless turntable stills (EEVEE/Workbench)
  new_card.py            # scaffold an empty card JSON from a name
examples/
  antler_elf_card.json   # worked example (purple leaf-armor Rimwalker)
renders/                 # local output (gitignored patterns optional)
```

Warcrest wiring lives in the repo root:
- `tools/rig/build_antler_elf.py` — production-shaped example of this skill
- `tools/rig/build_unit.py` — bind a mesh to a donor skeleton + inherit clips
- `scripts/setup-blender.sh` — install Blender on Linux cloud agents

## Workflow (MANDATORY order — do not skip)

### 0. Prerequisites
```bash
bash scripts/setup-blender.sh   # from repo root; no-op if blender on PATH
```

### 1. Reference card (BEFORE any mesh)
Read the reference image(s). Fill a card using `references/reference-card.md`.
Write it to `examples/<name>_card.json` (or `/tmp/<name>_card.json`).

**Hard gate:** do not open a builder script until the card has:
palette (hex per region) · head_height_frac · landmarks[] · part_inventory[] · pose.

### 2. Blockout from the card
```bash
blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/build_from_card.py -- \
  --card examples/<name>_card.json --out exports/blender-rig-test
```
Or copy `tools/rig/build_antler_elf.py` and drive it from the card's knobs.

Conventions (see cookbook): **Z-up, face −Y, feet z≈0, T-pose along ±X**.

### 3. Render turntable
```bash
blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/render_views.py -- \
  --glb exports/blender-rig-test/<name>.glb \
  --angles 0,35,90 --out exports/blender-rig-test/frames
```
Angle `0` = front (camera on −Y). Always produce **front + ¾** at minimum.

### 4. Critique against the reference
Load the PNGs with the Read tool. Score with `references/critique-checklist.md`:
silhouette · proportions · palette · landmarks · armor read · face read · hair/antler.

Produce a **prioritized diff** — worst miss first. Each miss → **one named param**.

### 5. Refine (one knob per rebuild)
Edit only that param on the card or builder. Rebuild. Re-render front+¾. Re-score.
Stop when front silhouette landmarks match and palette regions are correct.

### 6. Export + (optional) rig
Ship the `.glb`. For in-game animation, bind via `tools/rig/build_unit.py` or
`tools/rig/rig_to_kaykit.py` — out of scope for the first static match pass.

## Acceptance criteria

Ship only when:
1. Front silhouette shows every card landmark (ears, hair volume, antlers/horns,
   pauldrons, kilt/skirt, boots — whatever the card listed).
2. Palette regions match the card hexes (skin / armor / gold / hair / emissives).
3. Proportions: head height within ±0.05 of `head_height_frac`.
4. Feet near z=0; character centered on X; face toward −Y.
5. Front + ¾ renders exist and were critiqued against the reference.

## Relation to other skills

| Skill | Role |
|---|---|
| **blender-reference-character** (this) | Reference → Blender parametric mesh → GLB |
| `image-to-3d-from-reference` | How Meshy/Tripo stage image→3D + agent analogue (multi-view → white model → remesh → texture) |
| `lowpoly-character-forge` | Same loop in Three.js (toon/outline/bloom look-dev) |
| `tools/rig/` | Bind mesh to donor skeleton; inherit idle/run/attack |

Preferred path for a new Warcrest hero from art:
**card → this skill (static T-pose) → tools/rig donor bind → register in Render3D.**

When the user wants “Meshy/Tripo-style from a photo,” start with
`image-to-3d-from-reference` for staging, then use **this** skill for the white-model geometry pass.

## Anti-patterns (learned the hard way)

- Jumping to geometry before a locked card → vague “elf-like” blob.
- Fragile bmesh matrix stacks for capsules/leaves → exploded fan geometry.
- Rotating default tori 90° on X for belts/circlets → face-on vertical halos.
- Camera on −Y while face is +Y → “front” renders show the back.
- Changing five params between renders → cannot tell what helped.
