#!/usr/bin/env python3
"""Make a Meshy/PBR GLB matte: zero metalness, high roughness.

  python3 tools/.meshy-work/matte_glb.py assets/models/meshy/purple_elf_meshy.glb

Keeps base color / emissive / normals. Rewrites the metallicRoughness map
(B=metalness→0, G=roughness≥0.86) and sets metallicFactor=0.
"""
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("glb", type=Path)
    ap.add_argument("--backup", action="store_true", default=True, help="write <stem>_pbr.glb once")
    ap.add_argument("--no-backup", action="store_false", dest="backup")
    ap.add_argument("--roughness-min", type=int, default=220, help="min G channel 0-255")
    args = ap.parse_args()

    try:
        from pygltflib import GLTF2
        from PIL import Image
        import numpy as np
    except ImportError:
        import subprocess

        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-q", "pygltflib", "pillow", "numpy"]
        )
        from pygltflib import GLTF2
        from PIL import Image
        import numpy as np

    src: Path = args.glb
    if not src.exists():
        sys.exit(f"missing {src}")
    bak = src.with_name(src.stem + "_pbr" + src.suffix)
    if args.backup and not bak.exists():
        bak.write_bytes(src.read_bytes())
        print(f"backup -> {bak}")

    load_path = bak if bak.exists() else src
    g = GLTF2().load(str(load_path))
    blob = g.binary_blob()
    if not g.materials:
        sys.exit("no materials")

    changed = False
    for mi, mat in enumerate(g.materials):
        pbr = mat.pbrMetallicRoughness
        if not pbr:
            continue
        pbr.metallicFactor = 0.0
        pbr.roughnessFactor = 1.0
        if not pbr.metallicRoughnessTexture:
            print(f"mat {mi}: factors only (no MR texture)")
            changed = True
            continue

        tex = g.textures[pbr.metallicRoughnessTexture.index]
        img = g.images[tex.source]
        bv = g.bufferViews[img.bufferView]
        data = blob[bv.byteOffset : bv.byteOffset + bv.byteLength]
        im = Image.open(io.BytesIO(data)).convert("RGBA")
        arr = np.array(im)
        arr[:, :, 2] = 0  # metalness
        arr[:, :, 1] = np.maximum(arr[:, :, 1], args.roughness_min)
        buf = io.BytesIO()
        Image.fromarray(arr).convert("RGB").save(buf, format="JPEG", quality=92)
        new_jpeg = buf.getvalue()

        old_start, old_len = bv.byteOffset, bv.byteLength
        delta = len(new_jpeg) - old_len
        blob = blob[:old_start] + new_jpeg + blob[old_start + old_len :]
        bv.byteLength = len(new_jpeg)
        for other in g.bufferViews:
            if other.byteOffset > old_start:
                other.byteOffset += delta
        print(f"mat {mi}: rewrote MR map ({old_len} -> {len(new_jpeg)} bytes)")
        changed = True

    if not changed:
        sys.exit("nothing to change")

    while len(blob) % 4:
        blob += b"\x00"
    g.buffers[0].byteLength = len(blob)
    g.set_binary_blob(blob)
    g.save(str(src))
    print(f"wrote matte {src} ({src.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
