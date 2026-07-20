#!/usr/bin/env python3
"""Isolated FACE match for violet cape warrior figurine reference.

Only head / face / ears / hair bangs — camera framed on face.
Iterate until eyes, tattoos, lips, ears match the ref.

  blender -b -noaudio --python tools/rig/build_violet_face.py -- \
    --out exports/blender-rig-test --name violet_face
"""
import bpy, math, mathutils, sys, os, json
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a: a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

OUT = argval('--out', 'exports/blender-rig-test')
NAME = argval('--name', 'violet_face')
ITER = argval('--iter', '40')
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

# Figurine face palette
M_skin  = mat('f_skin',  '#6a4890', 0.65)       # dark lavender-purple matte
M_skinD = mat('f_skinD', '#3a2758', 0.75)       # socket / shadow
M_tat   = mat('f_tat',   '#2aff9a', 0.30, emit='#40ffb0', estr=1.6)
M_eye   = mat('f_eye',   '#c8ff3a', 0.12, emit='#b0ff28', estr=2.0)
M_lip   = mat('f_lip',   '#2a1835', 0.85)
M_hair  = mat('f_hair',  '#2a1538', 0.80)
M_hairG = mat('f_hairG', '#f0c94a', 0.40, metal=0.2)
M_brow  = mat('f_brow',  '#2a1838', 0.9)

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

def add_ico(loc, r, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    return bpy.context.active_object

def add_cube(loc, scale):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object; ob.scale = scale; apply_TRS(ob, scale=True)
    return ob

def add_cone(loc, r1, r2, depth, seg=10):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2, depth=depth, location=loc)
    return bpy.context.active_object

def add_torus(loc, maj, minr, seg=24, mseg=10):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=mseg,
                                     major_radius=maj, minor_radius=minr, location=loc)
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
# Front skin surface ≈ y = -R. ALL face details must sit ON/OUTSIDE that plane.
FACE_Y = -1.02

# ---- cranium ----
cr = add_uv((0, 0.0, HZ), R, 48, 28)
scale_local(cr, 1.02, 0.98, 1.06)  # slightly taller chibi
subdiv(cr, 1)
finish(cr, M_skin, 'cranium')

# jaw / chin
jaw = add_uv((0, -0.25, HZ - 0.45), 0.70, 36, 20)
scale_local(jaw, 1.08, 0.85, 0.80)
subdiv(jaw, 1)
finish(jaw, M_skin, 'jaw')

# cheeks (push toward camera)
for s in (-1, 1):
    ch = add_uv((0.42*s, -0.55, HZ - 0.08), 0.30, 24, 14)
    scale_local(ch, 0.9, 0.7, 1.0)
    finish(ch, M_skin, f'cheek_{s}')

# brow ridge
for s in (-1, 1):
    br = add_uv((0.30*s, FACE_Y + 0.15, HZ + 0.30), 0.17, 18, 10)
    scale_local(br, 1.5, 0.5, 0.55)
    rot_euler(br, 0, 0, -s*12)
    finish(br, M_skinD, f'brow_ridge_{s}')
    line = add_cube((0.28*s, FACE_Y - 0.02, HZ + 0.34), (0.15, 0.03, 0.028))
    bevel(line, 0.008, 2)
    rot_euler(line, 0, 0, -s*14)
    finish(line, M_brow, f'brow_{s}')

# nose
nose = add_uv((0, FACE_Y - 0.05, HZ - 0.02), 0.10, 16, 10)
scale_local(nose, 0.75, 1.3, 1.15)
finish(nose, M_skinD, 'nose')

# ---- EYES on front surface ----
for s in (-1, 1):
    sock = add_uv((0.32*s, FACE_Y + 0.08, HZ + 0.12), 0.28, 24, 14)
    scale_local(sock, 1.25, 0.40, 0.90)
    rot_euler(sock, 0, 0, -s*18)
    finish(sock, M_skinD, f'socket_{s}')
    eye = add_uv((0.32*s, FACE_Y - 0.06, HZ + 0.12), 0.22, 28, 16)
    scale_local(eye, 0.95, 0.42, 1.60)
    rot_euler(eye, 0, 0, -s*20)
    finish(eye, M_eye, f'eye_{s}')
    core = add_uv((0.32*s, FACE_Y - 0.12, HZ + 0.12), 0.12, 16, 10)
    scale_local(core, 0.9, 0.38, 1.40)
    rot_euler(core, 0, 0, -s*20)
    finish(core, M_eye, f'eye_core_{s}')
    lid = add_cube((0.32*s, FACE_Y - 0.02, HZ + 0.30), (0.17, 0.04, 0.045))
    bevel(lid, 0.01, 2)
    rot_euler(lid, 0, 0, -s*18)
    finish(lid, M_skinD, f'lid_{s}')

# ---- LIPS ----
lip_u = add_uv((0, FACE_Y - 0.02, HZ - 0.40), 0.11, 16, 10)
scale_local(lip_u, 1.75, 0.40, 0.50)
finish(lip_u, M_lip, 'lip_upper')
lip_l = add_uv((0, FACE_Y, HZ - 0.52), 0.10, 16, 10)
scale_local(lip_l, 1.55, 0.35, 0.42)
finish(lip_l, M_lip, 'lip_lower')

# ---- FACE TATTOOS on surface ----
def ribbon(x, y, z, sx, sy, sz, yaw, name):
    ob = add_cube((x, y, z), (sx, sy, sz))
    bevel(ob, min(sx, sy, sz)*0.4, 2)
    rot_euler(ob, 0, 0, yaw)
    return finish(ob, M_tat, name)

