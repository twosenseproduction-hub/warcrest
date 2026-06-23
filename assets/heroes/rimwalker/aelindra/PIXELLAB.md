# Aelindra in Pixel Lab

| Field | Value |
|---|---|
| Character ID | `25cba5ef-4c17-4b89-93c1-3abc53ef5015` |
| Name | Aelindra Ashveil |
| View | high top-down |
| Frame size | 256×256 |
| Directions | 8 |
| Source ref | `_refs/canonical_idle_keyed.png` |

Open in Pixel Lab: [Characters](https://www.pixellab.ai/character) — look for **Aelindra Ashveil**.

API detail cached in `tools/.pixellab-work/aelindra_character_detail.json`.

South-facing rotation saved locally as `_refs/pixellab_character_south.png` for comparison.

## Walk animation (4 directions)

Template: `walking-4-frames` (east/north/west) + v3 fallback for south (template timed out).

| Direction | Frames | Strip |
|---|---|---|
| south | 4 | `pixellab/Aelindra_Walk_south.png` |
| north | 4 | `pixellab/Aelindra_Walk_north.png` |
| east | 4 | `pixellab/Aelindra_Walk_east.png` |
| west | 4 | `pixellab/Aelindra_Walk_west.png` |

Per-frame PNGs: `pixellab/walk/{direction}/frame_XX.png`  
Manifest: `pixellab/walk_manifest.json`

Engine uses directional walk clips in `src/sprites.js` (`walk_south`, `walk_north`, etc.).

Regenerate / download: `python3 tools/download-aelindra-pixellab-walk.py`
