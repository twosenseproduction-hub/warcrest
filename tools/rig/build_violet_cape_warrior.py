#!/usr/bin/env python3
"""Parts-first build: violet cape warrior from reference card.

Scan → craft each kit piece → assemble (T-pose, face -Y).

  blender -b -noaudio --python tools/rig/build_violet_cape_warrior.py -- \
    --out exports/blender-rig-test
"""
import bpy, math, mathutils, sys, os, json
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a: a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

OUT = argval('--out', os.path.join(os.path.dirname(__file__), '..', '..', 'exports', 'blender-rig-test'))
NAME = argval('--name', 'violet_cape_warrior')
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

# ---- shared palette (from card) ----
M_skin   = mat('vc_skin',   '#8a6bb8', 0.60)
M_skinD  = mat('vc_skinD',  '#5a3f82', 0.70)
M_tattoo = mat('vc_tattoo', '#2ec4b6', 0.45, emit='#3dffd0', estr=0.9)
M_hair   = mat('vc_hair',   '#4a2d7a', 0.78)
M_hairG  = mat('vc_hairG',  '#e8c547', 0.55, metal=0.15)
M_armor  = mat('vc_armor',  '#5a6b3a', 0.42, metal=0.18)
M_armorD = mat('vc_armorD', '#3d4a28', 0.50, metal=0.12)
M_gold   = mat('vc_gold',   '#d4a84b', 0.28, metal=0.88)
M_gem    = mat('vc_gem',    '#c23b3b', 0.22, metal=0.2, emit='#ff4040', estr=0.7)
M_cape   = mat('vc_cape',   '#3b2758', 0.72)
M_lining = mat('vc_lining', '#7a5a9e', 0.65)
M_skirt  = mat('vc_skirt',  '#b8a0d0', 0.70)
M_scarf  = mat('vc_scarf',  '#6b4a9a', 0.68)
M_eye    = mat('vc_eye',    '#b8ff4a', 0.22, emit='#a0ff40', estr=2.2)
M_belt   = mat('vc_belt',   '#4a5c32', 0.50, metal=0.1)
M_ink    = mat('vc_ink',    '#1a1020', 0.9)
M_steel  = mat('vc_steel',  '#6a6e78', 0.35, metal=0.7)

parts = []  # all objects before join

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
    ob = bpy.context.active_object; ob.scale = scale; apply_TRS(ob, scale=True)
    return ob

def add_torus(loc, maj, minr, seg=18, mseg=8):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=mseg,
                                     major_radius=maj, minor_radius=minr, location=loc)
    return bpy.context.active_object

def scale_local(ob, sx, sy, sz):
    ob.scale = (sx, sy, sz); apply_TRS(ob, scale=True)

def rot_euler(ob, rx, ry, rz):
    ob.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    apply_TRS(ob, rot=True)

def limb_x(x0, x1, y, z, r, m, name):
    ob = add_cyl(((x0+x1)*0.5, y, z), r, abs(x1-x0), 12)
    rot_euler(ob, 0, 90, 0)
    return finish(ob, m, name)

def limb_z(x, y, z0, z1, r, m, name):
    return finish(add_cyl((x, y, (z0+z1)*0.5), r, abs(z1-z0), 12), m, name)

# ============================================================
# Assembly contract
# ============================================================
FY = -1
HIP_X = 0.19
LEG_Z = 0.66
TORSO_H = 0.70
SHOULDER_Z = LEG_Z + TORSO_H          # 1.36
HEAD_R = 0.40
HEAD_Z = SHOULDER_Z + 0.44            # 1.80
ARM_Z = SHOULDER_Z

# ============================================================
# PRIORITY 1 — silhouette parts
# ============================================================

# ---- boots / greaves ----
def build_boot(s):
    # shin greave
    limb_z(HIP_X*s, 0.02, 0.06, 0.38, 0.145, M_armor, f'boot_shin_{s}')
    # knee pad + gem
    knee = add_uv((HIP_X*s, FY*0.08, 0.40), 0.12, 12, 8)
    scale_local(knee, 1.15, 0.7, 1.0)
    finish(knee, M_armor, f'knee_{s}')
    finish(add_ico((HIP_X*s, FY*0.18, 0.40), 0.045, 1), M_gem, f'knee_gem_{s}')
    # gold knee bezel
    finish(add_torus((HIP_X*s, FY*0.12, 0.40), 0.07, 0.015), M_gold, f'knee_gold_{s}')
    # foot
    finish(add_cube((HIP_X*s, FY*0.10, 0.05), (0.18, 0.32, 0.10)), M_armorD, f'foot_{s}')
    # gold toe cap
    toe = add_uv((HIP_X*s, FY*0.22, 0.06), 0.08, 10, 6)
    scale_local(toe, 1.1, 0.7, 0.6)
    finish(toe, M_gold, f'toe_{s}')
    # gold cuff at top of greave
    finish(add_torus((HIP_X*s, 0.02, 0.36), 0.14, 0.02), M_gold, f'boot_cuff_{s}')

