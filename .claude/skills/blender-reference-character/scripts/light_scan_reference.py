#!/usr/bin/env python3
"""LiDAR-style light/value scan of a character reference image.

Turns a painted/reference PNG into analysis sheets so agents can read form
(ridges, cavities, part breaks) the way sculptors read raking light — not just
albedo colors.

  python3 .claude/skills/blender-reference-character/scripts/light_scan_reference.py \
    --image /path/to/ref.png \
    --out exports/blender-rig-test/light-scan/<name>
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps


def load_rgba(path: Path) -> tuple[np.ndarray, Image.Image]:
    im = Image.open(path).convert("RGBA")
    arr = np.asarray(im).astype(np.float32) / 255.0
    return arr, im


def luminance(rgb: np.ndarray) -> np.ndarray:
    # Rec. 709 perceptual luma
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def sobel_edges(lum: np.ndarray) -> np.ndarray:
    """Simple Sobel magnitude; lum in [0,1]."""
    # pad
    p = np.pad(lum, 1, mode="edge")
    gx = (
        -1 * p[:-2, :-2]
        + 1 * p[:-2, 2:]
        - 2 * p[1:-1, :-2]
        + 2 * p[1:-1, 2:]
        - 1 * p[2:, :-2]
        + 1 * p[2:, 2:]
    )
    gy = (
        -1 * p[:-2, :-2]
        - 2 * p[:-2, 1:-1]
        - 1 * p[:-2, 2:]
        + 1 * p[2:, :-2]
        + 2 * p[2:, 1:-1]
        + 1 * p[2:, 2:]
    )
    mag = np.sqrt(gx * gx + gy * gy)
    m = mag.max() or 1.0
    return np.clip(mag / m, 0, 1)


def highpass_relief(lum: np.ndarray, blur_radius: int = 8) -> np.ndarray:
    """Local contrast = luminance - blurred luminance (detail / micro-relief)."""
    # box blur via integral-ish downsample upsample for speed
    h, w = lum.shape
    small = Image.fromarray((lum * 255).astype(np.uint8), mode="L")
    r = max(2, blur_radius)
    blurred = small.resize((max(1, w // r), max(1, h // r)), Image.BILINEAR)
    blurred = blurred.resize((w, h), Image.BILINEAR)
    b = np.asarray(blurred).astype(np.float32) / 255.0
    detail = lum - b
    # normalize to mid-gray centered
    d = detail - detail.mean()
    s = np.percentile(np.abs(d), 98) or 1e-6
    out = 0.5 + 0.5 * np.clip(d / s, -1, 1)
    return out


def to_u8(x: np.ndarray) -> np.ndarray:
    return np.clip(x * 255.0, 0, 255).astype(np.uint8)


def save_gray(path: Path, arr: np.ndarray) -> None:
    Image.fromarray(to_u8(arr), mode="L").save(path)


def label_sheet(images: list[tuple[str, Image.Image]], out: Path, cols: int = 4) -> None:
    """Contact sheet with captions."""
    if not images:
        return
    w = max(im.width for _, im in images)
    h = max(im.height for _, im in images)
    # normalize sizes
    normed = []
    for title, im in images:
        if im.mode != "RGB":
            im = im.convert("RGB")
        if im.size != (w, h):
            im = ImageOps.contain(im, (w, h), Image.LANCZOS)
            canvas = Image.new("RGB", (w, h), (20, 20, 24))
            canvas.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
            im = canvas
        normed.append((title, im))

    caption_h = 28
    rows = (len(normed) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w, rows * (h + caption_h)), (12, 12, 16))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    for i, (title, im) in enumerate(normed):
        r, c = divmod(i, cols)
        x, y = c * w, r * (h + caption_h)
        sheet.paste(im, (x, y + caption_h))
        draw.rectangle([x, y, x + w, y + caption_h], fill=(28, 28, 36))
        draw.text((x + 8, y + 6), title, fill=(220, 220, 230), font=font)

    sheet.save(out)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--image", required=True, help="Reference PNG/JPG path")
    ap.add_argument("--out", required=True, help="Output directory")
    ap.add_argument("--blur", type=int, default=10, help="High-pass blur radius proxy")
    ap.add_argument("--shadow-pct", type=float, default=28.0, help="Shadow mask percentile")
    ap.add_argument("--highlight-pct", type=float, default=78.0, help="Highlight mask percentile")
    args = ap.parse_args()

    src = Path(args.image)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    rgba, pil = load_rgba(src)
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]
    lum = luminance(rgb)
    # keep transparent areas dark so edges don't fire on checker
    lum = np.where(alpha > 0.05, lum, 0.0)

    edges = sobel_edges(lum)
    relief = highpass_relief(lum, blur_radius=args.blur)

    # percentile masks on opaque pixels only
    opaque = alpha > 0.05
    vals = lum[opaque]
    if vals.size == 0:
        raise SystemExit("Image has no opaque pixels")
    lo = np.percentile(vals, args.shadow_pct)
    hi = np.percentile(vals, args.highlight_pct)
    shadow = np.where(opaque & (lum <= lo), 1.0, 0.0)
    highlight = np.where(opaque & (lum >= hi), 1.0, 0.0)

    # save
    pil.convert("RGB").save(out / "00_original.png")
    save_gray(out / "01_luminance.png", lum)
    save_gray(out / "02_edges.png", edges)
    save_gray(out / "03_relief.png", relief)
    save_gray(out / "04_shadow_mask.png", shadow)
    save_gray(out / "05_highlight_mask.png", highlight)

    # RGB false-color: R=highlight, G=mid, B=shadow for quick Read
    mid = np.clip(1.0 - highlight - shadow, 0, 1) * opaque
    false = np.stack([highlight, mid * lum, shadow], axis=-1)
    Image.fromarray(to_u8(false), mode="RGB").save(out / "05b_value_falsecolor.png")

    sheet_imgs = [
        ("00 original", Image.open(out / "00_original.png")),
        ("01 luminance", Image.open(out / "01_luminance.png").convert("RGB")),
        ("02 edges", Image.open(out / "02_edges.png").convert("RGB")),
        ("03 relief", Image.open(out / "03_relief.png").convert("RGB")),
        ("04 shadows", Image.open(out / "04_shadow_mask.png").convert("RGB")),
        ("05 highlights", Image.open(out / "05_highlight_mask.png").convert("RGB")),
        ("05b value RGB", Image.open(out / "05b_value_falsecolor.png")),
    ]
    label_sheet(sheet_imgs, out / "06_scan_sheet.png", cols=4)

    meta = {
        "source": str(src.resolve()),
        "size": list(pil.size),
        "shadow_percentile": args.shadow_pct,
        "highlight_percentile": args.highlight_pct,
        "blur": args.blur,
        "opaque_luma_mean": float(vals.mean()),
        "opaque_luma_p10": float(np.percentile(vals, 10)),
        "opaque_luma_p90": float(np.percentile(vals, 90)),
        "files": [p.name for p in sorted(out.glob("*.png"))],
        "howto": (
            "Read 06_scan_sheet.png first, then fill card.light_scan "
            "(ridges from highlights, cavities from shadows, part_breaks from edges)."
        ),
    }
    (out / "scan_meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
