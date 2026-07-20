#!/usr/bin/env python3
"""Meshy retexture that KEEPS color (avoids image_style washout).

Meshy's image_style_url treats the ref as a loose style hint and often
desaturates. This tool samples the reference palette and drives Retexture
with an explicit text_style_prompt instead.

  MESHY_API_KEY=… python3 tools/.meshy-work/retexture_keep_color.py \
    --input-task-id 019f... \
    --ref assets/models/meshy/purple_elf_ref.jpg \
    --name purple_elf_color

  # Or retexture a local GLB via data URI:
  python3 tools/.meshy-work/retexture_keep_color.py \
    --model assets/models/meshy/purple_elf_meshy_lowpoly_raw.glb \
    --ref assets/models/meshy/purple_elf_ref.jpg \
    --name purple_elf_color
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.meshy.ai/openapi/v1/retexture"
OUT = Path(__file__).resolve().parent
ASSETS = Path(__file__).resolve().parents[2] / "assets" / "models" / "meshy"


def headers():
    key = os.environ.get("MESHY_API_KEY")
    if not key:
        sys.exit("MESHY_API_KEY not set")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def sample_palette(ref: Path, n: int = 6) -> list[tuple[int, int, int]]:
    """Return [armor, skin, trim, accent, ...] with hue-aware sampling."""
    from PIL import Image
    import numpy as np

    im = Image.open(ref).convert("RGB")
    arr = np.asarray(im).reshape(-1, 3).astype(np.float32)
    r, g, b = arr[:, 0], arr[:, 1], arr[:, 2]
    lum = (r + g + b) / 3.0
    sat = arr.max(1) - arr.min(1)

    purple = (b > r * 0.7) & (b > g * 1.05) & (sat > 25) & (lum < 200) & (lum > 40)
    lavender = (lum > 130) & (lum < 220) & (b > g) & (r > g * 0.85) & (sat > 12) & (sat < 100)
    green = (g > r * 1.15) & (g > b * 1.15) & (g > 70) & (sat > 35)
    white = (lum > 195) & (sat < 40)

    def mean_rgb(mask, fallback):
        if mask.any():
            c = arr[mask].mean(0)
            return tuple(int(x) for x in c)
        return fallback

    armor = mean_rgb(purple, (84, 48, 96))
    skin = mean_rgb(lavender, (184, 152, 200))
    # Prefer a slightly more saturated lavender if sample is grey
    if max(skin) - min(skin) < 20:
        skin = (184, 152, 200)
    trim = mean_rgb(white, (240, 240, 232))
    accent = mean_rgb(green, (64, 255, 80))
    return [armor, skin, trim, accent]


def hexify(c: tuple[int, int, int]) -> str:
    return f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}"


def build_prompt(colors: list[tuple[int, int, int]], role: str) -> str:
    hx = [hexify(c) for c in colors]
    primary, skin, trim, accent = hx[0], hx[1] if len(hx) > 1 else hx[0], hx[2] if len(hx) > 2 else "#e8e8f0", hx[3] if len(hx) > 3 else "#60ff60"
    return (
        f"Flat matte hand-painted low-poly {role} texture, KEEP SATURATED COLORS, "
        f"armor plates {primary}, skin {skin}, silver-white filigree trim {trim}, "
        f"glowing emissive accent gems and eyes {accent}, ornate scrollwork painted "
        f"into diffuse only, no specular highlights, no chrome, no grey wash, "
        f"no desaturation, vibrant mobile RPG paint, remove baked lighting"
    )[:600]


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


def poll(task_id: str) -> dict:
    while True:
        req = urllib.request.Request(f"{API}/{task_id}", headers=headers())
        with urllib.request.urlopen(req, timeout=60) as resp:
            task = json.loads(resp.read().decode())
        print(f"[retexture] {task.get('status')} {task.get('progress', 0)}%", flush=True)
        if task.get("status") == "SUCCEEDED":
            return task
        if task.get("status") == "FAILED":
            raise RuntimeError((task.get("task_error") or {}).get("message") or task)
        time.sleep(5)


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    print(f"Saved {dest} ({dest.stat().st_size} bytes)", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-task-id", default=None, help="Meshy task to retexture")
    ap.add_argument("--model", type=Path, default=None, help="Local .glb (data URI upload)")
    ap.add_argument("--ref", type=Path, required=True, help="Color reference image")
    ap.add_argument("--name", default="meshy_color")
    ap.add_argument("--role", default="fantasy armored character")
    ap.add_argument("--remove-lighting", action="store_true", default=True)
    ap.add_argument("--keep-lighting", action="store_false", dest="remove_lighting")
    args = ap.parse_args()

    if not args.ref.exists():
        sys.exit(f"missing ref {args.ref}")
    if not args.input_task_id and not args.model:
        sys.exit("need --input-task-id or --model")

    colors = sample_palette(args.ref)
    prompt = build_prompt(colors, args.role)
    print("palette", [hexify(c) for c in colors], flush=True)
    print("prompt:", prompt, flush=True)

    payload = {
        "text_style_prompt": prompt,
        "ai_model": "latest",
        "enable_original_uv": True,
        "enable_pbr": False,
        "remove_lighting": bool(args.remove_lighting),
        "target_formats": ["glb"],
        "alpha_thumbnail": True,
        "multi_view_thumbnails": True,
        # Intentionally NO image_style_url — that path strips/washes color.
    }
    if args.input_task_id:
        payload["input_task_id"] = args.input_task_id
    else:
        raw = args.model.read_bytes()
        payload["model_url"] = (
            "data:application/octet-stream;base64," + base64.b64encode(raw).decode()
        )

    tid = post(payload)
    print(f"task_id={tid}", flush=True)
    (OUT / f"{args.name}_retexture_color_id.txt").write_text(tid)
    task = poll(tid)
    (OUT / f"{args.name}_retexture_color.json").write_text(json.dumps(task, indent=2))
    url = None
    mu = task.get("model_urls")
    if isinstance(mu, dict):
        url = mu.get("glb")
    if not url and isinstance(task.get("result"), dict):
        url = task["result"].get("glb") or task["result"].get("animation_glb_url")
    if not url:
        raise RuntimeError(
            f"No GLB URL in task: keys={list(task.keys())} sample={json.dumps(task)[:800]}"
        )
    dest = ASSETS / f"{args.name}_color.glb"
    download(url, dest)
    download(url, OUT / f"{args.name}_color.glb")
    thumb = task.get("thumbnail_url")
    if thumb:
        download(thumb, ASSETS / f"{args.name}_color_thumb.png")
        download(thumb, Path("/opt/cursor/artifacts") / f"{args.name}_color_thumb.png")
    for view, u in (task.get("thumbnail_urls") or {}).items():
        if u:
            download(u, ASSETS / f"{args.name}_color_view_{view}.png")
    print("DONE", dest, flush=True)
    print(
        "NOTE: image_style_url was NOT used. Colors come from the text palette prompt.",
        flush=True,
    )


if __name__ == "__main__":
    main()
