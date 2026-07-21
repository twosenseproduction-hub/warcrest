#!/usr/bin/env python3
"""Blender Guru Donut 5.0 — procedural recreation (headless).

Follows the study pack in assets/models/blender/blender_guru_donut_v5/
(parts 1–8): torus donut + icing drips, mug, plate, materials, sprinkle
scatter, lighting/render.

  blender -b -noaudio --python tools/blender-character/follow_blender_guru_donut.py
"""
from __future__ import annotations

import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

REPO = Path("/workspace")
OUT_DIR = REPO / "assets/models/blender"
STUDY = OUT_DIR / "blender_guru_donut_v5"
ART = Path("/opt/cursor/artifacts/blender_guru_donut")
OUT_BLEND = STUDY / "donut.blend"
OUT_GLB = STUDY / "donut.glb"

# Live preview / status for dashboard + AI agents (tools/blender-monitor)
sys.path.insert(0, str(REPO / "tools/blender-monitor/lib"))
from monitor_preview import Monitor  # noqa: E402

# Scene scale matches the tutorial (~10cm donut)
MAJOR = 0.055
MINOR = 0.028

MON: Monitor | None = None


def log(msg: str):
    print(f"[donut] {msg}", flush=True)
    if MON is not None:
        MON.log(msg)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Filmic"
    sc.view_settings.look = "Medium High Contrast"
    sc.render.resolution_x = 1280
    sc.render.resolution_y = 960
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new("World")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.035, 0.032, 0.030, 1.0)
    bg.inputs[1].default_value = 0.35


def mat(name, rgb, rough=0.55, spec=0.35, subsurface=0.0, sub_rgb=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = spec
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    # Optional SSS for dough / icing
    if subsurface > 0 and "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
        if sub_rgb and "Subsurface Color" in bsdf.inputs:
            bsdf.inputs["Subsurface Color"].default_value = (*sub_rgb, 1.0)
    elif subsurface > 0 and "Subsurface" in bsdf.inputs:
        bsdf.inputs["Subsurface"].default_value = subsurface
        if sub_rgb and "Subsurface Color" in bsdf.inputs:
            bsdf.inputs["Subsurface Color"].default_value = (*sub_rgb, 1.0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = (*rgb, 1.0)
    return m


def dough_mat():
    """Procedural fried-dough look (noise → brown)."""
    m = bpy.data.materials.new("Dough")
    m.use_nodes = True
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 18.0
    tex.inputs["Detail"].default_value = 8.0
    tex.inputs["Roughness"].default_value = 0.55
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.45, 0.22, 0.08, 1.0)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.78, 0.52, 0.22, 1.0)
    mid = ramp.color_ramp.elements.new(0.55)
    mid.color = (0.62, 0.36, 0.14, 1.0)
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(tex.outputs["Fac"], bump.inputs["Height"])
    if "Normal" in bsdf.inputs:
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.72
    key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = 0.2
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = 0.08
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m.diffuse_color = (0.62, 0.36, 0.14, 1.0)
    return m


def icing_mat():
    m = mat(
        "Icing",
        (0.92, 0.42, 0.62),
        rough=0.28,
        spec=0.55,
        subsurface=0.15,
        sub_rgb=(0.95, 0.55, 0.70),
    )
    # Slight bump for soft icing feel
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 40.0
    tex.inputs["Detail"].default_value = 4.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    if "Normal" in bsdf.inputs:
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    return obj


def shade_smooth(obj):
    mesh = obj.data
    if hasattr(mesh, "polygons"):
        for p in mesh.polygons:
            p.use_smooth = True
    if hasattr(mesh, "use_auto_smooth"):
        mesh.use_auto_smooth = True
        mesh.auto_smooth_angle = math.radians(60)


def apply_mods(obj):
    active(obj)
    for mod in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            log(f"mod apply skip {mod.name}: {e}")


def add_subsurf(obj, levels=2, render=3):
    mod = obj.modifiers.new("Subdivision", "SUBSURF")
    mod.levels = levels
    mod.render_levels = render
    return mod


# ---------------------------------------------------------------------------
# Geometry builders
# ---------------------------------------------------------------------------


