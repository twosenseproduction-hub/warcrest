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

### Less shiny texture
Shine was baked into the albedo (painted highlights), not just PBR.
Pipeline: Meshy retexture with `remove_lighting: true` + local highlight crush on purple plate hotspots.
Keep `metallicFactor=0`, `roughnessFactor=1`, no normal map. In-engine prefer Lambert/unlit or `flatShading` with roughness 1.

## Archer animations (Meshy Rig + Animation Library)

Rigged from the matte retexture task, then Meshy animation clips applied:

| Clip | File | Meshy action |
|------|------|--------------|
| idle | `anims/purple_elf_meshy_idle.glb` | Idle (0) |
| walk | `anims/purple_elf_meshy_walk.glb` | Walking Woman (1) |
| run | `anims/purple_elf_meshy_run.glb` | Run 3 (15) |
| attack | `anims/purple_elf_meshy_attack.glb` | Archery Shot (224) |
| attack_alt | `anims/purple_elf_meshy_attack_alt.glb` | Archery Shot 1 (225) |
| aim | `anims/purple_elf_meshy_aim.glb` | Archery Aim Lateral Scan (231) |
| draw_shoot | `anims/purple_elf_meshy_draw_shoot.glb` | Draw and Shoot from Back (222) |
| hit | `anims/purple_elf_meshy_hit.glb` | Hit Reaction with Bow (150) |
| walk_aimed | `anims/purple_elf_meshy_walk_aimed.glb` | Walk Forward with Bow Aimed (228) |

Also: `purple_elf_meshy_rigged.glb` (bind pose / default clip).

**Regen:** `MESHY_API_KEY=… python3 tools/.meshy-work/rig_and_animate_purple_elf.py`

**Preview:** serve repo root → `/tools/rig/view_unit.html?glb=assets/models/meshy/anims/purple_elf_meshy_attack.glb`
