#!/usr/bin/env python3
"""1:1 match attempt: violet cape warrior vs user figurine reference.

Dense cages · gold filigree strips · multi-fold cape · designed hair · articulation.
T-pose, face -Y, feet z=0.

  blender -b -noaudio --python tools/rig/build_violet_match.py -- \
    --out exports/blender-rig-test --name violet_cape_warrior
"""
import bpy, math, mathutils, sys, os, json, random
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a: a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

OUT = argval('--out', 'exports/blender-rig-test')
NAME = argval('--name', 'violet_cape_warrior')
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.materials):
    for d in list(blk): blk.remove(d)

def hx(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4))

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

# Palette sampled toward figurine reference
M_skin   = mat('m_skin',   '#6b4a96', 0.62)          # dark lavender-purple matte
M_skinD  = mat('m_skinD',  '#3d2a5c', 0.72)
M_tattoo = mat('m_tattoo', '#2ee6a0', 0.35, emit='#40ffb0', estr=1.2)
M_hair   = mat('m_hair',   '#2d1848', 0.78)
M_hairG  = mat('m_hairG',  '#f2c94c', 0.42, metal=0.22)
M_armor  = mat('m_armor',  '#2f8f3e', 0.40, metal=0.18)  # vibrant forest green
M_armorD = mat('m_armorD', '#1f5f2a', 0.50, metal=0.12)
M_gold   = mat('m_gold',   '#e8b84a', 0.22, metal=0.95)
M_gem    = mat('m_gem',    '#e02040', 0.18, metal=0.1, emit='#ff3050', estr=0.7)
M_cape   = mat('m_cape',   '#2e1a48', 0.74)
M_lining = mat('m_lining', '#8a4a9a', 0.65)           # lighter magenta lining
M_hem    = mat('m_hem',    '#2a9a6a', 0.45, metal=0.08)
M_skirt  = mat('m_skirt',  '#c4a0d8', 0.68)
M_scarf  = mat('m_scarf',  '#4a2a72', 0.66)
M_eye    = mat('m_eye',    '#b8ff28', 0.15, emit='#a0ff20', estr=1.4)
M_belt   = mat('m_belt',   '#2a7a35', 0.48, metal=0.12)
M_ink    = mat('m_ink',    '#140818', 0.9)
M_steel  = mat('m_steel',  '#6a6e78', 0.35, metal=0.75)
M_lip    = mat('m_lip',    '#2a1838', 0.85)
M_tie    = mat('m_tie',    '#3a8a45', 0.55)

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

def add_cyl(loc, r, depth, seg=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=loc)
    return bpy.context.active_object

def add_uv(loc, r, seg=28, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    return bpy.context.active_object

def add_ico(loc, r, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    return bpy.context.active_object

def add_torus(loc, maj, minr, seg=28, mseg=12):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=mseg,
                                     major_radius=maj, minor_radius=minr, location=loc)
    return bpy.context.active_object

def add_cone(loc, r1, r2, depth, seg=9):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2, depth=depth, location=loc)
    return bpy.context.active_object

def scale_local(ob, sx, sy, sz):
    ob.scale = (sx, sy, sz); apply_TRS(ob, scale=True)

def rot_euler(ob, rx, ry, rz):
    ob.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    apply_TRS(ob, rot=True)

def bevel(ob, width=0.018, segments=3, angle=28):
    activate(ob)
    mod = ob.modifiers.new('Bevel', 'BEVEL')
    mod.width = width; mod.segments = segments
    mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(angle)
    bpy.ops.object.modifier_apply(modifier='Bevel')
    return ob

def subdiv(ob, levels=2, simple_first=False):
    activate(ob)
    if simple_first:
        m = ob.modifiers.new('Simple', 'SUBSURF')
        m.subdivision_type = 'SIMPLE'; m.levels = 1; m.render_levels = 1
        bpy.ops.object.modifier_apply(modifier='Simple')
    m = ob.modifiers.new('CC', 'SUBSURF')
    m.subdivision_type = 'CATMULL_CLARK'; m.levels = levels; m.render_levels = levels
    bpy.ops.object.modifier_apply(modifier='CC')
    return ob

