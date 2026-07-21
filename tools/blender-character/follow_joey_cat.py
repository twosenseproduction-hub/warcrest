#!/usr/bin/env python3
"""Follow Joey Carlino's Character modeling for beginners — Bizzo the cat.

Tutorial: https://www.youtube.com/watch?v=O6HQhs-gk50
Refs:    https://imgur.com/a/tnkGXf2  → assets/models/blender/joey_cat_refs/

Cannot download the YouTube stream here (bot check), so no every-5s frame dump.
We match the official Imgur front T-pose + thumbnail + full transcript chapters:

  Human warm-up → Cat blockout → Head → Coat → Hands → Shoes → Color → Join

Joey techniques used:
  - Separate objects per limb / clothing shell
  - Mirror (built by duplicating ±X)
  - Subdivision Surface on organic volumes
  - Solidify on coat
  - Capsule/Skin-style finger volumes
  - Flat palette colors via Principled BSDF (glTF-safe)

  blender -b -noaudio --python tools/blender-character/follow_joey_cat.py
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

REPO = Path("/workspace")
OUT_DIR = REPO / "assets/models/blender"
REF_DIR = OUT_DIR / "joey_cat_refs"
ART = Path("/opt/cursor/artifacts/blender_joey_bizzo")
OUT_BLEND = OUT_DIR / "bizzo_cat.blend"
OUT_GLB = OUT_DIR / "bizzo_cat.glb"
OUT_STILL = ART / "still.png"
OUT_SIDE = ART / "still_side.png"
OUT_CMP = ART / "compare_ref.png"

# Colors closer to Joey's finished Bizzo (sRGB under Standard view transform)
PAL = {
    "fur": (0.78, 0.40, 0.10),
    "fur_shadow": (0.55, 0.28, 0.06),
    "coat": (0.58, 0.22, 0.78),
    "pink": (0.92, 0.32, 0.72),
    "muzzle": (0.96, 0.96, 0.96),
    "eye_white": (1.0, 1.0, 1.0),
    "pupil": (0.01, 0.01, 0.01),
    "brow": (0.22, 0.10, 0.03),
    "sole": (0.95, 0.95, 0.95),
    "mouth": (0.04, 0.04, 0.04),
}


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
        ("Key", (1.8, 3.2, 3.5), 220, 3.0),
        ("Fill", (-2.5, 2.0, 2.0), 90, 4.0),
        ("Rim", (0.4, -2.2, 2.5), 50, 2.5),
    ):
        bpy.ops.object.light_add(type="AREA", location=loc)
        L = bpy.context.active_object
        L.name = name
        L.data.energy = energy
        L.data.size = size
        L.rotation_euler = Euler((math.radians(60), 0, math.atan2(loc[0], -loc[1])), "XYZ")


def mat(name, rgb, rough=0.88):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.12
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = 0.12
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = (*rgb, 1.0)
    return m


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_tr(obj, loc=False, rot=False, scale=True):
    active(obj)
    bpy.ops.object.transform_apply(location=loc, rotation=rot, scale=scale)


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def set_mat(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


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
            print("mod fail", obj.name, mod.name, e, flush=True)


def place(obj, loc, rot=None, scale=None):
    obj.location = loc
    if rot is not None:
        obj.rotation_euler = Euler(rot, "XYZ") if not isinstance(rot, Euler) else rot
    if scale is not None:
        obj.scale = scale
    apply_tr(obj, scale=True)
    if rot is not None:
        # keep rotation after scale apply
        obj.rotation_euler = Euler(rot, "XYZ") if not isinstance(rot, Euler) else rot
        apply_tr(obj, rot=True, scale=False)


def make_cube(name, material, loc, scale, rot=None, sub=2):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    set_mat(o, material)
    place(o, loc, rot=rot, scale=scale)
    if sub:
        add_subsurf(o, levels=sub)
    return o


def make_sphere(name, material, loc, scale, rot=None, segs=20, rings=12, sub=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=0.5, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    set_mat(o, material)
    place(o, loc, rot=rot, scale=scale)
    if sub:
        add_subsurf(o, levels=sub)
    else:
        smooth(o)
    return o


def make_cyl(name, material, loc, radius, depth, rot=None, scale=None, verts=16, sub=2):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    set_mat(o, material)
    place(o, loc, rot=rot, scale=scale or (1, 1, 1))
    if sub:
        add_subsurf(o, levels=sub)
    return o


def make_cone(name, material, loc, r1, depth, rot=None, scale=None, verts=7, sub=2):
    bpy.ops.mesh.primitive_cone_add(
        vertices=verts, radius1=r1, radius2=0.01, depth=depth, location=(0, 0, 0)
    )
    o = bpy.context.active_object
    o.name = name
    set_mat(o, material)
    place(o, loc, rot=rot, scale=scale or (1, 1, 1))
    if sub:
        add_subsurf(o, levels=sub)
    return o


def widen_bottom(obj, z_cut, factor_xy=1.2):
    for v in obj.data.vertices:
        if v.co.z < z_cut:
            v.co.x *= factor_xy
            v.co.y *= factor_xy * 0.95
    obj.data.update()


def build(mats):
    parts = []

    # --- HEAD (Joey: cube → extrude → subsurf; broad + slightly flat) ---
    # Front = +Y. Keep face features OUTSIDE the head shell.
    head = make_cube("Head", mats["fur"], (0, 0, 1.70), (0.58, 0.48, 0.48), sub=2)
    parts.append(head)

    # Ears
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_cone(
                f"Ear_{side}",
                mats["fur"],
                (0.22 * sx, -0.02, 2.05),
                0.14,
                0.28,
                rot=(math.radians(-14), 0, math.radians(22 * sx)),
                scale=(1.05, 0.42, 1.0),
                sub=2,
            )
        )
        parts.append(
            make_cone(
                f"EarIn_{side}",
                mats["pink"],
                (0.22 * sx, 0.04, 2.02),
                0.08,
                0.17,
                rot=(math.radians(-6), 0, math.radians(22 * sx)),
                scale=(1.0, 0.26, 1.0),
                sub=2,
            )
        )

    # Hair tufts leaning to viewer's left (−X)
    for i, (x, y, z, sx, sy, sz) in enumerate(
        (
            (-0.10, -0.05, 2.02, 0.22, 0.18, 0.24),
            (-0.24, 0.00, 1.98, 0.20, 0.16, 0.22),
            (0.06, 0.02, 2.00, 0.18, 0.15, 0.20),
        )
    ):
        parts.append(make_sphere(f"Hair_{i}", mats["fur"], (x, y, z), (sx, sy, sz), sub=1))

    # Cheek whisker tufts (3 per side, pointed out)
    for sx, side in ((-1, "L"), (1, "R")):
        for i, (dz, dy, length, tilt) in enumerate(
            (
                (0.07, 0.06, 0.20, 14),
                (0.00, 0.02, 0.22, 0),
                (-0.07, -0.01, 0.18, -12),
            )
        ):
            parts.append(
                make_cone(
                    f"Cheek_{side}_{i}",
                    mats["fur"],
                    (0.34 * sx, dy, 1.62 + dz),
                    0.065,
                    length,
                    rot=(math.radians(tilt), math.radians(90 * sx), 0),
                    scale=(1.0, 0.6, 1.0),
                    sub=2,
                )
            )

    # White muzzle — LOWER face only (must not cover eyes)
    parts.append(make_sphere("Muzzle", mats["muzzle"], (0, 0.18, 1.42), (0.42, 0.30, 0.24), sub=1))

    # Nose on front of muzzle
    parts.append(make_sphere("Nose", mats["pink"], (0, 0.34, 1.48), (0.09, 0.07, 0.07), sub=1))

    # Eyes on ORANGE head above muzzle — tall white ovals
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_sphere(
                f"Eye_{side}",
                mats["eye_white"],
                (0.14 * sx, 0.26, 1.72),
                (0.13, 0.07, 0.20),
                sub=1,
            )
        )
        parts.append(
            make_sphere(
                f"Pupil_{side}",
                mats["pupil"],
                (0.14 * sx, 0.31, 1.70),
                (0.065, 0.04, 0.065),
                sub=0,
            )
        )

    # Thick grumpy brows above eyes
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_cube(
                f"Brow_{side}",
                mats["brow"],
                (0.15 * sx, 0.34, 1.90),
                (0.20, 0.07, 0.08),
                rot=(math.radians(-12), 0, math.radians(-34 * sx)),
                sub=1,
            )
        )

    # Mouth scowl on muzzle
    parts.append(
        make_cube(
            "Mouth",
            mats["mouth"],
            (0.05, 0.32, 1.32),
            (0.09, 0.018, 0.016),
            rot=(0, 0, math.radians(-22)),
            sub=1,
        )
    )

    # Thin black whiskers (finished Bizzo detail)
    for sx, side in ((-1, "L"), (1, "R")):
        for i, dz in enumerate((0.04, 0.0, -0.04)):
            parts.append(
                make_cyl(
                    f"Whisker_{side}_{i}",
                    mats["mouth"],
                    (0.22 * sx, 0.28, 1.40 + dz),
                    0.006,
                    0.16,
                    rot=(0, math.radians(90 * sx), math.radians(10 * (1 - i))),
                    sub=0,
                )
            )

    # --- COAT (Joey: Solidify + Subsurf, separate shell) ---
    coat = make_cube("Coat", mats["coat"], (0, 0, 1.00), (0.50, 0.36, 0.52), sub=2)
    widen_bottom(coat, z_cut=0.90, factor_xy=1.18)
    sol = coat.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 0.035
    sol.offset = 1.0
    parts.append(coat)

    # Flared turtleneck collar (wide open ring)
    collar = make_cyl(
        "Collar",
        mats["coat"],
        (0, 0.02, 1.30),
        0.22,
        0.18,
        scale=(1.35, 1.15, 1.0),
        sub=2,
    )
    for v in collar.data.vertices:
        if v.co.z > 1.34:
            v.co.x *= 1.25
            v.co.y *= 1.15
        else:
            v.co.x *= 0.90
            v.co.y *= 0.90
    collar.data.update()
    parts.append(collar)

    # Sleeves + cuffs (T-pose)
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_cyl(
                f"Sleeve_{side}",
                mats["coat"],
                (0.55 * sx, 0.02, 1.12),
                0.10,
                0.55,
                rot=(0, math.radians(90), 0),
                scale=(1.08, 1.08, 1.0),
                sub=2,
            )
        )
        parts.append(
            make_cyl(
                f"Cuff_{side}",
                mats["coat"],
                (0.84 * sx, 0.02, 1.12),
                0.11,
                0.09,
                rot=(0, math.radians(90), 0),
                sub=2,
            )
        )

    # --- HANDS (Joey Skin-modifier fingers → capsules) ---
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_sphere(f"Palm_{side}", mats["fur"], (0.98 * sx, 0.02, 1.12), (0.16, 0.14, 0.14), sub=1)
        )
        for i, (dy, dz, length, yaw) in enumerate(
            (
                (0.08, 0.05, 0.13, 28),
                (0.01, 0.02, 0.15, 0),
                (-0.07, -0.01, 0.13, -22),
            )
        ):
            parts.append(
                make_cyl(
                    f"Finger_{side}_{i}",
                    mats["fur"],
                    (1.08 * sx, dy, 1.12 + dz),
                    0.042,
                    length,
                    rot=(0, math.radians(90 * sx), math.radians(yaw * sx)),
                    sub=2,
                )
            )

    # --- SHORTS / LEGS / BOOTS ---
    parts.append(make_cube("Shorts", mats["coat"], (0, 0, 0.72), (0.46, 0.34, 0.20), sub=2))

    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_cyl(f"Leg_{side}", mats["fur"], (0.14 * sx, 0.02, 0.52), 0.07, 0.20, sub=2)
        )

        # Chunky purple boot (box + subsurf like Joey's shoe chapter)
        boot = make_cube(
            f"Boot_{side}",
            mats["coat"],
            (0.14 * sx, 0.08, 0.24),
            (0.28, 0.36, 0.32),
            sub=2,
        )
        parts.append(boot)

        parts.append(
            make_cube(
                f"Sole_{side}",
                mats["sole"],
                (0.14 * sx, 0.10, 0.05),
                (0.30, 0.40, 0.08),
                sub=1,
            )
        )
        parts.append(
            make_sphere(
                f"BootBtn_{side}",
                mats["pink"],
                (0.14 * sx, 0.28, 0.28),
                (0.10, 0.06, 0.10),
                sub=1,
            )
        )

    return parts


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
    xmid = 0.5 * (min(c.x for c in coords) + max(c.x for c in coords))
    ymid = 0.5 * (min(c.y for c in coords) + max(c.y for c in coords))
    for v in body.data.vertices:
        v.co.x -= xmid
        v.co.y -= ymid
        v.co.z -= zmin
    body.data.update()
    body.location = (0, 0, 0)
    smooth(body)
    h = max(v.co.z for v in body.data.vertices)
    print("Bizzo faces", len(body.data.polygons), "verts", len(body.data.vertices), "h", h, flush=True)
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
    cx, cy, cz = 0.5 * (min(xs) + max(xs)), 0.5 * (min(ys) + max(ys)), 0.5 * (min(zs) + max(zs))
    h = max(zs) - min(zs)
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam_data.lens = 55
    # Face parts are on +Y; stand on +Y looking toward -Y to see the face.
    if view == "front":
        cam.location = (cx, cy + h * 2.55, cz + h * 0.02)
        direction = Vector((cx, cy, cz)) - Vector(cam.location)
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    else:
        cam.location = (cx + h * 2.3, cy, cz)
        direction = Vector((cx, cy, cz)) - Vector(cam.location)
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return cam


def render_still(path, view="front"):
    ART.mkdir(parents=True, exist_ok=True)
    frame_camera(view)
    sc = bpy.context.scene
    sc.render.filepath = str(path)
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print("wrote", path, flush=True)


def export_glb(path):
    body = bpy.data.objects["Bizzo"]
    active(body)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_apply=True)
    print("wrote", path, flush=True)


def make_compare():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return
    ref = REF_DIR / "ref_00_Ha3JhPE.png"
    if not ref.exists() or not OUT_STILL.exists():
        return
    a = Image.open(ref).convert("RGBA")
    b = Image.open(OUT_STILL).convert("RGBA")

    def crop_opaque(im):
        alpha = im.split()[-1]
        # treat near-black bg as empty for ref (has black bg)
        px = im.load()
        w, h = im.size
        xs, ys = [], []
        for y in range(0, h, 2):
            for x in range(0, w, 2):
                r, g, b_, a_ = px[x, y]
                if a_ < 8:
                    continue
                if r + g + b_ < 18:
                    continue
                xs.append(x)
                ys.append(y)
        if not xs:
            bbox = alpha.getbbox()
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
    draw.text((pad, 8), "Joey ref (Imgur)", fill=(220, 220, 230, 255))
    draw.text((a.width + pad * 2, 8), "Our Bizzo rebuild", fill=(220, 220, 230, 255))
    canvas.save(OUT_CMP)
    print("wrote", OUT_CMP, flush=True)


def main():
    clear()
    setup_scene()
    mats = {k: mat(k, v) for k, v in PAL.items()}
    parts = build(mats)
    join_all(parts)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    export_glb(OUT_GLB)
    render_still(OUT_STILL, "front")
    render_still(OUT_SIDE, "side")
    make_compare()
    print("DONE Joey Bizzo", flush=True)


if __name__ == "__main__":
    main()
