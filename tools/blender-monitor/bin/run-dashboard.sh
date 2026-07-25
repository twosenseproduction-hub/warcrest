#!/usr/bin/env bash
# Start only the monitor dashboard against an existing (or new) run dir.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
NODE_BIN="${NODE_BIN:-/exec-daemon/node}"
PORT="${BLENDER_MONITOR_PORT:-7788}"
RUN_DIR="${1:-${BLENDER_MONITOR_DIR:-}}"

if [[ -z "$RUN_DIR" ]]; then
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  RUN_DIR="/opt/cursor/artifacts/blender-monitor/${stamp}_dashboard"
fi
mkdir -p "$RUN_DIR/previews"
export BLENDER_MONITOR_DIR="$RUN_DIR"
export BLENDER_MONITOR_PORT="$PORT"

echo "[blender-monitor] dashboard → http://127.0.0.1:${PORT}/"
echo "[blender-monitor] run_dir  → $RUN_DIR"
exec "$NODE_BIN" "$ROOT/server/dashboard.mjs" --run-dir "$RUN_DIR" --port "$PORT"