def plate(loc, scale, m, name, bw=0.016, lv=1):
    ob = add_cube(loc, scale)
    bevel(ob, bw, 3)
    if lv: subdiv(ob, lv)
    return finish(ob, m, name)

def scroll(loc, scale, name, yaw=0, pitch=0):
    """Raised gold filigree strip."""
    ob = add_cube(loc, scale)
    bevel(ob, min(scale)*0.35, 2)
    rot_euler(ob, pitch, 0, yaw)
    return finish(ob, M_gold, name)

def vine(pts, r, name):
    """Chain of small tattoo blobs along a path (pts list of xyz)."""
    for i, (x, y, z) in enumerate(pts):
        ob = add_uv((x, y, z), r * (0.85 + 0.15 * (i % 3)), 10, 6)
        scale_local(ob, 1.2, 0.35, 1.0)
        finish(ob, M_tattoo, f'{name}_{i}')

# Assembly
FY = -1.0
HIP_X = 0.15
LEG_Z = 0.52
TORSO_H = 0.62
SHOULDER_Z = LEG_Z + TORSO_H
HEAD_R = 0.48          # bigger chibi head (figurine)
HEAD_Z = SHOULDER_Z + 0.55
ARM_Z = SHOULDER_Z + 0.01
SHOULDER_W = 0.48       # wider pauldrons

# ===================== BOOTS / GREAVES =====================
def build_boot(s):
    # layered shin plates — chunky figurine greaves
    plate((HIP_X*s, FY*0.12, 0.26), (0.14, 0.12, 0.28), M_armor, f'shin_a_{s}', 0.022, 1)
    plate((HIP_X*s, FY*0.02, 0.24), (0.16, 0.14, 0.24), M_armorD, f'shin_b_{s}', 0.02, 1)
    # gold filigree scrolls on shin
    scroll((HIP_X*s, FY*0.17, 0.30), (0.02, 0.015, 0.10), f'scroll_s0_{s}', yaw=s*8)
    scroll((HIP_X*s*1.05, FY*0.17, 0.24), (0.08, 0.012, 0.02), f'scroll_s1_{s}', yaw=s*5)
    scroll((HIP_X*s, FY*0.17, 0.18), (0.025, 0.012, 0.06), f'scroll_s2_{s}', yaw=-s*10)
    scroll((HIP_X*s*0.9, FY*0.17, 0.22), (0.05, 0.01, 0.015), f'scroll_s3_{s}')
    # knee cup + ruby
    knee = add_cube((HIP_X*s, FY*0.12, 0.40), (0.115, 0.10, 0.11))
    bevel(knee, 0.035, 3); subdiv(knee, 1)
    finish(knee, M_armor, f'knee_{s}')
    finish(add_torus((HIP_X*s, FY*0.14, 0.40), 0.07, 0.012), M_gold, f'knee_rim_{s}')
    finish(add_ico((HIP_X*s, FY*0.22, 0.40), 0.042, 2), M_gem, f'knee_gem_{s}')
    # articulation ring
    gap = add_torus((HIP_X*s, 0.02, 0.36), 0.12, 0.014)
    finish(gap, M_skinD, f'knee_joint_{s}')
    # foot
    plate((HIP_X*s, FY*0.12, 0.045), (0.13, 0.26, 0.065), M_armorD, f'foot_{s}', 0.018, 1)
    plate((HIP_X*s, FY*0.24, 0.05), (0.09, 0.10, 0.05), M_gold, f'toe_{s}', 0.012, 1)
    finish(add_torus((HIP_X*s, 0.02, 0.34), 0.135, 0.015), M_gold, f'cuff_{s}')

for s in (-1, 1):
    build_boot(s)

