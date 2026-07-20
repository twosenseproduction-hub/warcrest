#!/usr/bin/env python3
"""Retarget Human Archer FREE Female FBX clips onto Meshy purple-elf rig.

  blender -b -noaudio --python tools/.meshy-work/retarget_humanf_to_meshy.py -- \
    --mesh assets/models/meshy/purple_elf_meshy_rigged.glb \
    --anims-dir tools/.meshy-work/drive_anims_extracted/Animations/Female \
    --out assets/models/meshy/purple_elf_meshy_pack_anim.glb
"""
from __future__ import annotations

import os
import sys

import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def arg(flag, default=None):
    if flag in ARGS:
        i = ARGS.index(flag)
        return ARGS[i + 1] if i + 1 < len(ARGS) else default
    return default


MESH = arg("--mesh", "assets/models/meshy/purple_elf_meshy_rigged.glb")
ANIMS_DIR = arg(
    "--anims-dir",
    "tools/.meshy-work/drive_anims_extracted/Animations/Female",
)
OUT = arg("--out", "assets/models/meshy/purple_elf_meshy_pack_anim.glb")
# Curated subset for game use (in-place locomotion + bow combat + idle)
CLIP_REL = [
    "Idles/HumanF@Idle01.fbx",
    "Combat/Bow/HumanF@BowIdle01.fbx",
    "Combat/Bow/HumanF@BowIdle02.fbx",
    "Combat/Bow/HumanF@BowShot01 - Load.fbx",
    "Combat/Bow/HumanF@BowShot01 - Hold.fbx",
    "Combat/Bow/HumanF@BowShot01 - Release.fbx",
    "Movement/Walk/HumanF@Walk01_Forward.fbx",
    "Movement/Run/HumanF@Run01_Forward.fbx",
]

# HumanF (B-*) -> Meshy Mixamo-like
BONE_MAP = {
    "B-hips": "Hips",
    "B-spine": "Spine02",
    "B-chest": "Spine",
    "B-neck": "neck",
    "B-head": "Head",
    "B-shoulder.L": "LeftShoulder",
    "B-upperArm.L": "LeftArm",
    "B-forearm.L": "LeftForeArm",
    "B-hand.L": "LeftHand",
    "B-shoulder.R": "RightShoulder",
    "B-upperArm.R": "RightArm",
    "B-forearm.R": "RightForeArm",
    "B-hand.R": "RightHand",
    "B-thigh.L": "LeftUpLeg",
    "B-shin.L": "LeftLeg",
    "B-foot.L": "LeftFoot",
    "B-toe.L": "LeftToeBase",
    "B-thigh.R": "RightUpLeg",
    "B-shin.R": "RightLeg",
    "B-foot.R": "RightFoot",
    "B-toe.R": "RightToeBase",
}


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def bbox_z(objs):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector((min(mn[i], w[i]) for i in range(3)))
            mx = Vector((max(mx[i], w[i]) for i in range(3)))
    return mn, mx


