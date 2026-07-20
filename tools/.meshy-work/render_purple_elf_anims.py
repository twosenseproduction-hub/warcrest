#!/usr/bin/env python3
"""Render Meshy purple-elf anim GLBs to GIF + MP4 previews."""
from __future__ import annotations

import asyncio
import functools
import glob
import http.server
import io
import os
import subprocess
import threading
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright

REPO = Path(__file__).resolve().parents[2]
ANIM_DIR = REPO / "assets" / "models" / "meshy" / "anims"
OUT = Path("/opt/cursor/artifacts/purple_elf_anims")
OUT.mkdir(parents=True, exist_ok=True)

HTML = r"""<!doctype html><html><head><meta charset=utf-8>
<style>html,body{margin:0;background:#1a1f28}</style></head><body>
<canvas id=c width=480 height=600></canvas>
<script src="/vendor/three.min.js"></script>
<script src="/vendor/GLTFLoader.js"></script>
<script>
var qs=new URLSearchParams(location.search), ANGLE=+(qs.get('angle')||25);
var rn=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true,preserveDrawingBuffer:true,alpha:false});
rn.setPixelRatio(1); rn.setSize(480,600,false);
if('outputColorSpace' in rn) rn.outputColorSpace=THREE.SRGBColorSpace;
else if(THREE.sRGBEncoding&&'outputEncoding' in rn) rn.outputEncoding=THREE.sRGBEncoding;
var sc=new THREE.Scene();sc.background=new THREE.Color(0x1a1f28);
var cam=new THREE.PerspectiveCamera(28,480/600,0.05,100);
sc.add(new THREE.AmbientLight(0xd0d8e4,0.7));
sc.add(new THREE.HemisphereLight(0xc0d0e8,0x3a3428,0.55));
var k=new THREE.DirectionalLight(0xfff2e0,0.75);k.position.set(2.5,5,3.5);sc.add(k);
var mixer=null,dur=1,root=null,box=new THREE.Box3(),ctr=new THREE.Vector3(),sz=new THREE.Vector3();
function fixMat(o){
  if(!o.isMesh||!o.material)return;
  o.frustumCulled=false;
  function f(m){
    // Keep maps; force matte + flat for polygon read. Skinning works on Lambert.
    var mat=new THREE.MeshLambertMaterial({
      color:m.color?m.color.clone():new THREE.Color(0xffffff),
      map:m.map||null,
      emissive:m.emissive?m.emissive.clone():new THREE.Color(0x000000),
      emissiveMap:m.emissiveMap||null,
      emissiveIntensity:(m.emissiveIntensity==null?1:m.emissiveIntensity),
      flatShading:true,
      transparent:!!m.transparent,
      opacity:m.opacity==null?1:m.opacity,
      side:THREE.DoubleSide
    });
    if(mat.map){
      if('colorSpace' in mat.map) mat.map.colorSpace=THREE.SRGBColorSpace;
      else if(THREE.sRGBEncoding) mat.map.encoding=THREE.sRGBEncoding;
    }
    return mat;
  }
  o.material=Array.isArray(o.material)?o.material.map(f):f(o.material);
}
new THREE.GLTFLoader().load('/'+qs.get('glb'),function(g){
  root=g.scene; root.traverse(fixMat); sc.add(root);
  // Bind-pose framing (model is ~1.7m tall, feet at y=0)
  box.setFromObject(root); box.getCenter(ctr); box.getSize(sz);
  window.BIND={c:ctr.toArray(), s:sz.toArray()};
  var want=(qs.get('clip')||'').toLowerCase();
  var clip=null;
  if(g.animations&&g.animations.length){
    if(want){
      clip=g.animations.find(function(c){ return (c.name||'').toLowerCase()===want; })
        || g.animations.find(function(c){ return (c.name||'').toLowerCase().indexOf(want)>=0; });
    }
    clip=clip||g.animations[0];
  }
  mixer=new THREE.AnimationMixer(root);
  if(clip){ dur=Math.max(clip.duration,0.4); var a=mixer.clipAction(clip); a.reset(); a.play(); }
  // Warm skeleton once at t=0
  if(mixer){ mixer.setTime(0); root.updateMatrixWorld(true); }
  window.CLIP=clip?clip.name:'none'; window.DUR=dur; window.READY=1;
},undefined,function(e){ window.ERR=String(e&&e.message||e); window.READY=1; });
window.shot=function(t){
  if(mixer){ mixer.setTime(t); }
  root.updateMatrixWorld(true);
  // Prefer pelvis/hips node for tracking root motion; else whole scene
  var track=null;
  root.traverse(function(o){ if(track)return; var n=(o.name||'').toLowerCase(); if(/hip|pelvis|root|spine/.test(n)&&o.isBone) track=o; });
  var look=new THREE.Vector3();
  if(track){ track.getWorldPosition(look); look.y=Math.max(look.y,0.9); }
  else { box.setFromObject(root); box.getCenter(look); if(!isFinite(look.y)||look.y<0.2) look.set(0,0.9,0); }
  var a=ANGLE*Math.PI/180, dist=3.4;
  cam.position.set(look.x+Math.sin(a)*dist, 1.15, look.z+Math.cos(a)*dist);
  cam.lookAt(look.x, 0.95, look.z);
  rn.render(sc,cam);
};
</script></body></html>
"""

