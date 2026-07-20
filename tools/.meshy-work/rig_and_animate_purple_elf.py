#!/usr/bin/env python3
"""Rig purple elf + apply Meshy archer animation library clips."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

RIG_API = "https://api.meshy.ai/openapi/v1/rigging"
ANIM_API = "https://api.meshy.ai/openapi/v1/animations"
OUT = Path(__file__).resolve().parent
ASSETS = Path(__file__).resolve().parents[2] / "assets" / "models" / "meshy"
STEM = "purple_elf_meshy"

# Prefer matte retexture task; fall back to lowpoly image-to-3d
INPUT_CANDIDATES = [
    OUT / f"{STEM}_retexture_id.txt",
    OUT / f"{STEM}_lowpoly_task_id.txt",
]

# Game-useful archer set (Meshy Animation Library action_ids)
ARCHER_ACTIONS = [
    ("idle", 0),
    ("walk", 1),  # Walking Woman
    ("run", -1),
    ("attack", 224),  # Archery Shot
    ("attack_alt", 225),  # Archery Shot 1
    ("aim", 231),  # Archery Aim with Lateral Scan
    ("draw_shoot", 222),  # Draw and Shoot from Back
    ("hit", 150),  # Hit Reaction with Bow
    ("walk_aimed", 228),  # Walk Forward with Bow Aimed
]


def headers():
    key = os.environ.get("MESHY_API_KEY")
    if not key:
        sys.exit("MESHY_API_KEY not set")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def post(url: str, payload: dict) -> str:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), headers=headers(), method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"POST {url} failed {e.code}: {e.read().decode()}") from e
    tid = body.get("result")
    if not tid:
        raise RuntimeError(f"No task id: {body}")
    return tid


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers=headers())
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def poll(url: str, label: str) -> dict:
    while True:
        task = get(url)
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


def pick_input_task() -> str:
    for p in INPUT_CANDIDATES:
        if p.exists():
            tid = p.read_text().strip()
            print(f"input_task_id from {p.name}: {tid}", flush=True)
            return tid
    sys.exit("no input task id found")


def main() -> None:
    input_task = pick_input_task()
    print("Creating rigging task…", flush=True)
    try:
        rig_id = post(
            RIG_API,
            {"input_task_id": input_task, "height_meters": 1.7},
        )
    except RuntimeError as e:
        print(f"retexture input failed ({e}); trying lowpoly…", flush=True)
        low = (OUT / f"{STEM}_lowpoly_task_id.txt").read_text().strip()
        rig_id = post(RIG_API, {"input_task_id": low, "height_meters": 1.7})
    print(f"rig_task_id={rig_id}", flush=True)
    (OUT / f"{STEM}_rig_id.txt").write_text(rig_id)
    rig = poll(f"{RIG_API}/{rig_id}", "rig")
    (OUT / f"{STEM}_rig.json").write_text(json.dumps(rig, indent=2))
    result = rig.get("result") or {}
    if result.get("rigged_character_glb_url"):
        download(result["rigged_character_glb_url"], ASSETS / f"{STEM}_rigged.glb")
        download(result["rigged_character_glb_url"], OUT / f"{STEM}_rigged.glb")
    basic = result.get("basic_animations") or {}
    for key, url in basic.items():
        if url and key.endswith("_glb_url"):
            name = key.replace("_glb_url", "")
            download(url, ASSETS / f"{STEM}_anim_{name}.glb")
            download(url, OUT / f"{STEM}_anim_{name}.glb")

    anim_dir = ASSETS / "anims"
    anim_dir.mkdir(parents=True, exist_ok=True)
    meta = {"rig_task_id": rig_id, "clips": {}}

    for name, action_id in ARCHER_ACTIONS:
        print(f"Animating {name} (action_id={action_id})…", flush=True)
        try:
            anim_id = post(
                ANIM_API, {"rig_task_id": rig_id, "action_id": action_id}
            )
        except RuntimeError as e:
            print(f"  SKIP {name}: {e}", flush=True)
            meta["clips"][name] = {"action_id": action_id, "error": str(e)}
            continue
        print(f"  anim_task_id={anim_id}", flush=True)
        (OUT / f"{STEM}_anim_{name}_id.txt").write_text(anim_id)
        try:
            anim = poll(f"{ANIM_API}/{anim_id}", f"anim:{name}")
        except RuntimeError as e:
            print(f"  FAIL {name}: {e}", flush=True)
            meta["clips"][name] = {"action_id": action_id, "task_id": anim_id, "error": str(e)}
            continue
        (OUT / f"{STEM}_anim_{name}.json").write_text(json.dumps(anim, indent=2))
        ares = anim.get("result") or {}
        glb = ares.get("animation_glb_url")
        if not glb:
            meta["clips"][name] = {"action_id": action_id, "task_id": anim_id, "error": "no glb"}
            continue
        dest = anim_dir / f"{STEM}_{name}.glb"
        download(glb, dest)
        download(glb, OUT / f"{STEM}_anim_{name}.glb")
        meta["clips"][name] = {
            "action_id": action_id,
            "task_id": anim_id,
            "file": str(dest.relative_to(ASSETS.parent.parent)),
        }

    (ASSETS / f"{STEM}_anims.json").write_text(json.dumps(meta, indent=2))
    (OUT / f"{STEM}_anims.json").write_text(json.dumps(meta, indent=2))
    print("DONE", json.dumps(meta, indent=2), flush=True)


if __name__ == "__main__":
    main()
