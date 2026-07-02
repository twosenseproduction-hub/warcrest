---
name: lowpoly-character-forge
description: >
  Generate and iteratively refine Bitgem-style stylized low-poly 3D characters in
  Three.js entirely from code — smooth-shaded low-poly geometry, toon gradient
  shading, emissive bloom, inverted-hull outlines, fresnel rim. Use when the user
  asks to create, generate, model, sculpt, or refine a low-poly / chibi / stylized /
  hand-painted 3D character, weapon, or creature in Three.js, or to render, critique,
  or export one as .glb or a sprite sheet. Bundles a headless render→critique→refine
  loop. In Warcrest, exported .glb drops into assets/models/ and registers via
  RTS.Render3D.registerUnitModel.
license: MIT
version: 0.1.0
---

# lowpoly-character-forge

Build stylized low-poly characters **from code** — no paid asset packs, no 3D-gen
models. The "Bitgem look" is a shading recipe (smooth normals on low-poly geometry
+ toon ramps + fresnel rim + inverted-hull outline + emissive bloom), all of which
an LLM writes reliably. The deliverable is a parametric generator plus a headless
render loop so you can critique renders against a reference and converge.

## When to use

Creating/refining a stylized character/weapon/creature in Three.js; matching a
reference image; exporting a `.glb` or sprite sheet. NOT for realistic/high-poly
assets or for rigging complex skeletal animation by hand (export and rig in Blender
for that — see `references/pipeline.md`).

## What's here

```
scripts/
  lib/materials.js       # toon ramp, fresnel rim, inverted-hull outline, smooth(), facet()
  lib/parts.js           # parametric builders: head, ears, torso, limbs, lathe, blade
  lib/lighting.js        # three-point + hemisphere rig, shadows, tone mapping
  lib/build-character.js # composes parts into a posed character; buildElf(params)
  render-page.html       # in-browser Three.js harness (UMD; loads vendor/ + lib/)
  render_turntable.py    # headless render N angles + export .glb (Chromium/swiftshader)
  vendor/                # self-contained three r144 + GLTFExporter + bloom passes
references/               # style-guide, shading-cookbook, geometry-cookbook,
                          # headless-render, pipeline (read these for detail/recipes)
renders/                 # output PNGs + exported .glb
```

The `lib/*.js` modules are plain browser-global JS (attach to `window.LPF`, use the
global `THREE`), so the SAME code runs in the headless harness, in a cloud-chat HTML
artifact, and inside Warcrest's renderer. No build step, no ES-module/CDN dependency.

## Workflow (follow in order — this is what makes the loop converge)

1. **Concept.** Read the reference image; restate the style target as concrete params:
   palette (e.g. violet skin `#8a5cd0`, navy cloth `#26314f`, gold accent `#f2c14e`,
   green leaf `#4fae6b`, glowing blade emissive `#40ffa0`), proportions (big head,
   tapered limbs), silhouette cues (pointed ears, raised-weapon stance), what glows.
2. **Blockout.** Compose grouped primitive parts in `build-character.js` (a `Group`
   per limb so it poses by rotation). Check proportions/silhouette from front + side.
3. **Smooth.** `LPF.smooth(geo)` — welds verts + averages normals so low-poly reads
   smooth. Use `LPF.facet(geo)` only for gems/crystals you want faceted.
4. **Shade.** One toon material per region (`LPF.toon(color, {ramp})`) — no UVs.
   Soft ramp for skin, crisp 2-step ramp for cloth (`LPF.RAMP`).
5. **Emissive + bloom.** Bright `emissive`/`emissiveIntensity` on blades/crystals;
   `UnrealBloomPass` in the harness keys off luminance > threshold. **Keep the
   background dark and lit diffuse < ~0.9** or the whole frame blooms white.
6. **Outline.** `LPF.outlineGroup(group, thickness)` adds inverted-hull shells.
7. **Pose.** Rotate limb groups into a dynamic action stance.
8. **Render + critique.** `python3 scripts/render_turntable.py --build <name>
   --angles 0,45,90,135,180,225,270,315`. Load the PNGs, compare to the reference,
   and produce a **structured, prioritized** diff against named criteria:
   silhouette · proportions · palette match · banding · rim · bloom · outline · pose.
9. **Refine.** Map each critique to ONE named param and re-render. Converge knob by
   knob (e.g. blown-out → lower `lighting` key + raise bloom threshold + deepen ramp;
   blobby silhouette → exaggerate `headScale`/taper; weak glow → raise emissive).
10. **Export.** `--export renders/<name>.glb` (in-page `GLTFExporter`). Note: custom
    toon/fresnel/outline shaders **do not serialize** — the `.glb` carries geometry +
    standard materials; the in-game engine reapplies the look (Warcrest already does).

## Rendering environment

- **This cloud Linux box:** `render_turntable.py` uses Chromium + swiftshader
  (`--use-gl=angle --use-angle=swiftshader`), the same path that renders the game
  headlessly. It just works here.
- **Apple Silicon Mac:** swiftshader's WebGL is disabled on ARM — launch headless
  Chrome with `--enable-gpu --use-angle=metal` instead. See `references/headless-render.md`.
- **Cloud chat (no Node/headless):** emit a self-contained HTML artifact that inlines
  the same `lib/*.js` and renders an OrbitControls turntable the user can see live.

## Using a result in Warcrest

Drop the exported `.glb` into `assets/models/` and register it:

```js
RTS.Render3D.registerUnitModel('elf:hero', { url: 'assets/models/elf_hero.glb',
  height: 62, yaw: Math.PI, anims: { idle: 'Idle', walk: 'Walking' } });
RTS.Render3D.loadUnitModels();
```

Procedural static-posed exports have no animation clips; for in-game movement either
rig in Blender or keep using the animated KayKit roster and use these for hero shots.

## Key facts (full detail in references/)

- Low-poly-but-smooth = **normals**, not geometry: strip normal/uv, `mergeVertices`,
  `computeVertexNormals`. Indexed → smooth; `toNonIndexed` → faceted.
- Toon banding = `MeshToonMaterial` + a `NearestFilter` `DataTexture` ramp; texel
  count/values control the bands. Color-block by region material (avoids UV unwrap).
- Inverted hull outline = backface shell pushed out along normals in the vertex shader.
- Bloom keys off luminance over threshold — dark bg + restrained lighting or it blows out.
- An LLM cannot emit a good mesh directly, but is excellent at the parametric generator,
  shaders, lighting, and the critique loop. 3D-gen models are optional blockout only.
