#!/usr/bin/env python3
"""Generate Aelindra hero strips via Spritely API (Pixel Labs–style workflow).

Uses /api/mcp/generate (pipeline endpoint is currently 404 on spritely.studio).
Downloads the sheet, splits frames, fits to 256px engine strips.
"""
from __future__ import annotations

import base64
import json
import math
import re
import sys
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REFS = ROOT / "assets/heroes/rimwalker/aelindra/_refs"
OUT = ROOT / "assets/heroes/rimwalker/aelindra"
WORK = ROOT / "tools/.spritely-work/aelindra"
FRAME = 256
FILL = 0.76
API = "https://spritely.studio"
SYS_PY = "/usr/bin/python3"
GEN_ONE = Path(__file__).resolve().parent / "spritely-generate-one.py"

GLOBALS = {
    "character": (
        "Aelindra Ashveil, Tendkeeper druid, dark brown skin, Black features, "
        "thick grey locs, pointed elf ears"
    ),
    "outfit": (
        "wooden antler crown with amber forehead gem, bark-textured armor, "
        "voluminous layered green leaf cloak, pale grey tunic, brown boots"
    ),
    "weapon": "gnarled living-wood staff with small amber gem near the top",
    "palette": (
        "locked earth palette: bark browns, forest greens, pale grey-white, "
        "ember amber accents on gems only — no blue, no gold"
    ),
    "camera": (
        "top-down 3/4 high angle RTS hero, heavy chibi pixel art matching Valdris, "
        "thick dark outline, stipple dither shading, transparent background"
    ),
}

CLIPS = [
    {
        "strip": "Aelindra_Idle.png",
        "ref": "canonical_idle.png",
        "count": 8,
        "prompt": (
            "8-frame horizontal idle loop: staff planted at her side, subtle breathing bob, "
            "leaf cloak sway, feet close together"
        ),
    },
    {
        "strip": "Aelindra_Run.png",
        "ref": "walk.png",
        "count": 8,
        "prompt": (
            "8-frame horizontal run cycle: low grounded gait, staff in right hand, "
            "leaf cloak bounce, compact stride"
        ),
    },
    {
        "strip": "Aelindra_Attack.png",
        "ref": "attack_root_lash.png",
        "count": 4,
        "prompt": (
            "4-frame horizontal Root Lash attack: crouch, staff pull, frame 3 staff base "
            "taps ground hard, recover"
        ),
    },
    {
        "strip": "Aelindra_Thornwall.png",
        "ref": "cast_thornwall.png",
        "count": 6,
        "prompt": (
            "6-frame horizontal Thornwall cast: press staff into ground, frame 4 impact press"
        ),
    },
    {
        "strip": "Aelindra_Verdant.png",
        "ref": "cast_verdant.png",
        "count": 5,
        "prompt": (
            "5-frame horizontal Verdant Pulse cast: eyes close, posture sinks, frame 3 lowest"
        ),
    },
    {
        "strip": "Aelindra_Ashfall.png",
        "ref": "cast_ashfall.png",
        "count": 10,
        "prompt": (
            "10-frame horizontal Ashfall ultimate: raise staff overhead, tremble, release on last frame"
        ),
    },
    {
        "strip": "Aelindra_Hit.png",
        "ref": "canonical_idle.png",
        "count": 2,
        "prompt": "2-frame horizontal hit flinch: tiny shudder, no knockback, staff planted",
    },
    {
        "strip": "Aelindra_Death.png",
        "ref": "canonical_idle.png",
        "count": 6,
        "prompt": (
            "6-frame horizontal death: sinks and settles, leaf cloak droops, hold last frame"
        ),
    },
]


def generate_sheet(prompt: str, count: int, ref_path: Path, slug: str) -> Image.Image:
    raw_path = WORK / "raw" / f"{slug}.png"
    meta_path = WORK / "raw" / f"{slug}.json"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps({"globals": GLOBALS})
    proc = subprocess.run(
        [
            SYS_PY,
            str(GEN_ONE),
            prompt,
            str(count),
            str(ref_path),
            str(raw_path),
            str(meta_path),
            body,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout)
    meta = json.loads(meta_path.read_text())
    print(
        f"  api cost ${meta.get('usage', {}).get('cost', '?')}, "
        f"balance ${meta.get('balanceMdollars', 0) / 1000:.2f}"
    )
    return Image.open(raw_path).convert("RGBA")


def key_magenta(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r > 180 and g < 120 and b > 180:
                px[x, y] = (0, 0, 0, 0)
    return im


def fit_frame(im: Image.Image, size: int = FRAME, fill: float = FILL) -> Image.Image:
    im = key_magenta(im)
    bbox = im.getbbox()
    if not bbox:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cropped = im.crop(bbox)
    target = int(size * fill)
    scale = min(target / cropped.width, target / cropped.height)
    nw = max(1, int(cropped.width * scale))
    nh = max(1, int(cropped.height * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - nw) // 2
    oy = size - nh - int(size * 0.04)
    frame.paste(resized, (ox, oy), resized)
    return frame


def split_sheet(sheet: Image.Image, count: int) -> list[Image.Image]:
    w, h = sheet.size
    # Prefer single-row horizontal strip when aspect ratio fits.
    if w >= h * count * 0.55:
        fw = w // count
        return [sheet.crop((i * fw, 0, (i + 1) * fw, h)) for i in range(count)]
    cols = math.ceil(math.sqrt(count))
    rows = math.ceil(count / cols)
    fw, fh = w // cols, h // rows
    frames: list[Image.Image] = []
    for i in range(count):
        row, col = divmod(i, cols)
        frames.append(sheet.crop((col * fw, row * fh, (col + 1) * fw, (row + 1) * fh)))
    return frames


def build_strip(frames: list[Image.Image], out_path: Path) -> None:
    fitted = [fit_frame(fr) for fr in frames]
    strip = Image.new("RGBA", (FRAME * len(fitted), FRAME), (0, 0, 0, 0))
    for i, fr in enumerate(fitted):
        strip.paste(fr, (i * FRAME, 0), fr)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out_path)


def generate_clip(clip: dict) -> None:
    name = clip["strip"]
    ref = REFS / clip["ref"]
    print(f"\n==> {name} ({clip['count']} frames)")
    slug = re.sub(r"[^a-z0-9]+", "_", name.replace(".png", "").lower())
    sheet = generate_sheet(clip["prompt"], clip["count"], ref, slug)
    frames = split_sheet(sheet, clip["count"])
    clip_dir = WORK / name.replace(".png", "")
    clip_dir.mkdir(parents=True, exist_ok=True)
    for i, fr in enumerate(frames):
        fr.save(clip_dir / f"frame_{i:02d}.png")
    build_strip(frames, OUT / name)
    print(f"  saved {OUT / name} ({sheet.size[0]}x{sheet.size[1]} source)")


def build_portrait() -> None:
    frame = fit_frame(Image.open(REFS / "canonical_idle.png").convert("RGBA"))
    frame.save(OUT / "Aelindra_Portrait.png")
    print(f"saved {OUT / 'Aelindra_Portrait.png'}")


def main() -> None:
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    for clip in CLIPS:
        if only and clip["strip"] not in only:
            continue
        generate_clip(clip)
    if not only or "Aelindra_Portrait.png" in only:
        build_portrait()
    print("\nDone.")


if __name__ == "__main__":
    main()
