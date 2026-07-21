# Tutorial follow-through (Jelle Vermandere start→finish)

See `TUTORIAL_STUDY.md` for the video study notes.

| File | Stage |
|------|--------|
| `tutorial_avatar.blend` | Full scene after model→UV→texture→Rigify→anims |
| `tutorial_avatar.glb` | Textured static mesh |
| `tutorial_avatar_rigged.glb` | Metarig + automatic weights |
| `tutorial_avatar_anim.glb` | Hand-keyed `idle` + `walk` |

```bash
blender -b -noaudio --python tools/blender-character/follow_jelle_tutorial.py
```

## Live visual monitoring (headless)

Prefer preview PNGs + dashboard over VNC for AI-inspectable progress:

```bash
./tools/blender-monitor/bin/run-job.sh tools/blender-character/follow_blender_guru_donut.py
# → http://127.0.0.1:7788/   and status.json + previews/ for agents
```

See `tools/blender-monitor/README.md`.

## Purple plate elf (earlier)

Drive T-pose plate elf poly-model + HumanF pack anims — see `YOUTUBE_WORKFLOW.md`.
