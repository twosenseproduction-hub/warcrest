#!/usr/bin/env python3
"""From-scratch Blender smoke test: mesh → armature → skin → idle/walk → GLB.

Unlike build_unit.py (which reuses a Bitgem donor skeleton + clips), this script
authors a tiny humanoid, a simple bone chain, automatic weights, and two short
actions so we can verify Blender install + rigging + animation export works
without any shipped assets.

  blender -b -noaudio --python tools/rig/test_scratch_rig_anim.py -- \
    --out exports/blender-rig-test
"""
import bpy, bmesh, mathutils, math, sys, os, json
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a:
        a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

OUT = argval('--out', os.path.join(os.path.dirname(__file__), '..', '..', 'exports', 'blender-rig-test'))
NAME = argval('--name', 'scratch_walker')
os.makedirs(OUT, exist_ok=True)

# ---------- clean scene ----------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.materials):
    for d in list(blk):
        blk.remove(d)

# ---------- materials ----------
def mat(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.65
    return m

skin_m = mat('Skin', (0.86, 0.70, 0.55))
cloth_m = mat('Cloth', (0.22, 0.38, 0.55))
boot_m = mat('Boot', (0.18, 0.14, 0.12))

# ---------- body mesh (capsule-ish low-poly humanoid) ----------
def add_box(name, loc, scale, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if ob.data.materials:
        ob.data.materials[0] = material
    else:
        ob.data.materials.append(material)
    return ob

parts = [
    add_box('torso',  (0, 0, 1.15), (0.55, 0.35, 0.70), cloth_m),
    add_box('head',   (0, 0, 1.85), (0.32, 0.32, 0.32), skin_m),
    add_box('arm_l',  (-0.55, 0, 1.20), (0.16, 0.16, 0.55), skin_m),
    add_box('arm_r',  ( 0.55, 0, 1.20), (0.16, 0.16, 0.55), skin_m),
    add_box('leg_l',  (-0.18, 0, 0.40), (0.18, 0.18, 0.70), cloth_m),
    add_box('leg_r',  ( 0.18, 0, 0.40), (0.18, 0.18, 0.70), cloth_m),
    add_box('foot_l', (-0.18, 0.12, 0.06), (0.20, 0.35, 0.10), boot_m),
    add_box('foot_r', ( 0.18, 0.12, 0.06), (0.20, 0.35, 0.10), boot_m),
]

for o in bpy.context.selected_objects:
    o.select_set(False)
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = NAME + '_mesh'

# ---------- armature ----------
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm = bpy.context.active_object
arm.name = 'Armature'
eb = arm.data.edit_bones
root = eb[0]
root.name = 'root'
root.head = V((0, 0, 0))
root.tail = V((0, 0, 0.15))

def bone(name, parent, head, tail):
    b = eb.new(name)
    b.head = V(head)
    b.tail = V(tail)
    if parent is not None:
        b.parent = parent
        b.use_connect = (V(head) - parent.tail).length < 1e-4
    return b

hips  = bone('hips',  root, (0, 0, 0.75), (0, 0, 1.05))
spine = bone('spine', hips, (0, 0, 1.05), (0, 0, 1.45))
chest = bone('chest', spine,(0, 0, 1.45), (0, 0, 1.70))
neck  = bone('neck',  chest,(0, 0, 1.70), (0, 0, 1.82))
head  = bone('head',  neck, (0, 0, 1.82), (0, 0, 2.05))
clav_l = bone('clav_l', chest, (-0.12, 0, 1.62), (-0.35, 0, 1.58))
clav_r = bone('clav_r', chest, ( 0.12, 0, 1.62), ( 0.35, 0, 1.58))
arm_l  = bone('arm_l',  clav_l, (-0.35, 0, 1.58), (-0.55, 0, 1.20))
arm_r  = bone('arm_r',  clav_r, ( 0.35, 0, 1.58), ( 0.55, 0, 1.20))
fore_l = bone('fore_l', arm_l,  (-0.55, 0, 1.20), (-0.60, 0, 0.85))
fore_r = bone('fore_r', arm_r,  ( 0.55, 0, 1.20), ( 0.60, 0, 0.85))
thigh_l = bone('thigh_l', hips, (-0.18, 0, 0.75), (-0.18, 0, 0.40))
thigh_r = bone('thigh_r', hips, ( 0.18, 0, 0.75), ( 0.18, 0, 0.40))
shin_l  = bone('shin_l',  thigh_l, (-0.18, 0, 0.40), (-0.18, 0, 0.08))
shin_r  = bone('shin_r',  thigh_r, ( 0.18, 0, 0.40), ( 0.18, 0, 0.08))
foot_l  = bone('foot_l',  shin_l,  (-0.18, 0, 0.08), (-0.18, 0.22, 0.04))
foot_r  = bone('foot_r',  shin_r,  ( 0.18, 0, 0.08), ( 0.18, 0.22, 0.04))

bpy.ops.object.mode_set(mode='OBJECT')

# ---------- bind with automatic weights ----------
for o in bpy.context.selected_objects:
    o.select_set(False)
body.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# ---------- helpers to keyframe pose bones ----------
def ensure_action(name):
    act = bpy.data.actions.new(name)
    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = act
    return act

def key_rot(pb, frame, euler_xyz):
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = euler_xyz
    pb.keyframe_insert(data_path='rotation_euler', frame=frame)

def deg(*xyz):
    return tuple(math.radians(v) for v in xyz)

# ---------- idle (subtle breathe) ----------
idle = ensure_action('idle')
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 40
bpy.ops.object.mode_set(mode='POSE')
pb = {b.name: arm.pose.bones[b.name] for b in arm.data.bones}
for fr, chest_z, arm_z in ((1, 2, 4), (20, -2, -4), (40, 2, 4)):
    key_rot(pb['chest'], fr, deg(0, 0, chest_z))
    key_rot(pb['arm_l'], fr, deg(0, 0,  arm_z))
    key_rot(pb['arm_r'], fr, deg(0, 0, -arm_z))
# push to NLA so multiple actions survive GLB export
track = arm.animation_data.nla_tracks.new()
track.name = 'idle'
track.strips.new('idle', 1, idle)
arm.animation_data.action = None

# ---------- walk cycle ----------
walk = ensure_action('walk')
bpy.context.scene.frame_end = 24
# A-pose extremes at frames 1/13/25 (loop)
cycle = [
    # fr, thigh_l, thigh_r, shin_l, shin_r, arm_l, arm_r
    (1,  30, -30, 10,  5, -25,  25),
    (7,   0,   0, 40,  5,   0,   0),
    (13,-30,  30,  5, 10,  25, -25),
    (19,  0,   0,  5, 40,   0,   0),
    (25, 30, -30, 10,  5, -25,  25),
]
for fr, tl, tr, sl, sr, al, ar in cycle:
    key_rot(pb['thigh_l'], fr, deg(tl, 0, 0))
    key_rot(pb['thigh_r'], fr, deg(tr, 0, 0))
    key_rot(pb['shin_l'],  fr, deg(sl, 0, 0))
    key_rot(pb['shin_r'],  fr, deg(sr, 0, 0))
    key_rot(pb['arm_l'],   fr, deg(al, 0, 0))
    key_rot(pb['arm_r'],   fr, deg(ar, 0, 0))
    key_rot(pb['hips'],    fr, deg(0, 0, math.sin(fr / 25 * math.pi * 2) * 3))

track = arm.animation_data.nla_tracks.new()
track.name = 'walk'
track.strips.new('walk', 1, walk)
arm.animation_data.action = None

bpy.ops.object.mode_set(mode='OBJECT')

# ---------- export ----------
glb_path = os.path.join(OUT, NAME + '_anim.glb')
blend_path = os.path.join(OUT, NAME + '.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format='GLB',
    export_animations=True,
    export_nla_strips=True,
    export_skins=True,
    export_apply=False,
)

# ---------- report ----------
report = {
    'name': NAME,
    'glb': glb_path,
    'blend': blend_path,
    'bytes': os.path.getsize(glb_path),
    'bones': [b.name for b in arm.data.bones],
    'actions': [a.name for a in bpy.data.actions],
    'vertex_groups': [g.name for g in body.vertex_groups],
    'tris': sum(len(p.vertices) == 3 and 1 or 2 for p in body.data.polygons),
}
print('SCRATCH_BUILT', json.dumps(report, indent=2))
with open(os.path.join(OUT, NAME + '_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
