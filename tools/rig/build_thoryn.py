#!/usr/bin/env python3
"""Headless Blender build of Thoryn the Bladedrifter (Rimwalker hero).

Runs as the `bpy` module (pip install bpy) — no GUI. Builds a chunky KayKit-style
low-poly humanoid from primitives, rigid-skins it to a standard humanoid armature
(deterministic per-part weights — no heat-weight failures in headless), authors Idle
+ Walk actions, and exports a rigged, animated .glb to assets/models/rim_thoryn.glb.

Style target: the existing rigged roster (KayKit look) — blocky masses, flat hand-
painted color, emissive rune/edge accents. Rimwalker theme: forest green + heartwood
bark + ashen wraps + gold, and a curved heartwood blade with an ashfall-ember edge.

Run:  python3 tools/rig/build_thoryn.py
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector, Euler

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "models", "rim_thoryn.glb")
OUT = os.path.abspath(OUT)

# ----------------------------------------------------------------------------- palette
def C(hex6, a=1.0):
    r = ((hex6 >> 16) & 255) / 255.0
    g = ((hex6 >> 8) & 255) / 255.0
    b = (hex6 & 255) / 255.0
    # sRGB -> linear (Blender base_color is linear)
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)

PAL = {
    "skin":  0xcdbfae, "cloth": 0x2f4a34, "clothD": 0x243a29, "bark": 0x4a3726,
    "ash":   0x8b8577, "gold": 0xc9a24b, "hair": 0x2b2320, "ember": 0xff7a3c,
    "emberCore": 0xffd27a,
}

def make_mat(name, hex6, emit=None, emit_strength=0.0, metallic=0.0, rough=0.62):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = C(hex6)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = C(emit)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return m

MATS = {}
def mats():
    if MATS:
        return MATS
    MATS.update({
        "skin":  make_mat("thoryn_skin", PAL["skin"], rough=0.68),
        "cloth": make_mat("thoryn_cloth", PAL["cloth"], rough=0.7),
        "clothD": make_mat("thoryn_clothD", PAL["clothD"], rough=0.72),
        "bark":  make_mat("thoryn_bark", PAL["bark"], rough=0.75),
        "ash":   make_mat("thoryn_ash", PAL["ash"], rough=0.7),
        "gold":  make_mat("thoryn_gold", PAL["gold"], metallic=0.9, rough=0.34),
        "hair":  make_mat("thoryn_hair", PAL["hair"], rough=0.6),
        "ember": make_mat("thoryn_ember", PAL["emberCore"], emit=PAL["ember"], emit_strength=6.0, rough=0.4),
        "rune":  make_mat("thoryn_rune", PAL["emberCore"], emit=PAL["ember"], emit_strength=4.0, rough=0.5),
    })
    return MATS

# ----------------------------------------------------------------------------- geometry
PARTS = []   # list of (object, bone_group_name)

def _finish(bm, me):
    bm.to_mesh(me); bm.free()

def box(name, size, loc, mat, bone, bevel=0.02, rot=None):
    """Axis-aligned (optionally rotated) box with baked world coords, one material."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                        offset=bevel, segments=1, affect='EDGES', clamp_overlap=True)
    if rot:
        e = Euler(rot, 'XYZ')
        for v in bm.verts:
            v.co.rotate(e)
    for v in bm.verts:
        v.co += Vector(loc)
    _finish(bm, me)
    me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    PARTS.append((obj, bone))
    return obj

def cone(name, r1, r2, depth, loc, mat, bone, rot=None, verts=6):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r1, radius2=r2, depth=depth)
    if rot:
        e = Euler(rot, 'XYZ')
        for v in bm.verts:
            v.co.rotate(e)
    for v in bm.verts:
        v.co += Vector(loc)
    _finish(bm, me)
    me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    PARTS.append((obj, bone))
    return obj

