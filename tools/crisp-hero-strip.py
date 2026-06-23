#!/usr/bin/env python3
"""Crisp hero strip export — key, foot-anchor fit, nearest upscale only.

Skips the --hero-sharp pixelize downscale/upscale cycle that blurs 128px
pixel art. Use for Aelindra and other heroes whose source frames are already
game-ready at 128 or 256px.
"""
from __future__ import annotations

import argparse
import json
import math
import urllib.request
from pathlib import Path

from PIL import Image

CANVAS = 256
FOOT_RATIO = 0.94
FILL = 0.76
KEY_BLACK = (0, 0, 0)
KEY_MAGENTA = (255, 0, 255)
MAGENTA_TOL = 48

ROOT = Path(__file__).resolve().parents[1]
HERO_DIR = ROOT / "assets/heroes/rimwalker/aelindra"


def key_chroma(im: Image.Image) -> Image.Image:
    """Key pure black and magenta (#FF00FF) to transparent."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            if r < 24 and g < 24 and b < 24:
                px[x, y] = (0, 0, 0, 0)
                continue
            if a < 200 and r < 40 and g < 40 and b < 40:
                px[x, y] = (0, 0, 0, 0)
                continue
            if r > 255 - MAGENTA_TOL and g < MAGENTA_TOL and b > 255 - MAGENTA_TOL:
                px[x, y] = (0, 0, 0, 0)
    return im


def alpha_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 128:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def fit_frame(
    im: Image.Image,
    size: int = CANVAS,
    fill: float = FILL,
    foot_ratio: float = FOOT_RATIO,
    ref_bbox: tuple[int, int, int, int] | None = None,
) -> Image.Image:
    """Fit keyed content onto a square canvas with foot anchor."""
    im = key_chroma(im)
    bbox = alpha_bbox(im)
    if not bbox:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))

    min_x, min_y, max_x, max_y = bbox
    cropped = im.crop((min_x, min_y, max_x + 1, max_y + 1))
    cw, ch = cropped.size

    if ref_bbox:
        rmin_x, rmin_y, rmax_x, rmax_y = ref_bbox
        ref_h = rmax_y - rmin_y + 1
        ref_cx = (rmin_x + rmax_x) / 2
        ref_foot = rmax_y
        scale = ref_h / ch
    else:
        target = int(size * fill)
        scale = min(target / cw, target / ch)
        ref_cx = size / 2
        ref_foot = int(size * foot_ratio)

    nw = max(1, round(cw * scale))
    nh = max(1, round(ch * scale))

    if nh == size and nw == size and ch == size and cw == size:
        return cropped

    if ch == size // 2 and nh == size and scale == 2.0:
        scaled = cropped.resize((nw, nh), Image.Resampling.NEAREST)
    elif nh <= size and nw <= size and scale >= 1.0 and scale == round(scale):
        scaled = cropped.resize((nw, nh), Image.Resampling.NEAREST)
    elif scale >= 1.0:
        scaled = cropped.resize((nw, nh), Image.Resampling.NEAREST)
    else:
        scaled = cropped.resize((nw, nh), Image.Resampling.NEAREST)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = round(ref_cx - nw / 2)
    y = round(ref_foot - nh + 1)
    x = max(0, min(size - nw, x))
    y = max(0, min(size - nh, y))
    out.paste(scaled, (x, y), scaled)
    return out


def pixelize_frame(im: Image.Image, cell: int) -> Image.Image:
    """Pixelate: shrink to cell×cell with BOX, then scale back up with NEAREST."""
    if cell <= 0:
        return im
    w, h = im.size
    # Preserve alpha during the downscale by using BOX (area average)
    small = im.resize((cell, cell), Image.Resampling.BOX)
    return small.resize((w, h), Image.Resampling.NEAREST)


def crisp_frame(
    im: Image.Image,
    size: int = CANVAS,
    ref_bbox: tuple[int, int, int, int] | None = None,
    pixelize: int | None = None,
) -> Image.Image:
    """Passthrough: key, integer nearest upscale only, optional pixelation."""
    im = key_chroma(im)
    w, h = im.size

    if w == size and h == size:
        if ref_bbox:
            im = fit_frame(im, size, ref_bbox=ref_bbox)
        if pixelize:
            im = pixelize_frame(im, pixelize)
        return im

    if h == size // 2 and w == size // 2:
        im = fit_frame(im, size, ref_bbox=ref_bbox)
        if pixelize:
            im = pixelize_frame(im, pixelize)
        return im

    if h == 128 and w == 128:
        upscaled = im.resize((256, 256), Image.Resampling.NEAREST)
        if ref_bbox:
            upscaled = fit_frame(upscaled, size, ref_bbox=ref_bbox)
        if pixelize:
            upscaled = pixelize_frame(upscaled, pixelize)
        return upscaled

    im = fit_frame(im, size, ref_bbox=ref_bbox)
    if pixelize:
        im = pixelize_frame(im, pixelize)
    return im


def split_strip(img: Image.Image) -> list[Image.Image]:
    w, h = img.size
    if h <= 0 or w % h != 0:
        raise ValueError(f"Not a horizontal strip: {w}×{h}")
    count = w // h
    return [img.crop((i * h, 0, (i + 1) * h, h)) for i in range(count)]


def build_strip(frames: list[Image.Image], out_path: Path) -> Path:
    if not frames:
        raise ValueError("no frames")
    size = frames[0].size[0]
    strip = Image.new("RGBA", (size * len(frames), size), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        strip.paste(fr, (i * size, 0), fr)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out_path)
    return out_path


def process_strip_path(
    strip_path: Path,
    out_path: Path | None = None,
    ref_bbox: tuple[int, int, int, int] | None = None,
    repeat_each: int = 1,
    pixelize: int | None = None,
    single: bool = False,
) -> Path:
    src = Image.open(strip_path).convert("RGBA")
    w, h = src.size
    if single or h <= 0 or w % h != 0:
        # Treat the whole image as one frame; key + pixelate + save as-is
        frame = key_chroma(src)
        if pixelize:
            frame = pixelize_frame(frame, pixelize)
        dest = out_path or strip_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        frame.save(dest)
        print(f"single: {dest} ({frame.size[0]}×{frame.size[1]})")
        return dest
    frames = split_strip(src)
    out_frames = [crisp_frame(fr, ref_bbox=ref_bbox, pixelize=pixelize) for fr in frames]
    if repeat_each > 1:
        out_frames = [f for f in out_frames for _ in range(repeat_each)]
    dest = out_path or strip_path
    return build_strip(out_frames, dest)


def process_frame_dir(
    frame_dir: Path,
    out_path: Path,
    pattern: str = "frame_*.png",
    ref_bbox: tuple[int, int, int, int] | None = None,
    pixelize: int | None = None,
) -> Path:
    files = sorted(frame_dir.glob(pattern))
    if not files:
        files = sorted(frame_dir.glob("*.png"))
    frames = [crisp_frame(Image.open(f), ref_bbox=ref_bbox, pixelize=pixelize) for f in files]
    return build_strip(frames, out_path)


def process_glob_frames(
    glob_pattern: str,
    out_path: Path,
    ref_bbox: tuple[int, int, int, int] | None = None,
    pixelize: int | None = None,
) -> Path:
    files = sorted(ROOT.glob(glob_pattern))
    if not files:
        raise FileNotFoundError(glob_pattern)
    frames = [crisp_frame(Image.open(f), ref_bbox=ref_bbox, pixelize=pixelize) for f in files]
    return build_strip(frames, out_path)


def pad_frames(frames: list[Image.Image], count: int) -> list[Image.Image]:
    if len(frames) >= count:
        return frames[:count]
    out = list(frames)
    while len(out) < count:
        out.append(out[-1].copy())
    return out


def expand_attack_four_to_eight(frames: list[Image.Image]) -> list[Image.Image]:
    """Timing holds: wind-up, impact (frame index 3), recovery."""
    if len(frames) != 4:
        return pad_frames(frames, 8)
    f0, f1, f2, f3 = frames
    return [f0, f0, f1, f2, f2, f3, f3, f3]


def reference_bbox_from_frame(frame_path: Path) -> tuple[int, int, int, int] | None:
    im = crisp_frame(Image.open(frame_path))
    return alpha_bbox(im)


def download_pixellab_walk_jobs(direction: str, count: int = 8) -> list[Image.Image]:
    """Load walk frames from cached walk_animation_jobs.json (east/west templates)."""
    jobs_path = ROOT / "tools/.pixellab-work/walk_animation_jobs.json"
    if not jobs_path.is_file():
        raise FileNotFoundError(jobs_path)
    text = jobs_path.read_text()
    import re

    pat = rf'"direction": "{direction}"[^}}]*?"frames": \[(.*?)\]'
    m = re.search(pat, text, re.DOTALL)
    if not m:
        raise FileNotFoundError(f"no cached pixellab jobs for {direction}")
    urls = re.findall(r"https://backblaze\.pixellab\.ai/file/[^\"\\]+", m.group(1))
    if not urls:
        raise FileNotFoundError(f"no urls for {direction}")

    frames: list[Image.Image] = []
    for url in urls:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            frames.append(Image.open(r).convert("RGBA"))

    if len(frames) < count:
        expanded: list[Image.Image] = []
        for fr in frames:
            expanded.extend([fr, fr.copy()])
        frames = expanded[:count]
    elif len(frames) > count:
        step = len(frames) / count
        frames = [frames[min(len(frames) - 1, int(i * step))] for i in range(count)]
    return frames


def download_pixellab_walk(direction: str, count: int | None = None) -> list[Image.Image]:
    key = None
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("PIXELLAB_API_KEY="):
            key = line.split("=", 1)[1].strip()
    if not key:
        raise SystemExit("PIXELLAB_API_KEY missing")

    char_id = "25cba5ef-4c17-4b89-93c1-3abc53ef5015"
    req = urllib.request.Request(
        f"https://api.pixellab.ai/v2/characters/{char_id}",
        headers={"Authorization": f"Bearer {key}", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        char = json.loads(r.read().decode())

    urls: list[str] = []
    for ag in char.get("animations", []):
        if ag.get("animation_type") != "walk":
            continue
        for d in ag.get("directions", []):
            if d.get("direction") == direction:
                urls = list(d.get("frames", []))
                break

    if not urls:
        raise FileNotFoundError(f"no pixellab walk for {direction}")

    frames: list[Image.Image] = []
    for url in urls:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            frames.append(Image.open(r).convert("RGBA"))

    if count is not None:
        if len(frames) > count:
            step = len(frames) / count
            frames = [frames[min(len(frames) - 1, int(i * step))] for i in range(count)]
        else:
            frames = pad_frames(frames, count)
    return frames


def rebuild_aelindra() -> None:
    """DEPRECATED — do not bulk-rebuild hero strips. Agents must not auto-generate art."""
    raise SystemExit(
        "rebuild-aelindra is disabled. Process only explicit user-provided strips:\n"
        "  python3 tools/crisp-hero-strip.py --strip <path> --out assets/heroes/rimwalker/aelindra/<Name>.png\n"
        "Never download Pixel Lab / Spritely frames or overwrite shipped strips without the artist."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Crisp hero strip export (no pixelize blur)")
    parser.add_argument("--strip", type=Path, help="Process one horizontal strip in place")
    parser.add_argument("--strip-dir", type=Path, help="Process all PNG strips in a directory")
    parser.add_argument("--frame-dir", type=Path, help="Build strip from frame_*.png directory")
    parser.add_argument("--out", type=Path, help="Output strip path")
    parser.add_argument("--repeat-each", type=int, default=1, help="Repeat each frame N times")
    parser.add_argument(
        "--pixelize", type=int, default=None, metavar="N",
        help="Pixelate by downscaling to N×N then back up with nearest-neighbor (e.g. --pixelize 32)",
    )
    parser.add_argument(
        "--single", action="store_true",
        help="Treat input as a single image (not a square strip) — use with buildings, props, etc.",
    )
    parser.add_argument("--rebuild-aelindra", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    if args.rebuild_aelindra:
        rebuild_aelindra()
        return

    if args.frame_dir:
        d = args.frame_dir if args.frame_dir.is_absolute() else ROOT / args.frame_dir
        out = args.out if args.out else d.with_suffix(".strip.png")
        if not out.is_absolute():
            out = ROOT / out
        process_frame_dir(d, out, pixelize=args.pixelize)
        print(out)
        return

    targets: list[Path] = []
    if args.strip:
        p = args.strip if args.strip.is_absolute() else ROOT / args.strip
        targets.append(p)
    if args.strip_dir:
        d = args.strip_dir if args.strip_dir.is_absolute() else ROOT / args.strip_dir
        targets.extend(sorted(d.glob("*.png")))

    for p in targets:
        if not p.is_file():
            print(f"skip (missing): {p}")
            continue
        out_path = None
        if args.out:
            out_path = args.out if args.out.is_absolute() else ROOT / args.out
        out = process_strip_path(p, out_path=out_path, ref_bbox=None, repeat_each=args.repeat_each, pixelize=args.pixelize, single=args.single)
        if not out.is_file():
            continue
        im = Image.open(out)
        try:
            label = out.relative_to(ROOT)
        except ValueError:
            label = out
        print(f"crisp: {label} ({im.size[0]}×{im.size[1]})")


if __name__ == "__main__":
    main()
