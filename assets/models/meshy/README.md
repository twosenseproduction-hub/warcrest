# Meshy AI models

## Purple Elf (from reference image)

Cleanest path: **Image-to-3D** with Meshy Smart Topology (`meshy-t2`, 10k faces, T-pose).

| File | Description |
|------|-------------|
| `purple_elf_ref.jpg` | Source T-pose reference (Drive) |
| `purple_elf_meshy.glb` | Matte textured GLB (metalness stripped) |
| `purple_elf_meshy_pbr.glb` | Original shiny PBR export (backup) |
| `purple_elf_meshy_thumb.png` | Front thumbnail |
| `purple_elf_meshy_view_*.png` | Front / left / right / back views |

**Task:** `019f8066-81e9-7ac7-9a19-bb11d48c5b5e`  
**Regen:** `MESHY_API_KEY=… python3 tools/.meshy-work/generate_purple_elf_from_image.py`  
**Matte (no Meshy credits):** `python3 tools/.meshy-work/matte_glb.py assets/models/meshy/purple_elf_meshy.glb`

### Less shiny
Meshy PBR sets `metallicFactor=1` + a metalness map → chrome armor. Fixes:
1. **Local (this repo):** `matte_glb.py` — zero metalness, high roughness (applied to `purple_elf_meshy.glb`).
2. **On generate:** `enable_pbr: false` (base color only).
3. **Meshy retexture:** matte/hand-painted `texture_prompt` with `enable_pbr: false` if baked highlights remain.

## Elven Archer (text-to-3D)

| File | Description |
|------|-------------|
| `elven_archer_meshy.glb` | Earlier text-prompt lowpoly archer |
| `elven_archer_meshy_thumb.png` | Thumbnail |

Not wired into `registerUnitModel` yet.
