#!/usr/bin/env python3
"""Parametric chibi humanoid from a reference card JSON.

  blender -b -noaudio --python scripts/build_from_card.py -- \
    --card examples/antler_elf_card.json --out exports/blender-rig-test

Reads palette/proportions/landmarks and builds a T-pose blockout. Specialize
further (unique antlers, leaf kits) by editing the card + this builder, or by
forking tools/rig/build_antler_elf.py for hero-specific detail.
"""
import bpy, sys, os, json, math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
import primitives as P  # noqa: E402

def argval(flag, default=None):
    a = sys.argv
    if '--' in a:
        a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

CARD_PATH = argval('--card')
OUT = argval('--out', os.path.join(HERE, '..', 'renders'))
os.makedirs(OUT, exist_ok=True)

with open(CARD_PATH) as f:
    CARD = json.load(f)

NAME = CARD.get('name') or argval('--name', 'card_unit')
PROP = CARD['proportions']
PAL = CARD['palette']
LAND = set(CARD.get('landmarks') or [])

P.clear_scene()
parts = []

M_skin   = P.mat_from_card(CARD, 'skin', rough=0.60)
M_skinD  = P.mat_from_card(CARD, 'skin_shadow', rough=0.70) if 'skin_shadow' in PAL else M_skin
M_hair   = P.mat_from_card(CARD, 'hair', rough=0.78) if 'hair' in PAL else M_skin
M_armor  = P.mat_from_card(CARD, 'armor', rough=0.40, metal=0.15) if 'armor' in PAL else M_skin
M_armorD = P.mat_from_card(CARD, 'armor_dark', rough=0.48, metal=0.1) if 'armor_dark' in PAL else M_armor
M_gold   = P.mat_from_card(CARD, 'gold', rough=0.26, metal=0.88) if 'gold' in PAL else M_armor
M_cloth  = P.mat_from_card(CARD, 'cloth', rough=0.74) if 'cloth' in PAL else M_armor
M_leather= P.mat_from_card(CARD, 'leather', rough=0.85) if 'leather' in PAL else M_cloth
M_eye    = P.mat_from_card(CARD, 'eye', rough=0.22) if 'eye' in PAL else M_skin
M_gem    = P.mat_from_card(CARD, 'gem', rough=0.18, metal=0.2) if 'gem' in PAL else M_gold
M_ink    = P.mat_from_card(CARD, 'ink', rough=0.9) if 'ink' in PAL else M_skinD
M_antler = P.mat_from_card(CARD, 'antler', rough=0.82) if 'antler' in PAL else M_leather

H = float(PROP.get('total_height', 2.3))
head_frac = float(PROP['head_height_frac'])
HEAD_R = float(PROP.get('head_radius', H * head_frac * 0.42))
LEG_Z = H * float(PROP.get('leg_height_frac', 0.23))
TORSO_H = H * float(PROP.get('torso_height_frac', 0.27))
SHOULDER_Z = LEG_Z + TORSO_H
HEAD_Z = SHOULDER_Z + HEAD_R * 1.05
HIP_X = float(PROP.get('hip_width', 0.36)) * 0.5
limb_r = float(PROP.get('limb_thickness', 0.09))
FY = -1  # face −Y

# legs + boots
for s in (-1, 1):
    P.limb_z(HIP_X * s, 0, 0.18, LEG_Z, limb_r * 1.2, M_skin, f'leg_{s}', parts)
    P.limb_z(HIP_X * s, 0.02, 0.04, 0.26, limb_r * 1.4, M_armor, f'boot_{s}', parts)
    P.finish(P.add_torus((HIP_X * s, 0.02, 0.26), limb_r * 1.35, 0.018), M_gold, f'boot_rim_{s}', parts)
    P.finish(P.add_cube((HIP_X * s, FY * 0.08, 0.05), (limb_r * 1.7, limb_r * 2.6, 0.08)), M_armorD, f'foot_{s}', parts)

# hips / cloth
hips = P.add_uv((0, 0, LEG_Z), HIP_X * 1.4, 14, 8)
P.scale_local(hips, 1.15, 0.85, 0.5)
P.finish(hips, M_cloth, 'hips', parts)

