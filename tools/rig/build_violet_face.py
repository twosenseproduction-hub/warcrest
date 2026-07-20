#!/usr/bin/env python3
"""Isolated FACE match for violet cape warrior figurine reference.

Only head / face / ears / hair bangs — camera framed on face.
Iterate until eyes, tattoos, lips, ears match the ref.

  blender -b -noaudio --python tools/rig/build_violet_face.py -- \
    --out exports/blender-rig-test --name violet_face --iter 43
"""
import bpy, math, mathutils, sys, os, json
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a: a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

OUT = argval('--out', 'exports/blender-rig-test')
NAME = argval('--name', 'violet_face')
ITER = argval('--iter', '46')
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.materials):
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

# Figurine face palette — darker matte skin, sharp lime, teal vines
M_skin  = mat('f_skin',  '#4e2f72', 0.72)
M_skinD = mat('f_skinD', '#2a1840', 0.80)
M_tat   = mat('f_tat',   '#1fe088', 0.28, emit='#2aff9a', estr=1.1)
M_eye   = mat('f_eye',   '#c8ff28', 0.15, emit='#b4ff10', estr=1.8)
M_lip   = mat('f_lip',   '#1a0e22', 0.88)
M_hair  = mat('f_hair',  '#241030', 0.82)
M_hairG = mat('f_hairG', '#e8c040', 0.42, metal=0.25)
M_brow  = mat('f_brow',  '#1a1028', 0.9)

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

