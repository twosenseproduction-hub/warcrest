# Meshy character style — Purple Elf canon

Use this as the **house style** when generating other Warcrest / Meshy units.
Source of truth: `assets/models/meshy/purple_elf_ref.jpg` + shipped `purple_elf_meshy.glb`.

## Visual rules (non-negotiable)

1. **Low-poly + flat shade** — visible facets, hard edges, no smooth normals.
2. **Matte paint** — diffuse only. No chrome, no strong specular, no normal maps.
3. **Hand-painted filigree** — silver/white scrollwork is *in the albedo*, not geometry.
4. **Saturated, readable palette** — primary armor hue + silver trim + one emissive accent.
5. **T-pose / A-pose** for generation; animate after with Meshy Rig + Animation Library.
6. **Single character, empty hands** in the blockout mesh (weapons can be props later).

## Palette (from the purple elf ref)

| Role | Approx hex | Notes |
|------|------------|-------|
| Armor primary | `#503060`–`#6a3a7a` | Deep royal purple plates |
| Skin | `#b898c8`–`#c8a8d0` | Lavender |
| Hair | `#402050` | Dark violet crest |
| Trim / filigree | `#e0e0e8`–`#f0f0f0` | Silver-white scrollwork |
| Emissive accent | `#40ff40`–`#80ff40` | Eyes + armor gems only |
| Background (refs) | `#f0f0e0` / studio white | Clean turnaround photos |

When making **other factions**, keep the same *rules* but swap the primary:
- Elf → purple / sage / gold
- Human → steel / crimson / brass
- Orc → olive / bone / rust
- Undead → charcoal / sickly green / bone

## Meshy generation recipe

```text
model_type: lowpoly
pose_mode: t-pose
should_texture: true
enable_pbr: false          # critical — PBR metalness = chrome armor
```

Then locally:
```bash
python3 tools/.meshy-work/facet_glb.py <raw>.glb -o <out>.glb
```

In-engine: `material.flatShading = true` (smooth shading kills the polygon look).

## Texturing — why the reference image “removes color”

Meshy **Retexture** `image_style_url` is a *style* guide, not a color-locked transfer.
It often:
- desaturates / greys the paint
- reinterprets lighting
- ignores your exact purple/lavender

### Do this instead (keeps color)

Use **`text_style_prompt`** with **explicit saturated colors** (and optional hex).  
Do **not** pass `image_style_url` if you need palette fidelity (image wins and washes color).

```bash
MESHY_API_KEY=… python3 tools/.meshy-work/retexture_keep_color.py \
  --input-task-id <meshy_task_id> \
  --ref assets/models/meshy/purple_elf_ref.jpg \
  --name my_unit
```

The helper:
1. Samples armor / skin / trim / accent colors from `--ref` (hue-aware)
2. Builds a text prompt that names those colors + “flat matte hand-painted low-poly”
3. Calls Retexture with `enable_pbr: false`, `remove_lighting: true`, **no** `image_style_url`

Verified on the purple elf lowpoly mesh → `purple_elf_keepcolor_color.glb` (purple plates + green eyes retained; image-style runs washed to silver/grey).

### If you must use an image style
- Prefer Image-to-3D *from* the colored turnaround (best color lock), not retexture-from-image.
- Or retexture with text colors, then locally multiply/grade the albedo toward the ref palette.

## Prompt skeleton for new characters

```
Clean stylized low-poly <ROLE> in T-pose, sharp geometric facets, flat planar
armor plates, <SKIN COLOR> skin, <HAIR>, glowing <ACCENT> pupil-less eyes,
ornate <PRIMARY> plate armor with silver-white filigree scrollwork, layered
pauldrons, bracers, hanging tasset plates, greaves, bright <ACCENT> gems on
chest and waist, matte hand-painted mobile RPG look, symmetrical, single
character, empty hands, no weapons, no base, studio turntable
```

## Pipeline order

1. Concept / turnaround image (keep colors vivid on white/grey bg)
2. Meshy Image-to-3D `lowpoly` (or text-to-3D with the skeleton above)
3. Optional: `retexture_keep_color.py` if albedo drifted
4. `facet_glb.py` + matte factors
5. Meshy Rig → Animation Library clips (idle/walk/run/attack…)
6. Preview: `tools/.meshy-work/render_purple_elf_anims.py` pattern
