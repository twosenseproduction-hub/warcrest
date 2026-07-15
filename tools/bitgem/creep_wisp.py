import bpy, bmesh, math, sys
from mathutils import Vector, Matrix, Euler
out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
def D(h,k=0.62): return ((h>>16&255)/255*k,(h>>8&255)/255*k,(h&255)/255*k,1)
def mat(name,hexc,emiss=None,ei=0.0,k=0.62,rough=0.9):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=D(hexc,k)
    if 'Metallic' in b.inputs: b.inputs['Metallic'].default_value=0.0
    b.inputs['Roughness'].default_value=rough
    if emiss is not None:
        b.inputs['Emission Color'].default_value=(*[c/255 for c in (emiss>>16&255,emiss>>8&255,emiss&255)],1); b.inputs['Emission Strength'].default_value=ei
    return m
M_rock=mat('rock',0x322a2c,k=0.7); M_rockD=mat('rockD',0x1c1618,k=0.7)
M_lava=mat('lava',0xff6a18,0xff5a12,1.3); M_green=mat('green',0x8dff3a,0x7dff2a,1.2)
M_smoke=mat('smoke',0x9a969a,k=0.9)
objs=[]
def newobj(n,m): me=bpy.data.meshes.new(n); o=bpy.data.objects.new(n,me); bpy.context.collection.objects.link(o); o.data.materials.append(m); objs.append(o); return o,bmesh.new()
def fin(o,bm,s=False):
    bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth=s
def ico(bm,r,loc,sc=(1,1,1),sub=1):
    res=bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Matrix.Diagonal(Vector((*sc,1.0))),verts=res['verts']); return res['verts']
def box(bm,sx,sy,sz,loc,rot=(0,0,0)):
    res=bmesh.ops.create_cube(bm,size=1); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4()@Matrix.Diagonal(Vector((sx,sy,sz,1.0))),verts=res['verts']); return res['verts']

# MOLTEN WISP: a levitating chunky ember-rock. Orange lava on top, green glow at base,
# a rising smoke plume, floating rubble. Y=up. Hovers (base ~0.5 off ground).
BASE=0.75
# main rock body (faceted, egg-ish, vertical)
o,bm=newobj('rock',M_rock); ico(bm,1,(0,BASE,0),(0.36,0.46,0.34),sub=1); fin(o,bm)
o,bm=newobj('rock2',M_rock); ico(bm,1,(0.12,BASE+0.14,0.06),(0.2,0.24,0.2),sub=1); fin(o,bm)
o,bm=newobj('rock3',M_rockD); ico(bm,1,(-0.1,BASE-0.16,-0.04),(0.24,0.2,0.22),sub=1); fin(o,bm)
# orange lava cracks over the TOP half
o,bm=newobj('lava',M_lava)
for x,y,z,sx,sy,sz in [(0,BASE+0.24,0.28,0.16,0.1,0.05),(0.14,BASE+0.06,0.26,0.06,0.22,0.05),(-0.14,BASE+0.1,0.24,0.06,0.2,0.05),(0,BASE+0.02,0.3,0.22,0.06,0.05)]:
    box(bm,sx,sy,sz,(x,y,z))
ico(bm,0.14,(0,BASE+0.34,0.02),(1,0.7,1),sub=1)   # molten cap
fin(o,bm)
# green glow at the BASE
o,bm=newobj('green',M_green)
for x,y,z,sx,sy,sz in [(0,BASE-0.32,0.24,0.24,0.1,0.05),(0.1,BASE-0.22,0.26,0.05,0.16,0.05),(-0.1,BASE-0.22,0.26,0.05,0.16,0.05)]:
    box(bm,sx,sy,sz,(x,y,z))
ico(bm,0.16,(0,BASE-0.42,0),(1,0.6,1),sub=1)      # green underglow
fin(o,bm)
# floating rubble
o,bm=newobj('rubble',M_rockD)
for x,y,z in [(0.4,BASE+0.1,0.1),(-0.38,BASE-0.1,-0.05),(0.3,BASE-0.34,0.15),(-0.28,BASE+0.3,0.1)]:
    ico(bm,0.06,(x,y,z),(1,1,1),sub=0)
fin(o,bm)
# rising smoke plume (tapered curl of chunks)
o,bm=newobj('smoke',M_smoke)
sy=BASE+0.5
for i,(dx,dz) in enumerate([(0,0),(0.06,0.02),(0.02,0.05),(-0.05,0.03),(-0.02,-0.02)]):
    ico(bm,0.11-i*0.015,(dx,sy+i*0.16,dz),(1,0.9,1),sub=1)
fin(o,bm,s=True)

bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
h=bpy.context.active_object; h.name='moltenwisp'
h.rotation_euler=(math.radians(90),0,0); bpy.ops.object.transform_apply(rotation=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
print('exported', out)
