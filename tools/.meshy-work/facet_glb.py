#!/usr/bin/env python3
"""Force the faceted polygon look on a GLB (flat shading / hard edges).

Duplicates verts per triangle and writes face normals — same idea as
LPF.facet() in the character forge. Also forces matte PBR factors.

  python3 tools/.meshy-work/facet_glb.py assets/models/meshy/purple_elf_meshy.glb
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("glb", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=None)
    ap.add_argument("--backup", action="store_true", default=True)
    args = ap.parse_args()

    try:
        import trimesh
        from pygltflib import GLTF2
    except ImportError:
        import subprocess

        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-q", "trimesh", "pygltflib"]
        )
        import trimesh
        from pygltflib import GLTF2

    src: Path = args.glb
    out: Path = args.out or src
    if not src.exists():
        sys.exit(f"missing {src}")

    if args.backup:
        bak = src.with_name(src.stem + "_presmooth" + src.suffix)
        if not bak.exists() and src.resolve() == out.resolve():
            bak.write_bytes(src.read_bytes())
            print(f"backup -> {bak}")

    scene = trimesh.load(str(src), force="scene")
    if isinstance(scene, trimesh.Trimesh):
        meshes = [scene]
    else:
        meshes = [g for g in scene.geometry.values() if isinstance(g, trimesh.Trimesh)]
    if not meshes:
        sys.exit("no triangle meshes")

    faceted = []
    for m in meshes:
        # Drop vertex normals so export recomputes; then explode to face normals
        m = m.copy()
        # Non-indexed face verts = flat shading
        flat = m.submesh(
            [list(range(len(m.faces)))], append=True, repair=False
        ) if False else m
        # trimesh: unmerge vertices by face → unique verts per triangle
        flat = flat.copy()
        flat.unmerge_vertices()  # splits shared verts
        # Face normals duplicated onto vertices
        flat.vertex_normals  # force compute from faces after unmerge
        # Explicitly set vertex normals = face normals
        import numpy as np

        fn = flat.face_normals  # (F, 3)
        vn = np.repeat(fn, 3, axis=0)  # (F*3, 3) matching unmerged verts order
        # After unmerge_vertices, faces are sequential 0..n
        flat.vertex_normals = vn
        # Matte visual: if visual has material, leave texture; engine uses normals for facet
        faceted.append(flat)
        print(f"faceted mesh: {len(flat.faces)} tris, {len(flat.vertices)} verts")

    if len(faceted) == 1:
        result = faceted[0]
    else:
        result = trimesh.util.concatenate(faceted)

    # Export GLB via trimesh
    result.export(str(out), file_type="glb")
    print(f"wrote faceted {out} ({out.stat().st_size} bytes)")

    # Ensure materials are matte if pygltflib can touch factors
    g = GLTF2().load(str(out))
    for mat in g.materials or []:
        pbr = mat.pbrMetallicRoughness
        if not pbr:
            continue
        pbr.metallicFactor = 0.0
        pbr.roughnessFactor = 1.0
        pbr.metallicRoughnessTexture = None
        mat.normalTexture = None  # smooth normal maps fight flat shading
    g.save(str(out))
    print("matte factors applied")


if __name__ == "__main__":
    main()
