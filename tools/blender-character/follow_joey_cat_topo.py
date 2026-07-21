#!/usr/bin/env python3
"""Bizzo — connected clean-topology base mesh (PREFERRED ship / sculpt-ready).

This is the preferred Bizzo recreate (cleaner connected silhouette than lumpy
separate-object v3). Demo still: assets/models/blender/bizzo_demo/01_front.png

Pipeline:
  1. Orthographic front / side / back reference planes
  2. Looped volumes (joint rings + supporting creases) with deep overlaps
  3. Exact boolean UNION → one manifold shell
  4. Tris→quads cleanup, edge creases, Subdivision + Multires
  5. Ortho beauty / wire renders + GLB export

  ./tools/blender-monitor/bin/run-job.sh --name bizzo-topo \\
    tools/blender-character/follow_joey_cat_topo.py
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

REPO = Path("/workspace")
OUT_DIR = REPO / "assets/models/blender"
REF_DIR = OUT_DIR / "joey_cat_refs"
DEMO = OUT_DIR / "bizzo_demo"
ART = Path("/opt/cursor/artifacts/blender_joey_bizzo")
OUT_BLEND = OUT_DIR / "bizzo_cat_topo.blend"
OUT_GLB = OUT_DIR / "bizzo_cat_topo.glb"
OUT_FRONT = ART / "topo_front.png"
OUT_SIDE = ART / "topo_side.png"
OUT_BACK = ART / "topo_back.png"
OUT_WIRE = ART / "topo_wire.png"
OUT_CMP = ART / "topo_compare_ref.png"

sys.path.insert(0, str(REPO / "tools/blender-monitor/lib"))
from monitor_preview import Monitor  # noqa: E402

HEIGHT = 1.85
MON: Monitor | None = None

PAL = {
    # Match Joey Imgur / ortho palette (brighter orange, soft lavender)
    "fur": (0.93, 0.55, 0.18),
    "coat": (0.70, 0.50, 0.88),
    "pink": (0.96, 0.48, 0.74),
    "muzzle": (0.98, 0.98, 0.98),
    "eye_white": (1.0, 1.0, 1.0),
    "pupil": (0.02, 0.02, 0.02),
    "brow": (0.20, 0.09, 0.04),
    "sole": (0.97, 0.97, 0.97),
    "mouth": (0.05, 0.05, 0.05),
}


def log(msg: str):
    print(f"[bizzo-topo] {msg}", flush=True)
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
    sc.world = bpy.data.worlds.new("World")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
    for name, loc, energy, size in (
        ("Key", (2.0, 3.5, 3.8), 170, 3.0),
        ("Fill", (-2.5, 2.0, 2.2), 65, 4.0),
        ("Rim", (0.5, -2.5, 2.8), 35, 2.5),
    ):
        bpy.ops.object.light_add(type="AREA", location=loc)
        L = bpy.context.active_object
        L.name = name
        L.data.energy = energy
        L.data.size = size


def mat(name, rgb, rough=0.88):
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
        bsdf.inputs[key].default_value = 0.12
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


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def load_ref_planes():
    specs = (
        ("ortho_front.png", (0, 1.4, HEIGHT * 0.5), (math.pi / 2, 0, 0), "FrontRef"),
        ("ortho_side.png", (-1.4, 0, HEIGHT * 0.5), (math.pi / 2, 0, math.pi / 2), "SideRef"),
        ("ortho_back.png", (0, -1.4, HEIGHT * 0.5), (math.pi / 2, 0, math.pi), "BackRef"),
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
        emit.inputs[1].default_value = 0.75
        nt.links.new(tex.outputs["Color"], emit.inputs["Color"])
        nt.links.new(emit.outputs[0], out.inputs["Surface"])
        plane.data.materials.append(m)
        plane.hide_render = True


def mesh_from_bm(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    for m in mats:
        me.materials.append(m)
    return obj


def make_grid_cube(name, sx, sy, sz, cuts, mats, mi):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    for v in bm.verts:
        v.co.x *= sx * 0.5
        v.co.y *= sy * 0.5
        v.co.z *= sz * 0.5
    if cuts > 0:
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=cuts, use_grid_fill=True)
    for f in bm.faces:
        f.material_index = mi
    return mesh_from_bm(name, bm, mats)


def make_cyl(name, radius, depth, segs, rings, mats, mi):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segs, radius1=radius, radius2=radius, depth=depth
    )
    if rings > 1:
        lengthwise = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > depth * 0.12]
        if lengthwise:
            bmesh.ops.subdivide_edges(bm, edges=lengthwise, cuts=rings - 1)
    for f in bm.faces:
        f.material_index = mi
    return mesh_from_bm(name, bm, mats)


def make_sphere(name, mats, mi, loc, scale, segs=16, rings=10):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=0.5)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    for f in bm.faces:
        f.material_index = mi
    o = mesh_from_bm(name, bm, mats)
    o.location = loc
    apply_tr(o)
    return o


def make_cone(name, mats, mi, loc, r1, depth, rot, scale, segs=8):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=0.015, depth=depth
    )
    for f in bm.faces:
        f.material_index = mi
    o = mesh_from_bm(name, bm, mats)
    o.location = loc
    o.rotation_euler = rot
    o.scale = scale
    apply_tr(o)
    return o


def crease_near(obj, pred, value=0.7):
    me = obj.data
    if "crease_edge" not in me.attributes:
        me.attributes.new(name="crease_edge", type="FLOAT", domain="EDGE")
    attr = me.attributes["crease_edge"]
    for i, e in enumerate(me.edges):
        mid = (me.vertices[e.vertices[0]].co + me.vertices[e.vertices[1]].co) * 0.5
        if pred(mid):
            attr.data[i].value = value


def boolean_union(base, others):
    active(base)
    for o in others:
        if o is None or o.name not in bpy.data.objects:
            continue
        mod = base.modifiers.new(f"Bool_{o.name}", "BOOLEAN")
        mod.operation = "UNION"
        mod.solver = "EXACT"
        mod.object = o
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            print("bool fail", o.name, e, flush=True)
            if mod.name in base.modifiers:
                base.modifiers.remove(mod)
            continue
        bpy.data.objects.remove(o, do_unlink=True)
    active(base)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.001)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.mesh.dissolve_degenerate(threshold=0.0001)
    bpy.ops.mesh.tris_convert_to_quads(
        face_threshold=math.radians(50), shape_threshold=math.radians(50)
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    return base


def count_islands(obj):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    islands = 0
    seen = set()
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


def plant(obj):
    coords = [v.co.copy() for v in obj.data.vertices]
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


def build(mats_list, idx):
    """Preferred connected topo — tuned toward Joey ortho / Imgur T-pose."""
    parts = []

    # Coat torso — taller bell flare like Joey sweater (still boxy topo read)
    torso = make_grid_cube("Torso", 0.50, 0.40, 0.56, 3, mats_list, idx["coat"])
    torso.location = (0, 0.02, 0.98)
    apply_tr(torso)
    for v in torso.data.vertices:
        if v.co.z < 0.86:
            f = 1.0 + (0.86 - v.co.z) * 0.85
            v.co.x *= f
            v.co.y *= 1.0 + (0.86 - v.co.z) * 0.38
        elif v.co.z > 1.16:
            v.co.x *= 0.93
            v.co.y *= 0.95
    torso.data.update()
    crease_near(torso, lambda m: m.z < 0.78 or m.z > 1.20, 0.55)
    parts.append(torso)

    # Tall turtleneck — snug to chin (Joey), not an over-wide funnel
    collar = make_cyl("Collar", 0.18, 0.26, 16, 3, mats_list, idx["coat"])
    collar.scale = (1.35, 1.22, 1.0)
    collar.location = (0, 0.04, 1.32)
    apply_tr(collar)
    for v in collar.data.vertices:
        if v.co.z > 1.32:
            v.co.x *= 1.18
            v.co.y *= 1.12
        else:
            v.co.x *= 0.90
            v.co.y *= 0.90
    collar.data.update()
    crease_near(collar, lambda m: abs(m.z - 1.32) > 0.04, 0.75)
    parts.append(collar)

    # Neck bridge (ensures head↔coat connection)
    neck = make_cyl("Neck", 0.15, 0.12, 12, 2, mats_list, idx["fur"])
    neck.location = (0, 0.02, 1.44)
    apply_tr(neck)
    parts.append(neck)

    # Wider head — larger vs torso like Joey (~big head / small body)
    head = make_grid_cube("Head", 0.62, 0.50, 0.52, 3, mats_list, idx["fur"])
    head.location = (0, 0.04, 1.72)
    apply_tr(head)
    # Soften box corners toward Joey's rounder cheek silhouette
    for v in head.data.vertices:
        rxy = math.hypot(v.co.x, v.co.y)
        if rxy > 0.22:
            shrink = 0.92 + 0.08 * (0.22 / rxy)
            v.co.x *= shrink
            v.co.y *= shrink
    head.data.update()
    parts.append(head)

    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_cone(
                f"Ear_{side}",
                mats_list,
                idx["fur"],
                (0.26 * sx, -0.04, 2.02),
                0.14,
                0.30,
                (math.radians(-18), 0, math.radians(26 * sx)),
                (1.1, 0.36, 1.05),
            )
        )
        # Inner ear kept inset so pink doesn't smear into hair via boolean
        parts.append(
            make_cone(
                f"EarIn_{side}",
                mats_list,
                idx["pink"],
                (0.26 * sx, 0.02, 1.98),
                0.07,
                0.16,
                (math.radians(-10), 0, math.radians(26 * sx)),
                (0.95, 0.22, 1.0),
            )
        )

    # Hair tufts lean viewer's left (−X), chunky but distinct
    for i, (x, y, z, sc) in enumerate(
        (
            (-0.12, -0.04, 2.06, (0.20, 0.15, 0.26)),
            (-0.28, 0.00, 2.00, (0.18, 0.14, 0.24)),
            (0.04, 0.02, 2.04, (0.16, 0.13, 0.22)),
        )
    ):
        parts.append(make_sphere(f"Hair_{i}", mats_list, idx["fur"], (x, y, z), sc, segs=12, rings=8))

    # Longer sharp cheek spikes (Joey signature)
    for sx, side in ((-1, "L"), (1, "R")):
        for i, (dz, length, tilt) in enumerate(
            ((0.08, 0.26, 20), (0.0, 0.30, 0), (-0.08, 0.24, -18))
        ):
            parts.append(
                make_cone(
                    f"Cheek_{side}_{i}",
                    mats_list,
                    idx["fur"],
                    (0.36 * sx, 0.06, 1.60 + dz),
                    0.048,
                    length,
                    (math.radians(tilt), math.radians(90 * sx), 0),
                    (1.0, 0.42, 1.0),
                    segs=6,
                )
            )

    # Large white bean muzzle
    parts.append(make_sphere("Muzzle", mats_list, idx["muzzle"], (0, 0.20, 1.40), (0.46, 0.32, 0.28)))

    # Sleeves deep into torso
    for sx, side in ((-1, "L"), (1, "R")):
        sleeve = make_cyl(f"Sleeve_{side}", 0.12, 0.66, 12, 4, mats_list, idx["coat"])
        sleeve.rotation_euler = (0, math.radians(90), 0)
        sleeve.location = (0.44 * sx, 0.02, 1.08)
        apply_tr(sleeve)
        crease_near(
            sleeve,
            lambda m, s=sx: abs(m.x - 0.24 * s) < 0.05 or abs(m.x - 0.70 * s) < 0.05,
            0.6,
        )
        parts.append(sleeve)

        cuff = make_cyl(f"Cuff_{side}", 0.125, 0.11, 12, 2, mats_list, idx["coat"])
        cuff.rotation_euler = (0, math.radians(90), 0)
        cuff.location = (0.82 * sx, 0.02, 1.08)
        apply_tr(cuff)
        crease_near(cuff, lambda m: True, 0.8)
        parts.append(cuff)

        hand = make_grid_cube(f"Hand_{side}", 0.15, 0.13, 0.13, 2, mats_list, idx["fur"])
        hand.location = (0.96 * sx, 0.02, 1.08)
        apply_tr(hand)
        parts.append(hand)
        thumb = make_cyl(f"Thumb_{side}", 0.038, 0.10, 8, 2, mats_list, idx["fur"])
        thumb.rotation_euler = (0, math.radians(50 * sx), math.radians(20 * sx))
        thumb.location = (0.96 * sx, 0.08, 1.12)
        apply_tr(thumb)
        parts.append(thumb)

    shorts = make_grid_cube("Shorts", 0.46, 0.34, 0.18, 2, mats_list, idx["coat"])
    shorts.location = (0, 0.02, 0.66)
    apply_tr(shorts)
    parts.append(shorts)

    for sx, side in ((-1, "L"), (1, "R")):
        # Bridging legs — overlap shorts + boots (no floating knees)
        leg = make_cyl(f"Leg_{side}", 0.085, 0.28, 12, 3, mats_list, idx["fur"])
        leg.location = (0.16 * sx, 0.04, 0.48)
        apply_tr(leg)
        crease_near(leg, lambda m: m.z > 0.56 or m.z < 0.40, 0.5)
        parts.append(leg)

        # Separate chunky boots — spaced so boolean doesn't fuse L/R
        boot = make_grid_cube(f"Boot_{side}", 0.26, 0.40, 0.30, 2, mats_list, idx["coat"])
        boot.location = (0.17 * sx, 0.12, 0.24)
        apply_tr(boot)
        for v in boot.data.vertices:
            if v.co.z < 0.12:
                v.co.z = 0.12 + (v.co.z - 0.12) * 0.35
            if v.co.y > 0.10:
                v.co.y *= 1.10
        boot.data.update()
        crease_near(boot, lambda m: m.z < 0.14, 0.85)
        parts.append(boot)

        sole = make_grid_cube(f"Sole_{side}", 0.28, 0.44, 0.07, 1, mats_list, idx["sole"])
        sole.location = (0.17 * sx, 0.14, 0.05)
        apply_tr(sole)
        crease_near(sole, lambda m: True, 0.95)
        parts.append(sole)

    # Face volumes that boolean well (eyes/pupils/nose). Surface cards
    # (brows/mouth/whiskers/boot pinks) are added AFTER plant so they don't melt.
    for sx, side in ((-1, "L"), (1, "R")):
        parts.append(
            make_sphere(
                f"Eye_{side}",
                mats_list,
                idx["eye_white"],
                (0.12 * sx, 0.28, 1.64),
                (0.13, 0.065, 0.22),
            )
        )
        parts.append(
            make_sphere(
                f"Pupil_{side}",
                mats_list,
                idx["pupil"],
                (0.12 * sx, 0.33, 1.60),
                (0.048, 0.032, 0.048),
                segs=12,
                rings=8,
            )
        )

    parts.append(make_sphere("Nose", mats_list, idx["pink"], (0, 0.38, 1.50), (0.075, 0.055, 0.055)))

    base = parts[0]
    base.name = "Bizzo"
    log(f"boolean union of {len(parts)} parts…")
    boolean_union(base, parts[1:])
    plant(base)
    smooth(base)

    islands = count_islands(base)
    log(f"connected islands={islands} verts={len(base.data.vertices)} faces={len(base.data.polygons)}")

    # Surface ornaments in planted space — JOIN (not boolean) so pinks/mouth stay readable
    add_surface_cards(base, mats_list, idx)

    # Keep intentional joint/support loops — do NOT voxel-remesh (melts silhouette).
    sub = base.modifiers.new("Subdivision", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    sub.quality = 3
    base.modifiers.new("Multires", "MULTIRES")
    log("Multires modifier added (subdivide in Blender for sculpt levels)")

    return base


def add_surface_cards(body, mats_list, idx):
    """Join brows / mouth / whiskers / boot pinks after plant (Joey readable details)."""
    coords = [v.co.copy() for v in body.data.vertices]
    h = max(c.z for c in coords)
    extras = []

    # Grumpy brows — sit on the eye line (not up in the hair)
    for sx, side in ((-1, "L"), (1, "R")):
        brow = make_grid_cube(f"Brow_{side}", 0.11 * h, 0.035 * h, 0.04 * h, 1, mats_list, idx["brow"])
        brow.location = (0.065 * h * sx, 0.19 * h, 0.855 * h)
        brow.rotation_euler = (math.radians(-18), 0, math.radians(-50 * sx))
        apply_tr(brow)
        extras.append(brow)

    # Off-center smirk on muzzle
    mouth = make_grid_cube("Mouth", 0.055 * h, 0.012 * h, 0.01 * h, 0, mats_list, idx["mouth"])
    mouth.location = (0.04 * h, 0.21 * h, 0.70 * h)
    mouth.rotation_euler = (0, 0, math.radians(-24))
    apply_tr(mouth)
    extras.append(mouth)

    # Thin black whiskers on muzzle
    for sx, side in ((-1, "L"), (1, "R")):
        for i, dz in enumerate((0.018, 0.0, -0.018)):
            w = make_grid_cube(
                f"Whisker_{side}_{i}", 0.065 * h, 0.0035 * h, 0.0035 * h, 0, mats_list, idx["mouth"]
            )
            w.location = (0.11 * h * sx, 0.20 * h, (0.73 + dz) * h)
            w.rotation_euler = (0, 0, math.radians(6 * (1 - i) * sx))
            apply_tr(w)
            extras.append(w)

    # Pink boot tongue buttons — two per boot
    for sx, side in ((-1, "L"), (1, "R")):
        for i, (dx, dz) in enumerate(((-0.02, 0.015), (0.02, 0.015))):
            btn = make_sphere(
                f"BootBtn_{side}_{i}",
                mats_list,
                idx["pink"],
                ((0.10 + dx) * h * sx, 0.145 * h, (0.145 + dz) * h),
                (0.05 * h, 0.026 * h, 0.05 * h),
                segs=12,
                rings=8,
            )
            extras.append(btn)

    active(body)
    for o in extras:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    smooth(body)
    log(f"joined {len(extras)} surface cards → verts={len(body.data.vertices)}")


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
    else:
        cam.location = (cx + h * 3.0, cy, cz)
    direction = Vector((cx, cy, cz)) - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render(path, view="front", wire=False):
    ART.mkdir(parents=True, exist_ok=True)
    body = bpy.data.objects["Bizzo"]
    wf = None
    if wire:
        wf = body.modifiers.new("Wire", "WIREFRAME")
        wf.thickness = 0.005
        wf.use_replace = False
    frame_camera(view)
    sc = bpy.context.scene
    sc.render.filepath = str(path)
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print("wrote", path, flush=True)
    if wf:
        body.modifiers.remove(wf)


def export_glb(path):
    body = bpy.data.objects["Bizzo"]
    active(body)
    # Apply subsurf for export; leave multires unapplied if present (export uses cage+subsurf)
    for mod in list(body.modifiers):
        if mod.type == "MULTIRES":
            body.modifiers.remove(mod)
            continue
        if mod.type == "WIREFRAME":
            body.modifiers.remove(mod)
            continue
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            print("apply", mod.name, e, flush=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_apply=True)
    print("wrote", path, "verts", len(body.data.vertices), flush=True)


def make_compare():
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return
    ref = REF_DIR / "ref_00_Ha3JhPE.png"
    if not ref.exists() or not OUT_FRONT.exists():
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
    b = crop_char(Image.open(OUT_FRONT))
    th = 1000

    def fit(im):
        r = th / im.height
        return im.resize((max(1, int(im.width * r)), th), Image.Resampling.LANCZOS)

    a, b = fit(a), fit(b)
    canvas = Image.new("RGBA", (a.width + b.width + 60, th + 60), (8, 8, 12, 255))
    canvas.paste(a, (20, 40), a)
    canvas.paste(b, (a.width + 40, 40), b)
    d = ImageDraw.Draw(canvas)
    d.text((20, 10), "Joey official ref", fill=(220, 220, 230, 255))
    d.text((a.width + 40, 10), "Preferred: connected topo", fill=(220, 220, 230, 255))
    canvas.save(OUT_CMP)
    log(f"compare → {OUT_CMP}")


def sync_demo():
    DEMO.mkdir(parents=True, exist_ok=True)
    for src, name in (
        (OUT_FRONT, "01_front.png"),
        (OUT_SIDE, "02_side.png"),
        (OUT_BACK, "03_back.png"),
        (OUT_CMP, "04_compare_ref_vs_ours.png"),
    ):
        if src.exists():
            (DEMO / name).write_bytes(src.read_bytes())
            log(f"demo ← {name}")


def main():
    global MON
    MON = Monitor.from_env(job="follow_joey_cat_topo", preview_samples=4)
    stages = 5
    try:
        clear()
        setup_scene()
        load_ref_planes()
        order = ["fur", "coat", "pink", "muzzle", "eye_white", "pupil", "brow", "sole", "mouth"]
        mats = {k: mat(k, v) for k, v in PAL.items()}
        mats_list = [mats[k] for k in order]
        idx = {k: i for i, k in enumerate(order)}

        MON.stage("build", index=1, total=stages, preview=False)
        body = build(mats_list, idx)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        ART.mkdir(parents=True, exist_ok=True)
        frame_camera("front")
        MON.preview(message="preferred topo front", force=True)

        MON.stage("save", index=2, total=stages, preview=False)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))

        MON.stage("renders", index=3, total=stages, preview=False)
        render(OUT_FRONT, "front")
        render(OUT_SIDE, "side")
        render(OUT_BACK, "back")
        make_compare()
        sync_demo()

        MON.stage("export", index=4, total=stages, preview=False)
        export_glb(OUT_GLB)

        MON.stage("final", index=5, total=stages, preview=False)
        frame_camera("front")
        MON.preview(message="final preferred topo", force=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
        MON.done("Preferred topo Bizzo complete")
    except Exception as e:
        if MON is not None:
            MON.fail(str(e))
        raise


if __name__ == "__main__":
    main()
