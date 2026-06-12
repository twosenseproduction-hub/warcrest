#!/usr/bin/env python3
"""Import mapgen output into Warcrest Sapphire Shores assets.

Usage:
    python3 scripts/import-mapgen.py [path/to/mapgen]

Defaults to ../tools/mapgen if present, else ~/Downloads/mapgen.
Regenerates map first if map_builder.py is available.
"""
import json
import os
import subprocess
import sys

TILE = 64
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def default_mapgen():
    for p in (
        os.path.join(ROOT, 'tools', 'mapgen'),
        os.path.expanduser('~/Downloads/mapgen'),
    ):
        if os.path.isdir(p) and os.path.isfile(os.path.join(p, 'map_config.json')):
            return p
    return os.path.expanduser('~/Downloads/mapgen')


def run_builder(mapgen):
    cfg = os.path.join(mapgen, 'map_config.json')
    builder = os.path.join(mapgen, 'map_builder.py')
    if not os.path.isfile(builder):
        return
    print('Running map_builder.py …')
    subprocess.check_call([sys.executable, builder, cfg], cwd=mapgen)


def load_json(path):
    with open(path) as f:
        return json.load(f)


def apply_land_edits(land, cfg):
    rows, cols = len(land), len(land[0])
    for cell in cfg.get('force_land_cells', []):
        land[cell[0]][cell[1]] = 1
    for rect in cfg.get('fill_land_rects', []):
        x0, y0, x1, y1 = rect
        for i in range(rows):
            for j in range(cols):
                cx, cy = j * TILE + 32, i * TILE + 32
                if x0 - 20 <= cx <= x1 + 20 and y0 - 20 <= cy <= y1 + 20:
                    land[i][j] = 1


def main():
    mapgen = sys.argv[1] if len(sys.argv) > 1 else default_mapgen()
    if not os.path.isdir(mapgen):
        sys.exit(f'mapgen folder not found: {mapgen}')

    run_builder(mapgen)

    cfg = load_json(os.path.join(mapgen, 'map_config.json'))
    masks = load_json(os.path.join(mapgen, 'terrain_masks.json'))
    trav_path = os.path.join(mapgen, cfg.get('export_grid', 'traversability.json'))
    grid = load_json(trav_path)

    rows, cols = masks['rows'], masks['cols']
    land = [row[:] for row in masks['land']]
    forest = [row[:] for row in masks['forest']]
    apply_land_edits(land, cfg)

    heights = []
    forest_cells = []
    for i in range(rows):
        for j in range(cols):
            cell = grid[i][j] if i < len(grid) and j < len(grid[i]) else 'water'
            walkable = land[i][j] and cell != 'water'
            heights.append(0 if walkable else -1)
            forest_cells.append(1 if walkable and (cell == 'forest' or forest[i][j]) else 0)

    starts = cfg.get('start_locations', [[544, 288], [2592, 288]])
    gold_raw = cfg.get('gold_sources', [])
    gold_amounts = [2800, 2800, 2700, 2700, 2600, 2600, 3200, 2900]
    gold = []
    for idx, (x, y) in enumerate(gold_raw):
        gold.append({'x': int(x), 'y': int(y), 'amount': gold_amounts[idx] if idx < len(gold_amounts) else 2600})

    rocks = [{'x': int(x), 'y': int(y)} for x, y in cfg.get('rock_formations', [])]

    seeds = cfg.get('seeds', {})
    densities = cfg.get('densities', {})

    out_data = os.path.join(ROOT, 'src', 'sapphire-mapgen.js')
    with open(out_data, 'w') as f:
        f.write('/* Auto-imported from mapgen — run scripts/import-mapgen.py to refresh */\n')
        f.write("(function (RTS) {\n  'use strict';\n")
        f.write('  RTS.SapphireMapgen = {\n')
        f.write(f'    cols: {cols}, rows: {rows}, tile: {TILE},\n')
        f.write(f'    world: {{ w: {cols * TILE}, h: {rows * TILE} }},\n')
        f.write(f'    heights: new Int8Array([{",".join(map(str, heights))}]),\n')
        f.write(f'    forest: new Uint8Array([{",".join(map(str, forest_cells))}]),\n')
        f.write(f'    treeDensity: {densities.get("tree", 0.72)},\n')
        f.write(f'    treeSeed: {seeds.get("main", 42)},\n')
        f.write(f'    playerBase: {{ x: {int(starts[0][0])}, y: {int(starts[0][1])} }},\n')
        f.write(f'    enemyBase: {{ x: {int(starts[1][0])}, y: {int(starts[1][1])} }},\n')
        f.write('    gold: ' + json.dumps(gold, indent=6).replace('\n', '\n    ') + ',\n')
        f.write('    rocks: ' + json.dumps(rocks, indent=6).replace('\n', '\n    ') + ',\n')
        f.write('  };\n})(window.RTS = window.RTS || {});\n')

    # copy reference PNG
    src_png = os.path.join(mapgen, cfg.get('output', 'sprite_map.png'))
    dst_png = os.path.join(ROOT, 'exports', 'sapphire-shores', 'sapphire-mapgen-reference.png')
    os.makedirs(os.path.dirname(dst_png), exist_ok=True)
    if os.path.isfile(src_png):
        import shutil
        shutil.copy2(src_png, dst_png)
        print(f'Copied reference PNG → {dst_png}')

    print(f'Wrote {out_data}  ({cols}x{rows} tiles, {cols*TILE}x{rows*TILE}px)')
    print(f'  Player base: {starts[0]}  Enemy base: {starts[1]}')
    print(f'  Gold nodes: {len(gold)}')


if __name__ == '__main__':
    main()
