#!/usr/bin/env python3
"""Meshy Image-to-3D helper — fetch a sharp white/textured GLB from a reference.

Requires env MESHY_API_KEY (Bearer). Prefer white model first (--no-texture),
approve silhouette via PNG preview, then retexture if needed.

  export MESHY_API_KEY=...
  python3 tools/meshy/image_to_3d.py \
    --image /path/to/ref.png \
    --out exports/meshy/violet_cape \
    --no-texture

Docs: https://docs.meshy.ai/en/api/image-to-3d
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.meshy.ai/openapi/v1/image-to-3d"


def die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def http_json(method: str, url: str, key: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        die(f"HTTP {e.code} {url}\n{err}")


def image_to_data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    if mime not in ("image/png", "image/jpeg", "image/jpg"):
        die(f"Meshy accepts png/jpg; got {mime}")
    if mime == "image/jpg":
        mime = "image/jpeg"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "warcrest-meshy/1.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        dest.write_bytes(resp.read())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--image", required=True, help="Local reference PNG/JPG")
    ap.add_argument("--out", required=True, help="Output directory")
    ap.add_argument("--image-url", default=None, help="Public URL instead of local file")
    ap.add_argument("--no-texture", action="store_true", help="White model only (recommended first)")
    ap.add_argument("--texture", action="store_true", help="Force textured output")
    ap.add_argument("--ai-model", default="latest", help="Meshy model id (default latest)")
    ap.add_argument("--model-type", default="standard", choices=["standard", "smart-topology"])
    ap.add_argument("--target-polycount", type=int, default=None)
    ap.add_argument("--poll-sec", type=float, default=5.0)
    ap.add_argument("--timeout-sec", type=float, default=900.0)
    args = ap.parse_args()

    key = os.environ.get("MESHY_API_KEY") or os.environ.get("MESHY_KEY")
    if not key:
        die(
            "MESHY_API_KEY not set.\n"
            "Add it as a Cursor Cloud secret, then re-run.\n"
            "Without Meshy, sharp detail requires a user-dropped Meshy/Tripo GLB.\n"
            "See .claude/skills/image-to-3d-from-reference/references/sharp-detail-path.md"
        )

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    if args.image_url:
        image_url = args.image_url
    else:
        img = Path(args.image)
        if not img.is_file():
            die(f"image not found: {img}")
        image_url = image_to_data_uri(img)
        dest_src = out / f"source{img.suffix.lower()}"
        dest_src.write_bytes(img.read_bytes())

    should_texture = True
    if args.no_texture:
        should_texture = False
    if args.texture:
        should_texture = True

    body: dict = {
        "image_url": image_url,
        "ai_model": args.ai_model,
        "model_type": args.model_type,
        "should_texture": should_texture,
        "should_remesh": True,
    }
    if args.target_polycount is not None:
        body["target_polycount"] = args.target_polycount

    (out / "request.json").write_text(json.dumps(body if "base64" not in image_url else {
        **{k: v for k, v in body.items() if k != "image_url"},
        "image_url": "<data-uri omitted>",
        "should_texture": should_texture,
    }, indent=2) + "\n")

    print("Creating Meshy image-to-3d task…")
    created = http_json("POST", API, key, body)
    task_id = created.get("result") or created.get("id")
    if not task_id:
        die(f"unexpected create response: {created}")
    print("task_id", task_id)
    (out / "task_id.txt").write_text(str(task_id) + "\n")

    t0 = time.time()
    task = None
    while True:
        task = http_json("GET", f"{API}/{task_id}", key)
        status = task.get("status")
        prog = task.get("progress")
        print(f"  status={status} progress={prog}")
        if status in ("SUCCEEDED", "FAILED", "CANCELED"):
            break
        if time.time() - t0 > args.timeout_sec:
            die(f"timeout after {args.timeout_sec}s; task_id={task_id}")
        time.sleep(args.poll_sec)

    (out / "task.json").write_text(json.dumps(task, indent=2) + "\n")
    if task.get("status") != "SUCCEEDED":
        die(f"task failed: {task.get('task_error') or task}")

    urls = task.get("model_urls") or {}
    glb_url = urls.get("glb")
    if not glb_url:
        die(f"no glb url in task: {urls}")
    glb_path = out / "model.glb"
    print("Downloading", glb_url)
    download(glb_url, glb_path)
    print("Wrote", glb_path, glb_path.stat().st_size, "bytes")

    # thumbnail if present
    for i, th in enumerate(task.get("thumbnail_url") and [task["thumbnail_url"]] or []):
        try:
            download(th, out / f"meshy_thumb_{i}.png")
        except Exception as e:
            print("thumb skip", e)

    meta = {
        "task_id": task_id,
        "glb": str(glb_path.resolve()),
        "should_texture": should_texture,
        "ai_model": args.ai_model,
        "model_type": args.model_type,
        "next": (
            "blender -b -noaudio --python tools/meshy/import_and_preview.py -- "
            f"--glb {glb_path} --name {out.name} --out {out / 'preview'}"
        ),
        "license_note": "Confirm Meshy plan allows exclusive game use before shipping to Warcrest.",
    }
    (out / "result.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
