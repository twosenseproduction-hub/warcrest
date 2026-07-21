# Blender Guru — Beginner Blender Tutorial (2026) / Donut 5.0

**Video:** https://www.youtube.com/watch?v=z-Xl9tGqH14  
**Channel:** Blender Guru (Andrew Price) · **~4h 19m** · Blender **5.0** donut + mug

Full remake of the classic donut course in one upload: interface → modelling → materials → UVs → sprinkles → lighting/render.

## Snapshot status

Storyboard stills (no cookies needed):

```bash
./tools/blender-character/yt_snapshot_frames.sh https://youtu.be/z-Xl9tGqH14
```

| Path | Contents |
|------|----------|
| `/opt/cursor/artifacts/yt_z-Xl9tGqH14/frames/` | **1556** stills ≈ every **10s** |
| `chapter_frames/` (this folder) | 8 official part starts |
| `milestones_10m/` | Still every **10 minutes** (~26) for scrubbing |
| `chapter_contact_sheet.jpg` | Labeled 8-part overview |
| `milestones_10m_contact_sheet.jpg` | Dense timeline grid |
| `TRANSCRIPT.txt` | Full English narration |

## Official parts

| Time | Part |
|------|------|
| 0:00 | Part 1 The Basics |
| 28:16 | Part 2 Basic Modelling |
| 59:05 | Part 3 Organic Modelling |
| 1:30:13 | Part 4 Materials |
| 2:03:46 | Part 5 Texturing |
| 2:35:40 | Part 6 UV Unwrapping |
| 3:09:26 | Part 7 Scattering |
| 3:46:11 | Part 8 Lighting and Rendering |

## Workflow takeaways (Warcrest-relevant)

1. **Navigate first** — MMB orbit, Shift+MMB pan, scroll zoom; Numpad `.` / `~` → View Selected; fix lost view via axis gizmo / Numpad 1/3/7.
2. **Primitives → edit** — Shift+A mesh that matches the form (torus→donut, cylinder→mug); tweak Add settings before clicking away (F9 last operator).
3. **G / R / S + axis lock** — grab/rotate/scale; type axis letter; Ctrl for snap; Shift for fine drag on values.
4. **Non-destructive stack** — Solidify for thickness, Subdivision Surface for smoothness; **Apply** only when you need real geo (e.g. handle join).
5. **Edit toolbox** — Tab; 1/2/3 vert/edge/face; **E** extrude, **I** inset, **Ctrl+R** loop cut, **F** face / bridge edge loops; Alt+click edge loops; double-G edge slide.
6. **Shade Smooth** + keep quads when possible under Subsurf (avoid n-gons on curved surfaces).
7. **Reference images** — Add → Image → Reference (or drag-drop); Alt+R clear rot; ortho views for proportion.
8. **Materials** — Principled BSDF, roughness/base color; later texture nodes + Attribute/UV.
9. **UV unwrap** before painted/image textures; Shader Editor for node wiring.
10. **Scattering** — sprinkles via particle / Geometry Nodes pattern (detail density without hand-placing).
11. **Lighting & render** — camera, lights, Eevee/Cycles look; color management for final still.

## Mapping onto our characters

| Donut lesson | Bizzo / plate-elf action |
|--------------|--------------------------|
| Subsurf + solidify | Clothing/armor shells keep modifiers until export bake |
| Loop cuts / inset | Joint loops, collar, boot rims |
| Reference image planes | Ortho front/side/back in `joey_cat_refs/` / plate-elf ref |
| Principled materials | Prefer Principled for glTF (avoid Diffuse-only white export) |
| Shade Smooth | Match flat vs smooth look to game style consciously |
| Apply modifiers before join | Same rule before Remesh / Multires sculpt |

This is **foundational modelling**, not Multires sculpt. Pair with Ryan King (`ryan_king_sculpt/`) for Grab / Clay Strips / Remesh sculpt passes.

## Resources

- https://www.blenderguru.com/posts/blender-donut-v5-tutorial
- Poliigon (textures/HDRIs mentioned in description): http://www.poliigon.com
