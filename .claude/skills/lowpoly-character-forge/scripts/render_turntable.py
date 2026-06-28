#!/usr/bin/env python3
"""lowpoly-character-forge — headless turntable render + GLB export.

Renders the procedural character from render-page.html at N angles and (optionally)
exports a .glb. Works in this cloud Linux env via Chromium + swiftshader (the same
path that renders the game headlessly). On a Mac, swap the launch flags for
--enable-gpu --use-angle=metal per references/headless-render.md.

Usage:
  python3 render_turntable.py --build elf --angles 0,45,90,135,180,225,270,315
  python3 render_turntable.py --build elf --export ../renders/elf.glb
"""
import argparse, asyncio, base64, glob, http.server, os, socket, threading, functools
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))

def _find_chromium():
    for pat in ('/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell',
                '/opt/pw-browsers/chromium-*/chrome-linux/chrome'):
        m = glob.glob(pat)
        if m: return m[0]
    return None

def _serve(directory):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=directory)
    httpd = http.server.HTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--build', default='elf')
    ap.add_argument('--role', default='warrior')
    ap.add_argument('--angles', default='25')
    ap.add_argument('--bloom', default='1')
    ap.add_argument('--out', default=os.path.join(HERE, '..', 'renders'))
    ap.add_argument('--export', dest='export_path', default='')
    ap.add_argument('--w', default='720'); ap.add_argument('--h', default='900')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    httpd, port = _serve(HERE)
    exe = _find_chromium()
    launch = dict(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
                        '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    if exe: launch['executable_path'] = exe
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch)
        pg = await b.new_page(viewport={'width': int(args.w), 'height': int(args.h)})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        url = f'http://127.0.0.1:{port}/render-page.html?build={args.build}&role={args.role}&bloom={args.bloom}&w={args.w}&h={args.h}'
        await pg.goto(url, wait_until='load')
        await pg.wait_for_function('window.LPF_VIEW && window.LPF_VIEW.ready', timeout=15000)
        await pg.wait_for_timeout(400)
        for a in [s for s in args.angles.split(',') if s != '']:
            await pg.evaluate('(d)=>window.LPF_VIEW.setAngle(d)', float(a))
            await pg.wait_for_timeout(250)
            fn = os.path.join(args.out, f'turn_{int(float(a)):03d}.png')
            await pg.screenshot(path=fn)
            print('rendered', fn)
        if args.export_path:
            b64 = await pg.evaluate('async()=>await window.LPF_VIEW.exportGLB()')
            with open(args.export_path, 'wb') as f: f.write(base64.b64decode(b64))
            print('exported', args.export_path, os.path.getsize(args.export_path), 'bytes')
        if errs: print('PAGE ERRORS:', errs[:5])
        await b.close()
    httpd.shutdown()

if __name__ == '__main__':
    asyncio.run(main())
