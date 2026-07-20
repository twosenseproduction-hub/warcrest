#!/usr/bin/env python3
"""Bind Drive bow-elf mesh to the purple-elf Meshy Mixamo-like armature.

Meshy pose estimation failed on this clay A-pose (bow welded into mesh),
so we reuse the known-good Mixamo-like skeleton + automatic weights.

  blender -b -noaudio --python tools/.meshy-work/bind_bow_elf_to_meshy_rig.py
"""
from __future__ import annotations

import os

import bpy
from mathutils import Vector

RAW = "/workspace/assets/models/meshy/drive_character_raw.glb"
RIG = "/workspace/assets/models/meshy/purple_elf_meshy_rigged.glb"
OUT = "/workspace/assets/models/meshy/bow_elf_meshy_rigged.glb"
TARGET_FACES = 80000
HEIGHT = 1.7


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    bpy.ops.import_scene.gltf(filepath=RAW)
    mesh = next(o for o in bpy.data.objects if o.type == "MESH")
    mesh.name = "bow_elf"

    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    mod = mesh.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = TARGET_FACES / max(len(mesh.data.polygons), 1)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print("faces", len(mesh.data.polygons), flush=True)

    img = bpy.data.images.new("clay", 16, 16)
    img.pixels = [0.78, 0.76, 0.74, 1.0] * (16 * 16)
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

    # glTF import → Blender Z-up. Plant + scale on Z.
    coords = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    mn = Vector((min(c[i] for c in coords) for i in range(3)))
    mx = Vector((max(c[i] for c in coords) for i in range(3)))
    h = mx.z - mn.z
    mesh.scale *= HEIGHT / h
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    coords = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    mn = Vector((min(c[i] for c in coords) for i in range(3)))
    cx = sum(c.x for c in coords) / len(coords)
    cy = sum(c.y for c in coords) / len(coords)
    mesh.location = Vector((-cx, -cy, -mn.z))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    print(
        "mesh z",
        min((mesh.matrix_world @ v.co).z for v in mesh.data.vertices),
        max((mesh.matrix_world @ v.co).z for v in mesh.data.vertices),
        flush=True,
    )

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=RIG)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    for o in list(new):
        if o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    hips = arm.pose.bones.get("Hips")
    mesh_h = max((mesh.matrix_world @ v.co).z for v in mesh.data.vertices)
    arm_zs = [(arm.matrix_world @ b.head_local).z for b in arm.data.bones]
    arm_h = max(arm_zs) - min(arm_zs)
    if arm_h > 1e-6:
        arm.scale *= mesh_h / arm_h
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if hips:
        th = arm.matrix_world @ hips.head
        target_hips_z = 0.55 * mesh_h
        arm.location.z += target_hips_z - th.z
        bpy.context.view_layer.update()
        print("hips", tuple(arm.matrix_world @ hips.head), flush=True)

    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    print("mods", [m.type for m in mesh.modifiers], flush=True)

    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.name.lower().startswith("ico"):
            bpy.data.objects.remove(o, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_skins=True,
        export_materials="EXPORT",
        export_yup=True,
    )
    print("WROTE", OUT, os.path.getsize(OUT), "bones", len(arm.data.bones), flush=True)


if __name__ == "__main__":
    main()
