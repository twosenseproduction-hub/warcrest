#!/usr/bin/env python3
"""
hero_from_tiny.py — turn a Tiny RPG Character (side-view, 100px strips) into a
Warcrest hero by recoloring + stamping features, frame by frame, so every
animation is preserved.

Aelindra recipe: human skin -> night-elf lavender, blue robe -> leaf green,
plus tan deer-antlers w/ leaf buds anchored to each frame's head.

Usage:
    python3 tools/art/hero_from_tiny.py <TinyPackCharDir> [hero_id]

<TinyPackCharDir> is the pack folder holding the *-Idle.png etc. strips, e.g.
  ".../Characters(100x100)/Wizard/Wizard"
Outputs horizontal strips to assets/heroes/<faction>/<hero_id>/tiny/<anim>.png
(only the game-ready sprites — never the raw pack).
"""
import sys, os, glob
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FW = 100
# source strip basename -> output anim name
ANIMS = {'Idle': 'idle', 'Walk': 'walk', 'Attack01': 'attack', 'Attack02': 'attack2',
         'Hurt': 'hurt', 'DEATH': 'death', 'Death': 'death'}

AN = (150, 112, 72); ANH = (196, 158, 108); AND_ = (104, 76, 48)
LEAF = (96, 162, 80); LEAFH = (150, 205, 120)

def is_skin(r, g, b): return r > 120 and r >= g >= b and 25 < (r - b) < 135 and g > 80
def is_blue(r, g, b): return b > r + 12 and b > g + 6 and b > 55

def dot(d, x, y, c): d.point((int(x), int(y)), fill=c)

def antler(d, bx, by, side):
    pts = [(0, 0), (1, -2), (1, -4), (2, -6), (2, -8), (3, -10), (3, -12)]
    for i, (dx, dy) in enumerate(pts):
        x = bx + side * dx; y = by + dy
        dot(d, x, y, AN); dot(d, x, y - 1, ANH if i > 1 else AN); dot(d, x - side, y, AND_)
    dot(d, bx + side * 3, by - 5, AN); dot(d, bx + side * 4, by - 6, AN); dot(d, bx + side * 5, by - 7, ANH)
    dot(d, bx + side * 4, by - 9, AN); dot(d, bx + side * 5, by - 10, ANH)
    dot(d, bx + side * 3, by - 13, LEAF); dot(d, bx + side * 4, by - 13, LEAFH); dot(d, bx + side * 5, by - 8, LEAF)

def process_frame(fr):
    fr = fr.copy(); px = fr.load(); W, H = fr.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 40: continue
            if is_skin(r, g, b):
                L = (0.299 * r + 0.587 * g + 0.114 * b) / 255
                px[x, y] = (int(70 + 135 * L), int(48 + 137 * L), int(100 + 138 * L), a)
            elif is_blue(r, g, b):
                px[x, y] = (int(b * 0.28), int(b * 0.82), int(b * 0.42), a)
    bb = fr.getbbox()
    if bb:
        d = ImageDraw.Draw(fr); cx = (bb[0] + bb[2]) // 2; top = bb[1]; by = top + 12
        antler(d, cx - 3, by, -1); antler(d, cx + 3, by, 1)
    return fr

def process_strip(path):
    strip = Image.open(path).convert('RGBA')
    n = strip.width // FW
    out = Image.new('RGBA', (FW * n, FW), (0, 0, 0, 0))
    for i in range(n):
        out.paste(process_frame(strip.crop((i * FW, 0, i * FW + FW, FW))), (i * FW, 0))
    return out, n

def main():
    src = sys.argv[1]
    hero = sys.argv[2] if len(sys.argv) > 2 else 'aelindra'
    faction = 'rimwalker'
    outdir = os.path.join(ROOT, f'assets/heroes/{faction}/{hero}/tiny')
    os.makedirs(outdir, exist_ok=True)
    manifest = {}
    for label, anim in ANIMS.items():
        hits = glob.glob(os.path.join(src, f'*-{label}.png'))
        if not hits: continue
        out, n = process_strip(hits[0])
        out.save(os.path.join(outdir, f'{anim}.png'))
        manifest[anim] = n
        print(f'{anim}: {n} frames -> {anim}.png')
    print('manifest:', manifest)

if __name__ == '__main__':
    main()
