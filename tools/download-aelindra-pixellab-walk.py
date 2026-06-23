#!/usr/bin/env python3
"""Download Aelindra walk frames from Pixel Lab and build horizontal strips."""
from __future__ import annotations

import json
import shutil
import urllib.request
from pathlib import Path

CHAR_ID = '25cba5ef-4c17-4b89-93c1-3abc53ef5015'
ROOT = Path(__file__).resolve().parents[1]
HERO = ROOT / 'assets/heroes/rimwalker/aelindra'
OUT = HERO / 'pixellab/walk'
WORK = ROOT / 'tools/.pixellab-work'
API = 'https://api.pixellab.ai/v2'


def load_key() -> str:
    for line in (ROOT / '.env').read_text().splitlines():
        if line.startswith('PIXELLAB_API_KEY='):
            return line.split('=', 1)[1].strip()
    raise SystemExit('PIXELLAB_API_KEY missing in .env')


def api_get(path: str, key: str) -> dict:
    req = urllib.request.Request(
        API + path,
        headers={'Authorization': f'Bearer {key}', 'User-Agent': 'Mozilla/5.0'},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main() -> None:
    key = load_key()
    char = api_get(f'/characters/{CHAR_ID}', key)
    manifest = {'character_id': CHAR_ID, 'template': 'walking-4-frames', 'directions': {}}

    for ag in char.get('animations', []):
        if ag.get('animation_type') != 'walking-4-frames':
            continue
        for d in ag.get('directions', []):
            direction = d['direction']
            dest = OUT / direction
            dest.mkdir(parents=True, exist_ok=True)
            files = []
            for i, url in enumerate(d.get('frames', [])):
                fp = dest / f'frame_{i:02d}.png'
                fp.write_bytes(download(url))
                files.append(str(fp.relative_to(HERO)))
            manifest['directions'][direction] = {'frame_count': len(files), 'files': files}
            print('saved', direction, len(files))

    (HERO / 'pixellab/walk_manifest.json').write_text(json.dumps(manifest, indent=2))
    WORK.joinpath('aelindra_character_detail.json').write_text(json.dumps(char, indent=2))

    from PIL import Image

    for direction in ['south', 'north', 'east', 'west']:
        frames = sorted((OUT / direction).glob('frame_*.png'))
        if not frames:
            continue
        im0 = Image.open(frames[0])
        w, h = im0.size
        strip = Image.new('RGBA', (w * len(frames), h))
        for i, fp in enumerate(frames):
            strip.paste(Image.open(fp).convert('RGBA'), (i * w, 0))
        strip.save(HERO / 'pixellab' / f'Aelindra_Walk_{direction}.png')
        print('strip', direction, strip.size)

    south = HERO / 'pixellab/Aelindra_Walk_south.png'
    if south.exists():
        shutil.copy2(south, HERO / 'Aelindra_Run.png')
        print('updated Aelindra_Run.png')


if __name__ == '__main__':
    main()
