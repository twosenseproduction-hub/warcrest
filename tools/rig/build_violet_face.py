#!/usr/bin/env python3
"""Owned dense FACE BUST match vs Drive REF crop — no external AI.

Targets violet_face_REF_crop.png (head + shoulders):
  deep purple skin, circular lime eyes + dark liner, twin wavy forehead tattoos,
  tribal cheek marks, chunky purple+gold hair swept to character right (−X),
  long horizontal ears, purple cowl, green/gold pauldrons + red gems.

  blender -b -noaudio --python tools/rig/build_violet_face.py -- \
    --out exports/blender-rig-test --name violet_face --iter 71
"""
import bpy, math, mathutils, sys, os, json
from pathlib import Path
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a: a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

OUT = argval('--out', 'exports/blender-rig-test')
NAME = argval('--name', 'violet_face')
ITER = argval('--iter', '73')
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
    for d in list(blk): blk.remove(d)

def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))

def mat(name, hexcol, rough=0.55, metal=0.0, emit=None, estr=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*hx(hexcol), 1)
    b.inputs['Roughness'].default_value = rough
    try: b.inputs['Metallic'].default_value = metal
    except: pass
    if emit is not None:
        try: b.inputs['Emission Color'].default_value = (*hx(emit), 1)
        except: b.inputs['Emission'].default_value = (*hx(emit), 1)
        b.inputs['Emission Strength'].default_value = estr
    return m

# Palette from REF sampling + vision
M_skin  = mat('f_skin',  '#5a3d6e', 0.66)
M_skinD = mat('f_skinD', '#2a1a38', 0.80)
M_tat   = mat('f_tat',   '#3a8a78', 0.28, emit='#4ec4a0', estr=1.1)
M_eye   = mat('f_eye',   '#78c04a', 0.10, emit='#90e050', estr=2.4)
M_lip   = mat('f_lip',   '#1a1220', 0.88)
M_hair  = mat('f_hair',  '#2a1838', 0.76)
M_hairG = mat('f_hairG', '#bd955a', 0.40, metal=0.22)
M_brow  = mat('f_brow',  '#140c1c', 0.9)
M_cowl  = mat('f_cowl',  '#1f1e30', 0.72)
M_armor = mat('f_armor', '#2c4031', 0.42, metal=0.20)
M_gold  = mat('f_gold',  '#d4a84a', 0.24, metal=0.92)
M_gem   = mat('f_gem',   '#d02838', 0.18, metal=0.1, emit='#ff3040', estr=0.6)

parts = []

def clear_sel():
    for o in bpy.context.selected_objects: o.select_set(False)

def activate(ob):
    clear_sel(); ob.select_set(True); bpy.context.view_layer.objects.active = ob

def apply_TRS(ob, loc=False, rot=False, scale=False):
    activate(ob); bpy.ops.object.transform_apply(location=loc, rotation=rot, scale=scale)

def finish(ob, m, name):
    ob.name = name
    if ob.data.materials: ob.data.materials[0] = m
    else: ob.data.materials.append(m)
    for p in ob.data.polygons: p.use_smooth = True
    parts.append(ob)
    return ob

def add_cube(loc, scale):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object; ob.scale = scale; apply_TRS(ob, scale=True)
    return ob

def add_uv(loc, r, seg=32, rings=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    return bpy.context.active_object

def add_cone(loc, r1, r2, depth, seg=12):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2, depth=depth, location=loc)
    return bpy.context.active_object

def scale_local(ob, sx, sy, sz):
    ob.scale = (sx, sy, sz); apply_TRS(ob, scale=True)

def rot_euler(ob, rx, ry, rz):
    ob.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    apply_TRS(ob, rot=True)

def bevel(ob, width=0.015, segments=3):
    activate(ob)
    mod = ob.modifiers.new('Bevel', 'BEVEL')
    mod.width = width; mod.segments = segments
    mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(28)
    bpy.ops.object.modifier_apply(modifier='Bevel')
    return ob

def subdiv(ob, levels=2):
    activate(ob)
    m = ob.modifiers.new('CC', 'SUBSURF')
    m.subdivision_type = 'CATMULL_CLARK'; m.levels = levels
    bpy.ops.object.modifier_apply(modifier='CC')
    return ob

FACE_Y = -0.90
HZ = 0.15  # raise head so pauldrons sit below in bust frame

# ---- HEAD (squared chibi, single cage + pads) ----
head = add_cube((0, 0.05, HZ), (0.88, 0.76, 0.95))
bevel(head, 0.22, 5)
subdiv(head, 3)
finish(head, M_skin, 'head')

