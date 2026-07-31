# Tripo AI — image-to-3D construction (public + open TripoSR)

Two layers exist:

1. **TripoSR** (open, MIT) — academic/fast single-image recon; published architecture  
2. **Tripo3D product API** — commercial image/multiview-to-model + texture + remesh +
   segment + rig (closed weights; staged like Meshy)

## A. TripoSR (open model) — how the mesh is built

Paper: [arXiv:2403.02151](https://arxiv.org/abs/2403.02151) ·
Code: [VAST-AI-Research/TripoSR](https://github.com/VAST-AI-Research/TripoSR) ·
Collab: Tripo AI + Stability AI.

### Architecture (exact)

```
RGB image
  → Image encoder (transformer / ViT-style features)
  → Image-to-triplane decoder (transformer: self-attn + cross-attn to image tokens)
  → Triplane feature grids (3 orthogonal feature planes)
  → Triplane NeRF MLP  → density σ(x) + color c(x)
  → Marching Cubes on density field  → triangle mesh
  → Sample colors at vertices  → vertex-colored Trimesh
```

Key properties:
- **Feed-forward** (not slow per-scene optimization like classic NeRF fit)
- ~0.5s on A100 for draft textured mesh (paper claim)
- Training improvements over LRM: data curation (CC-BY Objaverse subset), mask
  supervision, channel tuning, crop rendering
- Output is typically **dense irregular triangles** + **baked/vertex color**, not
  game quads or clean UVs

### Extract API (from their `extract_mesh`)

Query triplane density on a 3D grid → isosurface (Marching Cubes) with a density
threshold → query color at vertices → `trimesh.Trimesh(vertices, faces, vertex_colors)`.

This is the literal “construct the model” step for open TripoSR.

## B. Tripo3D product API — staged construction

Docs: [developers.tripo3d.ai](https://developers.tripo3d.ai/en/docs),
[image-to-model](https://docs.tripo3d.ai/model-generation/image-to-model-v3-0-v3-1.html).

Generation endpoints (conceptual stages):

| Endpoint family | Role |
|---|---|
| `image-to-model` | Single image → 3D (optional texture/PBR) |
| `multiview-to-model` | Multiple views → 3D |
| `image-to-multiview` | Synthesize missing views first |
| `models/texture` | Texture / retexture existing mesh |
| `mesh/decimate` | Retopology / poly reduction |
| `mesh/segment` | Semantic part segmentation (editable parts) |
| `mesh/complete` | Hole / completion fixes |
| `animations/rig` + `retarget` | Auto-rig + motion presets |

Important knobs (image-to-model):
- `texture` / `pbr` — white model vs textured vs PBR
- `texture_alignment` — `original_image` (looks like photo) vs `geometry`
- `texture_quality` — standard vs detailed
- `orientation=align_image` — rotate mesh to match photo
- Quad remesh / smart low-poly options on some hosts (extra credits)

## Tripo vs Meshy (construction intent)

| | Tripo | Meshy |
|---|---|---|
| Open recon core | TripoSR (triplane NeRF → MC) | Not open |
| Multi-view | First-class API | Generate Multi-view + multi-image |
| Editable parts | **Segmentation** is a product strength | Less emphasized |
| End-to-end finish | Strong gen; rig/texture as follow-on tasks | Strong integrated remesh/texture/rig UX |
| Default mesh | Dense; needs decimate for games | Remesh / Low Poly / smart-topology modes |

## What “construct” means for TripoSR specifically

Not Boolean modeling. Not subdivision cages. It **regresses a continuous 3D field**
from one image, then **isosurfaces** it. Topology is a side effect of Marching Cubes,
which is why joints/edge loops are wrong for animation until remesh/retopo.
