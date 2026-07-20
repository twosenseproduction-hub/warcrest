# Agent Instructions

## Cursor Cloud specific instructions

- Cursor Cloud environment setup is committed in `.cursor/environment.json`.
- The install command runs `bash scripts/setup-flyctl.sh` from the repo root.
- Configure `FLY_ACCESS_TOKEN` as a Cursor Cloud secret before Fly deploys. The
  setup and deploy scripts export it as `FLY_API_TOKEN` for `flyctl`.
- Verify the Cloud environment with `flyctl version`.
- Deploy with `./scripts/deploy.sh`. If Fly's Depot/builder APIs return
  `503 Service Unavailable`, retry with `./scripts/deploy.sh --depot=false`.
- Before deploying, `scripts/deploy.sh` runs `scripts/verify-game-sources.sh` to
  catch placeholder `src/systems.js` / `src/assets.js` regressions.

## Hero / unit art (Aelindra, Rimwalker)

- **Never auto-generate or replace** shipped strips in `assets/heroes/` or
  `assets/units/`. If a clip is missing or mislabeled, **stop and tell the artist**
  what filename/path is expected — do not pull from Spritely, Pixel Lab,
  `tools/.spritely-work/`, or run placeholder builders.
- **Do not run** `tools/build-aelindra-placeholders.py`,
  `tools/generate-aelindra-sprites.py`, or `--rebuild-aelindra` unless the user
  explicitly asks to process a file they provided.
- **Processing only:** key / upscale / crisp passthrough is OK when run on an
  explicit user-provided source path (`--strip` + `--out`). Do not use
  batch `--strip-dir` on `assets/heroes/rimwalker/aelindra/` unless the user
  asked to re-process their own files.
- Keep artist originals in `assets/heroes/rimwalker/aelindra/_refs/` when converting.

## Blender characters from a reference

When making or refining a **Blender** character from a concept/reference image,
load and follow `.claude/skills/blender-reference-character/SKILL.md` (also
linked from `.cursor/skills/blender-reference-character/`). Mandatory order:
reference card → parametric build → turntable render → critique → one-knob refine.
Do not jump to geometry before a locked palette/proportions/landmarks card.

## Image-to-3D like Meshy / Tripo

When the user asks how Meshy AI or Tripo AI build models from images, or wants
that same staged construction from a reference, load
`.claude/skills/image-to-3d-from-reference/SKILL.md`. Mirror their stages
(multi-view → white model → remesh → texture → optional rig) via the agent
analogue; do not claim to run their proprietary weights unless using their API
with user credentials. Respect Meshy free-tier licensing for game IP.
