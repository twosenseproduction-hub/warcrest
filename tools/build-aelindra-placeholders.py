#!/usr/bin/env python3
"""Build dev placeholder hero strips from Aelindra key-pose refs.

Repeats a single keyed frame N times into a horizontal strip so sprites.js
can load before Aseprite animation strips exist. Replace outputs when real
strips land in assets/heroes/rimwalker/aelindra/.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REFS = ROOT / "assets/heroes/rimwalker/aelindra/_refs"
OUT = ROOT / "assets/heroes/rimwalker/aelindra"
FRAME = 256
FILL = 0.76


def key_magenta(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 180 and g < 120 and b > 180:
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


def strip_from_ref(ref: Path, count: int, out_name: str) -> None:
    frame = fit_frame(Image.open(ref))
    strip = Image.new("RGBA", (FRAME * count, FRAME), (0, 0, 0, 0))
    for i in range(count):
        strip.paste(frame, (i * FRAME, 0), frame)
    strip.save(OUT / out_name)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mapping = [
        ("canonical_idle.png", 8, "Aelindra_Idle.png"),
        ("walk.png", 8, "Aelindra_Run.png"),
        ("attack_root_lash.png", 4, "Aelindra_Attack.png"),
    ]
    for ref_name, count, out_name in mapping:
        ref = REFS / ref_name
        if not ref.is_file():
            raise SystemExit(f"missing ref: {ref}")
        strip_from_ref(ref, count, out_name)
        print(f"wrote {out_name} ({count} x {FRAME})")

    portrait = fit_frame(Image.open(REFS / "canonical_idle.png"))
    portrait.save(OUT / "Aelindra_Portrait.png")
    print("wrote Aelindra_Portrait.png")


if __name__ == "__main__":
    main()