for s in (-1, 1):
    build_boot(s)

# ---- thighs (body, between skirt and greave) ----
for s in (-1, 1):
    limb_z(HIP_X*s, 0, 0.38, LEG_Z, 0.12, M_skin, f'thigh_{s}')

# ---- hips + skirt strips ----
hips = add_uv((0, 0, LEG_Z), 0.30, 14, 8)
scale_local(hips, 1.2, 0.85, 0.45)
finish(hips, M_skin, 'hips')

for i, ang in enumerate([-50, -25, 0, 25, 50]):
    rad = math.radians(ang)
    x = math.sin(rad) * 0.22
    y = FY * (0.12 + 0.06 * abs(math.cos(rad)))
    strip = add_cube((x, y, LEG_Z - 0.12), (0.07, 0.03, 0.28))
    rot_euler(strip, 12, 0, ang)
    finish(strip, M_skirt, f'skirt_{i}')

# ---- belt + sashes ----
finish(add_torus((0, 0, LEG_Z + 0.06), 0.31, 0.035), M_belt, 'belt')
finish(add_torus((0, 0, LEG_Z + 0.06), 0.33, 0.012), M_gold, 'belt_gold')
# hanging sashes front
for i, x in enumerate([-0.10, 0.0, 0.10]):
    sash = add_cube((x, FY*0.28, LEG_Z - 0.08), (0.05, 0.02, 0.22))
    rot_euler(sash, 8, 0, x*40)
    finish(sash, M_armor if i != 1 else M_gold, f'sash_{i}')

# ---- hip sword (right) ----
scab = add_cube((0.28, FY*0.05, LEG_Z + 0.02), (0.06, 0.08, 0.42))
rot_euler(scab, 0, 0, -18)
finish(scab, M_armorD, 'scabbard')
hilt = add_cyl((0.32, FY*0.05, LEG_Z + 0.28), 0.03, 0.16, 8)
rot_euler(hilt, 0, 0, -18)
finish(hilt, M_steel, 'hilt')
guard = add_cube((0.32, FY*0.05, LEG_Z + 0.22), (0.14, 0.04, 0.04))
finish(guard, M_gold, 'guard')
pommel = add_ico((0.34, FY*0.05, LEG_Z + 0.36), 0.04, 1)
finish(pommel, M_gold, 'pommel')

# ---- torso + tattoos ----
torso = add_uv((0, 0, LEG_Z + TORSO_H*0.45), 0.32, 16, 10)
scale_local(torso, 1.05, 0.78, 1.15)
finish(torso, M_skin, 'torso')
# teal tattoo plates (glow)
for s in (-1, 1):
    tat = add_cube((0.10*s, FY*0.26, LEG_Z + TORSO_H*0.55), (0.10, 0.02, 0.22))
    finish(tat, M_tattoo, f'tattoo_{s}')
    tat2 = add_cube((0.06*s, FY*0.26, LEG_Z + TORSO_H*0.35), (0.08, 0.02, 0.12))
    finish(tat2, M_tattoo, f'tattoo2_{s}')

# neck
limb_z(0, 0, SHOULDER_Z - 0.14, SHOULDER_Z + 0.06, 0.10, M_skin, 'neck')

# ---- scarf / cowl ----
scarf = add_uv((0, 0, SHOULDER_Z - 0.02), 0.20, 14, 8)
scale_local(scarf, 1.25, 1.05, 0.7)
finish(scarf, M_scarf, 'scarf')
scarf2 = add_uv((0, FY*0.08, SHOULDER_Z - 0.08), 0.16, 12, 6)
scale_local(scarf2, 1.3, 0.9, 0.55)
finish(scarf2, M_scarf, 'scarf_layer')

