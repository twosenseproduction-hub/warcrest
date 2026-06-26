#!/usr/bin/env python3
"""Author the LEFT half (24x30) of Tideland Crossing from blob anchors.
Emits a .map (mirror: horizontal) the ascii-map compiler reflects to 48x30.

Approach: start all water, carve elliptical grass landmasses, fringe the
water-touching grass with a thin tree border, drop a dense central forest,
then stamp the start / gold / neutral markers at their anchors. This mirrors
the WC2 reference: grass islands joined by land, split by water, tree-lined."""
import math

W, H = 24, 30          # left half (full board = 48x30 after mirror)
grid = [['~'] * W for _ in range(H)]

def ellipse(cx, cy, rx, ry, ch):
    for y in range(H):
        for x in range(W):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                grid[y][x] = ch

# --- landmasses (grass) -----------------------------------------------------
ellipse(10, 6, 7.5, 4.2, '.')     # upper-left main (Red)
ellipse(4, 15, 5.0, 4.5, '.')     # left-mid island
ellipse(9, 22, 7.0, 4.2, '.')     # lower-left island
ellipse(21, 13, 4.5, 11.0, '.')   # central spine (near mirror seam)
# land bridges joining the masses (dirt -> grass)
ellipse(8, 11, 3.0, 3.0, '.')     # UL <-> left-mid
ellipse(13, 18, 3.5, 3.0, '.')    # left-mid <-> lower / center
ellipse(16, 9, 4.0, 3.0, '.')     # UL <-> center
ellipse(15, 22, 4.0, 3.0, '.')    # lower <-> center

# --- tree fringe: grass touching water has a chance to become forest --------
def neighbors_water(x, y):
    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
        nx, ny = x + dx, y + dy
        if nx < 0 or ny < 0 or nx >= W or ny >= H or grid[ny][nx] == '~':
            return True
    return False

# deterministic pseudo-random so the layout is stable
def prng(x, y):
    h = (x * 73856093) ^ (y * 19349663)
    return ((h >> 3) & 0xffff) / 65535.0

fringe = []
for y in range(H):
    for x in range(W):
        if grid[y][x] == '.' and neighbors_water(x, y) and prng(x, y) < 0.55:
            fringe.append((x, y))
for x, y in fringe:
    grid[y][x] = 'T'

# dense central forest island (upper-center, like the reference)
ellipse(17, 8, 3.2, 2.4, 'T')

# --- markers ---------------------------------------------------------------
def put(x, y, ch):
    grid[y][x] = ch

put(10, 6, 'P')      # Red start (main)
put(8, 3, '$')       # main gold (top-left corner)
put(3, 15, '$')      # mid-edge gold
put(8, 22, '$')      # lower gold
# neutral buildings down the centre spine (near the mirror seam)
put(22, 5, 'o')
put(22, 13, 'o')
put(22, 21, 'o')

# clear a little breathing room around the start so the Town Hall (4x3) fits
for dy in range(-1, 3):
    for dx in range(-1, 3):
        x, y = 10 + dx, 6 + dy
        if 0 <= x < W and 0 <= y < H and grid[y][x] == 'T':
            grid[y][x] = '.'

print("# Tideland Crossing — generated left half (mirror: horizontal).")
print("# Regenerate with: python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map")
print("name: Tideland Crossing")
print("tile: 64")
print("mirror: horizontal")
print("gold_amount: 3000")
print("map:")
for row in grid:
    print(''.join(row))
