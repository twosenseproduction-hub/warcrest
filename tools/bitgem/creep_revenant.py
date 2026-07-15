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
# STONE REVENANT: grey mossy stone golem, GREEN crystals, green flame core, green eyes, vines
M_stone=mat('stone',0x8a8880,k=0.85); M_stoneD=mat('stoneD',0x5c5a54,k=0.85)
M_moss=mat('moss',0x5a7a34,k=0.85); M_cryst=mat('cryst',0x6dffb0,0x4dffa0,1.2)
M_flame=mat('flame',0x8dff5a,0x6dff3a,1.5); M_eye=mat('eye',0x8dffc0,0x6dffb0,1.1); M_vine=mat('vine',0x4dc878,0x3da860,0.5)
objs=[]
def newobj(n,m): me=bpy.data.meshes.new(n); o=bpy.data.objects.new(n,me); bpy.context.collection.objects.link(o); o.data.materials.append(m); objs.append(o); return o,bmesh.new()
def fin(o,bm,s=False):
    bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth=s
def ico(bm,r,loc,sc=(1,1,1),sub=1):
    res=bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Matrix.Diagonal(Vector((*sc,1.0))),verts=res['verts']); return res['verts']
def box(bm,sx,sy,sz,loc,rot=(0,0,0)):
    res=bmesh.ops.create_cube(bm,size=1); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4()@Matrix.Diagonal(Vector((sx,sy,sz,1.0))),verts=res['verts']); return res['verts']
def cone(bm,r1,r2,d,loc,rot=(0,0,0),v=6):
    res=bmesh.ops.create_cone(bm,cap_ends=True,segments=v,radius1=r1,radius2=r2,depth=d); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4(),verts=res['verts']); return res['verts']
def crystal(bm,size,loc,rot):
    res=bmesh.ops.create_cone(bm,cap_ends=True,segments=4,radius1=size*0.4,radius2=0.0,depth=size); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4(),verts=res['verts'])

# Blocky stone golem. X=right, Y=up, Z=forward(+face). BOXY (chiseled stone blocks).
o,bm=newobj('torso',M_stone); box(bm,0.7,0.5,0.42,(0,1.15,0)); box(bm,0.5,0.36,0.34,(0,0.82,0)); fin(o,bm)
o,bm=newobj('chestcore',M_stoneD); box(bm,0.26,0.3,0.16,(0,1.12,0.22)); fin(o,bm)   # recessed chest cavity
# head: blocky skull
o,bm=newobj('head',M_stone); box(bm,0.34,0.34,0.32,(0,1.62,0.02)); fin(o,bm)
o,bm=newobj('jaw',M_stoneD); box(bm,0.28,0.14,0.24,(0,1.5,0.08)); fin(o,bm)
o,bm=newobj('eyes',M_eye)
for s in (1,-1): ico(bm,0.06,(0.1*s,1.64,0.18),(1,0.8,0.7),sub=1)
fin(o,bm,s=True)
# shoulders + arms + fists (big boxy)
o,bm=newobj('shoulders',M_stone)
for s in (1,-1): box(bm,0.28,0.28,0.32,(0.5*s,1.34,0))
fin(o,bm)
o,bm=newobj('arms',M_stone)
for s in (1,-1): box(bm,0.22,0.5,0.24,(0.56*s,0.95,0.02))
fin(o,bm)
o,bm=newobj('fists',M_stoneD)
for s in (1,-1): box(bm,0.28,0.28,0.28,(0.58*s,0.6,0.04))
fin(o,bm)
# legs + feet (boxy)
o,bm=newobj('legs',M_stone)
for s in (1,-1): box(bm,0.26,0.5,0.28,(0.22*s,0.4,0))
fin(o,bm)
o,bm=newobj('feet',M_stoneD)
for s in (1,-1): box(bm,0.3,0.18,0.42,(0.22*s,0.09,0.06))
fin(o,bm)
# MOSS patches (green) on shoulders, chest, legs
o,bm=newobj('moss',M_moss)
for x,y,z,sx,sy,sz in [(0.5,1.42,0.14,0.24,0.1,0.05),(-0.2,1.2,0.22,0.2,0.14,0.05),(0.22,0.5,0.16,0.16,0.16,0.05),(0,1.72,0.1,0.2,0.08,0.05)]:
    box(bm,sx,sy,sz,(x,y,z))
fin(o,bm)
# GREEN flame core in the chest cavity
o,bm=newobj('flame',M_flame)
for i,(dy,sc) in enumerate([(0,0.16),(0.1,0.12),(0.18,0.08)]): ico(bm,1,(0,1.12+dy,0.24),(sc,sc*1.4,sc*0.7),sub=1)
fin(o,bm,s=True)
# GREEN crystals jutting from head + shoulders
o,bm=newobj('crystals',M_cryst)
for x,y,z,rx,rz,sz in [(0,2.0,0.0,0,0,0.4),(0.14,1.95,0,-0.2,0.4,0.3),(-0.14,1.95,0,-0.2,-0.4,0.3),
                        (0.6,1.5,0,-0.3,-0.8,0.34),(-0.6,1.5,0,-0.3,0.8,0.34),(0.52,1.55,-0.14,0.4,-0.6,0.24),(-0.52,1.55,-0.14,0.4,0.6,0.24)]:
    crystal(bm,sz,(x,y,z),(rx,0,rz))
fin(o,bm,s=False)
# GREEN vines/tendrils wrapping (thin curved boxes)
o,bm=newobj('vines',M_vine)
for x,y,z,sx,sy,sz,rz in [(0.3,1.0,0.28,0.04,0.5,0.04,0.4),(-0.3,0.95,0.28,0.04,0.5,0.04,-0.4),(0.5,0.85,0.1,0.04,0.4,0.04,0.2),(-0.5,0.85,0.1,0.04,0.4,0.04,-0.2)]:
    box(bm,sx,sy,sz,(x,y,z),(0,0,rz))
fin(o,bm,s=True)

bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
h=bpy.context.active_object; h.name='revenant'
h.rotation_euler=(math.radians(90),0,0); bpy.ops.object.transform_apply(rotation=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
print('exported', out)
