"""Blender-side progress monitor — periodic preview PNGs + status JSON.

Import from any `blender -b --python …` job:

    from monitor_preview import Monitor
    mon = Monitor.from_env(job="my_job")
    mon.stage("blockout", index=1, total=5)
    mon.preview(message="after torus")
    mon.done()

Environment:
  BLENDER_MONITOR_DIR   Run directory (created by bin/run-job.sh)
  BLENDER_MONITOR_JOB   Optional job label override

Outputs in the run dir:
  status.json           Current status (AI + dashboard poll this)
  manifest.json         All preview frames with metadata
  previews/*.png        Preview stills
  job.log               Appended by the launcher (not this module)
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# bpy is only available inside Blender
try:
    import bpy
except ImportError:  # pragma: no cover
    bpy = None  # type: ignore


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n")
    tmp.replace(path)


class Monitor:
    """Writes status.json + preview PNGs for dashboard / AI agents."""

    def __init__(
        self,
        run_dir: Path | str,
        job: str = "blender-job",
        *,
        preview_width: int = 640,
        preview_height: int = 480,
        preview_samples: int = 8,
        min_preview_interval_s: float = 0.0,
    ):
        self.run_dir = Path(run_dir).resolve()
        self.previews_dir = self.run_dir / "previews"
        self.status_path = self.run_dir / "status.json"
        self.manifest_path = self.run_dir / "manifest.json"
        self.job = job
        self.preview_width = preview_width
        self.preview_height = preview_height
        self.preview_samples = preview_samples
        self.min_preview_interval_s = min_preview_interval_s

        self.run_id = self.run_dir.name
        self.started_at = _utc_now()
        self._frame = 0
        self._last_preview_t = 0.0
        self._stage: Optional[str] = None
        self._stage_index: Optional[int] = None
        self._stages_total: Optional[int] = None
        self._render_progress: Optional[float] = None
        self._message: Optional[str] = None
        self._status = "starting"
        self._latest_preview: Optional[str] = None
        self._manifest: dict[str, Any] = {
            "run_id": self.run_id,
            "job": self.job,
            "started_at": self.started_at,
            "previews": [],
        }

        self.previews_dir.mkdir(parents=True, exist_ok=True)
        self._write_status(message="monitor initialized")
        self._write_manifest()

    @classmethod
    def from_env(
        cls,
        job: Optional[str] = None,
        **kwargs: Any,
    ) -> "Monitor":
        run_dir = os.environ.get("BLENDER_MONITOR_DIR")
        if not run_dir:
            # Local fallback so jobs still work without the launcher
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            label = job or os.environ.get("BLENDER_MONITOR_JOB") or "adhoc"
            run_dir = f"/opt/cursor/artifacts/blender-monitor/{stamp}_{label}"
        job_name = job or os.environ.get("BLENDER_MONITOR_JOB") or Path(run_dir).name
        return cls(run_dir, job=job_name, **kwargs)

    # ------------------------------------------------------------------ API

    def stage(
        self,
        name: str,
        *,
        index: Optional[int] = None,
        total: Optional[int] = None,
        message: Optional[str] = None,
        preview: bool = True,
    ) -> None:
        self._status = "running"
        self._stage = name
        if index is not None:
            self._stage_index = index
        if total is not None:
            self._stages_total = total
        self._message = message or name
        self._write_status()
        print(f"[monitor] stage={name} ({index}/{total})", flush=True)
        if preview:
            self.preview(message=message or f"stage:{name}")

    def set_progress(self, progress: Optional[float], message: Optional[str] = None) -> None:
        self._render_progress = None if progress is None else max(0.0, min(1.0, float(progress)))
        if message is not None:
            self._message = message
        self._write_status()

    def log(self, message: str) -> None:
        self._message = message
        self._write_status()
        print(f"[monitor] {message}", flush=True)

    def preview(
        self,
        *,
        message: Optional[str] = None,
        force: bool = False,
        camera: Optional[str] = None,
    ) -> Optional[Path]:
        """Render a low-res still and register it in status + manifest."""
        if bpy is None:
            raise RuntimeError("monitor_preview.preview() must run inside Blender")

        now = time.monotonic()
        if (
            not force
            and self.min_preview_interval_s > 0
            and (now - self._last_preview_t) < self.min_preview_interval_s
        ):
            return None

        if message:
            self._message = message

        sc = bpy.context.scene
        # Ensure a camera exists
        if camera and camera in bpy.data.objects:
            sc.camera = bpy.data.objects[camera]
        if sc.camera is None:
            cams = [o for o in bpy.data.objects if o.type == "CAMERA"]
            if cams:
                sc.camera = cams[0]
            else:
                # No camera yet — skip visual, still update status
                self._write_status(message=self._message or "preview skipped (no camera)")
                return None

        self._frame += 1
        rel = f"previews/preview_{self._frame:04d}.png"
        out = self.run_dir / rel

        # Preserve caller render settings
        prev = {
            "filepath": sc.render.filepath,
            "rx": sc.render.resolution_x,
            "ry": sc.render.resolution_y,
            "rp": sc.render.resolution_percentage,
            "fmt": sc.render.image_settings.file_format,
        }
        eevee_samples = None
        if hasattr(sc, "eevee") and hasattr(sc.eevee, "taa_render_samples"):
            eevee_samples = sc.eevee.taa_render_samples
            sc.eevee.taa_render_samples = self.preview_samples

        try:
            sc.render.filepath = str(out.with_suffix(""))  # Blender adds extension
            sc.render.resolution_x = self.preview_width
            sc.render.resolution_y = self.preview_height
            sc.render.resolution_percentage = 100
            sc.render.image_settings.file_format = "PNG"
            bpy.ops.render.render(write_still=True)
        finally:
            sc.render.filepath = prev["filepath"]
            sc.render.resolution_x = prev["rx"]
            sc.render.resolution_y = prev["ry"]
            sc.render.resolution_percentage = prev["rp"]
            sc.render.image_settings.file_format = prev["fmt"]
            if eevee_samples is not None:
                sc.eevee.taa_render_samples = eevee_samples

        # Blender may write preview_NNNN.png already via filepath; normalize
        written = out if out.exists() else Path(str(out) + ".png")
        if written.exists() and written != out:
            written.replace(out)
        if not out.exists():
            # Sometimes filepath already included .png and Blender doubled it
            candidates = list(self.previews_dir.glob(f"preview_{self._frame:04d}*"))
            if candidates:
                candidates[0].replace(out)

        self._latest_preview = rel if out.exists() else None
        self._last_preview_t = now
        self._status = "running"

        entry = {
            "frame": self._frame,
            "file": rel,
            "abs_path": str(out),
            "stage": self._stage,
            "stage_index": self._stage_index,
            "message": self._message,
            "created_at": _utc_now(),
        }
        self._manifest["previews"].append(entry)
        self._manifest["updated_at"] = _utc_now()
        self._write_manifest()
        self._write_status()
        print(f"[monitor] preview frame={self._frame} → {out}", flush=True)
        return out if out.exists() else None

    def done(self, message: str = "done") -> None:
        self._status = "done"
        self._render_progress = 1.0
        self._message = message
        self._write_status()
        print(f"[monitor] DONE {message}", flush=True)

    def fail(self, error: str) -> None:
        self._status = "error"
        self._write_status(error=error, message=error)
        print(f"[monitor] ERROR {error}", flush=True)

    # ------------------------------------------------------------------ IO

    def _write_status(self, message: Optional[str] = None, error: Optional[str] = None) -> None:
        if message is not None:
            self._message = message
        data = {
            "run_id": self.run_id,
            "job": self.job,
            "status": self._status,
            "stage": self._stage,
            "stage_index": self._stage_index,
            "stages_total": self._stages_total,
            "frame": self._frame,
            "render_progress": self._render_progress,
            "message": self._message,
            "error": error,
            "started_at": self.started_at,
            "updated_at": _utc_now(),
            "latest_preview": self._latest_preview,
            "preview_count": self._frame,
            "run_dir": str(self.run_dir),
            "agent_hint": (
                "Read status.json then open latest_preview (PNG under run_dir). "
                "Re-read after updated_at changes. Prefer PNGs over logs for visuals."
            ),
        }
        _atomic_write_json(self.status_path, data)

    def _write_manifest(self) -> None:
        _atomic_write_json(self.manifest_path, self._manifest)
