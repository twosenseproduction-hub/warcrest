#!/usr/bin/env bash
# Canonical deploy entrypoint for exofront-game (Warcrest).
# Always use this script — never run `fly deploy` from rts-game/ or other forks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .warcrest-root ]]; then
  echo "ERROR: missing .warcrest-root — run deploy only from the warcrest repo root." >&2
  exit 1
fi

if [[ ! -f src/config.js ]]; then
  echo "ERROR: src/config.js not found in $(pwd)." >&2
  exit 1
fi

if ! grep -q "Iron Crown" src/config.js; then
  echo "ERROR: src/config.js does not contain Iron Crown faction lore." >&2
  echo "       You may be in a stale fork (e.g. rts-game/). Aborting." >&2
  exit 1
fi

if grep -q "Aurex Kingdom" src/config.js; then
  echo "ERROR: stale Aurex/Crimson fork detected in src/config.js." >&2
  echo "       Deploy from github.com/twosenseproduction-hub/warcrest only." >&2
  exit 1
fi

if [[ ! -f fly.toml ]] || ! grep -q "exofront-game" fly.toml; then
  echo "ERROR: fly.toml missing or not targeting app exofront-game." >&2
  exit 1
fi

echo "Deploying Warcrest → exofront-game"
echo "  path: $(pwd)"
echo "  git:  $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
FLY="$(command -v fly || command -v flyctl || true)"
if [[ -z "$FLY" ]]; then
  echo "ERROR: fly/flyctl not found in PATH." >&2
  exit 1
fi
exec "$FLY" deploy "$@"
