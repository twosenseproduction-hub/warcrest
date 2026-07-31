# Show progress PNGs (REQUIRED every step)

The user must **see the model develop**. Do not work silently across multiple
builds and only show a final frame. After almost every step, render a PNG and
**Read it** so it appears in the chat / walkthrough.

## Hard rule

After each of these events, produce at least **one front PNG** (angle `0`) and
Read it with the Read tool:

| Step | When | Minimum PNGs | Suggested path |
|---|---|---|---|
| Light scan | After `light_scan_reference.py` | `06_scan_sheet.png` | `exports/.../light-scan/<name>/` |
| First blockout | After first GLB export | front (+ ¾ if cheap) | `exports/.../progress/<name>/01_blockout_front.png` |
| Priority-1 part | After each major part band (head/hair, pauldrons, cape, boots) | front crop or full | `.../02_hair_front.png` etc. |
| Full assemble | After join/sockets | front + ¾ | `.../10_assemble_front.png` |
| Clay / relief | Before form critique | front clay | `.../11_assemble_clay.png` |
| Each refine | After **every** one-knob rebuild | front (same angle as before) | `.../12_refine_<knob>_front.png` |
| Ship candidate | When scoring for ship | front + ¾ + clay | `.../99_ship_*` |

Also copy the same files to `/opt/cursor/artifacts/<name>-progress/` so the
walkthrough can embed them.

## How to render a named step

```bash
# After any GLB write:
blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/render_views.py -- \
  --glb exports/blender-rig-test/<name>.glb \
  --angles 0 \
  --out exports/blender-rig-test/progress/<name> \
  --prefix 12_refine_hair

# Clay form check (same step):
blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/render_views.py -- \
  --glb exports/blender-rig-test/<name>.glb \
  --angles 0 --mode clay \
  --out exports/blender-rig-test/progress/<name> \
  --prefix 12_refine_hair
```

Then **immediately** Read the PNG(s) in the agent turn (do not wait until the
final summary). One sentence caption is enough: what changed this step.

## Chat / walkthrough habit

- Prefer showing the PNG **in the same turn** as the build, not only at the end.
- Caption: `Step 12 — hair volume ↑` (what the user should look for).
- Keep older step PNGs; do not overwrite `01_blockout_*` when refining.
- If a step fails to render, say so explicitly — do not skip silently.

## Anti-patterns

- Three rebuilds with zero intermediate PNGs  
- Only attaching PNGs in the PR description, never in the working turn  
- Overwriting the same `view_000.png` without a dated/step-prefixed copy in `progress/`  
- Critiquing from memory instead of Reading the new frame  

## Tie-in

This sits on top of the normal loop: card → light scan → build → **PNG** →
critique → one-knob → **PNG** → …
