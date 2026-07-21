# Joey Carlino Bizzo — recreate study

**Video:** https://www.youtube.com/watch?v=O6HQhs-gk50  
**Official T-pose:** `../joey_cat_refs/ref_00_Ha3JhPE.png`

## Storyboard snapshots

Chapter stills under `chapter_frames/` (from YouTube storyboard grids ≈ every 10s).

```bash
./tools/blender-character/yt_snapshot_frames.sh https://youtu.be/O6HQhs-gk50
```

## Recreate (v3)

Joey separate-object workflow matching the Imgur T-pose (chunky head, cheek spikes,
bell coat, bridging legs, ankle+toe boots — not a skinny Skin blob):

```bash
./tools/blender-monitor/bin/run-job.sh --name bizzo-v3 \
  tools/blender-character/follow_joey_cat_v3.py
```

Outputs: `../bizzo_cat_v3.{blend,glb}` · demo stills `../bizzo_demo/10_v3_*.png` ·
artifacts `/opt/cursor/artifacts/blender_joey_bizzo/v3_*.png`

Note: this is the constructive/blockout stage of Joey’s beginner tutorial (separate
objects → join). His finished Imgur mesh is cleaner after further sculpt/cleanup.

## Chapters → build stages

| Chapter | Our stage |
|---------|-----------|
| Cat character / Head | Broad head, ears, hair tufts, cheek spikes, face cards |
| Coat | Solidify sweater + turtleneck + wide sleeves |
| Hands | Palm + finger capsules |
| Shoes | Shorts, short fur legs, chunky boots + pink tongue + white sole |
| Color | Palette Principled materials |
| Join | Apply modifiers → join → normalize height |