def make_donut():
    bpy.ops.mesh.primitive_torus_add(
        major_radius=MAJOR,
        minor_radius=MINOR,
        major_segments=48,
        minor_segments=18,
        location=(0, 0, MINOR),
    )
    donut = bpy.context.active_object
    donut.name = "Donut"
    # Organic dough bumps (tutorial proportional-edit / sculpt pass)
    bm = bmesh.new()
    bm.from_mesh(donut.data)
    for v in bm.verts:
        n = noise.noise(v.co * 22.0)
        # Keep the bottom / inner hole a bit calmer
        lift = max(0.0, v.co.z - (MINOR * 0.35))
        v.co += v.normal * (n * 0.0018 + lift * n * 0.0012)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(donut.data)
    bm.free()
    donut.data.update()
    add_subsurf(donut, 2, 3)
    shade_smooth(donut)
    donut.data.materials.append(dough_mat())
    return donut


def make_icing(donut):
    """Top icing shell with drip lobes along the outer equator."""
    # Start from a slightly larger torus, keep upper half + drip verts
    bpy.ops.mesh.primitive_torus_add(
        major_radius=MAJOR,
        minor_radius=MINOR * 1.05,
        major_segments=64,
        minor_segments=24,
        location=(0, 0, MINOR + 0.0015),
    )
    icing = bpy.context.active_object
    icing.name = "Icing"

    bm = bmesh.new()
    bm.from_mesh(icing.data)
    bm.verts.ensure_lookup_table()
    # Delete lower faces (keep top icing cap)
    z_cut = MINOR * 0.15
    lower = [f for f in bm.faces if f.calc_center_median().z < z_cut]
    bmesh.ops.delete(bm, geom=lower, context="FACES")

    # Inflate remaining shell slightly outward/up
    for v in bm.verts:
        v.co += Vector((0, 0, 0.0012))
        # Soft noise on icing surface
        n = noise.noise(v.co * 30.0)
        v.co += v.normal * n * 0.0010

    # Add drip blobs around outer ring (tutorial sculpt drips)
    rng = random.Random(42)
    drip_angles = []
    a = 0.0
    while a < math.tau:
        drip_angles.append(a)
        a += rng.uniform(0.28, 0.55)
    for ang in drip_angles:
        cx = math.cos(ang) * (MAJOR + MINOR * 0.55)
        cy = math.sin(ang) * (MAJOR + MINOR * 0.55)
        length = rng.uniform(0.012, 0.028)
        width = rng.uniform(0.006, 0.011)
        # Droplet as elongated UV sphere verts merged via cone-ish
        bpy_ops_safe = True
        # Build drip in bmesh: icosphere-like oval
        tip = Vector((cx, cy, MINOR * 0.55 - length))
        root = Vector((cx * 0.98, cy * 0.98, MINOR * 0.85))
        # Create a small cone of faces between root ring and tip
        ring = []
        for i in range(8):
            t = i / 8 * math.tau
            # tangent basis
            radial = Vector((math.cos(ang), math.sin(ang), 0))
            tangent = Vector((-math.sin(ang), math.cos(ang), 0))
            p = root + (radial * math.cos(t) + tangent * math.sin(t)) * width
            # Bias downward a bit for hanging drip
            p.z -= abs(math.sin(t)) * width * 0.3
            ring.append(bm.verts.new(p))
        tip_v = bm.verts.new(tip)
        for i in range(8):
            bm.faces.new([ring[i], ring[(i + 1) % 8], tip_v])
        # Cap root toward icing (fan toward inward point)
        inward = bm.verts.new(root + Vector((-math.cos(ang), -math.sin(ang), 0.004)) * width)
        for i in range(8):
            try:
                bm.faces.new([inward, ring[(i + 1) % 8], ring[i]])
            except ValueError:
                pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Remove doubles
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
    bm.to_mesh(icing.data)
    bm.free()
    icing.data.update()

    # Solidify for icing thickness + subsurf
    sol = icing.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 0.0035
    sol.offset = 1.0
    add_subsurf(icing, 2, 3)
    shade_smooth(icing)
    icing.data.materials.append(icing_mat())

    # Parent visually near donut
    icing.parent = donut
    return icing


def make_plate():
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=64, radius=0.11, depth=0.008, location=(0, 0, 0.004)
    )
    plate = bpy.context.active_object
    plate.name = "Plate"
    # Dish profile: inset top face and push down
    active(plate)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    bm = bmesh.new()
    bm.from_mesh(plate.data)
    bm.faces.ensure_lookup_table()
    # Find top face (highest Z)
    top = max(bm.faces, key=lambda f: f.calc_center_median().z)
    for f in bm.faces:
        f.select = f is top
    # Inset + extrude down for rim
    ret = bmesh.ops.inset_individual(bm, faces=[top], thickness=0.012, depth=0.0)
    inner = ret["faces"]
    bmesh.ops.translate(bm, verts=list({v for f in inner for v in f.verts}), vec=(0, 0, -0.0035))
    bm.to_mesh(plate.data)
    bm.free()
    add_subsurf(plate, 2, 2)
    shade_smooth(plate)
    plate.data.materials.append(mat("Plate", (0.82, 0.82, 0.80), rough=0.35, spec=0.5))
    return plate


