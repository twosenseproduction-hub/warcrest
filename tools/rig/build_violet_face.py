#!/usr/bin/env python3
"""Isolated FACE rebuild vs user figurine reference (dense cage, not sticker ball).

Matches attached T-pose figurine face:
  squared chibi head, circular neon lime eyes deep in sockets, stern brows,
  two thin teal cheek curves + small forehead mark, chunky purple+gold hair,
  long horizontal ears, purple cowl.

  blender -b -noaudio --python tools/rig/build_violet_face.py -- \
    --out exports/blender-rig-test --name violet_face --iter 50
"""
import bpy, bmesh, math, mathutils, sys, os, json
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a: a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

OUT = argval('--out', 'exports/blender-rig-test')
NAME = argval('--name', 'violet_face')
ITER = argval('--iter', '51')
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

# Palette sampled toward figurine (darker matte purple, clean neon lime)
M_skin  = mat('f_skin',  '#6a4a88', 0.68)
M_skinD = mat('f_skinD', '#2e1a48', 0.80)
M_tat   = mat('f_tat',   '#28e090', 0.22, emit='#40ffb0', estr=1.5)
M_eye   = mat('f_eye',   '#c4ff30', 0.08, emit='#b0ff20', estr=2.6)
M_lip   = mat('f_lip',   '#1a1020', 0.88)
M_hair  = mat('f_hair',  '#241430', 0.78)
M_hairG = mat('f_hairG', '#f0c840', 0.38, metal=0.25)
M_brow  = mat('f_brow',  '#140c20', 0.9)
M_cowl  = mat('f_cowl',  '#3a2458', 0.72)

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

def add_ico(loc, r, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    return bpy.context.active_object

def add_cone(loc, r1, r2, depth, seg=10):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2, depth=depth, location=loc)
    return bpy.context.active_object

def add_cylinder(loc, r, depth, seg=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=loc)
    return bpy.context.active_object

def add_torus(loc, maj, minr, maj_seg=32, min_seg=10):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=maj_seg, minor_segments=min_seg,
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
    mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(28)
    bpy.ops.object.modifier_apply(modifier='Bevel')
    return ob

def subdiv(ob, levels=2):
    activate(ob)
    m = ob.modifiers.new('CC', 'SUBSURF')
    m.subdivision_type = 'CATMULL_CLARK'; m.levels = levels
    bpy.ops.object.modifier_apply(modifier='CC')
    return ob

def solidify(ob, thick=0.04):
    activate(ob)
    m = ob.modifiers.new('Solid', 'SOLIDIFY')
    m.thickness = thick
    bpy.ops.object.modifier_apply(modifier='Solid')
    return ob

# Front face plane ≈ this Y (features outside / on surface)
FACE_Y = -0.92
HZ = 0.0

# ========== DENSE HEAD CAGE (squared chibi, smooth resin) ==========
head = add_cube((0, 0.05, HZ + 0.02), (0.92, 0.82, 1.02))
bevel(head, 0.22, 5)
subdiv(head, 3)
finish(head, M_skin, 'head_cage')

jaw = add_cube((0, -0.02, HZ - 0.52), (0.72, 0.50, 0.38))
bevel(jaw, 0.14, 4)
subdiv(jaw, 2)
finish(jaw, M_skin, 'jaw')

chin = add_uv((0, FACE_Y + 0.30, HZ - 0.82), 0.20, 24, 14)
scale_local(chin, 1.05, 0.65, 0.80)
subdiv(chin, 1)
finish(chin, M_skin, 'chin')

for s in (-1, 1):
    ck = add_uv((0.52 * s, -0.30, HZ - 0.12), 0.28, 24, 14)
    scale_local(ck, 0.80, 0.50, 0.90)
    finish(ck, M_skin, f'cheek_{s}')

fore = add_uv((0, FACE_Y + 0.40, HZ + 0.32), 0.55, 28, 16)
scale_local(fore, 1.15, 0.28, 0.70)
finish(fore, M_skin, 'forehead')

# ========== EYE SOCKETS (deep bowls) ==========
for s in (-1, 1):
    sock = add_uv((0.28 * s, FACE_Y + 0.10, HZ + 0.12), 0.26, 24, 14)
    scale_local(sock, 1.10, 0.45, 1.00)
    finish(sock, M_skinD, f'socket_{s}')

# ========== CIRCULAR neon eyes — single clean disc (no layered speckles) ==========
for s in (-1, 1):
    eye = add_uv((0.28 * s, FACE_Y - 0.03, HZ + 0.12), 0.19, 32, 18)
    scale_local(eye, 1.0, 0.16, 1.0)
    finish(eye, M_eye, f'eye_{s}')

