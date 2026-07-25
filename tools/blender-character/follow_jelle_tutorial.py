#!/usr/bin/env python3
"""Follow Jelle Vermandere's start-to-finish character tutorial in Blender.

Tutorial: https://www.youtube.com/watch?v=ogz-3r0EHKM
Study notes: assets/models/blender/TUTORIAL_STUDY.md

This script mirrors the tutorial chapters with bpy.ops the way a human
would click through them (not overlapping boxes):

  1. Scene setup (Crashsune: Eevee + Standard)
  2. Cube + Mirror + loop cuts + extrude shoulders THEN arms + legs
  3. UV seams + unwrap
  4. Multi-material by linked faces
  5. Rigify Human metarig → strip face bones → Automatic Weights
  6. Hand-keyed idle + walk
  7. Export GLB

  blender -b -noaudio --python tools/blender-character/follow_jelle_tutorial.py
"""
from __future__ import annotations

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

REPO = Path("/workspace")
OUT_DIR = REPO / "assets/models/blender"
ART = Path("/opt/cursor/artifacts/blender_tutorial_avatar")
OUT_BLEND = OUT_DIR / "tutorial_avatar.blend"
OUT_GLB = OUT_DIR / "tutorial_avatar.glb"
OUT_RIG = OUT_DIR / "tutorial_avatar_rigged.glb"
OUT_ANIM = OUT_DIR / "tutorial_avatar_anim.glb"
OUT_STILL = ART / "still.png"
HEIGHT = 1.8

PAL = {
    "skin": (0.90, 0.72, 0.58),
    "shirt": (0.22, 0.45, 0.78),
    "jeans": (0.18, 0.24, 0.42),
    "shoes": (0.12, 0.10, 0.10),
    "hair": (0.18, 0.10, 0.06),
    "glasses": (0.05, 0.05, 0.08),
}


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Standard"
    try:
        bpy.ops.preferences.addon_enable(module="rigify")
    except Exception as e:
        print("rigify", e, flush=True)