if 'leaf_kilt_plates' in LAND or 'purple_under_kilt' in LAND:
    for i, ang in enumerate([-50, -25, 0, 25, 50]):
        rad = math.radians(ang)
        P.leaf_plate((math.sin(rad) * HIP_X * 1.3, FY * math.cos(rad) * HIP_X * 1.0, LEG_Z - 0.05),
                     0.12, 0.04, 0.22, M_armor if i % 2 == 0 else M_armorD, parts,
                     rx=28, rz=ang, name=f'kilt_{i}')

P.finish(P.add_torus((0, 0, LEG_Z + 0.05), HIP_X * 1.5, 0.025), M_gold, 'belt', parts)
if 'gem' in PAL:
    P.finish(P.add_ico((0, FY * HIP_X * 1.4, LEG_Z + 0.05), 0.055, 1), M_gem, 'belt_gem', parts)

# torso
torso = P.add_uv((0, 0, LEG_Z + TORSO_H * 0.42), float(PROP.get('shoulder_width', 0.64)) * 0.45, 16, 10)
P.scale_local(torso, 1.0, 0.78, 1.1)
P.finish(torso, M_armor, 'torso', parts)

if 'green_leaf_breastplates' in LAND or 'gold_trim' in LAND:
    for s in (-1, 1):
        P.leaf_plate((0.11 * s, FY * 0.22, LEG_Z + TORSO_H * 0.5),
                     0.14, 0.045, 0.20, M_armor, parts, rx=10, rz=s * 16, name=f'breast_{s}')
        P.leaf_plate((0.11 * s, FY * 0.26, LEG_Z + TORSO_H * 0.38),
                     0.07, 0.025, 0.09, M_gold, parts, rx=10, rz=s * 16, name=f'breast_g_{s}')

P.finish(P.add_torus((0, 0, SHOULDER_Z - 0.07), 0.13, 0.022), M_gold, 'collar', parts)
if 'gem' in PAL:
    P.finish(P.add_ico((0, FY * 0.15, SHOULDER_Z - 0.05), 0.05, 1), M_gem, 'collar_gem', parts)

if 'leather_sash' in LAND:
    sash = P.add_cube((0.03, FY * 0.18, LEG_Z + TORSO_H * 0.4), (0.06, 0.02, TORSO_H * 0.75))
    P.rot_euler(sash, 0, 0, -32)
    P.finish(sash, M_leather, 'sash', parts)

P.limb_z(0, 0, SHOULDER_Z - 0.12, SHOULDER_Z + 0.04, 0.085, M_skin, 'neck', parts)

# pauldrons
if 'green_pauldrons' in LAND or 'pauldrons' in LAND:
    for s in (-1, 1):
        pa = P.add_uv((0.30 * s, 0, SHOULDER_Z + 0.02), 0.15, 12, 8)
        P.scale_local(pa, 1.15, 0.9, 0.75)
        P.finish(pa, M_armor, f'pauldron_{s}', parts)
        P.finish(P.add_torus((0.30 * s, 0, SHOULDER_Z - 0.03), 0.12, 0.018), M_gold, f'pauldron_rim_{s}', parts)

# arms T-pose
sw = float(PROP.get('shoulder_width', 0.64)) * 0.5
for s in (-1, 1):
    P.limb_x(0.34 * s, 0.68 * s, 0, SHOULDER_Z, limb_r, M_skin, f'upper_arm_{s}', parts)
    P.limb_x(0.68 * s, 1.00 * s, 0, SHOULDER_Z, limb_r * 0.9, M_skin, f'forearm_{s}', parts)
    P.limb_x(0.78 * s, 1.00 * s, 0, SHOULDER_Z, limb_r * 1.1, M_armor, f'bracer_{s}', parts)
    bg = P.add_torus((0.82 * s, 0, SHOULDER_Z), limb_r * 1.1, 0.016)
    P.rot_euler(bg, 0, 90, 0)
    P.finish(bg, M_gold, f'bracer_gold_{s}', parts)
    hand = P.add_uv((1.12 * s, 0, SHOULDER_Z), limb_r * 1.15, 10, 7)
    P.scale_local(hand, 1.1, 0.85, 0.9)
    P.finish(hand, M_skin, f'hand_{s}', parts)

