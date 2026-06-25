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

WOOD   = ((58,36,18),(120,80,42),(182,134,82))        # elf walls
GREEN  = ((26,70,34),(58,120,60),(120,176,98))         # elf roof
GREY   = ((68,72,80),(146,152,160),(224,228,234))      # human stone walls
SLATE  = ((52,58,70),(100,112,132),(168,180,200))      # human roof
BONE   = ((96,86,66),(186,176,150),(240,236,216))      # orc walls
BONER  = ((110,92,64),(168,144,104),(214,196,158))     # (old tan roof, unused)
ORCROOF= ((110,28,22),(176,46,36),(222,92,70))         # orc roof: red thatch

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
            if faction == 'human':                        # STONE
                c = ramp3(*GREY, t) if stone else (ramp3(*SLATE, t) if warm else None)
            elif faction == 'elf':                         # WOOD walls + green roof
                if stone: c = ramp3(*WOOD, t)
                elif warm: c = ramp3(*GREEN, t) if y < 0.45*H else ramp3(*WOOD, t)
            elif faction == 'orc':                         # BONE walls + RED roof
                c = ramp3(*BONE, t) if stone else (ramp3(*ORCROOF, t) if warm else None)
            if c: px[x, y] = (c[0], c[1], c[2], a)
    return img

def _P(d, x, y, c): d.point((x, y), fill=c)

def accents(img, faction, kind):
    # Kept light + within the top rows so they're safe on the small (32-48px)
    # single-building sprites. The material recolor + barrels carry most identity.
    d = ImageDraw.Draw(img); W, H = img.width, img.height
    if faction == 'human' and kind in ('keep', 'barracks'):
        pole, bl, hi = (60,52,44), (45,118,210), (110,175,240)   # royal blue banner
        for bx in ([2, W-4] if W >= 24 else [W//2-1]):
            for y in range(0, 5): _P(d, bx, y, pole)
            for y, w in [(1,3),(2,2)]:
                for x in range(bx+1, bx+1+w): _P(d, x, y, bl)
            _P(d, bx+1, 1, hi)
    if faction == 'elf':
        vine, vhi = (54,120,60), (104,176,96)
        for x in ([1,2,W-3,W-2] if W >= 24 else [1, W-2]):
            for y in range(2, min(H, 11)):
                if (x+y) % 2 == 0: _P(d, x, y, vine); _P(d, x, min(H-1,y+1), vhi)
    if faction == 'orc':
        bone, bdk = (236,230,206), (150,138,110)
        for sx in range(1, W-1, 3):       # bone spikes along the top
            _P(d, sx, 2, bdk)
            for i, y in enumerate(range(1, -1, -1)): _P(d, sx, y, bone if i < 1 else bdk)
    return img

# building type -> (col,row,w,h) single-building spans (no vertical stacking) +
# engine type. Barracks/Tower tiles confirmed against the pack by eye.
BUILDINGS = [
    ('Keep',      'core',    (12,26,2,2)),   # gatehouse, faction roof
    ('Barracks',  'foundry', (10,26,2,2)),   # stone gate + barrels
    ('War Forge', 'forge',   (9,26,1,2)),    # house (+ chimney)
    ('Sheep Pen', 'conduit', (6,26,1,1)),    # small round hut
    ('Arrow Twr', 'turret',  (14,26,1,2)),   # stone tower
    ('Outpost',   'outpost', (4,26,1,2)),    # tent
]
FACTIONS = [('human','HUMAN'),('elf','ELF'),('orc','ORC')]
KIND = {'Keep':'keep','Barracks':'barracks','War Forge':'forge','Sheep Pen':'pen','Arrow Twr':'tower','Outpost':'outpost'}

def make_building(faction, label, span):
    im = block(*span); reskin(im, faction); accents(im, faction, KIND[label]); return im

# ---- Tower upgrade tree: base -> arrow / bombard --------------------------------
def _tower_shell(cap_col):
    """Stone tower: a well-cap roof (row 30) connected onto a stone shaft."""
    im = Image.new('RGBA', (16, 30), (0, 0, 0, 0))
    im.alpha_composite(tile(14, 27), (0, 14))
    im.alpha_composite(tile(14, 27), (0, 16))
    im.alpha_composite(tile(cap_col, 30), (0, 0))
    return im

def make_tower(faction, variant='base'):
    if variant == 'base':
        im = Image.new('RGBA', (16, 30), (0, 0, 0, 0))
        im.alpha_composite(tile(14, 27), (0, 14)); im.alpha_composite(tile(14, 27), (0, 16))
        im.alpha_composite(tile(14, 26), (0, 0))         # crenellated cap
    elif variant == 'arrow':
        im = _tower_shell(6)                              # peaked watchtower roof
    elif variant == 'bombard':
        im = _tower_shell(4)                              # flat gun-platform roof
    else:
        raise ValueError(variant)
    reskin(im, faction)
    d = ImageDraw.Draw(im)
    if variant == 'arrow':                                # arrow slits (drawn after reskin)
        for sx in (5, 8, 11):
            for y in range(17, 23): _P(d, sx, y, (34, 32, 40))
    elif variant == 'bombard':                            # iron cannon barrel (faction-neutral)
        iron, hi, blk = (74, 76, 86), (120, 122, 134), (16, 16, 20)
        for y in range(9, 17):
            for x in range(6, 10): _P(d, x, y, iron)
        for y in range(9, 17): _P(d, 6, y, hi)
        for x in range(6, 10): _P(d, x, 12, (50, 52, 60))
        for x in range(6, 10): _P(d, x, 16, blk)
        _P(d, 7, 17, blk); _P(d, 8, 17, blk)
    return im

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