TY = FACE_Y - 0.04
ribbon(0.0, TY, HZ + 0.45, 0.20, 0.03, 0.07, 0, 'tat_fore_0')
ribbon(-0.14, TY, HZ + 0.52, 0.12, 0.028, 0.055, 28, 'tat_fore_1')
ribbon(0.14, TY, HZ + 0.52, 0.12, 0.028, 0.055, -28, 'tat_fore_2')
ribbon(0.0, TY, HZ + 0.58, 0.09, 0.025, 0.09, 0, 'tat_fore_3')

for s in (-1, 1):
    ribbon(0.24*s, TY, HZ + 0.02, 0.07, 0.028, 0.16, -s*28, f'tat_cheek_v_{s}')
    ribbon(0.36*s, TY, HZ - 0.06, 0.14, 0.028, 0.055, -s*38, f'tat_cheek_h_{s}')
    ribbon(0.30*s, TY, HZ - 0.18, 0.09, 0.025, 0.09, -s*18, f'tat_cheek_c_{s}')
    ribbon(0.42*s, TY, HZ + 0.10, 0.055, 0.025, 0.11, -s*42, f'tat_cheek_o_{s}')
    for i, (ox, oz) in enumerate([(0.20, 0.14), (0.38, -0.02), (0.26, -0.24)]):
        d = add_uv((ox*s, TY - 0.02, HZ + oz), 0.045, 10, 6)
        finish(d, M_tat, f'tat_dot_{s}_{i}')

# ---- EARS ----
for s in (-1, 1):
    ear = add_cone((1.05*s, -0.15, HZ + 0.02), 0.24, 0.0, 1.20, seg=10)
    rot_euler(ear, 8, 0, -s*90)
    bevel(ear, 0.02, 2)
    finish(ear, M_skin, f'ear_{s}')
    inn = add_cone((1.15*s, -0.25, HZ + 0.02), 0.11, 0.0, 0.80, seg=8)
    rot_euler(inn, 8, 0, -s*90)
    finish(inn, M_skinD, f'ear_in_{s}')

# ---- HAIR (face-framing only — keep thin so face stays visible) ----
for i, (x, y, z, r, d, rx, rz) in enumerate([
    (0.0, 0.35, 0.95, 0.20, 0.40, -25, 0),
    (-0.40, 0.20, 0.75, 0.16, 0.36, -10, -35),
    (0.40, 0.20, 0.75, 0.16, 0.36, -10, 35),
    (-0.55, 0.05, 0.35, 0.12, 0.30, 5, -60),
    (0.55, 0.05, 0.35, 0.12, 0.30, 5, 60),
]):
    sp = add_cone((x, y, HZ + z * 0.25), r, 0.008, d, seg=8)
    rot_euler(sp, rx, 0, rz)
    finish(sp, M_hair, f'hair_{i}')

# gold bangs — character right (-X), in front of forehead but not covering eyes
for i, (x, y, z, r, d, rx, rz) in enumerate([
    (-0.15, FY*0.15, 0.85, 0.10, 0.36, 20, -8),
    (-0.30, FY*0.05, 0.70, 0.09, 0.32, 15, -28),
    (-0.08, FY*0.18, 0.95, 0.10, 0.38, 18, 0),
    (-0.40, 0.0, 0.50, 0.08, 0.28, 10, -45),
]):
    sp = add_cone((x, y, HZ + z * 0.25), r, 0.008, d, seg=8)
    rot_euler(sp, rx, 0, rz)
    finish(sp, M_hairG, f'gold_{i}')

for s in (-1, 1):
    lock = add_uv((0.90*s, FY*0.05, HZ - 0.45), 0.12, 14, 8)
    scale_local(lock, 0.85, 0.75, 1.6)
    rot_euler(lock, 15, 0, s*8)
    finish(lock, M_hair, f'lock_{s}')

# JOIN — do NOT recentroid in a way that breaks face=-Y; only ground X
clear_sel()
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = NAME
bpy.context.view_layer.update()

glb = os.path.join(OUT, f'{NAME}.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_apply=True)

# ---- FACE cameras: look at eyes from -Y (never clip inside mesh) ----
# Eyes sit on front surface ≈ y=-1.05
eye_target = V((0.0, -1.05, 0.12))

bpy.ops.object.light_add(type='SUN', location=(2, -2, 3))
sun = bpy.context.active_object
sun.data.energy = 2.8
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(20))
bpy.ops.object.light_add(type='AREA', location=(-1.5, -2.0, 1.2))
fill = bpy.context.active_object
fill.data.energy = 90; fill.data.size = 3

scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 48
    scene.eevee.use_bloom = True
    scene.eevee.bloom_threshold = 1.0
    scene.eevee.bloom_intensity = 0.3
except Exception:
    scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.image_settings.file_format = 'PNG'
world = bpy.data.worlds.new('W'); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.16, 0.16, 0.18, 1)
bg.inputs['Strength'].default_value = 0.5

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

# front portrait
cam.data.lens = 50
aim(V((0.0, -3.6, 0.10)))
path = os.path.join(frames, f'{ITER}_face_front.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

# ¾
cam.data.lens = 50
aim(V((1.6, -3.2, 0.20)))
path = os.path.join(frames, f'{ITER}_face_threeq.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

# eye close-up
cam.data.lens = 70
aim(V((0.0, -2.4, 0.15)))
path = os.path.join(frames, f'{ITER}_face_close.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

report = {
    'name': NAME, 'iter': ITER, 'glb': glb,
    'bytes': os.path.getsize(glb),
    'rendered': rendered,
    'focus': 'face_only',
    'target': 'figurine: dark purple skin, lime almond eyes, teal vine tattoos, dark lips, pointed ears, gold bangs on character right',
}
print('FACE_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, f'{NAME}_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
