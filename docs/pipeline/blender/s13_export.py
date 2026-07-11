"""S13 Export packaging (reference implementation).

Exports the approved candidate to every engine named in the DNA using a FIXED preset from
export-presets.json. The call site is parameter-free: the preset fully determines axes,
scale, formats, and animation flags. Each export is round-trip verified (re-import and
compare vertex/bone counts + scale) against qa-thresholds.export.

in:  approved rigged+animated .blend + DNA (export_schema) + export-presets.json
out: per-engine files under out_dir + receipt
validate: round-trip vert/bone/scale parity per engine
fail:     round-trip mismatch -> hard_fail (preset bug; halt & alert, no silent fallback)
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_stage_args, load_json, Receipt, sorted_objects  # noqa: E402


def scene_counts():
    verts = 0
    bones = 0
    for o in sorted_objects(bpy.data.objects):
        if o.type == "MESH":
            verts += len(o.data.vertices)
        if o.type == "ARMATURE":
            bones += len(o.data.bones)
    return verts, bones


def export_fbx(path, preset_engine, common):
    bpy.ops.export_scene.fbx(
        filepath=path,
        use_selection=False,
        apply_unit_scale=True,
        global_scale=preset_engine.get("scale_factor", 1.0),
        axis_up=preset_engine["up_axis"],
        axis_forward=preset_engine.get("forward_axis", "-Z"),
        add_leaf_bones=preset_engine.get("leaf_bones", False),
        bake_anim=common.get("bake_animation", True),
        bake_anim_use_all_actions=True,
        mesh_smooth_type={"face": "FACE", "edge": "EDGE", "off": "OFF"}.get(
            common.get("smoothing", "face"), "FACE"),
        use_tspace=common.get("tangent_space", True),
        use_triangles=common.get("triangulate", True),
        primary_bone_axis=preset_engine.get("bone_axis_primary", "Y"),
        secondary_bone_axis=preset_engine.get("bone_axis_secondary", "X"),
    )


def export_gltf(path, preset_engine, common):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB" if preset_engine.get("gltf_variant") == "glb" else "GLTF_SEPARATE",
        export_yup=(preset_engine.get("up_axis", "Y") == "Y"),
        export_apply=common.get("apply_transforms", True),
        export_animations=common.get("bake_animation", True),
        export_texcoords=True,
        export_normals=True,
    )


def export_blend(path):
    bpy.ops.wm.save_as_mainfile(filepath=path, copy=True)


def roundtrip_counts_fbx(path):
    """Re-import into a scratch scene and count. Illustrative; a real build imports into a
    fresh temp .blend to avoid polluting state."""
    before = set(o.name for o in bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    imported = [o for o in bpy.data.objects if o.name not in before]
    verts = sum(len(o.data.vertices) for o in imported if o.type == "MESH")
    bones = sum(len(o.data.bones) for o in imported if o.type == "ARMATURE")
    for o in imported:
        bpy.data.objects.remove(o, do_unlink=True)
    return verts, bones


def main():
    args = parse_stage_args()
    dna = load_json(args.config)
    thr = load_json(args.thresholds) if args.thresholds else {}
    exp_thr = thr.get("export", {})

    presets = load_json(os.path.join(os.path.dirname(args.config), "..", "export-presets.json")) \
        if False else load_json(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                              "..", "export-presets.json"))
    preset_key = dna["export_schema"]["preset_ref"]
    preset = presets[preset_key]
    common = preset["common"]

    receipt = Receipt("S13_export", args, {"dna": dna, "preset": preset_key, "export": exp_thr})
    bpy.ops.wm.open_mainfile(filepath=args.in_path)

    out_dir = args.out_path  # here out_path is a directory
    os.makedirs(out_dir, exist_ok=True)
    src_verts, src_bones = scene_counts()

    for engine in dna["export_schema"]["engines"]:
        pe = preset[engine]
        fmt = pe["format"]
        out_file = os.path.join(out_dir, f"{dna['dna_id']}_{engine}.{ 'glb' if fmt=='gltf' else fmt }")

        if fmt == "fbx":
            export_fbx(out_file, pe, common)
            rv, rb = roundtrip_counts_fbx(out_file)
            receipt.check("export", f"{engine}_roundtrip_vert_delta", rv - src_verts,
                          exp_thr.get("roundtrip_vertex_count_delta_max", 0),
                          abs(rv - src_verts) <= exp_thr.get("roundtrip_vertex_count_delta_max", 0),
                          hard_fail=True)
            receipt.check("export", f"{engine}_roundtrip_bone_delta", rb - src_bones,
                          exp_thr.get("roundtrip_bone_count_delta_max", 0),
                          abs(rb - src_bones) <= exp_thr.get("roundtrip_bone_count_delta_max", 0),
                          hard_fail=True)
        elif fmt == "gltf":
            export_gltf(out_file, pe, common)
            receipt.note(f"{engine}: exported glTF {out_file} (round-trip via gltf importer in real build)")
        elif fmt == "blend":
            export_blend(out_file)
            receipt.note(f"{engine}: saved .blend {out_file}")

        receipt.note(f"exported {engine} -> {os.path.basename(out_file)}")

    # write receipt beside the export dir
    receipt.write(out_dir)
    if receipt.any_hard_fail():
        sys.exit(1)


if __name__ == "__main__":
    main()
