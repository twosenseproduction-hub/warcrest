# Sharp detail path (Meshy-level) — REQUIRED when user rejects blobs

Procedural UV-sphere / cylinder kits will **never** match a Meshy AI render.
Meshy invents a dense neural surface with real plate edges, hair strands, and
filigree. An LLM writing `bpy.ops.mesh.primitive_*` invents **blobs**.

When the user wants Meshy-sharp detail, **stop sphere-kit hero builds** and use
this path instead.

## Preferred construction order

```
reference image (clean, ≥1024)
    │
    ├─ A) MESHY_API_KEY / Tripo key available
    │     → image-to-3D WHITE MODEL first (should_texture=false)
    │     → download GLB → orient to Warcrest axes
    │     → render progress PNGs (front/¾/clay)
    │     → approve silhouette
    │     → optional remesh / smart-topology / game budget
    │     → texture pass (Meshy retexture OR region materials)
    │
    ├─ B) User drops a Meshy/Tripo GLB (licensed for the project)
    │     → same from “orient → PNG → remesh → materials”
    │
    └─ C) No API / no GLB (owned-IP only fallback)
          → hard-surface Blender cages (double-subdiv / beveled plates)
          → NEVER claim Meshy parity; label as “blockout”
```

## Hard gates (reject and escalate)

Refuse to continue a “Meshy-quality” request if:

1. Geometry is still mostly UV spheres + cylinders as final forms  
2. Cape / hair / armor read as single primitives in clay mode  
3. No neural white model **and** user explicitly wants Meshy sharpness  
4. Free-tier Meshy mesh is about to ship into exclusive Warcrest IP without a license note  

**Escalate to user:** “Need `MESHY_API_KEY` (or a Meshy GLB drop) for sharp detail.
I can keep iterating a procedural blockout, but it will stay soft.”

## Why the blob path failed (teach this)

| Meshy | Sphere-kit agent |
|---|---|
| Diffusion + 3D recon invents missing volume | Agent approximates with primitives |
| Dense triangles follow painted edges | Bevels on cubes still look toy |
| Filigree is geometry or high-res normals | Gold “bars” fake ornament |
| Hair is many thin volumes | Cone clumps |

Anti-blob + light-scan still help **blockouts** and **QA**. They are not a
substitute for stage-2 neural geometry when sharpness is the goal.

## Agent checklist (Meshy-sharp request)

1. Confirm path A/B/C with available credentials / files  
2. Run white model → **PNG in chat** (`show-progress.md`)  
3. Critique clay silhouette vs reference (not beauty lights)  
4. Remesh only after shape approval  
5. Texture after shape approval  
6. Optional: donor bind via `tools/rig/` (AI topology usually needs rebuild for anim)

## Scripts

```bash
# A) Meshy white model (needs MESHY_API_KEY)
python3 tools/meshy/image_to_3d.py \
  --image /path/to/ref.png \
  --out exports/meshy/<name> \
  --no-texture \
  --ai-model latest

# Orient + progress PNGs
blender -b -noaudio --python tools/meshy/import_and_preview.py -- \
  --glb exports/meshy/<name>/model.glb \
  --name <name> \
  --out exports/meshy/<name>/preview
```

## Licensing reminder

Meshy free-tier is often non-exclusive / attribution — check before shipping into
Warcrest exclusive heroes. Prefer paid commercial license or owned rebuild.

## Tie-in

| Doc | Role |
|---|---|
| **This file** | When to abandon sphere kits for neural white models |
| `meshy-pipeline.md` | Product stages |
| `agent-analogue.md` | Stage map for agents |
| `blender-reference-character` | Blockout / owned-IP / remesh QA — not Meshy parity |