jaw = add_cube((0, -0.02, HZ - 0.48), (0.68, 0.50, 0.36))
bevel(jaw, 0.14, 4)
subdiv(jaw, 2)
finish(jaw, M_skin, 'jaw')

for s in (-1, 1):
    ck = add_uv((0.46 * s, -0.28, HZ - 0.08), 0.24, 24, 14)
    scale_local(ck, 0.78, 0.48, 0.88)
    finish(ck, M_skin, f'cheek_{s}')

chin = add_uv((0, FACE_Y + 0.38, HZ - 0.72), 0.16, 20, 12)
scale_local(chin, 1.05, 0.55, 0.70)
finish(chin, M_skin, 'chin')

# ---- EARS — elongated tapers along ±X ----
for s in (-1, 1):
    ear = add_uv((0.95 * s, -0.05, HZ + 0.02), 0.28, 20, 12)
    scale_local(ear, 2.4, 0.35, 0.55)
    rot_euler(ear, 0, 0, s * 8)
    finish(ear, M_skin, f'ear_{s}')
    tip = add_cone((1.55 * s, -0.02, HZ + 0.04), 0.08, 0.0, 0.45, seg=10)
    scale_local(tip, 0.5, 0.35, 1.0)
    rot_euler(tip, 0, -90 * s, 0)
    finish(tip, M_skin, f'ear_tip_{s}')

# ---- EYES: dark socket + liner + circular lime ----
for s in (-1, 1):
    sock = add_uv((0.26 * s, FACE_Y + 0.08, HZ + 0.10), 0.22, 24, 14)
    scale_local(sock, 1.05, 0.42, 0.95)
    finish(sock, M_skinD, f'socket_{s}')
    liner = add_uv((0.26 * s, FACE_Y - 0.01, HZ + 0.10), 0.185, 28, 12)
    scale_local(liner, 1.0, 0.12, 1.0)
    finish(liner, M_brow, f'liner_{s}')
    eye = add_uv((0.26 * s, FACE_Y - 0.04, HZ + 0.10), 0.155, 32, 18)
    scale_local(eye, 1.0, 0.16, 1.0)
    finish(eye, M_eye, f'eye_{s}')
    # stern brow
    brow = add_cube((0.22 * s, FACE_Y - 0.02, HZ + 0.30), (0.16, 0.032, 0.028))
    bevel(brow, 0.008, 2)
    rot_euler(brow, 0, 0, -s * 32)
    finish(brow, M_brow, f'brow_{s}')
    lid = add_cube((0.26 * s, FACE_Y - 0.015, HZ + 0.22), (0.17, 0.04, 0.045))
    bevel(lid, 0.012, 2)
    rot_euler(lid, 5, 0, -s * 8)
    finish(lid, M_skinD, f'lid_{s}')

nose = add_uv((0, FACE_Y - 0.03, HZ - 0.02), 0.07, 14, 10)
scale_local(nose, 0.65, 1.0, 1.15)
finish(nose, M_skin, 'nose')

lip = add_cube((0, FACE_Y - 0.015, HZ - 0.38), (0.11, 0.032, 0.028))
bevel(lip, 0.01, 2)
finish(lip, M_lip, 'lips')

# ---- TATTOOS (curve ribbons) ----
def curve_ribbon(name, pts, depth=0.012):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = depth
    cu.bevel_resolution = 3
    cu.resolution_u = 10
    sp = cu.splines.new('NURBS')
    sp.points.add(len(pts) - 1)
    for i, (x, y, z) in enumerate(pts):
        sp.points[i].co = (x, y, z, 1.0)
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(pts))
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    activate(ob)
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.active_object, M_tat, name)

# twin wavy forehead — on SKIN below hairline
for sx, nm in [(-0.055, 'tat_fore_L'), (0.055, 'tat_fore_R')]:
    pts = []
    for i in range(11):
        t = i / 10.0
        pts.append((sx + 0.022 * math.sin(t * math.pi * 2.2), FACE_Y - 0.012, HZ + 0.28 + 0.22 * t))
    curve_ribbon(nm, pts, 0.011)

# tribal cheeks under eyes
for s in (-1, 1):
    pts = []
    for i in range(9):
        t = i / 8.0
        pts.append((s * (0.20 + 0.26 * t), FACE_Y - 0.012, HZ + 0.00 - 0.10 * math.sin(t * math.pi) - 0.02 * t))
    curve_ribbon(f'tat_ck_{s}', pts, 0.012)

