#!/usr/bin/env bash
# Launch Blender job + live preview dashboard together.
#
# Usage:
#   ./tools/blender-monitor/bin/run-job.sh \
#     tools/blender-character/follow_blender_guru_donut.py
#
#   ./tools/blender-monitor/bin/run-job.sh --port 7790 --name bizzo \
#     tools/blender-character/follow_master_cat.py
#
# Optional:
#   --xvfb       Run Blender under Xvfb (OpenGL viewport experiments)
#   --port N     Dashboard port (default 7788)
#   --name S     Run label fragment
#   --run-dir D  Reuse/write this run directory (default: fresh under artifacts)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
NODE_BIN="${NODE_BIN:-/exec-daemon/node}"
BLENDER_BIN="${BLENDER_BIN:-blender}"

USE_XVFB=0
PORT="${BLENDER_MONITOR_PORT:-7788}"
NAME=""
JOB_SCRIPT=""
RUN_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --xvfb) USE_XVFB=1; shift ;;
    --port) PORT="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --run-dir) RUN_DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      if [[ -z "$JOB_SCRIPT" ]]; then JOB_SCRIPT="$1"; shift
      else echo "Unknown arg: $1" >&2; exit 1
      fi
      ;;
  esac
done

if [[ -z "$JOB_SCRIPT" ]]; then
  echo "usage: $0 [--xvfb] [--port N] [--name S] [--run-dir D] <script.py>" >&2
  exit 1
fi

if [[ ! -f "$JOB_SCRIPT" ]]; then
  if [[ -f "$REPO/$JOB_SCRIPT" ]]; then
    JOB_SCRIPT="$REPO/$JOB_SCRIPT"
  else
    echo "Job script not found: $JOB_SCRIPT" >&2
    exit 1
  fi
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
label="${NAME:-$(basename "$JOB_SCRIPT" .py)}"
# Fresh run dir by default — ignore any stale BLENDER_MONITOR_DIR in the shell.
if [[ -z "$RUN_DIR" ]]; then
  RUN_DIR="/opt/cursor/artifacts/blender-monitor/${stamp}_${label}"
fi

LINK_DIR="$ROOT/runs/${stamp}_${label}"
mkdir -p "$RUN_DIR/previews" "$(dirname "$LINK_DIR")"
ln -sfn "$RUN_DIR" "$LINK_DIR"

export BLENDER_MONITOR_DIR="$RUN_DIR"
export BLENDER_MONITOR_JOB="$label"
export BLENDER_MONITOR_PORT="$PORT"
export PYTHONPATH="${ROOT}/lib${PYTHONPATH:+:$PYTHONPATH}"

LOG="$RUN_DIR/job.log"
META="$RUN_DIR/launcher.json"
cat > "$META" <<EOF
{
  "job_script": "$JOB_SCRIPT",
  "run_dir": "$RUN_DIR",
  "port": $PORT,
  "xvfb": $USE_XVFB,
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "dashboard": "http://127.0.0.1:${PORT}/",
  "agent_hint": "Poll $RUN_DIR/status.json; Read() the PNG at latest_preview."
}
EOF

echo "[blender-monitor] run_dir   → $RUN_DIR"
echo "[blender-monitor] dashboard → http://127.0.0.1:${PORT}/"
echo "[blender-monitor] job       → $JOB_SCRIPT"
echo "[blender-monitor] log       → $LOG"

# Free the port if a stale dashboard is still bound
if command -v fuser >/dev/null 2>&1; then
  OLD_PIDS="$(fuser "${PORT}/tcp" 2>/dev/null || true)"
  if [[ -n "${OLD_PIDS:-}" ]]; then
    echo "[blender-monitor] freeing port $PORT (pids${OLD_PIDS})"
    # shellcheck disable=SC2086
    kill $OLD_PIDS 2>/dev/null || true
    sleep 0.3
  fi
else
  # Fallback: kill known dashboard node on this port via /proc
  for pid in $(pgrep -f "dashboard.mjs --run-dir" || true); do
    kill "$pid" 2>/dev/null || true
  done
  sleep 0.2
fi

"$NODE_BIN" "$ROOT/server/dashboard.mjs" --run-dir "$RUN_DIR" --port "$PORT" \
  >>"$RUN_DIR/dashboard.log" 2>&1 &
DASH_PID=$!
cleanup() {
  if kill -0 "$DASH_PID" 2>/dev/null; then
    kill "$DASH_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

sleep 0.4
if ! kill -0 "$DASH_PID" 2>/dev/null; then
  echo "Dashboard failed to start — see $RUN_DIR/dashboard.log" >&2
  cat "$RUN_DIR/dashboard.log" >&2 || true
  exit 1
fi

BLENDER_CMD=("$BLENDER_BIN" -b -noaudio --python "$JOB_SCRIPT")
if [[ "$USE_XVFB" -eq 1 ]]; then
  if ! command -v Xvfb >/dev/null; then
    echo "Xvfb not installed; continuing without --xvfb" >&2
  else
    BLENDER_CMD=(xvfb-run -a -s "-screen 0 1280x720x24" "${BLENDER_CMD[@]}")
  fi
fi

echo "[blender-monitor] starting Blender…" | tee -a "$LOG"
set +e
"${BLENDER_CMD[@]}" >>"$LOG" 2>&1
RC=$?
set -e

echo "[blender-monitor] Blender exited rc=$RC" | tee -a "$LOG"
printf '%s\n' "$RUN_DIR" >"$ROOT/runs/LATEST"
printf '%s\n' "http://127.0.0.1:${PORT}/" >"$RUN_DIR/dashboard.url"

if [[ "$RC" -ne 0 ]] && [[ -f "$RUN_DIR/status.json" ]]; then
  python3 - <<PY
import json
from pathlib import Path
p = Path("$RUN_DIR") / "status.json"
d = json.loads(p.read_text())
if d.get("status") != "error":
    d["status"] = "error"
    d["error"] = d.get("error") or "blender exited with code $RC"
    p.write_text(json.dumps(d, indent=2) + "\n")
PY
fi

exit "$RC"
