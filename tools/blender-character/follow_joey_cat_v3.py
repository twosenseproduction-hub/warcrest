#!/usr/bin/env python3
"""Recreate Joey Carlino's Bizzo cat from the beginner modeling tutorial.

Video: https://www.youtube.com/watch?v=O6HQhs-gk50
Official T-pose ref: assets/models/blender/joey_cat_refs/ref_00_Ha3JhPE.png
Storyboard chapters: assets/models/blender/joey_bizzo_study/

Follows Joey's separate-object workflow (not a single Skin blob):
  Head → Ears/Hair/Cheeks → Face cards → Coat+Solidify → Hands → Shoes → Color → Join

  ./tools/blender-monitor/bin/run-job.sh --name bizzo-v3 \\
    tools/blender-character/follow_joey_cat_v3.py
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

REPO = Path("/workspace")
OUT_DIR = REPO / "assets/models/blender"
REF_DIR = OUT_DIR / "joey_cat_refs"
DEMO = OUT_DIR / "bizzo_demo"
ART = Path("/opt/cursor/artifacts/blender_joey_bizzo")
OUT_BLEND = OUT_DIR / "bizzo_cat_v3.blend"
OUT_GLB = OUT_DIR / "bizzo_cat_v3.glb"

sys.path.insert(0, str(REPO / "tools/blender-monitor/lib"))
from monitor_preview import Monitor  # noqa: E402

# Palette tuned to Joey's finished Imgur T-pose (sRGB / Standard)
PAL = {
    "fur": (0.86, 0.48, 0.14),
    "coat": (0.62, 0.42, 0.82),
    "pink": (0.95, 0.45, 0.72),
    "muzzle": (0.97, 0.97, 0.97),
    "eye_white": (1.0, 1.0, 1.0),
    "pupil": (0.02, 0.02, 0.02),
    "brow": (0.18, 0.08, 0.04),
    "sole": (0.96, 0.96, 0.96),
    "mouth": (0.05, 0.05, 0.05),
}

MON: Monitor | None = None
HEIGHT = 1.85  # target standing height after normalize


def log(msg: str):
    print(f"[bizzo-v3] {msg}", flush=True)
    if MON is not None:
        MON.log(msg)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = 1080
    sc.render.resolution_y = 1350
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new("World")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
    bg.inputs[1].default_value = 1.0
    for name, loc, energy, size in (
        ("Key", (1.6, 3.4, 3.2), 200, 3.2),
        ("Fill", (-2.4, 2.2, 2.0), 80, 4.0),
        ("Rim", (0.3, -2.4, 2.4), 45, 2.4),
    ):
        bpy.ops.object.light_add(type="AREA", location=loc)
        L = bpy.context.active_object
        L.name = name
        L.data.energy = energy
        L.data.size = size


def mat(name, rgb, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = 0.08
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = (*rgb, 1.0)
    return m


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    return obj


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def set_mat(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def apply_tr(obj, loc=False, rot=False, scale=True):
    active(obj)
    bpy.ops.object.transform_apply(location=loc, rotation=rot, scale=scale)


def add_subsurf(obj, levels=2):
    m = obj.modifiers.new("Subsurf", "SUBSURF")
    m.levels = levels
    m.render_levels = levels
    smooth(obj)
    return m


def apply_mods(obj):
    active(obj)
    for mod in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            log(f"mod fail {obj.name} {mod.name}: {e}")


def place(obj, loc, rot=None, scale=None):
    obj.location = loc
    if rot is not None:
        obj.rotation_euler = Euler(rot, "XYZ") if not isinstance(rot, Euler) else rot
    if scale is not None:
        obj.scale = scale
    apply_tr(obj, scale=True)
    if rot is not None:
        obj.rotation_euler = Euler(rot, "XYZ") if not isinstance(rot, Euler) else rot
        apply_tr(obj, rot=True, scale=False)


def make_cube(name, material, loc, scale, rot=None, sub=2):
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    o = bpy.context.active_object
    o.name = name
    set_mat(o, material)
    place(o, loc, rot=rot, scale=scale)
    if sub:
        add_subsurf(o, levels=sub)
    return o


def make_sphere(name, material, loc, scale, segs=24, rings=16, sub=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=0.5)
    o = bpy.context.active_object
    o.name = name
    set_mat(o, material)
    place(o, loc, scale=scale)
    if sub:
        add_subsurf(o, levels=sub)
    else:
        smooth(o)
    return o


def make_cyl(name, material, loc, radius, depth, rot=None, scale=None, verts=16, sub=2):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth)
    o = bpy.context.active_object
    o.name = name
    set_mat(o, material)
    place(o, loc, rot=rot, scale=scale or (1, 1, 1))
    if sub:
        add_subsurf(o, levels=sub)
    return o


def make_cone(name, material, loc, r1, depth, rot=None, scale=None, verts=8, sub=2):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=0.008, depth=depth)
    o = bpy.context.active_object
    o.name = name
    set_mat(o, material)
    place(o, loc, rot=rot, scale=scale or (1, 1, 1))
    if sub:
        add_subsurf(o, levels=sub)
    return o


def widen_bottom(obj, z_cut, factor_xy=1.2):
    """Widen verts below local z_cut (mesh origin-centered after place/apply)."""
    for v in obj.data.vertices:
        if v.co.z < z_cut:
            v.co.x *= factor_xy
            v.co.y *= factor_xy * 0.95
    obj.data.update()


def build_head(mats, parts):
    """Joey head chapter: broad orange head + ears, hair, cheeks, face cards."""
    # Wide chunky head (front = +Y) — slightly diamond read via cheek spikes
    parts.append(make_sphere("Head", mats["fur"], (0, 0, 1.55), (0.68, 0.56, 0.58), sub=2))

    # Tall triangular ears with pink cups
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_cone(
                f"Ear_{side}",
                mats["fur"],
                (0.30 * sx, -0.06, 1.95),
                0.17,
                0.36,
                rot=(math.radians(-22), 0, math.radians(32 * sx)),
                scale=(1.15, 0.32, 1.05),
                sub=2,
            )
        )
        parts.append(
            make_cone(
                f"EarIn_{side}",
                mats["pink"],
                (0.30 * sx, 0.00, 1.90),
                0.095,
                0.22,
                rot=(math.radians(-12), 0, math.radians(32 * sx)),
                scale=(1.0, 0.18, 1.0),
                sub=2,
            )
        )

    # Pointed hair tufts leaning viewer's left (−X), not round blobs
    for i, (x, y, z, r1, depth, tilt_y, tilt_x) in enumerate(
        (
            (-0.10, -0.02, 1.98, 0.12, 0.34, -12, -8),
            (-0.26, 0.00, 1.92, 0.11, 0.30, -22, -4),
            (0.06, -0.01, 1.96, 0.10, 0.28, 6, -10),
        )
    ):
        parts.append(
            make_cone(
                f"Hair_{i}",
                mats["fur"],
                (x, y, z),
                r1,
                depth,
                rot=(math.radians(tilt_x), math.radians(tilt_y), 0),
                scale=(1.0, 0.7, 1.0),
                verts=8,
                sub=2,
            )
        )

    # Long sharp cheek fur spikes (Joey signature)
    for sx, side in ((-1, "L"), (1, "R")):
        for i, (dz, dy, length, tilt) in enumerate(
            (
                (0.12, 0.06, 0.28, 22),
                (0.00, 0.04, 0.34, 0),
                (-0.12, 0.00, 0.26, -20),
            )
        ):
            parts.append(
                make_cone(
                    f"Cheek_{side}_{i}",
                    mats["fur"],
                    (0.42 * sx, 0.06 + dy, 1.50 + dz),
                    0.055,
                    length,
                    rot=(math.radians(tilt), math.radians(90 * sx), 0),
                    scale=(1.0, 0.42, 1.0),
                    verts=7,
                    sub=1,
                )
            )

    # White pill muzzle — lower face
    parts.append(make_sphere("Muzzle", mats["muzzle"], (0, 0.24, 1.28), (0.42, 0.30, 0.24), sub=2))
    parts.append(make_sphere("Nose", mats["pink"], (0, 0.42, 1.34), (0.07, 0.055, 0.055), sub=1))

    # Large vertical oval eyes (official ref)
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_sphere(
                f"Eye_{side}",
                mats["eye_white"],
                (0.16 * sx, 0.32, 1.56),
                (0.14, 0.07, 0.20),
                sub=1,
            )
        )
        parts.append(
            make_sphere(
                f"Pupil_{side}",
                mats["pupil"],
                (0.16 * sx, 0.38, 1.52),
                (0.05, 0.028, 0.05),
                sub=0,
            )
        )

    # Thick grumpy brows — angled down toward center, sit on eyes
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_cube(
                f"Brow_{side}",
                mats["brow"],
                (0.17 * sx, 0.40, 1.72),
                (0.20, 0.07, 0.085),
                rot=(math.radians(-12), 0, math.radians(-42 * sx)),
                sub=1,
            )
        )

    # Small smirk on muzzle (offset right)
    parts.append(
        make_cube(
            "Mouth",
            mats["mouth"],
            (0.08, 0.40, 1.16),
            (0.09, 0.014, 0.012),
            rot=(0, 0, math.radians(-22)),
            sub=0,
        )
    )

    # Thin whiskers
    for sx, side in ((-1, "L"), (1, "R")):
        for i, dz in enumerate((0.05, 0.0, -0.05)):
            parts.append(
                make_cyl(
                    f"Whisker_{side}_{i}",
                    mats["mouth"],
                    (0.26 * sx, 0.34, 1.26 + dz),
                    0.005,
                    0.20,
                    rot=(0, math.radians(90 * sx), math.radians(12 * (1 - i))),
                    sub=0,
                )
            )


def build_coat(mats, parts):
    """Joey coat chapter: one flared sweater (no stacked torso blobs) + sleeves."""
    # Single tall coat body covering chest→hem (shorts live under hem, not a 2nd sphere)
    coat = make_cube("Coat", mats["coat"], (0, 0.02, 0.88), (0.50, 0.42, 0.72), sub=2)
    widen_bottom(coat, z_cut=-0.05, factor_xy=1.38)
    # Soften upper shoulders slightly narrower for bell read
    for v in coat.data.vertices:
        if v.co.z > 0.18:
            v.co.x *= 0.92
            v.co.y *= 0.94
    coat.data.update()
    sol = coat.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 0.035
    sol.offset = 1.0
    parts.append(coat)

    # Tall turtleneck ring under muzzle
    collar = make_cyl(
        "Collar",
        mats["coat"],
        (0, 0.04, 1.26),
        0.18,
        0.26,
        scale=(1.55, 1.30, 1.0),
        sub=2,
    )
    for v in collar.data.vertices:
        if v.co.z > 0.02:
            v.co.x *= 1.32
            v.co.y *= 1.20
        else:
            v.co.x *= 0.88
            v.co.y *= 0.88
    collar.data.update()
    parts.append(collar)

    # Thick T-pose sleeves planted into coat sides
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_cyl(
                f"Sleeve_{side}",
                mats["coat"],
                (0.52 * sx, 0.04, 0.98),
                0.13,
                0.70,
                rot=(0, math.radians(90), 0),
                scale=(1.25, 1.25, 1.0),
                sub=2,
            )
        )
        parts.append(
            make_cyl(
                f"Cuff_{side}",
                mats["coat"],
                (0.90 * sx, 0.04, 0.98),
                0.145,
                0.12,
                rot=(0, math.radians(90), 0),
                sub=2,
            )
        )


def build_hands(mats, parts):
    """Joey hands: palm sphere + finger capsules beyond cuffs."""
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_sphere(f"Palm_{side}", mats["fur"], (1.08 * sx, 0.04, 0.98), (0.14, 0.12, 0.12), sub=2)
        )
        for i, (dy, dz, length, yaw) in enumerate(
            (
                (0.07, 0.04, 0.13, 26),
                (0.00, 0.01, 0.15, 0),
                (-0.06, -0.02, 0.13, -20),
            )
        ):
            parts.append(
                make_cyl(
                    f"Finger_{side}_{i}",
                    mats["fur"],
                    (1.18 * sx, 0.04 + dy, 0.98 + dz),
                    0.036,
                    length,
                    rot=(0, math.radians(90 * sx), math.radians(yaw * sx)),
                    sub=2,
                )
            )


def build_legs_shoes(mats, parts):
    """Short purple hem + thick bridging legs + ankle/toe boots (Joey shoes)."""
    # Shorts/hem — sits inside flared coat so silhouette stays one piece
    parts.append(make_cube("Shorts", mats["coat"], (0, 0.02, 0.48), (0.46, 0.36, 0.18), sub=2))

    for sx, side in ((-1, "L"), (1, "R")):
        # Thick fur legs that OVERLAP coat hem AND boot tops (no floating knees)
        parts.append(
            make_cyl(
                f"Leg_{side}",
                mats["fur"],
                (0.17 * sx, 0.04, 0.34),
                0.11,
                0.36,
                scale=(1.15, 1.15, 1.0),
                sub=2,
            )
        )

        # Ankle bulb
        parts.append(
            make_sphere(
                f"Ankle_{side}",
                mats["coat"],
                (0.17 * sx, 0.06, 0.18),
                (0.26, 0.24, 0.22),
                sub=2,
            )
        )
        # Forward toe box (+Y)
        parts.append(
            make_cube(
                f"BootToe_{side}",
                mats["coat"],
                (0.17 * sx, 0.22, 0.12),
                (0.26, 0.36, 0.20),
                sub=2,
            )
        )
        # Thick white sole
        parts.append(
            make_cube(
                f"Sole_{side}",
                mats["sole"],
                (0.17 * sx, 0.18, 0.02),
                (0.30, 0.50, 0.07),
                sub=1,
            )
        )
        # Pink tongue button on top-front of boot
        parts.append(
            make_sphere(
                f"BootBtn_{side}",
                mats["pink"],
                (0.17 * sx, 0.34, 0.22),
                (0.09, 0.04, 0.09),
                sub=1,
            )
        )


def join_all(parts):
    for o in parts:
        if o and o.name in bpy.data.objects:
            apply_mods(o)
    keep = [o for o in parts if o and o.name in bpy.data.objects]
    bpy.ops.object.select_all(action="DESELECT")
    for o in keep:
        o.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = "Bizzo"
    coords = [v.co.copy() for v in body.data.vertices]
    zmin = min(c.z for c in coords)
    xmax, xmin = max(c.x for c in coords), min(c.x for c in coords)
    ymax, ymin = max(c.y for c in coords), min(c.y for c in coords)
    xmid = 0.5 * (xmin + xmax)
    ymid = 0.5 * (ymin + ymax)
    for v in body.data.vertices:
        v.co.x -= xmid
        v.co.y -= ymid
        v.co.z -= zmin
    body.data.update()
    body.location = (0, 0, 0)
    # Normalize height
    h = max(v.co.z for v in body.data.vertices)
    s = HEIGHT / max(h, 1e-6)
    for v in body.data.vertices:
        v.co *= s
    body.data.update()
    smooth(body)
    log(f"Bizzo verts={len(body.data.vertices)} faces={len(body.data.polygons)} h={HEIGHT:.2f}")
    return body


def frame_camera(view="front"):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    body = bpy.data.objects["Bizzo"]
    coords = [body.matrix_world @ v.co for v in body.data.vertices]
    xs = [c.x for c in coords]
    ys = [c.y for c in coords]
    zs = [c.z for c in coords]
    cx = 0.5 * (min(xs) + max(xs))
    cy = 0.5 * (min(ys) + max(ys))
    cz = 0.5 * (min(zs) + max(zs))
    h = max(zs) - min(zs)
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam_data.lens = 55
    if view == "front":
        cam.location = (cx, cy + h * 3.1, cz + h * 0.02)
    elif view == "side":
        cam.location = (cx + h * 2.9, cy, cz + h * 0.02)
    elif view == "back":
        cam.location = (cx, cy - h * 3.1, cz + h * 0.02)
    else:  # three_quarter
        cam.location = (cx + h * 1.9, cy + h * 2.2, cz + h * 0.08)
    direction = Vector((cx, cy, cz)) - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return cam


def render_still(path: Path, view="front", samples=24):
    path.parent.mkdir(parents=True, exist_ok=True)
    frame_camera(view)
    sc = bpy.context.scene
    sc.render.filepath = str(path)
    sc.render.image_settings.file_format = "PNG"
    if hasattr(sc.eevee, "taa_render_samples"):
        sc.eevee.taa_render_samples = samples
    bpy.ops.render.render(write_still=True)
    log(f"render {view} → {path}")


def export_glb(path: Path):
    body = bpy.data.objects["Bizzo"]
    active(body)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True, export_apply=True
    )
    log(f"glb → {path}")


def make_compare(still: Path, out: Path):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return
    ref = REF_DIR / "ref_00_Ha3JhPE.png"
    if not ref.exists() or not still.exists():
        return
    a = Image.open(ref).convert("RGBA")
    b = Image.open(still).convert("RGBA")

    def crop_opaque(im):
        px = im.load()
        w, h = im.size
        xs, ys = [], []
        for y in range(0, h, 2):
            for x in range(0, w, 2):
                r, g, b_, a_ = px[x, y]
                if a_ < 8 or r + g + b_ < 18:
                    continue
                xs.append(x)
                ys.append(y)
        if not xs:
            bbox = im.split()[-1].getbbox()
            return im.crop(bbox) if bbox else im
        return im.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))

    a, b = crop_opaque(a), crop_opaque(b)
    th = 1000

    def fit(im):
        r = th / im.height
        return im.resize((max(1, int(im.width * r)), th), Image.Resampling.LANCZOS)

    a, b = fit(a), fit(b)
    pad = 48
    canvas = Image.new("RGBA", (a.width + b.width + pad * 3, th + pad * 2 + 36), (8, 8, 12, 255))
    canvas.paste(a, (pad, pad + 28), a)
    canvas.paste(b, (a.width + pad * 2, pad + 28), b)
    draw = ImageDraw.Draw(canvas)
    draw.text((pad, 8), "Joey official ref", fill=(220, 220, 230, 255))
    draw.text((a.width + pad * 2, 8), "Bizzo v3 recreate", fill=(220, 220, 230, 255))
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)
    log(f"compare → {out}")


def main():
    global MON
    MON = Monitor.from_env(job="follow_joey_cat_v3", preview_samples=4)
    stages = 7
    try:
        clear()
        setup_scene()
        ART.mkdir(parents=True, exist_ok=True)
        DEMO.mkdir(parents=True, exist_ok=True)

        mats = {k: mat(k, v) for k, v in PAL.items()}
        parts: list = []

        MON.stage("head", index=1, total=stages, preview=False)
        build_head(mats, parts)
        log(f"head parts={len(parts)}")

        MON.stage("coat", index=2, total=stages, preview=False)
        build_coat(mats, parts)

        MON.stage("hands", index=3, total=stages, preview=False)
        build_hands(mats, parts)

        MON.stage("shoes", index=4, total=stages, preview=False)
        build_legs_shoes(mats, parts)
        log(f"total parts before join={len(parts)}")

        # Temporary camera on an empty for early preview of unjoined parts:
        # join first so previews show the finished character.
        MON.stage("join", index=5, total=stages, preview=False)
        body = join_all(parts)
        frame_camera("front")
        MON.preview(message="joined Bizzo front", force=True)

        MON.stage("export", index=6, total=stages, preview=False)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
        export_glb(OUT_GLB)
        export_glb(ART / "bizzo_cat_v3.glb")

        MON.stage("renders", index=7, total=stages, preview=False)
        still = ART / "v3_front.png"
        render_still(still, "front", samples=32)
        render_still(ART / "v3_side.png", "side", samples=24)
        render_still(ART / "v3_back.png", "back", samples=24)
        render_still(ART / "v3_three_quarter.png", "three_quarter", samples=24)
        # Demo gallery copies
        for name in ("v3_front", "v3_side", "v3_back", "v3_three_quarter"):
            src = ART / f"{name}.png"
            if src.exists():
                (DEMO / f"10_{name}.png").write_bytes(src.read_bytes())
        make_compare(still, ART / "v3_compare.png")
        if (ART / "v3_compare.png").exists():
            (DEMO / "10_v3_compare.png").write_bytes((ART / "v3_compare.png").read_bytes())

        frame_camera("front")
        MON.preview(message="final front", force=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
        MON.done("Bizzo v3 complete")
    except Exception as e:
        if MON is not None:
            MON.fail(str(e))
        raise


if __name__ == "__main__":
    main()
