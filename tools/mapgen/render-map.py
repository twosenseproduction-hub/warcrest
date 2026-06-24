#!/usr/bin/env python3
"""render-map.py — rasterize any Warcrest .tmj map to a PNG you can eyeball.

Usage:
    python3 tools/mapgen/render-map.py <map.tmj> [out.png] [--cell 14]

Draws terrain (water / grass / highland), forests, and spawn markers
(player = blue, enemy = red, gold = yellow, neutral = purple) with a
coordinate grid every 5 tiles. Defaults output to <map>.png next to the input.

Requires Pillow:  pip install pillow
"""
import json
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow is required:  pip install pillow")

WATER, FLAT, HIGH = -1, 0, 1
COL = {
    WATER: (26, 58, 106),    # deep blue
    FLAT:  (74, 122, 58),    # grass green
    HIGH:  (122, 134, 86),   # highland khaki
}
SHORE = (52, 92, 150)
FOREST = (28, 70, 34)
GRID = (255, 255, 255, 40)
MARK = {
    'spawn_player': (70, 150, 255),
    'spawn_enemy':  (235, 70, 70),
    'gold_node':    (245, 205, 70),
    'neutral':      (180, 110, 220),
}


def tile_layer(tmj, name):
    for L in tmj.get('layers', []):
        if L.get('type') == 'tilelayer' and L.get('name') == name:
            return L.get('data') or []
    return []


def obj_layer(tmj, name):
    for L in tmj.get('layers', []):
        if L.get('type') == 'objectgroup' and L.get('name') == name:
            return L.get('objects') or []
    return []


def reconstruct_heights(tmj, cols, rows):
    ground = tile_layer(tmj, 'ground')
    elevated = tile_layer(tmj, 'elevated')
    n = cols * rows
    heights = [WATER] * n
    for i in range(n):
        if i < len(elevated) and elevated[i]:
            heights[i] = HIGH
        elif i < len(ground) and ground[i]:
            heights[i] = FLAT
    return heights


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    cell = 14
    if '--cell' in sys.argv:
        cell = int(sys.argv[sys.argv.index('--cell') + 1])
    if not args:
        sys.exit("Usage: render-map.py <map.tmj> [out.png] [--cell N]")
    in_path = args[0]
    out_path = args[1] if len(args) > 1 else os.path.splitext(in_path)[0] + '.png'

    tmj = json.load(open(in_path))
    cols, rows = tmj['width'], tmj['height']
    tile = tmj.get('tilewidth', 64)
    heights = reconstruct_heights(tmj, cols, rows)

    pad = 24
    W, H = cols * cell + pad * 2, rows * cell + pad * 2
    img = Image.new('RGB', (W, H), (12, 18, 30))
    d = ImageDraw.Draw(img, 'RGBA')

    def at(cx, cy):
        if cx < 0 or cy < 0 or cx >= cols or cy >= rows:
            return WATER
        return heights[cx + cy * cols]

    # terrain
    for cy in range(rows):
        for cx in range(cols):
            h = heights[cx + cy * cols]
            x0, y0 = pad + cx * cell, pad + cy * cell
            color = COL[h]
            # tint land tiles that touch water so the coastline reads
            if h >= FLAT and any(at(cx + dx, cy + dy) == WATER
                                 for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))):
                color = tuple((a + b) // 2 for a, b in zip(color, SHORE))
            d.rectangle([x0, y0, x0 + cell - 1, y0 + cell - 1], fill=color)

    # forests
    for o in obj_layer(tmj, 'forest'):
        cx = int((o['x'] + o.get('width', 0) * 0.5) // tile)
        cy = int((o['y'] + o.get('height', 0) * 0.5) // tile)
        x0, y0 = pad + cx * cell, pad + cy * cell
        m = max(2, cell // 4)
        d.ellipse([x0 + m, y0 + m, x0 + cell - m, y0 + cell - m], fill=FOREST)

    # grid every 5 tiles
    for cx in range(0, cols + 1, 5):
        x = pad + cx * cell
        d.line([x, pad, x, pad + rows * cell], fill=GRID)
        d.text((x + 1, 2), str(cx), fill=(150, 160, 175))
    for cy in range(0, rows + 1, 5):
        y = pad + cy * cell
        d.line([pad, y, pad + cols * cell, y], fill=GRID)
        d.text((2, y + 1), str(cy), fill=(150, 160, 175))

    # spawn / gold / neutral markers
    for o in obj_layer(tmj, 'spawns'):
        t = o.get('type')
        col = MARK.get(t, (255, 255, 255))
        cx, cy = o['x'] / tile, o['y'] / tile
        x, y = pad + cx * cell, pad + cy * cell
        r = cell * 1.4
        d.ellipse([x - r, y - r, x + r, y + r], outline=col, width=max(2, cell // 5))
        label = {'spawn_player': 'P', 'spawn_enemy': 'E', 'gold_node': '$', 'neutral': 'o'}.get(t, '?')
        d.text((x - 3, y - 6), label, fill=col)

    img.save(out_path)
    land = sum(1 for h in heights if h >= FLAT)
    print(f"✓  {out_path}  ({cols}×{rows}, {cell}px/tile)")
    print(f"   land {land} / {cols*rows} tiles ({100*land//(cols*rows)}%)  ·  "
          f"{len(obj_layer(tmj,'forest'))} trees  ·  {len(obj_layer(tmj,'spawns'))} markers")


if __name__ == '__main__':
    main()