# thighs
for s in (-1, 1):
    th = add_cyl((HIP_X*s, 0, 0.48), 0.105, 0.20, 22)
    bevel(th, 0.018, 2); subdiv(th, 1)
    finish(th, M_skin, f'thigh_{s}')

# hips
hips = add_uv((0, 0, LEG_Z), 0.26, 30, 16)
scale_local(hips, 1.28, 0.88, 0.40)
subdiv(hips, 1)
finish(hips, M_skin, 'hips')

# loincloth strips (tattered lavender)
for i, ang in enumerate([-58, -30, -8, 12, 35, 58]):
    rad = math.radians(ang)
    x = math.sin(rad) * 0.18
    y = FY * (0.14 + 0.03 * abs(math.cos(rad)))
    h = 0.26 + 0.04 * (i % 3)
    strip = add_cube((x, y, LEG_Z - 0.12), (0.045 + 0.01*(i%2), 0.018, h))
    bevel(strip, 0.01, 2); subdiv(strip, 1)
    rot_euler(strip, 16, 0, ang)
    finish(strip, M_skirt, f'skirt_{i}')

# belt + gold + fabric knot tie
finish(add_torus((0, 0, LEG_Z + 0.05), 0.29, 0.038, 32, 12), M_belt, 'belt')
finish(add_torus((0, 0, LEG_Z + 0.05), 0.318, 0.012, 32, 10), M_gold, 'belt_gold')
# knotted fabric tie (front)
plate((0.0, FY*0.28, LEG_Z + 0.02), (0.07, 0.04, 0.08), M_tie, 'tie_knot', 0.015, 1)
for i, x in enumerate([-0.06, 0.06]):
    plate((x, FY*0.30, LEG_Z - 0.08), (0.035, 0.02, 0.18), M_tie, f'tie_tail_{i}', 0.01, 1)
for i, x in enumerate([-0.12, 0.0, 0.12]):
    plate((x, FY*0.26, LEG_Z - 0.05), (0.04, 0.015, 0.16), M_armor if i != 1 else M_gold, f'sash_{i}', 0.01, 1)

# scabbard left hip (+X)
sc = plate((0.28, FY*0.04, LEG_Z + 0.0), (0.048, 0.06, 0.38), M_armorD, 'scabbard', 0.012, 1)
rot_euler(sc, 0, 0, -18)
finish(add_cyl((0.32, FY*0.04, LEG_Z + 0.24), 0.024, 0.13, 12), M_steel, 'hilt')
plate((0.32, FY*0.04, LEG_Z + 0.18), (0.10, 0.028, 0.028), M_gold, 'guard', 0.008, 0)
finish(add_ico((0.34, FY*0.04, LEG_Z + 0.32), 0.03, 2), M_gold, 'pommel')

# ===================== TORSO =====================
chest = add_uv((0, FY*0.02, LEG_Z + TORSO_H*0.55), 0.27, 32, 18)
scale_local(chest, 1.05, 0.68, 1.05)  # leaner
subdiv(chest, 1)
finish(chest, M_skin, 'chest')
belly = add_uv((0, 0, LEG_Z + TORSO_H*0.28), 0.23, 28, 16)
scale_local(belly, 1.0, 0.65, 0.8)
subdiv(belly, 1)
finish(belly, M_skin, 'belly')

# vine chest tattoos (more organic path)
for s in (-1, 1):
    vine([
        (0.04*s, FY*0.24, LEG_Z + TORSO_H*0.70),
        (0.08*s, FY*0.245, LEG_Z + TORSO_H*0.60),
        (0.10*s, FY*0.245, LEG_Z + TORSO_H*0.50),
        (0.07*s, FY*0.24, LEG_Z + TORSO_H*0.40),
        (0.11*s, FY*0.24, LEG_Z + TORSO_H*0.32),
        (0.05*s, FY*0.24, LEG_Z + TORSO_H*0.45),
        (0.13*s, FY*0.24, LEG_Z + TORSO_H*0.55),
    ], 0.028, f'chest_vine_{s}')