# thick dark upper lids + stern brows (down toward nose)
for s in (-1, 1):
    lid = add_cube((0.30 * s, FACE_Y - 0.01, HZ + 0.28), (0.22, 0.06, 0.07))
    bevel(lid, 0.02, 2)
    rot_euler(lid, 8, 0, -s * 8)
    finish(lid, M_skinD, f'lid_{s}')
    brow = add_cube((0.26 * s, FACE_Y - 0.03, HZ + 0.36), (0.20, 0.04, 0.035))
    bevel(brow, 0.012, 2)
    # angle down toward center (stern)
    rot_euler(brow, 0, 0, -s * 28)
    finish(brow, M_brow, f'brow_{s}')

# nose — small upturned
nose = add_ico((0, FACE_Y - 0.04, HZ - 0.02), 0.09, 2)
scale_local(nose, 0.7, 1.1, 1.25)
finish(nose, M_skin, 'nose')

# lips — small grim line
lip = add_cube((0, FACE_Y - 0.02, HZ - 0.42), (0.14, 0.04, 0.035))
bevel(lip, 0.012, 2)
finish(lip, M_lip, 'lips')
lip2 = add_cube((0, FACE_Y - 0.01, HZ - 0.48), (0.11, 0.035, 0.028))
bevel(lip2, 0.01, 2)
finish(lip2, M_lip, 'lips_lo')

# ========== TEAL TATTOOS — sparse continuous curves (match ref) ==========
def cheek_curve(side):
    """Two thin arcs from beside nose toward ear — figurine pattern."""
    # arc 1 (upper cheek)
    pts = []
    for i in range(10):
        t = i / 9.0
        x = side * (0.12 + 0.42 * t)
        z = 0.02 - 0.08 * math.sin(t * math.pi) - 0.06 * t
        pts.append((x, FACE_Y - 0.015, HZ + z))
    for i in range(len(pts) - 1):
        a, b = V(pts[i]), V(pts[i + 1])
        mid = (a + b) * 0.5
        d = (b - a).length
        ob = add_cube(tuple(mid), (d * 0.52, 0.012, 0.018))
        # align in XZ via Y rot
        dx, dz = b.x - a.x, b.z - a.z
        ry = math.degrees(math.atan2(-dz, dx))
        rot_euler(ob, 0, ry, 0)
        bevel(ob, 0.006, 2)
        finish(ob, M_tat, f'tat_ck1_{side}_{i}')
    # arc 2 (lower cheek, parallel)
    pts2 = []
    for i in range(8):
        t = i / 7.0
        x = side * (0.14 + 0.38 * t)
        z = -0.12 - 0.06 * math.sin(t * math.pi) - 0.05 * t
        pts2.append((x, FACE_Y - 0.015, HZ + z))
    for i in range(len(pts2) - 1):
        a, b = V(pts2[i]), V(pts2[i + 1])
        mid = (a + b) * 0.5
        d = max((b - a).length, 0.04)
        ob = add_cube(tuple(mid), (d * 0.52, 0.011, 0.016))
        dx, dz = b.x - a.x, b.z - a.z
        ry = math.degrees(math.atan2(-dz, dx))
        rot_euler(ob, 0, ry, 0)
        bevel(ob, 0.005, 2)
        finish(ob, M_tat, f'tat_ck2_{side}_{i}')

cheek_curve(-1)
cheek_curve(1)

# small vertical forehead mark (ref: tiny, centered)
for i, z in enumerate([0.48, 0.56, 0.64]):
    m = add_cube((0, FACE_Y - 0.015, HZ + z), (0.025, 0.012, 0.045))
    bevel(m, 0.008, 2)
    finish(m, M_tat, f'tat_fore_{i}')

# ========== EARS — long pointed horizontal, slight back ==========
for s in (-1, 1):
    ear = add_cone((1.10 * s, 0.05, HZ + 0.06), 0.20, 0.0, 1.65, seg=12)
    scale_local(ear, 0.55, 0.28, 1.0)
    rot_euler(ear, -5, -90 * s, 0)
    bevel(ear, 0.012, 2)
    subdiv(ear, 1)
    finish(ear, M_skin, f'ear_{s}')

# ========== HAIR — many chunky spikes, gold on character right / front ==========
# purple volume base
cap = add_ico((0, 0.15, HZ + 0.85), 0.55, 2)
scale_local(cap, 1.15, 0.95, 0.55)
finish(cap, M_hair, 'hair_cap')

