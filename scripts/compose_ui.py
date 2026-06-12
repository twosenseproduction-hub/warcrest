#!/usr/bin/env python3
"""Bake Tiny Swords 9-slice atlases into flat PNGs for CSS backgrounds."""
from PIL import Image
import os

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'ui')
os.makedirs(OUT, exist_ok=True)

BTN_TILES = {
    'tl': (19, 17, 64, 64), 't': (128, 17, 192, 64), 'tr': (256, 17, 301, 64),
    'l': (19, 128, 64, 192), 'c': (128, 128, 192, 192), 'r': (256, 128, 301, 192),
    'bl': (19, 256, 64, 303), 'b': (128, 256, 192, 303), 'br': (256, 256, 301, 303),
}
BAN_TILES = {
    'tl': (28, 60, 128, 128), 't': (192, 60, 256, 128), 'tr': (320, 60, 384, 128),
    'l': (28, 192, 128, 256), 'c': (192, 192, 256, 256), 'r': (320, 192, 384, 256),
    'bl': (28, 320, 128, 384), 'b': (192, 320, 256, 384), 'br': (320, 320, 384, 384),
}
WOOD_TILES = {
    'tl': (45, 43, 128, 128), 't': (192, 43, 256, 128), 'tr': (320, 43, 403, 128),
    'l': (45, 192, 128, 256), 'c': (192, 192, 256, 256), 'r': (320, 192, 403, 256),
    'bl': (45, 320, 128, 423), 'b': (192, 320, 256, 423), 'br': (320, 320, 403, 423),
}
PAPER_TILES = {
    'tl': (0, 0, 64, 64), 't': (64, 0, 256, 64), 'tr': (256, 0, 320, 64),
    'l': (0, 64, 64, 256), 'c': (64, 64, 256, 256), 'r': (256, 64, 320, 256),
    'bl': (0, 256, 64, 320), 'b': (64, 256, 256, 320), 'br': (256, 256, 320, 320),
}
BAR_TILES = {
    'tl': (19, 0, 64, 64), 't': (128, 0, 192, 64), 'tr': (256, 0, 301, 64),
    'l': (19, 0, 64, 64), 'c': (128, 0, 192, 64), 'r': (256, 0, 301, 64),
    'bl': (19, 0, 64, 64), 'b': (128, 0, 192, 64), 'br': (256, 0, 301, 64),
}

def resize_h(img, w):
    return img.resize((max(1, w), img.height), Image.NEAREST) if w > 0 else Image.new('RGBA', (1, img.height))

def resize_v(img, h):
    return img.resize((img.width, max(1, h)), Image.NEAREST) if h > 0 else Image.new('RGBA', (img.width, 1))

def compose_nine(atlas_path, tiles, out_w, out_h):
    im = Image.open(atlas_path).convert('RGBA')
    p = {k: im.crop(v) for k, v in tiles.items()}
    tl, tr, bl, br = p['tl'], p['tr'], p['bl'], p['br']
    iw = out_w - tl.width - tr.width
    ih = out_h - tl.height - bl.height
    canvas = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))

    if iw > 0:
        if ih > 0:
            canvas.paste(resize_h(resize_v(p['c'], ih), iw), (tl.width, tl.height))
            canvas.paste(resize_v(p['l'], ih), (0, tl.height))
            canvas.paste(resize_v(p['r'], ih), (out_w - p['r'].width, tr.height))
            canvas.paste(resize_h(p['t'], iw), (tl.width, 0))
            canvas.paste(resize_h(p['b'], iw), (tl.width, out_h - p['b'].height))
        else:
            # Shorter than corner sum — overlap corners; fill full height first.
            canvas.paste(resize_h(resize_v(p['c'], out_h), iw), (tl.width, 0))
            canvas.paste(resize_v(p['l'], out_h), (0, 0))
            canvas.paste(resize_v(p['r'], out_h), (out_w - p['r'].width, 0))
            canvas.paste(resize_h(p['t'], iw), (tl.width, 0))
            canvas.paste(resize_h(p['b'], iw), (tl.width, out_h - p['b'].height))

    canvas.paste(tl, (0, 0))
    canvas.paste(tr, (out_w - tr.width, 0))
    canvas.paste(bl, (0, out_h - bl.height))
    canvas.paste(br, (out_w - br.width, out_h - br.height))
    return canvas

def bake_single(path, out, size):
    im = Image.open(path).convert('RGBA')
    tile = im.crop(im.getbbox())
    tile.resize(size, Image.NEAREST).save(out)

def compose_bar_fill(fill_path, out_w):
    """Stretch the thin fill strip to a horizontal bar width."""
    im = Image.open(fill_path).convert('RGBA')
    bbox = im.getbbox()
    strip = im.crop(bbox) if bbox else im
    return strip.resize((max(1, out_w), strip.height), Image.NEAREST)

def extract_sword_icon(sheet_path, row):
    """Trim alpha bbox from one 64px row of the Swords atlas."""
    im = Image.open(sheet_path).convert('RGBA')
    y = row * 64
    row_img = im.crop((0, y, im.width, y + 64))
    bbox = row_img.getbbox()
    return row_img.crop(bbox) if bbox else row_img

