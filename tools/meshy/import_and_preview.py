#!/usr/bin/env python3
"""Import a Meshy/Tripo GLB, normalize axes, export Warcrest-facing GLB + PNGs.

  blender -b -noaudio --python tools/meshy/import_and_preview.py -- \
    --glb exports/meshy/violet_cape/model.glb \
    --name violet_cape_meshy \
    --out exports/meshy/violet_cape/preview
"""
import bpy, mathutils, math, sys, os, json, shutil
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a:
        a = a[a.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

GLB = argval('--glb')
NAME = argval('--name', os.path.splitext(os.path.basename(GLB))[0])
OUT = argval('--out', os.path.join(os.path.dirname(GLB), 'preview'))
RES = int(argval('--res', '768'))
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
if not meshes:
    raise SystemExit('no meshes in GLB')

# Join for simple preview / grounding
for o in bpy.context.selected_objects:
    o.select_set(False)
for m in meshes:
    m.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = NAME

# Ground feet to z=0, center X, try face -Y if taller than wide in Y... keep as-is;
# Meshy often Y-up — glTF importer usually converts to Z-up already.
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
bpy.context.view_layer.update()
coords = [body.matrix_world @ V(c) for c in body.bound_box]
zs = [c.z for c in coords]
xs = [c.x for c in coords]
ys = [c.y for c in coords]
body.location.z -= min(zs)
body.location.x -= (min(xs) + max(xs)) * 0.5
bpy.context.view_layer.update()

out_glb = os.path.join(OUT, NAME + '.glb')
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_apply=True)

# Render via skill script path relative to repo
repo = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
render = os.path.join(repo, '.claude/skills/blender-reference-character/scripts/render_views.py')
# Inline minimal studio render (avoid nested blender)
mn = V((min(xs), min(ys), 0.0))
# refresh bbox
coords = [body.matrix_world @ V(c) for c in body.bound_box]
mn = V((min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords)))
mx = V((max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords)))
center = (mn + mx) * 0.5
size = (mx - mn).length or 1.0

# lights
bpy.ops.object.light_add(type='SUN', location=(size, -size, size * 2))
sun = bpy.context.active_object
sun.data.energy = 2.8
sun.rotation_euler = (math.radians(50), math.radians(20), math.radians(30))

scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 32
    scene.eevee.use_bloom = False
except Exception:
    scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = RES
scene.render.resolution_y = RES
scene.render.image_settings.file_format = 'PNG'
world = bpy.data.worlds.new('Studio')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.12, 0.12, 0.14, 1)
bg.inputs['Strength'].default_value = 0.6

bpy.ops.object.camera_add()
cam = bpy.context.active_object
scene.camera = cam
cam.data.lens = 50
dist = size * 1.55
rendered = []
for ang in (0.0, 35.0, 90.0):
    rad = math.radians(ang)
    cam.location = center + V((math.sin(rad) * dist, -math.cos(rad) * dist, size * 0.12))
    direction = center - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    path = os.path.join(OUT, f'{NAME}_view_{int(ang):03d}.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    rendered.append(path)
    print('RENDERED', path)

# clay pass
mat = bpy.data.materials.new('Clay')
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
outn = nt.nodes.new('ShaderNodeOutputMaterial')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
bsdf.inputs['Base Color'].default_value = (0.55, 0.55, 0.58, 1)
bsdf.inputs['Roughness'].default_value = 0.55
nt.links.new(bsdf.outputs['BSDF'], outn.inputs['Surface'])
body.data.materials.clear()
body.data.materials.append(mat)
# raking sun
for o in list(bpy.data.objects):
    if o.type == 'LIGHT':
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.light_add(type='SUN', location=(size * 1.2, -size * 0.2, size * 0.35))
sun = bpy.context.active_object
sun.data.energy = 4.5
sun.rotation_euler = (math.radians(75), math.radians(5), math.radians(55))
path = os.path.join(OUT, f'{NAME}_view_000_clay.png')
cam.location = center + V((0, -dist, size * 0.12))
direction = center - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = path
bpy.ops.render.render(write_still=True)
rendered.append(path)
print('RENDERED', path)

info = {
    'source_glb': GLB,
    'normalized_glb': out_glb,
    'rendered': rendered,
    'bbox': {'min': list(mn), 'max': list(mx), 'size': size},
    'note': 'Meshy import preview — sharp detail from neural mesh, not sphere kit',
}
with open(os.path.join(OUT, NAME + '_preview.json'), 'w') as f:
    json.dump(info, f, indent=2)
print('OK', json.dumps(info, indent=2))
