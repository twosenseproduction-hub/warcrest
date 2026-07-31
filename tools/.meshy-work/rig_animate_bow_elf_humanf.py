#!/usr/bin/env python3
"""DIY rig + animate Drive clay bow elf on HumanF pack skeleton.

  blender -b -noaudio --python tools/.meshy-work/rig_animate_bow_elf_humanf.py
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector

REPO = Path("/workspace")
RAW = REPO / "assets/models/meshy/bow_elf_meshy_raw.glb"
HUMANF = REPO / "tools/.meshy-work/drive_anims_extracted/Models/HumanF_Model.fbx"
ANIMS = REPO / "tools/.meshy-work/drive_anims_extracted/Animations/Female"
OUT_RIG = REPO / "assets/models/meshy/bow_elf_meshy_rigged.glb"
OUT_ANIM = REPO / "assets/models/meshy/bow_elf_meshy_pack_anim.glb"
TARGET_FACES = 70000
HEIGHT = 1.7

CLIP_REL = [
    ("Idles/HumanF@Idle01.fbx", "idle"),
    ("Combat/Bow/HumanF@BowIdle01.fbx", "bow_idle"),
    ("Combat/Bow/HumanF@BowIdle02.fbx", "bow_idle_alt"),
    ("Combat/Bow/HumanF@BowShot01 - Load.fbx", "attack_load"),
    ("Combat/Bow/HumanF@BowShot01 - Hold.fbx", "attack_hold"),
    ("Combat/Bow/HumanF@BowShot01 - Release.fbx", "attack_release"),
    ("Movement/Walk/HumanF@Walk01_Forward.fbx", "walk"),
    ("Movement/Run/HumanF@Run01_Forward.fbx", "run"),
]


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mesh_bbox(obj):
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = Vector((min(c[i] for c in coords) for i in range(3)))
    mx = Vector((max(c[i] for c in coords) for i in range(3)))
    return mn, mx


def apply_scale(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def apply_all(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def hips_head_delta(arm):
    h0 = arm.matrix_world @ arm.data.bones["B-hips"].head_local
    h1 = arm.matrix_world @ arm.data.bones["B-head"].head_local
    return h1 - h0


def make_axis_fix_empty(arm, name="AxisFix"):
    empty = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(empty)
    d = hips_head_delta(arm)
    if abs(d.y) > abs(d.z) and abs(d.y) > abs(d.x):
        empty.rotation_euler[0] = math.radians(-90 if d.y < 0 else 90)
    arm.parent = empty
    bpy.context.view_layer.update()
    d2 = hips_head_delta(arm)
    if d2.z < 0:
        empty.rotation_euler[0] += math.radians(180)
        bpy.context.view_layer.update()
        d2 = hips_head_delta(arm)
    print(name, "hips→head", tuple(round(x, 3) for x in d2), flush=True)
    return empty


def plant_mesh(mesh):
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    mod = mesh.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = TARGET_FACES / max(len(mesh.data.polygons), 1)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print("faces", len(mesh.data.polygons), flush=True)
    mn, mx = mesh_bbox(mesh)
    mesh.scale *= HEIGHT / (mx.z - mn.z)
    apply_all(mesh)
    mn, mx = mesh_bbox(mesh)
    mesh.location = Vector((-(mn.x + mx.x) * 0.5, -(mn.y + mx.y) * 0.5, -mn.z))
    apply_all(mesh)
    print("mesh", tuple(round(x, 3) for x in mesh_bbox(mesh)[0]), tuple(round(x, 3) for x in mesh_bbox(mesh)[1]), flush=True)


def clay_material(mesh):
    img = bpy.data.images.new("clay", 16, 16)
    img.pixels = [0.82, 0.80, 0.78, 1.0] * (16 * 16)
    img.pack()
    mat = bpy.data.materials.new("Clay")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    bsdf.inputs["Roughness"].default_value = 0.9
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], outn.inputs["Surface"])
    mesh.data.materials.clear()
    mesh.data.materials.append(mat)


def import_humanf_armature():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(
        filepath=str(HUMANF), automatic_bone_orientation=True, use_anim=False
    )
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    for o in list(new):
        if o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    arm.name = "Armature"
    apply_scale(arm)
    return arm


def fit_empty(arm, mesh, empty):
    mesh_mn, mesh_mx = mesh_bbox(mesh)
    mesh_h = mesh_mx.z - mesh_mn.z
    toe = arm.data.bones.get("B-toe.L") or arm.data.bones.get("B-foot.L")
    arm_h = abs(
        (arm.matrix_world @ arm.data.bones["B-head"].head_local).z
        - (arm.matrix_world @ toe.head_local).z
    ) or 1.0
    empty.scale *= mesh_h / arm_h
    bpy.context.view_layer.update()

    zs = [(arm.matrix_world @ b.head_local).z for b in arm.data.bones]
    xs = [(arm.matrix_world @ b.head_local).x for b in arm.data.bones]
    ys = [(arm.matrix_world @ b.head_local).y for b in arm.data.bones]
    empty.location -= Vector(((min(xs) + max(xs)) * 0.5, (min(ys) + max(ys)) * 0.5, min(zs)))
    bpy.context.view_layer.update()
    hips_z = (arm.matrix_world @ arm.data.bones["B-hips"].head_local).z
    empty.location.z += 0.55 * mesh_h - hips_z
    bpy.context.view_layer.update()
    hz = arm.matrix_world @ arm.data.bones["B-hips"].head_local
    hd = arm.matrix_world @ arm.data.bones["B-head"].head_local
    print("fit hips", tuple(round(x, 3) for x in hz), "head", tuple(round(x, 3) for x in hd), flush=True)


def bind_mesh(arm, mesh):
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    print("bound groups", len(mesh.vertex_groups), flush=True)


def purge_extras(keep):
    keep_set = set(keep)
    for o in list(bpy.data.objects):
        if o not in keep_set and o.type in ("MESH", "EMPTY"):
            # keep AxisFixRoot if listed
            if o.type == "MESH" or (o.type == "EMPTY" and o not in keep_set):
                if o not in keep_set:
                    bpy.data.objects.remove(o, do_unlink=True)


def strip_loc_scale(act):
    for fc in list(act.fcurves):
        dp = fc.data_path
        if (
            dp.endswith(".location")
            or dp == "location"
            or dp.endswith(".scale")
            or dp == "scale"
            or 'pose.bones["B-root"]' in dp
            or 'pose.bones["B-spineProxy"]' in dp
        ):
            act.fcurves.remove(fc)


def append_clip(dst_arm, fbx_path: Path, name: str):
    before_objs = set(bpy.data.objects)
    before_acts = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(
        filepath=str(fbx_path), automatic_bone_orientation=True, use_anim=True
    )
    new_objs = [o for o in bpy.data.objects if o not in before_objs]
    src_arm = next((o for o in new_objs if o.type == "ARMATURE"), None)
    new_acts = [a for a in bpy.data.actions if a not in before_acts]
    src_act = None
    if src_arm and src_arm.animation_data and src_arm.animation_data.action:
        src_act = src_arm.animation_data.action
    elif new_acts:
        src_act = new_acts[0]
    if not src_arm or not src_act:
        print("NO ACTION", fbx_path, flush=True)
        for o in new_objs:
            bpy.data.objects.remove(o, do_unlink=True)
        return None

    apply_scale(src_arm)
    fix = make_axis_fix_empty(src_arm, name=f"Fix_{name}")

    def height(a):
        toe = a.data.bones.get("B-toe.L") or a.data.bones.get("B-foot.L")
        return abs(
            (a.matrix_world @ a.data.bones["B-head"].head_local).z
            - (a.matrix_world @ toe.head_local).z
        )

    sh, dh = height(src_arm), height(dst_arm)
    if sh > 1e-6:
        fix.scale *= dh / sh
        bpy.context.view_layer.update()
    fix.location += (dst_arm.matrix_world @ dst_arm.pose.bones["B-hips"].head) - (
        src_arm.matrix_world @ src_arm.pose.bones["B-hips"].head
    )
    bpy.context.view_layer.update()

    for pb in dst_arm.pose.bones:
        while pb.constraints:
            pb.constraints.remove(pb.constraints[0])
    if not dst_arm.animation_data:
        dst_arm.animation_data_create()
    dst_arm.animation_data.action = None

    for pb in dst_arm.pose.bones:
        if pb.name in ("B-root", "B-spineProxy") or pb.name not in src_arm.pose.bones:
            continue
        c = pb.constraints.new("COPY_ROTATION")
        c.target = src_arm
        c.subtarget = pb.name
        c.target_space = "WORLD"
        c.owner_space = "WORLD"
        c.mix_mode = "REPLACE"

    f0, f1 = int(src_act.frame_range[0]), int(src_act.frame_range[1])
    if f1 <= f0:
        f1 = f0 + 1
    bpy.ops.object.select_all(action="DESELECT")
    dst_arm.select_set(True)
    bpy.context.view_layer.objects.active = dst_arm
    bpy.ops.nla.bake(
        frame_start=f0,
        frame_end=f1,
        only_selected=False,
        visual_keying=True,
        clear_constraints=True,
        clear_parents=False,
        use_current_action=False,
        bake_types={"POSE"},
    )
    baked = dst_arm.animation_data.action if dst_arm.animation_data else None
    ok = False
    if baked:
        baked.name = name
        strip_loc_scale(baked)
        print(f"BAKED {name} {f0}-{f1}", flush=True)
        ok = True
    else:
        print("BAKE FAIL", name, flush=True)

    for pb in dst_arm.pose.bones:
        while pb.constraints:
            pb.constraints.remove(pb.constraints[0])
    if dst_arm.animation_data:
        dst_arm.animation_data.action = None

    cleanup = list(new_objs) + [fix]
    for o in cleanup:
        try:
            if o and o.name in bpy.data.objects:
                bpy.data.objects.remove(o, do_unlink=True)
        except Exception:
            pass
    for a in new_acts:
        try:
            if a and a.users == 0:
                bpy.data.actions.remove(a)
        except Exception:
            pass
    return name if ok else None


def export_hierarchy(path: Path, root, arm, mesh, animations=False):
    """Export root (axis empty) + armature + mesh so Z-up comes from the empty."""
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o != mesh:
            bpy.data.objects.remove(o, do_unlink=True)
        elif o.type == "EMPTY" and o != root:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = root
    kwargs = dict(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_skins=True,
        export_materials="EXPORT",
        export_yup=True,
        export_animations=animations,
    )
    if animations:
        kwargs["export_nla_strips"] = True
    bpy.ops.export_scene.gltf(**kwargs)
    print("WROTE", path, path.stat().st_size, flush=True)


def main():
    clear()
    bpy.ops.import_scene.gltf(filepath=str(RAW))
    mesh = next(o for o in bpy.data.objects if o.type == "MESH")
    mesh.name = "bow_elf"
    plant_mesh(mesh)
    clay_material(mesh)

    arm = import_humanf_armature()
    root = make_axis_fix_empty(arm, name="AxisFixRoot")
    fit_empty(arm, mesh, root)
    bind_mesh(arm, mesh)

    # Bake clips while dst still under AxisFixRoot (world Z-up)
    kept = []
    for rel, name in CLIP_REL:
        path = ANIMS / rel
        if not path.is_file():
            print("MISSING", path, flush=True)
            continue
        n = append_clip(arm, path, name)
        if n:
            kept.append(n)

    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = None
    for act in list(bpy.data.actions):
        if act.name not in kept:
            bpy.data.actions.remove(act)
    while arm.animation_data.nla_tracks:
        arm.animation_data.nla_tracks.remove(arm.animation_data.nla_tracks[0])
    for name in kept:
        act = bpy.data.actions.get(name)
        if not act:
            continue
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, int(act.frame_range[0]), act)

    # Sanity: sample idle hips
    for t in arm.animation_data.nla_tracks:
        t.mute = t.name != "idle"
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    hips = arm.matrix_world @ arm.pose.bones["B-hips"].head
    head = arm.matrix_world @ arm.pose.bones["B-head"].head
    print("sample idle hips", tuple(round(x, 3) for x in hips), "head", tuple(round(x, 3) for x in head), flush=True)

    export_hierarchy(OUT_RIG, root, arm, mesh, animations=False)
    export_hierarchy(OUT_ANIM, root, arm, mesh, animations=True)
    print("DONE", kept, flush=True)


if __name__ == "__main__":
    main()
