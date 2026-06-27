#!/usr/bin/env python3
"""Tideland Crossing — two-plateau "Echo Isle" map.

Design (per the cliff tutorial + the WC2 reference):
  * Each side is its own CLEAN, solid PLATEAU (high ground) in a top corner, so
    the cliff faces render as a continuous tall escarpment — not a jagged edge.
  * A single RAMP cuts each plateau's south edge — the only way up/down (cliffs
    are solid in engine). Bases + home mines sit ON the plateau.
  * The low ground below holds the shallows, the auxiliary mines, the forest
    clumps and the neutral structures. The central water gulf splits the top so
    the route between bases is DOWN a ramp, across the southern bridge, and up.

Emits `mirror: none` (built symmetrically in Python).
Regenerate:
  python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map
"""
import math

W, H = 74, 52
CX = W / 2.0
MOAT = 2
FOREST_COVER = 0.42

PLATEAU_INNER = 27       # left plateau spans cols MOAT..PLATEAU_INNER
PLATEAU_BOTTOM = 19      # clean south cliff line at this row
RAMP_X = 18              # ramp centre column (clear of base + gulf)
GULF_BOTTOM = 34         # central gulf reaches this row; land bridge below

grid = [['.'] * W for _ in range(H)]   # grass continent


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
    if 0 <= x < W and 0 <= y < H:
        grid[y][x] = ch


def clear_box(x, y, rad, ch='.'):
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            put(x + dx, y + dy, ch)


# ── Water: central gulf (top split) + outer ocean border ────────────────────
for y in range(0, GULF_BOTTOM + 1):
    t = y / float(GULF_BOTTOM)
    half = max(1.8, 7.0 * (1.0 - t) ** 1.1)
    rx = CX + 1.6 * math.sin(y * 0.3)
    for x in range(W):
        if abs((x + 0.5) - rx) <= half:
            grid[y][x] = '~'

for y in range(H):
    for x in range(W):
        if x < MOAT or x >= W - MOAT or y < MOAT or y >= H - MOAT:
            grid[y][x] = '~'

# ── Spawns, gold, neutral structures ────────────────────────────────────────
PB = (11, 9)
EB = (W - 1 - 11, 9)
clear_box(PB[0], PB[1], 3)
clear_box(EB[0], EB[1], 3)
put(PB[0], PB[1], 'P')
put(EB[0], EB[1], 'E')

# 4 mines per side: 2 home (on the plateau), 2 auxiliary (low ground, creeped).
gold = [(6, 7), (24, 12), (8, 30), (16, 44)]
for (gx, gy) in gold:
    clear_box(gx, gy, 1)
    put(gx, gy, '$')
    put(W - 1 - gx, gy, '$')

MERCHANT = (int(CX), 38)
MERCENARY = (int(CX), H - 4)
clear_box(MERCHANT[0], MERCHANT[1], 2)
clear_box(MERCENARY[0], MERCENARY[1], 2)
put(MERCHANT[0], MERCHANT[1], 'o')
put(MERCENARY[0], MERCENARY[1], 'o')

# ── Plateaus (clean solid blocks) + ramps ───────────────────────────────────
KEEP = ('P', 'E', '$', 'o', '/')


def raise_plateau():
    # Force each top-corner block to solid HIGH so the cliff line is clean.
    for y in range(MOAT, PLATEAU_BOTTOM + 1):
        for x in list(range(MOAT, PLATEAU_INNER + 1)) + \
                 list(range(W - 1 - PLATEAU_INNER, W - MOAT)):
            if grid[y][x] not in KEEP:
                grid[y][x] = '^'


def cut_ramp(cx):
    for y in range(PLATEAU_BOTTOM - 3, PLATEAU_BOTTOM + 4):
        for x in range(cx - 1, cx + 2):
            if 0 <= x < W and grid[y][x] in ('^', '.', 'T'):
                grid[y][x] = '/'


raise_plateau()
cut_ramp(RAMP_X)
cut_ramp(W - 1 - RAMP_X)

# ── Forest clumps on the low ground (never on plateau/ramp) ─────────────────
keepouts = [PB, EB, MERCHANT, MERCENARY] + gold + [(W - 1 - x, y) for (x, y) in gold]


def clearing(x, y):
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
        if abs((x + 0.5) - CX) <= 3 and y >= GULF_BOTTOM:   # keep bottom bridge open
            continue
        n = vnoise(x, y, 7.0)
        if n + (h2(x, y) - 0.5) * 0.12 < FOREST_COVER:
            grid[y][x] = 'T'

print("# Tideland Crossing — full board %dx%d (generated; mirror: none)." % (W, H))
print("# Two clean plateaus (top corners) with ramps; central gulf splits the top.")
print("# Regenerate: python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map")
print("name: Tideland Crossing")
print("tile: 64")
print("mirror: none")
print("gold_amount: 3000")
print("map:")
for row in grid:
    print(''.join(row))
