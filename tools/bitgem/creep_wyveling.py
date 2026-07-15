import bpy, bmesh, math, sys
from mathutils import Vector, Matrix, Euler
out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
def D(h,k=0.62): return ((h>>16&255)/255*k,(h>>8&255)/255*k,(h&255)/255*k,1)
def mat(name,hexc,emiss=None,ei=0.0,k=0.62,rough=0.85):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=D(hexc,k)
    if 'Metallic' in b.inputs: b.inputs['Metallic'].default_value=0.0
    b.inputs['Roughness'].default_value=rough
    if emiss is not None:
        b.inputs['Emission Color'].default_value=(*[c/255 for c in (emiss>>16&255,emiss>>8&255,emiss&255)],1); b.inputs['Emission Strength'].default_value=ei
    return m
# WYVELING palette: forest green scales, tan/brown belly, red glowing eyes, brown horns
M_scale=mat('scale',0x4f8a3a,k=0.8); M_scaleD=mat('scaleD',0x3a6a2a,k=0.8)
M_belly=mat('belly',0xb08048,k=0.85); M_horn=mat('horn',0x6b4a2c); M_wing=mat('wing',0x7a9a54,k=0.85)
M_eye=mat('eye',0xff3020,0xff2818,1.1); M_claw=mat('claw',0xcbb890)
objs=[]
def newobj(n,m): me=bpy.data.meshes.new(n); o=bpy.data.objects.new(n,me); bpy.context.collection.objects.link(o); o.data.materials.append(m); objs.append(o); return o,bmesh.new()
def fin(o,bm,s=True):   # wyvern is rounded/smooth (cuter)
    bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth=s
def ico(bm,r,loc,sc=(1,1,1),sub=2):
    res=bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Matrix.Diagonal(Vector((*sc,1.0))),verts=res['verts']); return res['verts']
def cone(bm,r1,r2,d,loc,rot=(0,0,0),v=5):
    res=bmesh.ops.create_cone(bm,cap_ends=True,segments=v,radius1=r1,radius2=r2,depth=d); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4(),verts=res['verts']); return res['verts']

# Bipedal chibi wyvern. X=right, Y=up, Z=forward(+face). Standing.
# body: potbelly ovoid
o,bm=newobj('body',M_scale); ico(bm,1,(0,0.72,0.05),(0.34,0.44,0.34)); fin(o,bm)
o,bm=newobj('belly',M_belly); ico(bm,1,(0,0.66,0.22),(0.26,0.34,0.2)); fin(o,bm)
# neck + head
o,bm=newobj('neck',M_scale); ico(bm,1,(0,1.02,0.12),(0.16,0.2,0.18)); fin(o,bm)
o,bm=newobj('head',M_scale); ico(bm,1,(0,1.22,0.16),(0.22,0.22,0.26)); fin(o,bm)
o,bm=newobj('snout',M_scaleD); ico(bm,1,(0,1.16,0.36),(0.14,0.13,0.16)); fin(o,bm)
o,bm=newobj('jaw',M_belly); ico(bm,1,(0,1.1,0.34),(0.11,0.07,0.13)); fin(o,bm)
# red eyes
o,bm=newobj('eyes',M_eye)
for s in (1,-1): ico(bm,0.06,(0.11*s,1.26,0.32),(1,0.8,1),sub=1)
fin(o,bm)
# brow ridges + horns (swept back)
o,bm=newobj('brow',M_scaleD)
for s in (1,-1): ico(bm,0.07,(0.12*s,1.31,0.28),(1.2,0.6,0.8),sub=1)
fin(o,bm)
o,bm=newobj('horns',M_horn)
for s in (1,-1):
    cone(bm,0.05,0.0,0.24,(0.13*s,1.36,0.02),(math.radians(40),0,math.radians(18*s)),4)   # main horns
    cone(bm,0.03,0.0,0.12,(0.2*s,1.24,0.05),(math.radians(50),0,math.radians(40*s)),4)     # cheek horn
fin(o,bm,s=False)
# arms (small)
o,bm=newobj('arms',M_scale)
for s in (1,-1): ico(bm,0.09,(0.3*s,0.72,0.16),(0.6,1.1,0.6),sub=1)
fin(o,bm)
o,bm=newobj('hands',M_claw)
for s in (1,-1):
    for cx in (-0.03,0,0.03): cone(bm,0.02,0.0,0.09,(0.32*s+cx,0.5,0.24),(math.radians(20),0,0),4)
fin(o,bm,s=False)
# wings (folded, small) — a scaled cone/blade on each shoulder-back
o,bm=newobj('wings',M_wing)
for s in (1,-1):
    v=cone(bm,0.28,0.02,0.5,(0.34*s,0.92,-0.18),(math.radians(80),math.radians(20*s),math.radians(30*s)),3)
fin(o,bm,s=False)
# legs (chunky, bird-like) + feet
o,bm=newobj('legs',M_scale)
for s in (1,-1): ico(bm,0.12,(0.16*s,0.34,0.06),(0.9,1.3,0.9),sub=1)
fin(o,bm)
o,bm=newobj('feet',M_scaleD)
for s in (1,-1): ico(bm,0.12,(0.16*s,0.06,0.14),(1,0.5,1.4),sub=1)
fin(o,bm)
o,bm=newobj('toes',M_claw)
for s in (1,-1):
    for cx in (-0.06,0,0.06): cone(bm,0.025,0.0,0.1,(0.16*s+cx,0.04,0.3),(math.radians(75),0,0),4)
fin(o,bm,s=False)
# tail (tapered, curving down-back) + spade tip
o,bm=newobj('tail',M_scale); cone(bm,0.14,0.03,0.7,(0,0.5,-0.4),(math.radians(120),0,0),6); fin(o,bm)
o,bm=newobj('tailtip',M_scaleD); v=cone(bm,0.12,0.0,0.2,(0,0.28,-0.72),(math.radians(120),0,0),4); fin(o,bm,s=False)
# belly scale ridges
o,bm=newobj('scales',M_belly)
for i,yy in enumerate([0.5,0.62,0.74]): ico(bm,0.09,(0,yy,0.3-i*0.01),(1.3,0.35,0.5),sub=1)
fin(o,bm)

bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
h=bpy.context.active_object; h.name='wyveling'
h.rotation_euler=(math.radians(90),0,0); bpy.ops.object.transform_apply(rotation=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
print('exported', out)
