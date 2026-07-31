#!/usr/bin/env python3
"""Dense Meshy-inspired white→color character build (owned — no Meshy API).

Cage → bevel → subdiv → panel detail. Flat materials after clay-ready form.

  blender -b -noaudio --python tools/rig/build_violet_dense.py -- \
    --out exports/blender-rig-test --name violet_cape_warrior
"""
import bpy, math, mathutils, sys, os, json
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a: a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

OUT = argval('--out', os.path.join(os.path.dirname(__file__), '..', '..', 'exports', 'blender-rig-test'))
NAME = argval('--name', 'violet_cape_warrior')
WHITE = argval('--white', '0') == '1'  # clay-only materials
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.materials):
    for d in list(blk): blk.remove(d)

def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))

def mat(name, hexcol, rough=0.55, metal=0.0, emit=None, estr=0.0):
    if WHITE:
        hexcol = '#9a9aa0'
        emit, estr, metal = None, 0.0, 0.0
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*hx(hexcol), 1)
    b.inputs['Roughness'].default_value = rough
    try: b.inputs['Metallic'].default_value = metal
    except: pass
    if emit is not None and not WHITE:
        try: b.inputs['Emission Color'].default_value = (*hx(emit), 1)
        except: b.inputs['Emission'].default_value = (*hx(emit), 1)
        b.inputs['Emission Strength'].default_value = estr
    return m

M_skin   = mat('d_skin',   '#7a58a8', 0.58)
M_skinD  = mat('d_skinD',  '#4a326e', 0.68)
M_tattoo = mat('d_tattoo', '#3dff7a', 0.40, emit='#5dff9a', estr=0.9)
M_hair   = mat('d_hair',   '#3a1f66', 0.75)
M_hairG  = mat('d_hairG',  '#f0c93a', 0.45, metal=0.2)
M_armor  = mat('d_armor',  '#3f9e4a', 0.38, metal=0.2)
M_armorD = mat('d_armorD', '#2a6b32', 0.48, metal=0.15)
M_gold   = mat('d_gold',   '#e0b045', 0.24, metal=0.92)
M_gem    = mat('d_gem',    '#d43535', 0.2, metal=0.15, emit='#ff4040', estr=0.6)
M_cape   = mat('d_cape',   '#3a2458', 0.72)
M_lining = mat('d_lining', '#2a1838', 0.8)
M_hem    = mat('d_hem',    '#2e7a38', 0.48, metal=0.1)
M_skirt  = mat('d_skirt',  '#b89ad0', 0.68)
M_scarf  = mat('d_scarf',  '#5a3a88', 0.65)
M_eye    = mat('d_eye',    '#b8ff3a', 0.2, emit='#a0ff30', estr=1.0)
M_belt   = mat('d_belt',   '#357a3c', 0.48, metal=0.1)
M_ink    = mat('d_ink',    '#1a1020', 0.9)
M_steel  = mat('d_steel',  '#6a6e78', 0.35, metal=0.7)
M_lip    = mat('d_lip',    '#2a1838', 0.85)

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

def add_cyl(loc, r, depth, seg=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=loc)
    return bpy.context.active_object

def add_uv(loc, r, seg=24, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    return bpy.context.active_object

def add_ico(loc, r, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    return bpy.context.active_object

def add_torus(loc, maj, minr, seg=24, mseg=10):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=mseg,
                                     major_radius=maj, minor_radius=minr, location=loc)
    return bpy.context.active_object

def add_cone(loc, r1, r2, depth, seg=8):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2, depth=depth, location=loc)
    return bpy.context.active_object

def add_grid(loc, sx, sy, xu=16, yv=20):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=xu, y_subdivisions=yv, size=1, location=loc)
    ob = bpy.context.active_object
    ob.scale = (sx, sy, 1)
    apply_TRS(ob, scale=True)
    return ob

def scale_local(ob, sx, sy, sz):
    ob.scale = (sx, sy, sz); apply_TRS(ob, scale=True)

