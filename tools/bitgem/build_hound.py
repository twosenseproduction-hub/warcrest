import bpy, bmesh, math, sys
from mathutils import Vector, Matrix
out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- Bitgem toon material: flat base color darkened for the game's bright ramp
def D(h, k=0.62):
    r=(h>>16&255)/255; g=(h>>8&255)/255; b=(h&255)/255
    return (r*k, g*k, b*k, 1)
def mat(name, hexc, emiss=None, ei=0.0, k=0.62):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=D(hexc,k)
    if 'Metallic' in bsdf.inputs: bsdf.inputs['Metallic'].default_value=0.0
    bsdf.inputs['Roughness'].default_value=0.85
    if emiss is not None:
        bsdf.inputs['Emission Color'].default_value=(*[c/255 for c in ((emiss>>16&255,emiss>>8&255,emiss&255))],1)
        bsdf.inputs['Emission Strength'].default_value=ei
    return m

M_body = mat('hound_body', 0x4a4a52)     # ashen grey-violet hide
M_bodyD= mat('hound_bodyD',0x2e2e36)     # darker underbelly/legs
M_eye  = mat('hound_eye', 0x9dff4a, 0x9dff4a, 0.5)  # glowing green eyes
M_crack= mat('hound_crack',0x9dff4a, 0x9dff4a, 0.4) # ember cracks (green)
M_tooth= mat('hound_tooth',0xe8e2cc)     # bone teeth/claws
M_maw  = mat('hound_maw', 0x1a0f14)      # dark mouth

objs=[]
def add(meshname, verts_source_obj):
    objs.append(verts_source_obj)

def prim(kind, name, mat_, loc=(0,0,0), scale=(1,1,1), rot=(0,0,0), **kw):
    if kind=='ico': bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=kw.get('sub',2), radius=1, location=loc)
    elif kind=='uv': bpy.ops.mesh.primitive_uv_sphere_add(segments=kw.get('seg',12), ring_count=kw.get('ring',8), radius=1, location=loc)
    elif kind=='cone': bpy.ops.mesh.primitive_cone_add(vertices=kw.get('v',8), radius1=1, radius2=kw.get('r2',0), depth=2, location=loc)
    elif kind=='cyl': bpy.ops.mesh.primitive_cylinder_add(vertices=kw.get('v',10), radius=1, depth=2, location=loc)
    elif kind=='cube': bpy.ops.mesh.primitive_cube_add(size=2, location=loc)
    o=bpy.context.active_object; o.name=name
    o.scale=scale; o.rotation_euler=rot
    o.data.materials.append(mat_)
    objs.append(o)
    return o

# Bitgem chibi beast: chunky body along +Z (forward), big head, short thick legs.
# ---- body: thick rounded barrel ----
prim('ico','body', M_body, loc=(0,0.62,0.0), scale=(0.42,0.42,0.66), sub=3)
# haunches (rear, bigger) + chest (front)
prim('ico','haunch', M_body, loc=(0,0.66,-0.5), scale=(0.44,0.46,0.4), sub=3)
prim('ico','chest', M_body, loc=(0,0.6,0.45), scale=(0.4,0.4,0.4), sub=3)
# ---- neck + head (big, blocky-rounded, facing +Z) ----
prim('ico','neck', M_body, loc=(0,0.78,0.62), scale=(0.24,0.26,0.3), sub=2)
head=prim('ico','head', M_body, loc=(0,0.92,0.98), scale=(0.36,0.34,0.4), sub=3)
# muzzle/snout
prim('ico','snout', M_body, loc=(0,0.82,1.28), scale=(0.22,0.2,0.26), sub=2)
prim('cube','maw', M_maw, loc=(0,0.78,1.42), scale=(0.16,0.09,0.1))
# ears (pointed, swept back)
for s in (1,-1):
    e=prim('cone','ear', M_bodyD, loc=(0.22*s,1.2,0.86), scale=(0.1,0.18,0.06), v=4)
    e.rotation_euler=(math.radians(-30), math.radians(20*s), math.radians(15*s))
# glowing eyes
for s in (1,-1):
    prim('ico','eye', M_eye, loc=(0.16*s,0.98,1.2), scale=(0.07,0.09,0.06), sub=2)
# brow ridges
for s in (1,-1):
    b=prim('cube','brow', M_bodyD, loc=(0.17*s,1.06,1.16), scale=(0.1,0.04,0.08)); b.rotation_euler=(0,0,math.radians(12*s))
# teeth (upper fangs)
for s in (1,-1):
    t=prim('cone','fang', M_tooth, loc=(0.09*s,0.74,1.42), scale=(0.03,0.08,0.03), v=4); t.rotation_euler=(math.radians(180),0,0)
# ---- legs: 4 chunky tapered (front pair fwd, rear pair back) ----
for s in (1,-1):
    prim('cyl','legFU', M_body, loc=(0.26*s,0.4,0.5), scale=(0.12,0.12,0.24), v=8, rot=(math.radians(90),0,0))
    prim('cyl','legFL', M_bodyD, loc=(0.26*s,0.16,0.52), scale=(0.1,0.1,0.16), v=8, rot=(math.radians(90),0,0))
    prim('ico','pawF', M_bodyD, loc=(0.26*s,0.06,0.6), scale=(0.12,0.08,0.16), sub=2)
    prim('cyl','legRU', M_body, loc=(0.28*s,0.42,-0.5), scale=(0.14,0.14,0.26), v=8, rot=(math.radians(90),0,0))
    prim('cyl','legRL', M_bodyD, loc=(0.28*s,0.16,-0.46), scale=(0.1,0.1,0.16), v=8, rot=(math.radians(90),0,0))
    prim('ico','pawR', M_bodyD, loc=(0.28*s,0.06,-0.4), scale=(0.12,0.08,0.16), sub=2)
# ---- tail: tapered, raised ----
tail=prim('cone','tail', M_body, loc=(0,0.8,-0.95), scale=(0.1,0.1,0.4), v=6); tail.rotation_euler=(math.radians(60),0,0)
# ---- ember cracks: a few glowing green ridges along the spine ----
for z in (0.3,0.0,-0.3):
    prim('cube','crack', M_crack, loc=(0,1.02,z), scale=(0.03,0.05,0.08))

# smooth-shade everything
for o in objs:
    for p in o.data.polygons: p.use_smooth=True

# join into one mesh
bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]
bpy.ops.object.join()
hound=bpy.context.active_object; hound.name='hound'
# authored Y-up; rotate into Blender Z-up so export_yup gives correct Y-up gltf
hound.rotation_euler=(math.radians(90),0,0)
bpy.ops.object.transform_apply(rotation=True)

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
print('exported', out)
