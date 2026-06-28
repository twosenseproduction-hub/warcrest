#!/usr/bin/env python3
"""Sundered Isles — WC3 island-archipelago melee map (mirror: none, symmetric).

Recreates the composition of a classic Warcraft 3 island map: ~8 grass+forest
landmasses adrift on open sea, stitched together by narrow land bridges. Two
mains sit on the big top corner isles (red top-left -> PLAYER, blue top-right ->
ENEMY). Gold sits on the corner/edge isles; the central spine of isles carries
neutral creep camps. Built symmetrically in Python (every left feature is
mirrored to W-1-x), so it emits `mirror: none`.

Regenerate:
  python3 tools/mapgen/sources/gen_archipelago.py > tools/mapgen/sources/sundered-isles.map
"""
import math

W, H = 76, 52
CX = W / 2.0
MOAT = 2                 # outer ocean border
FOREST_COVER = 0.52      # interior forest density on the isles

grid = [['~'] * W for _ in range(H)]   # start as open ocean


def h2(ix, iy):
    n = (ix * 73856093) ^ (iy * 19349663)
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0


def vnoise(x, y, cell):
    gx, gy = x / cell, y / cell
    ix, iy = int(math.floor(gx)), int(math.floor(gy))
    fx, fy = gx - ix, gy - iy
    sx = fx * fx * (3 - 2 * fx); sy = fy * fy * (3 - 2 * fy)
    a = h2(ix, iy); b = h2(ix + 1, iy); c = h2(ix, iy + 1); d = h2(ix + 1, iy + 1)
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


def put(x, y, ch):
    x = int(round(x)); y = int(round(y))
    if 0 <= x < W and 0 <= y < H:
        grid[y][x] = ch


def isle(cx, cy, rx, ry, wob=1.0):
    """Paint a blobby grass island; shoreline wobbles for an organic edge."""
    for y in range(H):
        for x in range(W):
            dx = (x + 0.5) - cx; dy = (y + 0.5) - cy
            # per-isle shoreline noise so coasts aren't clean ellipses
            n = (vnoise(x, y, 4.5) - 0.5) * wob
            if (dx / (rx + n)) ** 2 + (dy / (ry + n)) ** 2 <= 1.0:
                grid[y][x] = '.'


def bridge(x0, y0, x1, y1, half):
    """Lay a walkable grass land-bridge between two anchors (thickness 2*half+1)."""
    steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(steps + 1):
        t = i / steps
        bx = x0 + (x1 - x0) * t
        by = y0 + (y1 - y0) * t
        for dy in range(-half, half + 1):
            for dx in range(-half, half + 1):
                if dx * dx + dy * dy <= half * half + 1:
                    put(bx + dx, by + dy, '.')


def clear_box(x, y, rad, ch):
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            put(x + dx, y + dy, ch)


def mx(x):
    return W - 1 - x


# ── Island anchors (top-down). Author the LEFT + the centre spine; mirror x. ──
# Big corner mains
TL = (16, 11)
# left edge expansion
ML = (6, 27)
# bottom-left expansion
BL = (17, 41)
# centre spine isles (on the mirror axis, single)
TC = (int(CX), 9)
CC = (int(CX), 27)
BC = (int(CX), 42)

LEFT_ISLES = [
    (TL[0], TL[1], 13, 7),    # top-left main
    (ML[0], ML[1], 6, 8),     # left-edge expo
    (BL[0], BL[1], 13, 7),    # bottom-left expo
]
SPINE_ISLES = [
    (TC[0], TC[1], 11, 5),    # top-centre creep isle
    (CC[0], CC[1], 11, 6),    # central contested isle
    (BC[0], BC[1], 11, 5),    # bottom-centre creep isle
]

for (cx, cy, rx, ry) in LEFT_ISLES:
    isle(cx, cy, rx, ry)
    isle(mx(cx), cy, rx, ry)
for (cx, cy, rx, ry) in SPINE_ISLES:
    isle(cx, cy, rx, ry)

# ── Land bridges (author left + axis, mirror x) ──────────────────────────────
LEFT_BRIDGES = [
    (TL, TC, 2),   # main -> top-centre
    (TL, ML, 2),   # main -> left edge
    (TL, CC, 2),   # main -> central
    (ML, BL, 2),   # left edge -> bottom-left
    (BL, CC, 2),   # bottom-left -> central
    (BL, BC, 2),   # bottom-left -> bottom-centre
]
for (a, b, hw) in LEFT_BRIDGES:
    bridge(a[0], a[1], b[0], b[1], hw)
    bridge(mx(a[0]), a[1], mx(b[0]), b[1], hw)
# axis spine bridges (single)
bridge(TC[0], TC[1], CC[0], CC[1], 2)
bridge(CC[0], CC[1], BC[0], BC[1], 2)

# ── Outer ocean border ───────────────────────────────────────────────────────
for y in range(H):
    for x in range(W):
        if x < MOAT or x >= W - MOAT or y < MOAT or y >= H - MOAT:
            grid[y][x] = '~'

# ── Spawns, gold, neutral camps ───────────────────────────────────────────────
clear_box(TL[0], TL[1], 3, '.')
clear_box(mx(TL[0]), TL[1], 3, '.')
put(TL[0], TL[1], 'P')
put(mx(TL[0]), TL[1], 'E')

# Gold: home mine by each main + edge/bottom expansions (mirrored).
home_gold = [(8, 6)]                       # near the TL main
expo_gold = [(4, 27), (11, 43)]            # left-edge isle, bottom-left isle
for (gx, gy) in home_gold + expo_gold:
    clear_box(gx, gy, 1, '.')
    put(gx, gy, '$'); put(mx(gx), gy, '$')

# Neutral creep camps on the centre-spine isles (single, on the axis).
NEUTRALS = [TC, CC, BC]
for (nx, ny) in NEUTRALS:
    clear_box(nx, ny, 2, '.')
    put(nx, ny, 'o')

# ── Forest clumps on the isles (skip clearings around every POI + bridges) ────
keepouts = [TL, (mx(TL[0]), TL[1]), TC, CC, BC] + \
           [(gx, gy) for (gx, gy) in home_gold + expo_gold] + \
           [(mx(gx), gy) for (gx, gy) in home_gold + expo_gold]


def near_keepout(x, y):
    for (kx, ky) in keepouts:
        if abs(x - kx) <= 3 and abs(y - ky) <= 3:
            return True
    return False


for y in range(H):
    for x in range(W):
        if grid[y][x] != '.':
            continue
        if near_keepout(x, y):
            continue
        n = vnoise(x, y, 5.5)
        if n + (h2(x, y) - 0.5) * 0.10 > FOREST_COVER:
            grid[y][x] = 'T'

print("# Sundered Isles — full board %dx%d (generated; mirror: none)." % (W, H))
print("# WC3-style island archipelago: corner mains, edge gold, centre creep spine.")
print("# Regenerate: python3 tools/mapgen/sources/gen_archipelago.py > tools/mapgen/sources/sundered-isles.map")
print("name: Sundered Isles")
print("tile: 64")
print("mirror: none")
print("gold_amount: 3000")
print("map:")
for row in grid:
    print(''.join(row))
