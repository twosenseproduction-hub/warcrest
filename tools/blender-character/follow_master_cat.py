#!/usr/bin/env python3
"""Bizzo v2 — master character workflow via Skin-modifier stick figure.

Follows MASTER_CHARACTER_WORKFLOW.md with a reliable connected base:

  1. Edit-mode stick figure (verts + edges only) — single object
  2. Skin modifier (organic thickness) + Subdivision
  3. Apply → Voxel Remesh (unify) → Smooth brush approx
  4. Soft proportion shaping (Grab/Inflate approx via proportional edit)
  5. Multires for further sculpt in UI
  6. Toon face cards Shrinkwrapped onto the head

This avoids disconnected cube stacks while staying non-boxy.

  blender -b -noaudio --python tools/blender-character/follow_master_cat.py
"""
from __future__ import annotations

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

REPO = Path("/workspace")
OUT_DIR = REPO / "assets/models/blender"
REF_DIR = OUT_DIR / "joey_cat_refs"
ART = Path("/opt/cursor/artifacts/blender_joey_bizzo")
DEMO = Path("/opt/cursor/artifacts/bizzo_demo")
OUT_BLEND = OUT_DIR / "bizzo_cat_v2.blend"
OUT_GLB = OUT_DIR / "bizzo_cat_v2.glb"
HEIGHT = 1.85

PAL = {
    "fur": (0.82, 0.45, 0.14),
    "coat": (0.62, 0.28, 0.82),
    "pink": (0.94, 0.36, 0.78),
    "muzzle": (0.97, 0.97, 0.97),
    "eye_white": (1.0, 1.0, 1.0),
    "pupil": (0.02, 0.02, 0.02),
    "brow": (0.28, 0.14, 0.05),
    "sole": (0.96, 0.96, 0.96),
    "mouth": (0.05, 0.05, 0.05),
}


