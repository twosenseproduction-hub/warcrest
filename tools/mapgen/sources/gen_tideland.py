#!/usr/bin/env python3
"""Author the FULL board of Tideland Crossing from blob anchors, scaled to a
roomier grid so there's space to build. Layout is defined in a 24x30 reference
space and scaled up to HALF*2 x H. Emits a mirror: none .map."""

# Target board: 64x40 tiles (4096x2560 px) — was 48x30, too compact to build on.
HALF, H = 32, 40
FULL = HALF * 2
REF_HALF, REF_H = 24, 30
SX, SY = HALF / REF_HALF, H / REF_H      # scale ref coords -> target

grid = [['~'] * FULL for _ in range(H)]

def E(cx, cy, rx, ry, ch, half_only=True):
    cx, cy, rx, ry = cx * SX, cy * SY, rx * SX, ry * SY
    xmax = HALF if half_only else FULL
    for y in range(H):
        for x in range(xmax):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                grid[y][x] = ch

# left-half landmasses (ref coords)
E(10, 6, 7.5, 4.2, '.')
E(4, 15, 5.0, 4.5, '.')
E(9, 22, 7.0, 4.2, '.')
E(21, 13, 4.5, 11.0, '.')
E(8, 11, 3.0, 3.0, '.')
E(13, 18, 3.5, 3.0, '.')
E(16, 9, 4.0, 3.0, '.')
E(15, 22, 4.0, 3.0, '.')

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
        if grid[y][x] == '.' and water_adj(x, y) and prng(x, y) < 0.42:
            grid[y][x] = 'T'
E(17, 8, 3.2, 2.4, 'T')

# reflect to right half
for y in range(H):
    for x in range(HALF):
        grid[y][FULL - 1 - x] = grid[y][x]

def put(x, y, ch):
    x = int(round(x * SX)); y = int(round(y * SY))
    grid[y][x] = ch
def putf(x, y, ch):   # full-board coords (already scaled)
    grid[y][x] = ch

# start + mirrored mines (ref left coords; reflect x in full board)
def mirror_x(rx):
    return FULL - 1 - int(round(rx * SX))

py = int(round(6 * SY))
putf(int(round(10 * SX)), py, 'P')
putf(mirror_x(10), py, 'E')
for (rx, ry) in [(8, 3), (3, 15), (8, 22)]:
    gy = int(round(ry * SY))
    putf(int(round(rx * SX)), gy, '$')
    putf(mirror_x(rx), gy, '$')

# single centre neutral markers (full-board centre column)
cxc = FULL // 2
for (cy, _name) in [(int(round(4 * SY)), 'merchant'), (int(round(22 * SY)), 'mercenary')]:
    for dy in range(-1, 2):
        for dx in range(-2, 2):
            x, y = cxc + dx, cy + dy
            if 0 <= x < FULL and 0 <= y < H and grid[y][x] == '~':
                grid[y][x] = '.'
    grid[cy][cxc] = 'o'

print("# Tideland Crossing — full board %dx%d (generated; mirror: none)." % (FULL, H))
print("# Regenerate: python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map")
print("name: Tideland Crossing")
print("tile: 64")
print("mirror: none")
print("gold_amount: 3000")
print("map:")
for row in grid:
    print(''.join(row))
