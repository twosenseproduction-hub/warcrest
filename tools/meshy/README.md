# Meshy helpers (Warcrest)

Fetch **sharp** image→3D meshes from Meshy, then preview as PNGs.

## Setup

Add Cursor Cloud secret / env:

```bash
export MESHY_API_KEY=...
```

Confirm your Meshy plan allows the intended game use (free tier is often
non-exclusive).

## White model first (recommended)

```bash
python3 tools/meshy/image_to_3d.py \
  --image /path/to/reference.png \
  --out exports/meshy/<name> \
  --no-texture

blender -b -noaudio --python tools/meshy/import_and_preview.py -- \
  --glb exports/meshy/<name>/model.glb \
  --name <name> \
  --out exports/meshy/<name>/preview
```

Open the PNGs under `preview/` (and copy to `/opt/cursor/artifacts/…`).

## Or drop a GLB

If you already generated in the Meshy UI, place the GLB and run
`import_and_preview.py` only.

See skill: `.claude/skills/image-to-3d-from-reference/references/sharp-detail-path.md`.