# ---- pauldrons ----
def build_pauldron(s):
    base = add_uv((0.38*s, 0, SHOULDER_Z + 0.04), 0.18, 12, 8)
    scale_local(base, 1.25, 1.0, 0.85)
    finish(base, M_armor, f'pauldron_{s}')
    # layered ridge
    ridge = add_uv((0.42*s, FY*0.04, SHOULDER_Z + 0.12), 0.12, 10, 6)
    scale_local(ridge, 1.2, 0.85, 0.6)
    finish(ridge, M_armorD, f'pauldron_ridge_{s}')
    finish(add_torus((0.38*s, 0, SHOULDER_Z - 0.02), 0.15, 0.022), M_gold, f'pauldron_rim_{s}')
    finish(add_ico((0.42*s, FY*0.02, SHOULDER_Z + 0.18), 0.04, 1), M_gem, f'pauldron_gem_{s}')
    # gold filigree bar
    finish(add_cube((0.40*s, FY*0.10, SHOULDER_Z + 0.06), (0.04, 0.02, 0.14)), M_gold, f'pauldron_fil_{s}')

for s in (-1, 1):
    build_pauldron(s)

# ---- arms T-pose ----
def build_arm(s):
    limb_x(0.40*s, 0.72*s, 0, ARM_Z, 0.095, M_skin, f'upper_arm_{s}')
    limb_x(0.72*s, 1.05*s, 0, ARM_Z, 0.085, M_skin, f'forearm_{s}')
    # bracer
    limb_x(0.78*s, 1.05*s, 0, ARM_Z, 0.11, M_armor, f'bracer_{s}')
    bg = add_torus((0.82*s, 0, ARM_Z), 0.105, 0.018)
    rot_euler(bg, 0, 90, 0)
    finish(bg, M_gold, f'bracer_gold_{s}')
    bg2 = add_torus((1.00*s, 0, ARM_Z), 0.10, 0.015)
    rot_euler(bg2, 0, 90, 0)
    finish(bg2, M_gold, f'bracer_gold2_{s}')
    finish(add_ico((0.92*s, FY*0.08, ARM_Z), 0.035, 1), M_gem, f'bracer_gem_{s}')
    # fist
    hand = add_uv((1.18*s, 0, ARM_Z), 0.11, 10, 7)
    scale_local(hand, 1.15, 0.9, 0.95)
    finish(hand, M_skin, f'hand_{s}')

for s in (-1, 1):
    build_arm(s)

# ---- cape (floor-length, flared — REFINED) ----
# upper cape panel
cape_top = add_cube((0, 0.32, SHOULDER_Z - 0.15), (0.55, 0.08, 0.55))
finish(cape_top, M_cape, 'cape_top')
# mid flare
cape_mid = add_cube((0, 0.36, 0.70), (0.75, 0.07, 0.70))
finish(cape_mid, M_cape, 'cape_mid')
# lower hem — widest
cape_hem = add_cube((0, 0.30, 0.22), (0.95, 0.06, 0.40))
finish(cape_hem, M_cape, 'cape_hem')
# side wing panels
for s in (-1, 1):
    wing = add_cube((0.42*s, 0.28, 0.65), (0.28, 0.05, 1.05))
    rot_euler(wing, 5, 0, s*22)
    finish(wing, M_cape, f'cape_wing_{s}')
# lining at bottom edge
finish(add_cube((0, 0.24, 0.08), (0.92, 0.04, 0.14)), M_lining, 'cape_lining')
# collar / yoke
collar = add_uv((0, 0.22, SHOULDER_Z + 0.02), 0.24, 12, 6)
scale_local(collar, 1.35, 0.65, 0.5)
finish(collar, M_cape, 'cape_collar')
# gold clasp
finish(add_ico((0, FY*0.05, SHOULDER_Z + 0.02), 0.04, 1), M_gold, 'cape_clasp')

# ---- head ----
head = add_uv((0, 0, HEAD_Z), HEAD_R, 20, 12)
scale_local(head, 1.02, 0.95, 1.0)
finish(head, M_skin, 'head')

# face swirl marks
for s in (-1, 1):
    mark = add_uv((0.16*s, FY*0.30, HEAD_Z + 0.08), 0.06, 8, 6)
    scale_local(mark, 1.2, 0.25, 0.8)
    finish(mark, M_skinD, f'face_mark_{s}')
fin = add_uv((0, FY*0.32, HEAD_Z + 0.16), 0.05, 8, 5)
scale_local(fin, 1.4, 0.25, 0.9)
finish(fin, M_skinD, 'forehead_mark')

# eyes
for s in (-1, 1):
    sock = add_uv((0.15*s, FY*0.28, HEAD_Z + 0.04), 0.09, 10, 6)
    scale_local(sock, 1.1, 0.3, 0.75)
    rot_euler(sock, 0, 0, -s*16)
    finish(sock, M_skinD, f'socket_{s}')
    eye = add_uv((0.15*s, FY*0.38, HEAD_Z + 0.04), 0.075, 12, 8)
    scale_local(eye, 0.95, 0.4, 1.4)
    rot_euler(eye, 0, 0, -s*18)
    finish(eye, M_eye, f'eye_{s}')