def blade(name, loc, mat, bone):
    """A slim curved katana: two slightly angled tapered segments + a gold guard."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    # build a thin tapered quad-strip curving forward along +Z, width in X, thin in Y
    length = 0.92
    segs = 6
    prev = None
    for i in range(segs + 1):
        t = i / segs
        z = 0.14 + t * length
        curve = math.sin(t * 0.9) * 0.10           # gentle forward curve
        w = 0.032 * (1.0 - 0.55 * t)               # taper toward the tip
        y = curve
        ring = [bm.verts.new((-w, y - 0.012, z)), bm.verts.new((w, y - 0.012, z)),
                bm.verts.new((w, y + 0.012, z)), bm.verts.new((-w, y + 0.012, z))]
        if prev:
            for a in range(4):
                bm.faces.new((prev[a], prev[(a + 1) % 4], ring[(a + 1) % 4], ring[a]))
        prev = ring
    # tip cap
    tip = bm.verts.new((0, prev[0].co.y, 0.14 + length + 0.06))
    for a in range(4):
        bm.faces.new((prev[a], prev[(a + 1) % 4], tip))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for v in bm.verts:
        v.co += Vector(loc)
    _finish(bm, me)
    me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    PARTS.append((obj, bone))
    return obj

def build_body():
    M = mats()
    # ---- legs (bark trousers, ash shin wraps, boxy feet) ----
    for s in (-1, 1):
        x = 0.16 * s
        box(f"thigh_{s}", (0.20, 0.22, 0.44), (x, 0, 0.72), M["cloth"], f"UpperLeg_{'L' if s<0 else 'R'}")
        box(f"shin_{s}", (0.17, 0.19, 0.42), (x, 0.01, 0.30), M["bark"], f"LowerLeg_{'L' if s<0 else 'R'}")
        box(f"wrap_{s}", (0.19, 0.21, 0.07), (x, 0.01, 0.16), M["ash"], f"LowerLeg_{'L' if s<0 else 'R'}")
        box(f"foot_{s}", (0.18, 0.30, 0.12), (x, 0.09, 0.06), M["bark"], f"Foot_{'L' if s<0 else 'R'}")
    # ---- pelvis / hips ----
    box("pelvis", (0.44, 0.28, 0.24), (0, 0, 0.98), M["cloth"], "Hips")
    box("obi", (0.46, 0.30, 0.10), (0, 0, 1.02), M["ash"], "Hips")
    # ---- torso: lower (Spine) + upper chest (Chest), forest-green wrap ----
    box("torsoLo", (0.42, 0.26, 0.26), (0, 0, 1.20), M["cloth"], "Spine")
    box("torsoHi", (0.50, 0.30, 0.30), (0, 0, 1.44), M["cloth"], "Chest")
    # diagonal chest sash (ash) + gold clasp + glowing rune
    box("sash", (0.13, 0.02, 0.66), (0, 0.17, 1.28), M["ash"], "Chest", bevel=0.0, rot=(0, 0.6, 0))
    box("clasp", (0.09, 0.06, 0.09), (0.14, 0.18, 1.10), M["gold"], "Chest", bevel=0.0)
    box("rune", (0.11, 0.02, 0.14), (-0.10, 0.17, 1.40), M["rune"], "Chest", bevel=0.0)
    # ---- neck + head ----
    box("neck", (0.15, 0.15, 0.14), (0, 0, 1.60), M["skin"], "Neck")
    box("head", (0.34, 0.34, 0.36), (0, 0.01, 1.82), M["skin"], "Head", bevel=0.05)
    # elf ears
    for s in (-1, 1):
        cone(f"ear_{s}", 0.10, 0.005, 0.30, (0.19 * s, -0.02, 1.86), M["skin"], "Head",
             rot=(0, s * 0.5, s * 0.6), verts=4)
    # hair: back volume + top + a back ponytail block
    box("hairBack", (0.36, 0.24, 0.34), (0, -0.10, 1.84), M["hair"], "Head", bevel=0.06)
    box("hairTop", (0.34, 0.30, 0.10), (0, 0.02, 1.99), M["hair"], "Head", bevel=0.05)
    box("ponytail", (0.10, 0.12, 0.34), (0, -0.20, 1.74), M["hair"], "Head", bevel=0.04, rot=(0.5, 0, 0))
    # eyes: small emissive amber
    for s in (-1, 1):
        box(f"eye_{s}", (0.06, 0.02, 0.05), (0.09 * s, 0.18, 1.84), M["rune"], "Head", bevel=0.0)
    # ---- shoulders / arms ----
    for s in (-1, 1):
        side = 'L' if s < 0 else 'R'
        sx = 0.30 * s
        box(f"pauld_{s}", (0.18, 0.24, 0.18), (sx, 0, 1.55), M["bark"], "Chest", bevel=0.05)
        box(f"uarm_{s}", (0.14, 0.15, 0.34), (sx + 0.02 * s, 0, 1.34), M["cloth"], f"UpperArm_{side}")
        box(f"larm_{s}", (0.12, 0.13, 0.32), (sx + 0.04 * s, 0.02, 1.06), M["skin"], f"LowerArm_{side}")
        box(f"wristwrap_{s}", (0.13, 0.14, 0.06), (sx + 0.05 * s, 0.02, 0.92), M["ash"], f"LowerArm_{side}")
        box(f"hand_{s}", (0.11, 0.13, 0.12), (sx + 0.05 * s, 0.03, 0.85), M["skin"], f"Hand_{side}")
    # ---- katana in the right hand (weighted to Hand_R so it follows the hand) ----
    grip_loc = (0.35, 0.03, 0.80)
    box("grip", (0.045, 0.045, 0.24), grip_loc, M["ash"], "Hand_R", bevel=0.0)
    cone("guard", 0.10, 0.10, 0.04, (0.35, 0.03, 0.93), M["gold"], "Hand_R", rot=(math.pi / 2, 0, 0), verts=8)
    blade("katana", (0.35, 0.03, 0.93), M["ember"], "Hand_R")

# ----------------------------------------------------------------------------- armature
BONES = [
    # name, head, tail, parent
    ("Root", (0, 0, 0), (0, 0, 0.06), None),
    ("Hips", (0, 0, 0.98), (0, 0, 1.14), "Root"),
    ("Spine", (0, 0, 1.14), (0, 0, 1.34), "Hips"),
    ("Chest", (0, 0, 1.34), (0, 0, 1.56), "Spine"),
    ("Neck", (0, 0, 1.56), (0, 0, 1.66), "Chest"),
    ("Head", (0, 0, 1.66), (0, 0, 2.02), "Neck"),
]
def _limbs():
    b = []
    for s, side in ((-1, "L"), (1, "R")):
        x = 0.30 * s
        b += [
            (f"Shoulder_{side}", (0.10 * s, 0, 1.50), (x, 0, 1.50), "Chest"),
            (f"UpperArm_{side}", (x, 0, 1.50), (x + 0.03 * s, 0, 1.18), f"Shoulder_{side}"),
            (f"LowerArm_{side}", (x + 0.03 * s, 0, 1.18), (x + 0.06 * s, 0.02, 0.90), f"UpperArm_{side}"),
            (f"Hand_{side}", (x + 0.06 * s, 0.02, 0.90), (x + 0.07 * s, 0.05, 0.78), f"LowerArm_{side}"),
            (f"UpperLeg_{side}", (0.16 * s, 0, 0.96), (0.16 * s, 0, 0.52), "Hips"),
            (f"LowerLeg_{side}", (0.16 * s, 0, 0.52), (0.16 * s, 0.01, 0.12), f"UpperLeg_{side}"),
            (f"Foot_{side}", (0.16 * s, 0.01, 0.12), (0.16 * s, 0.22, 0.06), f"LowerLeg_{side}"),
        ]
    return b
BONES += _limbs()

def build_armature():
    arm_data = bpy.data.armatures.new("Thoryn_rig")
    arm_obj = bpy.data.objects.new("Thoryn_rig", arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    made = {}
    for name, head, tail, parent in BONES:
        b = eb.new(name)
        b.head = Vector(head); b.tail = Vector(tail)
        b.use_deform = (name != "Root")
        made[name] = b
    for name, head, tail, parent in BONES:
        if parent:
            made[name].parent = made[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

# ----------------------------------------------------------------------------- skin
def skin(arm_obj):
    # per-part rigid vertex group, then join into one mesh
    objs = []
    for obj, bone in PARTS:
        vg = obj.vertex_groups.new(name=bone)
        vg.add([v.index for v in obj.data.vertices], 1.0, 'REPLACE')
        objs.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    body = objs[0]
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = "Thoryn"
    # parent to armature using EXISTING groups (rigid, deterministic — no heat weighting)
    body.parent = arm_obj
    mod = body.modifiers.new("Armature", 'ARMATURE')
    mod.object = arm_obj
    mod.use_vertex_groups = True
    # shade: mostly flat with a couple smooth masses reads KayKit-ish; keep flat for v1
    return body

# ----------------------------------------------------------------------------- anim
def _pb(arm, name):
    pb = arm.pose.bones[name]
    pb.rotation_mode = 'XYZ'
    return pb

def key(arm, frame, poses):
    for name, rot in poses.items():
        pb = _pb(arm, name)
        pb.rotation_euler = Euler(rot, 'XYZ')
        pb.keyframe_insert("rotation_euler", frame=frame)
        if name == "Hips":
            pass

def key_loc(arm, frame, name, loc):
    pb = arm.pose.bones[name]
    pb.location = Vector(loc)
    pb.keyframe_insert("location", frame=frame)

def make_action(arm, name):
    if not arm.animation_data:
        arm.animation_data_create()
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    return act

def anim_idle(arm):
    act = make_action(arm, "Idle")
    # gentle bremath + blade-ready sway over 48 frames
    for f, amt in ((1, 0.0), (24, 1.0), (48, 0.0)):
        key(arm, f, {
            "Chest": (0.04 * amt, 0, 0),
            "Head": (0.03 * amt, 0, 0),
            "UpperArm_R": (0.0, 0.0, -0.10 - 0.04 * amt),
            "UpperArm_L": (0.0, 0.0, 0.10 + 0.04 * amt),
            "Spine": (0.02 * amt, 0, 0),
        })
        key_loc(arm, f, "Hips", (0, 0, -0.02 * amt))
    act.use_fake_user = True
    return act

def anim_walk(arm):
    act = make_action(arm, "Walk")
    frames = [1, 9, 17, 25]   # 24-frame loop (1==25 pose)
    swing = [(0.5, -0.5), (-0.5, 0.5), (0.5, -0.5), (0.5, -0.5)]
    for i, f in enumerate(frames):
        rL, rR = swing[i]
        key(arm, f, {
            "UpperLeg_L": (rL, 0, 0), "LowerLeg_L": (max(0, -rL) * 0.8, 0, 0),
            "UpperLeg_R": (rR, 0, 0), "LowerLeg_R": (max(0, -rR) * 0.8, 0, 0),
            "UpperArm_L": (-rL * 0.7, 0, 0.12), "UpperArm_R": (-rR * 0.7, 0, -0.12),
            "Chest": (0.05, 0, 0),
        })
        key_loc(arm, f, "Hips", (0, 0, -0.03 + (0.03 if i % 2 else 0.0)))
    act.use_fake_user = True
    return act

def stash_to_nla(arm, actions):
    ad = arm.animation_data
    ad.action = None
    for act in actions:
        tr = ad.nla_tracks.new()
        tr.name = act.name
        tr.strips.new(act.name, int(act.frame_range[0]), act)

# ----------------------------------------------------------------------------- main
def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions):
        for blk in list(coll):
            if blk.users == 0:
                coll.remove(blk)

def main():
    clear_scene()
    build_body()
    arm = build_armature()
    body = skin(arm)
    idle = anim_idle(arm)
    walk = anim_walk(arm)
    stash_to_nla(arm, [idle, walk])
    bpy.context.scene.frame_set(1)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format='GLB',
        export_yup=True, use_selection=True,
        export_apply=True,
        export_animations=True, export_animation_mode='NLA_TRACKS',
        export_nla_strips=True,
    )
    print("EXPORTED", OUT, os.path.getsize(OUT), "bytes")

if __name__ == "__main__":
    main()
