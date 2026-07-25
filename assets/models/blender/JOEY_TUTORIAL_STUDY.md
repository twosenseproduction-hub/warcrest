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
| Ortho front / side / back plates | `joey_cat_refs/ortho_{front,side,back}.png` |
| Color palette strip | `joey_cat_refs/palette.png` |
| Connected topo stills | `/opt/cursor/artifacts/blender_joey_bizzo/topo_{front,side,back}.png` |

## Connected clean-topology rebuild

Script: `tools/blender-character/follow_joey_cat_topo.py`

Pipeline:

1. Orthographic reference planes (front = official; side/back inferred plates)
2. Looped volumes with joint rings + edge creases
3. Exact boolean UNION into a body shell
4. Subdivision Surface (detail-preserving creases) + Multires (sculpt levels in Blender)
5. Export `bizzo_cat_topo.glb` (~30k verts after Subsurf apply)

```bash
blender -b -noaudio --python tools/blender-character/follow_joey_cat_topo.py
```

Outputs: `bizzo_cat_topo.{blend,glb}`

Note: voxel remesh was tried for single-island welding but melted the silhouette — kept intentional looped cage + Multires instead.