def log(msg: str):
    print(f"[master-cat] {msg}", flush=True)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = 1080
    sc.render.resolution_y = 1350
    sc.world = bpy.data.worlds.new("World")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.02, 0.02, 0.025, 1.0)
    for name, loc, energy, size in (
        ("Key", (2.2, 3.4, 3.6), 160, 3.2),
        ("Fill", (-2.4, 2.0, 2.0), 60, 4.0),
        ("Rim", (0.3, -2.4, 2.6), 30, 2.5),
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
        bsdf.inputs[key].default_value = 0.1
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = (*rgb, 1.0)
    return m


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_tr(obj):
    active(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def smooth_shade(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def load_refs():
    specs = (
        ("ortho_front.png", (0, 1.5, HEIGHT * 0.5), (math.pi / 2, 0, 0), "FrontRef"),
        ("ortho_side.png", (-1.5, 0, HEIGHT * 0.5), (math.pi / 2, 0, math.pi / 2), "SideRef"),
        ("ortho_back.png", (0, -1.5, HEIGHT * 0.5), (math.pi / 2, 0, math.pi), "BackRef"),
    )
    for fname, loc, rot, name in specs:
        path = REF_DIR / fname
        if not path.exists():
            continue
        img = bpy.data.images.load(str(path))
        bpy.ops.mesh.primitive_plane_add(size=HEIGHT * 1.05, location=loc)
        plane = bpy.context.active_object
        plane.name = name
        plane.rotation_euler = rot
        apply_tr(plane)
        plane.location = loc
        m = bpy.data.materials.new(name + "Mat")
        m.use_nodes = True
        m.blend_method = "BLEND"
        m.shadow_method = "NONE"
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        emit = nt.nodes.new("ShaderNodeEmission")
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        emit.inputs[1].default_value = 0.7
        nt.links.new(tex.outputs["Color"], emit.inputs["Color"])
        nt.links.new(emit.outputs[0], out.inputs["Surface"])
        plane.data.materials.append(m)
        plane.hide_render = True


def build_skin_stick():
    """
    STEP 1: Single mesh of verts+edges (Skin root).
    Blender UI: Add > Mesh > Single Vert (or empty mesh), extrude a stick figure.
    Radii set per-vertex for Soft, non-boxy thickness.
    """
    log("STEP 1: create Skin stick figure (connected verts/edges)")
    joints = {
        "pelvis": (0.0, 0.0, 0.72),
        "spine": (0.0, 0.02, 1.00),
        "chest": (0.0, 0.03, 1.18),
        "neck": (0.0, 0.02, 1.36),
        "collar": (0.0, 0.06, 1.30),
        "head": (0.0, 0.04, 1.62),
        "crown": (0.0, 0.0, 1.82),
        "muzzle": (0.0, 0.24, 1.45),
        "ear_L": (-0.18, -0.02, 1.88),
        "ear_R": (0.18, -0.02, 1.88),
        "cheek_L": (-0.30, 0.06, 1.55),
        "cheek_R": (0.30, 0.06, 1.55),
        "hair": (-0.08, -0.04, 1.92),
        "shoulder_L": (-0.30, 0.02, 1.18),
        "elbow_L": (-0.55, 0.02, 1.16),
        "wrist_L": (-0.82, 0.02, 1.14),
        "hand_L": (-0.96, 0.02, 1.14),
        "shoulder_R": (0.30, 0.02, 1.18),
        "elbow_R": (0.55, 0.02, 1.16),
        "wrist_R": (0.82, 0.02, 1.14),
        "hand_R": (0.96, 0.02, 1.14),
        "hip_L": (-0.12, 0.02, 0.70),
        "knee_L": (-0.12, 0.03, 0.48),
        "ankle_L": (-0.12, 0.05, 0.28),
        "toe_L": (-0.12, 0.14, 0.12),
        "hip_R": (0.12, 0.02, 0.70),
        "knee_R": (0.12, 0.03, 0.48),
        "ankle_R": (0.12, 0.05, 0.28),
        "toe_R": (0.12, 0.14, 0.12),
    }
    edges = [
        ("pelvis", "spine"),
        ("spine", "chest"),
        ("chest", "neck"),
        ("neck", "head"),
        ("neck", "collar"),
        ("head", "crown"),
        ("head", "muzzle"),
        ("crown", "ear_L"),
        ("crown", "ear_R"),
        ("head", "cheek_L"),
        ("head", "cheek_R"),
        ("crown", "hair"),
        ("chest", "shoulder_L"),
        ("shoulder_L", "elbow_L"),
        ("elbow_L", "wrist_L"),
        ("wrist_L", "hand_L"),
        ("chest", "shoulder_R"),
        ("shoulder_R", "elbow_R"),
        ("elbow_R", "wrist_R"),
        ("wrist_R", "hand_R"),
        ("pelvis", "hip_L"),
        ("hip_L", "knee_L"),
        ("knee_L", "ankle_L"),
        ("ankle_L", "toe_L"),
        ("pelvis", "hip_R"),
        ("hip_R", "knee_R"),
        ("knee_R", "ankle_R"),
        ("ankle_R", "toe_R"),
    ]
    radii = {
        "pelvis": 0.16,
        "spine": 0.18,
        "chest": 0.24,
        "neck": 0.07,
        "collar": 0.15,
        "head": 0.22,
        "crown": 0.12,
        "muzzle": 0.11,
        "ear_L": 0.045,
        "ear_R": 0.045,
        "cheek_L": 0.035,
        "cheek_R": 0.035,
        "hair": 0.06,
        "shoulder_L": 0.12,
        "elbow_L": 0.085,
        "wrist_L": 0.095,
        "hand_L": 0.065,
        "shoulder_R": 0.12,
        "elbow_R": 0.085,
        "wrist_R": 0.095,
        "hand_R": 0.065,
        "hip_L": 0.085,
        "knee_L": 0.06,
        "ankle_L": 0.12,
        "toe_L": 0.11,
        "hip_R": 0.085,
        "knee_R": 0.06,
        "ankle_R": 0.12,
        "toe_R": 0.11,
    }

    bm = bmesh.new()
    verts = {}
    for name, co in joints.items():
        verts[name] = bm.verts.new(co)
    bm.verts.ensure_lookup_table()
    for a, b in edges:
        bm.edges.new((verts[a], verts[b]))
    me = bpy.data.meshes.new("SkinStick")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new("Bizzo", me)
    bpy.context.scene.collection.objects.link(obj)
    active(obj)

    log("STEP 2: Skin + Subdivision (organic thickness, not boxes)")
    skin = obj.modifiers.new("Skin", "SKIN")
    skin.use_smooth_shade = True
    skin.branch_smoothing = 0.35

    # Ensure skin vertex data exists (enter/exit edit mode)
    active(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.object.mode_set(mode="OBJECT")

    if not obj.data.skin_vertices:
        log("ERROR: no skin_vertices after Skin modifier")
        return obj

    sv = obj.data.skin_vertices[0].data
    for i, v in enumerate(obj.data.vertices):
        best = min(joints.items(), key=lambda kv: (v.co - Vector(kv[1])).length)[0]
        r = radii.get(best, 0.08)
        sv[i].radius = (r, r)
        sv[i].use_root = best == "pelvis"

    sub = obj.modifiers.new("Subdivision", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2

    active(obj)
    bpy.ops.object.modifier_apply(modifier="Skin")
    bpy.ops.object.modifier_apply(modifier="Subdivision")
    smooth_shade(obj)
    log(f"after Skin+Subsurf: verts={len(obj.data.vertices)} faces={len(obj.data.polygons)}")
    return obj


def rebuild_skin_with_ops(joints, edges, radii):
    """Fallback using bpy.ops extrude single vert — more UI-like."""
    bpy.ops.mesh.primitive_vert_add()
    obj = bpy.context.active_object
    obj.name = "Bizzo"
    # This is fragile; prefer primary path
    return obj


def plant(obj):
    coords = [v.co.copy() for v in obj.data.vertices]
    if not coords:
        return
    zmin = min(c.z for c in coords)
    xmid = 0.5 * (min(c.x for c in coords) + max(c.x for c in coords))
    ymid = 0.5 * (min(c.y for c in coords) + max(c.y for c in coords))
    zmax = max(c.z for c in coords)
    s = HEIGHT / max(zmax - zmin, 1e-6)
    for v in obj.data.vertices:
        v.co.x = (v.co.x - xmid) * s
        v.co.y = (v.co.y - ymid) * s
        v.co.z = (v.co.z - zmin) * s
    obj.data.update()
    obj.location = (0, 0, 0)


def shape_proportions(obj):
    """
    STEP 3: Blockout silhouette tweaks (Grab / Inflate approx).
    Wider sweater chest, softer hem flare, rounder boots.
    """
    log("STEP 3: shape proportions (Grab/Inflate approx on verts)")
    for v in obj.data.vertices:
        # Widen chest / shoulders (coat)
        if 0.95 < v.co.z < 1.30 and abs(v.co.x) < 0.45:
            v.co.x *= 1.12
            if v.co.y > 0:
                v.co.y *= 1.08
        # Soft hem flare
        if 0.70 < v.co.z < 0.95:
            t = (0.95 - v.co.z) / 0.25
            v.co.x *= 1.0 + 0.12 * t
        # Boot bulk
        if v.co.z < 0.35 and abs(v.co.x) > 0.05:
            v.co.x = v.co.x * 1.15 if abs(v.co.x) > 0.08 else v.co.x
            if v.co.y > 0:
                v.co.y *= 1.2
        # Head slightly flatter front for face plane
        if v.co.z > 1.45 and v.co.y > 0.1:
            v.co.y *= 0.95
    obj.data.update()
    # Smooth brush (low strength)
    active(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.vertices_smooth(factor=0.18, repeat=2)
    bpy.ops.object.mode_set(mode="OBJECT")
    smooth_shade(obj)


def voxel_unify(obj, voxel=0.028):
    """
    STEP 4: Voxel Remesh — merge Skin branches into one continuous surface.
    Then light Smooth so it isn't crunchy.
    """
    log(f"STEP 4: Voxel Remesh voxel_size={voxel}")
    coords = [v.co for v in obj.data.vertices]
    extent = max(
        max(c.x for c in coords) - min(c.x for c in coords),
        max(c.y for c in coords) - min(c.y for c in coords),
        max(c.z for c in coords) - min(c.z for c in coords),
    )
    log(f"bbox extent={extent:.3f} in_verts={len(coords)}")
    active(obj)
    rem = obj.modifiers.new("VoxelRemesh", "REMESH")
    rem.mode = "VOXEL"
    rem.voxel_size = voxel
    rem.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=rem.name)
    n = len(obj.data.vertices)
    log(f"remesh verts={n}")
    if n > 50000:
        rem = obj.modifiers.new("VoxelRemesh2", "REMESH")
        rem.mode = "VOXEL"
        rem.voxel_size = voxel * 1.6
        rem.use_smooth_shade = True
        bpy.ops.object.modifier_apply(modifier=rem.name)
        log(f"re-remesh verts={len(obj.data.vertices)}")
    active(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.vertices_smooth(factor=0.2, repeat=3)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    smooth_shade(obj)


def count_islands(obj):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    seen = set()
    islands = 0
    for v in bm.verts:
        if v.index in seen:
            continue
        islands += 1
        stack = [v]
        seen.add(v.index)
        while stack:
            cur = stack.pop()
            for e in cur.link_edges:
                ov = e.other_vert(cur)
                if ov.index not in seen:
                    seen.add(ov.index)
                    stack.append(ov)
    bm.free()
    return islands


def assign_mats(obj, mats_list, idx):
    obj.data.materials.clear()
    for m in mats_list:
        obj.data.materials.append(m)
    for poly in obj.data.polygons:
        c = Vector()
        for vi in poly.vertices:
            c += obj.data.vertices[vi].co
        c /= max(len(poly.vertices), 1)
        mi = idx["coat"]
        if c.z > 1.38:
            mi = idx["fur"]
        if 1.30 < c.z < 1.55 and c.y > 0.12:
            mi = idx["muzzle"]
        if 0.38 < c.z < 0.70 and abs(c.x) > 0.05:
            mi = idx["fur"]
        if c.z < 0.12:
            mi = idx["sole"]
        if abs(c.x) > 0.85 and abs(c.z - 1.05) < 0.2:
            mi = idx["fur"]
        if 0.30 < abs(c.x) < 0.85 and 0.95 < c.z < 1.28:
            mi = idx["coat"]
        poly.material_index = mi


def add_face_cards(obj, mats_list, idx):
    log("STEP 5: Shrinkwrap toon face cards onto head")
    h = max(v.co.z for v in obj.data.vertices)
    k = h / HEIGHT
    details = []

    def sphere(name, loc, scale, mi, segs=14):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=10, radius=0.5, location=loc)
        o = bpy.context.active_object
        o.name = name
        o.scale = scale
        apply_tr(o)
        o.data.materials.clear()
        for m in mats_list:
            o.data.materials.append(m)
        for p in o.data.polygons:
            p.material_index = mi
            p.use_smooth = True
        sw = o.modifiers.new("SW", "SHRINKWRAP")
        sw.target = obj
        sw.wrap_method = "NEAREST_SURFACEPOINT"
        sw.offset = 0.01
        try:
            active(o)
            bpy.ops.object.modifier_apply(modifier="SW")
        except Exception:
            pass
        details.append(o)

    for sx, side in ((-1, "L"), (1, "R")):
        sphere(f"Eye_{side}", (0.11 * sx * k, 0.20 * k, 1.58 * k), (0.11 * k * 2, 0.05 * k * 2, 0.14 * k * 2), idx["eye_white"])
        sphere(f"Pupil_{side}", (0.11 * sx * k, 0.24 * k, 1.57 * k), (0.05 * k * 2, 0.03 * k * 2, 0.05 * k * 2), idx["pupil"], segs=10)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.12 * sx * k, 0.22 * k, 1.72 * k))
        brow = bpy.context.active_object
        brow.name = f"Brow_{side}"
        brow.scale = (0.13 * k, 0.035 * k, 0.04 * k)
        brow.rotation_euler = (math.radians(-8), 0, math.radians(-26 * sx))
        apply_tr(brow)
        brow.data.materials.clear()
        for m in mats_list:
            brow.data.materials.append(m)
        for p in brow.data.polygons:
            p.material_index = idx["brow"]
            p.use_smooth = True
        details.append(brow)
        sphere(f"EarIn_{side}", (0.16 * sx * k, 0.04 * k, 1.86 * k), (0.05 * k * 2, 0.022 * k * 2, 0.065 * k * 2), idx["pink"], segs=10)

    sphere("Nose", (0, 0.28 * k, 1.44 * k), (0.06 * k * 2, 0.04 * k * 2, 0.045 * k * 2), idx["pink"], segs=10)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.03 * k, 0.26 * k, 1.30 * k))
    mouth = bpy.context.active_object
    mouth.name = "Mouth"
    mouth.scale = (0.06 * k, 0.01 * k, 0.01 * k)
    mouth.rotation_euler = (0, 0, math.radians(-16))
    apply_tr(mouth)
    mouth.data.materials.clear()
    for m in mats_list:
        mouth.data.materials.append(m)
    for p in mouth.data.polygons:
        p.material_index = idx["mouth"]
    details.append(mouth)

    for sx, side in ((-1, "L"), (1, "R")):
        sphere(f"BootBtn_{side}", (0.12 * sx * k, 0.18 * k, 0.26 * k), (0.06 * k * 2, 0.035 * k * 2, 0.06 * k * 2), idx["pink"], segs=10)

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    for d in details:
        d.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = "Bizzo"
    smooth_shade(body)
    return body


def add_multires(obj):
    log("STEP 6: Multires (sculpt big shapes at low level, then +1–2 levels in UI)")
    for mod in list(obj.modifiers):
        if mod.type in {"SUBSURF", "MULTIRES"}:
            obj.modifiers.remove(mod)
    mr = obj.modifiers.new("Multires", "MULTIRES")
    active(obj)
    try:
        bpy.ops.object.multires_subdivide(modifier="Multires")
    except Exception as e:
        log(f"multires: {e}")
    return mr


def frame_camera(view="front"):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    body = bpy.data.objects["Bizzo"]
    coords = [body.matrix_world @ v.co for v in body.data.vertices]
    xs, ys, zs = [c.x for c in coords], [c.y for c in coords], [c.z for c in coords]
    cx, cy, cz = 0.5 * (min(xs) + max(xs)), 0.5 * (min(ys) + max(ys)), 0.5 * (min(zs) + max(zs))
    h = max(zs) - min(zs)
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = h * 1.2
    if view == "front":
        cam.location = (cx, cy + h * 3.0, cz)
    elif view == "back":
        cam.location = (cx, cy - h * 3.0, cz)
    elif view == "three_quarter":
        cam.location = (cx + h * 2.0, cy + h * 2.0, cz + h * 0.1)
    else:
        cam.location = (cx + h * 3.0, cy, cz)
    direction = Vector((cx, cy, cz)) - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render(path, view="front"):
    ART.mkdir(parents=True, exist_ok=True)
    DEMO.mkdir(parents=True, exist_ok=True)
    frame_camera(view)
    sc = bpy.context.scene
    sc.render.filepath = str(path)
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    log(f"wrote {path}")


def export_glb(path):
    body = bpy.data.objects["Bizzo"]
    active(body)
    for mod in list(body.modifiers):
        if mod.type == "MULTIRES":
            body.modifiers.remove(mod)
            continue
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            log(f"apply {mod.name}: {e}")
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_apply=True)
    log(f"wrote {path} verts={len(body.data.vertices)}")


