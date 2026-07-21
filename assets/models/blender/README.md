# Blender purple plate elf

Low-poly unit built in Blender from the Drive T-pose reference
(`purple_plate_elf_ref.jpg`), following the YouTube poly-model workflow in
`YOUTUBE_WORKFLOW.md`.

## Assets

| File | Notes |
|------|--------|
| `purple_plate_elf_ref.jpg` | Canon front T-pose reference |
| `purple_plate_elf.blend` | Editable Blender scene |
| `purple_plate_elf.glb` | Static mesh (flat matte materials) |
| `purple_plate_elf_rigged.glb` | Skinned to Human Archer FREE `HumanF` |
| `purple_plate_elf_pack_anim.glb` | Pack clips: idle, bow_idle(+alt), attack_load/hold/release, walk, run |

## Rebuild

```bash
blender -b -noaudio --python tools/blender-character/build_purple_plate_elf.py
blender -b -noaudio --python tools/blender-character/rig_humanf_anims.py
python3 tools/blender-character/render_anims.py
```

Requires the Human Archer FREE extract under
`tools/.meshy-work/drive_anims_extracted/` (gitignored).
