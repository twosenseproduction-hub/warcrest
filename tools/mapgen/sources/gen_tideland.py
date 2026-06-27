#!/usr/bin/env python3
"""Author the FULL board of Tideland Crossing — a classic WC2 2-player land map.

Reference (the uploaded WC2 screenshot): a LAND-dominant continent inside a full
ocean border, cut by narrow winding WATER CHANNELS into lobes joined by land
bridges, blanketed in FOREST CLUMPS with open grass clearings, ~8 gold mines
(corners / mid-edges / interior) and neutral structures near the centre. Red
starts top-left, Blue top-right.

Translated to Warcrest while honouring the recent asks:
  * Land-dominant (build room), forest clumped (collidable) with clearings.
  * A central channel still splits the top so you go DOWN and AROUND.
  * Sparse-ish near the bases; denser forest as natural barriers elsewhere.

Emits `mirror: none` (built symmetrically in Python).
Regenerate:
  python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map
"""
import math

W, H = 74, 52          # tiles — 4736 x 3328 px
CX = W / 2.0
MOAT = 2               # outer ocean border
FOREST_COVER = 0.44    # value-noise threshold (lower => less forest)

grid = [['.'] * W for _ in range(H)]   # start as grass continent


def h2(ix, iy):
    n = (ix * 73856093) ^ (iy * 19349663)
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0


def vnoise(x, y, cell):
    """Smooth value noise in [0,1] via bilinear interp of a hashed lattice."""
    gx, gy = x / cell, y / cell
    ix, iy = int(math.floor(gx)), int(math.floor(gy))
    fx, fy = gx - ix, gy - iy
    sx = fx * fx * (3 - 2 * fx)
    sy = fy * fy * (3 - 2 * fy)
    a = h2(ix, iy);     b = h2(ix + 1, iy)
    c = h2(ix, iy + 1); d = h2(ix + 1, iy + 1)
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


def put(x, y, ch):
    if 0 <= x < W and 0 <= y < H:
        grid[y][x] = ch


def clear_box(x, y, rad, ch='.'):
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            put(x + dx, y + dy, ch)


# ── Water: meandering channels (rivers), mirrored for symmetry ──────────────
def carve_river(x_of_y, y0, y1, half_of_y):
    for y in range(y0, y1):
        rx = x_of_y(y)
        hw = half_of_y(y)
        for x in range(W):
            if abs((x + 0.5) - rx) <= hw:
                grid[y][x] = '~'


# Central channel: splits the top, opens wide to the north sea (estuary) and
# narrows inland, ending before the bottom so a land bridge remains.
carve_river(
    x_of_y=lambda y: CX + 2.4 * math.sin(y * 0.32),
    y0=0, y1=38,
    half_of_y=lambda y: max(1.6, 6.5 - y * 0.16),
)

# Two flank channels carve the continent into lobes (mirror-symmetric). Each
# meanders and leaves bridge gaps where it dips to near-zero width.
def flank_half(y):
    # pinch to a land bridge around y≈20 and y≈40
    base = 2.2 + 1.4 * math.sin(y * 0.5)
    if 18 <= y <= 23 or 38 <= y <= 43:
        base = 0.0
    return max(0.0, base)


carve_river(lambda y: 17 + 2.0 * math.sin(y * 0.28), 6, H, flank_half)
carve_river(lambda y: (W - 1 - 17) - 2.0 * math.sin(y * 0.28), 6, H, flank_half)

# A short horizontal channel across the lower middle for the lobed look,
# with a central bridge gap.
for x in range(W):
    if abs((x + 0.5) - CX) <= 4:   # keep central bridge
        continue
    yy = 33 + int(round(1.5 * math.sin(x * 0.25)))
    for dy in range(0, 3):
        grid[min(H - 1, yy + dy)][x] = '~'

# Outer ocean border (assert last so channels meet the sea cleanly).
for y in range(H):
    for x in range(W):
        if x < MOAT or x >= W - MOAT or y < MOAT or y >= H - MOAT:
            grid[y][x] = '~'


def is_land(x, y):
    return 0 <= x < W and 0 <= y < H and grid[y][x] != '~'


# ── Spawns, gold, neutral structures ────────────────────────────────────────
PB = (12, 9)
EB = (W - 1 - 12, 9)
clear_box(PB[0], PB[1], 3)
clear_box(EB[0], EB[1], 3)
put(PB[0], PB[1], 'P')
put(EB[0], EB[1], 'E')

# 4 mines per side (8 total): main by base, an upper-flank, a mid-edge, a lower.
gold = [(6, 8), (27, 11), (7, 30), (13, 45)]
for (gx, gy) in gold:
    clear_box(gx, gy, 1)
    put(gx, gy, '$')
    put(W - 1 - gx, gy, '$')

# Neutral structures near the centre seam: merchant mid, mercenaries at bottom.
MERCHANT = (int(CX), 30)
MERCENARY = (int(CX), H - 5)
clear_box(MERCHANT[0], MERCHANT[1], 2)
clear_box(MERCENARY[0], MERCENARY[1], 2)
put(MERCHANT[0], MERCHANT[1], 'o')
put(MERCENARY[0], MERCENARY[1], 'o')

# ── Forest clumps (value noise) with clearings ──────────────────────────────
keepouts = [PB, EB, MERCHANT, MERCENARY] + gold + [(W - 1 - x, y) for (x, y) in gold]


def clearing(x, y):
    # generous clearing around bases, smaller around mines/structures
    for (kx, ky, rad) in [(PB[0], PB[1], 6), (EB[0], EB[1], 6)]:
        if abs(x - kx) <= rad and abs(y - ky) <= rad:
            return True
    for (kx, ky) in keepouts:
        if abs(x - kx) <= 3 and abs(y - ky) <= 3:
            return True
    return False


for y in range(H):
    for x in range(W):
        if grid[y][x] != '.':
            continue
        if clearing(x, y):
            continue
        if abs((x + 0.5) - CX) <= 3 and y >= 33:   # keep central bottom bridge open
            continue
        n = vnoise(x, y, 7.0)
        # clumps: forest where noise is low; a little jitter breaks hard edges
        if n + (h2(x, y) - 0.5) * 0.12 < FOREST_COVER:
            grid[y][x] = 'T'

print("# Tideland Crossing — full board %dx%d (generated; mirror: none)." % (W, H))
print("# WC2 land map: forested continent cut by winding water channels; the")
print("# central channel splits the top, cross via the southern land bridge.")
print("# Regenerate: python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map")
print("name: Tideland Crossing")
print("tile: 64")
print("mirror: none")
print("gold_amount: 3000")
print("map:")
for row in grid:
    print(''.join(row))