def rot_euler(ob, rx, ry, rz):
    ob.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    apply_TRS(ob, rot=True)

def bevel(ob, width=0.02, segments=3, angle=30):
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

def solidify(ob, thickness=0.04):
    activate(ob)
    m = ob.modifiers.new('Solid', 'SOLIDIFY')
    m.thickness = thickness; m.offset = 0.0
    bpy.ops.object.modifier_apply(modifier='Solid')
    return ob

def loopcut_density(ob, cuts=2):
    """Add lengthwise density via subdiv simple — safer headless than edit biped ops."""
    return subdiv(ob, levels=1, simple_first=True)

def plate(loc, scale, m, name, bevel_w=0.018, levels=1):
    ob = add_cube(loc, scale)
    bevel(ob, width=bevel_w, segments=3)
    if levels:
        subdiv(ob, levels=levels)
    return finish(ob, m, name)

def inset_plate(loc, scale, m, name):
    """Main plate + recessed panel (edge language)."""
    body = add_cube(loc, scale)
    bevel(body, 0.02, 3)
    subdiv(body, 1)
    finish(body, m, name + '_body')
    inn = add_cube((loc[0], loc[1] - 0.01, loc[2]), (scale[0]*0.72, scale[1]*0.5, scale[2]*0.72))
    bevel(inn, 0.012, 2)
    finish(inn, M_armorD if m != M_gold else M_gold, name + '_inset')
    return body

# ============================================================
FY = -1
HIP_X = 0.17
LEG_Z = 0.60
TORSO_H = 0.70
SHOULDER_Z = LEG_Z + TORSO_H
HEAD_R = 0.40
HEAD_Z = SHOULDER_Z + 0.50
ARM_Z = SHOULDER_Z + 0.02

# ---- greaves: dense plates ----
def build_boot(s):
    inset_plate((HIP_X*s, FY*0.10, 0.26), (0.13, 0.11, 0.26), M_armor, f'shin_{s}')
    # side wraps
    plate((HIP_X*s, 0.02, 0.24), (0.15, 0.12, 0.22), M_armorD, f'shin_side_{s}', 0.016, 1)
    # gold scroll strips (thin extruded language)
    for i, z in enumerate((0.32, 0.24, 0.18)):
        plate((HIP_X*s, FY*0.16, z), (0.03 + 0.02*(i%2), 0.02, 0.035), M_gold, f'scroll_{s}_{i}', 0.008, 0)
    # knee cup dense
    knee = add_cube((HIP_X*s, FY*0.11, 0.42), (0.12, 0.10, 0.11))
    bevel(knee, 0.035, 3); subdiv(knee, 1)
    finish(knee, M_armor, f'knee_{s}')
    finish(add_torus((HIP_X*s, FY*0.13, 0.42), 0.075, 0.012), M_gold, f'knee_rim_{s}')
    finish(add_ico((HIP_X*s, FY*0.20, 0.42), 0.038, 2), M_gem, f'knee_gem_{s}')
    plate((HIP_X*s, FY*0.12, 0.05), (0.14, 0.26, 0.07), M_armorD, f'foot_{s}', 0.02, 1)
    plate((HIP_X*s, FY*0.24, 0.055), (0.10, 0.10, 0.055), M_gold, f'toe_{s}', 0.015, 1)
    finish(add_torus((HIP_X*s, 0.02, 0.36), 0.14, 0.016), M_gold, f'cuff_{s}')

for s in (-1, 1):
    build_boot(s)

# thighs — dense cylinders
for s in (-1, 1):
    th = add_cyl((HIP_X*s, 0, 0.50), 0.11, 0.22, 20)
    bevel(th, 0.02, 2); subdiv(th, 1)
    finish(th, M_skin, f'thigh_{s}')

hips = add_uv((0, 0, LEG_Z), 0.27, 28, 16)
scale_local(hips, 1.25, 0.88, 0.42)
subdiv(hips, 1)
finish(hips, M_skin, 'hips')