def make_compare(front):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return
    ref = REF_DIR / "ref_00_Ha3JhPE.png"
    if not ref.exists() or not front.exists():
        return

    def crop_char(im):
        im = im.convert("RGBA")
        px = im.load()
        w, h = im.size
        xs, ys = [], []
        for y in range(0, h, 2):
            for x in range(0, w, 2):
                r, g, b, a = px[x, y]
                if a < 8 or r + g + b < 24:
                    continue
                xs.append(x)
                ys.append(y)
        if not xs:
            return im
        return im.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))

    a = crop_char(Image.open(ref))
    b = crop_char(Image.open(front))
    th = 1000

    def fit(im):
        r = th / im.height
        return im.resize((max(1, int(im.width * r)), th), Image.Resampling.LANCZOS)

    a, b = fit(a), fit(b)
    canvas = Image.new("RGBA", (a.width + b.width + 60, th + 60), (8, 8, 12, 255))
    canvas.paste(a, (20, 40), a)
    canvas.paste(b, (a.width + 40, 40), b)
    d = ImageDraw.Draw(canvas)
    d.text((20, 10), "Joey ref", fill=(220, 220, 230, 255))
    d.text((a.width + 40, 10), "v2 Skin + Remesh workflow", fill=(220, 220, 230, 255))
    out = ART / "v2_compare.png"
    canvas.save(out)
    canvas.save(DEMO / "06_v2_compare.png")
    log(f"wrote {out}")