# ---- HAIR: chunky CARD clumps (flattened plates), not cone rollers ----
cap = add_uv((-0.10, 0.50, HZ + 0.95), 0.55, 28, 16)
scale_local(cap, 1.20, 0.90, 0.55)
finish(cap, M_hair, 'hair_cap')

def hair_card(loc, sx, sy, sz, rx, ry, rz, m, name):
    ob = add_cube(loc, (sx, sy, sz))
    bevel(ob, min(sx, sy, sz) * 0.35, 3)
    subdiv(ob, 1)
    rot_euler(ob, rx, ry, rz)
    return finish(ob, m, name)

cards = [
    ((-0.08, -0.55, HZ + 1.25), 0.22, 0.10, 0.55, -55, 0, -8, True),
    ((-0.28, -0.48, HZ + 1.15), 0.20, 0.09, 0.50, -48, 5, -28, True),
    ((-0.42, -0.35, HZ + 1.00), 0.18, 0.08, 0.45, -38, 8, -42, True),
    ((-0.18, -0.60, HZ + 1.05), 0.18, 0.09, 0.48, -62, 0, -12, True),
    ((0.12, -0.50, HZ + 1.10), 0.20, 0.09, 0.48, -50, -5, 18, False),
    ((0.30, -0.38, HZ + 0.95), 0.18, 0.08, 0.42, -40, -8, 35, False),
    ((0.45, -0.22, HZ + 0.80), 0.16, 0.07, 0.38, -28, -5, 50, False),
    ((-0.05, -0.30, HZ + 1.40), 0.22, 0.10, 0.42, -70, 0, 0, True),
    ((0.15, -0.22, HZ + 1.35), 0.18, 0.09, 0.38, -65, 0, 12, False),
    ((-0.25, -0.15, HZ + 1.30), 0.18, 0.08, 0.40, -55, 5, -18, False),
    ((-0.50, -0.15, HZ + 0.70), 0.14, 0.07, 0.36, -20, 10, -58, False),
    ((0.50, -0.12, HZ + 0.68), 0.14, 0.07, 0.34, -18, -10, 58, False),
    ((-0.35, -0.55, HZ + 0.85), 0.16, 0.08, 0.42, -45, 0, -25, True),
    ((0.05, -0.65, HZ + 0.95), 0.16, 0.08, 0.40, -68, 0, 5, True),
    ((-0.15, 0.20, HZ + 1.25), 0.20, 0.10, 0.36, -35, 0, -10, False),
    ((0.20, 0.18, HZ + 1.18), 0.18, 0.09, 0.34, -32, 0, 20, False),
    ((-0.40, -0.45, HZ + 1.15), 0.15, 0.08, 0.48, -52, 5, -32, True),
    ((0.0, -0.40, HZ + 1.48), 0.18, 0.09, 0.38, -78, 0, 2, True),
    ((-0.22, -0.70, HZ + 0.75), 0.14, 0.07, 0.36, -55, 0, -15, True),
    ((0.25, -0.55, HZ + 0.85), 0.14, 0.07, 0.34, -50, 0, 22, False),
    ((-0.55, -0.30, HZ + 0.95), 0.13, 0.06, 0.40, -35, 8, -45, True),
    ((0.38, -0.48, HZ + 1.05), 0.14, 0.07, 0.38, -45, -5, 30, False),
]
for i, (loc, sx, sy, sz, rx, ry, rz, gold) in enumerate(cards):
    hair_card(loc, sx, sy, sz, rx, ry, rz, M_hairG if gold else M_hair, f'card_{i}')

for s in (-1, 1):
    lock = add_uv((0.90 * s, -0.25, HZ - 0.35), 0.11, 14, 8)
    scale_local(lock, 0.70, 0.60, 1.55)
    finish(lock, M_hairG if s < 0 else M_hair, f'lock_{s}')

# ---- COWL ----
cowl = add_uv((0, 0.05, HZ - 0.95), 0.45, 28, 16)
scale_local(cowl, 1.40, 1.10, 0.55)
finish(cowl, M_cowl, 'cowl')
cowl2 = add_cube((0, 0.08, HZ - 1.18), (0.65, 0.35, 0.22))
bevel(cowl2, 0.08, 3)
subdiv(cowl2, 1)
finish(cowl2, M_cowl, 'cowl_drape')

