# Meshy AI models

## Purple Elf — keep the polygon / flat-shade look

The reference is **low-poly + flat shading** (hard facet edges, no smooth normals).
Meshy’s default smooth normals wash that out.

### What we ship now
`purple_elf_meshy.glb` = Meshy **`model_type: lowpoly`** Image-to-3D from the Drive ref,
then **`facet_glb.py`** (unmerge verts → face normals) + matte factors.

| File | Notes |
|------|-------|
| `purple_elf_ref.jpg` | Source T-pose |
| `purple_elf_meshy.glb` | Faceted lowpoly (current) |
| `purple_elf_meshy_lowpoly_raw.glb` | Meshy lowpoly before facet pass |
| `purple_elf_meshy_lowpoly_view_*.png` | Meshy preview thumbs |
| `purple_elf_meshy_v1_smarttopo.glb` / `_fidelity_raw.glb` | Earlier smoother attempts |

### How to keep the polygon look
1. **Generate with** `model_type: "lowpoly"` (not standard/smart-topology remesh).
2. **Facet after export:** `python3 tools/.meshy-work/facet_glb.py path/to.glb`
3. **In engine:** load with **flat shading** (`material.flatShading = true` in Three.js, or `use_smooth=False` in Blender). Smooth shading will hide the facets again.
4. **No normal maps** — they re-smooth the silhouette.

### Regen
```bash
MESHY_API_KEY=… python3 tools/.meshy-work/generate_purple_elf_lowpoly.py
python3 tools/.meshy-work/facet_glb.py assets/models/meshy/purple_elf_meshy_lowpoly_raw.glb \
  -o assets/models/meshy/purple_elf_meshy.glb
```

## Elven Archer
Earlier text-to-3D experiment: `elven_archer_meshy.glb`.
