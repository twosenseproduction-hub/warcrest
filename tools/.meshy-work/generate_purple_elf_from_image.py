#!/usr/bin/env python3
"""Cleanest path: Meshy Image-to-3D from the purple elf T-pose reference."""
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
        with urllib.request.urlopen(req, timeout=120) as resp:
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
        print(f"[image-to-3d] {status} {task.get('progress', 0)}%", flush=True)
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

    payload = {
        "image_url": data_uri(REF),
        # Cleanest topology path recommended by Meshy docs
        "model_type": "smart-topology",
        "ai_model": "meshy-t2",
        "target_polycount": 10000,
        "pose_mode": "t-pose",
        "should_texture": True,
        "enable_pbr": True,
        "target_formats": ["glb"],
        "alpha_thumbnail": True,
        "multi_view_thumbnails": True,
    }
    print("Creating image-to-3d…", flush=True)
    print(json.dumps({k: v for k, v in payload.items() if k != "image_url"}, indent=2), flush=True)
    task_id = post(payload)
    print(f"task_id={task_id}", flush=True)
    (OUT / f"{STEM}_task_id.txt").write_text(task_id)
    task = poll(task_id)
    (OUT / f"{STEM}_task.json").write_text(json.dumps(task, indent=2))

    urls = task.get("model_urls") or {}
    if not urls.get("glb"):
        raise RuntimeError(f"No GLB: {task}")
    download(urls["glb"], ASSETS / f"{STEM}.glb")
    download(urls["glb"], OUT / f"{STEM}.glb")
    if task.get("thumbnail_url"):
        download(task["thumbnail_url"], OUT / f"{STEM}_thumb.png")
        download(task["thumbnail_url"], ASSETS / f"{STEM}_thumb.png")
    if task.get("alpha_thumbnail_url"):
        download(task["alpha_thumbnail_url"], OUT / f"{STEM}_thumb_alpha.png")
        download(task["alpha_thumbnail_url"], ASSETS / f"{STEM}_thumb_alpha.png")
    thumbs = task.get("thumbnail_urls") or {}
    for view, url in thumbs.items():
        if url:
            download(url, OUT / f"{STEM}_view_{view}.png")
            download(url, ASSETS / f"{STEM}_view_{view}.png")
    print("DONE", ASSETS / f"{STEM}.glb", flush=True)


if __name__ == "__main__":
    main()
