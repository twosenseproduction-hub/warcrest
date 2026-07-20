#!/usr/bin/env python3
"""Owned dense FACE match — no external AI APIs.

Matches violet_face_CARD.md (figurine T-pose head):
  squared chibi head, circular neon eyes deep in sockets, stern brows,
  two continuous teal cheek curves + tiny forehead mark, chunky purple+gold
  hair swept to character right, long horizontal ears, purple cowl.

Pipeline: skin cages → boolean UNION + voxel remesh → attachments → clay/studio PNGs.

  blender -b -noaudio --python tools/rig/build_violet_face.py -- \
    --out exports/blender-rig-test --name violet_face --iter 60
"""
import bpy, math, mathutils, sys, os, json
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a: a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

OUT = argval('--out', 'exports/blender-rig-test')
NAME = argval('--name', 'violet_face')
ITER = argval('--iter', '61')
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

# Figurine palette (matte resin)
M_skin  = mat('f_skin',  '#5a3a78', 0.68)
M_skinD = mat('f_skinD', '#2a1740', 0.78)
M_tat   = mat('f_tat',   '#2ae896', 0.20, emit='#3cffb0', estr=1.55)
M_eye   = mat('f_eye',   '#c8ff2a', 0.06, emit='#b4ff14', estr=2.8)
M_lip   = mat('f_lip',   '#18101f', 0.88)
M_hair  = mat('f_hair',  '#221430', 0.76)
M_hairG = mat('f_hairG', '#f0c840', 0.36, metal=0.28)
M_brow  = mat('f_brow',  '#120c1c', 0.9)
M_cowl  = mat('f_cowl',  '#3c2458', 0.70)

skin_parts = []   # will be fused
attach = []       # eyes, tattoos, hair, etc.

def clear_sel():
    for o in bpy.context.selected_objects: o.select_set(False)

def activate(ob):
    clear_sel(); ob.select_set(True); bpy.context.view_layer.objects.active = ob

def apply_TRS(ob, loc=False, rot=False, scale=False):
    activate(ob); bpy.ops.object.transform_apply(location=loc, rotation=rot, scale=scale)

def finish(ob, m, name, bucket):
    ob.name = name
    if ob.data.materials: ob.data.materials[0] = m
    else: ob.data.materials.append(m)
    for p in ob.data.polygons: p.use_smooth = True
    bucket.append(ob)
    return ob

def add_cube(loc, scale):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object; ob.scale = scale; apply_TRS(ob, scale=True)
    return ob

def add_uv(loc, r, seg=32, rings=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    return bpy.context.active_object

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
    mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(28)
    bpy.ops.object.modifier_apply(modifier='Bevel')
    return ob

def subdiv(ob, levels=2):
    activate(ob)
    m = ob.modifiers.new('CC', 'SUBSURF')
    m.subdivision_type = 'CATMULL_CLARK'; m.levels = levels
    bpy.ops.object.modifier_apply(modifier='CC')
    return ob

FACE_Y = -0.88
HZ = 0.0

# ========== SKIN CAGES (fused into one resin head) ==========
head = add_cube((0, 0.08, HZ + 0.05), (0.90, 0.78, 0.98))
bevel(head, 0.24, 5)
subdiv(head, 2)
finish(head, M_skin, 'head', skin_parts)

jaw = add_cube((0, 0.0, HZ - 0.48), (0.70, 0.52, 0.40))
bevel(jaw, 0.16, 4)
subdiv(jaw, 2)
finish(jaw, M_skin, 'jaw', skin_parts)

chin = add_uv((0, FACE_Y + 0.35, HZ - 0.78), 0.18, 24, 14)
scale_local(chin, 1.05, 0.60, 0.75)
finish(chin, M_skin, 'chin', skin_parts)

for s in (-1, 1):
    ck = add_uv((0.48 * s, -0.22, HZ - 0.10), 0.26, 24, 14)
    scale_local(ck, 0.75, 0.48, 0.88)
    finish(ck, M_skin, f'cheek_{s}', skin_parts)

fore = add_uv((0, FACE_Y + 0.42, HZ + 0.35), 0.50, 28, 16)
scale_local(fore, 1.20, 0.26, 0.65)
finish(fore, M_skin, 'forehead', skin_parts)

# ears — tip along ±X, base at temple (attach after fuse so remesh doesn't destroy them)
ear_defs = []
for s in (-1, 1):
    ear_defs.append(s)

# Fuse → one continuous resin surface
base = skin_parts[0]
activate(base)
for other in skin_parts[1:]:
    mod = base.modifiers.new(f'Bool_{other.name}', 'BOOLEAN')
    mod.operation = 'UNION'
    mod.solver = 'EXACT'
    mod.object = other
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception:
        # fallback: join
        break
    bpy.data.objects.remove(other, do_unlink=True)

# If boolean left orphans, join remaining
remaining = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o != base]
if remaining:
    clear_sel()
    for o in remaining:
        if o.name.startswith(('head', 'jaw', 'chin', 'cheek', 'forehead', 'ear')):
            o.select_set(True)
    base.select_set(True)
    bpy.context.view_layer.objects.active = base
    try:
        bpy.ops.object.join()
        base = bpy.context.view_layer.objects.active
    except Exception:
        pass

