import bpy, bmesh, math, sys
from mathutils import Vector, Matrix, Euler
out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
def D(h,k=0.62): return ((h>>16&255)/255*k,(h>>8&255)/255*k,(h&255)/255*k,1)
def mat(name,hexc,emiss=None,ei=0.0,k=0.62,rough=0.92):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=D(hexc,k)
    if 'Metallic' in b.inputs: b.inputs['Metallic'].default_value=0.0
    b.inputs['Roughness'].default_value=rough
    if emiss is not None:
        b.inputs['Emission Color'].default_value=(*[c/255 for c in (emiss>>16&255,emiss>>8&255,emiss&255)],1); b.inputs['Emission Strength'].default_value=ei
    return m
# ASH TREANT: grey dead wood, amber crystal core in head-branches, orange eyes, roots, fungus, floating rocks
M_bark=mat('bark',0x585a5e,k=0.85); M_barkD=mat('barkD',0x3a3c40,k=0.85)
M_wood=mat('wood',0x6b5236,k=0.85); M_cryst=mat('cryst',0xffcf6a,0xffb84a,1.4)
M_eye=mat('eye',0xff9a2a,0xff8a1a,1.2); M_fung=mat('fung',0x9a6a4a,k=0.85); M_rock=mat('rock',0x7a7c80,k=0.9)
objs=[]
def newobj(n,m): me=bpy.data.meshes.new(n); o=bpy.data.objects.new(n,me); bpy.context.collection.objects.link(o); o.data.materials.append(m); objs.append(o); return o,bmesh.new()
def fin(o,bm,s=True):
    bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth=s
def ico(bm,r,loc,sc=(1,1,1),sub=2):
    res=bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Matrix.Diagonal(Vector((*sc,1.0))),verts=res['verts']); return res['verts']
def cyl(bm,r1,r2,d,loc,rot=(0,0,0),v=6):
    res=bmesh.ops.create_cone(bm,cap_ends=True,segments=v,radius1=r1,radius2=r2,depth=d); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4(),verts=res['verts']); return res['verts']
def branch(bm,base,tip,r):
    d=Vector(tip)-Vector(base); q=Vector((0,0,1)).rotation_difference(d.normalized())
    res=bmesh.ops.create_cone(bm,cap_ends=True,segments=5,radius1=r,radius2=r*0.4,depth=d.length)
    bmesh.ops.transform(bm,matrix=Matrix.Translation((Vector(base)+Vector(tip))*0.5)@q.to_matrix().to_4x4(),verts=res['verts'])

# Tall thin treant. X=right, Y=up, Z=forward(+face). Trunk body.
o,bm=newobj('trunk',M_bark); ico(bm,1,(0,1.2,0),(0.26,0.5,0.24)); ico(bm,1,(0,0.7,0),(0.22,0.36,0.22)); fin(o,bm)
o,bm=newobj('chest',M_barkD); ico(bm,1,(0,1.25,0.18),(0.16,0.3,0.1)); fin(o,bm)   # carved face-of-torso
# head (gnarled) + orange eyes + jaw
o,bm=newobj('head',M_bark); ico(bm,1,(0,1.85,0.02),(0.22,0.24,0.22)); fin(o,bm)
o,bm=newobj('brow',M_barkD)
for s in (1,-1): ico(bm,0.08,(0.11*s,1.9,0.16),(1.1,0.5,0.7),sub=1)
fin(o,bm,s=False)
o,bm=newobj('eyes',M_eye)
for s in (1,-1): ico(bm,0.055,(0.09*s,1.85,0.18),(1,0.8,0.7),sub=1)
fin(o,bm)
o,bm=newobj('jaw',M_barkD); cyl(bm,0.1,0.08,0.16,(0,1.74,0.14),(math.radians(90),0,0),5); fin(o,bm,s=False)
# BRANCH CROWN radiating from the head (gnarled twigs) with amber crystal in the middle
o,bm=newobj('crown',M_wood)
import math as _m
for i in range(9):
    a=_m.radians(i/9*360); r=0.5
    branch(bm,(0,2.02,0),(_m.sin(a)*r,2.02+0.4,_m.cos(a)*r),0.03)
fin(o,bm,s=False)
o,bm=newobj('core',M_cryst); ico(bm,0.16,(0,2.08,0),(0.8,1.3,0.8),sub=1); fin(o,bm,s=False)
# arms: gnarled branches with twig fingers
o,bm=newobj('arms',M_bark)
for s in (1,-1): branch(bm,(0.22*s,1.35,0),(0.5*s,0.85,0.08),0.08)
fin(o,bm)
o,bm=newobj('fingers',M_wood)
for s in (1,-1):
    for fa in (-0.3,0,0.3): branch(bm,(0.52*s,0.78,0.08),(0.56*s+fa*0.15,0.55,0.2+fa*0.1),0.02)
fin(o,bm,s=False)
# legs: root-like, splaying at the base
o,bm=newobj('legs',M_bark)
for s in (1,-1): cyl(bm,0.12,0.16,0.7,(0.14*s,0.4,0),(0,0,math.radians(-4*s)),6)
fin(o,bm)
o,bm=newobj('roots',M_barkD)
for s in (1,-1):
    for ra,rz in [(0.16,0.1),(0.0,0.2),(-0.16,-0.14)]: branch(bm,(0.14*s,0.15,0),(0.14*s+ra,0.02,rz),0.05)
fin(o,bm)
# fungus shelves on the legs
o,bm=newobj('fungus',M_fung)
for x,y,z in [(0.2,0.5,0.16),(-0.18,0.62,0.14),(0.16,0.3,0.16)]: ico(bm,0.08,(x,y,z),(1.4,0.4,1.0),sub=1)
fin(o,bm,s=False)
# floating grey rock chunks around the crown (Bitgem levitation motif)
o,bm=newobj('rocks',M_rock)
for x,y,z in [(0.5,2.1,0.1),(-0.46,2.2,-0.05),(0.3,2.4,0.1),(-0.3,1.9,0.2),(0.15,2.5,-0.1)]:
    ico(bm,0.07,(x,y,z),(1,1,1),sub=0)
fin(o,bm,s=False)

bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
h=bpy.context.active_object; h.name='ashtreant'
h.rotation_euler=(math.radians(90),0,0); bpy.ops.object.transform_apply(rotation=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
print('exported', out)