# skirt strips — solidified thin plates
for i, ang in enumerate([-55, -28, 0, 28, 55]):
    rad = math.radians(ang)
    x = math.sin(rad) * 0.20
    y = FY * (0.12 + 0.04 * abs(math.cos(rad)))
    strip = add_cube((x, y, LEG_Z - 0.14), (0.055, 0.02, 0.30))
    bevel(strip, 0.012, 2); subdiv(strip, 1)
    rot_euler(strip, 14, 0, ang)
    finish(strip, M_skirt, f'skirt_{i}')

finish(add_torus((0, 0, LEG_Z + 0.05), 0.30, 0.036, 28, 12), M_belt, 'belt')
finish(add_torus((0, 0, LEG_Z + 0.05), 0.325, 0.012, 28, 10), M_gold, 'belt_gold')
for i, x in enumerate([-0.10, 0.0, 0.10]):
    sash = plate((x, FY*0.26, LEG_Z - 0.06), (0.04, 0.016, 0.20), M_armor if i != 1 else M_gold, f'sash_{i}', 0.01, 1)
    rot_euler(sash, 10, 0, x * 35)

# scabbard
plate((0.30, FY*0.04, LEG_Z + 0.02), (0.05, 0.065, 0.40), M_armorD, 'scabbard', 0.014, 1)
rot_euler(parts[-1], 0, 0, -16)
finish(add_cyl((0.34, FY*0.04, LEG_Z + 0.26), 0.026, 0.14, 12), M_steel, 'hilt')
plate((0.34, FY*0.04, LEG_Z + 0.20), (0.11, 0.03, 0.03), M_gold, 'guard', 0.008, 0)
finish(add_ico((0.36, FY*0.04, LEG_Z + 0.34), 0.032, 2), M_gold, 'pommel')

# torso — dense organic from sphere + subdiv (scaffold then reshape with plates)
chest = add_uv((0, FY*0.02, LEG_Z + TORSO_H*0.55), 0.29, 32, 18)
scale_local(chest, 1.1, 0.72, 0.95)
subdiv(chest, 1)
finish(chest, M_skin, 'chest')
belly = add_uv((0, 0, LEG_Z + TORSO_H*0.28), 0.25, 28, 16)
scale_local(belly, 1.05, 0.70, 0.75)
subdiv(belly, 1)
finish(belly, M_skin, 'belly')

for s in (-1, 1):
    for j, (dz, sx, sz) in enumerate([(0.58, 0.085, 0.18), (0.42, 0.065, 0.11), (0.50, 0.045, 0.07)]):
        tat = add_cube((0.09*s, FY*0.245, LEG_Z + TORSO_H*dz), (sx, 0.016, sz))
        bevel(tat, 0.008, 2)
        rot_euler(tat, 0, 0, s*(8+j*6))
        finish(tat, M_tattoo, f'tat_{s}_{j}')

neck = add_cyl((0, 0, SHOULDER_Z - 0.02), 0.095, 0.18, 20)
bevel(neck, 0.015, 2); subdiv(neck, 1)
finish(neck, M_skin, 'neck')

# scarf dense
scarf = add_uv((0, FY*0.02, SHOULDER_Z), 0.19, 28, 14)
scale_local(scarf, 1.35, 1.15, 0.55)
subdiv(scarf, 1)
finish(scarf, M_scarf, 'scarf')
plate((0, FY*0.16, SHOULDER_Z - 0.04), (0.12, 0.055, 0.09), M_scarf, 'scarf_knot', 0.02, 1)

