# Warcrest unit rigging pipeline

Turn a **direction** (image or description) into a **rigged, animated, game-ready unit**
that drops straight into `demos/thronefall-level.html`. Runs headless in the cloud
container **and** on a desktop Blender — same script either place.

## Why this is reliable (and Mixamo / auto-rig weren't)

Every previous unit failed because we rigged an *arbitrary* generated mesh: Mixamo
rejected the tri-count / embedded textures, and naive auto-weights on a mesh whose
proportions didn't match the skeleton produced the "arms cave in / airplane arms"
deformation.

This pipeline flips it: we **generate the mesh directly on the shipped donor's bones**.
The body geometry hugs the skeleton by construction, so Blender's automatic weights
bind cleanly and the donor's existing `idle / run / attack / block` clips drive it
correctly — no hand-weighting, no retarget, no Mixamo.

## How the body is built (base mesh → Skin → Subdivision)

Following the standard subdivision-modeling workflow, the body is **not** a pile of
intersecting primitives. It's:

1. A single connected **edge skeleton** laid along the donor bones — one vertex per
   joint (pelvis → spine → neck → head, plus arm and leg chains).
2. A **Skin modifier** that inflates those edges into one watertight body, with a
   per-joint radius so the torso is broad, the neck narrows, and limbs taper into the
   hands and feet.
3. A **Subdivision Surface** that smooths the result into a rounded silhouette with
   clean quad topology.

Regions (skin / armor / head / cloth) are colored by nearest-joint after the mesh is
generated, and a few crisp low-poly accent props (hair cap, belt, pauldrons, boots)
are joined on top. The whole body then binds to the donor armature with
`ARMATURE_AUTO` weights. Because it still hugs the bones, the bind stays clean and the
donor clips deform it correctly.

This is genuinely good for **troops and soldiers**. It is *parametric masses on bones*,
not a hand-sculpted likeness — so a detailed hero/creature (e.g. an armored drake) still
wants either a sculpt pass or an external model file dropped through the rig step.

## Usage

```bash
blender -b -noaudio --python tools/rig/build_unit.py -- \
  --name skeleton_warrior \
  --donor elf_warrior \
  --spec '{"skin":"#e6e2d0","armor":"#4a4640","trim":"#8a8378","cloth":"#2b2824","weapon":"sword","build":0.95}' \
  --out assets/models
# → assets/models/skeleton_warrior_anim.glb  (with idle/run/attack/block clips)
```

- `--donor` is any shipped rigged unit whose skeleton + clip set to reuse
  (`elf_warrior`, `orc_grunt`, `human_footman`, …). All share the same 81-bone
  Bitgem humanoid rig.
- `--spec` is the **direction** — a JSON of palette + proportions + weapon:
  - colours: `skin`, `armor`, `trim`, `cloth`, `head`, `hair`, `steel`, `wood`
  - shape: `build` (limb thickness ×), `height`, `subsurf` (smoothing level, default 2)
  - `weapon`: `sword | axe | spear | staff | none`
  - `pauldrons`: `true|false`
  To reproduce a reference, fill these in from the image/description.

## Preview a built unit

Serve the repo root and open the viewer (works headless via swiftshader too):

```
/tools/rig/view_unit.html?glb=assets/models/<name>_anim.glb&clip=run
```

It loads the GLB, plays a clip, and exposes `window.__ready / __clips / __bbox /
__seek(t) / __orbit(ang,el)` for scripted screenshots.

## Wire the result into the game (`demos/thronefall-level.html`)

1. `CHAR_H['<name>'] = <world height>`   (e.g. 3.8)
2. `RIG_SPECS.push(['<name>','<name>'])`  (loads `<name>_anim.glb` + optional `<name>_tex.png`)
3. Optional weapon prop in `WEAPONS['<name>']` (bone `hand_r`), same as existing units —
   or bake it into the GLB via the `weapon` spec.
4. Reference `<name>` from a unit/hero spec or the train catalogue.

## Verify

Load the exported GLB in a GLTF viewer (or the game), play `run` — the mesh must
**deform** (stride/arm-swing), sit upright and centred, feet near y≈0. A stick-figure
or origin-teleport means the donor scale wasn't picked up (check the `DONOR_SCALE`
log line).

## Notes
- The exported GLB carries geometry + standard materials + the donor's clips. The game
  re-applies its toon/outline look on load, exactly like every other unit.
- Mesh detail is a first parametric pass (primitive masses on the bones). Refinement =
  editing `build_unit.py`'s body section (add armor plates, cloth, silhouette) per
  reference — the rig/animation stays fixed.
