#!/usr/bin/env python3
"""Sundered Isles — WC3 island-archipelago melee map (mirror: none, symmetric).

Recreates the composition of a classic Warcraft 3 island map: grass+forest
landmasses adrift on open sea, stitched by narrow land bridges. Two mains sit on
the big top corner isles (red top-left -> PLAYER, blue top-right -> ENEMY).

Forest is placed deliberately, not just scattered:
  * generous CLEARINGS around every base / gold / neutral camp (open build room),
  * a coastal tree FRAME lining every shore (outlines the whole map),
  * protected open LANES down the south + central bridges (kept walkable),
  * a dense impassable forest WALL across the TOP isle + its bridges, so the
    direct northern crossing is sealed and the two mains must route down through
    the centre to reach each other.

Built symmetrically in Python (every left feature mirrored to W-1-x), so it
emits `mirror: none`.

Regenerate:
  python3 tools/mapgen/sources/gen_archipelago.py > tools/mapgen/sources/sundered-isles.map
"""
import math

W, H = 76, 52
CX = W / 2.0
MOAT = 2                 # outer ocean border
INTERIOR_COVER = 0.62    # higher => fewer interior trees (was 0.52)

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


def mx(x):
    return W - 1 - x


def isle(cx, cy, rx, ry, wob=1.0):
    """Paint a blobby grass island; shoreline wobbles for an organic edge."""
    for y in range(H):
        for x in range(W):
            dx = (x + 0.5) - cx; dy = (y + 0.5) - cy
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


def is_water(x, y):
    return not (0 <= x < W and 0 <= y < H) or grid[y][x] == '~'


# ── Island anchors (top-down). Author the LEFT + the centre spine; mirror x. ──
TL = (16, 11)            # top-left main
ML = (6, 27)             # left-edge expansion
BL = (17, 41)            # bottom-left expansion
TC = (int(CX), 9)        # top-centre isle  (becomes the forest WALL)
CC = (int(CX), 27)       # central contested isle
BC = (int(CX), 42)       # bottom-centre isle

LEFT_ISLES = [
    (TL[0], TL[1], 13, 7),
    (ML[0], ML[1], 6, 8),
    (BL[0], BL[1], 13, 7),
]
SPINE_ISLES = [
    (TC[0], TC[1], 11, 5),
    (CC[0], CC[1], 11, 6),
    (BC[0], BC[1], 11, 5),
]

for (cx, cy, rx, ry) in LEFT_ISLES:
    isle(cx, cy, rx, ry)
    isle(mx(cx), cy, rx, ry)
for (cx, cy, rx, ry) in SPINE_ISLES:
    isle(cx, cy, rx, ry)

# ── Land bridges. Top bridges exist as land but get WALLED later. ────────────
TOP_BRIDGES = [(TL, TC)]                 # mirrored below -> sealed by the wall
OPEN_BRIDGES = [                         # the real walkable network (kept clear)
    (TL, ML), (TL, CC), (ML, BL), (BL, CC), (BL, BC),
]
for (a, b) in OPEN_BRIDGES + TOP_BRIDGES:
    bridge(a[0], a[1], b[0], b[1], 2)
    bridge(mx(a[0]), a[1], mx(b[0]), b[1], 2)
bridge(CC[0], CC[1], BC[0], BC[1], 2)    # central spine (single)

# ── Outer ocean border ───────────────────────────────────────────────────────
for y in range(H):
    for x in range(W):
        if x < MOAT or x >= W - MOAT or y < MOAT or y >= H - MOAT:
            grid[y][x] = '~'

# ── POI positions (glyphs stamped LAST so clearings can't overwrite them) ─────
home_gold = [(8, 6)]
expo_gold = [(4, 27), (11, 43)]
gold_pts = [(gx, gy) for (gx, gy) in home_gold + expo_gold] + \
           [(mx(gx), gy) for (gx, gy) in home_gold + expo_gold]
NEUTRALS = [CC, BC]                      # TC is now a wall, not a camp