neck = add_cyl((0, 0, SHOULDER_Z - 0.02), 0.09, 0.16, 22)
bevel(neck, 0.012, 2); subdiv(neck, 1)
finish(neck, M_skin, 'neck')

# cowl / scarf layered
scarf = add_uv((0, FY*0.02, SHOULDER_Z), 0.185, 28, 14)
scale_local(scarf, 1.4, 1.2, 0.5)
subdiv(scarf, 1)
finish(scarf, M_scarf, 'cowl')
scarf2 = add_uv((0, FY*0.08, SHOULDER_Z - 0.06), 0.16, 24, 12)
scale_local(scarf2, 1.45, 1.0, 0.4)
finish(scarf2, M_scarf, 'cowl2')
plate((0, FY*0.18, SHOULDER_Z - 0.02), (0.11, 0.05, 0.08), M_scarf, 'cowl_knot', 0.018, 1)

# ===================== PAULDRONS =====================
def build_pauldron(s):
    # wide cup like figurine (overhangs arm)
    for i, (ox, oy, oz, sc, m) in enumerate([
        (0.46, 0.02, 0.06, (0.24, 0.18, 0.15), M_armor),
        (0.50, 0.05, 0.14, (0.16, 0.14, 0.08), M_armorD),
        (0.44, 0.02, -0.02, (0.18, 0.15, 0.055), M_armorD),
    ]):
        plate((ox*s, FY*oy, SHOULDER_Z + oz), sc, m, f'pauldron_{s}_{i}', 0.035, 1)
    finish(add_torus((0.48*s, 0, SHOULDER_Z + 0.02), 0.155, 0.02), M_gold, f'pauldron_rim_{s}')
    for i, (ox, oz, sx, sz, yaw) in enumerate([
        (0.0, 0.08, 0.025, 0.10, s*5),
        (0.06, 0.06, 0.09, 0.02, s*18),
        (-0.05, 0.11, 0.08, 0.018, -s*22),
        (0.03, 0.04, 0.018, 0.06, s*28),
        (0.07, 0.10, 0.05, 0.014, 0),
        (-0.03, 0.07, 0.06, 0.014, s*12),
        (0.04, 0.09, 0.03, 0.04, -s*8),
    ]):
        scroll((0.50*s + ox*s, FY*0.16, SHOULDER_Z + oz), (sx, 0.013, sz), f'pfil_{s}_{i}', yaw=yaw)
    finish(add_torus((0.54*s, FY*0.02, SHOULDER_Z + 0.20), 0.038, 0.011), M_gold, f'gem_bez_{s}')
    finish(add_ico((0.54*s, FY*0.02, SHOULDER_Z + 0.20), 0.042, 2), M_gem, f'pgem_{s}')
    gap = add_torus((0.30*s, 0, SHOULDER_Z), 0.085, 0.014)
    rot_euler(gap, 0, 90, 0)
    finish(gap, M_skinD, f'shoulder_joint_{s}')

for s in (-1, 1):
    build_pauldron(s)

