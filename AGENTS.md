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