def add_uv(loc, r, seg=32, rings=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    return bpy.context.active_object

def add_cube(loc, scale):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object; ob.scale = scale; apply_TRS(ob, scale=True)
    return ob

def add_cone(loc, r1, r2, depth, seg=10):
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
    mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(30)
    bpy.ops.object.modifier_apply(modifier='Bevel')
    return ob

def subdiv(ob, levels=2, simple_first=False):
    activate(ob)
    if simple_first:
        m = ob.modifiers.new('Simple', 'SUBSURF')
        m.subdivision_type = 'SIMPLE'; m.levels = 1
        bpy.ops.object.modifier_apply(modifier='Simple')
    m = ob.modifiers.new('CC', 'SUBSURF')
    m.subdivision_type = 'CATMULL_CLARK'; m.levels = levels
    bpy.ops.object.modifier_apply(modifier='CC')
    return ob

R = 1.0
HZ = 0.0
# Front skin surface ≈ y = -R after slight squash. Features ON/OUTSIDE.
FACE_Y = -1.00

# ---- cranium (flatter face plane toward camera) ----
cr = add_uv((0, 0.08, HZ), R, 48, 28)
scale_local(cr, 1.00, 0.88, 1.06)
subdiv(cr, 1)
finish(cr, M_skin, 'cranium')

# face pad — shallow plate so features sit on a flatter figurine face
face_pad = add_uv((0, FACE_Y + 0.12, HZ + 0.02), 0.72, 36, 20)
scale_local(face_pad, 1.05, 0.22, 1.15)
subdiv(face_pad, 1)
finish(face_pad, M_skin, 'face_pad')

# jaw / chin
jaw = add_uv((0, -0.10, HZ - 0.55), 0.58, 36, 20)
scale_local(jaw, 1.02, 0.72, 0.68)
subdiv(jaw, 1)
finish(jaw, M_skin, 'jaw')

# cheeks
for s in (-1, 1):
    ch = add_uv((0.50 * s, -0.50, HZ - 0.10), 0.24, 24, 14)
    scale_local(ch, 0.80, 0.45, 0.90)
    finish(ch, M_skin, f'cheek_{s}')

# brow ridge + brows (stern, angled down toward nose)
for s in (-1, 1):
    br = add_uv((0.28 * s, FACE_Y + 0.12, HZ + 0.28), 0.16, 18, 10)
    scale_local(br, 1.55, 0.42, 0.48)
    rot_euler(br, 8, 0, -s * 16)
    finish(br, M_skinD, f'brow_ridge_{s}')
    line = add_cube((0.26 * s, FACE_Y - 0.01, HZ + 0.32), (0.16, 0.025, 0.022))
    bevel(line, 0.006, 2)
    rot_euler(line, 0, 0, -s * 18)
    finish(line, M_brow, f'brow_{s}')

# small nose bridge (not a dark blob)
nose = add_uv((0, FACE_Y - 0.04, HZ + 0.02), 0.07, 14, 10)
scale_local(nose, 0.65, 1.15, 1.35)
finish(nose, M_skin, 'nose')

# ---- ALMOND EYES: flush plates (thin Y), wide X, short Z, outer corner up ----
for s in (-1, 1):
    sock = add_uv((0.28 * s, FACE_Y + 0.04, HZ + 0.10), 0.20, 24, 14)
    scale_local(sock, 1.60, 0.22, 0.68)
    rot_euler(sock, 0, 0, -s * 20)
    finish(sock, M_skinD, f'socket_{s}')

    # flat emissive almond sitting just outside skin
    eye = add_uv((0.28 * s, FACE_Y - 0.02, HZ + 0.10), 0.17, 28, 16)
    scale_local(eye, 1.85, 0.14, 0.62)
    rot_euler(eye, 0, 0, -s * 22)
    finish(eye, M_eye, f'eye_{s}')

    core = add_uv((0.28 * s, FACE_Y - 0.04, HZ + 0.10), 0.10, 18, 12)
    scale_local(core, 1.65, 0.10, 0.50)
    rot_euler(core, 0, 0, -s * 22)
    finish(core, M_eye, f'eye_core_{s}')

    lid = add_cube((0.28 * s, FACE_Y - 0.01, HZ + 0.20), (0.22, 0.022, 0.032))
    bevel(lid, 0.006, 2)
    rot_euler(lid, 4, 0, -s * 20)
    finish(lid, M_skinD, f'lid_{s}')

# ---- LIPS — thin stern line, not two sausages ----
lip_u = add_cube((0, FACE_Y - 0.02, HZ - 0.38), (0.16, 0.035, 0.028))
bevel(lip_u, 0.012, 2)
finish(lip_u, M_lip, 'lip_upper')
lip_l = add_cube((0, FACE_Y - 0.01, HZ - 0.46), (0.13, 0.030, 0.024))
bevel(lip_l, 0.010, 2)
finish(lip_l, M_lip, 'lip_lower')

# ---- VINE TATTOOS — segment chains along curved face paths ----
def ribbon(x, y, z, sx, sy, sz, yaw, pitch=0, roll=0, name='tat'):
    ob = add_cube((x, y, z), (sx, sy, sz))
    bevel(ob, min(sx, sy, sz) * 0.48, 3)
    rot_euler(ob, pitch, roll, yaw)
    return finish(ob, M_tat, name)

def vine_path(points, thick=0.022, name_prefix='vine'):
    """points: list of (x, z) on face; elongated segments BETWEEN points (XZ plane)."""
    for i in range(len(points) - 1):
        x0, z0 = points[i][0], points[i][1]
        x1, z1 = points[i + 1][0], points[i + 1][1]
        mx, mz = (x0 + x1) * 0.5, (z0 + z1) * 0.5
        dx, dz = x1 - x0, z1 - z0
        length = max(math.hypot(dx, dz), 0.04)
        # ribbon long axis = local X; align in XZ via Y-rotation (roll arg → ry)
        ry = math.degrees(math.atan2(-dz, dx))
        # sx ≈ half-length; use 0.52*L so segments nearly touch/overlap
        ribbon(mx, TY, HZ + mz, length * 0.52, thick * 0.55, thick * 0.85,
               yaw=0, pitch=0, roll=ry, name=f'{name_prefix}_{i}')
    for i, p in enumerate(points):
        if i % 2:
            d = add_uv((p[0], TY - 0.01, HZ + p[1]), thick * 0.85, 8, 6)
            finish(d, M_tat, f'{name_prefix}_bud_{i}')

TY = FACE_Y - 0.012  # flush — avoid floating-shadow kitbash look

# forehead vine — central stem + left/right branches
vine_path([(0.00, 0.40), (0.00, 0.50), (0.00, 0.60), (0.00, 0.68)], thick=0.024, name_prefix='tat_fore_stem')
vine_path([(0.00, 0.56), (-0.10, 0.54), (-0.18, 0.46), (-0.24, 0.36)], thick=0.022, name_prefix='tat_fore_L')
vine_path([(0.00, 0.56), (0.10, 0.54), (0.18, 0.46), (0.24, 0.36)], thick=0.022, name_prefix='tat_fore_R')

# cheek vines — flowing S under each eye
for s in (-1, 1):
    vine_path([
        (0.16 * s, 0.04),
        (0.22 * s, -0.04),
        (0.30 * s, -0.10),
        (0.38 * s, -0.06),
        (0.42 * s, 0.04),
        (0.40 * s, 0.14),
        (0.34 * s, -0.18),
        (0.26 * s, -0.28),
        (0.18 * s, -0.36),
    ], thick=0.022, name_prefix=f'tat_ck_{s}')

# ---- EARS — long pointed, tip along ±X (horizontal elf ears) ----
for s in (-1, 1):
    # tip along ±X, angled slightly forward (−Y) and up
    ear = add_cone((1.05 * s, -0.35, HZ + 0.08), 0.16, 0.0, 1.55, seg=10)
    scale_local(ear, 0.70, 0.38, 1.0)
    rot_euler(ear, -18, -90 * s, 5 * s)
    bevel(ear, 0.014, 2)
    finish(ear, M_skin, f'ear_{s}')
    inn = add_cone((1.15 * s, -0.42, HZ + 0.08), 0.07, 0.0, 1.15, seg=8)
    scale_local(inn, 0.70, 0.35, 1.0)
    rot_euler(inn, -18, -90 * s, 5 * s)
    finish(inn, M_skinD, f'ear_in_{s}')

# ---- HAIR — purple spikes + gold on character RIGHT (-X), lean to camera ----
for i, (x, y, z, r, d, rx, rz) in enumerate([
    (0.0, -0.35, 1.15, 0.16, 0.62, -62, 0),
    (-0.28, -0.30, 1.05, 0.13, 0.55, -50, -22),
    (0.28, -0.30, 1.05, 0.13, 0.55, -50, 22),
    (-0.48, -0.20, 0.78, 0.11, 0.48, -35, -48),
    (0.48, -0.20, 0.78, 0.11, 0.48, -35, 48),
    (-0.62, -0.10, 0.40, 0.09, 0.38, -12, -70),
    (0.62, -0.10, 0.40, 0.09, 0.38, -12, 70),
    (0.10, -0.45, 1.22, 0.12, 0.50, -68, 8),
    (-0.12, -0.42, 1.20, 0.12, 0.52, -65, -6),
]):
    sp = add_cone((x, y, HZ + z), r, 0.006, d, seg=8)
    rot_euler(sp, rx, 0, rz)
    finish(sp, M_hair, f'hair_{i}')

# gold bangs — character right (-X)
for i, (x, y, z, r, d, rx, rz) in enumerate([
    (-0.16, -0.70, 1.00, 0.085, 0.48, -48, -8),
    (-0.28, -0.62, 0.88, 0.075, 0.42, -40, -24),
    (-0.08, -0.75, 1.08, 0.080, 0.50, -52, 2),
    (-0.38, -0.50, 0.68, 0.065, 0.36, -28, -40),
    (-0.22, -0.68, 0.78, 0.070, 0.40, -44, -14),
]):
    sp = add_cone((x, y, HZ + z), r, 0.006, d, seg=8)
    rot_euler(sp, rx, 0, rz)
    finish(sp, M_hairG, f'gold_{i}')

# side locks tucked by ears (gold only on character right / -X)
lock_r = add_uv((-0.85, -0.45, HZ - 0.35), 0.10, 14, 8)
scale_local(lock_r, 0.75, 0.65, 1.5)
rot_euler(lock_r, 20, 0, -12)
finish(lock_r, M_hairG, 'lock_-1')
lock_l = add_uv((0.85, -0.40, HZ - 0.35), 0.10, 14, 8)
scale_local(lock_l, 0.75, 0.65, 1.5)
rot_euler(lock_l, 20, 0, 12)
finish(lock_l, M_hair, 'lock_1')

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

# ---- FACE cameras ----
eye_target = V((0.0, FACE_Y, 0.10))

bpy.ops.object.light_add(type='SUN', location=(2, -2, 3))
sun = bpy.context.active_object
sun.data.energy = 2.2
sun.rotation_euler = (math.radians(48), math.radians(8), math.radians(18))
bpy.ops.object.light_add(type='AREA', location=(-1.8, -2.2, 1.0))
fill = bpy.context.active_object
fill.data.energy = 55; fill.data.size = 2.5
# rim from behind to separate hair
bpy.ops.object.light_add(type='AREA', location=(1.2, 1.5, 1.8))
rim = bpy.context.active_object
rim.data.energy = 40; rim.data.size = 2.0

scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 48
    scene.eevee.use_bloom = True
    scene.eevee.bloom_threshold = 1.35
    scene.eevee.bloom_intensity = 0.18
except Exception:
    scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.image_settings.file_format = 'PNG'
world = bpy.data.worlds.new('W'); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.12, 0.12, 0.14, 1)
bg.inputs['Strength'].default_value = 0.35

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

# front portrait — full head
cam.data.lens = 55
aim(V((0.0, -4.2, 0.15)))
path = os.path.join(frames, f'{ITER}_face_front.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

# ¾
cam.data.lens = 55
aim(V((2.0, -3.8, 0.25)))
path = os.path.join(frames, f'{ITER}_face_threeq.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

# face close — still outside mesh, shows eyes+tattoos+lips
cam.data.lens = 70
aim(V((0.0, -2.9, 0.12)))
path = os.path.join(frames, f'{ITER}_face_close.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

report = {
    'name': NAME, 'iter': ITER, 'glb': glb,
    'bytes': os.path.getsize(glb),
    'rendered': rendered,
    'focus': 'face_only',
    'changes': 'face pad, flush vines, longer forward ears, denser vine joins',
    'target': 'figurine: dark purple skin, lime almond eyes, teal vine tattoos, dark lips, pointed ears, gold bangs on character right',
}
print('FACE_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, f'{NAME}_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
