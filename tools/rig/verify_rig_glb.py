#!/usr/bin/env python3
"""Verify a rigged GLB: list armatures, bones, actions, and optionally render walk frames.

  blender -b -noaudio --python tools/rig/verify_rig_glb.py -- \
    --glb exports/blender-rig-test/scratch_walker_anim.glb \
    --clip walk --frames 1,7,13,19 --out exports/blender-rig-test/frames
"""
import bpy, sys, os, json, math

def argval(flag, default=None):
    a = sys.argv
    if '--' in a:
        a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

GLB = argval('--glb')
CLIP = argval('--clip', 'walk')
FRAMES = [int(x) for x in argval('--frames', '1,7,13,19').split(',') if x]
OUT = argval('--out', os.path.dirname(GLB) + '/frames')
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.materials):
    for d in list(blk):
        blk.remove(d)

bpy.ops.import_scene.gltf(filepath=GLB)

arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
actions = list(bpy.data.actions)

info = {
    'glb': GLB,
    'bytes': os.path.getsize(GLB),
    'armatures': [a.name for a in arms],
    'meshes': [{'name': m.name, 'verts': len(m.data.vertices), 'polys': len(m.data.polygons),
                'groups': [g.name for g in m.vertex_groups]} for m in meshes],
    'actions': [{'name': a.name, 'fcurves': len(a.fcurves),
                 'frames': [int(a.frame_range[0]), int(a.frame_range[1])]} for a in actions],
}
print('VERIFY', json.dumps(info, indent=2))

if not arms:
    print('FAIL: no armature')
    sys.exit(1)
if not actions:
    print('FAIL: no actions/animations')
    sys.exit(1)

arm = arms[0]
# Pick matching action (NLA strip names often become ActionName_Armature or similar)
act = None
for a in actions:
    if CLIP.lower() in a.name.lower():
        act = a
        break
if act is None:
    act = actions[0]
    print('WARN: clip', CLIP, 'not found; using', act.name)

if not arm.animation_data:
    arm.animation_data_create()
arm.animation_data.action = act

# Frame camera on the combined mesh bounding box (donor Bitgem units are ~cm-scale)
import mathutils
mn = mathutils.Vector((1e9, 1e9, 1e9))
mx = mathutils.Vector((-1e9, -1e9, -1e9))
for m in meshes:
    for c in m.bound_box:
        w = m.matrix_world @ mathutils.Vector(c)
        mn = mathutils.Vector((min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)))
        mx = mathutils.Vector((max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)))
center = (mn + mx) * 0.5
size = (mx - mn).length or 1.0
print('BBOX', tuple(mn), tuple(mx), 'size', size)

dist = size * 1.8
cam_loc = center + mathutils.Vector((dist * 0.55, -dist * 0.75, dist * 0.35))
bpy.ops.object.camera_add(location=cam_loc)
cam = bpy.context.active_object
direction = center - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam
bpy.ops.object.light_add(type='SUN', location=center + mathutils.Vector((size, -size, size * 2)))
info['bbox'] = {'min': list(mn), 'max': list(mx), 'size': size}

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.image_settings.file_format = 'PNG'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'

base = os.path.splitext(os.path.basename(GLB))[0]
rendered = []
for fr in FRAMES:
    scene.frame_set(fr)
    path = os.path.join(OUT, f'{base}_{act.name}_f{fr:03d}.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    rendered.append(path)
    print('RENDERED', path)

info['used_action'] = act.name
info['rendered'] = rendered
with open(os.path.join(OUT, base + '_verify.json'), 'w') as f:
    json.dump(info, f, indent=2)
print('OK', act.name, 'bones=', len(arm.data.bones), 'actions=', len(actions))
