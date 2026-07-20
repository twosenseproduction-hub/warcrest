#!/usr/bin/env python3
"""Render turntable stills of a static (or animated) GLB for visual critique.

Part of blender-reference-character skill. Angle 0 = front (camera on -Y).

  blender -b -noaudio --python .claude/skills/blender-reference-character/scripts/render_views.py -- \
    --glb exports/blender-rig-test/antler_elf.glb \
    --out exports/blender-rig-test/frames \
    --angles 0,35,90 \
    --mode studio|raking|clay

Modes: studio (beauty), raking (form light), clay (flat grey + raking).
"""
import bpy, mathutils, math, sys, os, json
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a:
        a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

GLB = argval('--glb')
OUT = argval('--out', os.path.dirname(GLB) + '/frames')
ANGLES = [float(x) for x in argval('--angles', '0,45,90,180').split(',')]
RES = int(argval('--res', '768'))
# studio = beauty lights; raking = low-angle form light; clay = flat grey + raking
MODE = (argval('--mode', 'studio') or 'studio').lower()
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for d in list(blk):
        blk.remove(d)

bpy.ops.import_scene.gltf(filepath=GLB)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']

mn = V((1e9,) * 3); mx = V((-1e9,) * 3)
for m in meshes:
    for c in m.bound_box:
        w = m.matrix_world @ V(c)
        mn = V((min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)))
        mx = V((max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)))
center = (mn + mx) * 0.5
size = (mx - mn).length or 1.0
print('BBOX', list(mn), list(mx), 'size', size)

scene = bpy.context.scene

def _clay_override():
    """Replace materials with flat mid-grey so only form/light reads."""
    mat = bpy.data.materials.new(name='ClayScan')
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.55, 0.55, 0.58, 1)
    bsdf.inputs['Roughness'].default_value = 0.55
    if 'Specular' in bsdf.inputs:
        bsdf.inputs['Specular'].default_value = 0.15
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    for ob in meshes:
        if ob.data:
            ob.data.materials.clear()
            ob.data.materials.append(mat)

if MODE in ('raking', 'clay'):
    # Form-revealing: single hard sun from the side (sculptor's raking light).
    # Matches lidar-light-scan.md — compare these stills to reference luminance/edges.
    if MODE == 'clay':
        _clay_override()
    bpy.ops.object.light_add(type='SUN', location=(size * 1.2, -size * 0.2, size * 0.35))
    sun = bpy.context.active_object
    sun.data.energy = 4.5 if MODE == 'clay' else 3.6
    sun.rotation_euler = (math.radians(75), math.radians(5), math.radians(55))
    bpy.ops.object.light_add(type='AREA', location=(-size * 0.8, size * 0.4, size * 0.5))
    fill = bpy.context.active_object
    fill.data.energy = 18
    fill.data.size = size * 1.2
else:
    # studio beauty lights
    bpy.ops.object.light_add(type='SUN', location=(size, -size, size * 2))
    sun = bpy.context.active_object
    sun.data.energy = 2.8
    sun.rotation_euler = (math.radians(50), math.radians(20), math.radians(30))
    bpy.ops.object.light_add(type='AREA', location=(-size, size * 0.5, size * 1.5))
    fill = bpy.context.active_object
    fill.data.energy = 80
    fill.data.size = size
    bpy.ops.object.light_add(type='AREA', location=(0, -size, size * 0.8))
    rim = bpy.context.active_object
    rim.data.energy = 40
    rim.data.size = size * 0.6

# EEVEE if available, else workbench
try:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 32
    scene.eevee.use_bloom = (MODE == 'studio')
    if MODE == 'studio':
        scene.eevee.bloom_threshold = 0.85
        scene.eevee.bloom_intensity = 0.35
except Exception:
    scene.render.engine = 'BLENDER_WORKBENCH'

scene.render.resolution_x = RES
scene.render.resolution_y = RES
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
# soft dark bg
world = bpy.data.worlds.new('Studio')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.12, 0.12, 0.14, 1)
bg.inputs['Strength'].default_value = 0.6

dist = size * 1.55
base = os.path.splitext(os.path.basename(GLB))[0]
rendered = []

bpy.ops.object.camera_add()
cam = bpy.context.active_object
scene.camera = cam
cam.data.lens = 50

# Character faces -Y; angle 0 = front camera on -Y looking toward +Y.
for ang in ANGLES:
    rad = math.radians(ang)
    cam.location = center + V((math.sin(rad) * dist, -math.cos(rad) * dist, size * 0.12))
    direction = center - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    suffix = '' if MODE == 'studio' else f'_{MODE}'
    path = os.path.join(OUT, f'{base}_view_{int(ang):03d}{suffix}.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    rendered.append(path)
    print('RENDERED', path)

info = {
    'glb': GLB,
    'mode': MODE,
    'bbox': {'min': list(mn), 'max': list(mx), 'size': size},
    'rendered': rendered,
}
with open(os.path.join(OUT, base + '_views.json'), 'w') as f:
    json.dump(info, f, indent=2)
print('OK', len(rendered), 'views')
