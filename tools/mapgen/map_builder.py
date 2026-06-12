"""
Tile map builder — deterministic, config-driven.

Usage:
    python map_builder.py map_config.json

ALL map decisions live in the config file. Edit the config, re-run, and
ONLY the thing you changed will differ — everything else is locked by
fixed random seeds.

RNG RULES (do not break these):
  - rng_main (seed in config) drives base decoration placement. Its call
    sequence must never change between runs, or every tree moves. New
    features must NEVER add/remove calls to rng_main. Filters are applied
    AFTER a placement is generated, never by short-circuiting before the
    random call.
  - Each optional feature gets its own random.Random(seed) stream.
"""
import sys, json, random
import numpy as np
from PIL import Image, ImageDraw

T = 64  # tile size

def load_rgba(path):
    """Load a sprite, converting pure-black background to transparency
    with a soft ramp that kills anti-aliasing fringe."""
    im = Image.open(path).convert('RGBA')
    a = np.array(im).astype(int)
    a[:, :, 3] = np.clip((a[:, :, :3].max(axis=2) - 6) * 24, 0, 255)
    return Image.fromarray(a.astype(np.uint8))

def in_ellipse(x, y, e):
    cx, cy, rx, ry = e
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

def main(cfg_path):
    cfg = json.load(open(cfg_path))
    A = cfg['assets']

    masks = json.load(open(cfg['terrain_masks']))
    ROWS, COLS = masks['rows'], masks['cols']
    land = np.array(masks['land'], bool)
    forest = np.array(masks['forest'], bool)
    CW, CH = COLS * T, ROWS * T

    rng_main = random.Random(cfg['seeds']['main'])
    rng_shallow = random.Random(cfg['seeds']['shallow'])
    rng_rocks = random.Random(cfg['seeds']['rocks'])

    # --- apply land edits from config ---
    for cell in cfg.get('force_land_cells', []):
        land[cell[0], cell[1]] = True
    for rect in cfg.get('fill_land_rects', []):       # [x0,y0,x1,y1] px
        x0, y0, x1, y1 = rect
        for i in range(ROWS):
            for j in range(COLS):
                cx, cy = j * T + 32, i * T + 32
                if x0 - 20 <= cx <= x1 + 20 and y0 - 20 <= cy <= y1 + 20:
                    land[i, j] = True

    def is_land(i, j):
        return 0 <= i < ROWS and 0 <= j < COLS and land[i, j]

    # --- exclusion zones (applied as post-filters, never to rng calls) ---
    tree_free = [tuple(e) for e in cfg.get('tree_clear_ellipses', [])]
    deco_free = [tuple(e) for e in cfg.get('deco_clear_ellipses', [])]

    def tree_blocked(x, y):
        return any(in_ellipse(x, y, e) for e in tree_free + deco_free)

    def deco_blocked(x, y):
        return any(in_ellipse(x, y, e) for e in deco_free)

    # --- 1. water base ---
    water = Image.open(A['water']).convert('RGBA')
    canvas = Image.new('RGBA', (CW, CH))
    for i in range(ROWS):
        for j in range(COLS):
            canvas.paste(water, (j * T, i * T))

    # --- 2. coastal foam ---
    foam_sheet = load_rgba(A['foam'])
    foam = [foam_sheet.crop((k * 192, 0, (k + 1) * 192, 192)) for k in range(16)]
    for i in range(ROWS):
        for j in range(COLS):
            if land[i, j] and not all(is_land(i + d, j + e)
                                      for d, e in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                canvas.alpha_composite(rng_main.choice(foam), (j * T - 64, i * T - 64))

    # --- 3. shallow-water zones: flat solid fill ---
    draw = ImageDraw.Draw(canvas)
    shallow_color = tuple(cfg['shallow_color'])
    shallow_cells = set()
    for rect in cfg.get('shallow_rects', []):
        x0, y0, x1, y1 = rect
        for i in range(ROWS):
            for j in range(COLS):
                cx, cy = j * T + 32, i * T + 32
                if not land[i, j] and x0 <= cx <= x1 and y0 <= cy <= y1:
                    rng_shallow.random()  # reserved for future variation
                    draw.rectangle([j * T, i * T, (j + 1) * T - 1, (i + 1) * T - 1],
                                   fill=shallow_color)
                    shallow_cells.add((i, j))

    # --- 4. grass blob autotile ---
    tm = load_rgba(A['tilemap'])
    def tile(c, r): return tm.crop((c * T, r * T, (c + 1) * T, (r + 1) * T))
    def pick_tile(n, e, s, w):
        c = 1 if (w and e) else 0 if e else 2 if w else 3
        r = 1 if (n and s) else 0 if s else 2 if n else 3
        return tile(c, r)
    for i in range(ROWS):
        for j in range(COLS):
            if land[i, j]:
                canvas.alpha_composite(
                    pick_tile(is_land(i - 1, j), is_land(i, j + 1),
                              is_land(i + 1, j), is_land(i, j - 1)),
                    (j * T, i * T))

    # --- 5. decorations (depth-sorted by base y) ---
    tree = load_rgba(A['tree']).crop((0, 0, 192, 256))
    bushes = [load_rgba(p).crop((0, 0, 128, 128)) for p in A['bushes']]
    gold = load_rgba(A['gold']).crop((0, 0, 128, 128))
    rocks = [load_rgba(p) for p in A['rocks']]

    sprites, busy = [], set()

    # protected cells around POIs
    clear = set()
    def mark_clear(x, y, rad=2):
        ci, cj = int(y) // T, int(x) // T
        for di in range(-rad, rad + 1):
            for dj in range(-rad, rad + 1):
                clear.add((ci + di, cj + dj))
    gold_spots = [tuple(g) for g in cfg.get('gold_sources', [])]
    rock_spots = [tuple(r) for r in cfg.get('rock_formations', [])]
    for x, y in gold_spots + rock_spots + [tuple(s) for s in cfg.get('start_locations', [])]:
        mark_clear(x, y)

    # trees
    p_tree = cfg['densities']['tree']
    for i in range(ROWS):
        for j in range(COLS):
            if forest[i, j] and (i, j) not in clear and rng_main.random() < p_tree:
                bx = j * T + 32 + rng_main.randint(-16, 16)
                by = (i + 1) * T + rng_main.randint(-12, 12)
                if not (tree_blocked(bx, by) or tree_blocked(bx, by - 128)):
                    sprites.append((by, tree, bx - 96, by - 244))
                    busy.add((i, j))

    # bushes + base rocks on open grass
    p_bush = cfg['densities']['bush']
    p_rock = cfg['densities']['rock_base']
    for i in range(ROWS):
        for j in range(COLS):
            if land[i, j] and not forest[i, j] and (i, j) not in clear:
                r = rng_main.random()
                if r < p_bush:
                    b = rng_main.choice(bushes)
                    bx = j * T + 32 + rng_main.randint(-10, 10)
                    by = (i + 1) * T + rng_main.randint(-8, 8)
                    if not deco_blocked(bx, by - 40):
                        sprites.append((by, b, bx - 64, by - 100)); busy.add((i, j))
                elif r < p_bush + p_rock:
                    rx = j * T + rng_main.randint(-6, 6)
                    ry = i * T + rng_main.randint(-6, 6)
                    rk = rng_rocks.choice(rocks)
                    if not deco_blocked(rx + 32, ry + 32):
                        sprites.append((i * T + T, rk, rx, ry)); busy.add((i, j))

    # gold sources (3-stone cluster each)
    for gx, gy in gold_spots:
        for dx, dy in ((-44, -6), (34, -14), (-4, 28)):
            sprites.append((gy + dy + 100, gold, gx + dx - 64, gy + dy - 36))

    # rock formations (4 rocks each)
    for rx_, ry_ in rock_spots:
        for dx, dy in ((-40, 0), (20, -20), (10, 30), (-15, -35)):
            sprites.append((ry_ + dy + 64, rng_rocks.choice(rocks), rx_ + dx, ry_ + dy))

    # extra rock scatter
    def near_gold(x, y, r=130):
        return any((x - gx) ** 2 + (y - gy) ** 2 <= r * r for gx, gy in gold_spots)
    p_scatter = cfg['densities']['rock_scatter']
    for i in range(ROWS):
        for j in range(COLS):
            if not land[i, j] or (i, j) in clear or (i, j) in busy:
                continue
            cx, cy = j * T + 32, i * T + 32
            if deco_blocked(cx, cy) or tree_blocked(cx, cy) or near_gold(cx, cy, cfg['gold_clear_radius']):
                continue
            if rng_rocks.random() < p_scatter:
                n = 1 if rng_rocks.random() < 0.7 else rng_rocks.randint(2, 3)
                for k in range(n):
                    rk = rng_rocks.choice(rocks)
                    rx = j * T + rng_rocks.randint(-10, 14) + (k * 22 if n > 1 else 0)
                    ry = i * T + rng_rocks.randint(-8, 12) + (k * 14 if n > 1 else 0)
                    sprites.append((ry + T, rk, rx, ry))

    sprites.sort(key=lambda s: s[0])
    for _, img, x, y in sprites:
        canvas.alpha_composite(img, (x, y))

    out = cfg['output']
    canvas.convert('RGB').save(out)
    print(f"wrote {out}  ({CW}x{CH}, {len(sprites)} sprites)")

    # optional: export traversability grid for engines
    if cfg.get('export_grid'):
        grid = [['water'] * COLS for _ in range(ROWS)]
        for i in range(ROWS):
            for j in range(COLS):
                if (i, j) in shallow_cells: grid[i][j] = 'shallow'
                elif land[i, j]: grid[i][j] = 'forest' if forest[i, j] else 'grass'
        json.dump(grid, open(cfg['export_grid'], 'w'))
        print(f"wrote {cfg['export_grid']}")

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'map_config.json')