# ===================== ARMS =====================
def build_arm(s):
    for i, (x0, x1, r) in enumerate([(0.48, 0.74, 0.095), (0.76, 1.05, 0.082)]):
        arm = add_cyl(((x0+x1)*0.5*s, 0, ARM_Z), r, abs(x1-x0), 22)
        rot_euler(arm, 0, 90, 0)
        bevel(arm, 0.014, 2); subdiv(arm, 1)
        finish(arm, M_skin, f'arm_{s}_{i}')
    gap = add_torus((0.76*s, 0, ARM_Z), 0.07, 0.012)
    rot_euler(gap, 0, 90, 0)
    finish(gap, M_skinD, f'elbow_{s}')
    br = add_cube((0.94*s, 0, ARM_Z), (0.22, 0.12, 0.12))
    bevel(br, 0.026, 3); subdiv(br, 1)
    finish(br, M_armor, f'bracer_{s}')
    plate((0.94*s, FY*0.03, ARM_Z), (0.14, 0.055, 0.075), M_armorD, f'bracer_in_{s}', 0.01, 1)
    for bx in (0.84, 1.04):
        band = add_torus((bx*s, 0, ARM_Z), 0.11, 0.014, 22, 8)
        rot_euler(band, 0, 90, 0)
        finish(band, M_gold, f'bband_{bx}_{s}')
    scroll((0.94*s, FY*0.11, ARM_Z + 0.02), (0.07, 0.013, 0.016), f'bfil0_{s}')
    scroll((0.94*s, FY*0.11, ARM_Z - 0.02), (0.022, 0.013, 0.055), f'bfil1_{s}', yaw=s*10)
    finish(add_ico((0.94*s, FY*0.13, ARM_Z), 0.038, 2), M_gold, f'medal_{s}')
    finish(add_ico((0.94*s, FY*0.17, ARM_Z), 0.022, 2), M_gem, f'bgem_{s}')
    hand = add_uv((1.22*s, 0, ARM_Z), 0.10, 20, 12)
    scale_local(hand, 1.25, 0.85, 0.95)
    subdiv(hand, 1)
    finish(hand, M_skin, f'hand_{s}')
    for k in range(4):
        finish(add_uv((1.30*s, FY*(0.02+k*0.015), ARM_Z + 0.03 - k*0.025), 0.026, 8, 5), M_skinD, f'kn_{s}_{k}')

for s in (-1, 1):
    build_arm(s)

# ===================== CAPE (folds + lining + hem) =====================
def build_cape():
    # Hard-surface cape panels (NO sphere droplets) — figurine floor flare + folds
    panels = [
        # x, y, z, sx, sy, sz, yaw, pitch
        (0.0, 0.30, SHOULDER_Z - 0.08, 0.58, 0.06, 0.28, 0, 8),   # yoke
        (0.0, 0.34, 0.85, 0.70, 0.055, 0.50, 0, 6),                # upper back
        (0.0, 0.36, 0.50, 0.95, 0.055, 0.65, 0, 5),                # mid
        (0.0, 0.34, 0.18, 1.25, 0.05, 0.38, 0, 8),                 # floor flare
        (-0.42, 0.32, 0.55, 0.42, 0.05, 0.95, 20, 6),
        (0.42, 0.32, 0.55, 0.42, 0.05, 0.95, -20, 6),
        (-0.62, 0.30, 0.28, 0.38, 0.045, 0.50, 30, 10),
        (0.62, 0.30, 0.28, 0.38, 0.045, 0.50, -30, 10),
    ]
    for i, (x, y, z, sx, sy, sz, yaw, pitch) in enumerate(panels):
        p = plate((x, y, z), (sx, sy, sz), M_cape, f'cape_p_{i}', 0.016, 1)
        rot_euler(p, pitch, 0, yaw)
    # fold ridges (thin vertical plates)
    for i, x in enumerate([-0.50, -0.25, 0.0, 0.25, 0.50]):
        ridge = plate((x, 0.39, 0.55), (0.045, 0.04, 1.05), M_cape, f'fold_{i}', 0.012, 1)
        rot_euler(ridge, 5, 0, (1 if x >= 0 else -1) * min(abs(x) * 25, 18))
    for i, (x, yaw, w) in enumerate([(-0.4, 16, 0.55), (0.0, 0, 0.80), (0.4, -16, 0.55)]):
        lin = plate((x, 0.25, 0.42), (w, 0.03, 0.88), M_lining, f'lining_{i}', 0.01, 1)
        rot_euler(lin, 7, 0, yaw)
    for i, (x, yaw) in enumerate([(-0.70, 32), (-0.35, 14), (0.0, 0), (0.35, -14), (0.70, -32)]):
        hem = plate((x, 0.30, 0.05), (0.34, 0.045, 0.10), M_hem, f'hem_{i}', 0.01, 1)
        rot_euler(hem, 10, 0, yaw)
        finish(add_ico((x, 0.34, 0.07), 0.022, 1), M_gold, f'hem_d_{i}')
        scroll((x, 0.33, 0.04), (0.08, 0.012, 0.016), f'hem_g_{i}')
    finish(add_ico((0, FY*0.02, SHOULDER_Z + 0.05), 0.045, 2), M_gold, 'clasp')