def main():
    log("Following MASTER_CHARACTER_WORKFLOW.md")
    log("New improvements: Skin stick-figure base (connected), per-joint radii,")
    log("  Voxel Remesh unify, proportion shaping, Shrinkwrap face cards, Multires")

    clear()
    setup_scene()
    load_refs()

    order = ["fur", "coat", "pink", "muzzle", "eye_white", "pupil", "brow", "sole", "mouth"]
    mats = {k: mat(k, v) for k, v in PAL.items()}
    mats_list = [mats[k] for k in order]
    idx = {k: i for i, k in enumerate(order)}

    body = build_skin_stick()
    plant(body)
    log(f"islands after Skin={count_islands(body)}")
    shape_proportions(body)
    # Skip Voxel Remesh when Skin already yields 1 island — remesh over-blobs the silhouette.
    # Optional light remesh only if islands > 1 (workflow step 5 when needed).
    if count_islands(body) > 1:
        voxel_unify(body, voxel=0.032)
        plant(body)
        log(f"islands after Remesh={count_islands(body)}")
    else:
        log("STEP 4: skip Voxel Remesh (Skin already 1 island — keeps clearer silhouette)")
        # Mild smooth only
        active(body)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.vertices_smooth(factor=0.12, repeat=2)
        bpy.ops.object.mode_set(mode="OBJECT")
        smooth_shade(body)
    assign_mats(body, mats_list, idx)
    body = add_face_cards(body, mats_list, idx)
    plant(body)
    add_multires(body)
    log(f"final islands={count_islands(body)} verts={len(body.data.vertices)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))

    front = ART / "v2_front.png"
    side = ART / "v2_side.png"
    back = ART / "v2_back.png"
    tq = ART / "v2_three_quarter.png"
    render(front, "front")
    render(side, "side")
    render(back, "back")
    render(tq, "three_quarter")
    make_compare(front)

    DEMO.mkdir(parents=True, exist_ok=True)
    for src, name in (
        (front, "06_v2_front.png"),
        (side, "07_v2_side.png"),
        (back, "08_v2_back.png"),
        (tq, "09_v2_three_quarter.png"),
    ):
        if src.exists():
            (DEMO / name).write_bytes(src.read_bytes())

    export_glb(OUT_GLB)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    log("DONE Bizzo v2 (Skin workflow)")


if __name__ == "__main__":
    main()