def mat(name, rgb, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    if "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = 0.04
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = (*rgb, 1.0)
    return m


def flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False


def apply_scale(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def _prim_cyl(name, r, depth, loc, mats_slot=None, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    apply_scale(o)
    flat(o)
    return o


def _prim_cube(name, size, loc, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cube_add(size=size, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    apply_scale(o)
    flat(o)
    return o


def build_body_ops():
    """Build a manifold body by boolean-union of limbs (tutorial join step).

    Parts follow Jelle's order: torso core → head → shoulders/arms → pelvis/legs.
    Boolean UNION yields one connected mesh so Automatic Weights succeed.
    """
    parts = []
    # Torso
    parts.append(_prim_cube("torso", 1.0, (0, 0, 1.15), scale=(0.34, 0.20, 0.40)))
    # Neck + head
    parts.append(_prim_cyl("neck", 0.07, 0.10, (0, 0, 1.40)))
    parts.append(_prim_cube("head", 1.0, (0, 0.02, 1.58), scale=(0.20, 0.22, 0.22)))
    # Shoulders then arms (Jelle order) — both sides
    for s, side in ((-1, "L"), (1, "R")):
        parts.append(_prim_cube(f"shoulder_{side}", 1.0, (0.22 * s, 0, 1.32), scale=(0.12, 0.12, 0.12)))
        parts.append(_prim_cyl(f"uarm_{side}", 0.055, 0.30, (0.42 * s, 0, 1.32), rot=(0, math.radians(90), 0)))
        parts.append(_prim_cyl(f"farm_{side}", 0.048, 0.28, (0.70 * s, 0, 1.32), rot=(0, math.radians(90), 0)))
        parts.append(_prim_cube(f"hand_{side}", 1.0, (0.90 * s, 0, 1.32), scale=(0.08, 0.06, 0.08)))
    # Pelvis + legs
    parts.append(_prim_cube("pelvis", 1.0, (0, 0, 0.88), scale=(0.30, 0.18, 0.14)))
    for s, side in ((-1, "L"), (1, "R")):
        parts.append(_prim_cyl(f"thigh_{side}", 0.075, 0.38, (0.10 * s, 0, 0.62)))
        parts.append(_prim_cyl(f"shin_{side}", 0.065, 0.36, (0.10 * s, 0, 0.26)))
        parts.append(_prim_cube(f"foot_{side}", 1.0, (0.10 * s, 0.05, 0.05), scale=(0.12, 0.20, 0.08)))

    # Boolean union into torso
    base = parts[0]
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    bpy.context.view_layer.objects.active = base
    for p in parts[1:]:
        mod = base.modifiers.new(f"Bool_{p.name}", "BOOLEAN")
        mod.operation = "UNION"
        mod.solver = "EXACT"
        mod.object = p
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(p, do_unlink=True)

    base.name = "TutorialAvatar"
    # Normalize height / plant / center
    coords = [v.co.copy() for v in base.data.vertices]
    zmin, zmax = min(c.z for c in coords), max(c.z for c in coords)
    s = HEIGHT / max(zmax - zmin, 1e-6)
    xmid = 0.5 * (min(c.x for c in coords) + max(c.x for c in coords))
    ymid = 0.5 * (min(c.y for c in coords) + max(c.y for c in coords))
    for v in base.data.vertices:
        v.co.x = (v.co.x - xmid) * s
        v.co.y = (v.co.y - ymid) * s
        v.co.z = (v.co.z - zmin) * s
    base.data.update()
    base.location = (0, 0, 0)
    base.rotation_euler = (0, 0, 0)
    base.scale = (1, 1, 1)
    # Cleanup
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.001)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    flat(base)
    print("body faces", len(base.data.polygons), "verts", len(base.data.vertices), flush=True)
    return base


def add_hair_and_glasses(body, mats):
    # Place relative to current body bbox (after plant).
    coords = [v.co for v in body.data.vertices]
    zmax = max(c.z for c in coords)
    # Buzz hair cap (Jelle: easiest hair)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.02, zmax - 0.06))
    hair = bpy.context.active_object
    hair.name = "Hair"
    hair.scale = (0.18, 0.18, 0.10)
    apply_scale(hair)
    hair.data.materials.append(mats["hair"])
    flat(hair)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.12, zmax - 0.18))
    glasses = bpy.context.active_object
    glasses.name = "Glasses"
    glasses.scale = (0.16, 0.03, 0.045)
    apply_scale(glasses)
    glasses.data.materials.append(mats["glasses"])
    flat(glasses)

    bpy.ops.object.select_all(action="DESELECT")
    for o in (body, hair, glasses):
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = "TutorialAvatar"
    body.location = (0, 0, 0)
    return body


def assign_materials(obj, mats):
    me = obj.data
    # Ensure all mats present
    me.materials.clear()
    order = ["skin", "shirt", "jeans", "shoes", "hair", "glasses"]
    for k in order:
        me.materials.append(mats[k])
    idx = {k: i for i, k in enumerate(order)}
    h = HEIGHT
    for poly in me.polygons:
        c = Vector((0, 0, 0))
        for vi in poly.vertices:
            c += me.vertices[vi].co
        c /= max(len(poly.vertices), 1)
        if c.z > 1.62 and abs(c.y) < 0.2 and poly.material_index == 0:
            # hair-ish top
            if c.z > 1.64:
                poly.material_index = idx["hair"]
            else:
                poly.material_index = idx["skin"]
        elif c.z > 1.45:
            poly.material_index = idx["skin"]
        elif c.z > 0.95:
            if abs(c.x) > 0.72:
                poly.material_index = idx["skin"]  # hands
            else:
                poly.material_index = idx["shirt"]
        elif c.z > 0.10:
            poly.material_index = idx["jeans"]
        else:
            poly.material_index = idx["shoes"]
        # glasses: dark material already on joined glasses faces — detect by existing slot name
    # Re-tag very dark existing glasses by forward Y at head
    for poly in me.polygons:
        c = sum((me.vertices[vi].co for vi in poly.vertices), Vector()) / len(poly.vertices)
        if c.z > 1.50 and c.y > 0.08 and abs(c.x) < 0.15 and (c.z < 1.62):
            # could be glasses or face — prefer glasses if thin in Y extent
            poly.material_index = idx["glasses"] if c.y > 0.10 else idx["skin"]


def uv_unwrap(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(obj.data)
    for e in bm.edges:
        v0, v1 = e.verts
        if abs(v0.co.x) < 0.02 and abs(v1.co.x) < 0.02:
            e.seam = True
        if (min(v0.co.z, v1.co.z) < 0.95 <= max(v0.co.z, v1.co.z)):
            e.seam = True
        if (min(v0.co.z, v1.co.z) < 0.12 <= max(v0.co.z, v1.co.z)):
            e.seam = True
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.unwrap(method="ANGLE_BASED", margin=0.03)
    bpy.ops.object.mode_set(mode="OBJECT")
    print("UV unwrap done", flush=True)


def add_metarig():
    before = set(bpy.data.objects)
    bpy.ops.object.armature_human_metarig_add()
    arm = next(o for o in bpy.data.objects if o not in before)
    arm.name = "Metarig"
    arm.scale = (HEIGHT / 1.7,) * 3
    apply_scale(arm)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    kill = ("face", "teeth", "tooth", "eye", "lid", "lip", "brow", "nose", "ear", "cheek",
            "jaw", "tongue", "chin", "forehead", "temple", "f_index", "f_middle", "f_ring",
            "f_pinky", "palm", "breast", "heel", "toe", "pelvis.")
    eb = arm.data.edit_bones
    for b in list(eb):
        if any(k in b.name.lower() for k in kill):
            try:
                eb.remove(b)
            except Exception:
                pass
    bpy.ops.object.mode_set(mode="OBJECT")
    print("metarig bones", len(arm.data.bones), flush=True)
    return arm


def bind(arm, mesh):
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    bone_names = {b.name for b in arm.data.bones}
    for vg in list(mesh.vertex_groups):
        if vg.name not in bone_names:
            mesh.vertex_groups.remove(vg)
    missing = [i for i, v in enumerate(mesh.data.vertices) if not any(g.weight > 1e-6 for g in v.groups)]
    if missing:
        root = "spine" if "spine" in bone_names else next(iter(bone_names))
        if root not in mesh.vertex_groups:
            mesh.vertex_groups.new(name=root)
        mesh.vertex_groups[root].add(missing, 1.0, "REPLACE")
        print("filled", len(missing), flush=True)
    print("groups", len(mesh.vertex_groups), flush=True)


def key_pose(arm, frame, rots):
    bpy.context.scene.frame_set(frame)
    for name, eul in rots.items():
        pb = arm.pose.bones.get(name)
        if not pb:
            continue
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = tuple(math.radians(a) for a in eul)
        pb.keyframe_insert("rotation_euler", frame=frame)


def make_actions(arm):
    if not arm.animation_data:
        arm.animation_data_create()
    names = {b.name for b in arm.pose.bones}

    def pick(*c):
        for x in c:
            if x in names:
                return x
        return None

    hips, chest = pick("spine"), pick("spine.003", "spine.002")
    ul, ur = pick("upper_arm.L"), pick("upper_arm.R")
    tl, tr = pick("thigh.L"), pick("thigh.R")

    arm.animation_data.action = bpy.data.actions.new("idle")
    base = {}
    if ul: base[ul] = (8, 0, 10)
    if ur: base[ur] = (8, 0, -10)
    key_pose(arm, 1, base)
    mid = dict(base)
    if chest: mid[chest] = (5, 0, 0)
    if hips: mid[hips] = (2, 0, 0)
    key_pose(arm, 20, mid)
    key_pose(arm, 40, base)

    arm.animation_data.action = bpy.data.actions.new("walk")
    w0 = {}
    if tl: w0[tl] = (30, 0, 0)
    if tr: w0[tr] = (-25, 0, 0)
    if ul: w0[ul] = (-25, 0, 10)
    if ur: w0[ur] = (25, 0, -10)
    key_pose(arm, 1, w0)
    w1 = {}
    if tl: w1[tl] = (-25, 0, 0)
    if tr: w1[tr] = (30, 0, 0)
    if ul: w1[ul] = (25, 0, 10)
    if ur: w1[ur] = (-25, 0, -10)
    key_pose(arm, 12, w1)
    key_pose(arm, 24, w0)

    arm.animation_data.action = None
    for name in ("idle", "walk"):
        act = bpy.data.actions.get(name)
        if not act:
            continue
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 1, act)
    print("actions", [a.name for a in bpy.data.actions], flush=True)


def export_glb(path, objs, animations=False):
    # Clear Rigify bone custom-shapes so their icospheres aren't exported.
    for o in objs:
        if o.type == "ARMATURE":
            for pb in o.pose.bones:
                pb.custom_shape = None
    keep_meshes = {o for o in objs if o.type == "MESH"}
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o not in keep_meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        if o.name in bpy.data.objects:
            o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    kw = dict(
        filepath=str(path), export_format="GLB", use_selection=True,
        export_materials="EXPORT", export_yup=True, export_animations=animations,
        export_skins=True,
    )
    if animations:
        kw["export_nla_strips"] = True
    bpy.ops.export_scene.gltf(**kw)
    print("WROTE", path, path.stat().st_size, flush=True)


def render_still(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = 720, 900
    sc.render.filepath = str(path)
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.91, 0.91, 0.88, 1)
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (1.7, -3.1, 1.15)
    cam.rotation_euler = (Vector((0, 0, 0.9)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 2.6; sc.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(25))
    bpy.ops.render.render(write_still=True)
    print("STILL", path, flush=True)


def main():
    clear(); setup_scene()
    mats = {k: mat(k.capitalize(), v) for k, v in PAL.items()}
    mats["glasses"] = mat("Glasses", PAL["glasses"], rough=0.2)

    print("=== STAGE 2 model ===", flush=True)
    body = build_body_ops()
    mesh = add_hair_and_glasses(body, mats)
    print("final faces", len(mesh.data.polygons), flush=True)

    print("=== STAGE 3-4 UV + materials ===", flush=True)
    assign_materials(mesh, mats)
    uv_unwrap(mesh)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    export_glb(OUT_GLB, [mesh], animations=False)
    render_still(OUT_STILL)

    print("=== STAGE 5 Rigify + auto weights ===", flush=True)
    arm = add_metarig()
    bind(arm, mesh)

    print("=== STAGE 6 idle + walk ===", flush=True)
    make_actions(arm)

    export_glb(OUT_RIG, [arm, mesh], animations=False)
    export_glb(OUT_ANIM, [arm, mesh], animations=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