CLIPS = [
    "idle",
    "walk",
    "run",
    "attack",
    "attack_alt",
    "aim",
    "draw_shoot",
    "hit",
    "walk_aimed",
]

# Multi-clip Human Archer FREE pack (one GLB, select by ?clip=)
PACK_GLB = REPO / "assets" / "models" / "meshy" / "purple_elf_meshy_pack_anim.glb"
PACK_CLIPS = [
    "idle",
    "bow_idle",
    "bow_idle_alt",
    "attack_load",
    "attack_hold",
    "attack_release",
    "walk",
    "run",
]
PACK_OUT = Path("/opt/cursor/artifacts/purple_elf_pack_anims")


def _serve(d: Path):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(d))
    s = http.server.HTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, s.server_address[1]


def _chrom():
    for pattern in (
        "/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell",
        "/opt/pw-browsers/chromium-*/chrome-linux/chrome",
        str(Path.home() / ".cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell"),
        str(Path.home() / ".cache/ms-playwright/chromium-*/chrome-linux64/chrome"),
    ):
        m = glob.glob(pattern)
        if m:
            return sorted(m)[-1]
    return None


def frames_to_mp4(frames: list[Image.Image], dest: Path, fps: float) -> None:
    tmp = dest.with_suffix(".frames")
    tmp.mkdir(exist_ok=True)
    for i, fr in enumerate(frames):
        fr.save(tmp / f"f{i:03d}.png")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            f"{fps:.3f}",
            "-i",
            str(tmp / "f%03d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "20",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for p in tmp.glob("*.png"):
        p.unlink()
    tmp.rmdir()


async def main() -> None:
    html_path = REPO / "_purple_elf_anim_preview.html"
    html_path.write_text(HTML)
    server, port = _serve(REPO)
    launch = {
        "args": [
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
        ]
    }
    exe = _chrom()
    if exe:
        launch["executable_path"] = exe
        print("chromium", exe)

    nfr = 36
    mode = (os.environ.get("MESHY_RENDER_MODE") or "library").strip().lower()
    jobs: list[tuple[Path, str, Path]] = []
    if mode in ("library", "all"):
        for name in CLIPS:
            glb = ANIM_DIR / f"purple_elf_meshy_{name}.glb"
            if glb.exists():
                jobs.append((glb, name, OUT))
    if mode in ("pack", "all"):
        PACK_OUT.mkdir(parents=True, exist_ok=True)
        if PACK_GLB.exists():
            for name in PACK_CLIPS:
                jobs.append((PACK_GLB, name, PACK_OUT))
        else:
            print("missing pack", PACK_GLB)

    async with async_playwright() as p:
        browser = await p.chromium.launch(**launch)
        page = await browser.new_page(viewport={"width": 480, "height": 600})
        for glb, name, out_dir in jobs:
            out_dir.mkdir(parents=True, exist_ok=True)
            rel = glb.relative_to(REPO).as_posix()
            url = (
                f"http://127.0.0.1:{port}/_purple_elf_anim_preview.html"
                f"?glb={rel}&clip={name}&angle=28"
            )
            print("render", name, "from", rel, "…", flush=True)
            await page.goto(url, wait_until="load")
            await page.wait_for_function("window.READY", timeout=60000)
            err = await page.evaluate("window.ERR||null")
            if err:
                print("  ERR", err)
                continue
            clip_name = await page.evaluate("window.CLIP")
            dur = float(await page.evaluate("window.DUR") or 1.0)
            print(f"  clip={clip_name!r} dur={dur:.2f}s", flush=True)
            frames = []
            for i in range(nfr):
                t = dur * (i / nfr)
                await page.evaluate("(t)=>window.shot(t)", t)
                await page.wait_for_timeout(20)
                png = await page.screenshot()
                frames.append(Image.open(io.BytesIO(png)).convert("RGB"))
            gif = out_dir / f"{name}.gif"
            frame_ms = max(40, int(dur / nfr * 1000))
            frames[0].save(out_dir / f"{name}_frame0.png")
            frames[0].save(
                gif,
                save_all=True,
                append_images=frames[1:],
                duration=frame_ms,
                loop=0,
                optimize=True,
            )
            mp4 = out_dir / f"{name}.mp4"
            fps = nfr / dur
            frames_to_mp4(frames, mp4, fps)
            print(f"  wrote {gif} {mp4.name}", flush=True)
        await browser.close()
    server.shutdown()
    html_path.unlink(missing_ok=True)
    print("DONE mode=", mode)


if __name__ == "__main__":
    asyncio.run(main())