# bigger pauldrons matching REF crop shoulders
for s in (-1, 1):
    p1 = add_cube((0.85 * s, 0.10, HZ - 1.45), (0.48, 0.36, 0.28))
    bevel(p1, 0.08, 3)
    subdiv(p1, 1)
    rot_euler(p1, 12, 0, s * 18)
    finish(p1, M_armor, f'pauldron_{s}')
    p2 = add_cube((0.95 * s, 0.05, HZ - 1.55), (0.32, 0.28, 0.18))
    bevel(p2, 0.05, 2)
    finish(p2, M_armor, f'pauldron2_{s}')
    rim = add_cube((0.85 * s, -0.08, HZ - 1.28), (0.50, 0.07, 0.07))
    bevel(rim, 0.02, 2)
    finish(rim, M_gold, f'pauldron_rim_{s}')
    for j, (ox, oz) in enumerate([(0.0, 0.02), (0.14, -0.05), (-0.12, -0.08), (0.08, -0.12)]):
        fil = add_cube((0.85 * s + ox * s, -0.15, HZ - 1.40 + oz), (0.12, 0.018, 0.022))
        bevel(fil, 0.005, 2)
        rot_euler(fil, 0, 0, s * (15 + j * 18))
        finish(fil, M_gold, f'filigree_{s}_{j}')
    gem = add_uv((0.85 * s, -0.18, HZ - 1.22), 0.06, 12, 8)
    finish(gem, M_gem, f'gem_{s}')

# JOIN
clear_sel()
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = NAME
bpy.context.view_layer.update()

glb = os.path.join(OUT, f'{NAME}.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_apply=True)

# ---- RENDER ----
eye_target = V((0.0, FACE_Y, HZ + 0.05))

bpy.ops.object.light_add(type='SUN', location=(2.5, -2.5, 3.5))
sun = bpy.context.active_object
sun.data.energy = 2.5
sun.rotation_euler = (math.radians(48), math.radians(10), math.radians(15))
bpy.ops.object.light_add(type='AREA', location=(-2.2, -2.8, 1.5))
fill = bpy.context.active_object
fill.data.energy = 65; fill.data.size = 3.0

scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 56
    scene.eevee.use_bloom = True
    scene.eevee.bloom_threshold = 1.25
    scene.eevee.bloom_intensity = 0.20
except Exception:
    scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.image_settings.file_format = 'PNG'
world = bpy.data.worlds.new('W'); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.68, 0.68, 0.70, 1)
bg.inputs['Strength'].default_value = 0.70

bpy.ops.object.camera_add()
cam = bpy.context.active_object
scene.camera = cam
frames = os.path.join(OUT, 'progress', 'violet_face')
os.makedirs(frames, exist_ok=True)
rendered = []

def aim(loc):
    cam.location = loc
    direction = eye_target - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# bust framing like REF crop
cam.data.lens = 60
aim(V((0.0, -4.8, HZ - 0.15)))
path = os.path.join(frames, f'{ITER}_face_front.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

cam.data.lens = 55
aim(V((2.1, -4.2, HZ - 0.05)))
path = os.path.join(frames, f'{ITER}_face_threeq.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

cam.data.lens = 70
aim(V((0.0, -3.0, HZ + 0.08)))
path = os.path.join(frames, f'{ITER}_face_close.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

try:
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'SINGLE'
    scene.display.shading.single_color = (0.70, 0.70, 0.72)
    aim(V((0.0, -4.8, HZ - 0.15)))
    path = os.path.join(frames, f'{ITER}_face_clay.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    rendered.append(path); print('RENDERED', path)
except Exception as e:
    print('CLAY_FAIL', e)

# side-by-side vs REF crop
try:
    from PIL import Image
    ref_path = Path(OUT) / 'refs' / 'violet_face_REF_crop.png'
    if ref_path.exists():
        ref = Image.open(ref_path).convert('RGB')
        ours = Image.open(rendered[0]).convert('RGB')
        h = 420
        ref = ref.resize((int(ref.width * h / ref.height), h), Image.LANCZOS)
        ours = ours.resize((h, h), Image.LANCZOS)
        canvas = Image.new('RGB', (ref.width + ours.width + 12, h), (48, 48, 52))
        canvas.paste(ref, (0, 0)); canvas.paste(ours, (ref.width + 12, 0))
        vs = Path(frames) / f'{ITER}_face_vs_ref.png'
        canvas.save(vs)
        rendered.append(str(vs)); print('RENDERED', vs)
except Exception as e:
    print('COMPOSITE_FAIL', e)

report = {
    'name': NAME, 'iter': ITER, 'glb': glb,
    'bytes': os.path.getsize(glb),
    'rendered': rendered,
    'pipeline': 'owned_bust_vs_drive_ref',
    'ref': 'exports/blender-rig-test/refs/violet_face_REF_crop.png',
}
print('FACE_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, f'{NAME}_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
