# Pipeline & AI options

## What an LLM can / can't do
Claude reliably writes procedural geometry, GLSL / `onBeforeCompile` shaders, material
and lighting setups, the parametric generator, and the render/critique harness. Claude
**cannot** emit a high-quality mesh directly the way a trained 3D-gen model does. So the
architecture puts the *parametric generator* at the center — not "ask the LLM for a mesh."

## Recommended hybrid (procedural-first, fully owned)
1. **Primary:** Claude-generated procedural Three.js — free, code-only, exact control,
   you own the output outright.
2. **Concept/reference:** use image generation (already paid for) for a front/side
   concept of the character; feed it to Claude as the critique-loop style target + palette.
3. **Textures:** procedural ramps (`DataTexture`/`CanvasTexture`) or matcaps; optional
   image-gen for a painted skin/cloth/emissive map.
4. **Optional blockout only:** image-to-3D for hard forms, then rebuild procedurally to
   keep licensing clean.

## Image-to-3D options (optional accelerators — NOT dependencies)
All output static, single-object, lighting-baked geometry needing cleanup; treat as
reference/blockout. Re-verify licenses before commercial use.
- **TripoSR** — MIT, single-image→mesh, ~6GB VRAM, fast/low-quality, bakes lighting.
- **Stable Fast 3D** — Stability Community License (free under $1M revenue), albedo-only.
- **InstantMesh** — multi-view, CUDA-oriented.
- **Hunyuan3D 2.1** — Tencent Community License, high-fidelity PBR, NVIDIA-first.
- **TRELLIS / TRELLIS.2** — MIT, production PBR, clean topology; CUDA-first but a
  community **TRELLIS-Mac** MPS port exists (~5 min/asset on M4 Pro).
- **Meshy free tier** — 100 credits/mo, auto-rig, BUT free outputs are **CC BY 4.0
  (attribution + public)** — unsuitable for a game where you want exclusive rights.
  Only paid plans grant private ownership.

Most local stacks are CUDA/NVIDIA and don't run natively on Apple Silicon. The
procedural path has no such dependency — that's why it's the spine.

## Animation
Pose statically in code for renders/sprites. For in-game skeletal animation, export
`.glb` and rig in Blender (or a paid auto-rig), or — in Warcrest — keep the animated
KayKit roster for movement and use procedural exports for hero art / stills until rigged.

## Thresholds that change the recommendation
Many unique *animated* characters at scale → revisit a Blender rigging step or a paid
3D-gen/auto-rig plan. Headless GPU WebGL failing on a future OS → use the headless-gl
fallback or render headed and screenshot. WebGPU headless maturing → consider
`WebGPURenderer`/TSL for the shading modules.
