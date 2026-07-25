# Master Blender character workflow

Persistent default pipeline for stylized (and other) characters in Warcrest.
Source: user + Perplexity character-modeling rules. Apply unless the user says otherwise.

## Goals

- **Unified connected mesh** — not a stack of separate blobs/cubes.
- **Cute / cartoony**, but with clear torso, shoulders, hips, arms, legs, hands, feet.
- **Clean topology** (mostly quads) and good edge flow for later sculpt + rig.

## Global workflow (always)

1. Start from a **single quad-based base mesh** (or simple human base), not many primitives.
2. Add **Mirror** on X; work symmetrically.
3. **Block out proportions** first:
   - Gently tapered torso (wider shoulders ↔ hips as the design needs).
   - Rounded shoulders into arms — no hard right-angle boxes.
   - Leg volumes flowing from hips into shoes.
4. Only after silhouette reads in **front, side, and ¾**, add sculpt detail with **Multires** or **Dyntopo**.
5. Use **Voxel Remesh** or **Dyntopo** to merge overlapping head/face parts (ears, muzzle, hair, cheeks) into one continuous surface.
6. Prefer **reshaping / remeshing** existing geo over adding new separate blobs/cubes.

## Head and face

- Soft rounded box/sphere; bevel corners — not a rigid cube.
- Integrate muzzle, cheeks, white patches by **extrude/sculpt + remesh**, not glued spheres.
- Big cartoony eyes + small nose; add subtle cheek volume and a clear muzzle.

## Body and limbs

- Single torso with clear shoulders and hips; gentle curvature.
- Arms from rounded shoulder caps; sleeves taper slightly to the wrist.
- Legs under clothing connect smoothly into shoes — no hard box transitions.

## Clothing and shoes

- Clothes follow the body with rounded edges and thickness.
- Soft curves on hems, collars, sleeves (cloth, not rigid boxes).

## Topology and sculpt settings

- Mostly quads, even spacing; avoid long stretched faces and random tris.
- **Multires**: big shapes at low levels, then +1–2 levels for finer detail.
- Brushes: Grab, Inflate/Deflate, Smooth — don’t over-smooth back into a blob.
- Voxel Remesh to unify, then clean topology afterward.

## Repo implementation

| Piece | Path |
|-------|------|
| This doc | `assets/models/blender/MASTER_CHARACTER_WORKFLOW.md` |
| Bizzo (Joey cat) builder | `tools/blender-character/follow_master_cat.py` |
| Outputs | `bizzo_cat_v2.{blend,glb}` |
| Demo stills | `assets/models/blender/bizzo_demo/` |

**Automated start that stays connected:** Skin stick-figure (single object, verts+edges) → Skin radii → Subdivision → optional Voxel Remesh only if islands > 1 → Multires. Prefer reshaping Skin radii over gluing cubes.

```bash
blender -b -noaudio --python tools/blender-character/follow_master_cat.py
```

## Next sculpt pass (in Blender UI)

On `bizzo_cat_v2.blend` with Multires:

1. Sculpt Mode, Multires level 0–1: **Grab** to pull collar flare, cheek volume, boot blockiness.
2. **Inflate** muzzle forward; **Crease** lightly under collar.
3. **Smooth** sparingly — do not erase silhouette.
4. Add Multires levels for ear/hair tips.
5. Retopo later if you need animation-clean quads over the Skin/Remesh cage.

## Agent reminder

When building any new Blender character, state that you are following this saved workflow and briefly list new improvements so the master pipeline can evolve.
