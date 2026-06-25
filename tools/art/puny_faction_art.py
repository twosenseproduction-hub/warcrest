#!/usr/bin/env python3
"""
puny_faction_art.py — generate Warcrest's per-faction buildings from the CC0
Puny World tileset (assets/tilesets/puny-world/punyworld-overworld-tileset.png).

The recipe: take a base building from the tileset, remap its WALL (stone) and
ROOF/timber (warm) pixels onto a faction MATERIAL ramp by luminance — so the
shading survives but the material genuinely changes — then add faction accents
and, for the "extravagant" keeps, grow race-structure into the surrounding
space (pine canopy for Elf, bone horns for Orc, stone buttresses for Human).

Factions: human (blue stone) · elf (wood + green) · orc (bone + red).

Usage:
    python3 tools/art/puny_faction_art.py sheet        # 6 buildings x 3 factions
    python3 tools/art/puny_faction_art.py keeps        # extravagant hero keeps
    python3 tools/art/puny_faction_art.py export DIR    # PNG per (faction,building)

Requires Pillow:  pip install pillow
Tileset is CC0 by Shade — see assets/tilesets/puny-world/CREDITS.md
"""
import os, sys, math
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TILESET = os.path.join(ROOT, 'assets/tilesets/puny-world/punyworld-overworld-tileset.png')
T = 16

# ── tile helpers ──────────────────────────────────────────────────────────────
_ts = None
def ts():
    global _ts
    if _ts is None: _ts = Image.open(TILESET).convert('RGBA')
    return _ts
def tile(c, r): return ts().crop((c*T, r*T, c*T+T, r*T+T))
def block(c0, r0, w, h):
    img = Image.new('RGBA', (w*T, h*T), (0, 0, 0, 0))
    for dy in range(h):
        for dx in range(w):
            img.alpha_composite(tile(c0+dx, r0+dy), (dx*T, dy*T))
    return img

