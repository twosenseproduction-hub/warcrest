#!/usr/bin/env python3
"""Bind Blender purple plate elf to HumanF + bake Archer FREE Female clips.

No AxisFix empty — rotate/scale the armature object itself (Blender 4.0 glTF
skin export breaks when an Empty sits above a skinned armature).

  blender -b -noaudio --python tools/blender-character/rig_humanf_anims.py
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector

REPO = Path("/workspace")
RAW = REPO / "assets/models/blender/purple_plate_elf.glb"
HUMANF = REPO / "tools/.meshy-work/drive_anims_extracted/Models/HumanF_Model.fbx"
ANIMS = REPO / "tools/.meshy-work/drive_anims_extracted/Animations/Female"
OUT_RIG = REPO / "assets/models/blender/purple_plate_elf_rigged.glb"
OUT_ANIM = REPO / "assets/models/blender/purple_plate_elf_pack_anim.glb"
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
    mn = Vector(tuple(min(c[i] for c in coords) for i in range(3)))
    mx = Vector(tuple(max(c[i] for c in coords) for i in range(3)))
    return mn, mx


def apply_all(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def bone_world(arm, name):
    return arm.matrix_world @ arm.data.bones[name].head_local


def hips_head(arm):
    return bone_world(arm, "B-head") - bone_world(arm, "B-hips")


def clear_pose_scales(arm):
    for pb in arm.pose.bones:
        pb.scale = (1.0, 1.0, 1.0)
        pb.location = (0.0, 0.0, 0.0)


def force_z_up(arm, apply=True):
    """Rotate armature object so hips→head is +Z. Optionally apply transforms."""
    clear_pose_scales(arm)
    arm.rotation_mode = "XYZ"
    bpy.context.view_layer.update()
    d = hips_head(arm)
    if abs(d.y) >= abs(d.z) and abs(d.y) >= abs(d.x):
        arm.rotation_euler[0] += math.radians(-90 if d.y < 0 else 90)
        if apply:
            apply_all(arm)
            clear_pose_scales(arm)
            arm.rotation_mode = "XYZ"
        bpy.context.view_layer.update()
        d = hips_head(arm)
    if abs(d.y) >= abs(d.z) and abs(d.y) >= abs(d.x):
        arm.rotation_euler[0] += math.radians(180)
        if apply:
            apply_all(arm)
            clear_pose_scales(arm)
            arm.rotation_mode = "XYZ"
        bpy.context.view_layer.update()
        d = hips_head(arm)
    if d.z < 0:
        arm.rotation_euler[0] += math.radians(180)
        if apply:
            apply_all(arm)
            clear_pose_scales(arm)
            arm.rotation_mode = "XYZ"
        bpy.context.view_layer.update()
        d = hips_head(arm)
    print("force_z_up hips→head", tuple(round(x, 3) for x in d), "apply", apply, flush=True)
    if abs(d.z) < abs(d.y):
        raise RuntimeError(f"failed to force Z-up: {tuple(d)}")


def armature_height(arm):
    toe = arm.data.bones.get("B-toe.L") or arm.data.bones.get("B-foot.L")
    return abs(bone_world(arm, "B-head").z - (arm.matrix_world @ toe.head_local).z)


def fit_arm_to_mesh(arm, mesh):
    mesh_mn, mesh_mx = mesh_bbox(mesh)
    mesh_h = mesh_mx.z - mesh_mn.z
    ah = armature_height(arm) or 1.0
    arm.scale *= mesh_h / ah
    apply_all(arm)
    clear_pose_scales(arm)
    bpy.context.view_layer.update()
    # center X/Y, plant feet near z=0, hips ~ mid-lower body
    xs = [(arm.matrix_world @ b.head_local).x for b in arm.data.bones]
    ys = [(arm.matrix_world @ b.head_local).y for b in arm.data.bones]
    zs = [(arm.matrix_world @ b.head_local).z for b in arm.data.bones]
    arm.location -= Vector(((min(xs) + max(xs)) * 0.5, (min(ys) + max(ys)) * 0.5, min(zs)))
    apply_all(arm)
    clear_pose_scales(arm)
    bpy.context.view_layer.update()
    hips_z = bone_world(arm, "B-hips").z
    arm.location.z += 0.52 * mesh_h - hips_z
    apply_all(arm)
    clear_pose_scales(arm)
    bpy.context.view_layer.update()
    print(
        "fit hips",
        tuple(round(x, 3) for x in bone_world(arm, "B-hips")),
        "head",
        tuple(round(x, 3) for x in bone_world(arm, "B-head")),
        flush=True,
    )


def plant_mesh(mesh):
    mn, mx = mesh_bbox(mesh)
    mesh.scale *= HEIGHT / max(mx.z - mn.z, 1e-6)
    apply_all(mesh)
    mn, mx = mesh_bbox(mesh)
    mesh.location = Vector((-(mn.x + mx.x) * 0.5, -(mn.y + mx.y) * 0.5, -mn.z))
    apply_all(mesh)
    for v in mesh.data.vertices:
        v.co.y *= 1.4
    mesh.data.update()
    print("mesh", tuple(round(x, 3) for x in mesh_bbox(mesh)[0]), tuple(round(x, 3) for x in mesh_bbox(mesh)[1]), flush=True)


def import_humanf():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(HUMANF), automatic_bone_orientation=True, use_anim=False)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    for o in list(new):
        if o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    arm.name = "Armature"
    apply_all(arm)
    force_z_up(arm)
    return arm


def assign_proximity_weights(arm, mesh):
    """Fallback when bone-heat fails on disconnected armor shells."""
    mesh.vertex_groups.clear()
    bone_names = [
        b.name
        for b in arm.data.bones
        if b.name.startswith("B-") and b.name not in ("B-root", "B-spineProxy")
    ]
    groups = {n: mesh.vertex_groups.new(name=n) for n in bone_names}
    heads = {n: (arm.matrix_world @ arm.data.bones[n].head_local) for n in bone_names}
    tails = {
        n: (arm.matrix_world @ arm.data.bones[n].tail_local) for n in bone_names
    }
    # inverse of mesh world (identity after apply)
    for vi, v in enumerate(mesh.data.vertices):
        p = mesh.matrix_world @ v.co
        best, best_d = None, 1e9
        for n in bone_names:
            # distance to bone segment
            a, b = heads[n], tails[n]
            ab = b - a
            t = 0.0 if ab.length < 1e-8 else max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
            d = (a + ab * t - p).length
            if d < best_d:
                best_d, best = d, n
        if best is not None:
            groups[best].add([vi], 1.0, "REPLACE")
    if not any(m.type == "ARMATURE" for m in mesh.modifiers):
        mod = mesh.modifiers.new("Armature", "ARMATURE")
        mod.object = arm
    else:
        mesh.modifiers["Armature"].object = arm
    mesh.parent = arm
    print("proximity groups", len(mesh.vertex_groups), flush=True)


def bind_mesh(arm, mesh):
    # Joined armor shells are disconnected islands — bone-heat fails reliably.
    # Assign hard proximity weights to the nearest bone segment instead.
    assign_proximity_weights(arm, mesh)


def strip_loc_scale(act):
    for fc in list(act.fcurves):
        dp = fc.data_path
        if (
            ".location" in dp
            or dp == "location"
            or ".scale" in dp
            or dp == "scale"
            or 'pose.bones["B-root"]' in dp
            or 'pose.bones["B-spineProxy"]' in dp
        ):
            act.fcurves.remove(fc)


def append_clip(dst_arm, fbx_path: Path, name: str):
    before_objs = set(bpy.data.objects)
    before_acts = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=str(fbx_path), automatic_bone_orientation=True, use_anim=True)
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

    # Keep object-level rot/scale/loc so the action datablock stays valid.
    force_z_up(src_arm, apply=False)
    sh, dh = armature_height(src_arm), armature_height(dst_arm)
    if sh > 1e-6:
        src_arm.scale *= dh / sh
        bpy.context.view_layer.update()
    src_arm.location += bone_world(dst_arm, "B-hips") - bone_world(src_arm, "B-hips")
    bpy.context.view_layer.update()
    if not src_arm.animation_data:
        src_arm.animation_data_create()
    src_arm.animation_data.action = src_act

    for pb in dst_arm.pose.bones:
        while pb.constraints:
            pb.constraints.remove(pb.constraints[0])
    if not dst_arm.animation_data:
        dst_arm.animation_data_create()
    dst_arm.animation_data.action = None
    clear_pose_scales(dst_arm)

    for pb in dst_arm.pose.bones:
        if pb.name in ("B-root", "B-spineProxy") or pb.name not in src_arm.pose.bones:
            continue
        c = pb.constraints.new("COPY_ROTATION")
        c.target = src_arm
        c.subtarget = pb.name
        # LOCAL after both armatures share Z-up rest — WORLD was tipping the bake.
        c.target_space = "LOCAL"
        c.owner_space = "LOCAL"
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
        clear_pose_scales(dst_arm)
        print(f"BAKED {name} {f0}-{f1}", flush=True)
        ok = True
    else:
        print("BAKE FAIL", name, flush=True)

    for pb in dst_arm.pose.bones:
        while pb.constraints:
            pb.constraints.remove(pb.constraints[0])
    if dst_arm.animation_data:
        dst_arm.animation_data.action = None

    for o in new_objs:
        try:
            if o.name in bpy.data.objects:
                bpy.data.objects.remove(o, do_unlink=True)
        except Exception:
            pass
    for a in new_acts:
        try:
            if a.users == 0:
                bpy.data.actions.remove(a)
        except Exception:
            pass
    return name if ok else None


def export_glb(path: Path, arm, mesh, animations=False):
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o != mesh:
            bpy.data.objects.remove(o, do_unlink=True)
        elif o.type == "EMPTY":
            bpy.data.objects.remove(o, do_unlink=True)
    if not any(m.type == "ARMATURE" for m in mesh.modifiers):
        mod = mesh.modifiers.new("Armature", "ARMATURE")
        mod.object = arm
    if mesh.parent != arm:
        mesh.parent = arm
    if not mesh.vertex_groups:
        raise RuntimeError("no vertex groups")
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
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
    mesh.name = "PurplePlateElf"
    plant_mesh(mesh)

    arm = import_humanf()
    fit_arm_to_mesh(arm, mesh)
    bind_mesh(arm, mesh)

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

    for t in arm.animation_data.nla_tracks:
        t.mute = t.name != "idle"
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    clear_pose_scales(arm)
    hips = arm.matrix_world @ arm.pose.bones["B-hips"].head
    head = arm.matrix_world @ arm.pose.bones["B-head"].head
    print("sample idle hips", tuple(round(x, 3) for x in hips), "head", tuple(round(x, 3) for x in head), flush=True)

    OUT_RIG.parent.mkdir(parents=True, exist_ok=True)
    export_glb(OUT_RIG, arm, mesh, animations=False)
    export_glb(OUT_ANIM, arm, mesh, animations=True)
    print("DONE", kept, flush=True)


if __name__ == "__main__":
    main()
