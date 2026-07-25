#!/usr/bin/env python3
"""Build a screenshot-inspired blocky chibi druid in Blender and export as GLB.

Run with Blender:
  blender -b -noaudio --factory-startup --python tools/rig/build_hunters_chibi_druid.py -- \
    --out assets/models --name hunters_chibi_druid \
    --preview /opt/cursor/artifacts/hunters_chibi_druid.png
"""

import bpy
import bmesh
import math
import mathutils
import os
import sys


V = mathutils.Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def arg(flag, default=None):
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    return argv[argv.index(flag) + 1] if flag in argv else default


OUT = arg("--out", os.path.join(ROOT, "assets", "models"))
NAME = arg("--name", "hunters_chibi_druid")
PREVIEW = arg("--preview", os.path.join("/opt/cursor/artifacts", NAME + ".png"))
BLEND = arg("--blend", os.path.join("/opt/cursor/artifacts", NAME + ".blend"))


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block_group in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(block_group):
            try:
                block_group.remove(block)
            except Exception:
                pass


def mat(name, base, rough=0.65, metallic=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    try:
        bsdf.inputs["Metallic"].default_value = metallic
    except Exception:
        pass
    if emit is not None:
        try:
            bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        except Exception:
            bsdf.inputs["Emission"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return m


def finish_object(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    me.materials.append(material)
    for poly in me.polygons:
        poly.use_smooth = False
    return obj


def beveled_cube(name, center, size, material, rot=(0, 0, 0), bevel=0.08):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(
        bm,
        matrix=mathutils.Matrix.Diagonal((size[0], size[1], size[2], 1.0)),
        verts=bm.verts,
    )
    if bevel > 0:
        bmesh.ops.bevel(
            bm,
            geom=bm.verts[:] + bm.edges[:],
            offset=min(size) * bevel,
            segments=2,
            affect="EDGES",
        )
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=mathutils.Euler(rot).to_matrix())
    bmesh.ops.translate(bm, vec=V(center), verts=bm.verts)
    return finish_object(name, bm, material)


def tapered_block(name, center, radius1, radius2, depth, material, rot=(0, 0, 0), sides=4, twist=math.pi / 4):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=sides,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
    )
    if twist:
        bmesh.ops.rotate(
            bm,
            verts=bm.verts,
            cent=(0, 0, 0),
            matrix=mathutils.Euler((0, 0, twist)).to_matrix(),
        )
    bmesh.ops.bevel(
        bm,
        geom=bm.verts[:] + bm.edges[:],
        offset=min(radius1, max(radius2, 0.001), depth) * 0.12,
        segments=2,
        affect="EDGES",
    )
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=mathutils.Euler(rot).to_matrix())
    bmesh.ops.translate(bm, vec=V(center), verts=bm.verts)
    return finish_object(name, bm, material)


def orb(name, center, radius, material, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=radius)
    bmesh.ops.transform(
        bm,
        matrix=mathutils.Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0)),
        verts=bm.verts,
    )
    bmesh.ops.translate(bm, vec=V(center), verts=bm.verts)
    return finish_object(name, bm, material)