def make_mug():
    # Low-res cylinder → Solidify → Subsurf (tutorial workflow)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=14, radius=0.038, depth=0.085, location=(0.14, -0.02, 0.046)
    )
    mug = bpy.context.active_object
    mug.name = "Mug"
    # Delete top face, taper body
    bm = bmesh.new()
    bm.from_mesh(mug.data)
    bm.faces.ensure_lookup_table()
    top = max(bm.faces, key=lambda f: f.calc_center_median().z)
    bmesh.ops.delete(bm, geom=[top], context="FACES")
    # Taper: scale top ring in, bulge mid
    zs = [v.co.z for v in bm.verts]
    zmin, zmax = min(zs), max(zs)
    for v in bm.verts:
        t = (v.co.z - zmin) / max(1e-6, zmax - zmin)
        # Mid bulge (~0.35), top taper
        bulge = 1.0 + 0.12 * math.sin(t * math.pi)
        top_taper = 1.0 - 0.08 * (t ** 1.5)
        s = bulge * top_taper
        # Relative to mug center XY
        c = Vector((0.14, -0.02, v.co.z))
        # verts are in object space; cylinder at origin before location... actually
        # location is on object, mesh is local around 0
        xy = Vector((v.co.x, v.co.y))
        v.co.x = xy.x * s
        v.co.y = xy.y * s
    # Bottom lip: inset bottom face and extrude slightly
    bottom = min(bm.faces, key=lambda f: f.calc_center_median().z)
    ret = bmesh.ops.inset_individual(bm, faces=[bottom], thickness=0.006, depth=0.0)
    bm.to_mesh(mug.data)
    bm.free()

    sol = mug.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 0.0045
    sol.offset = 0.0
    add_subsurf(mug, 2, 3)

    # Apply solidify so we can build a real handle
    apply_mods(mug)
    add_subsurf(mug, 1, 2)

    # Handle: extruded tube then bridged — approximated as a torus segment / curve pipe
    handle = _make_handle(mug)
    # Join handle into mug
    active(mug)
    handle.select_set(True)
    bpy.ops.object.join()
    mug = bpy.context.active_object
    mug.name = "Mug"
    # Recalculate
    active(mug)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    shade_smooth(mug)
    mug.data.materials.clear()
    mug.data.materials.append(mat("Ceramic", (0.12, 0.12, 0.13), rough=0.25, spec=0.6))

    # Coffee liquid
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32, radius=0.032, depth=0.004, location=(0.14, -0.02, 0.078)
    )
    coffee = bpy.context.active_object
    coffee.name = "Coffee"
    shade_smooth(coffee)
    coffee.data.materials.append(mat("Coffee", (0.12, 0.06, 0.03), rough=0.15, spec=0.7))
    coffee.parent = mug
    return mug


def _make_handle(mug):
    """Bezier-ish handle as a tapered torus arc converted to mesh."""
    # Build a tube along a C-shaped path on +X of mug (local)
    curve = bpy.data.curves.new("HandlePath", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 12
    curve.bevel_depth = 0.0055
    curve.bevel_resolution = 4
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(3)  # 4 points total
    # Local mug coords: handle on +X side
    pts = [
        (0.038, 0.0, 0.022),
        (0.062, 0.0, 0.028),
        (0.062, 0.0, -0.018),
        (0.038, 0.0, -0.022),
    ]
    for bp, (x, y, z) in zip(spline.bezier_points, pts):
        bp.co = Vector((x, y, z))
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new("Handle", curve)
    bpy.context.collection.objects.link(obj)
    obj.location = mug.location
    # Convert to mesh
    active(obj)
    bpy.ops.object.convert(target="MESH")
    handle = bpy.context.active_object
    handle.name = "Handle"
    shade_smooth(handle)
    return handle


def make_sprinkle_prototypes():
    coll = bpy.data.collections.new("Sprinkles")
    bpy.context.scene.collection.children.link(coll)
    colors = [
        ("Sprinkle_Pink", (0.95, 0.35, 0.55)),
        ("Sprinkle_Blue", (0.25, 0.45, 0.95)),
        ("Sprinkle_Yellow", (0.95, 0.85, 0.20)),
        ("Sprinkle_White", (0.95, 0.95, 0.95)),
        ("Sprinkle_Green", (0.25, 0.75, 0.35)),
        ("Sprinkle_Orange", (0.95, 0.45, 0.15)),
    ]
    protos = []
    for i, (name, rgb) in enumerate(colors):
        # Long sprinkle
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=8, radius=0.0011, depth=0.007, location=(0, 0, -2 - i * 0.02)
        )
        long = bpy.context.active_object
        long.name = name + "_Long"
        shade_smooth(long)
        long.data.materials.append(mat(name + "L", rgb, rough=0.35, spec=0.45))
        # Round sprinkle
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=10, ring_count=6, radius=0.0016, location=(0.01, 0, -2 - i * 0.02)
        )
        round_s = bpy.context.active_object
        round_s.name = name + "_Round"
        shade_smooth(round_s)
        round_s.data.materials.append(mat(name + "R", rgb, rough=0.35, spec=0.45))
        for o in (long, round_s):
            coll.objects.link(o)
            bpy.context.collection.objects.unlink(o)
            o.hide_render = True
            o.hide_viewport = True
            protos.append(o)
    return protos, coll


