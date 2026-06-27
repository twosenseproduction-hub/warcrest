#!/usr/bin/env python3
"""Author the FULL board of Tideland Crossing.

Layout goal (player request):
  * Big, OPEN buildable land — not a cramped archipelago.
  * A central water GULF that opens to the north sea and splits the top of the
    map in two, so the only way between the two bases is DOWN one side, across
    a southern land bridge, and back UP — "go down and around".
  * SPARSE trees (which are solid/collidable in-engine), scattered on land and
    kept well clear of the bases, mines and the central corridor.

Emits a `mirror: none` .map (the board is built symmetrically in Python).
Regenerate:
  python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map
"""

W, H = 72, 50          # tiles — 4608 x 3200 px. Roomy enough to actually build.
CX = W // 2            # vertical centre line (the mirror seam)
MOAT = 2               # water border thickness (island feel)
GULF_BOTTOM = 32       # gulf reaches this row; everything below is land bridge
GULF_TOP_HALF = 9.0    # gulf half-width (tiles) at the very top
TREE_DENSITY = 0.06    # fraction of eligible land tiles that get a tree

grid = [['.'] * W for _ in range(H)]


def prng(x, y, salt=0):
    h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    return ((h >> 4) & 0xffff) / 65535.0


# ── Water: outer moat + central gulf ────────────────────────────────────────
for y in range(H):
    for x in range(W):
        # outer island moat
        if x < MOAT or x >= W - MOAT or y < MOAT or y >= H - MOAT:
            grid[y][x] = '~'

# Central gulf — a funnel of water hugging the centre line, widest at the top,
# tapering to nothing at GULF_BOTTOM. Open to the north sea (the top moat).
for y in range(0, GULF_BOTTOM + 1):
    t = y / float(GULF_BOTTOM)               # 0 at top -> 1 at gulf bottom
    half = GULF_TOP_HALF * (1.0 - t) ** 1.15  # smooth taper
    half = max(half, 0.0)
    for x in range(W):
        if abs((x + 0.5) - CX) <= half:
            grid[y][x] = '~'

def is_land(x, y):
    return 0 <= x < W and 0 <= y < H and grid[y][x] != '~'


def put(x, y, ch):
    grid[y][x] = ch


def clear_box(x, y, rad, ch='.'):
    """Force a small land clearing (used around bases / structures)."""
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H:
                grid[ny][nx] = ch


# ── Spawns, gold, neutral structures ────────────────────────────────────────
PB = (10, 9)                 # player base (top-left land)
EB = (W - 1 - 10, 9)         # enemy base (top-right land), mirror of PB
clear_box(PB[0], PB[1], 3)
clear_box(EB[0], EB[1], 3)
put(PB[0], PB[1], 'P')
put(EB[0], EB[1], 'E')

# Home gold — two nodes flanking each base.
home_gold = [(6, 7), (14, 6)]
for (gx, gy) in home_gold:
    clear_box(gx, gy, 1)
    put(gx, gy, '$')
    put(W - 1 - gx, gy, '$')

# Auxiliary (creep-guarded) mines — one mid-flank each side, one each on the
# lower flanks along the "around" route.
aux_gold = [(7, 24), (16, 38)]
for (gx, gy) in aux_gold:
    clear_box(gx, gy, 1)
    put(gx, gy, '$')
    put(W - 1 - gx, gy, '$')

# Neutral centre structures sit on the southern land bridge — contested by both
# sides on the "around" path. Merchant just south of the gulf, mercenaries at
# the very bottom centre.
MERCHANT = (CX, GULF_BOTTOM + 4)
MERCENARY = (CX, H - 5)
clear_box(MERCHANT[0], MERCHANT[1], 2)
clear_box(MERCENARY[0], MERCENARY[1], 2)
put(MERCHANT[0], MERCHANT[1], 'o')
put(MERCENARY[0], MERCENARY[1], 'o')

# ── Sparse, collidable forest ───────────────────────────────────────────────
# Keep trees off: bases, gold, neutral structures, the central corridor seam,
# and a margin around all of the above.
keepouts = [PB, EB, MERCHANT, MERCENARY] + home_gold + aux_gold
keepouts += [(W - 1 - x, y) for (x, y) in home_gold + aux_gold]


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
        # leave the central bridge corridor fairly clear so armies can pass
        if abs((x + 0.5) - CX) <= 3 and y >= GULF_BOTTOM:
            continue
        if prng(x, y, 7) < TREE_DENSITY:
            grid[y][x] = 'T'

print("# Tideland Crossing — full board %dx%d (generated; mirror: none)." % (W, H))
print("# Central gulf splits the top; cross via the southern land bridge.")
print("# Regenerate: python3 tools/mapgen/sources/gen_tideland.py > tools/mapgen/sources/tideland-crossing.map")
print("name: Tideland Crossing")
print("tile: 64")
print("mirror: none")
print("gold_amount: 3000")
print("map:")
for row in grid:
    print(''.join(row))
