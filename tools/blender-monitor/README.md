# Blender Monitor — live visual observability for headless jobs

## Architecture choice

| Option | Verdict |
|--------|---------|
| **1. Xvfb + VNC** | Useful for watching a real Blender UI, but heavy, harder for AI agents to consume, and unnecessary for `blender -b --python` jobs that already drive the scene from code. |
| **2. Periodic preview PNGs + local dashboard** | **Chosen.** Works with true headless Blender, unattended, and AI agents can `Read()` PNG files directly. |
| **3. JSON status / manifest** | **Included.** `status.json` + `manifest.json` give stage, timing, frame number, and the latest preview path. |

**Primary path:** Blender job writes low-res EEVEE stills into a run directory → Node dashboard auto-refreshes → humans watch the browser, agents poll `status.json` and open the PNG.

**Optional:** `run-job.sh --xvfb` wraps Blender in Xvfb if you later need OpenGL viewport capture experiments. Still prefer PNG previews for agent inspection.

```
tools/blender-monitor/
  README.md
  lib/monitor_preview.py      # Blender-side helper
  schema/status.schema.json
  server/dashboard.mjs        # HTTP API + static UI
  server/public/index.html
  bin/run-job.sh              # dashboard + Blender together
  bin/run-dashboard.sh        # dashboard only
  runs/                       # symlinks to active/past run dirs
```

Run artifacts (default):

```
/opt/cursor/artifacts/blender-monitor/<timestamp>_<job>/
  status.json
  manifest.json
  job.log
  dashboard.log
  launcher.json
  previews/preview_0001.png
  …
```

## Quick start

```bash
# Donut job with live dashboard (port 7788)
./tools/blender-monitor/bin/run-job.sh \
  tools/blender-character/follow_blender_guru_donut.py

# Another job, custom port / name
./tools/blender-monitor/bin/run-job.sh \
  --port 7790 --name bizzo \
  tools/blender-character/follow_master_cat.py

# Attach dashboard to an existing run directory
./tools/blender-monitor/bin/run-dashboard.sh /opt/cursor/artifacts/blender-monitor/<run>

# Reuse a specific run dir for the next job
./tools/blender-monitor/bin/run-job.sh --run-dir /tmp/my-run \
  tools/blender-character/follow_blender_guru_donut.py
```

`run-job.sh` always creates a **fresh** run directory under `/opt/cursor/artifacts/blender-monitor/` unless you pass `--run-dir` (it does not reuse a leftover `BLENDER_MONITOR_DIR` from your shell).

## Blender job integration

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path("/workspace/tools/blender-monitor/lib")))
from monitor_preview import Monitor

mon = Monitor.from_env(job="my_job")
mon.stage("blockout", index=1, total=4)
# … build geometry …
mon.preview(message="blockout done")
mon.stage("materials", index=2, total=4)
mon.done()
```

`bin/run-job.sh` sets `BLENDER_MONITOR_DIR` and `PYTHONPATH` so imports work without edits. Jobs also fall back to an ad-hoc artifact dir if the env var is missing.

## AI agent consumption

1. Read `runs/LATEST` or the run dir from the launcher output.
2. Poll `status.json` (or `GET /api/status`).
3. When `latest_preview` changes, **open that PNG** (image read) — do not rely on logs for visuals.
4. Use `manifest.json` for the full frame timeline.
5. `agent_hint` inside `status.json` restates this.

Example:

```bash
RUN=$(cat tools/blender-monitor/runs/LATEST)
curl -s "$RUN/status.json" | jq .
# then Read the file at: $RUN/$(jq -r .latest_preview $RUN/status.json)
```

## Dashboard API

| Route | Purpose |
|-------|---------|
| `GET /` | Auto-refresh UI (preview, stage, progress, log tail, filmstrip) |
| `GET /api/status` | Current `status.json` |
| `GET /api/manifest` | All preview frames |
| `GET /api/log?tail=120` | Tail of `job.log` |
| `GET /previews/*.png` | Preview images |
| `GET /api/health` | Liveness |

Query `?poll=500` on `/` to change client poll interval (ms).

## Modular boundary

- **Blender-side** (`lib/monitor_preview.py`) only knows how to render + write JSON/PNG.
- **Orchestration** (`bin/run-job.sh`) owns process lifecycle, env, logs.
- **Presentation** (`server/`) is replaceable; agents can ignore it and read files.
- Any existing `tools/blender-character/*.py` job can adopt the helper without changing the dashboard.
