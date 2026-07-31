#!/usr/bin/env python3
"""Image-to-3D with Meshy model_type=lowpoly to keep the faceted polygon look."""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.meshy.ai/openapi/v1/image-to-3d"
OUT = Path(__file__).resolve().parent
ASSETS = Path(__file__).resolve().parents[2] / "assets" / "models" / "meshy"
STEM = "purple_elf_meshy"
REF = OUT / "purple_elf_ref.jpg"


def headers():
    key = os.environ.get("MESHY_API_KEY")
    if not key:
        sys.exit("MESHY_API_KEY not set")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def data_uri(path: Path) -> str:
    raw = path.read_bytes()
    mime = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


def post(payload: dict) -> str:
    req = urllib.request.Request(
        API, data=json.dumps(payload).encode(), headers=headers(), method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"POST failed {e.code}: {e.read().decode()}") from e
    tid = body.get("result")
    if not tid:
        raise RuntimeError(f"No task id: {body}")
    return tid


def get_task(task_id: str) -> dict:
    req = urllib.request.Request(f"{API}/{task_id}", headers=headers())
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def poll(task_id: str) -> dict:
    while True:
        task = get_task(task_id)
        status = task.get("status")
        print(f"[lowpoly] {status} {task.get('progress', 0)}%", flush=True)
        if status == "SUCCEEDED":
            return task
        if status == "FAILED":
            err = (task.get("task_error") or {}).get("message") or task
            raise RuntimeError(f"failed: {err}")
        time.sleep(5)


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    print(f"Saved {dest} ({dest.stat().st_size} bytes)", flush=True)


def main() -> None:
    if not REF.exists():
        sys.exit(f"missing ref: {REF}")
    uri = data_uri(REF)
    payload = {
        "image_url": uri,
        # Explicit low-poly generator — cleaner facets than standard remesh
        "model_type": "lowpoly",
        "pose_mode": "t-pose",
        "should_texture": True,
        "enable_pbr": False,
        "texture_image_url": uri,
        "target_formats": ["glb"],
        "alpha_thumbnail": True,
        "multi_view_thumbnails": True,
    }
    print("Creating lowpoly image-to-3d…", flush=True)
    print(json.dumps({k: v for k, v in payload.items() if "url" not in k}, indent=2), flush=True)
    task_id = post(payload)
    print(f"task_id={task_id}", flush=True)
    (OUT / f"{STEM}_lowpoly_task_id.txt").write_text(task_id)
    task = poll(task_id)
    (OUT / f"{STEM}_lowpoly_task.json").write_text(json.dumps(task, indent=2))
    urls = task.get("model_urls") or {}
    if not urls.get("glb"):
        raise RuntimeError(f"No GLB: {task}")

    download(urls["glb"], OUT / f"{STEM}_lowpoly_raw.glb")
    download(urls["glb"], ASSETS / f"{STEM}_lowpoly_raw.glb")
    if task.get("thumbnail_url"):
        download(task["thumbnail_url"], OUT / f"{STEM}_lowpoly_thumb.png")
        download(task["thumbnail_url"], ASSETS / f"{STEM}_lowpoly_thumb.png")
    if task.get("alpha_thumbnail_url"):
        download(task["alpha_thumbnail_url"], ASSETS / f"{STEM}_lowpoly_thumb_alpha.png")
    for view, url in (task.get("thumbnail_urls") or {}).items():
        if url:
            download(url, ASSETS / f"{STEM}_lowpoly_view_{view}.png")
            download(url, OUT / f"{STEM}_lowpoly_view_{view}.png")
    print("DONE raw", ASSETS / f"{STEM}_lowpoly_raw.glb", flush=True)


if __name__ == "__main__":
    main()
