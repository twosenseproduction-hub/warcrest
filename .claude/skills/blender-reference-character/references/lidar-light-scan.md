# LiDAR-style light scan (REQUIRED before geometry)

A flat color read of a reference misses form. Treat the image like a **LiDAR +
photometric scan**: light is the depth sensor. Highlights, midtones, and shadows
are returns that describe ridges, planes, cavities, and part separations.

Agents that skip this step build blobs. Agents that fill a **light scan card**
copy plate edges, hair clumps, cape folds, and undercuts.

## Why light = detail

| Painted cue | LiDAR / form analogue | What to model |
|---|---|---|
| Bright highlight streak | Ridge / hard edge facing key light | Bevel, rim loop, metal trim |
| Soft value gradient | Curved volume under continuous light | Lathed profile / rounded plate |
| Contact dark / AO | Occlusion at part junctions | Separate parts + slight gap / inset |
| Cast shadow under pauldron/cape | Depth discontinuity (range jump) | Overhang thickness, not flush paint |
| Specular glint on gold | Oriented micro-facet / edge | Thin rim mesh, not a painted stripe only |
| Flat midtone disk | Facing plane (armor panel) | Beveled plate with inset |
| Dark crease between clumps | Hair/cloth segmentation | Separate clumps / panel cuts |

**Rule:** if you only sampled hex colors, you scanned albedo — not geometry.
Re-read the reference in **value** (ignore hue) before writing `form_recipe`.

## Mandatory scan pass (after Read image, before card lock)

### 1. Generate analysis sheets
```bash
python3 .claude/skills/blender-reference-character/scripts/light_scan_reference.py \
  --image /path/to/reference.png \
  --out exports/blender-rig-test/light-scan/<name>
```

Produces (agent **must** Read each PNG):

| File | What it reveals |
|---|---|
| `00_original.png` | Color identity |
| `01_luminance.png` | Value-as-depth under the painting’s key light |
| `02_edges.png` | Creases, silhouettes, plate seams (range discontinuities) |
| `03_relief.png` | High-pass micro-detail (folds, rivets, strands) |
| `04_shadow_mask.png` | Cavities / undercuts / contact dark |
| `05_highlight_mask.png` | Ridges / metal rims / cheek planes |
| `06_scan_sheet.png` | Contact sheet of all above |

### 2. Fill `light_scan` on the reference card

```json
{
  "light_scan": {
    "key_light": "upper-left, soft studio, slight rim on hair right",
    "value_planes": [
      "forehead plane bright",
      "cheek falloff into jaw",
      "pauldron top ridge bright, underside AO",
      "cape: dark underside, lit outer folds"
    ],
    "ridges": ["gold pauldron rim", "belt plates", "sword fuller"],
    "cavities": ["armpit under pauldron", "cape–back gap", "eye sockets"],
    "part_breaks": ["hair clumps vs scalp", "skirt panels", "boot plate vs shin"],
    "form_notes_by_part": {
      "hair": "5–7 vertical clumps; highlight on leading edges only",
      "cape": "yoke lit, mid folds alternate, hem darker + thicker",
      "pauldron_L": "cup: bright top ellipse, dark under-lip"
    }
  }
}
```

Hard gate: do not craft priority-1 parts until `light_scan.ridges`,
`light_scan.cavities`, and `form_notes_by_part` for those parts exist.

### 3. Map scan → form_recipe (anti-blob bridge)

For each priority-1 part:

```
ridge in scan     → bevel / rim torus / edge loop
cavity in scan    → inset / separate overlapping part / AO gap
flat lit plane    → beveled plate (not sphere)
gradient lobe     → profile / lathe radii
edge-map crease   → panel cut or clump split
```

If `form_recipe` ignores the scan notes, you are guessing.

## Critique under form-revealing light (not beauty light)

Beauty studio lights hide bad form. When comparing mesh ↔ reference:

1. Re-render the mesh in **clay + raking light** (see `render_views.py --mode raking`).
2. Compare raking stills to `01_luminance.png` / `02_edges.png` — not only to the
   colorful original.
3. Score **relief_match** on the critique checklist: do ridge/cavity locations
   line up with the scan?

```bash
blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/render_views.py -- \
  --glb exports/blender-rig-test/<name>.glb \
  --angles 0,35,90 --mode raking \
  --out exports/blender-rig-test/frames-raking
```

## Mental model (one sentence)

**LiDAR asks “where is surface?” — light on a painting answers “where does the
surface turn toward / away from the lamp?”** Encode those turns as geometry
(profiles, plates, folds), not as smoother spheres.

## What this is not

- Not real depth cameras or Meshy weights — an **agent-readable** depth proxy.
- Not a license to over-subdivide: still low-poly / stylized; scan drives *where*
  edge loops and part breaks go.
- Not a substitute for parts-first + anti-blob — it feeds both.

## Tie-in

| Doc | Role |
|---|---|
| **lidar-light-scan** (this) | *See* form via value / edges / raking light |
| `parts-first.md` | *What* discrete pieces to build |
| `anti-blob.md` | *How* to avoid primitive finals |
| `critique-checklist.md` | Score `relief_match` against the scan |