def point_object(obj, target):
    direction = V(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


clear_scene()

M_SKIN = mat("skin", (0.85, 0.82, 0.80), rough=0.82)
M_SKIN_D = mat("skin_d", (0.70, 0.68, 0.66), rough=0.84)
M_ROBE = mat("robe", (0.31, 0.62, 0.34), rough=0.76)
M_ROBE_D = mat("robe_d", (0.18, 0.37, 0.21), rough=0.84)
M_GOLD = mat("gold", (0.91, 0.72, 0.28), rough=0.34, metallic=0.46)
M_LEATHER = mat("leather", (0.38, 0.24, 0.15), rough=0.9)
M_HAIR = mat("hair", (0.54, 0.22, 0.86), rough=0.54)
M_HAIR_D = mat("hair_d", (0.31, 0.09, 0.54), rough=0.64)
M_BONE = mat("bone", (0.80, 0.75, 0.59), rough=0.82)
M_WOOD = mat("wood", (0.42, 0.28, 0.15), rough=0.92)
M_GLOW = mat("glow", (0.48, 0.98, 0.62), rough=0.18, emit=(0.48, 0.98, 0.62), emit_strength=2.0)
M_DARK = mat("dark", (0.12, 0.10, 0.16), rough=0.95)

parts = []

# Pedestal proportions are roughly Warcraft / mobile-hero cute: oversized head, short body.
parts.append(beveled_cube("foot_l", (-0.28, 0.0, 0.13), (0.34, 0.58, 0.18), M_GOLD, rot=(0, 0, 0.04)))
parts.append(beveled_cube("foot_r", (0.28, 0.0, 0.13), (0.34, 0.58, 0.18), M_GOLD, rot=(0, 0, -0.04)))
parts.append(beveled_cube("leg_l", (-0.22, 0.0, 0.62), (0.22, 0.24, 0.70), M_SKIN_D))
parts.append(beveled_cube("leg_r", (0.22, 0.0, 0.62), (0.22, 0.24, 0.70), M_SKIN_D))
parts.append(tapered_block("skirt", (0.0, 0.0, 1.18), 0.56, 0.38, 0.86, M_ROBE, rot=(0, 0, 0)))
parts.append(beveled_cube("belt", (0.0, 0.0, 1.45), (0.90, 0.62, 0.12), M_GOLD))
parts.append(beveled_cube("torso", (0.0, 0.0, 1.85), (0.78, 0.52, 0.78), M_ROBE_D))
parts.append(beveled_cube("chest", (0.0, -0.16, 1.94), (0.44, 0.10, 0.36), M_GOLD))
parts.append(beveled_cube("pauldron_l", (-0.48, 0.0, 2.02), (0.22, 0.24, 0.24), M_GOLD, rot=(0.18, 0.0, 0.18)))
parts.append(beveled_cube("pauldron_r", (0.48, 0.0, 2.02), (0.22, 0.24, 0.24), M_GOLD, rot=(0.18, 0.0, -0.18)))
parts.append(beveled_cube("arm_l1", (-0.76, -0.02, 1.82), (0.20, 0.22, 0.58), M_ROBE_D, rot=(0.0, 0.10, 0.78)))
parts.append(beveled_cube("arm_l2", (-1.02, -0.04, 1.38), (0.18, 0.18, 0.58), M_SKIN_D, rot=(0.0, 0.14, 0.42)))
parts.append(beveled_cube("hand_l", (-1.10, -0.08, 0.99), (0.18, 0.20, 0.18), M_SKIN))
parts.append(beveled_cube("arm_r1", (0.66, 0.10, 1.96), (0.20, 0.22, 0.58), M_ROBE_D, rot=(0.0, -0.28, -0.96)))
parts.append(beveled_cube("arm_r2", (0.98, 0.16, 2.32), (0.18, 0.18, 0.48), M_SKIN_D, rot=(0.0, -0.12, -0.46)))
parts.append(beveled_cube("hand_r", (1.12, 0.20, 2.58), (0.18, 0.20, 0.18), M_SKIN))

parts.append(beveled_cube("neck", (0.0, 0.0, 2.34), (0.18, 0.18, 0.18), M_SKIN))
parts.append(beveled_cube("head", (0.0, 0.0, 2.86), (1.10, 0.92, 0.92), M_SKIN, rot=(0.0, 0.0, 0.02)))
parts.append(beveled_cube("face_mask", (0.0, -0.34, 2.78), (0.56, 0.10, 0.52), M_DARK))
parts.append(beveled_cube("hair_cap", (0.0, 0.16, 3.10), (1.00, 0.72, 0.42), M_HAIR))
parts.append(beveled_cube("hair_back", (0.0, 0.34, 2.74), (0.82, 0.34, 0.72), M_HAIR_D))
parts.append(beveled_cube("bang_l", (-0.26, -0.26, 2.76), (0.18, 0.12, 0.56), M_HAIR, rot=(0.0, 0.0, 0.16)))
parts.append(beveled_cube("bang_r", (0.26, -0.26, 2.76), (0.18, 0.12, 0.56), M_HAIR, rot=(0.0, 0.0, -0.16)))
parts.append(beveled_cube("ponytail", (0.0, 0.44, 2.42), (0.30, 0.18, 0.74), M_HAIR_D, rot=(0.12, 0.0, 0.0)))
parts.append(beveled_cube("eye_l", (-0.16, -0.41, 2.86), (0.14, 0.04, 0.12), M_GLOW))
parts.append(beveled_cube("eye_r", (0.16, -0.41, 2.86), (0.14, 0.04, 0.12), M_GLOW))
parts.append(beveled_cube("mouth", (0.0, -0.41, 2.62), (0.18, 0.04, 0.07), M_GLOW))

# Antlers: chunky and readable rather than anatomically thin.
parts.append(tapered_block("antler_l_base", (-0.34, 0.10, 3.42), 0.08, 0.08, 0.56, M_BONE, rot=(0.46, 0.0, 0.34), sides=6, twist=0.0))
parts.append(tapered_block("antler_l_tip", (-0.58, 0.10, 3.74), 0.06, 0.04, 0.42, M_BONE, rot=(0.16, 0.0, 1.10), sides=6, twist=0.0))
parts.append(tapered_block("antler_l_branch", (-0.54, 0.04, 3.56), 0.04, 0.02, 0.22, M_BONE, rot=(0.18, 0.18, 0.48), sides=6, twist=0.0))
parts.append(tapered_block("antler_r_base", (0.34, 0.10, 3.42), 0.08, 0.08, 0.56, M_BONE, rot=(0.46, 0.0, -0.34), sides=6, twist=0.0))
parts.append(tapered_block("antler_r_tip", (0.58, 0.10, 3.74), 0.06, 0.04, 0.42, M_BONE, rot=(0.16, 0.0, -1.10), sides=6, twist=0.0))
parts.append(tapered_block("antler_r_branch", (0.54, 0.04, 3.56), 0.04, 0.02, 0.22, M_BONE, rot=(0.18, -0.18, -0.48), sides=6, twist=0.0))

# Staff and glow familiar.
parts.append(tapered_block("staff", (-1.06, -0.06, 1.44), 0.06, 0.05, 1.94, M_WOOD, rot=(0.10, 0.14, 0.06), sides=6, twist=0.0))
parts.append(orb("staff_orb", (-1.16, -0.12, 2.38), 0.14, M_GLOW, scale=(1.0, 1.0, 1.0)))
parts.append(beveled_cube("staff_bind", (-1.13, -0.10, 2.16), (0.20, 0.06, 0.12), M_GOLD, rot=(0.0, 0.0, 0.30)))
parts.append(orb("hand_orb", (1.28, 0.28, 2.74), 0.13, M_GLOW, scale=(1.0, 1.0, 1.0)))

# Cloak / sash and small charm to push the mobile-fantasy read.
parts.append(beveled_cube("cape", (0.0, 0.38, 1.92), (0.58, 0.10, 1.02), M_ROBE, rot=(-0.14, 0.0, 0.0)))
parts.append(beveled_cube("sash", (0.14, -0.18, 1.02), (0.20, 0.08, 0.94), M_HAIR_D, rot=(0.10, 0.0, -0.06)))
parts.append(beveled_cube("charm", (0.00, -0.29, 1.16), (0.14, 0.08, 0.18), M_GLOW))

# Join all character parts into a single exported hero object.
for obj in bpy.context.selected_objects:
    obj.select_set(False)
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
hero = bpy.context.view_layer.objects.active
hero.name = NAME

hero.data.update()
z_min = min((hero.matrix_world @ v.co).z for v in hero.data.vertices)
hero.location.z -= z_min

# Export the GLB before adding preview-only scene dressing.
os.makedirs(OUT, exist_ok=True)
glb_path = os.path.join(OUT, NAME + ".glb")
bpy.ops.object.select_all(action="DESELECT")
hero.select_set(True)
bpy.context.view_layer.objects.active = hero
bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=True)

