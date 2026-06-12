#!/usr/bin/env python3
"""Bake 9-slice SpecialPaper + 3-slice ribbon caps from Tiny Swords UI sheets."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TS = ROOT / "assets/tiny-swords/UI Elements/UI Elements"
OUT = ROOT / "assets/ui"

SPECIAL = TS / "Papers/SpecialPaper.png"
RIBBONS = TS / "Ribbons/BigRibbons.png"

# SpecialPaper: 64px tiles on a 320 grid with 64px gutters.
SLICE = 64
GRID = [(0, 0), (128, 0), (256, 0), (0, 128), (128, 128), (256, 128), (0, 256), (128, 256), (256, 256)]

# BigRibbons rows (y0, y1) and column segments (x0, x1).
RIBBON_ROWS = {
    "blue": 20,
    "red": 148,
    "yellow": 276,
    "purple": 404,
    "grey": 532,
}
ROW_H = 103
CAPS = ((59, 127), (192, 255), (320, 388))


def bake_special_paper() -> None:
    src = Image.open(SPECIAL).convert("RGBA")
    out = Image.new("RGBA", (SLICE * 3, SLICE * 3), (0, 0, 0, 0))
    for i, (sx, sy) in enumerate(GRID):
        tile = src.crop((sx, sy, sx + SLICE, sy + SLICE))
        dx = (i % 3) * SLICE
        dy = (i // 3) * SLICE
        out.paste(tile, (dx, dy), tile)
    out.save(OUT / "special-paper-9.png", optimize=True)
    print("wrote special-paper-9.png", out.size)


def crop_cap(sheet: Image.Image, row_y: int, x0: int, x1: int) -> Image.Image:
    return sheet.crop((x0, row_y, x1 + 1, row_y + ROW_H))


def bake_ribbon_set(sheet: Image.Image, name: str, row_y: int) -> tuple[int, int]:
    left, mid, right = [crop_cap(sheet, row_y, x0, x1) for x0, x1 in CAPS]
    left.save(OUT / f"ribbon-{name}-left.png", optimize=True)
    mid.save(OUT / f"ribbon-{name}-mid.png", optimize=True)
    right.save(OUT / f"ribbon-{name}-right.png", optimize=True)
    return left.size[0], right.size[0]


def bake_ribbon_wide(sheet: Image.Image, name: str, row_y: int, width: int = 520) -> None:
    left, mid, right = [crop_cap(sheet, row_y, x0, x1) for x0, x1 in CAPS]
    lw, rw = left.size[0], right.size[0]
    mw = mid.size[0]
    inner = max(32, width - lw - rw)
    canvas = Image.new("RGBA", (lw + inner + rw, ROW_H), (0, 0, 0, 0))
    canvas.paste(left, (0, 0), left)
    x = lw
    while x < lw + inner:
        canvas.paste(mid, (x, 0), mid)
        x += mw
    canvas.paste(right, (lw + inner, 0), right)
    canvas.save(OUT / f"ribbon-{name}-{width}.png", optimize=True)
    print(f"wrote ribbon-{name}-{width}.png", canvas.size)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    bake_special_paper()
    sheet = Image.open(RIBBONS).convert("RGBA")
    for name, row_y in RIBBON_ROWS.items():
        bake_ribbon_set(sheet, name, row_y)
        bake_ribbon_wide(sheet, name, row_y, 520)
        bake_ribbon_wide(sheet, name, row_y, 360)
    print("done")


if __name__ == "__main__":
    main()