activate(base)
rm = base.modifiers.new('Voxel', 'REMESH')
rm.mode = 'VOXEL'
rm.voxel_size = 0.028
rm.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier='Voxel')
subdiv(base, 1)
# assign skin mat after remesh
if base.data.materials:
    base.data.materials[0] = M_skin
else:
    base.data.materials.append(M_skin)
for p in base.data.polygons:
    p.use_smooth = True
base.name = 'head_fused'
skin_mesh = base

# ears AFTER fuse (horizontal elf, slight back)
for s in ear_defs:
    ear = add_cone((1.00 * s, 0.05, HZ + 0.04), 0.17, 0.0, 1.40, seg=12)
    scale_local(ear, 0.48, 0.24, 1.0)
    rot_euler(ear, -6, -90 * s, 0)
    bevel(ear, 0.01, 2)
    finish(ear, M_skin, f'ear_{s}', attach)

# carve eye sockets (boolean difference with dark bowls kept as attach for rim)
for s in (-1, 1):
    cutter = add_uv((0.27 * s, FACE_Y + 0.05, HZ + 0.12), 0.22, 20, 12)
    scale_local(cutter, 1.05, 0.55, 1.0)
    activate(skin_mesh)
    mod = skin_mesh.modifiers.new(f'SockCut_{s}', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception:
        pass
    bpy.data.objects.remove(cutter, do_unlink=True)

    sock = add_uv((0.27 * s, FACE_Y + 0.06, HZ + 0.12), 0.20, 20, 12)
    scale_local(sock, 1.05, 0.40, 1.0)
    finish(sock, M_skinD, f'socket_{s}', attach)

# ========== CIRCULAR neon eyes (recessed discs) ==========
for s in (-1, 1):
    eye = add_uv((0.27 * s, FACE_Y - 0.02, HZ + 0.12), 0.175, 32, 18)
    scale_local(eye, 1.0, 0.14, 1.0)
    finish(eye, M_eye, f'eye_{s}', attach)

# stern brows + thick lids
for s in (-1, 1):
    lid = add_cube((0.27 * s, FACE_Y - 0.01, HZ + 0.26), (0.20, 0.05, 0.06))
    bevel(lid, 0.018, 2)
    rot_euler(lid, 6, 0, -s * 6)
    finish(lid, M_skinD, f'lid_{s}', attach)
    brow = add_cube((0.24 * s, FACE_Y - 0.02, HZ + 0.34), (0.18, 0.035, 0.032))
    bevel(brow, 0.01, 2)
    rot_euler(brow, 0, 0, -s * 30)
    finish(brow, M_brow, f'brow_{s}', attach)

# nose + lips
nose = add_uv((0, FACE_Y - 0.03, HZ + 0.00), 0.075, 16, 12)
scale_local(nose, 0.65, 1.05, 1.20)
finish(nose, M_skin, 'nose', attach)
lip = add_cube((0, FACE_Y - 0.015, HZ - 0.40), (0.12, 0.035, 0.030))
bevel(lip, 0.01, 2)
finish(lip, M_lip, 'lips', attach)
lip2 = add_cube((0, FACE_Y - 0.01, HZ - 0.46), (0.10, 0.030, 0.024))
bevel(lip2, 0.008, 2)
finish(lip2, M_lip, 'lips_lo', attach)

# ========== CONTINUOUS cheek curve tattoos (curve → mesh) ==========
def make_curve_ribbon(name, points_xyz, bevel_depth=0.014, res=8):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel_depth
    cu.bevel_resolution = 3
    cu.resolution_u = res
    sp = cu.splines.new('NURBS')
    sp.points.add(len(points_xyz) - 1)
    for i, (x, y, z) in enumerate(points_xyz):
        sp.points[i].co = (x, y, z, 1.0)
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(points_xyz))
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    activate(ob)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object
    return finish(ob, M_tat, name, attach)

for s in (-1, 1):
    # upper cheek arc nose → ear
    pts1 = []
    for i in range(12):
        t = i / 11.0
        x = s * (0.10 + 0.48 * t)
        z = 0.04 - 0.10 * math.sin(t * math.pi) - 0.04 * t
        pts1.append((x, FACE_Y - 0.012, HZ + z))
    make_curve_ribbon(f'tat_ck_hi_{s}', pts1, 0.013)
    # lower parallel arc
    pts2 = []
    for i in range(10):
        t = i / 9.0
        x = s * (0.12 + 0.42 * t)
        z = -0.10 - 0.08 * math.sin(t * math.pi) - 0.04 * t
        pts2.append((x, FACE_Y - 0.012, HZ + z))
    make_curve_ribbon(f'tat_ck_lo_{s}', pts2, 0.012)

