# Aelindra Ashveil — hero strips

Production specs: `docs/art/rimwalker/`.

| File | Frames | Status |
|---|---|---|
| `Aelindra_Idle.png` | 8 | Spritely-generated (v1) |
| `Aelindra_Run.png` | 8 | Spritely-generated (v1) |
| `Aelindra_Attack.png` | 4 | Spritely-generated (v1) |
| `Aelindra_Thornwall.png` | 6 | Spritely-generated (v1) |
| `Aelindra_Verdant.png` | 5 | Spritely-generated (v1) |
| `Aelindra_Ashfall.png` | 10 | Spritely-generated (v1) |
| `Aelindra_Hit.png` | 2 | Spritely-generated (v1) |
| `Aelindra_Death.png` | 6 | Spritely-generated (v1) |
| `Aelindra_Portrait.png` | 1 | Cropped from canonical idle ref |
| `_refs/` | — | AI key poses (reference only) |

Generated with `python3 tools/generate-aelindra-sprites.py` using Spritely
(sprite-gen-mcp) + your key-pose refs. These are **playable dev strips** — expect
to hand-pixel pass in Aseprite later to match Valdris at 9/10.

Regenerate: `python3 tools/generate-aelindra-sprites.py` (or pass strip filenames).

VFX strips (RootLash, Thornwall, Verdant, Ashfall) are separate — not built yet.
