# Agent Instructions

## Direction — 3D only (standing rule)

As of 2026-07, **all new work is 3D**. The 2D Phaser game has been retired; `main`
is the Three.js / Vite build. Do **not** create new 2D deliverables — sprite sheets,
2D-canvas tools, 2D UI mockups, or 2D asset pipelines — unless the user explicitly
asks. When a task could be done in either 2D or 3D, choose 3D.

Existing 2D sprite assets and their processing scripts (see "Hero / unit art" below)
remain in place for backward compatibility but are **not** the basis for new features.
This rule stands until the user says otherwise.

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
