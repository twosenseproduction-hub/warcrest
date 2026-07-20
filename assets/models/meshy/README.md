# Meshy AI models

Generated via the Meshy Text-to-3D API (`model_type: lowpoly` preview + PBR refine).

## Elven Archer

| File | Description |
|------|-------------|
| `elven_archer_meshy.glb` | Textured low-poly elven archer (bow + quiver), silver / forest green / gold |
| `elven_archer_meshy_thumb.png` | Meshy preview thumbnail |
| `elven_archer_meshy_thumb_alpha.png` | Transparent-background thumbnail |

**Task IDs:** preview `019f8044-983f-77bc-b416-c25f597044ff`, refine `019f8049-d966-7edc-a0b7-bc4f83084905`

**Regen:** `MESHY_API_KEY=… python3 tools/.meshy-work/generate_elven_archer.py`

Style target: mobile fantasy RPG (sharp faceted armor, high-contrast palette), matching the reference hero lineup. Not yet wired into `registerUnitModel` — drop into a viewer or run through `tools/rig/import_ai3d.py` before shipping in-game.
