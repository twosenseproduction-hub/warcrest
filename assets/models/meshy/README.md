# Meshy AI models

**Style canon for all new Meshy units:** see [`STYLE.md`](./STYLE.md)
(purple-elf polygon look, matte paint, color-safe texturing).

## Purple Elf — keep the polygon / flat-shade look

The reference is **low-poly + flat shading** (visible facets, hard edges, no smooth normals).
Meshy’s default smooth normals wash that out.

### What we ship now
`purple_elf_meshy.glb` = Meshy **`model_type: lowpoly`** Image-to-3D from the Drive ref,
then **`facet_glb.py`** (unmerge verts → face normals) + matte factors.

| File | Notes |
|------|-------|
| `purple_elf_ref.jpg` | Source T-pose |
| `STYLE.md` | How to make *other* characters in this style |
| `purple_elf_meshy.glb` | Faceted lowpoly (current) |
| `purple_elf_meshy_lowpoly_raw.glb` | Meshy lowpoly before facet pass |
| `purple_elf_meshy_lowpoly_view_*.png` | Meshy preview thumbs |

### How to keep the polygon look
1. **Generate with** `model_type: "lowpoly"` (not standard/smart-topology remesh).
2. **Facet after export:** `python3 tools/.meshy-work/facet_glb.py path/to.glb`
3. **In engine:** `material.flatShading = true`. Smooth shading hides facets.
4. **No normal maps.**

### Regen
```bash
MESHY_API_KEY=… python3 tools/.meshy-work/generate_purple_elf_lowpoly.py
python3 tools/.meshy-work/facet_glb.py assets/models/meshy/purple_elf_meshy_lowpoly_raw.glb \
  -o assets/models/meshy/purple_elf_meshy.glb
```

## Texturing without losing color

Meshy **`image_style_url` washes / greys color**. Use an explicit text palette instead:

```bash
MESHY_API_KEY=… python3 tools/.meshy-work/retexture_keep_color.py \
  --input-task-id <task> \
  --ref assets/models/meshy/purple_elf_ref.jpg \
  --name my_unit
```

See `STYLE.md` for the full recipe.

## Archer animations

### Human Archer FREE pack (preferred)

Drive pack retargeted onto the Meshy Mixamo-like rig (Female idle / bow / walk / run):

`purple_elf_meshy_pack_anim.glb` — clips: `idle`, `bow_idle`, `bow_idle_alt`, `attack_load`, `attack_hold`, `attack_release`, `walk`, `run`

```bash
# Requires the unzipped pack under tools/.meshy-work/drive_anims_extracted/
# Source: https://drive.google.com/file/d/1S3iyP2TTVy6a-vArz7NXzvEiE9bO5a4I
blender -b -noaudio --python tools/.meshy-work/retarget_humanf_to_meshy.py -- \
  --mesh assets/models/meshy/purple_elf_meshy_rigged.glb \
  --anims-dir tools/.meshy-work/drive_anims_extracted/Animations/Female \
  --out assets/models/meshy/purple_elf_meshy_pack_anim.glb
```

**Preview:** `/tools/rig/view_unit.html?glb=assets/models/meshy/purple_elf_meshy_pack_anim.glb`

### Meshy Animation Library (per-clip GLBs)

| Clip | File |
|------|------|
| idle / walk / run | `anims/purple_elf_meshy_{idle,walk,run}.glb` |
| attack / aim / draw_shoot / hit / walk_aimed | `anims/purple_elf_meshy_*.glb` |

Also: `purple_elf_meshy_rigged.glb`

**Regen:** `python3 tools/.meshy-work/rig_and_animate_purple_elf.py`  
**Preview:** `/tools/rig/view_unit.html?glb=assets/models/meshy/anims/purple_elf_meshy_attack.glb`
