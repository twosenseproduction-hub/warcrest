#!/usr/bin/env python3
"""Author the FULL 48x30 board of Tideland Crossing from blob anchors.

We build the left half from elliptical grass blobs, reflect it to a full
symmetric board, then stamp the SINGLE centre features (so they aren't doubled
the way mirror: horizontal would). Emits a mirror: none .map.

WC2 reference: grass islands joined by land bridges, split by water, tree-
fringed, with a merchant (top centre) and mercenary camp (bottom centre)."""

HALF, H = 24, 30
FULL = HALF * 2            # 48
grid = [['~'] * FULL for _ in range(H)]

def ellipse(cx, cy, rx, ry, ch, half_only=True):
    xmax = HALF if half_only else FULL
    for y in range(H):
        for x in range(xmax):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                grid[y][x] = ch

# --- left-half landmasses (grass) ------------------------------------------
ellipse(10, 6, 7.5, 4.2, '.')     # upper-left main (Red)
ellipse(4, 15, 5.0, 4.5, '.')     # left-mid island
ellipse(9, 22, 7.0, 4.2, '.')     # lower-left island
ellipse(21, 13, 4.5, 11.0, '.')   # central spine (toward seam)
ellipse(8, 11, 3.0, 3.0, '.')     # land bridges
ellipse(13, 18, 3.5, 3.0, '.')
ellipse(16, 9, 4.0, 3.0, '.')
ellipse(15, 22, 4.0, 3.0, '.')

# tree fringe on water-touching grass (deterministic)
def water_adj(x, y):
    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
        nx, ny = x + dx, y + dy
        if nx < 0 or ny < 0 or nx >= HALF or ny >= H or grid[ny][nx] == '~':
            return True
    return False

def prng(x, y):
    h = (x * 73856093) ^ (y * 19349663)
    return ((h >> 3) & 0xffff) / 65535.0

for y in range(H):
    for x in range(HALF):
        if grid[y][x] == '.' and water_adj(x, y) and prng(x, y) < 0.5:
            grid[y][x] = 'T'
ellipse(17, 8, 3.2, 2.4, 'T')     # dense upper-centre forest

# breathing room around the start for the 4x3 Town Hall
for dy in range(-1, 3):
    for dx in range(-1, 3):
        x, y = 10 + dx, 6 + dy
        if 0 <= x < HALF and grid[y][x] == 'T':
            grid[y][x] = '.'

# --- reflect left half -> right half ---------------------------------------
for y in range(H):
    for x in range(HALF):
        grid[y][FULL - 1 - x] = grid[y][x]

# --- stamp asymmetric / single features ------------------------------------
def put(x, y, ch):
    grid[y][x] = ch

put(10, 6, 'P')                 # Red main (left)
put(FULL - 1 - 10, 6, 'E')      # Blue main (right)
for (x, y) in [(8, 3), (3, 15), (8, 22)]:        # left-side mines
    put(x, y, '$'); put(FULL - 1 - x, y, '$')    # mirrored right-side mines

# SINGLE centre buildings on the seam: merchant up top, mercenaries at bottom.
put(24, 4, 'o')    # top-centre  -> merchant / item shop
put(24, 22, 'o')   # bottom-centre -> mercenary camp
# make sure they sit on grass
for (cx, cy) in [(24, 4), (24, 22)]:
    for dy in range(-1, 2):
        for dx in range(-2, 2):
            x, y = cx + dx, cy + dy
            if 0 <= x < FULL and 0 <= y < H and grid[y][x] == '~':
                grid[y][x] = '.'
    put(cx, cy, 'o')

print("# Tideland Crossing — full board (generated; mirror: none).")
print("# Regenerate: python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map")
print("# Centre markers: o@(24,4)=merchant/item-shop, o@(24,22)=mercenary camp.")
print("name: Tideland Crossing")
print("tile: 64")
print("mirror: none")
print("gold_amount: 3000")
print("map:")
for row in grid:
    print(''.join(row))
