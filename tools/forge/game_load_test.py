#!/usr/bin/env python3
"""Verify a unit .glb through Warcrest's OWN runtime path: the same vendored
three.js r144 + GLTFLoader + SkeletonUtils, the same clip-by-name lookup and
vertex-colour toon-shading render3d.js uses. Loads the model, resolves the
configured clips, plays one, and screenshots — proving in-engine compatibility
without standing up the whole RTS. Run from repo root:
  python3 tools/forge/game_load_test.py assets/models/rim_walker_mdx.glb
"""
import sys, os, asyncio, glob, http.server, functools, threading
from playwright.async_api import async_playwright

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

HTML = """<!doctype html><html><head><meta charset=utf-8>
<style>html,body{margin:0;background:#20242e;overflow:hidden}</style></head><body>
<canvas id=c width=520 height=680></canvas>
<script src="/vendor/three.min.js"></script>
<script src="/vendor/GLTFLoader.js"></script>
<script src="/vendor/SkeletonUtils.js"></script>
<script>
window.RESULT = {};
var qs = new URLSearchParams(location.search);
var URL = qs.get('glb'), CLIP = qs.get('clip') || 'Walk';
var ANIMS = { idle:'Idle', walk:'Walk', attack:'Attack', death:'Death' };
var renderer = new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true,preserveDrawingBuffer:true});
renderer.setSize(520,680,false);
if (THREE.sRGBEncoding && 'outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
var scene = new THREE.Scene(); scene.background = new THREE.Color(0x20242e);
var cam = new THREE.PerspectiveCamera(35,520/680,0.1,5000);
scene.add(new THREE.HemisphereLight(0xbcd3ff,0x38304a,0.55));
var key = new THREE.DirectionalLight(0xfff2dd,1.15); key.position.set(3,6,4); scene.add(key);
// toon grad like render3d
function toonGrad(){var t=new THREE.DataTexture(new Uint8Array([190,225,255]),3,1,THREE.RedFormat||THREE.LuminanceFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t;}
function toonify(o){ if(!o.isMesh||!o.material)return; var vc=!!(o.geometry&&o.geometry.attributes&&o.geometry.attributes.color);
  function t(m){ if(m.isMeshToonMaterial)return m; var x=new THREE.MeshToonMaterial({color:m.color?m.color.clone():new THREE.Color(0xffffff),map:m.map||null,gradientMap:toonGrad(),vertexColors:vc}); return x; }
  o.material=Array.isArray(o.material)?o.material.map(t):t(o.material); }
var mixer=null, clock=new THREE.Clock(), angle=25, center=new THREE.Vector3(), radius=200;
new THREE.GLTFLoader().load(URL, function(gltf){
  var root = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(gltf.scene) : gltf.scene.clone();
  root.traverse(toonify); scene.add(root);
  var clips = gltf.animations || [];
  var found = {}; Object.keys(ANIMS).forEach(function(k){ var c=THREE.AnimationClip.findByName(clips, ANIMS[k]); found[k]=!!c; });
  var box=new THREE.Box3().setFromObject(root), sz=new THREE.Vector3(); box.getSize(sz); box.getCenter(center);
  radius=Math.max(sz.x,sz.y,sz.z)*1.7;
  mixer=new THREE.AnimationMixer(root);
  var clip=THREE.AnimationClip.findByName(clips, CLIP);
  if(clip){ var a=mixer.clipAction(clip); if(CLIP==='Attack'||CLIP==='Death'){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;} a.play(); }
  window.RESULT = { clipNames: clips.map(function(c){return c.name;}), mapped: found,
    meshCount: (function(){var n=0;root.traverse(function(o){if(o.isSkinnedMesh)n++;});return n;})(),
    size:[+sz.x.toFixed(1),+sz.y.toFixed(1),+sz.z.toFixed(1)] };
  window.READY = true;
}, undefined, function(e){ window.RESULT={error:String(e)}; window.READY=true; });
function frame(){ if(mixer)mixer.update(clock.getDelta());
  var a=angle*Math.PI/180; cam.position.set(center.x+Math.sin(a)*radius, center.y+radius*0.12, center.z+Math.cos(a)*radius);
  cam.lookAt(center); renderer.render(scene,cam); requestAnimationFrame(frame); }
frame();
window.setAngle=function(d){angle=d;};
window.setTime=function(t){ if(mixer)mixer.setTime(t); };
</script></body></html>"""


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
    glb = sys.argv[1] if len(sys.argv) > 1 else 'assets/models/rim_walker_mdx.glb'
    outdir = os.path.join(REPO, 'tools', 'forge', 'renders'); os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(REPO, '_gametest.html'), 'w') as f: f.write(HTML)
    httpd, port = _serve(REPO)
    launch = dict(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
                        '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    exe = _chromium()
    if exe: launch['executable_path'] = exe
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch)
        pg = await b.new_page(viewport={'width': 520, 'height': 680})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        for clip in ('Idle', 'Walk', 'Attack'):
            await pg.goto(f'http://127.0.0.1:{port}/_gametest.html?glb=/{glb}&clip={clip}', wait_until='load')
            await pg.wait_for_function('window.READY', timeout=20000)
            res = await pg.evaluate('window.RESULT')
            if clip == 'Idle': print('LOAD RESULT:', res)
            for t, ang in ((0.4, 30), (0.4, 150)):
                await pg.evaluate('(d)=>window.setAngle(d)', ang)
                await pg.evaluate('(t)=>window.setTime(t)', t)
                await pg.wait_for_timeout(200)
                await pg.screenshot(path=os.path.join(outdir, f'game_{clip}_{ang:03d}.png'))
            print('rendered', clip)
        if errs: print('PAGE ERRORS:', errs[:5])
        await b.close()
    httpd.shutdown()
    os.remove(os.path.join(REPO, '_gametest.html'))

if __name__ == '__main__':
    asyncio.run(main())
