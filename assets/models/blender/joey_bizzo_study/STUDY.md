# Joey Carlino Bizzo — recreate study

**Video:** https://www.youtube.com/watch?v=O6HQhs-gk50  
**Official T-pose:** `../joey_cat_refs/ref_00_Ha3JhPE.png`

## Storyboard snapshots

Chapter stills under `chapter_frames/` (from YouTube storyboard grids ≈ every 10s).

```bash
./tools/blender-character/yt_snapshot_frames.sh https://youtu.be/O6HQhs-gk50
```

## Recreate — preferred: connected topo

Clean boxy volumes → boolean union → Subsurf + Multires. This reads better than
the lumpy separate-object v3 and is the preferred ship (`bizzo_cat_topo.*`,
demo `01_front.png`).

```bash
./tools/blender-monitor/bin/run-job.sh --name bizzo-topo \
  tools/blender-character/follow_joey_cat_topo.py
```

## Alternate: separate-object v3 (superseded)

Joey constructive stages without boolean weld (kept for study comparison):

```bash
./tools/blender-monitor/bin/run-job.sh --name bizzo-v3 \
  tools/blender-character/follow_joey_cat_v3.py
```

Outputs: `../bizzo_cat_v3.{blend,glb}` · demo stills `../bizzo_demo/10_v3_*.png`

## Chapters → build stages

| Chapter | Preferred topo stage |
|---------|----------------------|
| Cat character / Head | Wide box head, ears, hair, cheek spikes, face cards |
| Coat | Flared sweater + turtleneck + sleeves (boolean weld) |
| Hands | Palm + thumb welded into cuffs |
| Shoes | Shorts, bridging legs, separate chunky boots |
| Color | Palette Principled materials |
| Join | Exact boolean UNION → one manifold shell + Multires |