# mouth hint
mouth = add_uv((0, FY*0.30, HEAD_Z - 0.16), 0.04, 8, 5)
scale_local(mouth, 1.4, 0.35, 0.7)
finish(mouth, M_ink, 'mouth')

# ears — long horizontal pointed (stronger silhouette)
for s in (-1, 1):
    ear = add_cone((HEAD_R*0.75*s, FY*0.02, HEAD_Z + 0.02), 0.10, 0.0, 0.58, seg=7)
    rot_euler(ear, 8, 0, -s*82)
    finish(ear, M_skin, f'ear_{s}')
    inn = add_cone((HEAD_R*0.82*s, FY*0.06, HEAD_Z + 0.02), 0.05, 0.0, 0.40, seg=6)
    rot_euler(inn, 8, 0, -s*82)
    finish(inn, M_skinD, f'ear_inner_{s}')

# ---- hair: spiky purple clumps + gold streaks (REFINED — bigger volume) ----
# crown / back volume — large
hb = add_uv((0, 0.12, HEAD_Z + 0.12), 0.42, 14, 10)
scale_local(hb, 1.2, 0.85, 1.05)
finish(hb, M_hair, 'hair_back')
hb2 = add_uv((0, 0.05, HEAD_Z + 0.28), 0.30, 12, 8)
scale_local(hb2, 1.15, 0.9, 0.85)
finish(hb2, M_hair, 'hair_crown')

# big directional spikes
spikes = [
    # (x, y, z_off, r_base, depth, rx, rz, mat)
    (0.0,  0.10, 0.42, 0.16, 0.48, -5,  0,  M_hair),
    (-0.22, 0.08, 0.38, 0.14, 0.42, -8, -28, M_hair),
    (0.22,  0.08, 0.38, 0.14, 0.42, -8,  28, M_hair),
    (-0.34, 0.02, 0.28, 0.12, 0.36,  5, -48, M_hair),
    (0.34,  0.02, 0.28, 0.12, 0.36,  5,  48, M_hair),
    (-0.18, 0.15, 0.22, 0.10, 0.30, 20, -20, M_hair),
    (0.18,  0.15, 0.22, 0.10, 0.30, 20,  20, M_hair),
    # gold bang streaks (front)
    (-0.12, FY*0.22, 0.30, 0.09, 0.34, 35, -12, M_hairG),
    (0.10,  FY*0.22, 0.28, 0.08, 0.30, 38,  10, M_hairG),
    (0.0,   FY*0.20, 0.36, 0.10, 0.38, 28,   0, M_hairG),
    (-0.22, FY*0.12, 0.24, 0.07, 0.26, 25, -30, M_hairG),
]
for i, (x, y, dz, rb, depth, rx, rz, m) in enumerate(spikes):
    sp = add_cone((x, y, HEAD_Z + dz * 0.35), rb, 0.0, depth, seg=6)
    rot_euler(sp, rx, 0, rz)
    finish(sp, m, f'hair_spike_{i}')

# side locks — thicker
for s in (-1, 1):
    lock = add_cyl((HEAD_R*0.75*s, FY*0.05, HEAD_Z - 0.05), 0.07, 0.50, 8)
    rot_euler(lock, 30, 0, s*12)
    finish(lock, M_hair, f'side_lock_{s}')
    tip = add_cone((HEAD_R*0.82*s, FY*0.08, HEAD_Z - 0.32), 0.06, 0.0, 0.18, seg=5)
    rot_euler(tip, 40, 0, s*15)
    finish(tip, M_hair, f'side_lock_tip_{s}')

# ============================================================
# JOIN + ground
# ============================================================
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
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_apply=True)

coords = [body.matrix_world @ V(c) for c in body.bound_box]
xs=[c.x for c in coords]; ys=[c.y for c in coords]; zs=[c.z for c in coords]
report = {
    'name': NAME,
    'glb': glb,
    'bytes': os.path.getsize(glb),
    'bbox': {'min':[min(xs),min(ys),min(zs)], 'max':[max(xs),max(ys),max(zs)],
             'height': max(zs)-min(zs)},
    'tris': sum(len(p.vertices)-2 for p in body.data.polygons),
    'part_objects_before_join': len(parts),
    'construction': 'parts_first',
}
print('VIOLET_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, NAME + '_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