def import_mesh(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    else:
        raise SystemExit("unsupported mesh " + path)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    return arm


def clip_name_from_path(path: str) -> str:
    base = os.path.basename(path)
    base = base.replace("HumanF@", "").replace(".fbx", "")
    base = base.replace(" - ", "_").replace(" ", "_").replace("@", "")
    # Friendly game names
    mapping = {
        "Idle01": "idle",
        "BowIdle01": "bow_idle",
        "BowIdle02": "bow_idle_alt",
        "BowShot01_Load": "attack_load",
        "BowShot01_Hold": "attack_hold",
        "BowShot01_Release": "attack_release",
        "Walk01_Forward": "walk",
        "Run01_Forward": "run",
    }
    return mapping.get(base, base.lower())


def retarget_one(target_arm, fbx_path: str) -> str | None:
    before = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=fbx_path)
    new_objs = [o for o in bpy.data.objects if o not in before]
    src_arm = next((o for o in new_objs if o.type == "ARMATURE"), None)
    if not src_arm:
        print("NO ARM", fbx_path)
        for o in new_objs:
            bpy.data.objects.remove(o, do_unlink=True)
        return None

    # Match height roughly (both in meters after apply)
    def arm_height(arm):
        zs = [(arm.matrix_world @ b.head_local).z for b in arm.data.bones]
        return (max(zs) - min(zs)) if zs else 1.0

    th = arm_height(target_arm)
    sh = arm_height(src_arm)
    if sh > 1e-4:
        src_arm.scale *= th / sh
        bpy.context.view_layer.update()
        # Apply src scale so world constraints see meters
        bpy.ops.object.select_all(action="DESELECT")
        src_arm.select_set(True)
        bpy.context.view_layer.objects.active = src_arm
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Align hips horizontally
    tb = target_arm.pose.bones.get("Hips")
    sb = src_arm.pose.bones.get("B-hips")
    if tb and sb:
        tpos = target_arm.matrix_world @ tb.head
        spos = src_arm.matrix_world @ sb.head
        src_arm.location += tpos - spos
        bpy.context.view_layer.update()

    # Clear prior constraints on target
    for pb in target_arm.pose.bones:
        while pb.constraints:
            pb.constraints.remove(pb.constraints[0])

    for src_name, dst_name in BONE_MAP.items():
        if src_name not in src_arm.pose.bones or dst_name not in target_arm.pose.bones:
            continue
        pb = target_arm.pose.bones[dst_name]
        c = pb.constraints.new("COPY_ROTATION")
        c.target = src_arm
        c.subtarget = src_name
        c.target_space = "WORLD"
        c.owner_space = "WORLD"
        c.mix_mode = "REPLACE"
        # Do NOT copy location — HumanF packs store hips translation in
        # mismatched units and send the character into the sky.
    # Determine frame range from source action
    new_actions = [a for a in bpy.data.actions if a not in before_actions]
    if not new_actions and src_arm.animation_data and src_arm.animation_data.action:
        new_actions = [src_arm.animation_data.action]
    if not new_actions:
        print("NO ACTION", fbx_path)
        cleanup_src(new_objs, new_actions)
        return None
    src_act = new_actions[0]
    f0, f1 = int(src_act.frame_range[0]), int(src_act.frame_range[1])
    if f1 <= f0:
        f1 = f0 + 1

    # Bake onto target
    bpy.ops.object.select_all(action="DESELECT")
    target_arm.select_set(True)
    bpy.context.view_layer.objects.active = target_arm
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
    baked = target_arm.animation_data.action if target_arm.animation_data else None
    name = clip_name_from_path(fbx_path)
    if baked:
        baked.name = name
        # Strip location keys so in-place clips stay planted (rotations only).
        for fc in list(baked.fcurves):
            if fc.data_path.endswith(".location") or fc.data_path == "location":
                baked.fcurves.remove(fc)
        print(f"BAKED {name} frames {f0}-{f1} from {os.path.basename(fbx_path)}")
    else:
        print("BAKE FAILED", fbx_path)
        name = None

    # Remove constraints leftovers
    for pb in target_arm.pose.bones:
        while pb.constraints:
            pb.constraints.remove(pb.constraints[0])

    cleanup_src(new_objs, new_actions)
    # Keep baked action; clear current so next bake creates a new one
    if target_arm.animation_data:
        target_arm.animation_data.action = None
    return name


def cleanup_src(objs, actions):
    for o in objs:
        try:
            bpy.data.objects.remove(o, do_unlink=True)
        except Exception:
            pass
    for a in actions:
        try:
            if a and a.users == 0:
                bpy.data.actions.remove(a)
        except Exception:
            pass


def main():
    clear_scene()
    target = import_mesh(MESH)
    # Meshy GLBs often ship armature scale=0.01 (cm). Apply so bake stays in meters.
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Also apply scale on skinned meshes
    for o in list(bpy.data.objects):
        if o.type == "MESH":
            bpy.ops.object.select_all(action="DESELECT")
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Drop Meshy helper icosphere if present
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.name.lower().startswith("ico"):
            bpy.data.objects.remove(o, do_unlink=True)
    print("TARGET", target.name, "bones", len(target.data.bones), "scale", tuple(target.scale))

    kept = []
    for rel in CLIP_REL:
        path = os.path.join(ANIMS_DIR, rel)
        if not os.path.isfile(path):
            print("MISSING", path)
            continue
        name = retarget_one(target, path)
        if name:
            kept.append(name)

    if not target.animation_data:
        target.animation_data_create()
    target.animation_data.action = None

    for act in list(bpy.data.actions):
        if act.name not in kept:
            bpy.data.actions.remove(act)

    while target.animation_data.nla_tracks:
        target.animation_data.nla_tracks.remove(target.animation_data.nla_tracks[0])
    for name in kept:
        act = bpy.data.actions.get(name)
        if not act:
            continue
        tr = target.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, int(act.frame_range[0]), act)

    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    for o in list(bpy.data.objects):
        if o.type != "MESH":
            continue
        keep = o.parent == target or any(
            mod.type == "ARMATURE" and mod.object == target for mod in o.modifiers
        )
        if keep:
            o.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        export_animations=True,
        export_nla_strips=True,
        use_selection=True,
    )
    print("BUILT", OUT, os.path.getsize(OUT), "clips", kept)


if __name__ == "__main__":
    main()
