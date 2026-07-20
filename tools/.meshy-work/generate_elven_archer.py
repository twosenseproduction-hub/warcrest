#!/usr/bin/env python3
"""Generate a stylized low-poly elven archer via Meshy Text-to-3D (preview + refine)."""
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

PROMPT = (
    "Stylized low-poly fantasy elven archer for a mobile RPG, sharp geometric "
    "faceted polygons, flat planar armor plates, angular origami-like silhouette, "
    "slender athletic female elf with long pointed ears, long straight silver-white "
    "hair, glowing cyan eyes, ornate light armor in white silver and forest green "
    "with gold trim, large angular shoulder pauldrons, crystal-shard accents on "
    "bracers, elegant geometric recurve longbow held ready, quiver of faceted "
    "arrows on back, high-contrast game-ready hero character, A-pose, single "
    "character, no base, clean readable silhouette"
)

TEXTURE_PROMPT = (
    "Hand-painted stylized PBR textures matching mobile fantasy RPG art, "
    "flat faceted shading look, white and silver armor plates with gold filigree "
    "trim, sage and forest green cloth straps, glowing cyan eye and crystal "
    "emissive accents, clean saturated colors, remove baked lighting"
)


def headers():
    key = os.environ.get("MESHY_API_KEY")
    if not key:
        sys.exit("MESHY_API_KEY not set")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def post(payload: dict) -> str:
    req = urllib.request.Request(
        API,
        data=json.dumps(payload).encode(),
        headers=headers(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode())
    task_id = body.get("result")
    if not task_id:
        raise RuntimeError(f"No task id: {body}")
    return task_id


def get_task(task_id: str) -> dict:
    req = urllib.request.Request(f"{API}/{task_id}", headers=headers())
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def poll(task_id: str, label: str) -> dict:
    while True:
        task = get_task(task_id)
        status = task.get("status")
        prog = task.get("progress", 0)
        print(f"[{label}] {status} {prog}%", flush=True)
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
    preview_payload = {
        "mode": "preview",
        "prompt": PROMPT,
        "model_type": "lowpoly",
        "pose_mode": "a-pose",
        "target_formats": ["glb"],
        "alpha_thumbnail": True,
    }
    print("Creating preview…", flush=True)
    print("Prompt:", PROMPT, flush=True)
    preview_id = post(preview_payload)
    print(f"preview_task_id={preview_id}", flush=True)
    (OUT / "preview_task_id.txt").write_text(preview_id)
    preview = poll(preview_id, "preview")
    (OUT / "preview_task.json").write_text(json.dumps(preview, indent=2))

    urls = preview.get("model_urls") or {}
    if urls.get("glb"):
        download(urls["glb"], OUT / "elven_archer_preview.glb")
    if preview.get("thumbnail_url"):
        download(preview["thumbnail_url"], OUT / "elven_archer_preview.png")
    if preview.get("alpha_thumbnail_url"):
        download(preview["alpha_thumbnail_url"], OUT / "elven_archer_preview_alpha.png")

    refine_payload = {
        "mode": "refine",
        "preview_task_id": preview_id,
        "enable_pbr": True,
        "remove_lighting": True,
        "texture_prompt": TEXTURE_PROMPT,
        "target_formats": ["glb"],
        "alpha_thumbnail": True,
    }
    print("Creating refine…", flush=True)
    refine_id = post(refine_payload)
    print(f"refine_task_id={refine_id}", flush=True)
    (OUT / "refine_task_id.txt").write_text(refine_id)
    refine = poll(refine_id, "refine")
    (OUT / "refine_task.json").write_text(json.dumps(refine, indent=2))

    urls = refine.get("model_urls") or {}
    if not urls.get("glb"):
        raise RuntimeError(f"No GLB in refine result: {refine}")
    final = ASSETS / "elven_archer_meshy.glb"
    download(urls["glb"], final)
    download(urls["glb"], OUT / "elven_archer_refined.glb")
    if refine.get("thumbnail_url"):
        download(refine["thumbnail_url"], OUT / "elven_archer_refined.png")
        download(refine["thumbnail_url"], ASSETS / "elven_archer_meshy_thumb.png")
    if refine.get("alpha_thumbnail_url"):
        download(refine["alpha_thumbnail_url"], OUT / "elven_archer_refined_alpha.png")
        download(refine["alpha_thumbnail_url"], ASSETS / "elven_archer_meshy_thumb_alpha.png")

    print("DONE", final, flush=True)


if __name__ == "__main__":
    main()