# pauldrons dense layered
def build_pauldron(s):
    cup = add_cube((0.40*s, FY*0.02, SHOULDER_Z + 0.06), (0.19, 0.15, 0.13))
    bevel(cup, 0.04, 3); subdiv(cup, 1)
    finish(cup, M_armor, f'pauldron_{s}')
    plate((0.42*s, FY*0.04, SHOULDER_Z + 0.14), (0.13, 0.11, 0.06), M_armorD, f'pauldron_ridge_{s}', 0.025, 1)
    plate((0.38*s, FY*0.02, SHOULDER_Z - 0.02), (0.15, 0.13, 0.045), M_armorD, f'pauldron_lip_{s}', 0.015, 1)
    finish(add_torus((0.40*s, 0, SHOULDER_Z + 0.02), 0.13, 0.018, 24, 10), M_gold, f'pauldron_rim_{s}')
    # filigree as multiple thin plates (edge language)
    for i, (ox, oz, sx, sz) in enumerate([(0.0, 0.08, 0.025, 0.10), (0.04, 0.06, 0.07, 0.02), (-0.03, 0.10, 0.05, 0.02)]):
        plate((0.42*s + ox*s, FY*0.13, SHOULDER_Z + oz), (sx, 0.012, sz), M_gold, f'fil_{s}_{i}', 0.006, 0)
    finish(add_torus((0.44*s, FY*0.02, SHOULDER_Z + 0.18), 0.032, 0.009), M_gold, f'gem_bez_{s}')
    finish(add_ico((0.44*s, FY*0.02, SHOULDER_Z + 0.18), 0.036, 2), M_gem, f'gem_{s}')
    gap = add_torus((0.28*s, 0, SHOULDER_Z), 0.085, 0.016)
    rot_euler(gap, 0, 90, 0)
    finish(gap, M_skinD, f'shoulder_joint_{s}')

for s in (-1, 1):
    build_pauldron(s)

def build_arm(s):
    for i, (x0, x1, r) in enumerate([(0.42, 0.68, 0.095), (0.70, 0.98, 0.082)]):
        arm = add_cyl(((x0+x1)*0.5*s, 0, ARM_Z), r, abs(x1-x0), 20)
        rot_euler(arm, 0, 90, 0)
        bevel(arm, 0.015, 2); subdiv(arm, 1)
        finish(arm, M_skin, f'arm_{s}_{i}')
    gap = add_torus((0.70*s, 0, ARM_Z), 0.07, 0.012)
    rot_euler(gap, 0, 90, 0)
    finish(gap, M_skinD, f'elbow_{s}')
    # bracer dense shell
    br = add_cube((0.88*s, 0, ARM_Z), (0.20, 0.115, 0.115))
    bevel(br, 0.025, 3); subdiv(br, 1)
    finish(br, M_armor, f'bracer_{s}')
    inn = add_cube((0.88*s, FY*0.02, ARM_Z), (0.14, 0.06, 0.08))
    bevel(inn, 0.01, 2)
    finish(inn, M_armorD, f'bracer_inset_{s}')
    for bx in (0.78, 0.98):
        band = add_torus((bx*s, 0, ARM_Z), 0.105, 0.014, 20, 8)
        rot_euler(band, 0, 90, 0)
        finish(band, M_gold, f'band_{bx}_{s}')
    finish(add_ico((0.88*s, FY*0.11, ARM_Z), 0.038, 2), M_gold, f'medal_{s}')
    finish(add_ico((0.88*s, FY*0.15, ARM_Z), 0.02, 2), M_gem, f'bracer_gem_{s}')
    hand = add_uv((1.14*s, 0, ARM_Z), 0.10, 20, 12)
    scale_local(hand, 1.2, 0.85, 0.95)
    subdiv(hand, 1)
    finish(hand, M_skin, f'hand_{s}')

for s in (-1, 1):
    build_arm(s)

