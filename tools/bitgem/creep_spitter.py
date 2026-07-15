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
# EMBER SPITTER: charred rock golem-humanoid, orange lava cracks, skull face, smoke
M_rock=mat('rock',0x3a2e28,k=0.72); M_rockD=mat('rockD',0x241c18,k=0.72)
M_lava=mat('lava',0xff6416,0xff5410,1.3); M_eye=mat('eye',0xff7a1a,0xff6a12,1.4)
M_strap=mat('strap',0x2a2018,k=0.8); M_smoke=mat('smoke',0x9a9690,k=0.9)
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

# Bulky bipedal rock golem. X=right, Y=up, Z=forward(+face). Broad shoulders, stubby legs.
# torso (big chest tapering to waist)
o,bm=newobj('torso',M_rock); ico(bm,1,(0,1.15,0),(0.5,0.42,0.36),sub=1); ico(bm,1,(0,0.82,0),(0.36,0.34,0.3),sub=1); fin(o,bm)
o,bm=newobj('abs',M_rockD); ico(bm,1,(0,0.95,0.24),(0.3,0.34,0.14),sub=1); fin(o,bm)
# head: blocky skull, sunken
o,bm=newobj('head',M_rock); ico(bm,1,(0,1.5,0.02),(0.24,0.26,0.24),sub=1); fin(o,bm)
o,bm=newobj('face',M_rockD); box(bm,0.28,0.28,0.14,(0,1.46,0.2)); fin(o,bm)
o,bm=newobj('brow',M_rock); box(bm,0.34,0.1,0.16,(0,1.58,0.18),(math.radians(10),0,0)); fin(o,bm)
# orange glowing eyes (sunken) + mouth
o,bm=newobj('eyes',M_eye)
for s in (1,-1): ico(bm,0.06,(0.1*s,1.5,0.24),(1,0.8,0.7),sub=1)
fin(o,bm)
o,bm=newobj('mouth',M_lava); box(bm,0.16,0.08,0.06,(0,1.36,0.24)); fin(o,bm)
# shoulders (big rock pauldrons)
o,bm=newobj('shoulders',M_rock)
for s in (1,-1): ico(bm,1,(0.5*s,1.32,0),(0.24,0.22,0.24),sub=1)
fin(o,bm)
# arms (thick) + big fists
o,bm=newobj('arms',M_rock)
for s in (1,-1): ico(bm,1,(0.56*s,0.95,0.02),(0.16,0.34,0.18),sub=1)
fin(o,bm)
o,bm=newobj('fists',M_rockD)
for s in (1,-1): ico(bm,1,(0.58*s,0.6,0.06),(0.2,0.2,0.2),sub=1)
fin(o,bm)
# stone bracers (straps)
o,bm=newobj('bracers',M_strap)
for s in (1,-1): box(bm,0.22,0.1,0.22,(0.57*s,0.74,0.04))
fin(o,bm)
# legs (stubby, wide) + feet
o,bm=newobj('legs',M_rock)
for s in (1,-1): ico(bm,1,(0.22*s,0.42,0),(0.19,0.32,0.2),sub=1)
fin(o,bm)
o,bm=newobj('feet',M_rockD)
for s in (1,-1): box(bm,0.26,0.16,0.4,(0.22*s,0.08,0.08))
fin(o,bm)
# ORANGE LAVA CRACKS across chest/arms/legs
o,bm=newobj('cracks',M_lava)
for x,y,z,sx,sy,sz in [(0,1.15,0.34,0.34,0.06,0.05),(0,1.0,0.32,0.06,0.3,0.05),(0.2,1.1,0.3,0.06,0.24,0.05),(-0.2,1.1,0.3,0.06,0.24,0.05),
                       (0.56,0.95,0.2,0.05,0.28,0.05),(-0.56,0.95,0.2,0.05,0.28,0.05),(0.22,0.42,0.2,0.05,0.24,0.05),(-0.22,0.42,0.2,0.05,0.24,0.05)]:
    box(bm,sx,sy,sz,(x,y,z))
fin(o,bm)
# SMOKE plumes from shoulders + head
o,bm=newobj('smoke',M_smoke)
for ax,ay,az in [(0.5,1.5,0),(-0.5,1.5,0),(0,1.75,0)]:
    for i in range(4): ico(bm,0.1-i*0.018,(ax+(0.05 if i%2 else -0.03),ay+i*0.16,az),(1,0.9,1),sub=1)
fin(o,bm,s=True)

bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
h=bpy.context.active_object; h.name='emberspitter'
h.rotation_euler=(math.radians(90),0,0); bpy.ops.object.transform_apply(rotation=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
print('exported', out)
