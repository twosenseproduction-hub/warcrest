# Critique checklist

Compare **front + ¾** renders to the reference after every build. Score each axis
0–2 (0 miss, 1 partial, 2 match). Fix the lowest score first — **one named param
per rebuild**.

## Scorecard

| Axis | 2 (ship) | 1 | 0 |
|---|---|---|---|
| **Silhouette** | Black cutout readable as the same character | Softly similar | Generic humanoid |
| **Proportions** | Head frac within ±0.05 of card | Noticeably off | Wrong body type |
| **Palette** | Region colors match card hexes | Right hues, wrong values | Wrong regions |
| **Landmarks** | Every card landmark present | Missing 1–2 | Missing most |
| **Armor read** | Leaf/plates/trim readable at glance | Flat blob torso | No armor language |
| **Face read** | Eyes/ears/mouth place correctly | Eyes only | Featureless sphere |
| **Hair / antler** | Volume + branches match reference family | Bun OR antlers weak | Missing / wrong |
| **Form language** | Part outlines match ref crops; no single-primitive silhouettes | Some plates, still ball/tube heavy | Toy blob (sphere head, cube cape, tube limbs) |
| **Pose / axis** | T-pose, face −Y, feet z≈0 | Small lean/offset | Back-facing / floating |

## Diff format (required in agent notes)

```
CRITIQUE <name> iter <n>
- silhouette: 1 — head bun too small vs ref
- proportions: 2
- palette: 2
- landmarks: 1 — missing leather sash
- armor: 1 — breastplates not leaf-shaped
- face: 1 — eyes too round
- hair/antler: 1 — antlers twiggy
- pose: 2
NEXT: increase antler main radius 0.045→0.055 (hair/antler only)
```

## One-knob rule

Allowed between builds:
- **One** numeric/param change, or
- **One** landmark add (single part), or
- **One** material hex tweak

Not allowed: rewrite half the builder and hope.

## Stop conditions

**Ship** when silhouette=2, palette=2, landmarks≥1 with all must-have landmarks
present, pose=2, and front+¾ exist.

**Escalate** (ask user / switch approach) when 3+ iterations do not move the worst
axis — e.g. need side-view reference, or sculpt pass beyond procedural primitives.

## Common miss → knob map

| Miss | Knob |
|---|---|
| Featureless face | eye scale / almond Z-stretch / ear cone length |
| Marshmallow hair | braid cylinder count + bun stack radii |
| Twig antlers | main beam radius + tine count |
| Vertical gold halo | remove X-90° on circlet/belt torus |
| Blob torso | add leaf_plate breast/kilt parts |
| Arms floating | continuous limb_x segments shoulder→hand |
| Too tall / tiny head | `head_height_frac`, `HEAD_R`, `HEAD_Z` |
| Back shown as front | face −Y; camera angle 0 on −Y |
| Exploded fans | delete bmesh capsule hacks; use ops primitives |
| **Sphere head / toy look** | lathed jaw profile + cheek planes; ban UV-sphere-as-final (`anti-blob.md`) |
| **Cube cape** | multi-panel flare + thickness + lining; not one slab |
| **Melon pauldrons** | beveled plate + rim + inset gem housing |
| **Tube greaves** | separate shin plate / knee cup / toe cap |