# tiny forehead vertical
make_curve_ribbon('tat_fore', [
    (0, FACE_Y - 0.012, HZ + 0.46),
    (0, FACE_Y - 0.012, HZ + 0.54),
    (0, FACE_Y - 0.012, HZ + 0.62),
    (0, FACE_Y - 0.012, HZ + 0.70),
], 0.011)

# ========== HAIR — dense chunky spikes, gold on character RIGHT / front ==========
cap = add_uv((0, 0.20, HZ + 0.88), 0.58, 28, 16)
scale_local(cap, 1.15, 0.95, 0.50)
finish(cap, M_hair, 'hair_cap', attach)

spikes = [
    # x, y, z, r, depth, rx, rz, gold
    (0.08, -0.60, 1.22, 0.15, 0.78, -72, 8, True),
    (-0.12, -0.55, 1.18, 0.14, 0.72, -68, -10, True),
    (-0.28, -0.48, 1.10, 0.13, 0.68, -58, -26, True),
    (-0.40, -0.38, 0.98, 0.12, 0.62, -48, -40, True),
    (0.22, -0.50, 1.12, 0.13, 0.65, -62, 22, False),
    (0.38, -0.35, 0.98, 0.12, 0.58, -45, 40, False),
    (0.0, -0.30, 1.38, 0.14, 0.60, -78, 0, True),
    (-0.18, -0.05, 1.32, 0.13, 0.55, -55, -12, False),
    (0.20, -0.05, 1.30, 0.13, 0.55, -55, 18, False),
    (-0.52, -0.15, 0.72, 0.11, 0.52, -28, -58, False),
    (0.52, -0.15, 0.72, 0.11, 0.52, -28, 58, False),
    (-0.32, -0.58, 0.88, 0.11, 0.55, -50, -18, True),
    (0.12, -0.65, 1.02, 0.12, 0.60, -70, 10, True),
    (-0.08, 0.28, 1.22, 0.14, 0.48, -38, -6, False),
    (0.30, 0.22, 1.12, 0.12, 0.45, -32, 28, False),
    (-0.45, -0.45, 1.05, 0.11, 0.58, -52, -35, True),
    (0.05, -0.40, 1.42, 0.12, 0.52, -80, 4, True),
]
for i, (x, y, z, r, d, rx, rz, gold) in enumerate(spikes):
    sp = add_cone((x, y, HZ + z), r, 0.012, d, seg=16)
    rot_euler(sp, rx, 0, rz)
    bevel(sp, 0.018, 3)
    subdiv(sp, 1)
    finish(sp, M_hairG if gold else M_hair, f'spike_{i}', attach)

# ========== COWL — snug under chin, no floating ball ==========
cowl = add_uv((0, 0.05, HZ - 0.95), 0.48, 28, 16)
scale_local(cowl, 1.35, 1.05, 0.55)
finish(cowl, M_cowl, 'cowl', attach)
cowl2 = add_cube((0, 0.10, HZ - 1.20), (0.70, 0.38, 0.28))
bevel(cowl2, 0.10, 3)
subdiv(cowl2, 1)
finish(cowl2, M_cowl, 'cowl_drape', attach)

# JOIN everything
all_objs = [skin_mesh] + attach
clear_sel()
for o in all_objs:
    if o.name in bpy.data.objects:
        o.select_set(True)
bpy.context.view_layer.objects.active = skin_mesh
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = NAME
bpy.context.view_layer.update()

glb = os.path.join(OUT, f'{NAME}.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_apply=True)

# ========== RENDER (studio gray like figurine + clay) ==========
eye_target = V((0.0, FACE_Y, 0.10))

bpy.ops.object.light_add(type='SUN', location=(2.2, -2.8, 3.2))
sun = bpy.context.active_object
sun.data.energy = 2.6
sun.rotation_euler = (math.radians(50), math.radians(8), math.radians(18))
bpy.ops.object.light_add(type='AREA', location=(-2.0, -2.6, 1.4))
fill = bpy.context.active_object
fill.data.energy = 70; fill.data.size = 3.0

scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 56
    scene.eevee.use_bloom = True
    scene.eevee.bloom_threshold = 1.15
    scene.eevee.bloom_intensity = 0.25
except Exception:
    scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.image_settings.file_format = 'PNG'
world = bpy.data.worlds.new('W'); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.62, 0.62, 0.64, 1)
bg.inputs['Strength'].default_value = 0.65

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
aim(V((0.0, -4.5, 0.05)))
path = os.path.join(frames, f'{ITER}_face_front.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

cam.data.lens = 55
aim(V((2.0, -4.0, 0.12)))
path = os.path.join(frames, f'{ITER}_face_threeq.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

cam.data.lens = 70
aim(V((0.0, -2.85, 0.10)))
path = os.path.join(frames, f'{ITER}_face_close.png')
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path); print('RENDERED', path)

try:
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'SINGLE'
    scene.display.shading.single_color = (0.70, 0.70, 0.72)
    aim(V((0.0, -4.5, 0.05)))
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
    'pipeline': 'owned_dense_boolean_remesh_no_external_ai',
    'card': 'exports/blender-rig-test/refs/violet_face_CARD.md',
}
print('FACE_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, f'{NAME}_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
