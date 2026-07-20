#!/usr/bin/env python3
"""Antlered chibi Rimwalker elf in Blender (T-pose), matching the purple/leaf reference.

Uses bpy primitives only (no fragile bmesh transforms). Face toward -Y.

  blender -b -noaudio --python tools/rig/build_antler_elf.py -- \
    --name antler_elf --out exports/blender-rig-test
"""
import bpy, mathutils, math, sys, os, json
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a: a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

OUT = argval('--out', os.path.join(os.path.dirname(__file__), '..', '..', 'exports', 'blender-rig-test'))
NAME = argval('--name', 'antler_elf')
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.materials):
    for d in list(blk): blk.remove(d)

def mat(name, rgb, rough=0.55, metal=0.0, emit=None, estr=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    try: b.inputs['Metallic'].default_value = metal
    except: pass
    if emit is not None:
        try: b.inputs['Emission Color'].default_value = (*emit, 1)
        except: b.inputs['Emission'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = estr
    return m

M_skin   = mat('elf_skin',   (0.64, 0.44, 0.80), 0.60)
M_skinD  = mat('elf_skinD',  (0.40, 0.26, 0.56), 0.70)
M_hair   = mat('elf_hair',   (0.95, 0.94, 0.97), 0.78)
M_antler = mat('elf_antler', (0.58, 0.40, 0.24), 0.82)
M_armor  = mat('elf_armor',  (0.25, 0.62, 0.32), 0.40, metal=0.18)
M_armorD = mat('elf_armorD', (0.14, 0.40, 0.22), 0.48, metal=0.12)
M_gold   = mat('elf_gold',   (0.92, 0.74, 0.24), 0.26, metal=0.88)
M_leather= mat('elf_leather',(0.40, 0.24, 0.13), 0.85)
M_cloth  = mat('elf_cloth',  (0.45, 0.24, 0.58), 0.74)
M_eye    = mat('elf_eye',    (0.50, 0.98, 0.32), 0.22, emit=(0.35, 1.0, 0.22), estr=2.2)
M_gem    = mat('elf_gem',    (0.60, 0.28, 0.80), 0.18, metal=0.25, emit=(0.75, 0.30, 1.0), estr=1.2)
M_ink    = mat('elf_ink',    (0.07, 0.03, 0.09), 0.9)

parts = []

def clear_sel():
    for o in bpy.context.selected_objects: o.select_set(False)

def activate(ob):
    clear_sel(); ob.select_set(True); bpy.context.view_layer.objects.active = ob

def apply_TRS(ob, loc=False, rot=False, scale=False):
    activate(ob)
    bpy.ops.object.transform_apply(location=loc, rotation=rot, scale=scale)

def finish(ob, m, name=None):
    if name: ob.name = name
    if ob.data.materials: ob.data.materials[0] = m
    else: ob.data.materials.append(m)
    for p in ob.data.polygons: p.use_smooth = True
    parts.append(ob)
    return ob

def add_uv(loc, r, seg=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    return bpy.context.active_object

def add_ico(loc, r, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    return bpy.context.active_object

def add_cyl(loc, r, depth, seg=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=loc)
    return bpy.context.active_object

def add_cone(loc, r1, r2, depth, seg=8):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2, depth=depth, location=loc)
    return bpy.context.active_object

def add_cube(loc, scale):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.scale = scale
    apply_TRS(ob, scale=True)
    return ob

def add_torus(loc, maj, minr, seg=18, mseg=8):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=seg, minor_segments=mseg,
        major_radius=maj, minor_radius=minr, location=loc)
    return bpy.context.active_object

def scale_local(ob, sx, sy, sz):
    ob.scale = (sx, sy, sz)
    apply_TRS(ob, scale=True)

def rot_euler(ob, rx, ry, rz):
    ob.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    apply_TRS(ob, rot=True)

def limb_x(x0, x1, y, z, r, material, name):
    """Horizontal limb along X (T-pose arm)."""
    mid = ((x0 + x1) * 0.5, y, z)
    depth = abs(x1 - x0)
    ob = add_cyl(mid, r, depth, seg=12)
    rot_euler(ob, 0, 90, 0)
    return finish(ob, material, name)

def limb_z(x, y, z0, z1, r, material, name):
    """Vertical limb along Z."""
    mid = (x, y, (z0 + z1) * 0.5)
    depth = abs(z1 - z0)
    ob = add_cyl(mid, r, depth, seg=12)
    return finish(ob, material, name)

def leaf_plate(loc, sx, sy, sz, material, rx=0, ry=0, rz=0, name='leaf'):
    """Flattened pointed plate from an icosphere."""
    ob = add_ico(loc, 0.5, subdiv=2)
    scale_local(ob, sx, sy, sz)
    # pinch tip (+Z) by scaling upper verts inward
    activate(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    import bmesh
    bm = bmesh.new(); bm.from_mesh(ob.data)
    zmax = max(v.co.z for v in bm.verts) or 1.0
    for v in bm.verts:
        t = max(0.0, v.co.z / zmax)
        v.co.x *= 1.0 - 0.55 * t
        v.co.y *= 1.0 - 0.45 * t
    bm.to_mesh(ob.data); bm.free()
    if rx or ry or rz:
        rot_euler(ob, rx, ry, rz)
    return finish(ob, material, name)

# ============================================================
# Proportions — chibi, total height ~2.3, face toward -Y
# ============================================================
HIP_X = 0.18
LEG_Z = 0.52
TORSO_H = 0.62
SHOULDER_Z = LEG_Z + TORSO_H          # 1.14
HEAD_R = 0.38
HEAD_Z = SHOULDER_Z + 0.42            # 1.56
FY = -1  # face direction sign on Y

# ---- legs + boots ----
for s in (-1, 1):
    limb_z(HIP_X * s, 0, 0.20, LEG_Z, 0.11, M_skin, f'leg_{s}')
    limb_z(HIP_X * s, 0.02, 0.04, 0.28, 0.13, M_armor, f'boot_{s}')
    rim = add_torus((HIP_X * s, 0.02, 0.28), 0.125, 0.02)
    # torus default lies in XY (axis +Z) — correct for a horizontal boot cuff
    finish(rim, M_gold, f'boot_rim_{s}')
    finish(add_cube((HIP_X * s, FY * 0.08, 0.05), (0.16, 0.26, 0.09)), M_armorD, f'foot_{s}')
    leaf_plate((HIP_X * s, FY * 0.18, 0.07), 0.10, 0.04, 0.12, M_gold, rx=80, name=f'toe_{s}')

# ---- hips / purple underkilt ----
hips = add_uv((0, 0, LEG_Z), 0.28, 14, 8)
scale_local(hips, 1.2, 0.85, 0.5)
finish(hips, M_cloth, 'hips')

# leaf kilt fan (front-facing)
for i, ang in enumerate([-60, -30, 0, 30, 60]):
    rad = math.radians(ang)
    x = math.sin(rad) * 0.26
    y = FY * math.cos(rad) * 0.20
    leaf_plate((x, y, LEG_Z - 0.06), 0.14, 0.045, 0.26,
               M_armor if i % 2 == 0 else M_armorD,
               rx=30, rz=ang, name=f'kilt_{i}')

belt = add_torus((0, 0, LEG_Z + 0.06), 0.29, 0.028)
finish(belt, M_gold, 'belt')
finish(add_ico((0, FY * 0.28, LEG_Z + 0.06), 0.06, 1), M_gem, 'belt_gem')

# ---- torso armor ----
torso = add_uv((0, 0, LEG_Z + TORSO_H * 0.42), 0.30, 16, 10)
scale_local(torso, 1.0, 0.78, 1.1)
finish(torso, M_armor, 'torso')

for s in (-1, 1):
    leaf_plate((0.12 * s, FY * 0.24, LEG_Z + TORSO_H * 0.5),
               0.15, 0.05, 0.22, M_armor, rx=10, rz=s * 18, name=f'breast_{s}')
    leaf_plate((0.12 * s, FY * 0.28, LEG_Z + TORSO_H * 0.38),
               0.08, 0.03, 0.10, M_gold, rx=10, rz=s * 18, name=f'breast_g_{s}')

collar = add_torus((0, 0, SHOULDER_Z - 0.08), 0.14, 0.025)
finish(collar, M_gold, 'collar')
finish(add_ico((0, FY * 0.16, SHOULDER_Z - 0.05), 0.055, 1), M_gem, 'collar_gem')

sash = add_cube((0.04, FY * 0.20, LEG_Z + TORSO_H * 0.4), (0.07, 0.02, 0.5))
rot_euler(sash, 0, 0, -35)
finish(sash, M_leather, 'sash')

limb_z(0, 0, SHOULDER_Z - 0.14, SHOULDER_Z + 0.04, 0.09, M_skin, 'neck')

# ---- pauldrons ----
for s in (-1, 1):
    pa = add_uv((0.32 * s, 0, SHOULDER_Z + 0.02), 0.16, 12, 8)
    scale_local(pa, 1.15, 0.9, 0.75)
    finish(pa, M_armor, f'pauldron_{s}')
    pr = add_torus((0.32 * s, 0, SHOULDER_Z - 0.04), 0.13, 0.02)
    finish(pr, M_gold, f'pauldron_rim_{s}')
    leaf_plate((0.42 * s, FY * 0.05, SHOULDER_Z + 0.08),
               0.10, 0.04, 0.15, M_armorD, rx=15, rz=s * 45, name=f'pauldron_leaf_{s}')

# ---- arms T-pose (continuous along ±X) ----
for s in (-1, 1):
    limb_x(0.38 * s, 0.72 * s, 0, SHOULDER_Z, 0.09, M_skin, f'upper_arm_{s}')
    limb_x(0.72 * s, 1.05 * s, 0, SHOULDER_Z, 0.08, M_skin, f'forearm_{s}')
    limb_x(0.82 * s, 1.05 * s, 0, SHOULDER_Z, 0.10, M_armor, f'bracer_{s}')
    bg = add_torus((0.85 * s, 0, SHOULDER_Z), 0.10, 0.018)
    rot_euler(bg, 0, 90, 0)
    finish(bg, M_gold, f'bracer_gold_{s}')
    hand = add_uv((1.18 * s, 0, SHOULDER_Z), 0.105, 10, 7)
    scale_local(hand, 1.1, 0.85, 0.9)
    finish(hand, M_skin, f'hand_{s}')

# ---- head ----
head = add_uv((0, 0, HEAD_Z), HEAD_R, 20, 12)
scale_local(head, 1.02, 0.96, 0.98)
finish(head, M_skin, 'head')

for s in (-1, 1):
    ch = add_uv((0.16 * s, FY * 0.22, HEAD_Z - 0.05), 0.085, 10, 6)
    scale_local(ch, 0.85, 0.35, 0.65)
    finish(ch, M_skin, f'cheek_{s}')

nose = add_uv((0, FY * 0.34, HEAD_Z - 0.02), 0.04, 8, 6)
scale_local(nose, 0.55, 0.6, 1.2)
finish(nose, M_skin, 'nose')

for s in (-1, 1):
    sock = add_uv((0.14 * s, FY * 0.28, HEAD_Z + 0.04), 0.085, 10, 6)
    scale_local(sock, 1.05, 0.28, 0.75)
    rot_euler(sock, 0, 0, -s * 18)
    finish(sock, M_skinD, f'socket_{s}')
    eye = add_uv((0.15 * s, FY * 0.38, HEAD_Z + 0.05), 0.08, 12, 8)
    scale_local(eye, 0.95, 0.38, 1.45)
    rot_euler(eye, 0, 0, -s * 22)
    finish(eye, M_eye, f'eye_{s}')
    for i in range(2):
        br = add_cone((0.08 * s + 0.05 * i * s, FY * 0.28, HEAD_Z + 0.14 + 0.02 * i),
                      0.032 - i * 0.006, 0.0, 0.12 - i * 0.02, seg=5)
        rot_euler(br, -65, 0, s * (40 + i * 12))
        finish(br, M_hair, f'brow_{s}_{i}')

lips = add_torus((0, FY * 0.28, HEAD_Z - 0.15), 0.045, 0.014)
rot_euler(lips, 70, 0, 0)
scale_local(lips, 1.2, 1.0, 0.55)
finish(lips, M_skinD, 'lips')
mouth = add_uv((0, FY * 0.26, HEAD_Z - 0.15), 0.028, 8, 5)
scale_local(mouth, 1.3, 0.35, 0.85)
finish(mouth, M_ink, 'mouth')

# pointed ears
for s in (-1, 1):
    ear = add_cone((HEAD_R * 0.9 * s, FY * 0.05, HEAD_Z + 0.02), 0.075, 0.0, 0.38, seg=7)
    rot_euler(ear, 20, 0, -s * 50)
    finish(ear, M_skin, f'ear_{s}')
    inn = add_cone((HEAD_R * 0.95 * s, FY * 0.08, HEAD_Z + 0.02), 0.04, 0.0, 0.26, seg=6)
    rot_euler(inn, 20, 0, -s * 50)
    finish(inn, M_skinD, f'ear_inner_{s}')

# ---- hair: high rope-braid bun (behind = +Y) ----
hb = add_uv((0, 0.20, HEAD_Z + 0.02), 0.34, 14, 10)
scale_local(hb, 1.05, 0.7, 0.92)
finish(hb, M_hair, 'hair_back')

for i, (dz, r) in enumerate([(0.32, 0.24), (0.48, 0.18), (0.58, 0.12)]):
    b = add_uv((0, 0.16, HEAD_Z + dz), r, 12, 8)
    scale_local(b, 1.05, 0.95, 0.9)
    finish(b, M_hair, f'bun_{i}')

# braid ropes around bun
for i, ang in enumerate(range(0, 360, 36)):
    rad = math.radians(ang)
    bx = math.cos(rad) * 0.18
    by = 0.16 + math.sin(rad) * 0.14
    strand = add_cyl((bx, by, HEAD_Z + 0.42), 0.035, 0.18, seg=8)
    rot_euler(strand, 12 * math.sin(rad), 12 * math.cos(rad), ang)
    finish(strand, M_hair, f'braid_{i}')

for s in (-1, 1):
    lock = add_cyl((HEAD_R * 0.72 * s, FY * 0.12, HEAD_Z - 0.05), 0.05, 0.38, seg=8)
    rot_euler(lock, 20, 0, s * 8)
    finish(lock, M_hair, f'side_lock_{s}')

peak = add_uv((0, FY * 0.05, HEAD_Z + 0.24), 0.18, 12, 6)
scale_local(peak, 1.15, 0.4, 0.4)
finish(peak, M_hair, 'hair_peak')

circ = add_torus((0, 0, HEAD_Z + 0.16), 0.34, 0.022, seg=22)
finish(circ, M_gold, 'circlet')
cg = add_ico((0, FY * 0.34, HEAD_Z + 0.18), 0.06, 1)
scale_local(cg, 0.65, 0.4, 1.3)
finish(cg, M_gem, 'circlet_gem')

# ---- antlers (thicker deer branching) ----
for s in (-1, 1):
    main = add_cyl((HEAD_R * 0.42 * s, 0.08, HEAD_Z + 0.45), 0.055, 0.42, seg=8)
    rot_euler(main, -28, 0, s * 28)
    finish(main, M_antler, f'antler_main_{s}')
    tip = add_cyl((HEAD_R * 0.62 * s, 0.10, HEAD_Z + 0.68), 0.035, 0.24, seg=7)
    rot_euler(tip, -42, 0, s * 38)
    finish(tip, M_antler, f'antler_tip_{s}')
    tine = add_cyl((HEAD_R * 0.50 * s, FY * 0.08, HEAD_Z + 0.55), 0.03, 0.20, seg=6)
    rot_euler(tine, 58, 0, s * 12)
    finish(tine, M_antler, f'antler_tine_{s}')
    tine2 = add_cyl((HEAD_R * 0.45 * s, 0.22, HEAD_Z + 0.58), 0.026, 0.16, seg=6)
    rot_euler(tine2, -55, 0, s * 18)
    finish(tine2, M_antler, f'antler_tine2_{s}')
    # base knuckle
    finish(add_uv((HEAD_R * 0.38 * s, 0.06, HEAD_Z + 0.30), 0.06, 8, 6), M_antler, f'antler_base_{s}')

# ---- join ----
clear_sel()
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = NAME

bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
mn = min((body.matrix_world @ V(c)).z for c in body.bound_box)
body.location.z -= mn
cx = sum((body.matrix_world @ V(c)).x for c in body.bound_box) / 8.0
body.location.x -= cx
bpy.context.view_layer.update()

glb = os.path.join(OUT, NAME + '.glb')
blend = os.path.join(OUT, NAME + '.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_apply=True)

coords = [body.matrix_world @ V(c) for c in body.bound_box]
xs = [c.x for c in coords]; ys = [c.y for c in coords]; zs = [c.z for c in coords]
report = {
    'name': NAME, 'glb': glb, 'blend': blend, 'bytes': os.path.getsize(glb),
    'bbox': {'min': [min(xs), min(ys), min(zs)], 'max': [max(xs), max(ys), max(zs)],
             'height': max(zs) - min(zs)},
    'materials': sorted(m.name for m in bpy.data.materials),
    'tris': sum(len(p.vertices) - 2 for p in body.data.polygons),
    'parts': len(parts),
}
print('ANTLER_ELF_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, NAME + '_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