spikes = [
    # (x, y, z, r, depth, rx, rz, gold?)
    (0.05, -0.55, 1.25, 0.14, 0.70, -70, 5, True),
    (-0.15, -0.50, 1.20, 0.13, 0.65, -65, -12, True),
    (-0.30, -0.40, 1.10, 0.12, 0.60, -55, -28, True),
    (0.20, -0.45, 1.15, 0.12, 0.58, -60, 18, False),
    (-0.45, -0.25, 0.95, 0.11, 0.55, -40, -45, True),
    (0.40, -0.25, 0.95, 0.11, 0.55, -40, 45, False),
    (0.0, -0.20, 1.35, 0.13, 0.55, -75, 0, True),
    (-0.20, 0.05, 1.30, 0.12, 0.50, -50, -15, False),
    (0.25, 0.05, 1.28, 0.12, 0.50, -50, 20, False),
    (-0.55, -0.10, 0.70, 0.10, 0.48, -25, -60, False),
    (0.55, -0.10, 0.70, 0.10, 0.48, -25, 60, False),
    (-0.35, -0.55, 0.85, 0.10, 0.50, -45, -20, True),
    (0.10, -0.60, 1.00, 0.11, 0.55, -68, 8, True),
    (-0.05, 0.25, 1.20, 0.14, 0.45, -35, -5, False),
    (0.35, 0.20, 1.10, 0.12, 0.42, -30, 30, False),
]
for i, (x, y, z, r, d, rx, rz, gold) in enumerate(spikes):
    sp = add_cone((x, y, HZ + z), r, 0.01, d, seg=8)
    rot_euler(sp, rx, 0, rz)
    bevel(sp, 0.01, 2)
    finish(sp, M_hairG if gold else M_hair, f'spike_{i}')

# ========== COWL (neck) — draped scarf, not a donut earring ==========
cowl = add_cube((0, 0.10, HZ - 1.15), (0.75, 0.40, 0.35))
bevel(cowl, 0.12, 4)
subdiv(cowl, 2)
finish(cowl, M_cowl, 'cowl')
for s in (-1, 1):
    flap = add_cube((0.35 * s, 0.20, HZ - 1.35), (0.28, 0.22, 0.30))
    bevel(flap, 0.08, 3)
    subdiv(flap, 1)
    finish(flap, M_cowl, f'cowl_flap_{s}')

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

# ========== RENDER ==========
eye_target = V((0.0, FACE_Y, 0.12))

bpy.ops.object.light_add(type='SUN', location=(2.5, -2.5, 3.5))
sun = bpy.context.active_object
sun.data.energy = 2.4
sun.rotation_euler = (math.radians(48), math.radians(10), math.radians(20))
bpy.ops.object.light_add(type='AREA', location=(-2.0, -2.5, 1.2))
fill = bpy.context.active_object
fill.data.energy = 60; fill.data.size = 2.8
bpy.ops.object.light_add(type='AREA', location=(1.5, 1.8, 1.5))
rim = bpy.context.active_object
rim.data.energy = 35; rim.data.size = 2.0

scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 56
    scene.eevee.use_bloom = True
    scene.eevee.bloom_threshold = 1.2
    scene.eevee.bloom_intensity = 0.22
except Exception:
    scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.image_settings.file_format = 'PNG'
world = bpy.data.worlds.new('W'); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
# match ref light gray studio a bit
bg.inputs['Color'].default_value = (0.55, 0.55, 0.56, 1)
bg.inputs['Strength'].default_value = 0.55

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

cam.data.lens = 55
aim(V((0.0, -4.4, 0.05)))
path = os.path.join(frames, f'{ITER}_face_front.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

cam.data.lens = 55
aim(V((2.1, -3.9, 0.15)))
path = os.path.join(frames, f'{ITER}_face_threeq.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

cam.data.lens = 70
aim(V((0.0, -2.8, 0.10)))
path = os.path.join(frames, f'{ITER}_face_close.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

# clay pass of front
try:
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'SINGLE'
    scene.display.shading.single_color = (0.72, 0.72, 0.74)
    aim(V((0.0, -4.4, 0.05)))
    path = os.path.join(frames, f'{ITER}_face_clay.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    rendered.append(path); print('RENDERED', path)
except Exception as e:
    print('CLAY_FAIL', e)

report = {
    'name': NAME, 'iter': ITER, 'glb': glb,
    'bytes': os.path.getsize(glb),
    'rendered': rendered,
    'focus': 'face_only_dense_vs_user_ref',
    'changes': 'smoother darker head, clean circular eyes, draped cowl, fixed ears',
    'card': 'exports/blender-rig-test/refs/violet_face_CARD.md',
}
print('FACE_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, f'{NAME}_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
