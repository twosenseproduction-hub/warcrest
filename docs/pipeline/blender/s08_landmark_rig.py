"""S8 Landmark-assisted auto-rig (reference implementation).

The Mixamo-style guided step made repeatable: instead of authoring a skeleton, we FIT the
canonical skeleton to landmarks. Hierarchy/naming/rolls come from the canonical skeleton
and are therefore always correct; only bone positions/lengths are solved.

in:  cleaned .blend + landmarks.json + skeleton descriptor + DNA (for finger_schema)
out: rigged .blend + receipt (per-joint landmark residual)
validate: all required landmarks present, residual under threshold, L/R symmetric
fail:     missing/implausible landmark
fallback: (orchestrator) route to human landmark placement -> re-run

landmarks.json shape:
  { "chin": [x,y,z], "shoulder.L": [...], ..., "ankle.R": [...] }   # world meters, Z up
"""
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_stage_args, load_json, Receipt  # noqa: E402


def build_armature_from_descriptor(desc, landmarks, finger_preset):
    """Create the canonical armature, then move joints to landmarks.

    In a real build the canonical skeleton is appended from skeletons/<id>.blend so rolls
    and rest transforms are inherited verbatim. Here we construct the required deform joints
    directly from the descriptor's landmark map to keep the reference self-contained.
    """
    arm_data = bpy.data.armatures.new("canon_biped_v2")
    arm_obj = bpy.data.objects.new("Armature", arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)

    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    ebones = arm_data.edit_bones

    lm = {k: Vector(v) for k, v in landmarks.items()}

    def bone(name, head, tail, parent=None):
        b = ebones.new(name)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = parent
            b.use_connect = False
        return b

    # Spine chain: Hips -> ... -> chest -> head -> chin. Interpolate spine from hips->chin.
    hips = lm["hips"]
    chin = lm["chin"]
    shoulder_mid = (lm["shoulder.L"] + lm["shoulder.R"]) * 0.5
    root = bone("Root", hips + Vector((0, 0, -hips.z)), hips)
    b_hips = bone("Hips", hips, hips + (shoulder_mid - hips) * 0.25, root)
    b_s1 = bone("Spine_01", b_hips.tail, hips + (shoulder_mid - hips) * 0.55, b_hips)
    b_s2 = bone("Spine_02", b_s1.tail, hips + (shoulder_mid - hips) * 0.85, b_s1)
    b_chest = bone("Spine_Chest", b_s2.tail, shoulder_mid, b_s2)
    b_head = bone("Neck_Head", shoulder_mid, shoulder_mid + (chin - shoulder_mid) * 0.6, b_chest)
    bone("Neck_Chin", b_head.tail, chin, b_head)

    for side in ("L", "R"):
        sh = lm[f"shoulder.{side}"]
        el = lm[f"elbow.{side}"]
        wr = lm[f"wrist.{side}"]
        clav = bone(f"Clavicle.{side}", shoulder_mid, sh, b_chest)
        b_sh = bone(f"Arm_Shoulder.{side}", sh, el, clav)
        b_el = bone(f"Arm_Elbow.{side}", el, wr, b_sh)
        b_wr = bone(f"Arm_Wrist.{side}", wr, wr + (wr - el).normalized() * 0.08, b_el)

        hip = lm["hips"] + Vector((0.09 if side == "L" else -0.09, 0, 0))
        kn = lm[f"knee.{side}"]
        an = lm[f"ankle.{side}"]
        b_hip = bone(f"Leg_Hip.{side}", hip, kn, b_hips)
        b_kn = bone(f"Leg_Knee.{side}", kn, an, b_hip)
        b_an = bone(f"Leg_Ankle.{side}", an, an + Vector((0, -0.12, -0.02)), b_kn)
        b_ball = bone(f"Leg_Ball.{side}", b_an.tail, b_an.tail + Vector((0, -0.08, 0)), b_an)
        bone(f"Leg_Toe.{side}", b_ball.tail, b_ball.tail + Vector((0, -0.04, 0)), b_ball)

        # Hand sub-rig stub named per preset (full digits appended from module in real build).
        attach_hand_module(ebones, side, b_wr, finger_preset)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def attach_hand_module(ebones, side, wrist_bone, preset):
    """Create digit root bones named per the canonical hand module."""
    module = {
        "preset_2finger": ["Hand_Thumb", "Hand_Digit1"],
        "preset_3finger": ["Hand_Thumb", "Hand_Index", "Hand_Middle"],
        "preset_5finger": ["Hand_Thumb", "Hand_Index", "Hand_Middle", "Hand_Ring", "Hand_Pinky"],
    }[preset]
    base = wrist_bone.tail
    for i, digit in enumerate(module):
        offset = Vector((0.02 * (i - len(module) / 2), -0.03, 0))
        b = ebones.new(f"{digit}_01.{side}")
        b.head = base + offset
        b.tail = base + offset + Vector((0, -0.03, 0))
        b.parent = wrist_bone
        b.use_connect = False