# Save a .blend artifact too so the unit can be reopened in Blender proper later.
if BLEND:
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, copy=True)

# Preview lighting and render.
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.preview_samples = 8
scene.cycles.use_denoising = False
scene.cycles.device = "CPU"
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"

world = bpy.data.worlds.new("PreviewWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.05, 0.08, 0.12, 1.0)
bg.inputs[1].default_value = 0.85

pedestal = bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.65, depth=0.18, location=(0, 0, 0.09))
pedestal_obj = bpy.context.active_object
pedestal_obj.name = "Pedestal"
pedestal_obj.data.materials.append(mat("pedestal", (0.18, 0.22, 0.28), rough=0.78))

ring = bpy.ops.mesh.primitive_torus_add(
    major_radius=1.20,
    minor_radius=0.03,
    major_segments=48,
    minor_segments=12,
    location=(0, 0, 0.19),
    rotation=(math.pi / 2, 0, 0),
)
ring_obj = bpy.context.active_object
ring_obj.name = "RuneRing"
ring_obj.data.materials.append(mat("rune", (0.35, 0.94, 0.64), rough=0.2, emit=(0.35, 0.94, 0.64), emit_strength=1.2))

bpy.ops.object.light_add(type="SUN", location=(3.0, -4.5, 6.5))
sun = bpy.context.active_object
sun.data.energy = 2.3
sun.rotation_euler = (0.88, 0.0, 0.82)

bpy.ops.object.light_add(type="AREA", location=(-3.2, 3.0, 3.8))
fill = bpy.context.active_object
fill.data.energy = 1800
fill.data.shape = "RECTANGLE"
fill.data.size = 4.0
fill.data.size_y = 4.0
point_object(fill, (0, 0, 2.4))

bpy.ops.object.camera_add(location=(0.8, -6.6, 3.5))
cam = bpy.context.active_object
cam.data.lens = 58
cam.data.sensor_width = 32
point_object(cam, (0.0, 0.0, 2.25))
scene.camera = cam
hero.rotation_euler.z = math.radians(22)

if PREVIEW:
    os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)

tri_count = sum(len(poly.vertices) - 2 for poly in hero.data.polygons)
print("BUILT", glb_path, os.path.getsize(glb_path), "bytes; tris ~", tri_count)
if PREVIEW:
    print("PREVIEW", PREVIEW)
if BLEND:
    print("BLEND", BLEND)
