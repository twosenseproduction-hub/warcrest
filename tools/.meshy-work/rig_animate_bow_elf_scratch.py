#!/usr/bin/env python3
"""From-scratch rig + animate the Drive clay bow elf.

No Meshy Auto-Rig, no HumanF/Mixamo donor skeleton, no pack retarget.
Builds a custom humanoid armature from mesh landmarks, auto-weights, then
hand-keys idle / walk / run / bow combat clips in Blender.

  blender -b -noaudio --python tools/.meshy-work/rig_animate_bow_elf_scratch.py
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector

REPO = Path("/workspace")
RAW = REPO / "assets/models/meshy/bow_elf_meshy_raw.glb"
OUT_RIG = REPO / "assets/models/meshy/bow_elf_scratch_rigged.glb"
OUT_ANIM = REPO / "assets/models/meshy/bow_elf_scratch_anim.glb"
TARGET_FACES = 60000
HEIGHT = 1.7
FPS = 24


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS


def apply_all(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def mesh_bbox(obj):
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = Vector((min(c[i] for c in coords) for i in range(3)))
    mx = Vector((max(c[i] for c in coords) for i in range(3)))
    return mn, mx, coords


def prepare_mesh() -> bpy.types.Object:
    bpy.ops.import_scene.gltf(filepath=str(RAW))
    mesh = next(o for o in bpy.data.objects if o.type == "MESH")
    mesh.name = "bow_elf"
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    mod = mesh.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = TARGET_FACES / max(len(mesh.data.polygons), 1)
    bpy.ops.object.modifier_apply(modifier=mod.name)

    mn, mx, _ = mesh_bbox(mesh)
    mesh.scale *= HEIGHT / (mx.z - mn.z)
    apply_all(mesh)
    mn, mx, _ = mesh_bbox(mesh)
    mesh.location = Vector((-(mn.x + mx.x) * 0.5, -(mn.y + mx.y) * 0.5, -mn.z))
    apply_all(mesh)

    # Clay material
    img = bpy.data.images.new("clay", 16, 16)
    img.pixels = [0.84, 0.82, 0.80, 1.0] * (16 * 16)
    img.pack()
    mat = bpy.data.materials.new("Clay")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    bsdf.inputs["Roughness"].default_value = 0.92
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], outn.inputs["Surface"])
    mesh.data.materials.clear()
    mesh.data.materials.append(mat)

    mn, mx, _ = mesh_bbox(mesh)
    print("mesh", tuple(round(x, 3) for x in mn), tuple(round(x, 3) for x in mx), "faces", len(mesh.data.polygons), flush=True)
    return mesh


def landmarks(mesh):
    """Estimate joints from standing A-pose mesh. Ignore bow outliers via depth filter."""
    mn, mx, coords = mesh_bbox(mesh)
    h = mx.z - mn.z
    cx = (mn.x + mx.x) * 0.5
    # Body depth center: median Y of mid-torso (filters bow/quiver)
    torso = [c for c in coords if 0.45 * h < (c.z - mn.z) < 0.75 * h and abs(c.x - cx) < 0.22]
    cy = (sum(p.y for p in torso) / len(torso)) if torso else (mn.y + mx.y) * 0.5

    def pts_in(z0, z1, max_depth=0.18, max_x=None):
        lo, hi = mn.z + z0 * h, mn.z + z1 * h
        out = []
        for c in coords:
            if not (lo <= c.z <= hi):
                continue
            if abs(c.y - cy) > max_depth:
                continue
            if max_x is not None and abs(c.x - cx) > max_x:
                continue
            out.append(c)
        return out

    def avg(pts, fallback):
        if not pts:
            return Vector(fallback)
        return Vector(
            (
                sum(p.x for p in pts) / len(pts),
                sum(p.y for p in pts) / len(pts),
                sum(p.z for p in pts) / len(pts),
            )
        )

    def side_x(pts, sign, fallback):
        if not pts:
            return Vector(fallback)
        if sign > 0:
            x = max(p.x for p in pts)
            band = [p for p in pts if p.x > x - 0.06]
        else:
            x = min(p.x for p in pts)
            band = [p for p in pts if p.x < x + 0.06]
        return avg(band, fallback)

    hips = avg(pts_in(0.50, 0.58, 0.16, 0.25), (cx, cy, 0.55 * h))
    spine = avg(pts_in(0.58, 0.66, 0.16, 0.22), (cx, cy, 0.62 * h))
    chest = avg(pts_in(0.70, 0.80, 0.16, 0.22), (cx, cy, 0.75 * h))
    neck = avg(pts_in(0.90, 0.96, 0.14, 0.14), (cx, cy, 0.93 * h))
    head = avg(pts_in(0.96, 1.00, 0.14, 0.12), (cx, cy, 0.98 * h))

    # Shoulders: body-width at shoulder height (not bow tips)
    sh_band = pts_in(0.82, 0.90, 0.20, 0.35)
    sh_z = chest.z + 0.08
    if sh_band:
        sh_l_x = max(p.x for p in sh_band)
        sh_r_x = min(p.x for p in sh_band)
        # Pull in slightly from silhouette edge (pauldrons)
        sh_l_x = cx + (sh_l_x - cx) * 0.85
        sh_r_x = cx + (sh_r_x - cx) * 0.85
    else:
        sh_l_x, sh_r_x = cx + 0.17, cx - 0.17
    l_shoulder = Vector((sh_l_x, chest.y, sh_z))
    r_shoulder = Vector((sh_r_x, chest.y, sh_z))

    feet_b = pts_in(0.00, 0.07, 0.22, 0.35)
    knees_b = pts_in(0.28, 0.38, 0.20, 0.30)
    l_foot = side_x(feet_b, +1, (cx + 0.10, cy + 0.05, 0.03))
    r_foot = side_x(feet_b, -1, (cx - 0.10, cy + 0.05, 0.03))
    l_knee = side_x(knees_b, +1, (cx + 0.10, cy + 0.03, 0.33 * h))
    r_knee = side_x(knees_b, -1, (cx - 0.10, cy + 0.03, 0.33 * h))
    # Keep knees under hips roughly
    l_knee = Vector((hips.x + 0.10, hips.y + 0.02, l_knee.z))
    r_knee = Vector((hips.x - 0.10, hips.y + 0.02, r_knee.z))
    l_foot = Vector((hips.x + 0.10, hips.y + 0.06, max(0.02, l_foot.z)))
    r_foot = Vector((hips.x - 0.10, hips.y + 0.06, max(0.02, r_foot.z)))

    # A-pose arms: constructed chain (bow welded to hand — don't chase mesh extremes)
    def arm_chain(sh, sign):
        elbow = Vector((sh.x + 0.10 * sign, sh.y + 0.04, sh.z - 0.28))
        hand = Vector((sh.x + 0.14 * sign, sh.y + 0.08, sh.z - 0.52))
        hand_end = hand + Vector((0.03 * sign, 0.05, -0.03))
        return elbow, hand, hand_end

    l_elbow, l_hand, l_hand_end = arm_chain(l_shoulder, +1)
    r_elbow, r_hand, r_hand_end = arm_chain(r_shoulder, -1)

    lm = {
        "hips": hips,
        "spine": spine,
        "chest": chest,
        "neck": neck,
        "head": head,
        "head_top": Vector((neck.x, neck.y, mx.z + 0.02)),
        "l_shoulder": l_shoulder,
        "r_shoulder": r_shoulder,
        "l_elbow": l_elbow,
        "r_elbow": r_elbow,
        "l_hand": l_hand,
        "r_hand": r_hand,
        "l_hand_end": l_hand_end,
        "r_hand_end": r_hand_end,
        "l_upleg": Vector((hips.x + 0.09, hips.y, hips.z - 0.02)),
        "r_upleg": Vector((hips.x - 0.09, hips.y, hips.z - 0.02)),
        "l_knee": l_knee,
        "r_knee": r_knee,
        "l_foot": l_foot,
        "r_foot": r_foot,
        "l_toe": l_foot + Vector((0.0, -0.11, -0.01)),
        "r_toe": r_foot + Vector((0.0, -0.11, -0.01)),
        # unused aliases kept for build_armature compat
        "l_arm": l_shoulder,
        "r_arm": r_shoulder,
    }
    for k, v in lm.items():
        print(f"  lm {k}: ({v.x:.3f}, {v.y:.3f}, {v.z:.3f})", flush=True)
    return lm


def build_armature(lm) -> bpy.types.Object:
    """Create a custom humanoid armature. Bone +Y is along head→tail in edit mode."""
    arm_data = bpy.data.armatures.new("ScratchRig")
    arm = bpy.data.objects.new("Armature", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def add(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        # Avoid zero-length
        if (b.tail - b.head).length < 1e-4:
            b.tail = b.head + Vector((0, 0, 0.05))
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    add("Hips", lm["hips"] + Vector((0, 0, -0.04)), lm["hips"] + Vector((0, 0, 0.06)))
    add("Spine", lm["hips"] + Vector((0, 0, 0.06)), lm["spine"], parent="Hips", connect=True)
    add("Chest", lm["spine"], lm["chest"], parent="Spine", connect=True)
    add("Neck", lm["chest"], lm["neck"], parent="Chest", connect=False)
    add("Head", lm["neck"], lm["head_top"], parent="Neck", connect=True)

    add("LeftShoulder", lm["chest"], lm["l_shoulder"], parent="Chest", connect=False)
    add("LeftArm", lm["l_shoulder"], lm["l_elbow"], parent="LeftShoulder", connect=True)
    add("LeftForeArm", lm["l_elbow"], lm["l_hand"], parent="LeftArm", connect=True)
    add("LeftHand", lm["l_hand"], lm["l_hand_end"], parent="LeftForeArm", connect=True)

    add("RightShoulder", lm["chest"], lm["r_shoulder"], parent="Chest", connect=False)
    add("RightArm", lm["r_shoulder"], lm["r_elbow"], parent="RightShoulder", connect=True)
    add("RightForeArm", lm["r_elbow"], lm["r_hand"], parent="RightArm", connect=True)
    add("RightHand", lm["r_hand"], lm["r_hand_end"], parent="RightForeArm", connect=True)

    add("LeftUpLeg", lm["l_upleg"], lm["l_knee"], parent="Hips", connect=False)
    add("LeftLeg", lm["l_knee"], lm["l_foot"], parent="LeftUpLeg", connect=True)
    add("LeftFoot", lm["l_foot"], lm["l_toe"], parent="LeftLeg", connect=True)

    add("RightUpLeg", lm["r_upleg"], lm["r_knee"], parent="Hips", connect=False)
    add("RightLeg", lm["r_knee"], lm["r_foot"], parent="RightUpLeg", connect=True)
    add("RightFoot", lm["r_foot"], lm["r_toe"], parent="RightLeg", connect=True)

    # Align bone rolls so local X is consistent (helps euler anims)
    bpy.ops.armature.select_all(action="SELECT")
    bpy.ops.armature.calculate_roll(type="GLOBAL_POS_Y")
    bpy.ops.object.mode_set(mode="OBJECT")
    print("bones", len(arm_data.bones), flush=True)
    return arm


def bind(arm, mesh):
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    print("weights", len(mesh.vertex_groups), flush=True)


def ensure_euler(pb):
    pb.rotation_mode = "XYZ"


def key_bone(arm, name, frame, euler_deg=None, loc=None):
    pb = arm.pose.bones.get(name)
    if not pb:
        return
    ensure_euler(pb)
    bpy.context.scene.frame_set(frame)
    if euler_deg is not None:
        pb.rotation_euler = Vector((math.radians(euler_deg[0]), math.radians(euler_deg[1]), math.radians(euler_deg[2])))
        pb.keyframe_insert(data_path="rotation_euler", frame=frame)
    if loc is not None:
        pb.location = Vector(loc)
        pb.keyframe_insert(data_path="location", frame=frame)


def new_action(arm, name):
    if not arm.animation_data:
        arm.animation_data_create()
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    return act


def clear_pose(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.transforms_clear()
    bpy.ops.object.mode_set(mode="OBJECT")


def make_idle(arm):
    act = new_action(arm, "idle")
    clear_pose(arm)
    n = 48  # 2s
    for i in range(n + 1):
        t = i / n
        breath = math.sin(t * math.tau) * 2.0
        sway = math.sin(t * math.tau) * 1.5
        f = i + 1
        key_bone(arm, "Chest", f, (breath * 0.3, 0, 0))
        key_bone(arm, "Spine", f, (breath * 0.2, 0, sway * 0.3))
        key_bone(arm, "Head", f, (breath * 0.4, sway * 0.5, 0))
        # Slight A-pose settle / weight
        key_bone(arm, "LeftArm", f, (0, 0, 8 + breath * 0.5))
        key_bone(arm, "RightArm", f, (0, 0, -12 + breath * 0.5))
        key_bone(arm, "LeftForeArm", f, (0, 0, 10))
        key_bone(arm, "RightForeArm", f, (5, 0, -25))  # hold bow a bit
        key_bone(arm, "Hips", f, (0, sway * 0.4, 0), loc=(0, 0, abs(math.sin(t * math.tau)) * 0.004))
    arm.animation_data.action = None
    return act


def make_locomotion(arm, name, frames, stride_deg, arm_deg, lean):
    act = new_action(arm, name)
    clear_pose(arm)
    for i in range(frames + 1):
        t = i / frames
        phase = t * math.tau
        f = i + 1
        # Legs opposite phase
        L = math.sin(phase)
        R = math.sin(phase + math.pi)
        key_bone(arm, "LeftUpLeg", f, (L * stride_deg, 0, L * 4))
        key_bone(arm, "RightUpLeg", f, (R * stride_deg, 0, R * 4))
        key_bone(arm, "LeftLeg", f, (max(0, -L) * stride_deg * 0.9, 0, 0))
        key_bone(arm, "RightLeg", f, (max(0, -R) * stride_deg * 0.9, 0, 0))
        key_bone(arm, "LeftFoot", f, (-max(0, L) * 12, 0, 0))
        key_bone(arm, "RightFoot", f, (-max(0, R) * 12, 0, 0))
        # Arms opposite to legs; right holds bow so dampen
        key_bone(arm, "LeftArm", f, (R * arm_deg, 0, 10))
        key_bone(arm, "RightArm", f, (L * arm_deg * 0.35, 0, -15))
        key_bone(arm, "LeftForeArm", f, (0, 0, 15 + abs(R) * 10))
        key_bone(arm, "RightForeArm", f, (8, 0, -20))
        key_bone(arm, "Spine", f, (lean + L * 2, 0, L * 3))
        key_bone(arm, "Chest", f, (lean * 0.5, 0, R * 2))
        key_bone(arm, "Hips", f, (0, L * 3, 0), loc=(0, 0, abs(math.sin(phase * 2)) * (0.01 if name == "run" else 0.006)))
        key_bone(arm, "Head", f, (-lean * 0.3, 0, -L * 2))
    arm.animation_data.action = None
    return act


def _aim_pose(arm, f, draw, wobble=0.0):
    """Conservative bow aim. draw 0=ready … 1=full draw. Uses modest eulers."""
    key_bone(arm, "LeftShoulder", f, (0, -8, 6))
    key_bone(arm, "LeftArm", f, (-8 - 4 * draw, -55 - 15 * draw, 8))
    key_bone(arm, "LeftForeArm", f, (0, 0, 8))
    key_bone(arm, "LeftHand", f, (0, 0, 0))
    key_bone(arm, "RightShoulder", f, (0, 6, -4))
    key_bone(arm, "RightArm", f, (-12 - 8 * draw + wobble, 25 + 30 * draw, -18))
    key_bone(arm, "RightForeArm", f, (5, 0, -35 - 25 * draw))
    key_bone(arm, "RightHand", f, (0, 0, 0))
    key_bone(arm, "Spine", f, (4, 0, -10 - 4 * draw))
    key_bone(arm, "Chest", f, (3, wobble * 0.2, -8 - 3 * draw))
    key_bone(arm, "Neck", f, (0, 0, -6))
    key_bone(arm, "Head", f, (2, -4, -12 - 4 * draw))
    key_bone(arm, "Hips", f, (0, 0, -6))
    key_bone(arm, "LeftUpLeg", f, (6 + 2 * draw, 0, 4))
    key_bone(arm, "RightUpLeg", f, (-4 - 2 * draw, 0, -6))
    key_bone(arm, "LeftLeg", f, (4, 0, 0))
    key_bone(arm, "RightLeg", f, (2, 0, 0))


def make_bow_idle(arm):
    act = new_action(arm, "bow_idle")
    clear_pose(arm)
    n = 36
    for i in range(n + 1):
        t = i / n
        _aim_pose(arm, i + 1, draw=0.15, wobble=math.sin(t * math.tau) * 1.2)
    arm.animation_data.action = None
    return act


def make_attack_sequence(arm):
    act = new_action(arm, "attack_load")
    clear_pose(arm)
    for i in range(21):
        _aim_pose(arm, i + 1, draw=i / 20)
    arm.animation_data.action = None

    act = new_action(arm, "attack_hold")
    clear_pose(arm)
    for i in range(33):
        t = i / 32
        _aim_pose(arm, i + 1, draw=1.0, wobble=math.sin(t * math.tau * 2) * 1.5)
    arm.animation_data.action = None

    act = new_action(arm, "attack_release")
    clear_pose(arm)
    for i in range(21):
        u = i / 20
        # Ease from full draw back toward ready
        _aim_pose(arm, i + 1, draw=1.0 - 0.85 * u, wobble=(1 - u) * 2)
    arm.animation_data.action = None


def push_nla(arm, names):
    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = None
    while arm.animation_data.nla_tracks:
        arm.animation_data.nla_tracks.remove(arm.animation_data.nla_tracks[0])
    for name in names:
        act = bpy.data.actions.get(name)
        if not act:
            continue
        # Linear interpolation
        for fc in act.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, int(act.frame_range[0]) or 1, act)


def export(path: Path, arm, mesh, animations=False):
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o != mesh:
            bpy.data.objects.remove(o, do_unlink=True)
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
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(**kwargs)
    print("WROTE", path, path.stat().st_size, flush=True)


def main():
    clear()
    mesh = prepare_mesh()
    lm = landmarks(mesh)
    arm = build_armature(lm)
    bind(arm, mesh)
    export(OUT_RIG, arm, mesh, animations=False)

    make_idle(arm)
    make_locomotion(arm, "walk", frames=24, stride_deg=28, arm_deg=22, lean=6)
    make_locomotion(arm, "run", frames=16, stride_deg=40, arm_deg=32, lean=12)
    make_bow_idle(arm)
    make_attack_sequence(arm)

    names = [
        "idle",
        "bow_idle",
        "attack_load",
        "attack_hold",
        "attack_release",
        "walk",
        "run",
    ]
    # Drop unused actions
    for act in list(bpy.data.actions):
        if act.name not in names:
            bpy.data.actions.remove(act)
    push_nla(arm, names)
    export(OUT_ANIM, arm, mesh, animations=True)
    print("DONE clips", names, flush=True)


if __name__ == "__main__":
    main()
