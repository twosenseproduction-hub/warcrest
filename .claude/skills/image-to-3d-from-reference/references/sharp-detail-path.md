# Sharp detail path — become the Meshy-quality builder (no Meshy dependency)

Meshy/Tripo are **teachers**, not our runtime. Study their stages, then **own**
the same quality contract with Blender tools we control. Do not tell the user
they must bring an API key to escape blobs.

## What Meshy does that creates sharpness (steal the contract)

| Meshy stage | Quality it buys | Our owned analogue |
|---|---|---|
| Multi-view synthesis | Correct volumes from more than 1 silhouette | Multi-view card + inferred side/back |
| Dense white model | Edges follow the painting | **All-quad cages + subdiv + panel cuts** driven by light-scan |
| Remesh | Clean readable topology | Apply subdiv → optional decimate to budget |
| Texture after shape | Paint doesn’t hide bad form | Region materials / maps **only after** clay pass ships |
| Thumbnail QA | Catch fails early | Step PNGs every turn (`show-progress.md`) |

Meshy’s “secret” is not magic primitives — it is **dense surface first, texture
second**, with edges that track the reference. We replicate that density with
subdivision cages and edge-driven cuts, not UV-sphere kits.

## Owned pipeline (MANDATORY for sharp requests)

```
0. Input prep + Read reference
1. Light scan (luminance / edges / relief)     ← our depth/crease sensor
2. Multi-view card + parts inventory
3. DENSE WHITE MODEL (flat grey / clay only)
     - all-quad cages (cubes/grids), NOT final spheres
     - double-subdiv or Catmull-Clark ≥2 where organic
     - hard edges: bevel + support loops (armor, greaves, bracers)
     - panel cuts / insets where edge-map fires
     - cape = subdivided sheet with thickness + folds
     - hair = many thin volumes / cards, not 5 cones
4. PNG progress (studio + clay) — Read in chat
5. Critique shape only (relief_match, form_language)
6. One-knob densify/cut/reshape — rebuild — PNG again
7. Materials / texture pass AFTER shape ≥ ship bar
8. Optional remesh/decimate for game tris + donor bind
```

## Hard bans (these recreate blobs)

- Shipping UV spheres / constant cylinders / flat cubes as **final** hero forms  
- Texturing or “color polish” before clay silhouette matches the ref  
- Calling Meshy/Tripo APIs as the primary builder (optional research only)  
- Stopping at “parts-first” with 1 primitive per part  

## Density targets (hero display white model)

Guide, not law — aim for **readable edges in clay**, not a tris quota:

- Head/hair: subdivided cage, jaw/cheek planes, many hair clumps (≥12)  
- Armor: inset panels + rim loops; filigree as thin extruded curves or inset strips  
- Cape: grid ≥16×16 before subdiv, ≥2 fold ridges, thickness shell  
- Overall before game decimate: often **15k–80k tris** OK for display; decimate later  

If clay still looks like stacked toys → **add support loops / panel cuts / subdiv**,
do not add more spheres.

## Modeling recipes (see also cookbook)

Primary doc: `blender-reference-character/references/meshy-inspired-modeling.md`

Quick rules:

1. **Start every volume as a cage** (cube/grid) → loop cuts → bevel → subdiv  
2. **Cut where the edge map is bright** (light scan `02_edges.png`)  
3. **Raise where highlights are**, carve where shadows are (relief map)  
4. **White/clay only** until form_language≥2 and relief_match≥1  
5. Show a PNG after every densify pass  

## Scripts

```bash
# Light scan
python3 .claude/skills/blender-reference-character/scripts/light_scan_reference.py \
  --image <ref.png> --out exports/.../light-scan/<name>

# Dense white-model builder (owned — no Meshy)
blender -b -noaudio --python tools/rig/build_dense_white_character.py -- \
  --card examples/<name>_card.json --out exports/blender-rig-test

# Progress PNGs
blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/render_views.py -- \
  --glb exports/blender-rig-test/<name>.glb --angles 0,35 --mode clay \
  --prefix 30_white --out exports/blender-rig-test/progress/<name>
```

## Optional: Meshy as study only

`tools/meshy/` may fetch a commercial mesh for **side-by-side study** when the
user explicitly wants a comparison. It is **not** required and must not block
our builder work.

## Tie-in

| Doc | Role |
|---|---|
| **This file** | Quality contract we own |
| `meshy-pipeline.md` | What Meshy’s product stages are (study) |
| `meshy-inspired-modeling.md` | How we cut dense Blender geometry |
| `anti-blob.md` / `lidar-light-scan.md` | Sensors + bans feeding the dense pass |
| `show-progress.md` | PNG every step |