# ---- CAPE: subdivided grid + solidify + fold ridges ----
def build_cape():
    # vertical cape sheet in XZ, facing -Y (hang on +Y back)
    g = add_grid((0, 0.30, 0.70), 1.1, 1.35, xu=20, yv=28)
    rot_euler(g, 90, 0, 0)  # grid XY → XZ-ish
    # After rot X90, grid lies in XZ; translate already at y=0.30
    # Shape folds by proportional Z scaling already; solidify for thickness
    solidify(g, thickness=0.045)
    bevel(g, 0.01, 2)
    subdiv(g, 1)
    finish(g, M_cape, 'cape_sheet')
    # fold ridge strips
    for i, x in enumerate([-0.35, -0.12, 0.12, 0.35]):
        ridge = add_cube((x, 0.33, 0.65), (0.04, 0.03, 0.9))
        bevel(ridge, 0.015, 2); subdiv(ridge, 1)
        rot_euler(ridge, 4, 0, (1 if x > 0 else -1) * 8)
        finish(ridge, M_cape, f'cape_fold_{i}')
    # lining
    lin = add_grid((0, 0.26, 0.65), 1.0, 1.2, xu=14, yv=20)
    rot_euler(lin, 90, 0, 0)
    solidify(lin, 0.02)
    finish(lin, M_lining, 'cape_lining')
    # green hem
    for i, x in enumerate([-0.40, -0.13, 0.13, 0.40]):
        hem = plate((x, 0.29, 0.08), (0.28, 0.04, 0.09), M_hem, f'hem_{i}', 0.012, 1)
        rot_euler(hem, 6, 0, (1 if x > 0 else -1) * 12)
        finish(add_ico((x, 0.32, 0.10), 0.018, 1), M_gold, f'hem_stud_{i}')
    # yoke
    yoke = add_cube((0, 0.28, SHOULDER_Z - 0.05), (0.48, 0.06, 0.22))
    bevel(yoke, 0.02, 2); subdiv(yoke, 1)
    finish(yoke, M_cape, 'cape_yoke')
    finish(add_ico((0, FY*0.02, SHOULDER_Z + 0.04), 0.042, 2), M_gold, 'clasp')

build_cape()

# ---- HEAD: cube cage → subdiv (not bare sphere) ----
def build_head():
    cage = add_cube((0, 0, HEAD_Z), (0.72, 0.70, 0.78))
    bevel(cage, 0.08, 3)
    subdiv(cage, 2, simple_first=True)
    scale_local(cage, 1.05, 0.95, 1.0)
    finish(cage, M_skin, 'head')
    # jaw shelf
    jaw = add_cube((0, FY*0.08, HEAD_Z - 0.18), (0.55, 0.40, 0.35))
    bevel(jaw, 0.05, 3); subdiv(jaw, 1)
    finish(jaw, M_skin, 'jaw')
    for s in (-1, 1):
        cheek = add_cube((0.22*s, FY*0.18, HEAD_Z - 0.02), (0.12, 0.10, 0.16))
        bevel(cheek, 0.03, 2); subdiv(cheek, 1)
        finish(cheek, M_skin, f'cheek_{s}')
    # sockets + eyes
    for s in (-1, 1):
        sock = add_uv((0.16*s, FY*0.28, HEAD_Z + 0.05), 0.095, 16, 10)
        scale_local(sock, 1.1, 0.28, 0.7)
        rot_euler(sock, 0, 0, -s*18)
        finish(sock, M_skinD, f'socket_{s}')
        eye = add_uv((0.16*s, FY*0.38, HEAD_Z + 0.05), 0.075, 16, 10)
        scale_local(eye, 0.95, 0.35, 1.4)
        rot_euler(eye, 0, 0, -s*20)
        finish(eye, M_eye, f'eye_{s}')
        brow = plate((0.14*s, FY*0.30, HEAD_Z + 0.14), (0.08, 0.025, 0.022), M_skinD, f'brow_{s}', 0.008, 0)
        rot_euler(brow, 0, 0, -s*12)
    # face tattoos
    for s in (-1, 1):
        for j, (ox, oz, sx, sz, ang) in enumerate([
            (0.18, 0.06, 0.065, 0.09, -s*20),
            (0.14, -0.02, 0.045, 0.07, -s*35),
            (0.08, 0.18, 0.055, 0.06, 0),
        ]):
            mark = add_cube((ox*s, FY*0.34, HEAD_Z + oz), (sx, 0.012, sz))
            bevel(mark, 0.006, 1)
            rot_euler(mark, 0, 0, ang)
            finish(mark, M_tattoo, f'face_tat_{s}_{j}')
    mouth = add_uv((0, FY*0.30, HEAD_Z - 0.18), 0.04, 12, 8)
    scale_local(mouth, 1.5, 0.28, 0.5)
    finish(mouth, M_lip, 'mouth')
    for s in (-1, 1):
        ear = add_cone((HEAD_R*0.7*s, FY*0.04, HEAD_Z + 0.04), 0.11, 0.0, 0.70, seg=8)
        rot_euler(ear, 8, 0, -s*88)
        bevel(ear, 0.01, 1)
        finish(ear, M_skin, f'ear_{s}')

