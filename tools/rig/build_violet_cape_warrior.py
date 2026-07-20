#!/usr/bin/env python3
"""Anti-blob rebuild: violet cape warrior from reference + light_scan.

Parts-first · silhouette traces · beveled plates · multi-panel cape · designed hair.
Gold streaks on character's RIGHT (= -X when face is -Y / front camera).

  blender -b -noaudio --python tools/rig/build_violet_cape_warrior.py -- \
    --out exports/blender-rig-test
"""
import bpy, bmesh, math, mathutils, sys, os, json
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

# Palette tuned to reference: deep purple skin, vibrant green armor, gold trim
M_skin   = mat('vc_skin',   '#7a58a8', 0.62)
M_skinD  = mat('vc_skinD',  '#4a326e', 0.72)
M_tattoo = mat('vc_tattoo', '#3dff7a', 0.40, emit='#5dff9a', estr=1.1)
M_hair   = mat('vc_hair',   '#3a1f66', 0.78)
M_hairG  = mat('vc_hairG',  '#f0c93a', 0.48, metal=0.25)
M_armor  = mat('vc_armor',  '#3f9e4a', 0.40, metal=0.15)
M_armorD = mat('vc_armorD', '#2a6b32', 0.48, metal=0.12)
M_gold   = mat('vc_gold',   '#e0b045', 0.26, metal=0.90)
M_gem    = mat('vc_gem',    '#d43535', 0.20, metal=0.15, emit='#ff4040', estr=0.75)
M_cape   = mat('vc_cape',   '#3a2458', 0.74)
M_lining = mat('vc_lining', '#2a1838', 0.80)
M_hem    = mat('vc_hem',    '#2e7a38', 0.50, metal=0.08)
M_skirt  = mat('vc_skirt',  '#b89ad0', 0.70)
M_scarf  = mat('vc_scarf',  '#5a3a88', 0.68)
M_eye    = mat('vc_eye',    '#b8ff3a', 0.18, emit='#a0ff30', estr=1.15)
M_belt   = mat('vc_belt',   '#357a3c', 0.48, metal=0.1)
M_ink    = mat('vc_ink',    '#1a1020', 0.9)
M_steel  = mat('vc_steel',  '#6a6e78', 0.35, metal=0.7)
M_lip    = mat('vc_lip',    '#2a1838', 0.85)

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

