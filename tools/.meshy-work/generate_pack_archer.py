#!/usr/bin/env python3
"""Generate a pack-ready elven archer (T-pose, empty hands) for HumanF anims.

  set -a; source .env; set +a
  python3 tools/.meshy-work/generate_pack_archer.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from pathlib import Path

API = "https://api.meshy.ai/openapi/v2/text-to-3d"
OUT = Path(__file__).resolve().parent
ASSETS = Path(__file__).resolve().parents[2] / "assets" / "models" / "meshy"
STEM = "pack_archer_meshy"

# Empty hands + T-pose so HumanF Female pack skins cleanly.
PROMPT = (
    "Stylized low-poly female elven archer body in T-pose, long pointed ears, "
    "lavender-purple skin, glowing solid green pupil-less eyes, dark purple "
    "hair in a high crest, silver circlet, ornate royal purple plate armor "
    "with silver filigree scrollwork, pauldrons, bracers, tassets, greaves, "
    "empty open hands no bow no quiver no weapons, sharp geometric facets, "
    "symmetrical game-ready humanoid proportions, single character, no base"
)

TEXTURE_PROMPT = (
    "Hand-painted matte textures, royal purple armor #503060, silver-white "
    "filigree trim, lavender skin, dark purple hair, glowing green eyes and "
    "gems, flat faceted mobile RPG look, no metal shine, remove baked lighting"
)


def headers():
    key = os.environ.get("MESHY_API_KEY")
    if not key:
        sys.exit("MESHY_API_KEY not set")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def post(payload: dict) -> str:
    req = urllib.request.Request(
        API, data=json.dumps(payload).encode(), headers=headers(), method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = json.loads(resp.read().decode())
    tid = body.get("result")
    if not tid:
        raise RuntimeError(f"No task id: {body}")
    return tid


def get_task(task_id: str) -> dict:
    req = urllib.request.Request(f"{API}/{task_id}", headers=headers())
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def poll(task_id: str, label: str) -> dict:
    while True:
        task = get_task(task_id)
        status = task.get("status")
        print(f"[{label}] {status} {task.get('progress', 0)}%", flush=True)
        if status == "SUCCEEDED":
            return task
        if status == "FAILED":
            err = (task.get("task_error") or {}).get("message") or task
            raise RuntimeError(f"{label} failed: {err}")
        time.sleep(5)


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    print(f"Saved {dest} ({dest.stat().st_size} bytes)", flush=True)


def main() -> None:
    print("Creating lowpoly T-pose preview…", flush=True)
    preview_id = post(
        {
            "mode": "preview",
            "prompt": PROMPT,
            "model_type": "lowpoly",
            "pose_mode": "t-pose",
            "topology": "triangle",
            "target_formats": ["glb"],
            "symmetry_mode": "on",
        }
    )
    print(f"preview_task_id={preview_id}", flush=True)
    (OUT / f"{STEM}_preview_id.txt").write_text(preview_id)
    preview = poll(preview_id, "preview")
    (OUT / f"{STEM}_preview.json").write_text(json.dumps(preview, indent=2))
    urls = preview.get("model_urls") or {}
    if urls.get("glb"):
        download(urls["glb"], ASSETS / f"{STEM}_preview.glb")

    print("Creating refine (texture)…", flush=True)
    refine_id = post(
        {
            "mode": "refine",
            "preview_task_id": preview_id,
            "enable_pbr": False,
            "texture_prompt": TEXTURE_PROMPT,
            "target_formats": ["glb"],
        }
    )
    print(f"refine_task_id={refine_id}", flush=True)
    (OUT / f"{STEM}_refine_id.txt").write_text(refine_id)
    refine = poll(refine_id, "refine")
    (OUT / f"{STEM}_refine.json").write_text(json.dumps(refine, indent=2))
    urls = refine.get("model_urls") or {}
    if not urls.get("glb"):
        raise RuntimeError(f"No GLB: {refine}")
    download(urls["glb"], ASSETS / f"{STEM}_raw.glb")
    download(urls["glb"], OUT / f"{STEM}_raw.glb")
    if refine.get("thumbnail_url"):
        download(refine["thumbnail_url"], ASSETS / f"{STEM}_thumb.png")
    print("DONE", ASSETS / f"{STEM}_raw.glb", flush=True)


if __name__ == "__main__":
    main()
