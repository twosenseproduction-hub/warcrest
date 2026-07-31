# Night Elf Archer (Drive Meshy import)

User-preferred Meshy export from Google Drive (`15AomYJC-tnxaEtC7aiOvxsM5-0wtEwJd`).
A-pose archer with **bow + quiver**. The Drive GLB was geometry-only
(no UVs, materials, skins, or clips).

## Files

| Path | What |
|------|------|
| `../elf_archer_drive.glb` | Game mesh — planted, decimated ~30k tris, purple vertex colors |
| `elf_archer_drive_raw.glb` | Exact Drive upload (~445k tris, positions only) |
| `elf_archer_drive_preview.png` | Local shaded preview |
| `elf_archer_drive_concept.png` | Sorceress GPT Image 2 painted concept (for later textured 3D) |
| `elf_archer_meshy.glb` (parent) | Earlier textured T-pose (no bow) — kept for comparison |
| `_ref.jpg` | Original purple T-pose concept |

## Preview

`?models=drive-archer` or `?models=meshy-archer`

## Blocked next steps (Sorceress)

- **Textured remesh** (Hunyuan / Tripo / Meshy): needs ≥30 credits (balance was 26).
  Concept image is ready — re-run `model_generate` when topped up.
- **Rig + text-to-anim**: Studio UI only (`/3d-studio`, `/rigging`) — not on the Tools API.
  Export an animated GLB from Studio and drop it here to replace the live archer.
