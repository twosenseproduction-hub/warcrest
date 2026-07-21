# Joey Carlino Bizzo — tutorial study

**Video:** [Character modeling for beginners - Blender](https://www.youtube.com/watch?v=O6HQhs-gk50)  
**Joey Carlino** · ~48 min · main result: stylized cat **Bizzo**  
**Official refs:** https://imgur.com/a/tnkGXf2 → `joey_cat_refs/`

## Can we see the video?

**Not as a player.** Full download is blocked here (`yt-dlp`: “Sign in to confirm you’re not a bot”), so we **cannot** dump a frame every 5 seconds from the stream.

What we *can* see visually:

| Asset | Path |
|-------|------|
| YouTube thumbnail | `/opt/cursor/artifacts/yt_O6HQhs-gk50/thumb.jpg` |
| Official Imgur front T-pose | `joey_cat_refs/ref_00_Ha3JhPE.png` |
| Color palette strip | `joey_cat_refs/palette.png` |
| Our rebuild still | `/opt/cursor/artifacts/blender_joey_bizzo/still.png` |
| Ref vs rebuild | `/opt/cursor/artifacts/blender_joey_bizzo/compare_ref.png` |

Plus the full English transcript (chapters: Human model → Cat → Head → Coat → Hands → Shoes → Color → Join).

To unlock every-5s screenshots later: export YouTube cookies into this environment and re-run `yt-dlp`, then `ffmpeg -i bizzo.mp4 -vf fps=1/5 frames/f_%04d.png`.

## Joey’s pipeline (what we copied)

1. **Separate limbs** — head, coat, sleeves, hands, shorts, legs, boots as distinct objects (not one welded mesh while modeling).
2. **Mirror** — build one side, mirror across X.
3. **Subdivision Surface** — organic rounding from simple cubes/cylinders.
4. **Solidify** — coat thickness.
5. **Skin-style fingers** — capsule finger volumes (Joey uses Skin modifier).
6. **Palette colors** — we use Principled BSDF slots (glTF-safe) matching the Imgur palette.
7. **Join + apply modifiers** → export GLB.

## Rebuild outputs

| File | Role |
|------|------|
| `tools/blender-character/follow_joey_cat.py` | Scripted rebuild |
| `bizzo_cat.blend` / `bizzo_cat.glb` | Scene + game export |

This is a **proportion/palette/workflow** copy of Bizzo from the official ref + transcript, not a vertex-perfect replay of every click in the video (those need the frame dump above).
