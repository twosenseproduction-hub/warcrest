#!/usr/bin/env python3
"""Build purple plate elf in Blender (YouTube low-poly poly-model workflow).

See assets/models/blender/YOUTUBE_WORKFLOW.md for tutorial sources.

  blender -b -noaudio --python tools/blender-character/build_purple_plate_elf.py
"""
from __future__ import annotations

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector


def rot_mat(rot_euler):
    return Euler(rot_euler).to_matrix()

REPO = Path("/workspace")
OUT_BLEND = REPO / "assets/models/blender/purple_plate_elf.blend"
OUT_GLB = REPO / "assets/models/blender/purple_plate_elf.glb"
OUT_STILL = Path("/opt/cursor/artifacts/blender_purple_elf/still.png")
OUT_COMPARE = Path("/opt/cursor/artifacts/blender_purple_elf/compare.png")
REF = REPO / "assets/models/blender/purple_plate_elf_ref.jpg"

# Saturated palette (Drive purple elf / STYLE.md)
PAL = {
    "skin": (0.70, 0.55, 0.76),
    "armor": (0.28, 0.12, 0.40),
    "armor_d": (0.18, 0.08, 0.28),
    "silver": (0.82, 0.82, 0.86),
    "hair": (0.20, 0.08, 0.28),
    "gem": (0.25, 1.0, 0.22),
    "boot": (0.12, 0.06, 0.18),
}


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat_diffuse(name: str, rgb, emit=None, emit_str=0.0):
    """Matte material via Principled (glTF exports Diffuse BSDF as white)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = 0.0
    elif "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    if emit is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = (*emit, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emit_str
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = (*rgb, 1.0)
    return m


def flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False


def apply_xf(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)


def add_mesh(name, bm, mat_obj, loc=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = Vector(loc)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    obj.select_set(False)
    obj.data.materials.append(mat_obj)
    flat(obj)
    return obj


def cube_mesh(sx, sy, sz):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((sx, sy, sz)), verts=bm.verts)
    return bm


def cyl_mesh(r_bot, r_top, depth, segs=8):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=segs,
        radius1=r_bot,
        radius2=r_top,
        depth=depth,
    )
    return bm


def ico_mesh(radius, subdiv=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    return bm


def cone_mesh(radius, depth, segs=5):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segs, radius1=radius, radius2=0.001, depth=depth
    )
    return bm


def box(name, size, loc, mat_obj, rot_euler=None):
    bm = cube_mesh(*size)
    if rot_euler:
        bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=rot_mat(rot_euler), verts=bm.verts)
    return add_mesh(name, bm, mat_obj, loc)


def cyl(name, r_bot, r_top, depth, loc, mat_obj, segs=8, rot_euler=None, scale_xy=(1, 1)):
    bm = cyl_mesh(r_bot, r_top, depth, segs)
    if scale_xy != (1, 1):
        bmesh.ops.scale(bm, vec=Vector((scale_xy[0], scale_xy[1], 1)), verts=bm.verts)
    if rot_euler:
        bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=rot_mat(rot_euler), verts=bm.verts)
    return add_mesh(name, bm, mat_obj, loc)


def ico(name, radius, loc, mat_obj, subdiv=1, scale=(1, 1, 1)):
    bm = ico_mesh(radius, subdiv)
    if scale != (1, 1, 1):
        bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    return add_mesh(name, bm, mat_obj, loc)


def cone(name, radius, depth, loc, mat_obj, segs=5, rot_euler=None):
    bm = cone_mesh(radius, depth, segs)
    if rot_euler:
        bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=rot_mat(rot_euler), verts=bm.verts)
    return add_mesh(name, bm, mat_obj, loc)


def build(mats):
    # --- legs ---
    for s in (-1.0, 1.0):
        cyl(f"thigh_{s}", 0.10, 0.12, 0.38, (0.13 * s, 0, 0.58), mats["armor"], segs=8, scale_xy=(1.05, 0.9))
        cyl(f"shin_{s}", 0.085, 0.10, 0.36, (0.13 * s, 0, 0.22), mats["armor_d"], segs=8, scale_xy=(1.0, 0.9))
        box(f"boot_{s}", (0.15, 0.24, 0.09), (0.13 * s, 0.05, 0.045), mats["boot"])
        box(f"knee_{s}", (0.11, 0.09, 0.09), (0.13 * s, 0.04, 0.40), mats["silver"])

    # hips + belt + 3 tassets
    cyl("hips", 0.20, 0.22, 0.14, (0, 0, 0.84), mats["armor"], segs=10, scale_xy=(1.2, 0.8))
    box("belt", (0.46, 0.30, 0.055), (0, 0.02, 0.92), mats["silver"])
    for i, x in enumerate((-0.15, 0.0, 0.15)):
        box(f"tasset_{i}", (0.13, 0.05, 0.30), (x, 0.14, 0.74), mats["armor"])
        box(f"tasset_edge_{i}", (0.14, 0.02, 0.31), (x, 0.17, 0.74), mats["silver"])

    # torso breastplate
    cyl("torso", 0.17, 0.22, 0.50, (0, 0, 1.20), mats["armor"], segs=10, scale_xy=(1.05, 0.68))
    # silver filigree (hand-painted feel as geometry)
    box("fil_center", (0.09, 0.025, 0.20), (0, 0.145, 1.24), mats["silver"])
    for s in (-1.0, 1.0):
        box(f"fil_top_{s}", (0.08, 0.025, 0.05), (0.07 * s, 0.145, 1.36), mats["silver"])
        box(f"fil_bot_{s}", (0.06, 0.025, 0.08), (0.055 * s, 0.145, 1.12), mats["silver"])
        box(f"fil_side_{s}", (0.04, 0.02, 0.16), (0.14 * s, 0.12, 1.22), mats["silver"])
    ico("collar_gem", 0.032, (0, 0.16, 1.42), mats["gem"], subdiv=1)

    # neck + head (skin must READ on face — hair only back/top)
    cyl("neck", 0.055, 0.06, 0.09, (0, 0.01, 1.50), mats["skin"], segs=8)
    ico("head", 0.125, (0, 0.03, 1.64), mats["skin"], subdiv=2, scale=(0.92, 0.88, 1.05))
    for s in (-1.0, 1.0):
        cone(
            f"ear_{s}",
            0.035,
            0.17,
            (0.125 * s, -0.01, 1.66),
            mats["skin"],
            segs=4,
            rot_euler=(math.radians(10), 0, math.radians(-75 * s)),
        )
        ico(f"eye_{s}", 0.018, (0.04 * s, 0.115, 1.65), mats["gem"], subdiv=1)
    # brow ridges (skin, read as face)
    for s in (-1.0, 1.0):
        box(f"brow_{s}", (0.05, 0.02, 0.015), (0.04 * s, 0.11, 1.69), mats["skin"])

    # hair crest (behind / on top — leave face clear)
    box("hair_crest", (0.09, 0.14, 0.20), (0, -0.04, 1.76), mats["hair"])
    box("hair_back", (0.15, 0.10, 0.14), (0, -0.10, 1.66), mats["hair"])
    cone("hair_peak", 0.05, 0.10, (0, -0.01, 1.88), mats["hair"], segs=5)
    for s in (-1.0, 1.0):
        box(f"hair_side_{s}", (0.04, 0.07, 0.10), (0.09 * s, -0.06, 1.60), mats["hair"])

    # pauldrons
    for s in (-1.0, 1.0):
        ico(f"pauldron_{s}", 0.15, (0.30 * s, 0.0, 1.42), mats["armor"], subdiv=1, scale=(1.25, 0.9, 0.72))
        box(f"pauldron_trim_{s}", (0.16, 0.035, 0.05), (0.30 * s, 0.09, 1.38), mats["silver"])
        cone(
            f"pauldron_leaf_{s}",
            0.045,
            0.11,
            (0.36 * s, 0.02, 1.50),
            mats["silver"],
            segs=4,
            rot_euler=(0, 0, math.radians(20 * s)),
        )

    # T-pose arms + skin hands (empty)
    for s in (-1.0, 1.0):
        cyl(
            f"uarm_{s}",
            0.055,
            0.07,
            0.32,
            (0.50 * s, 0, 1.38),
            mats["armor"],
            segs=7,
            rot_euler=(0, math.radians(90), 0),
        )
        cyl(
            f"farm_{s}",
            0.048,
            0.058,
            0.30,
            (0.82 * s, 0, 1.38),
            mats["armor_d"],
            segs=7,
            rot_euler=(0, math.radians(90), 0),
        )
        box(f"bracer_{s}", (0.07, 0.07, 0.035), (0.68 * s, 0, 1.38), mats["silver"])
        ico(f"hand_{s}", 0.055, (1.02 * s, 0, 1.38), mats["skin"], subdiv=1, scale=(1.25, 0.7, 0.85))
        ico(f"hand_gem_{s}", 0.018, (0.95 * s, 0.05, 1.40), mats["gem"], subdiv=1)


def join_character():
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = "PurplePlateElf"
    # center + plant
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = Vector(tuple(min(c[i] for c in coords) for i in range(3)))
    mx = Vector(tuple(max(c[i] for c in coords) for i in range(3)))
    obj.location -= Vector(((mn.x + mx.x) * 0.5, (mn.y + mx.y) * 0.5, mn.z))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    coords = [v.co.copy() for v in obj.data.vertices]
    mn = Vector(tuple(min(c[i] for c in coords) for i in range(3)))
    mx = Vector(tuple(max(c[i] for c in coords) for i in range(3)))
    s = 1.7 / (mx.z - mn.z)
    obj.scale = (s, s, s)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    flat(obj)
    print(
        "materials",
        [m.name for m in obj.data.materials],
        "faces",
        len(obj.data.polygons),
        flush=True,
    )
    return obj


def render_still(path: Path, angle_deg=20):
    path.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.filepath = str(path)
    scene.render.image_settings.file_format = "PNG"
    # color management: Standard so Diffuse stays saturated
    if hasattr(scene.view_settings, "view_transform"):
        scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"

    # clean lights/camera
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)

    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.94, 0.94, 0.90, 1.0)
    bg.inputs[1].default_value = 0.85

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    scene.camera = cam
    a = math.radians(angle_deg)
    dist = 3.2
    # Character front is +Y (filigree / face); place camera on +Y to see front.
    cam.location = (math.sin(a) * dist, math.cos(a) * dist, 1.05)
    # look at mid torso
    direction = Vector((0, 0, 0.95)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 3.0
    sun_o = bpy.data.objects.new("Sun", sun)
    bpy.context.scene.collection.objects.link(sun_o)
    sun_o.rotation_euler = (math.radians(50), math.radians(10), math.radians(25))

    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 25
    fill.size = 3
    fill_o = bpy.data.objects.new("Fill", fill)
    bpy.context.scene.collection.objects.link(fill_o)
    fill_o.location = (-1.8, -0.8, 1.4)

    bpy.ops.render.render(write_still=True)
    print("STILL", path, flush=True)


def main():
    clear()
    mats = {
        "skin": mat_diffuse("Skin", PAL["skin"]),
        "armor": mat_diffuse("Armor", PAL["armor"]),
        "armor_d": mat_diffuse("ArmorDark", PAL["armor_d"]),
        "silver": mat_diffuse("Silver", PAL["silver"]),
        "hair": mat_diffuse("Hair", PAL["hair"]),
        "gem": mat_diffuse("Gem", PAL["gem"], emit=PAL["gem"], emit_str=3.0),
        "boot": mat_diffuse("Boot", PAL["boot"]),
    }
    build(mats)
    obj = join_character()
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_yup=True,
        export_animations=False,
    )
    print("GLB", OUT_GLB, OUT_GLB.stat().st_size, flush=True)
    render_still(OUT_STILL, angle_deg=18)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