def bevel(ob, width=0.025, segments=2, angle=30):
    activate(ob)
    mod = ob.modifiers.new('Bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    bpy.ops.object.modifier_apply(modifier='Bevel')
    return ob

def plate(loc, scale, m, name, width=0.022, segs=2):
    """Beveled armor plate — never ship a raw cube."""
    ob = add_cube(loc, scale)
    bevel(ob, width=width, segments=segs)
    return finish(ob, m, name)

def inset_panel(loc, scale, m, name):
    """Slightly recessed panel on armor."""
    ob = add_cube(loc, scale)
    bevel(ob, width=0.012, segments=1)
    return finish(ob, m, name)

def profile_limb_z(x, y, z0, z1, radii, m, name, seg=10):
    """Stacked tapered capsules along Z — radii list of (t, r) t in 0..1."""
    n = max(3, len(radii))
    for i in range(n - 1):
        t0, r0 = radii[i]
        t1, r1 = radii[i + 1]
        z_a = z0 + (z1 - z0) * t0
        z_b = z0 + (z1 - z0) * t1
        r = (r0 + r1) * 0.5
        ob = add_cyl((x, y, (z_a + z_b) * 0.5), r, abs(z_b - z_a) + 0.002, seg)
        finish(ob, m, f'{name}_{i}')
    return None

def profile_limb_x(x0, x1, y, z, radii, m, name, seg=10):
    n = max(3, len(radii))
    for i in range(n - 1):
        t0, r0 = radii[i]
        t1, r1 = radii[i + 1]
        xa = x0 + (x1 - x0) * t0
        xb = x0 + (x1 - x0) * t1
        r = (r0 + r1) * 0.5
        ob = add_cyl(((xa + xb) * 0.5, y, z), r, abs(xb - xa) + 0.002, seg)
        rot_euler(ob, 0, 90, 0)
        finish(ob, m, f'{name}_{i}')

def lathe_head(loc, r, m, name):
    """Chibi head with jaw planes — not a bare UV sphere final."""
    # cranium
    cr = add_uv(loc, r, 18, 12)
    scale_local(cr, 1.05, 0.98, 0.95)
    finish(cr, m, name + '_cranium')
    # jaw / cheek shelf (flattened lower front)
    jaw = add_uv((loc[0], loc[1] + (-0.06 if True else 0), loc[2] - r * 0.28), r * 0.72, 14, 10)
    # face toward -Y → push jaw slightly -Y
    jaw.location = (loc[0], loc[1] - 0.06, loc[2] - r * 0.28)
    bpy.context.view_layer.update()
    scale_local(jaw, 1.05, 0.75, 0.70)
    finish(jaw, m, name + '_jaw')
    # cheek planes
    for s in (-1, 1):
        cheek = add_cube((loc[0] + 0.22 * s, loc[1] - 0.22, loc[2] - 0.02), (0.10, 0.06, 0.14))
        bevel(cheek, 0.03, 2)
        finish(cheek, m, f'{name}_cheek_{s}')
    return cr

# ============================================================
# Assembly contract (Z-up, face -Y, feet z≈0, T-pose ±X)
# ============================================================
FY = -1
HIP_X = 0.18
LEG_Z = 0.62
TORSO_H = 0.68
SHOULDER_Z = LEG_Z + TORSO_H          # ~1.30
HEAD_R = 0.42
HEAD_Z = SHOULDER_Z + 0.48            # ~1.78
ARM_Z = SHOULDER_Z + 0.02

# ============================================================
# PRIORITY 1 — silhouette / form_language parts
# ============================================================

# ---- greaves (beveled plates, not tubes) ----
def build_boot(s):
    # shin plate front
    plate((HIP_X * s, FY * 0.08, 0.28), (0.14, 0.10, 0.28), M_armor, f'shin_plate_{s}', 0.028)
    # shin shell sides
    plate((HIP_X * s, 0.0, 0.26), (0.16, 0.14, 0.26), M_armorD, f'shin_shell_{s}', 0.02)
    # gold scroll bar
    plate((HIP_X * s, FY * 0.14, 0.30), (0.04, 0.02, 0.18), M_gold, f'shin_fil_{s}', 0.01)
    plate((HIP_X * s, FY * 0.14, 0.22), (0.10, 0.015, 0.03), M_gold, f'shin_fil2_{s}', 0.008)
    # knee cup (beveled plate + gem — not melon sphere alone)
    knee = plate((HIP_X * s, FY * 0.10, 0.42), (0.13, 0.10, 0.12), M_armor, f'knee_cup_{s}', 0.035)
    finish(add_torus((HIP_X * s, FY * 0.12, 0.42), 0.08, 0.014), M_gold, f'knee_rim_{s}')
    finish(add_ico((HIP_X * s, FY * 0.20, 0.42), 0.04, 1), M_gem, f'knee_gem_{s}')
    # cuff
    finish(add_torus((HIP_X * s, 0.02, 0.38), 0.145, 0.018), M_gold, f'boot_cuff_{s}')
    # foot last + toe cap
    plate((HIP_X * s, FY * 0.10, 0.05), (0.15, 0.28, 0.08), M_armorD, f'foot_{s}', 0.02)
    plate((HIP_X * s, FY * 0.24, 0.06), (0.11, 0.10, 0.06), M_gold, f'toe_cap_{s}', 0.018)

for s in (-1, 1):
    build_boot(s)

# thighs — slight taper
for s in (-1, 1):
    profile_limb_z(HIP_X * s, 0, 0.40, LEG_Z, [(0, 0.11), (0.5, 0.125), (1, 0.12)], M_skin, f'thigh_{s}')

# hips
hips = add_uv((0, 0, LEG_Z), 0.28, 14, 8)
scale_local(hips, 1.25, 0.88, 0.42)
finish(hips, M_skin, 'hips')

# tattered lilac skirt — tapered strips with slight twist (not rods)
for i, ang in enumerate([-55, -28, 0, 28, 55]):
    rad = math.radians(ang)
    x = math.sin(rad) * 0.20
    y = FY * (0.10 + 0.05 * abs(math.cos(rad)))
    strip = add_cube((x, y, LEG_Z - 0.14), (0.06, 0.025, 0.30))
    # taper bottom via scale already; bevel for cloth edge
    bevel(strip, 0.015, 1)
    rot_euler(strip, 14, 0, ang)
    finish(strip, M_skirt, f'skirt_{i}')

# belt + gold trim
finish(add_torus((0, 0, LEG_Z + 0.05), 0.30, 0.038), M_belt, 'belt')
finish(add_torus((0, 0, LEG_Z + 0.05), 0.325, 0.012), M_gold, 'belt_gold')
for i, x in enumerate([-0.10, 0.0, 0.10]):
    sash = plate((x, FY * 0.26, LEG_Z - 0.06), (0.045, 0.018, 0.20), M_armor if i != 1 else M_gold, f'sash_{i}', 0.01)
    rot_euler(sash, 10, 0, x * 35)

# hip scabbard — character left hip (+X) with gold accents
scab = plate((0.30, FY * 0.04, LEG_Z + 0.02), (0.055, 0.07, 0.40), M_armorD, 'scabbard', 0.015)
rot_euler(scab, 0, 0, -16)
finish(add_cyl((0.34, FY * 0.04, LEG_Z + 0.26), 0.028, 0.14, 8), M_steel, 'hilt')
plate((0.34, FY * 0.04, LEG_Z + 0.20), (0.12, 0.035, 0.035), M_gold, 'guard', 0.01)
finish(add_ico((0.36, FY * 0.04, LEG_Z + 0.34), 0.035, 1), M_gold, 'pommel')

# torso — profile chest (not one ball)
chest = add_uv((0, FY * 0.02, LEG_Z + TORSO_H * 0.55), 0.30, 16, 10)
scale_local(chest, 1.08, 0.72, 0.95)
finish(chest, M_skin, 'chest')
belly = add_uv((0, 0, LEG_Z + TORSO_H * 0.28), 0.26, 14, 8)
scale_local(belly, 1.05, 0.70, 0.75)
finish(belly, M_skin, 'belly')

# glowing green swirl tattoos (raised ribbons, not flat cubes only)
for s in (-1, 1):
    for j, (dz, sx, sz) in enumerate([(0.58, 0.09, 0.20), (0.42, 0.07, 0.12), (0.48, 0.05, 0.08)]):
        tat = add_cube((0.09 * s + (0.02 if j == 2 else 0) * s, FY * 0.24, LEG_Z + TORSO_H * dz),
                       (sx, 0.018, sz))
        bevel(tat, 0.01, 1)
        rot_euler(tat, 0, 0, s * (8 + j * 6))
        finish(tat, M_tattoo, f'tattoo_{s}_{j}')

limb_z = lambda x, y, z0, z1, r, m, n: finish(add_cyl((x, y, (z0 + z1) * 0.5), r, abs(z1 - z0), 12), m, n)
limb_z(0, 0, SHOULDER_Z - 0.12, SHOULDER_Z + 0.08, 0.095, M_skin, 'neck')

# scarf / cowl — layered rings into cape (not one sphere)
scarf = add_uv((0, FY * 0.02, SHOULDER_Z), 0.19, 14, 8)
scale_local(scarf, 1.35, 1.15, 0.55)
finish(scarf, M_scarf, 'scarf')
scarf2 = add_uv((0, FY * 0.06, SHOULDER_Z - 0.08), 0.17, 12, 6)
scale_local(scarf2, 1.4, 1.0, 0.45)
finish(scarf2, M_scarf, 'scarf_layer')
# front knot / fold
plate((0, FY * 0.16, SHOULDER_Z - 0.04), (0.12, 0.06, 0.10), M_scarf, 'scarf_knot', 0.02)

# ---- pauldrons: layered beveled cups + gold filigree + red gem ----
def build_pauldron(s):
    # main cup plate (flattened, overhangs arm)
    cup = plate((0.40 * s, FY * 0.02, SHOULDER_Z + 0.06), (0.20, 0.16, 0.14), M_armor, f'pauldron_cup_{s}', 0.04)
    # upper ridge plate
    plate((0.42 * s, FY * 0.04, SHOULDER_Z + 0.14), (0.14, 0.12, 0.07), M_armorD, f'pauldron_ridge_{s}', 0.025)
    # under lip (cavity read)
    plate((0.38 * s, FY * 0.02, SHOULDER_Z - 0.02), (0.16, 0.14, 0.05), M_armorD, f'pauldron_lip_{s}', 0.015)
    # gold rim ellipse approx
    finish(add_torus((0.40 * s, 0.0, SHOULDER_Z + 0.02), 0.14, 0.02), M_gold, f'pauldron_rim_{s}')
    # filigree bars
    plate((0.42 * s, FY * 0.12, SHOULDER_Z + 0.08), (0.03, 0.015, 0.12), M_gold, f'pauldron_fil_{s}', 0.008)
    plate((0.36 * s, FY * 0.12, SHOULDER_Z + 0.10), (0.08, 0.012, 0.025), M_gold, f'pauldron_fil2_{s}', 0.006)
    # gem housing
    finish(add_torus((0.44 * s, FY * 0.02, SHOULDER_Z + 0.18), 0.035, 0.01), M_gold, f'gem_bez_{s}')
    finish(add_ico((0.44 * s, FY * 0.02, SHOULDER_Z + 0.18), 0.038, 1), M_gem, f'pauldron_gem_{s}')
    # articulation gap ring at shoulder (toy joint cutout)
    gap = add_torus((0.28 * s, 0, SHOULDER_Z), 0.09, 0.018)
    rot_euler(gap, 0, 90, 0)
    finish(gap, M_skinD, f'shoulder_joint_{s}')

for s in (-1, 1):
    build_pauldron(s)

# ---- arms: tapered profile + bracer plates + joint cutouts ----
def build_arm(s):
    profile_limb_x(0.42 * s, 0.70 * s, 0, ARM_Z,
                   [(0, 0.10), (0.5, 0.095), (1, 0.09)], M_skin, f'upper_arm_{s}')
    # elbow joint cutout
    gap = add_torus((0.72 * s, 0, ARM_Z), 0.075, 0.014)
    rot_euler(gap, 0, 90, 0)
    finish(gap, M_skinD, f'elbow_joint_{s}')
    profile_limb_x(0.74 * s, 1.02 * s, 0, ARM_Z,
                   [(0, 0.085), (0.5, 0.08), (1, 0.075)], M_skin, f'forearm_{s}')
    # bracer — beveled shell + gold bands + medallion
    plate((0.90 * s, 0, ARM_Z), (0.22, 0.12, 0.12), M_armor, f'bracer_{s}', 0.025)
    for bx in (0.80, 1.00):
        band = add_torus((bx * s, 0, ARM_Z), 0.11, 0.016)
        rot_euler(band, 0, 90, 0)
        finish(band, M_gold, f'bracer_band_{bx}_{s}')
    # medallion
    finish(add_ico((0.90 * s, FY * 0.10, ARM_Z), 0.04, 1), M_gold, f'bracer_medal_{s}')
    finish(add_ico((0.90 * s, FY * 0.14, ARM_Z), 0.022, 1), M_gem, f'bracer_gem_{s}')
    # fist mitt with knuckles
    hand = add_uv((1.16 * s, 0, ARM_Z), 0.105, 12, 8)
    scale_local(hand, 1.2, 0.85, 0.95)
    finish(hand, M_skin, f'hand_{s}')
    for k in range(3):
        kn = add_uv((1.22 * s, FY * (0.04 + k * 0.01), ARM_Z + 0.04 - k * 0.03), 0.03, 6, 4)
        finish(kn, M_skinD, f'knuckle_{s}_{k}')

for s in (-1, 1):
    build_arm(s)

# ---- cape: multi-panel flare + thickness + green patterned hem ----
# yoke
plate((0, 0.28, SHOULDER_Z - 0.05), (0.48, 0.06, 0.28), M_cape, 'cape_yoke', 0.02)
# mid panels (left / center / right) with slight fold angles
for i, (x, ang, w) in enumerate([(-0.28, 18, 0.32), (0.0, 0, 0.50), (0.28, -18, 0.32)]):
    mid = plate((x, 0.34, 0.72), (w, 0.055, 0.55), M_cape, f'cape_mid_{i}', 0.018)
    rot_euler(mid, 4, 0, ang)
# lower flare panels
for i, (x, ang, w) in enumerate([(-0.42, 22, 0.38), (-0.14, 6, 0.36), (0.14, -6, 0.36), (0.42, -22, 0.38)]):
    low = plate((x, 0.30, 0.28), (w, 0.05, 0.42), M_cape, f'cape_low_{i}', 0.016)
    rot_euler(low, 6, 0, ang)
# lining underside (darker, slightly forward of outer)
plate((0, 0.24, 0.35), (0.85, 0.03, 0.70), M_lining, 'cape_lining', 0.01)
# green hem border with gold dots (pattern suggestion)
for i, (x, ang) in enumerate([(-0.48, 24), (-0.18, 8), (0.18, -8), (0.48, -24)]):
    hem = plate((x, 0.28, 0.08), (0.30, 0.045, 0.10), M_hem, f'cape_hem_{i}', 0.012)
    rot_euler(hem, 8, 0, ang)
    # decorative gold studs on hem
    finish(add_ico((x, 0.32, 0.10), 0.02, 1), M_gold, f'hem_stud_{i}')
# cape clasp
finish(add_ico((0, FY * 0.02, SHOULDER_Z + 0.04), 0.045, 1), M_gold, 'cape_clasp')

# ---- head (jaw + cheeks — anti-blob) ----
lathe_head((0, 0, HEAD_Z), HEAD_R, M_skin, 'head')

# face swirl tattoos (emissive green)
for s in (-1, 1):
    for j, (ox, oz, sx, sz, ang) in enumerate([
        (0.18, 0.06, 0.07, 0.10, -s * 20),
        (0.14, -0.02, 0.05, 0.08, -s * 35),
        (0.08, 0.18, 0.06, 0.07, 0),
    ]):
        mark = add_cube((ox * s, FY * 0.34, HEAD_Z + oz), (sx, 0.015, sz))
        bevel(mark, 0.008, 1)
        rot_euler(mark, 0, 0, ang)
        finish(mark, M_tattoo, f'face_tat_{s}_{j}')

# eyes — large almond lime glow + dark sockets
for s in (-1, 1):
    sock = add_uv((0.16 * s, FY * 0.30, HEAD_Z + 0.05), 0.10, 10, 6)
    scale_local(sock, 1.15, 0.28, 0.70)
    rot_euler(sock, 0, 0, -s * 18)
    finish(sock, M_skinD, f'socket_{s}')
    eye = add_uv((0.16 * s, FY * 0.40, HEAD_Z + 0.05), 0.08, 12, 8)
    scale_local(eye, 0.95, 0.35, 1.45)
    rot_euler(eye, 0, 0, -s * 20)
    finish(eye, M_eye, f'eye_{s}')

# brow ridges
for s in (-1, 1):
    brow = plate((0.14 * s, FY * 0.32, HEAD_Z + 0.14), (0.08, 0.03, 0.025), M_skinD, f'brow_{s}', 0.01)
    rot_euler(brow, 0, 0, -s * 12)

# lips
mouth = add_uv((0, FY * 0.32, HEAD_Z - 0.18), 0.045, 8, 5)
scale_local(mouth, 1.5, 0.30, 0.55)
finish(mouth, M_lip, 'mouth')

# ears — long pointed horizontal (must break silhouette)
for s in (-1, 1):
    ear = add_cone((HEAD_R * 0.72 * s, FY * 0.04, HEAD_Z + 0.04), 0.12, 0.0, 0.72, seg=7)
    rot_euler(ear, 8, 0, -s * 88)
    finish(ear, M_skin, f'ear_{s}')
    inn = add_cone((HEAD_R * 0.80 * s, FY * 0.10, HEAD_Z + 0.04), 0.055, 0.0, 0.48, seg=6)
    rot_euler(inn, 8, 0, -s * 88)
    finish(inn, M_skinD, f'ear_inner_{s}')

# ---- hair: designed clumps; gold on character RIGHT (-X) ----
# ONE-KNOB REFINE: larger upswept volume + clearer gold mass on -X
hb = add_uv((0, 0.12, HEAD_Z + 0.18), 0.44, 14, 10)
scale_local(hb, 1.2, 0.85, 1.05)
finish(hb, M_hair, 'hair_crown')
hb2 = add_uv((0, 0.08, HEAD_Z + 0.32), 0.32, 12, 8)
scale_local(hb2, 1.15, 0.9, 0.9)
finish(hb2, M_hair, 'hair_top')

purple_spikes = [
    # x, y, z_off, r_base, depth, rx, rz
    (0.00,  0.10, 0.55, 0.18, 0.62, -12,   0),
    (-0.20, 0.08, 0.50, 0.15, 0.55, -14, -24),
    (0.20,  0.08, 0.50, 0.15, 0.55, -14,  24),
    (-0.36, 0.02, 0.36, 0.13, 0.44,  4, -52),
    (0.36,  0.02, 0.36, 0.13, 0.44,  4,  52),
    (-0.14, 0.18, 0.30, 0.12, 0.38, 16, -16),
    (0.14,  0.18, 0.30, 0.12, 0.38, 16,  16),
    (0.00,  0.22, 0.24, 0.14, 0.34, 22,   0),
    (-0.28, 0.12, 0.22, 0.10, 0.30, 20, -35),
    (0.28,  0.12, 0.22, 0.10, 0.30, 20,  35),
]
for i, (x, y, dz, rb, depth, rx, rz) in enumerate(purple_spikes):
    sp = add_cone((x, y, HEAD_Z + dz * 0.28), rb, 0.01, depth, seg=6)
    rot_euler(sp, rx, 0, rz)
    finish(sp, M_hair, f'hair_clump_{i}')

gold_spikes = [
    (-0.12, FY * 0.20, 0.40, 0.11, 0.46, 28, -6),
    (-0.24, FY * 0.14, 0.34, 0.10, 0.40, 26, -26),
    (-0.04, FY * 0.22, 0.48, 0.12, 0.50, 26,  2),
    (-0.32, FY * 0.06, 0.26, 0.09, 0.32, 18, -42),
    (-0.16, FY * 0.10, 0.22, 0.08, 0.28, 32, -16),
    (-0.08, FY * 0.16, 0.30, 0.09, 0.34, 30, -10),
]
for i, (x, y, dz, rb, depth, rx, rz) in enumerate(gold_spikes):
    sp = add_cone((x, y, HEAD_Z + dz * 0.28), rb, 0.01, depth, seg=6)
    rot_euler(sp, rx, 0, rz)
    finish(sp, M_hairG, f'hair_gold_{i}')

for s in (-1, 1):
    lock = add_cyl((HEAD_R * 0.78 * s, FY * 0.06, HEAD_Z - 0.10), 0.075, 0.55, 8)
    rot_euler(lock, 30, 0, s * 12)
    finish(lock, M_hair, f'side_lock_{s}')
    tip = add_cone((HEAD_R * 0.85 * s, FY * 0.10, HEAD_Z - 0.40), 0.065, 0.0, 0.20, seg=5)
    rot_euler(tip, 40, 0, s * 14)
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
xs = [c.x for c in coords]; ys = [c.y for c in coords]; zs = [c.z for c in coords]
report = {
    'name': NAME,
    'glb': glb,
    'bytes': os.path.getsize(glb),
    'bbox': {'min': [min(xs), min(ys), min(zs)], 'max': [max(xs), max(ys), max(zs)],
             'height': max(zs) - min(zs)},
    'tris': sum(len(p.vertices) - 2 for p in body.data.polygons),
    'part_objects_before_join': len(parts),
    'construction': 'parts_first_anti_blob_v2',
    'form_recipes': [
        'beveled_plate', 'profile_limb', 'lathe_head_jaw',
        'multi_panel_cape', 'designed_hair_clumps', 'gem_housing',
    ],
}
print('VIOLET_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, NAME + '_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