build_cape()

# ===================== HEAD =====================
def build_head():
    # organic chibi head (high-seg sphere — not cube faceplate)
    cr = add_uv((0, 0, HEAD_Z), HEAD_R, 40, 24)
    scale_local(cr, 1.05, 0.98, 1.02)
    subdiv(cr, 1)
    finish(cr, M_skin, 'head')
    # soft jaw / chin
    jaw = add_uv((0, FY*0.08, HEAD_Z - HEAD_R*0.45), HEAD_R*0.72, 28, 16)
    scale_local(jaw, 1.05, 0.78, 0.75)
    subdiv(jaw, 1)
    finish(jaw, M_skin, 'jaw')
    for s in (-1, 1):
        cheek = add_uv((0.24*s, FY*0.22, HEAD_Z - 0.02), 0.14, 18, 10)
        scale_local(cheek, 0.9, 0.7, 1.0)
        finish(cheek, M_skin, f'cheek_{s}')
    for s in (-1, 1):
        sock = add_uv((0.16*s, FY*0.32, HEAD_Z + 0.07), 0.11, 18, 12)
        scale_local(sock, 1.15, 0.26, 0.75)
        rot_euler(sock, 0, 0, -s*14)
        finish(sock, M_skinD, f'socket_{s}')
        eye = add_uv((0.16*s, FY*0.42, HEAD_Z + 0.07), 0.085, 20, 12)
        scale_local(eye, 0.95, 0.30, 1.5)
        rot_euler(eye, 0, 0, -s*16)
        finish(eye, M_eye, f'eye_{s}')
        # brow ridge soft
        brow = add_uv((0.14*s, FY*0.34, HEAD_Z + 0.16), 0.06, 12, 8)
        scale_local(brow, 1.4, 0.4, 0.5)
        finish(brow, M_skinD, f'brow_{s}')
    for s in (-1, 1):
        vine([
            (0.08*s, FY*0.38, HEAD_Z + 0.20),
            (0.14*s, FY*0.38, HEAD_Z + 0.12),
            (0.18*s, FY*0.38, HEAD_Z + 0.04),
            (0.16*s, FY*0.38, HEAD_Z - 0.04),
            (0.10*s, FY*0.38, HEAD_Z + 0.08),
            (0.20*s, FY*0.36, HEAD_Z + 0.00),
        ], 0.024, f'face_vine_{s}')
    mouth = add_uv((0, FY*0.34, HEAD_Z - 0.20), 0.045, 14, 8)
    scale_local(mouth, 1.6, 0.28, 0.5)
    finish(mouth, M_lip, 'mouth')
    nose = add_uv((0, FY*0.38, HEAD_Z - 0.02), 0.035, 12, 8)
    scale_local(nose, 0.8, 1.1, 1.0)
    finish(nose, M_skinD, 'nose')
    for s in (-1, 1):
        ear = add_cone((HEAD_R*0.78*s, FY*0.05, HEAD_Z + 0.02), 0.12, 0.0, 0.78, seg=9)
        rot_euler(ear, 5, 0, -s*90)
        bevel(ear, 0.012, 1)
        finish(ear, M_skin, f'ear_{s}')
        inn = add_cone((HEAD_R*0.88*s, FY*0.12, HEAD_Z + 0.02), 0.055, 0.0, 0.52, seg=7)
        rot_euler(inn, 5, 0, -s*90)
        finish(inn, M_skinD, f'ear_in_{s}')