build_head()

# ---- HAIR: many dense clumps ----
hb = add_uv((0, 0.12, HEAD_Z + 0.18), 0.42, 24, 14)
scale_local(hb, 1.2, 0.85, 1.05)
subdiv(hb, 1)
finish(hb, M_hair, 'hair_crown')

purple = [
    (0.00, 0.10, 0.55, 0.16, 0.60, -12, 0),
    (-0.18, 0.08, 0.50, 0.14, 0.52, -14, -22),
    (0.18, 0.08, 0.50, 0.14, 0.52, -14, 22),
    (-0.34, 0.02, 0.36, 0.12, 0.42, 4, -50),
    (0.34, 0.02, 0.36, 0.12, 0.42, 4, 50),
    (-0.12, 0.18, 0.30, 0.11, 0.36, 16, -14),
    (0.12, 0.18, 0.30, 0.11, 0.36, 16, 14),
    (0.00, 0.22, 0.24, 0.13, 0.32, 22, 0),
    (-0.26, 0.12, 0.22, 0.09, 0.28, 18, -34),
    (0.26, 0.12, 0.22, 0.09, 0.28, 18, 34),
    (-0.08, 0.16, 0.40, 0.10, 0.34, -8, -8),
    (0.08, 0.16, 0.40, 0.10, 0.34, -8, 8),
    (-0.40, 0.00, 0.20, 0.08, 0.26, 10, -60),
    (0.40, 0.00, 0.20, 0.08, 0.26, 10, 60),
]
for i, (x, y, dz, rb, depth, rx, rz) in enumerate(purple):
    sp = add_cone((x, y, HEAD_Z + dz*0.28), rb, 0.008, depth, seg=8)
    rot_euler(sp, rx, 0, rz)
    bevel(sp, 0.008, 1)
    finish(sp, M_hair, f'hair_{i}')

gold = [
    (-0.12, FY*0.20, 0.42, 0.10, 0.46, 28, -6),
    (-0.24, FY*0.14, 0.34, 0.09, 0.40, 26, -26),
    (-0.04, FY*0.22, 0.48, 0.11, 0.50, 26, 2),
    (-0.32, FY*0.06, 0.26, 0.08, 0.32, 18, -42),
    (-0.16, FY*0.10, 0.22, 0.07, 0.28, 32, -16),
    (-0.08, FY*0.16, 0.30, 0.08, 0.34, 30, -10),
    (-0.20, FY*0.18, 0.38, 0.08, 0.36, 24, -18),
]
for i, (x, y, dz, rb, depth, rx, rz) in enumerate(gold):
    sp = add_cone((x, y, HEAD_Z + dz*0.28), rb, 0.008, depth, seg=8)
    rot_euler(sp, rx, 0, rz)
    finish(sp, M_hairG, f'gold_{i}')

for s in (-1, 1):
    lock = add_cyl((HEAD_R*0.78*s, FY*0.06, HEAD_Z - 0.12), 0.07, 0.55, 12)
    rot_euler(lock, 30, 0, s*12)
    bevel(lock, 0.01, 1); subdiv(lock, 1)
    finish(lock, M_hair, f'lock_{s}')

# JOIN
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
    'construction': 'meshy_inspired_dense_cages',
    'white_model': WHITE,
}
print('DENSE_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, NAME + '_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