# head
head = P.add_uv((0, 0, HEAD_Z), HEAD_R, 20, 12)
P.scale_local(head, 1.02, 0.96, 0.98)
P.finish(head, M_skin, 'head', parts)

for s in (-1, 1):
    sock = P.add_uv((0.14 * s, FY * HEAD_R * 0.7, HEAD_Z + 0.04), HEAD_R * 0.22, 10, 6)
    P.scale_local(sock, 1.05, 0.28, 0.75)
    P.rot_euler(sock, 0, 0, -s * 18)
    P.finish(sock, M_skinD, f'socket_{s}', parts)
    eye = P.add_uv((0.14 * s, FY * HEAD_R * 0.95, HEAD_Z + 0.04), HEAD_R * 0.18, 12, 8)
    P.scale_local(eye, 0.95, 0.38, 1.4)
    P.rot_euler(eye, 0, 0, -s * 20)
    P.finish(eye, M_eye, f'eye_{s}', parts)

if 'pointed_ears' in LAND:
    for s in (-1, 1):
        ear = P.add_cone((HEAD_R * 0.9 * s, FY * 0.04, HEAD_Z), HEAD_R * 0.2, 0.0, HEAD_R * 1.0, seg=7)
        P.rot_euler(ear, 18, 0, -s * 48)
        P.finish(ear, M_skin, f'ear_{s}', parts)

# hair bun
if 'white_braid_bun' in LAND or 'hair' in PAL:
    hb = P.add_uv((0, 0.18, HEAD_Z + 0.02), HEAD_R * 0.9, 14, 10)
    P.scale_local(hb, 1.05, 0.7, 0.9)
    P.finish(hb, M_hair, 'hair_back', parts)
    for i, (dz, r) in enumerate([(0.30, 0.22), (0.44, 0.16), (0.54, 0.11)]):
        b = P.add_uv((0, 0.15, HEAD_Z + dz * HEAD_R / 0.38), r * HEAD_R / 0.38, 12, 8)
        P.finish(b, M_hair, f'bun_{i}', parts)

# circlet
if 'gold_circlet_with_gem' in LAND:
    P.finish(P.add_torus((0, 0, HEAD_Z + HEAD_R * 0.4), HEAD_R * 0.85, 0.02, seg=22), M_gold, 'circlet', parts)
    P.finish(P.add_ico((0, FY * HEAD_R * 0.85, HEAD_Z + HEAD_R * 0.45), 0.055, 1), M_gem, 'circlet_gem', parts)

# antlers
if 'brown_deer_antlers' in LAND:
    for s in (-1, 1):
        main = P.add_cyl((HEAD_R * 0.4 * s, 0.08, HEAD_Z + HEAD_R * 0.9), 0.05, HEAD_R * 1.1, seg=8)
        P.rot_euler(main, -28, 0, s * 28)
        P.finish(main, M_antler, f'antler_main_{s}', parts)
        tip = P.add_cyl((HEAD_R * 0.58 * s, 0.10, HEAD_Z + HEAD_R * 1.45), 0.03, HEAD_R * 0.55, seg=7)
        P.rot_euler(tip, -40, 0, s * 35)
        P.finish(tip, M_antler, f'antler_tip_{s}', parts)
        tine = P.add_cyl((HEAD_R * 0.48 * s, FY * 0.06, HEAD_Z + HEAD_R * 1.15), 0.025, HEAD_R * 0.45, seg=6)
        P.rot_euler(tine, 55, 0, s * 10)
        P.finish(tine, M_antler, f'antler_tine_{s}', parts)

body = P.join_and_ground(parts, NAME)
glb = os.path.join(OUT, NAME + '.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_apply=True)

coords = [body.matrix_world @ P.V(c) for c in body.bound_box]
zs = [c.z for c in coords]
report = {
    'name': NAME,
    'card': CARD_PATH,
    'glb': glb,
    'bytes': os.path.getsize(glb),
    'height': max(zs) - min(zs),
    'head_height_frac_target': head_frac,
    'landmarks': sorted(LAND),
    'tris': sum(len(p.vertices) - 2 for p in body.data.polygons),
}
print('CARD_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, NAME + '_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
