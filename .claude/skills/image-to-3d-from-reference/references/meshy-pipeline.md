# Meshy AI — image-to-3D construction (public pipeline)

Sources: [Meshy Image-to-3D guide](https://www.meshy.ai/tutorials/image-to-3d-model-complete-guide),
[Multi-view guide](https://www.meshy.ai/tutorials/multi-view-image-to-3d),
[Image to 3D API](https://docs.meshy.ai/en/api/image-to-3d),
[Multi-Image API](https://docs.meshy.ai/en/api/multi-image-to-3d).

Meshy does **not** publish full model weights. The **product stages** below are
what their UI/API expose — treat these as the construction contract.

## Stage 0 — Input prep

- Formats: PNG / JPG / WebP; ≥1024px short side (≥2048 for Refine)
- Front or ¾ preferred; plain background; subject fills frame; even light
- One object only (not a scene)
- Optional **Image Enhancement** preprocess for noisy real photos (off for clean CGI)

## Stage 1 — Multi-view synthesis

From **1 photo**, Meshy can **Generate Multi-view**: invent sides / back / ¾ so
geometry is not pure single-view guesswork.

Or upload **1–4 real angles** (Multi-view / Multi-Image API). Missing angles are
still hallucinated; real photos beat invention for asymmetric backs/logos.

Tech framing (Meshy’s own words): diffusion-style understanding of shape/material/depth,
then multi-view synthesis for unseen sides.

## Stage 2 — Geometry (“white model”)

`Generate` builds an **untextured draft mesh** first (~1–2 min). User is expected
to **rotate and reject bad silhouettes before spending texture credits**.

Modes (product):
- **Standard** — denser / higher detail (remesh later)
- **Low Poly (beta)** — leaner game-oriented topology out of the box
- **Smart Topology** (`model_type: smart-topology`) — generate near target face count
  directly (API: often 100–15k faces)

API knobs: `should_texture`, `should_remesh`, `target_polycount`, `decimation_mode`,
`save_pre_remeshed_model`, `ai_model` (e.g. meshy-6), pose A/T for characters.

## Stage 3 — Remesh

When `should_remesh: true`, dense triangle soup is decimated / remeshed toward a
budget. Pre-remesh GLB can be saved separately. Remesh is how they get “clean
enough for Unity/Unreal” claims — still verify edge flow for animation.

## Stage 4 — Texture

Separate pass after white-model approval:

1. UV unwrap  
2. Multi-view diffusion texturing  
3. Back-projection onto the mesh  
4. Super-resolution (optional HD / 4K maps)  
5. PBR pack: base color, normal, metallic, roughness  

**Retexture** = same mesh, new material pass (cheaper than full regen). Text prompt
guides surface (“worn leather”) while image drove shape.

## Stage 5 — Post / export

- Auto-size / origin (`bottom` | `center`)
- Optional auto-rig + animation presets (product feature)
- Export: GLB, FBX, OBJ, USDZ, STL
- Cardinal thumbnails (front/right/back/left) for QA without downloading GLB

## What Meshy optimizes for

End-to-end **product pipeline**: preview → refine → remesh → texture → rig → engine
export. Stronger “finish the asset in one app” than open TripoSR alone.

## Failure modes Meshy documents

Reflective / transparent / hair-fur subjects; harsh shadow bake; busy backgrounds;
tiny subject in frame. Characters need Pose toggle for A/T if rigging next.
