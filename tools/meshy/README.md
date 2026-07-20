# Meshy helpers (optional study only)

These scripts can fetch a commercial Meshy mesh for **side-by-side comparison**
when the user explicitly wants that. **Warcrest’s default sharp path does not
use Meshy as the builder** — see
`.claude/skills/image-to-3d-from-reference/references/sharp-detail-path.md`.

```bash
# Only if user asks for a Meshy comparison AND MESHY_API_KEY is set:
python3 tools/meshy/image_to_3d.py --image ref.png --out exports/meshy/study --no-texture
blender -b -noaudio --python tools/meshy/import_and_preview.py -- \
  --glb exports/meshy/study/model.glb --name study --out exports/meshy/study/preview
```
