# Warcrest — Claude Code Guidelines

## Workflow

- **Merging**: Claude handles all PR merges. When a PR is ready, mark it ready for review and merge it directly — do not wait for the user to merge.
- **Deploying**: Deploys trigger automatically on merge to `main` via the `fly-deploy.yml` GitHub Action. Watch the run and report back when complete.
- **Branch**: Active development branch is `claude/fly-io-connection-73jjea`.

## Stack

- Pure vanilla HTML/CSS/JS browser RTS — zero build tools
- Served by nginx on Fly.io (`exofront-game` app)
- Assets live in `assets/` — raider buildings in `assets/raider/`, aurex buildings in `assets/tiny-swords/`