# ── material recolor ─────────────────────────────────────────────────────────
def lerp(a, b, t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
def ramp3(lo, mid, hi, t): return lerp(lo, mid, t*2) if t < 0.5 else lerp(mid, hi, (t-0.5)*2)
def _L(r, g, b): return 0.299*r+0.587*g+0.114*b
def _sat(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b); return 0 if mx == 0 else (mx-mn)/mx

WOOD  = ((58,36,18),(120,80,42),(182,134,82));   GREEN = ((26,70,34),(58,120,60),(120,176,98))
BONE  = ((96,86,66),(186,176,150),(240,236,216)); RED   = ((70,20,18),(150,40,34),(214,84,60))
BLUEW = ((40,52,78),(118,138,176),(214,226,244)); BLUER = ((26,52,120),(60,120,200),(150,195,240))

def reskin(img, faction):
    px = img.load(); H = img.height
    for y in range(H):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            s = _sat(r, g, b); L = _L(r, g, b); t = max(0., min(1., (L-30)/185.))
            stone = s < 0.32 and L > 16
            warm = s >= 0.32 and r >= g and r >= b
            c = None
            if faction == 'human':
                c = ramp3(*BLUEW, t) if stone else (ramp3(*BLUER, t) if warm else None)
            elif faction == 'elf':
                if stone: c = ramp3(*WOOD, t)
                elif warm: c = ramp3(*GREEN, t) if y < 0.45*H else ramp3(*WOOD, t)
            elif faction == 'orc':
                c = ramp3(*BONE, t) if stone else (ramp3(*RED, t) if warm else None)
            if c: px[x, y] = (c[0], c[1], c[2], a)
    return img

def _P(d, x, y, c): d.point((x, y), fill=c)

def accents(img, faction, kind):
    d = ImageDraw.Draw(img); W, H = img.width, img.height
    if faction == 'human' and kind in ('keep', 'barracks', 'tower'):
        pole, bl, hi = (60,52,44), (45,118,210), (110,175,240)
        for bx in ([3, W-5] if W >= 24 else [W//2-1]):
            for y in range(0, 6): _P(d, bx, y, pole)
            for y, w in [(1,4),(2,3),(3,2)]:
                for x in range(bx+1, bx+1+w): _P(d, x, y, bl)
            _P(d, bx+1, 1, hi)
        if kind == 'keep':
            for (x, y) in [(W//2-1,23),(W//2,23),(W//2-1,24),(W//2,24)]: _P(d, x, y, (235,205,90))
    if faction == 'elf':
        vine, vhi = (54,120,60), (104,176,96)
        for x in ([2,3,W-4,W-3] if W >= 24 else [1, W-2]):
            for y in range(2, min(H, 12)):
                if (x+y) % 2 == 0: _P(d, x, y, vine); _P(d, x, y+1, vhi)
        img.alpha_composite(tile(0, 26).resize((9, 9), Image.NEAREST), (W//2-4, 1))
    if faction == 'orc':
        bone, bdk, blk = (236,230,206), (150,138,110), (20,16,14)
        for sx in range(1, W-1, 3):
            _P(d, sx, 3, bdk)
            for i, y in enumerate(range(2, -1, -1)): _P(d, sx, y, bone if i < 2 else bdk)
        if kind in ('keep', 'barracks'):
            cx = W//2
            sk = [(cx-2,21),(cx-1,21),(cx,21),(cx+1,21),(cx-2,22),(cx-1,22),(cx,22),(cx+1,22),
                  (cx-2,23),(cx,23),(cx-1,24),(cx,24)]
            for (x, y) in sk: _P(d, x, y, bone)
            for (x, y) in [(cx-2,22),(cx,22)]: _P(d, x, y, blk)
    return img

# building type -> (col,row,w,h) in the tileset's brown family + the engine type
BUILDINGS = [
    ('Keep',      'core',    (12,26,2,4)),
    ('Barracks',  'foundry', (8,26,2,4)),
    ('War Forge', 'forge',   (7,26,1,4)),
    ('Sheep Pen', 'conduit', (6,26,1,4)),
    ('Arrow Twr', 'turret',  (10,26,1,4)),
    ('Outpost',   'outpost', (4,26,1,4)),
]
FACTIONS = [('human','HUMAN'),('elf','ELF'),('orc','ORC')]
KIND = {'Keep':'keep','Barracks':'barracks','War Forge':'forge','Sheep Pen':'pen','Arrow Twr':'tower','Outpost':'outpost'}

def make_building(faction, label, span):
    im = block(*span); reskin(im, faction); accents(im, faction, KIND[label]); return im

# ── outputs ────────────────────────────────────────────────────────────────────
def build_sheet(out):
    Z = 6; cw, ch = 2*T*Z+24, 4*T*Z+30; lab = 64
    sheet = Image.new('RGB', (lab+cw*len(BUILDINGS), 26+ch*len(FACTIONS)), (60,72,40))
    d = ImageDraw.Draw(sheet)
    for bi,(bn,_,_) in enumerate(BUILDINGS): d.text((lab+bi*cw+8,8), bn, fill=(240,244,230))
    for fi,(fid,fn) in enumerate(FACTIONS):
        d.text((6,26+fi*ch+ch//2), fn, fill=(245,238,210))
        for bi,(bn,_,span) in enumerate(BUILDINGS):
            im = make_building(fid, bn, span); big = im.resize((im.width*Z, im.height*Z), Image.NEAREST)
            sheet.paste(big, (lab+bi*cw+(cw-big.width)//2, 26+fi*ch+(ch-big.height)//2), big)
    sheet.save(out); print('saved', out)

def export_pngs(outdir):
    os.makedirs(outdir, exist_ok=True)
    for fid,_ in FACTIONS:
        for bn, etype, span in BUILDINGS:
            im = make_building(fid, bn, span)
            p = os.path.join(outdir, f'{fid}_{etype}.png'); im.save(p)
    print('exported building PNGs to', outdir)

# extravagant hero keeps (race-structure grown into the margin) live in
# tools/art/puny_keeps.py to keep this module focused; see that file.

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'sheet'
    if cmd == 'sheet':
        build_sheet(sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'docs/art/building_sheet.png'))
    elif cmd == 'export':
        export_pngs(sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'assets/buildings'))
    else:
        sys.exit('usage: puny_faction_art.py [sheet|export] [path]')
