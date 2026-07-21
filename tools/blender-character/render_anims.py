#!/usr/bin/env python3
"""Render purple_plate_elf_pack_anim.glb clips to MP4 (mobile-friendly)."""
from __future__ import annotations

import asyncio
import functools
import glob
import http.server
import os
import subprocess
import threading
from pathlib import Path

from playwright.async_api import async_playwright

REPO = Path("/workspace")
GLB = REPO / "assets/models/blender/purple_plate_elf_pack_anim.glb"
OUT = Path("/opt/cursor/artifacts/blender_purple_elf/anims")
VENDOR = REPO / ".claude/skills/lowpoly-character-forge/scripts/vendor"
OUT.mkdir(parents=True, exist_ok=True)

CLIPS = [
    "idle",
    "bow_idle",
    "bow_idle_alt",
    "attack_load",
    "attack_hold",
    "attack_release",
    "walk",
    "run",
]

HTML = r"""<!doctype html><html><head><meta charset=utf-8>
<style>html,body{margin:0;background:#e8e8e0}</style></head><body>
<canvas id=c width=480 height=600></canvas>
<script src="/vendor/three.min.js"></script>
<script src="/vendor/GLTFLoader.js"></script>
<script>
var qs=new URLSearchParams(location.search);
var CLIP=qs.get('clip')||'idle', ANGLE=+(qs.get('angle')||18);
var rn=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true,preserveDrawingBuffer:true});
rn.setPixelRatio(1); rn.setSize(480,600,false);
if('outputColorSpace' in rn) rn.outputColorSpace=THREE.SRGBColorSpace;
var sc=new THREE.Scene(); sc.background=new THREE.Color(0xe8e8e0);
var cam=new THREE.PerspectiveCamera(28,480/600,0.05,100);
sc.add(new THREE.AmbientLight(0xffffff,0.75));
sc.add(new THREE.HemisphereLight(0xffffff,0x888888,0.45));
var k=new THREE.DirectionalLight(0xffffff,0.7); k.position.set(2,5,3); sc.add(k);
var mixer=null, dur=1, root=null;
function fixMat(o){
  if(!o.isMesh||!o.material) return;
  o.frustumCulled=false;
  function f(m){
    var mat=new THREE.MeshLambertMaterial({
      color:m.color?m.color.clone():new THREE.Color(0xffffff),
      emissive:m.emissive?m.emissive.clone():new THREE.Color(0x000000),
      emissiveIntensity:(m.emissiveIntensity==null?1:m.emissiveIntensity),
      flatShading:true, side:THREE.DoubleSide
    });
    return mat;
  }
  o.material=Array.isArray(o.material)?o.material.map(f):f(o.material);
}
window.READY=false; window.DUR=1;
new THREE.GLTFLoader().load('/model.glb', function(g){
  root=g.scene; sc.add(root);
  root.traverse(fixMat);
  mixer=new THREE.AnimationMixer(root);
  var clips=g.animations||[];
  var clip=clips.find(c=>c.name===CLIP||c.name.indexOf(CLIP)>=0)||clips[0];
  if(clip){ mixer.clipAction(clip).play(); dur=Math.max(clip.duration,0.3); }
  window.DUR=dur; window.READY=true;
});
var clock=new THREE.Clock();
function frame(){
  var dt=clock.getDelta(); if(mixer) mixer.update(dt);
  if(root){
    var box=new THREE.Box3().setFromObject(root);
    var c=box.getCenter(new THREE.Vector3());
    var s=box.getSize(new THREE.Vector3());
    var r=Math.max(s.x,s.y)*1.55;
    var a=ANGLE*Math.PI/180;
    cam.position.set(c.x+Math.sin(a)*r, c.y+r*0.08, c.z+Math.cos(a)*r);
    cam.lookAt(c.x,c.y,c.z);
  }
  rn.render(sc,cam); requestAnimationFrame(frame);
}
frame();
window.SEEK=function(t){ if(mixer){ mixer.setTime(t); } };
</script></body></html>
"""


def _find_chromium():
    for pat in (
        "/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell",
        "/opt/pw-browsers/chromium-*/chrome-linux/chrome",
    ):
        m = glob.glob(pat)
        if m:
            return m[0]
    return None


def _serve():
    # Serve HTML + vendor + model from a temp dir layout
    work = OUT / "_serve"
    work.mkdir(parents=True, exist_ok=True)
    (work / "index.html").write_text(HTML)
    vend = work / "vendor"
    if not vend.exists():
        vend.symlink_to(VENDOR)
    # Ensure GLTFLoader exists next to three
    gltf_src = None
    for p in [
        VENDOR / "GLTFLoader.js",
        REPO / "node_modules/three/examples/js/loaders/GLTFLoader.js",
        Path("/usr/share/javascript/three/examples/js/loaders/GLTFLoader.js"),
    ]:
        if p.is_file():
            gltf_src = p
            break
    if gltf_src and not (vend / "GLTFLoader.js").exists() and vend.is_symlink():
        pass  # vendor dir symlink — check if file present
    if gltf_src and not (VENDOR / "GLTFLoader.js").is_file():
        # copy loader into serve vendor overlay
        real_vend = work / "vendor_real"
        real_vend.mkdir(exist_ok=True)
        for f in VENDOR.iterdir():
            if f.is_file():
                (real_vend / f.name).write_bytes(f.read_bytes())
        (real_vend / "GLTFLoader.js").write_bytes(gltf_src.read_bytes())
        if vend.exists() or vend.is_symlink():
            vend.unlink()
        vend.symlink_to(real_vend)
    model = work / "model.glb"
    if model.exists() or model.is_symlink():
        model.unlink()
    model.symlink_to(GLB)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(work))
    httpd = http.server.HTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


async def render_clip(page, port, clip, nframes=36):
    url = f"http://127.0.0.1:{port}/index.html?clip={clip}&angle=18"
    await page.goto(url, wait_until="load")
    await page.wait_for_function("window.READY===true", timeout=20000)
    dur = await page.evaluate("window.DUR")
    frames_dir = OUT / f"_{clip}_frames"
    frames_dir.mkdir(exist_ok=True)
    for i in range(nframes):
        t = (i / nframes) * dur
        await page.evaluate("(t)=>window.SEEK(t)", t)
        await page.wait_for_timeout(40)
        fp = frames_dir / f"f{i:03d}.png"
        await page.screenshot(path=str(fp))
    mp4 = OUT / f"{clip}.mp4"
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-framerate", str(max(1, int(nframes / max(dur, 0.3)))),
            "-i", str(frames_dir / "f%03d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(mp4),
        ]
    )
    print("MP4", mp4, flush=True)
    return mp4


async def main():
    # Ensure GLTFLoader in vendor
    loader_dst = VENDOR / "GLTFLoader.js"
    if not loader_dst.is_file():
        # fetch from unpkg-style local three examples if needed
        candidates = list(REPO.glob("**/GLTFLoader.js"))
        if candidates:
            loader_dst.write_bytes(candidates[0].read_bytes())
        else:
            import urllib.request
            url = "https://cdn.jsdelivr.net/npm/three@0.144.0/examples/js/loaders/GLTFLoader.js"
            urllib.request.urlretrieve(url, loader_dst)
            print("downloaded GLTFLoader", flush=True)

    httpd, port = _serve()
    exe = _find_chromium()
    launch = dict(
        args=[
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
        ]
    )
    if exe:
        launch["executable_path"] = exe
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch)
        page = await b.new_page(viewport={"width": 480, "height": 600})
        for clip in CLIPS:
            await render_clip(page, port, clip)
        await b.close()
    httpd.shutdown()
    print("DONE", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
