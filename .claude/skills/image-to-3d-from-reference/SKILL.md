---
name: image-to-3d-from-reference
description: >
  Reconstruct how Meshy AI and Tripo AI build 3D models from reference images,
  then run an agent-replicable analogue of that pipeline (multi-view synthesis →
  geometry → remesh → texture → optional rig). Use when the user asks how Meshy
  or Tripo work, wants image-to-3D like those tools, or wants the agent to craft
  a model from a photo/concept the same way those services stage their work.
  Companion to blender-reference-character (parametric Blender path) and
  lowpoly-character-forge (Three.js look-dev). Does NOT replace calling Meshy/Tripo
  APIs when the user has credentials and wants their neural output.
license: MIT
version: 0.1.0
---

# image-to-3d-from-reference

Meshy and Tripo do **not** “draw polygons by hand.” They run a staged neural
pipeline. This skill teaches you (1) **exactly those stages** as publicly
documented / published, and (2) an **agent analogue** that mirrors the same
stages with tools available in Warcrest (vision → reference card → Blender /
procedural mesh → remesh → materials → critique).

## Honest capability boundary

| What Meshy/Tripo do | What this agent can do |
|---|---|
| Trained feed-forward / diffusion nets invent missing views + 3D density | Analyze a reference; optionally author multi-view **cards**; build geometry parametrically or via open TripoSR if GPU available |
| Marching-cubes / neural surface → dense triangle soup | Procedural mesh or imported mesh; Blender remesh/decimate |
| Multi-view diffusion textures + PBR bake | Region materials, projected/painted maps, or keep AI textures if user supplies a licensed GLB |
| Auto-rig / retarget (product features) | `tools/rig/` donor bind or KayKit transfer |

**Do not claim** you “are Meshy.” Claim: you follow the **same pipeline stages**
and converge with critique. If the user has Meshy/Tripo API keys and wants
their mesh, call those APIs — then still run remesh/QA here.

**Licensing (Warcrest):** Meshy free-tier outputs are often **CC BY / non-exclusive** —
unsuitable for exclusive game IP. Prefer paid commercial license, open TripoSR
(MIT mesh), or fully procedural ownership. See `lowpoly-character-forge/references/pipeline.md`.

## Shared pipeline (both products)

```
0. INPUT PREP
   clean subject · plain bg · fill frame · even light · ≥1024px · one object

1. MULTI-VIEW SYNTHESIS
   1 image → invent front/side/back/¾  OR  user uploads 1–4 real angles
   (Meshy: Generate Multi-view; Tripo: image-to-multiview / multiview-to-model)

2. GEOMETRY (white model / untextured)
   latent 3D representation → extract surface mesh
   TripoSR open model: image encoder → triplane NeRF → Marching Cubes + vertex color
   Meshy: diffusion-assisted recon → draft white mesh (~1–2 min)

3. REMESH / TOPOLOGY
   decimate · quad remesh · smart low-poly · target face count
   (Meshy: should_remesh / Low Poly / smart-topology; Tripo: mesh/decimate, quad)

4. TEXTURE
   UV unwrap → multi-view diffusion / back-project → optional PBR (albedo, N, M, R)
   Retexture without regenerating mesh is a first-class step in both products

5. OPTIONAL POST
   auto-size/origin · segment parts · pose (A/T) · auto-rig · retarget · export GLB/FBX
```

Read `references/meshy-pipeline.md` and `references/tripo-pipeline.md` for
product-specific detail. Read `references/agent-analogue.md` before building.

## When to use

- User asks how Meshy / Tripo construct models from images
- User wants “make this like Meshy/Tripo would” from a reference
- Choosing between API call vs procedural analogue vs hybrid

## Workflow for the agent (MANDATORY)

### A. If explaining
Summarize the shared pipeline above + product differences. Point to the
reference docs. Do not invent proprietary layer names beyond public docs/papers.

### B. If constructing (agent analogue)

Follow `references/agent-analogue.md` in order:

1. **Input prep checklist** on the reference image (Read the image).
2. **Multi-view card** — front + side (+ back if inferable) landmarks, silhouettes,
   palette (extends `blender-reference-character` reference card).
3. **Geometry pass** — white/untextured first (Meshy’s “review white model” gate):
   - Prefer `blender-reference-character` parametric build, OR
   - open TripoSR if CUDA available and user wants neural draft, OR
   - import user-provided Meshy/Tripo GLB as blockout only.
4. **Remesh** — hit game budget (Warcrest troops ~2k tris; heroes higher).
5. **Texture / materials** — region PBR or stylized toon; never bake lighting into albedo if avoidable.
6. **Critique** — render front/¾/side/back; score vs reference like Meshy’s white-model review.
7. **Optional rig** — `tools/rig/` donor skeleton; do not trust AI auto-rig for production heroes without QA.

### C. If user wants actual Meshy/Tripo output
Use their API/docs with user credentials. Still run stages 3–6 here for game readiness.

## Relation to other skills

| Skill | Role |
|---|---|
| **image-to-3d-from-reference** (this) | How Meshy/Tripo stage work + agent analogue |
| `blender-reference-character` | Parametric Blender geometry + critique from a card |
| `lowpoly-character-forge` | Three.js toon look-dev / sprite export |
| `tools/rig/` | Bind to donor clips for Warcrest |

## Anti-patterns

- Jumping to a textured hero without a white-model / silhouette check
- Treating AI topology as animation-ready (joint loops are usually wrong)
- Shipping free-tier Meshy meshes into exclusive Warcrest IP
- Single-view guess for asymmetric characters when multi-view is available
- Baking HDRI lighting into albedo (Meshy/Tripo also warn about harsh photo shadows)