def scatter_sprinkles(icing, protos, count=220):
    """Scatter sprinkle instances on upward-facing icing faces (tutorial GN scatter)."""
    rng = random.Random(7)
    # Need evaluated mesh with modifiers for good surface
    deps = bpy.context.evaluated_depsgraph_get()
    eval_obj = icing.evaluated_get(deps)
    mesh = eval_obj.to_mesh()
    mesh.transform(icing.matrix_world)

    faces = []
    for poly in mesh.polygons:
        n = icing.matrix_world.to_3x3() @ poly.normal
        n.normalize()
        if n.z < 0.35:
            continue
        # Prefer outer top
        c = poly.center
        faces.append((c, n, poly.area))
    if not faces:
        eval_obj.to_mesh_clear()
        log("no sprinkle faces")
        return []

    # Weighted pick by area
    areas = [f[2] for f in faces]
    total = sum(areas)
    picks = []
    for _ in range(count):
        r = rng.random() * total
        acc = 0.0
        chosen = faces[0]
        for f, a in zip(faces, areas):
            acc += a
            if acc >= r:
                chosen = f
                break
        picks.append(chosen)

    sprinkles = []
    coll = bpy.data.collections.get("SprinkleInstances") or bpy.data.collections.new(
        "SprinkleInstances"
    )
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)

    for i, (center, normal, _area) in enumerate(picks):
        proto = protos[rng.randrange(len(protos))]
        inst = proto.copy()
        inst.data = proto.data  # share mesh
        inst.name = f"Sprinkle_{i:03d}"
        inst.hide_render = False
        inst.hide_viewport = False
        # Orientation: sprinkle length along a random tangent, sitting on surface
        z = normal.normalized()
        # Random spin around normal
        angle = rng.uniform(0, math.tau)
        # Build basis
        arbitrary = Vector((0, 0, 1)) if abs(z.z) < 0.9 else Vector((1, 0, 0))
        x = z.cross(arbitrary).normalized()
        y = z.cross(x).normalized()
        # Rotate x/y around z
        ca, sa = math.cos(angle), math.sin(angle)
        x2 = x * ca + y * sa
        y2 = -x * sa + y * ca
        # Long sprinkles: align cylinder Z to x2 (lying on surface)
        # Cylinder default is along local Z — lay it flat
        mat3 = Matrix((x2, y2, z)).transposed()
        # Tip slightly out of surface
        loc = center + z * 0.0018
        inst.matrix_world = Matrix.Translation(loc) @ mat3.to_4x4()
        # Slight random scale
        s = rng.uniform(0.85, 1.25)
        inst.scale = (s, s, s * rng.uniform(0.8, 1.2))
        coll.objects.link(inst)
        sprinkles.append(inst)

    eval_obj.to_mesh_clear()
    log(f"scattered {len(sprinkles)} sprinkles")
    return sprinkles


def make_table():
    bpy.ops.mesh.primitive_plane_add(size=0.8, location=(0, 0, 0))
    table = bpy.context.active_object
    table.name = "Table"
    m = mat("Table", (0.18, 0.17, 0.16), rough=0.85, spec=0.15)
    # Subtle noise roughness via procedural
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 12.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.12, 0.11, 0.10, 1.0)
    ramp.color_ramp.elements[1].color = (0.22, 0.20, 0.18, 1.0)
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    table.data.materials.append(m)
    return table


