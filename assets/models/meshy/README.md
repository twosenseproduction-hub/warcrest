# Meshy AI models

## Purple Elf (from reference image)

Cleanest path: **Image-to-3D** with Meshy Smart Topology (`meshy-t2`, 10k faces, T-pose).

| File | Description |
|------|-------------|
| `purple_elf_ref.jpg` | Source T-pose reference (Drive) |
| `purple_elf_meshy.glb` | Textured smart-topology GLB |
| `purple_elf_meshy_thumb.png` | Front thumbnail |
| `purple_elf_meshy_view_*.png` | Front / left / right / back views |

**Task:** `019f8066-81e9-7ac7-9a19-bb11d48c5b5e`  
**Regen:** `MESHY_API_KEY=… python3 tools/.meshy-work/generate_purple_elf_from_image.py`

## Elven Archer (text-to-3D)

| File | Description |
|------|-------------|
| `elven_archer_meshy.glb` | Earlier text-prompt lowpoly archer |
| `elven_archer_meshy_thumb.png` | Thumbnail |

Not wired into `registerUnitModel` yet.
