#!/usr/bin/env python3
"""Render MP4 turntables for the Hunters Origins-style Nyra unit showcase.

Outputs clean, UI-free vertical mobile videos using the same Three.js page that
ships in the repo. Run from the repo root:

  python3 tools/render_unit_showcase_mp4.py
"""
import asyncio
import functools
import glob
import http.server
import math
import os
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

from playwright.async_api import async_playwright


REPO = Path(__file__).resolve().parents[1]
PAGE = "poc/hunters-origins-unit.html"
OUTDIR = Path(os.environ.get("UNIT_SHOWCASE_OUTDIR", "/opt/cursor/artifacts"))
SIZE = {"width": 540, "height": 960}
FPS = 24

CLIPS = [
    {
        "name": "nyra-shadowhunt-idle.mp4",
        "pose": "idle",
        "duration": 6.0,
        "yaw0": 0.34,
        "yaw1": 0.34 + math.tau,
        "pitch": 0.31,
        "dist": 18.6,
        "fx": True,
    },
    {
        "name": "nyra-shadowhunt-combat.mp4",
        "pose": "combat",
        "duration": 5.0,
        "yaw0": -0.18,
        "yaw1": 1.72,
        "pitch": 0.34,
        "dist": 17.1,
        "fx": True,
    },
]


def _serve(directory: str):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=directory)
    httpd = http.server.HTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def _chromium():
    for pat in (
        "/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell",
        "/opt/pw-browsers/chromium-*/chrome-linux/chrome",
    ):
        matches = glob.glob(pat)
        if matches:
            return matches[0]
    for name in ("google-chrome", "chromium-browser", "chromium"):
        found = shutil.which(name)
        if found:
            return found
    return None


def smoothstep(t: float) -> float:
    return t * t * (3 - 2 * t)


def encode_mp4(frame_glob: str, fps: int, outpath: Path):
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-framerate",
        str(fps),
        "-i",
        frame_glob,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(outpath),
    ]
    subprocess.run(cmd, check=True)


async def render_clip(page, base_url: str, spec: dict, outdir: Path):
    with tempfile.TemporaryDirectory(prefix="nyra-frames-") as tmpdir:
        tmp = Path(tmpdir)
        url = (
            f"{base_url}/{PAGE}"
            f"?chrome=0&autorun=0&spin=0"
            f"&pose={spec['pose']}&fx={'1' if spec['fx'] else '0'}"
            f"&yaw={spec['yaw0']}&pitch={spec['pitch']}&dist={spec['dist']}"
        )
        await page.goto(url, wait_until="load")
        await page.wait_for_function("!!window.__unitView", timeout=20000)
        frames = max(1, int(round(spec["duration"] * FPS)))
        for i in range(frames):
            t_norm = 0 if frames == 1 else i / (frames - 1)
            t_eased = smoothstep(t_norm)
            yaw = spec["yaw0"] + (spec["yaw1"] - spec["yaw0"]) * t_eased
            dist = spec["dist"] - (0.35 * math.sin(t_norm * math.pi) if spec["pose"] == "combat" else 0.0)
            clip_t = spec["duration"] * t_norm
            await page.evaluate(
                """(cfg) => {
                  const v = window.__unitView;
                  v.setPose(cfg.pose);
                  v.setFx(cfg.fx);
                  v.setSpin(false);
                  v.setOrbit({ yaw: cfg.yaw, pitch: cfg.pitch, dist: cfg.dist });
                  v.renderAt(cfg.time);
                }""",
                {
                    "pose": spec["pose"],
                    "fx": spec["fx"],
                    "yaw": yaw,
                    "pitch": spec["pitch"],
                    "dist": dist,
                    "time": clip_t,
                },
            )
            await page.wait_for_timeout(8)
            await page.screenshot(path=str(tmp / f"frame_{i:04d}.png"))

        outpath = outdir / spec["name"]
        encode_mp4(str(tmp / "frame_%04d.png"), FPS, outpath)
        print(f"wrote {outpath}")


async def main():
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg not found in PATH")

    OUTDIR.mkdir(parents=True, exist_ok=True)
    httpd, port = _serve(str(REPO))
    launch = {
        "args": [
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
        ]
    }
    exe = _chromium()
    if exe:
        launch["executable_path"] = exe

    async with async_playwright() as p:
        browser = await p.chromium.launch(**launch)
        page = await browser.new_page(viewport=SIZE, device_scale_factor=1)
        base_url = f"http://127.0.0.1:{port}"
        try:
            for clip in CLIPS:
                await render_clip(page, base_url, clip, OUTDIR)
        finally:
            await browser.close()
            httpd.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
