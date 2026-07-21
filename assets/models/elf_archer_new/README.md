# Night Elf Archer (Meshy, textured T-pose)

New purple night-elf archer concept lifted to a textured `.glb` via the
**Sorceress** Tools API (`meshy-6` image-to-3D, `should_texture: true`).

## Files

| Path | What |
|------|------|
| `../elf_archer_meshy.glb` | Game-ready mesh + embedded albedo + normal maps (~12 MB) |
| `_ref.jpg` | Source concept (Google Drive upload, 1024²) |
| `elf_archer_meshy_thumb.png` | Meshy preview render |
| `elf_archer_meshy_albedo.jpg` | Extracted 2048² albedo atlas |
| `provenance.json` | Job id, credits, params |

## Preview in-engine

Open the game with `?models=meshy-archer`. This swaps `elf:archer` to the
new mesh. It is a **static T-pose** (no skeleton / clips yet) — units will
bob in place rather than walk/attack.

## Next steps (Sorceress 3D Studio / WizardGenie)

Per the Meshy pipeline video: send this mesh to **rig → weight paint →
text-to-animation → drive mode → export**, then replace the live
`rim_walker_mdx.glb` archer once idle/walk/attack/death clips exist.
