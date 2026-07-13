#!/usr/bin/env python3
"""Render animated GIFs of each clip in a unit .glb, through the game's three.js
runtime (GLTFLoader + AnimationMixer). The camera re-frames the model's current
bounding box every frame, so clips that carry root translation (this MDX's Walk
strides forward) stay in view. Run from repo root:
  python3 tools/forge/render_gifs.py assets/models/rim_walker_mdx.glb
Outputs tools/forge/renders/<clip>.gif
"""
import sys, os, asyncio, glob, http.server, functools, threading, io, base64
from playwright.async_api import async_playwright
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

HTML = """<!doctype html><html><head><meta charset=utf-8><style>html,body{margin:0;background:#20242e}</style></head><body>
<canvas id=c width=420 height=520></canvas>
<script src="/vendor/three.min.js"></script>
<script src="/vendor/GLTFLoader.js"></script>
<script src="/vendor/SkeletonUtils.js"></script>
<script>
var qs=new URLSearchParams(location.search), CLIP=qs.get('clip')||'Idle', ANGLE=+(qs.get('angle')||35);
var rn=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true,preserveDrawingBuffer:true});rn.setSize(420,520,false);
if(THREE.sRGBEncoding&&'outputEncoding' in rn) rn.outputEncoding=THREE.sRGBEncoding;
var sc=new THREE.Scene();sc.background=new THREE.Color(0x20242e);
var cam=new THREE.PerspectiveCamera(35,420/520,0.1,6000);
sc.add(new THREE.HemisphereLight(0xbcd3ff,0x38304a,0.55));
var k=new THREE.DirectionalLight(0xfff2dd,1.25);k.position.set(4,7,5);sc.add(k);
var rim=new THREE.DirectionalLight(0x9ad8ff,0.4);rim.position.set(-4,3,-5);sc.add(rim);
// ground grid so "right side up" is unambiguous (lies in XZ at y=0)
var grid=new THREE.GridHelper(400,20,0x557799,0x33445a); sc.add(grid);
function grad(){var t=new THREE.DataTexture(new Uint8Array([190,225,255]),3,1,THREE.RedFormat||THREE.LuminanceFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t;}
function toon(o){if(!o.isMesh||!o.material)return;var vc=!!(o.geometry&&o.geometry.attributes&&o.geometry.attributes.color);
 function t(m){return m.isMeshToonMaterial?m:new THREE.MeshToonMaterial({color:m.color?m.color.clone():new THREE.Color(0xffffff),map:m.map||null,gradientMap:grad(),vertexColors:vc});}
 o.material=Array.isArray(o.material)?o.material.map(t):t(o.material);}
var mixer=null,dur=1,root=null,box=new THREE.Box3(),ctr=new THREE.Vector3(),sz=new THREE.Vector3(),radius=200;
new THREE.GLTFLoader().load('/'+qs.get('glb'),function(g){
 root=THREE.SkeletonUtils?THREE.SkeletonUtils.clone(g.scene):g.scene.clone();root.traverse(toon);sc.add(root);
 var clip=THREE.AnimationClip.findByName(g.animations,CLIP);
 box.setFromObject(root);box.getSize(sz);radius=Math.max(sz.x,sz.y,sz.z)*1.9;
 mixer=new THREE.AnimationMixer(root);
 if(clip){dur=clip.duration;var a=mixer.clipAction(clip);a.play();}
 window.DUR=dur;window.READY=1;
},undefined,function(e){window.ERR=String(e);window.READY=1;});
window.shot=function(t){
 mixer.setTime(t);
 // recenter on the CURRENT deformed bounds so root-translated clips stay framed
 box.setFromObject(root);box.getCenter(ctr);box.getSize(sz);
 var a=ANGLE*Math.PI/180;
 cam.position.set(ctr.x+Math.sin(a)*radius, radius*0.42, ctr.z+Math.cos(a)*radius);
 cam.lookAt(ctr.x,ctr.y*0.9,ctr.z);
 rn.render(sc,cam);
};
</script></body></html>"""


def _serve(d):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=d)
    s = http.server.HTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, s.server_address[1]


def _chrom():
    for p in ('/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell',
              '/opt/pw-browsers/chromium-*/chrome-linux/chrome'):
        m = glob.glob(p)
        if m: return m[0]


async def main():
    glb = sys.argv[1] if len(sys.argv) > 1 else 'assets/models/rim_walker_mdx.glb'
    clips = (sys.argv[2].split(',') if len(sys.argv) > 2 else ['Idle', 'Walk', 'Attack', 'Death'])
    outdir = os.path.join(REPO, 'tools', 'forge', 'renders'); os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(REPO, '_gif.html'), 'w') as f: f.write(HTML)
    s, port = _serve(REPO)
    L = dict(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    e = _chrom()
    if e: L['executable_path'] = e
    NFR = 28
    async with async_playwright() as p:
        b = await p.chromium.launch(**L)
        pg = await b.new_page(viewport={'width': 420, 'height': 520})
        for clip in clips:
            await pg.goto(f'http://127.0.0.1:{port}/_gif.html?glb={glb}&clip={clip}&angle=35', wait_until='load')
            await pg.wait_for_function('window.READY', timeout=20000)
            dur = await pg.evaluate('window.DUR') or 1.0
            frames = []
            for i in range(NFR):
                t = dur * (i / NFR)
                await pg.evaluate('(t)=>window.shot(t)', t)
                await pg.wait_for_timeout(30)
                png = await pg.screenshot()
                frames.append(Image.open(io.BytesIO(png)).convert('RGB'))
            gif = os.path.join(outdir, f'{clip}.gif')
            frames[0].save(gif, save_all=True, append_images=frames[1:], duration=max(40, int(dur / NFR * 1000)), loop=0, optimize=True)
            print('wrote', gif, '(%.2fs, %d frames)' % (dur, NFR))
        await b.close()
    s.shutdown()
    os.remove(os.path.join(REPO, '_gif.html'))

if __name__ == '__main__':
    asyncio.run(main())
