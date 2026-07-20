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
  lidar-light-scan.md    # REQUIRED: treat ref as LiDAR — light reveals form
  show-progress.md       # REQUIRED: PNG after almost every step (user must see)
  meshy-inspired-modeling.md # dense cages/subdiv/panel cuts (own Meshy quality)
  parts-first.md         # PREFERRED: inventory parts → craft each → assemble
  anti-blob.md           # REQUIRED: silhouette match, ban sphere/cylinder finals
  blender-cookbook.md    # safe primitives, axis conventions, materials
  critique-checklist.md  # scoring rubric + one-knob refine rule
scripts/
  lib/primitives.py      # shared bpy helpers (importable from Blender)
  light_scan_reference.py # luminance / edges / relief sheets from a ref image
  build_from_card.py     # parametric builder driven by a JSON card
  render_views.py        # headless turntable stills (studio|raking|clay) + --prefix
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
palette (hex per region) · head_height_frac · landmarks[] · **parts[]** (or
part_inventory[]) · pose · **light_scan** (see 1a).

### 1a. LiDAR-style light scan (REQUIRED — see form via light)
Read `references/lidar-light-scan.md`. Color alone is albedo; **value / edges /
raking light** are the depth sensor.

```bash
python3 .claude/skills/blender-reference-character/scripts/light_scan_reference.py \
  --image /path/to/reference.png \
  --out exports/blender-rig-test/light-scan/<name>
```

Read `06_scan_sheet.png` (+ luminance/edges/relief). Fill `card.light_scan`
(ridges, cavities, part_breaks, form_notes_by_part) **before** crafting.
When critiquing the mesh, also render `--mode raking` or `--mode clay`.

### 1b. Parts-first inventory (PREFERRED construction method)
Read `references/parts-first.md`. Scan the reference for discrete pieces
(limbs, pauldrons, cape, boots, hair, antlers, gems, weapon…). Craft **each
part to quality**, then assemble on shared sockets. Do not smear accessories
into the torso blob. Per-part critique before full-body critique.

### 1c. Anti-blob / silhouette match (REQUIRED)
Read `references/anti-blob.md`. Do **not** ship UV-sphere heads, flat-cube
capes, or constant-radius limb tubes as final forms. For each priority-1 part:
crop the reference, write a silhouette_trace + form_recipe, measure ratios,
build with profiles/beveled plates/edge loops, and gate on `form_language`.
Spheres/cylinders are scaffolds only.

### 2. Blockout from the card
```bash
blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/build_from_card.py -- \
  --card examples/<name>_card.json --out exports/blender-rig-test
```
Or copy `tools/rig/build_antler_elf.py` and drive it from the card's knobs —
ideally one builder function / section per `parts[].id`.

Conventions (see cookbook): **Z-up, face −Y, feet z≈0, T-pose along ±X**.

### 3. Render turntable + show progress (REQUIRED every step)
Read `references/show-progress.md`. After **almost every** build/refine, write a
step-prefixed PNG and **Read it in the same turn** so the user sees development.

```bash
# Named progress still (keep history — do not overwrite earlier steps)
blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/render_views.py -- \
  --glb exports/blender-rig-test/<name>.glb \
  --angles 0,35 \
  --prefix 01_blockout \
  --out exports/blender-rig-test/progress/<name>

# Form check (compare to light-scan luminance/edges — not beauty lights alone)
blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/render_views.py -- \
  --glb exports/blender-rig-test/<name>.glb \
  --angles 0,35 --mode clay \
  --prefix 01_blockout \
  --out exports/blender-rig-test/progress/<name>

# Also keep a latest turntable under frames/ if useful
blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/render_views.py -- \
  --glb exports/blender-rig-test/<name>.glb \
  --angles 0,35,90 --out exports/blender-rig-test/frames
```
Angle `0` = front (camera on −Y). Always produce **front + ¾** at minimum.
Copy step PNGs to `/opt/cursor/artifacts/<name>-progress/` for the walkthrough.
For parts-first: also render tight crops while approving individual parts.

### 4. Critique against the reference
Load the PNGs with the Read tool **in the working turn**. Score with `references/critique-checklist.md`:
silhouette · proportions · palette · landmarks · armor read · face read · hair/antler ·
**form_language** · **relief_match** (clay/raking vs light-scan sheets).

Produce a **prioritized diff** — worst miss first. Each miss → **one named param**.
Prefer fixing the **owning part** (e.g. pauldron radius) over global hacks.

### 5. Refine (one knob per rebuild)
Edit only that param on the card or builder. Rebuild. Re-render front+¾ with a
**new** `--prefix` (e.g. `12_refine_hair`). Read the PNG. Re-score.
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

When the user wants **Meshy-sharp detail (no blobs)**, follow
`image-to-3d-from-reference/references/sharp-detail-path.md` and
`references/meshy-inspired-modeling.md`: dense white model (cages → subdiv →
panel cuts from light-scan), then color. Sphere kits are scaffolds only.

## Anti-patterns (learned the hard way)

- Jumping to geometry before a locked card → vague “elf-like” blob.
- Reading only colors (albedo) and ignoring painted light/value → missing ridges & cavities (see `lidar-light-scan.md`).
- Critiquing only under beauty studio lights → form errors stay hidden; use `--mode clay`.
- Rebuilding without showing a step PNG → user cannot see development (`show-progress.md`).
- Building the whole hero as one undifferentiated mesh → muddy pauldrons/cape/boots.
- **Shipping UV-sphere heads / cube capes / tube limbs as finals** → toy-blob look (see `anti-blob.md`).
- Fragile bmesh matrix stacks for capsules/leaves → exploded fan geometry.
- Rotating default tori 90° on X for belts/circlets → face-on vertical halos.
- Camera on −Y while face is +Y → “front” renders show the back.
- Changing five params between renders → cannot tell what helped.
- Assembling before high-priority parts are approved → wasted full-body polish.
- Adding subdivision to a sphere and calling it done → smoother blob, not a copy.