def setup_camera_lights():
    # Camera — three-quarter beauty shot like tutorial finale
    bpy.ops.object.camera_add(location=(0.22, -0.28, 0.16))
    cam = bpy.context.active_object
    cam.name = "Camera"
    cam.data.lens = 50
    cam.data.clip_start = 0.01
    # Aim at donut
    direction = Vector((0, 0, 0.04)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    # Key area light
    bpy.ops.object.light_add(type="AREA", location=(0.25, -0.15, 0.35))
    key = bpy.context.active_object
    key.name = "Key"
    key.data.energy = 40
    key.data.size = 0.25
    key.rotation_euler = (math.radians(-50), math.radians(20), math.radians(30))

    # Fill
    bpy.ops.object.light_add(type="AREA", location=(-0.2, -0.25, 0.2))
    fill = bpy.context.active_object
    fill.name = "Fill"
    fill.data.energy = 12
    fill.data.size = 0.35

    # Rim
    bpy.ops.object.light_add(type="AREA", location=(0.05, 0.3, 0.22))
    rim = bpy.context.active_object
    rim.name = "Rim"
    rim.data.energy = 18
    rim.data.size = 0.2

    return cam


def render(path: Path, samples=64):
    path.parent.mkdir(parents=True, exist_ok=True)
    sc = bpy.context.scene
    sc.render.filepath = str(path)
    sc.render.image_settings.file_format = "PNG"
    # Eevee samples
    if hasattr(sc.eevee, "taa_render_samples"):
        sc.eevee.taa_render_samples = samples
    bpy.ops.render.render(write_still=True)
    log(f"render → {path}")


def export_glb(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    keep = {"Donut", "Icing", "Plate", "Mug", "Coffee", "Table"}
    for obj in bpy.context.scene.objects:
        if obj.name in keep or obj.name.startswith("Sprinkle_"):
            if obj.type == "MESH" and not obj.hide_render:
                obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
    )
    log(f"glb → {path}")


def extra_views():
    """Orbit a few cameras for gallery."""
    shots = [
        ("hero", (0.22, -0.28, 0.16), (0, 0, 0.04)),
        ("top", (0.0, 0.0, 0.35), (0, 0, 0.04)),
        ("side", (0.35, 0.0, 0.10), (0.05, 0, 0.04)),
        ("mug", (0.28, -0.12, 0.12), (0.12, -0.02, 0.05)),
    ]
    for name, loc, target in shots:
        cam = bpy.context.scene.camera
        cam.location = loc
        direction = Vector(target) - Vector(loc)
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        render(ART / f"donut_{name}.png", samples=48)
        render(STUDY / f"renders/donut_{name}.png", samples=48)


def main():
    global MON
    MON = Monitor.from_env(job="follow_blender_guru_donut", preview_samples=4)
    stages = 8
    try:
        log("building Blender Guru donut scene")
        clear()
        setup_scene()
        ART.mkdir(parents=True, exist_ok=True)
        (STUDY / "renders").mkdir(parents=True, exist_ok=True)

        MON.stage("table_plate", index=1, total=stages, preview=False)
        table = make_table()
        plate = make_plate()

        MON.stage("donut", index=2, total=stages, preview=False)
        donut = make_donut()

        MON.stage("icing", index=3, total=stages, preview=False)
        icing = make_icing(donut)

        MON.stage("mug", index=4, total=stages, preview=False)
        mug = make_mug()

        # Camera early so previews work from here on
        MON.stage("camera_lights", index=5, total=stages, preview=False)
        setup_camera_lights()
        MON.preview(message="base meshes + camera", force=True)

        MON.stage("sprinkles", index=6, total=stages, preview=False)
        protos, _ = make_sprinkle_prototypes()
        scatter_sprinkles(icing, protos, count=240)
        MON.preview(message="sprinkles scattered", force=True)

        MON.stage("export", index=7, total=stages, preview=False)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
        export_glb(OUT_GLB)
        export_glb(ART / "donut.glb")
        MON.preview(message="exported blend/glb", force=True)

        MON.stage("beauty_renders", index=8, total=stages, preview=False)
        MON.set_progress(0.0, message="rendering views")
        extra_views()
        MON.set_progress(1.0)
        MON.preview(message="final hero", force=True)

        bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
        MON.done("donut complete")
    except Exception as e:
        if MON is not None:
            MON.fail(str(e))
        raise


if __name__ == "__main__":
    main()
