#!/usr/bin/env python3
"""lowpoly-building-forge — headless building render (Chromium/swiftshader).
Usage: python3 render_buildings.py --faction human --kind house --angles 35
       python3 render_buildings.py --faction orc --night 1 --export ../renders/orc_house.glb
"""
import argparse, asyncio, base64, glob, http.server, os, socketserver, threading, functools
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))

def _serve(directory):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=directory)
    httpd = http.server.HTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]

def _chromium():
    for pat in ('/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell',
                '/opt/pw-browsers/chromium-*/chrome-linux/chrome'):
        m = glob.glob(pat)
        if m: return m[0]
    return None

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--faction', default='human'); ap.add_argument('--kind', default='house')
    ap.add_argument('--angles', default='35'); ap.add_argument('--night', default='0')
    ap.add_argument('--out', default=os.path.join(HERE, '..', 'renders'))
    ap.add_argument('--export', dest='export_path', default=''); ap.add_argument('--w', default='760'); ap.add_argument('--h', default='760')
    args = ap.parse_args(); os.makedirs(args.out, exist_ok=True)
    httpd, port = _serve(HERE); exe = _chromium()
    launch = dict(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    if exe: launch['executable_path'] = exe
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch)
        pg = await b.new_page(viewport={'width': int(args.w), 'height': int(args.h)})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        url = f'http://127.0.0.1:{port}/render-building.html?faction={args.faction}&kind={args.kind}&night={args.night}&w={args.w}&h={args.h}'
        await pg.goto(url, wait_until='load')
        await pg.wait_for_function('window.LPF_VIEW && window.LPF_VIEW.ready', timeout=15000)
        await pg.wait_for_timeout(400)
        for a in [s for s in args.angles.split(',') if s != '']:
            await pg.evaluate('(d)=>window.LPF_VIEW.setAngle(d)', float(a)); await pg.wait_for_timeout(250)
            fn = os.path.join(args.out, f'{args.faction}_{args.kind}_{int(float(a)):03d}{"_n" if args.night=="1" else ""}.png')
            await pg.screenshot(path=fn); print('rendered', fn)
        if args.export_path:
            b64 = await pg.evaluate('async()=>await window.LPF_VIEW.exportGLB()')
            open(args.export_path, 'wb').write(base64.b64decode(b64)); print('exported', args.export_path)
        if errs: print('PAGE ERRORS:', errs[:5])
        await b.close()
    httpd.shutdown()

if __name__ == '__main__':
    asyncio.run(main())
