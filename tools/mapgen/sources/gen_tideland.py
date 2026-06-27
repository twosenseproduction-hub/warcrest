#!/usr/bin/env python3
"""Tideland Crossing — twin-fortress plateau map ("Echo Isle").

Design (player-tuned): each side is MOSTLY its own high-ground PLATEAU — a
fortress. The only land between them is a low central VALLEY: a water gulf up
top (open to the north sea) and a low crossing on the bottom. A SINGLE ramp cuts
each plateau's inner cliff, so the one way to reach the enemy is: down your
ramp, across the low crossing, up theirs. Cliffs are solid in engine; the ramp
is the chokepoint. Bases + home mines sit on the plateau; contested mines and
the neutral structures sit in the low valley.

Emits `mirror: none` (built symmetrically in Python).
Regenerate:
  python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map
"""
import math

W, H = 74, 52
CX = W / 2.0
MOAT = 2
FOREST_COVER = 0.46

VALLEY_L = 30           # central low valley spans cols VALLEY_L..VALLEY_R
VALLEY_R = 43
GULF_BOTTOM = 27        # valley is water (gulf) above this row, low land below
RAMP_ROW = 31           # ramp centre row (in the low crossing)

grid = [['^'] * W for _ in range(H)]   # start as solid plateau (high ground)


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


def clear_box(x, y, rad, ch):
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            put(x + dx, y + dy, ch)


# ── Central valley: gulf (water) on top, low land (.) on the bottom ─────────
for y in range(H):
    for x in range(VALLEY_L, VALLEY_R + 1):
        # gulf meanders a touch for an organic shoreline
        wob = 1.5 * math.sin(y * 0.3)
        if VALLEY_L + 1 + wob <= x <= VALLEY_R - 1 - wob and y <= GULF_BOTTOM:
            grid[y][x] = '~'      # gulf water
        else:
            grid[y][x] = '.'      # low crossing / valley floor

# ── Outer ocean border ──────────────────────────────────────────────────────
for y in range(H):
    for x in range(W):
        if x < MOAT or x >= W - MOAT or y < MOAT or y >= H - MOAT:
            grid[y][x] = '~'


def is_high(x, y):
    return 0 <= x < W and 0 <= y < H and grid[y][x] == '^'


# ── Ramp: cut the plateau's inner cliff into the low crossing ───────────────
def cut_ramp_left():
    # horizontal ramp corridor through the east edge of the LEFT plateau
    for y in range(RAMP_ROW - 1, RAMP_ROW + 2):
        for x in range(VALLEY_L - 3, VALLEY_L + 2):
            if grid[y][x] in ('^', '.'):
                grid[y][x] = '/'


def cut_ramp_right():
    for y in range(RAMP_ROW - 1, RAMP_ROW + 2):
        for x in range(VALLEY_R - 1, VALLEY_R + 4):
            if grid[y][x] in ('^', '.'):
                grid[y][x] = '/'


cut_ramp_left()
cut_ramp_right()

# ── Spawns, gold, neutral structures ────────────────────────────────────────
PB = (11, 10)
EB = (W - 1 - 11, 10)
clear_box(PB[0], PB[1], 3, '^')   # keep base clearing on the plateau
clear_box(EB[0], EB[1], 3, '^')
put(PB[0], PB[1], 'P')
put(EB[0], EB[1], 'E')

# Home mines (on plateau, near base) + contested mines (low valley).
home_gold = [(6, 8), (15, 12), (10, 28)]
valley_gold = [(33, 40)]
for (gx, gy) in home_gold:
    clear_box(gx, gy, 1, '^')
    put(gx, gy, '$'); put(W - 1 - gx, gy, '$')
for (gx, gy) in valley_gold:
    clear_box(gx, gy, 1, '.')
    put(gx, gy, '$'); put(W - 1 - gx, gy, '$')

MERCHANT = (int(CX), GULF_BOTTOM + 4)
MERCENARY = (int(CX), H - 5)
clear_box(MERCHANT[0], MERCHANT[1], 2, '.')
clear_box(MERCENARY[0], MERCENARY[1], 2, '.')
put(MERCHANT[0], MERCHANT[1], 'o')
put(MERCENARY[0], MERCENARY[1], 'o')

# ── Forest clumps on the low valley floor (never on the plateau) ────────────
keepouts = [PB, EB, MERCHANT, MERCENARY] + home_gold + valley_gold + \
           [(W - 1 - x, y) for (x, y) in home_gold + valley_gold]


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
        n = vnoise(x, y, 6.0)
        if n + (h2(x, y) - 0.5) * 0.12 < FOREST_COVER:
            grid[y][x] = 'T'

print("# Tideland Crossing — full board %dx%d (generated; mirror: none)." % (W, H))
print("# Twin fortress plateaus; one ramp each down to the low central valley.")
print("# Regenerate: python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map")
print("name: Tideland Crossing")
print("tile: 64")
print("mirror: none")
print("gold_amount: 3000")
print("map:")
for row in grid:
    print(''.join(row))