build_head()

# ===================== HAIR =====================
hb = add_uv((0, 0.14, HEAD_Z + 0.16), 0.44, 28, 16)
scale_local(hb, 1.22, 0.88, 1.08)
subdiv(hb, 1)
finish(hb, M_hair, 'hair_crown')
hb2 = add_uv((0, 0.10, HEAD_Z + 0.34), 0.30, 22, 12)
scale_local(hb2, 1.15, 0.9, 0.85)
finish(hb2, M_hair, 'hair_top')

# hair: tall but not so tall it shrinks body in frame (figurine ~head+spikes)
purple = []
for ang in range(-75, 80, 12):
    rad = math.radians(ang)
    purple.append((math.sin(rad)*0.30, 0.10+0.06*math.cos(rad), 0.38+0.08*math.cos(rad*0.5),
                   0.10+0.03*abs(math.cos(rad)), 0.38+0.10*abs(math.cos(rad)), -10, ang))
purple += [
    (0.0, 0.18, 0.48, 0.15, 0.52, -12, 0),
    (-0.16, 0.16, 0.42, 0.12, 0.46, -8, -18),
    (0.16, 0.16, 0.42, 0.12, 0.46, -8, 18),
    (-0.38, 0.02, 0.26, 0.10, 0.34, 6, -52),
    (0.38, 0.02, 0.26, 0.10, 0.34, 6, 52),
]
for i, (x, y, dz, rb, depth, rx, rz) in enumerate(purple):
    sp = add_cone((x, y, HEAD_Z + dz*0.25), rb, 0.006, depth, seg=8)
    rot_euler(sp, rx, 0, rz)
    bevel(sp, 0.006, 1)
    finish(sp, M_hair, f'hair_{i}')

# gold streaks — character RIGHT = -X
gold = [
    (-0.10, FY*0.20, 0.36, 0.09, 0.40, 26, -5),
    (-0.22, FY*0.14, 0.30, 0.08, 0.36, 24, -24),
    (-0.04, FY*0.22, 0.42, 0.10, 0.44, 24, 2),
    (-0.30, FY*0.06, 0.24, 0.07, 0.30, 16, -40),
    (-0.16, FY*0.12, 0.20, 0.07, 0.26, 30, -14),
    (-0.08, FY*0.18, 0.28, 0.08, 0.32, 28, -8),
    (-0.26, FY*0.16, 0.34, 0.07, 0.32, 22, -20),
]
for i, (x, y, dz, rb, depth, rx, rz) in enumerate(gold):
    sp = add_cone((x, y, HEAD_Z + dz*0.25), rb, 0.006, depth, seg=8)
    rot_euler(sp, rx, 0, rz)
    finish(sp, M_hairG, f'gold_{i}')

for s in (-1, 1):
    lock = add_cyl((HEAD_R*0.80*s, FY*0.05, HEAD_Z - 0.14), 0.068, 0.58, 12)
    rot_euler(lock, 32, 0, s*14)
    bevel(lock, 0.01, 1); subdiv(lock, 1)
    finish(lock, M_hair, f'lock_{s}')
    tip = add_cone((HEAD_R*0.88*s, FY*0.10, HEAD_Z - 0.44), 0.055, 0.0, 0.18, seg=6)
    rot_euler(tip, 40, 0, s*16)
    finish(tip, M_hair, f'lock_tip_{s}')

# JOIN + ground
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
    'name': NAME, 'glb': glb, 'bytes': os.path.getsize(glb),
    'bbox': {'min':[min(xs),min(ys),min(zs)], 'max':[max(xs),max(ys),max(zs)], 'height': max(zs)-min(zs)},
    'tris': sum(len(p.vertices)-2 for p in body.data.polygons),
    'parts_before_join': len(parts),
    'construction': '1to1_match_iter33',
    'target': 'user figurine reference — sharp chibi warrior',
}
print('MATCH_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, NAME + '_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
