#!/usr/bin/env python3
"""Author the FULL board of Tideland Crossing — a classic WC2 2-player island
map, translated to Warcrest.

Reference feel (docs/WC3_MAP_TRANSLATION.md capture sheet):
  * Wide rectangle with a FULL water border.
  * Grass landmasses split by water CHANNELS and joined by narrow LAND BRIDGES
    — distinct islands, not one solid slab (that's what makes it read WC2).
  * 2 players, horizontally symmetric: top-left vs top-right.
  * A central water GULF opens to the north sea and splits the top, so the only
    way across is DOWN one side, over the southern bridge, and back UP.
  * 3 gold mines per side (main by the start, a mid mine, a lower mine).
  * Neutral structures on the centre seam: merchant up top of the bridge,
    mercenaries at the bottom.
  * Sparse trees (collidable in-engine) + scattered ground detail.

Islands are still LARGE so there is real room to build. Emits `mirror: none`
(the board is built symmetrically in Python).
Regenerate:
  python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map
"""

W, H = 72, 50          # tiles — 4608 x 3200 px
CX = W // 2            # vertical centre line
MOAT = 2               # outer water border thickness
TREE_DENSITY = 0.06    # fraction of eligible land tiles that get a tree

# everything starts as sea; land is carved in as islands
grid = [['~'] * W for _ in range(H)]


def prng(x, y, salt=0):
    h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    return ((h >> 4) & 0xffff) / 65535.0


def island(cx, cy, rx, ry, jitter=0.10):
    """Carve a grass island. Coastline is roughened with a little per-tile
    noise so it reads blocky-organic like a WC2 coast (not a clean ellipse)."""
    for y in range(H):
        for x in range(W):
            n = 1.0 + (prng(x, y, 31) - 0.5) * 2.0 * jitter
            if ((x - cx) / (rx * n)) ** 2 + ((y - cy) / (ry * n)) ** 2 <= 1.0:
                grid[y][x] = '.'


def bridge(x0, x1, y0, y1):
    for y in range(min(y0, y1), max(y0, y1) + 1):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            if 0 <= x < W and 0 <= y < H:
                grid[y][x] = '.'


# ── Landmasses (author left, mirror to right) ───────────────────────────────
# Home island (base + main mine) in the top corner; southern island (aux mines)
# below it, joined by a land bridge across a water channel.
HOME = [(14, 11, 11, 8.5), (13, 37, 12, 9.0)]   # (cx,cy,rx,ry) left-side islands
for (cx, cy, rx, ry) in HOME:
    island(cx, cy, rx, ry)
    island(W - 1 - cx, cy, rx, ry)              # mirror to right side

# Bridge home<->south on each flank (crosses the mid channel).
bridge(7, 11, 18, 30)
bridge(W - 1 - 11, W - 1 - 7, 18, 30)

# Southern land bridge across the centre bottom — the ONLY link between the two
# sides. Joins both southern islands beneath the gulf.
bridge(23, W - 1 - 23, 36, H - 1)

# ── Re-assert the sea: outer moat + clean central gulf ──────────────────────
for y in range(H):
    for x in range(W):
        if x < MOAT or x >= W - MOAT or y < MOAT or y >= H - MOAT:
            grid[y][x] = '~'

# Central gulf: keep a clean water channel down the middle from the north sea to
# the southern bridge, so the top is firmly split (carve out any land that the
# island jitter pushed toward the seam).
for y in range(0, 36):
    for x in range(W):
        if abs((x + 0.5) - CX) <= 8.0:
            grid[y][x] = '~'


def put(x, y, ch):
    grid[y][x] = ch


def clear_box(x, y, rad, ch='.'):
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H:
                grid[ny][nx] = ch


# ── Spawns, gold, neutral structures ────────────────────────────────────────
PB = (11, 9)
EB = (W - 1 - 11, 9)
clear_box(PB[0], PB[1], 2)
clear_box(EB[0], EB[1], 2)
put(PB[0], PB[1], 'P')
put(EB[0], EB[1], 'E')

# 3 mines per side: main (by base), mid (home-island flank), lower (south island)
gold = [(6, 8), (20, 16), (9, 41)]
for (gx, gy) in gold:
    clear_box(gx, gy, 1)
    put(gx, gy, '$')
    put(W - 1 - gx, gy, '$')

# Neutral centre structures on the southern bridge (contested by both sides).
MERCHANT = (CX, 39)
MERCENARY = (CX, H - 4)
clear_box(MERCHANT[0], MERCHANT[1], 2)
clear_box(MERCENARY[0], MERCENARY[1], 2)
put(MERCHANT[0], MERCHANT[1], 'o')
put(MERCENARY[0], MERCENARY[1], 'o')

# ── Sparse, collidable forest ───────────────────────────────────────────────
keepouts = [PB, EB, MERCHANT, MERCENARY] + gold + [(W - 1 - x, y) for (x, y) in gold]


def near_keepout(x, y, rad=4):
    for (kx, ky) in keepouts:
        if abs(x - kx) <= rad and abs(y - ky) <= rad:
            return True
    return False


for y in range(H):
    for x in range(W):
        if grid[y][x] != '.':
            continue
        if near_keepout(x, y):
            continue
        if abs((x + 0.5) - CX) <= 3 and y >= 36:   # keep the bottom bridge clear
            continue
        if prng(x, y, 7) < TREE_DENSITY:
            grid[y][x] = 'T'

print("# Tideland Crossing — full board %dx%d (generated; mirror: none)." % (W, H))
print("# WC2 island map: home + southern islands per side, joined by bridges;")
print("# central gulf splits the top, cross via the southern land bridge.")
print("# Regenerate: python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map")
print("name: Tideland Crossing")
print("tile: 64")
print("mirror: none")
print("gold_amount: 3000")
print("map:")
for row in grid:
    print(''.join(row))
