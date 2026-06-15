#!/usr/bin/env bash
# Refuse to ship the placeholder files that break the playable runtime.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_file() {
  local file="$1"
  [[ -f "$file" ]] || fail "$file is missing."
}

require_pattern() {
  local file="$1"
  local pattern="$2"
  grep -q "$pattern" "$file" || fail "$file is missing required pattern: $pattern"
}

reject_exact_placeholder() {
  local file="$1"
  local placeholder="$2"
  local compact
  compact="$(tr -d '\r\n' < "$file")"
  [[ "$compact" != "$placeholder" ]] || fail "$file still contains placeholder text: $placeholder"
}

require_file src/systems.js
require_file src/assets.js
require_file src/entities.js

reject_exact_placeholder src/systems.js SYSTEMS_CONTENT
reject_exact_placeholder src/assets.js ASSETS_CONTENT

require_pattern src/systems.js "function fire"
require_pattern src/systems.js "function updateProjectiles"
require_pattern src/systems.js "heroId: u.heroId || null"
require_pattern src/systems.js "p.heroId === 'grollusk'"
require_pattern src/assets.js "function drawProjectile"
require_pattern src/assets.js "p.heroId !== 'grollusk'"
require_pattern src/entities.js "heroId: opts.heroId || null"

node --check src/entities.js
node --check src/systems.js
node --check src/assets.js

echo "Game source verification passed."