# Carve clearings to flat grass (no water / tree under a POI).
clear_box(TL[0], TL[1], 4, '.'); clear_box(mx(TL[0]), TL[1], 4, '.')
for (gx, gy) in gold_pts:
    clear_box(gx, gy, 1, '.')
for (nx, ny) in NEUTRALS:
    clear_box(nx, ny, 2, '.')

# ── Protected open lanes + clearings (kept clear of trees) ───────────────────
protect = set()


def add_disc(cx, cy, rad):
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            if dx * dx + dy * dy <= rad * rad + 1:
                protect.add((int(round(cx + dx)), int(round(cy + dy))))


def protect_line(a, b, half):
    x0, y0 = a; x1, y1 = b
    steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(steps + 1):
        t = i / steps
        add_disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, half)


for (a, b) in OPEN_BRIDGES:
    protect_line(a, b, 1)
    protect_line((mx(a[0]), a[1]), (mx(b[0]), b[1]), 1)
protect_line(CC, BC, 1)
add_disc(TL[0], TL[1], 5); add_disc(mx(TL[0]), TL[1], 5)   # generous base build room
for (gx, gy) in gold_pts:
    add_disc(gx, gy, 2)
for (nx, ny) in NEUTRALS:
    add_disc(nx, ny, 3)

# ── Top forest WALL: top isle + top bridges -> dense impassable trees ────────
wall = set()


def wall_ellipse(cx, cy, rx, ry):
    for y in range(H):
        for x in range(W):
            if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2) <= 1.0:
                wall.add((x, y))


def wall_line(a, b, half):
    x0, y0 = a; x1, y1 = b
    steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(steps + 1):
        t = i / steps
        bx = x0 + (x1 - x0) * t; by = y0 + (y1 - y0) * t
        for dy in range(-half, half + 1):
            for dx in range(-half, half + 1):
                wall.add((int(round(bx + dx)), int(round(by + dy))))


wall_ellipse(TC[0], TC[1], 12, 6)
wall_line(TL, TC, 3); wall_line((mx(TL[0]), TL[1]), TC, 3)
wall -= protect                          # don't seal the base clearings

# ── Forest pass 1 — sparse interior scatter ──────────────────────────────────
for y in range(H):
    for x in range(W):
        if grid[y][x] != '.' or (x, y) in protect:
            continue
        n = vnoise(x, y, 5.5)
        if n + (h2(x, y) - 0.5) * 0.10 > INTERIOR_COVER:
            grid[y][x] = 'T'

# ── Forest pass 2 — coastal frame: line every shore with trees ───────────────
for y in range(H):
    for x in range(W):
        if grid[y][x] != '.' or (x, y) in protect:
            continue
        adj_water = any(is_water(x + dx, y + dy)
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1),
                                       (1, 1), (1, -1), (-1, 1), (-1, -1)))
        if adj_water and h2(x * 7 + 1, y * 3 + 2) > 0.15:   # ~85% of shore tiles
            grid[y][x] = 'T'

# ── Forest pass 3 — force the top wall (overrides everything in its region) ──
for (x, y) in wall:
    if 0 <= x < W and 0 <= y < H and grid[y][x] in ('.', 'T'):
        grid[y][x] = 'T'

# ── Stamp POI glyphs last ─────────────────────────────────────────────────────
put(TL[0], TL[1], 'P'); put(mx(TL[0]), TL[1], 'E')
for (gx, gy) in gold_pts:
    put(gx, gy, '$')
for (nx, ny) in NEUTRALS:
    put(nx, ny, 'o')

print("# Sundered Isles — full board %dx%d (generated; mirror: none)." % (W, H))
print("# WC3-style island archipelago: corner mains, edge gold, central creep")
print("# spine; sealed top (forest wall) forces a route through the centre.")
print("# Regenerate: python3 tools/mapgen/sources/gen_archipelago.py > tools/mapgen/sources/sundered-isles.map")
print("name: Sundered Isles")
print("tile: 64")
print("mirror: none")
print("gold_amount: 3000")
print("map:")
for row in grid:
    print(''.join(row))