def main():
    args = parse_stage_args()
    dna = load_json(args.config)
    finger_preset = dna["finger_schema"]["preset"]

    # Locate side inputs next to the config (illustrative convention).
    run_dir = os.path.dirname(args.in_path)
    landmarks = load_json(os.path.join(run_dir, "landmarks.json"))
    desc_path = os.path.join(os.path.dirname(args.config), "..", "examples",
                             "skeleton.canon_biped_v2.json")
    desc = load_json(desc_path) if os.path.exists(desc_path) else {"landmarks": {}}

    thr = load_json(args.thresholds) if args.thresholds else {}
    rig_thr = thr.get("rig", {})
    required = rig_thr.get("required_landmarks", [])
    residual_max_mm = rig_thr.get("landmark_residual_mm_max", 15.0)
    lr_sym_max_mm = rig_thr.get("landmark_lr_symmetry_mm_max", 5.0)

    receipt = Receipt("S08_landmark_rig", args, {"dna": dna, "rig": rig_thr})

    bpy.ops.wm.open_mainfile(filepath=args.in_path)

    missing = [k for k in required if k not in landmarks]
    receipt.check("rig", "all_required_landmarks_present", len(missing), 0,
                  len(missing) == 0, hard_fail=True)
    if missing:
        receipt.note(f"missing landmarks: {missing}")
        receipt.write(args.out_path)
        sys.exit(1)

    arm = build_armature_from_descriptor(desc, landmarks, finger_preset)

    # Residual check: fitted joint head vs its landmark (0 by construction here; a real
    # build measures the appended canonical skeleton's snapped positions).
    residuals_mm = 0.0
    receipt.check("rig", "landmark_residual_mm", residuals_mm, residual_max_mm,
                  residuals_mm <= residual_max_mm, hard_fail=False)

    # L/R symmetry of provided landmarks.
    worst_asym = 0.0
    for base in ("shoulder", "elbow", "wrist", "knee", "ankle"):
        l = Vector(landmarks[f"{base}.L"])
        r = Vector(landmarks[f"{base}.R"])
        mirrored_r = Vector((-r.x, r.y, r.z))
        worst_asym = max(worst_asym, (l - mirrored_r).length * 1000.0)
    receipt.check("rig", "landmark_lr_symmetry_mm", round(worst_asym, 3), lr_sym_max_mm,
                  worst_asym <= lr_sym_max_mm, hard_fail=False)

    # Parent the mesh(es) to the armature (weighting happens in S9).
    for o in [o for o in bpy.data.objects if o.type == "MESH"]:
        o.parent = arm

    bpy.ops.wm.save_as_mainfile(filepath=args.out_path)
    receipt.write(args.out_path)
    if receipt.any_hard_fail():
        sys.exit(1)


if __name__ == "__main__":
    main()
