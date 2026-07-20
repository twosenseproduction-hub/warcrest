# Agent analogue — do the same *stages* without their weights

Mirror Meshy/Tripo’s construction contract in Warcrest. Each stage has a
**neural product action** and an **agent action**.

## Stage map

| # | Product stage | Agent action |
|---|---|---|
| 0 | Input prep | Read image; reject bad refs; crop/plain-bg notes |
| 1 | Multi-view synthesis | Build multi-view **card**: front + side (+ back) silhouettes, landmarks, palette |
| 2 | White model | Parametric Blender / Three.js mesh **without** fancy textures; or TripoSR GLB if GPU; or import licensed Meshy/Tripo white mesh |
| 3 | Remesh | Decimate / voxel remesh / rebuild on donor bones (`tools/rig/build_unit.py`) to game tris |
| 4 | Texture | Region materials (Warcrest toon) or PBR maps; retexture = material pass only |
| 5 | QA thumbs | `render_views.py` angles 0,90,180,270 — Meshy’s cardinal thumbnail idea |
| 6 | Rig | Donor bind / KayKit transfer — never skip deformation test |

## Stage 0 — input checklist (fail fast)

- [ ] Single subject  
- [ ] Subject ≥ ~60% of frame  
- [ ] Background simple or keyed  
- [ ] Lighting even (no hard baked shadows on albedo intent)  
- [ ] Resolution usable (≥512; prefer ≥1024)  
- [ ] Character? Note desired pose (T / A / action)

If the ref is a stylized illustration (like our antler elf), treat it as **concept art**:
multi-view must be **inferred** into the card (Meshy would hallucinate views too).

## Stage 1 — multi-view card (extends blender-reference-character)

Add to the JSON card:

```json
{
  "views": {
    "front": { "silhouette_notes": "...", "landmarks_visible": ["..."] },
    "side":  { "silhouette_notes": "...", "depth_cues": ["..."] },
    "back":  { "inferred": true, "notes": "bun volume, cape/armor backside" }
  },
  "asymmetry": false,
  "construction_mode": "agent_analogue"
}
```

**Hard gate:** no geometry until front silhouette landmarks are listed.

## Stage 2 — white model first (Meshy’s credit-saving gate)

Deliver an untextured or flat-shaded mesh and critique **shape only**:
proportions · silhouette · landmark presence · genus (no unwanted holes).

**Preferred geometry method: parts-first** (see
`blender-reference-character/references/parts-first.md`):
inventory limbs/armor/cloth/accessories from the reference → craft each part →
assemble on sockets. This is how we keep pauldrons/capes/boots sharp instead of
smearing them into a single Meshy-style blob.

Tools:
- `.claude/skills/blender-reference-character/` (preferred for owned IP)
- Optional: run TripoSR locally if CUDA + user OK with MIT neural draft as **blockout only**, then rebuild procedurally **per part**
- Optional: user-paid Meshy/Tripo GLB as blockout; use Tripo **segmentation** ideas to split kit pieces, then rebuild

## Stage 3 — remesh for Warcrest

Targets (guide, not law):
- Troop: ~1.5k–3k tris  
- Hero display: higher OK if LODs exist  
- Prefer **rebuild on donor skeleton** over fighting MC soup for animated units

Blender: Decimate / Remesh / manual; or `tools/rig/build_unit.py` skin-on-bones.

## Stage 4 — texture / look

Warcrest path: **region materials + engine toon** (matches forge).  
Photoreal path: albedo/N/M/R but strip baked lighting.

Retexture = change materials/maps only; do not regenerate silhouette.

## Stage 5 — multi-view QA (copy Meshy)

```bash
blender -b -noaudio --python \
  .claude/skills/blender-reference-character/scripts/render_views.py -- \
  --glb <model>.glb --angles 0,90,180,270 --out <frames>
```

Score each view against the card. One-knob refine.

## Stage 6 — rig

`tools/rig/build_unit.py` or `rig_to_kaykit.py`. Verify run clip deforms.

## Hybrid recommended for Warcrest heroes

```
reference image
  → multi-view card (this skill)
  → procedural/Blender white model (blender-reference-character)
  → critique vs ref (front/¾/side)
  → donor bind (tools/rig)
  → in-engine toon (Render3D)
```

Use Meshy/Tripo neural meshes only as **licensed blockout references**, then rebuild
for ownership + animatable topology — same advice as `lowpoly-character-forge/references/pipeline.md`.