def compose_sword(sheet_path, row, out_w):
    """Horizontal 3-slice sword banner: hilt | blade (stretch) | tip."""
    im = Image.open(sheet_path).convert('RGBA')
    y = row * 64
    left = im.crop((23, y, 128, y + 64))
    mid = im.crop((192, y, 256, y + 64))
    right = im.crop((320, y, 412, y + 64))
    mid_w = out_w - left.width - right.width
    mid_stretched = mid.resize((max(1, mid_w), 64), Image.NEAREST)
    canvas = Image.new('RGBA', (out_w, 64), (0, 0, 0, 0))
    canvas.paste(left, (0, 0))
    canvas.paste(mid_stretched, (left.width, 0))
    canvas.paste(right, (left.width + mid_w, 0))
    return canvas

def main():
    base = os.path.join(ROOT, 'assets/tiny-swords/UI Elements/UI Elements')
    pairs = [
        ('Buttons/BigBlueButton_Regular.png', 'btn-blue'),
        ('Buttons/BigBlueButton_Pressed.png', 'btn-blue-pressed'),
        ('Buttons/BigRedButton_Regular.png', 'btn-red'),
        ('Buttons/BigRedButton_Pressed.png', 'btn-red-pressed'),
    ]
    for w in (360, 420, 480):
        for src, prefix in pairs:
            compose_nine(os.path.join(base, src), BTN_TILES, w, 72).save(
                os.path.join(OUT, f'{prefix}-{w}.png'))
    for w in (320, 400, 520):
        compose_nine(os.path.join(base, 'Banners/Banner.png'), BAN_TILES, w, 80).save(
            os.path.join(OUT, f'banner-{w}.png'))
    wood_src = os.path.join(base, 'Wood Table/WoodTable.png')
    for w in (280, 320, 360):
        compose_nine(wood_src, WOOD_TILES, w, 220).save(
            os.path.join(OUT, f'wood-table-{w}.png'))
    bake_single(os.path.join(base, 'Buttons/SmallBlueSquareButton_Regular.png'),
                os.path.join(OUT, 'btn-sq-blue.png'), (48, 48))
    bake_single(os.path.join(base, 'Buttons/SmallBlueSquareButton_Pressed.png'),
                os.path.join(OUT, 'btn-sq-blue-pressed.png'), (48, 48))
    bake_single(os.path.join(base, 'Buttons/SmallRedSquareButton_Regular.png'),
                os.path.join(OUT, 'btn-sq-red.png'), (48, 48))
    bake_single(os.path.join(base, 'Buttons/SmallRedSquareButton_Pressed.png'),
                os.path.join(OUT, 'btn-sq-red-pressed.png'), (48, 48))
    bake_single(os.path.join(base, 'Buttons/SmallBlueRoundButton_Regular.png'),
                os.path.join(OUT, 'btn-round-blue.png'), (52, 52))
    bake_single(os.path.join(base, 'Buttons/SmallBlueRoundButton_Pressed.png'),
                os.path.join(OUT, 'btn-round-blue-pressed.png'), (52, 52))
    bake_single(os.path.join(base, 'Buttons/SmallRedRoundButton_Regular.png'),
                os.path.join(OUT, 'btn-round-red.png'), (52, 52))
    bake_single(os.path.join(base, 'Buttons/SmallRedRoundButton_Pressed.png'),
                os.path.join(OUT, 'btn-round-red-pressed.png'), (52, 52))
    sword_src = os.path.join(base, 'Swords/Swords.png')
    for w in (320, 360, 400, 480):
        compose_sword(sword_src, 0, w).save(os.path.join(OUT, f'logo-sword-{w}.png'))
    extract_sword_icon(sword_src, 0).save(os.path.join(OUT, 'sword-icon-win.png'))
    extract_sword_icon(sword_src, 5).save(os.path.join(OUT, 'sword-icon-lose.png'))

    paper_src = os.path.join(base, 'Papers/RegularPaper.png')
    for w in (256, 320, 360, 512):
        compose_nine(paper_src, PAPER_TILES, w, w).save(
            os.path.join(OUT, f'paper-panel-{w}.png'))
    paper_im = Image.open(paper_src).convert('RGBA')
    paper_im.crop(PAPER_TILES['c']).resize((128, 128), Image.NEAREST).save(
        os.path.join(OUT, 'paper-tile-128.png'))

    bar_base_src = os.path.join(base, 'Bars/SmallBar_Base.png')
    bar_fill_src = os.path.join(base, 'Bars/SmallBar_Fill.png')
    for w in (80, 120, 160, 200):
        compose_nine(bar_base_src, BAR_TILES, w, 64).save(
            os.path.join(OUT, f'bar-base-{w}.png'))
        compose_bar_fill(bar_fill_src, w).save(
            os.path.join(OUT, f'bar-fill-{w}.png'))

    print('UI assets baked to', OUT)

if __name__ == '__main__':
    main()
