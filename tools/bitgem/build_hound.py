import bpy, bmesh, math, sys
from mathutils import Vector, Matrix, Euler
out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)

def D(h, k=0.6):
    return ((h>>16&255)/255*k, (h>>8&255)/255*k, (h&255)/255*k, 1)
def mat(name, hexc, emiss=None, ei=0.0, k=0.6, rough=0.85):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=D(hexc,k)
    if 'Metallic' in b.inputs: b.inputs['Metallic'].default_value=0.0
    b.inputs['Roughness'].default_value=rough
    if emiss is not None:
        b.inputs['Emission Color'].default_value=(*[c/255 for c in (emiss>>16&255,emiss>>8&255,emiss&255)],1)
        b.inputs['Emission Strength'].default_value=ei
    return m

M_hide  = mat('hide',   0x54525c)
M_hideD = mat('hideD',  0x322f38)
M_rock  = mat('rock',   0x3b3841)
M_eye   = mat('eye',    0xbcff5e, 0xbcff5e, 0.7)
M_ember = mat('ember',  0xa6ff3a, 0x9dff4a, 0.6)
M_tooth = mat('tooth',  0xe9e3cd)
M_maw   = mat('maw',    0x160a10)

objs=[]
def newobj(name, mat_):
    me=bpy.data.meshes.new(name); o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); o.data.materials.append(mat_); objs.append(o); return o,bmesh.new()
def fin(o,bm,smooth=True):
    bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth=smooth
def ico(bm,r,loc,scale=(1,1,1),sub=2):
    res=bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r)
    bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Matrix.Diagonal(Vector((*scale,1.0))),verts=res['verts']); return res['verts']
def cone(bm,r1,r2,depth,loc,rot=(0,0,0),v=6):
    res=bmesh.ops.create_cone(bm,cap_ends=True,segments=v,radius1=r1,radius2=r2,depth=depth)
    bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4(),verts=res['verts']); return res['verts']
def box(bm,sx,sy,sz,loc,rot=(0,0,0)):
    res=bmesh.ops.create_cube(bm,size=1)
    bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4()@Matrix.Diagonal(Vector((sx,sy,sz,1.0))),verts=res['verts']); return res['verts']

# FIERCE cinder-hound. axes: X=right, Y=up, Z=forward(+head).
o,bm=newobj('torso',M_hide)
ico(bm,1,(0,0.72,0.28),(0.34,0.4,0.4)); ico(bm,1,(0,0.6,-0.05),(0.3,0.32,0.4)); ico(bm,1,(0,0.66,-0.42),(0.36,0.38,0.36)); fin(o,bm)
o,bm=newobj('belly',M_hideD); ico(bm,1,(0,0.5,-0.05),(0.28,0.22,0.62)); fin(o,bm)
o,bm=newobj('neck',M_hide); ico(bm,1,(0,0.62,0.6),(0.22,0.24,0.28)); fin(o,bm)
o,bm=newobj('head',M_hide); ico(bm,1,(0,0.5,0.86),(0.26,0.26,0.3)); ico(bm,1,(0,0.42,1.14),(0.18,0.16,0.26)); fin(o,bm)
o,bm=newobj('jaw',M_hideD); ico(bm,1,(0,0.32,1.12),(0.15,0.09,0.22)); fin(o,bm)
o,bm=newobj('maw',M_maw); box(bm,0.24,0.12,0.3,(0,0.4,1.16)); fin(o,bm)
o,bm=newobj('fangs',M_tooth)
for s in (1,-1):
    cone(bm,0.045,0.0,0.2,(0.09*s,0.36,1.26),(math.radians(190),0,0),4)
    cone(bm,0.04,0.0,0.16,(0.08*s,0.32,1.24),(math.radians(10),0,0),4)
fin(o,bm,smooth=False)
o,bm=newobj('eyes',M_eye)
for s in (1,-1): ico(bm,1,(0.14*s,0.54,1.02),(0.06,0.055,0.05))
fin(o,bm)
o,bm=newobj('brow',M_rock)
for s in (1,-1): box(bm,0.14,0.05,0.12,(0.14*s,0.6,1.0),(0,0,math.radians(16*s)))
fin(o,bm,smooth=False)
o,bm=newobj('ears',M_hideD)
for s in (1,-1): cone(bm,0.09,0.0,0.28,(0.2*s,0.66,0.78),(math.radians(-55),math.radians(24*s),math.radians(20*s)),4)
fin(o,bm,smooth=False)
o,bm=newobj('crest',M_rock)
spine=[(0.66,0.62,0.34),(0.5,0.68,0.5),(0.62,0.7,0.14),(0.58,0.66,-0.12),(0.5,0.62,-0.4),(0.4,0.55,-0.66)]
for hgt,y,z in spine: cone(bm,0.07,0.0,hgt*0.7,(0,y+hgt*0.28,z),(0,0,0),4)
for s in (1,-1):
    cone(bm,0.1,0.0,0.5,(0.26*s,0.82,0.34),(math.radians(-28),0,math.radians(22*s)),4)
    cone(bm,0.07,0.0,0.34,(0.32*s,0.72,0.18),(math.radians(-20),0,math.radians(34*s)),4)
fin(o,bm,smooth=False)
o,bm=newobj('embers',M_ember)
for _,y,z in spine[:4]: box(bm,0.05,0.04,0.09,(0,y-0.02,z))
fin(o,bm)
def leg(px,pz,upper_h,lower_h,shoulderY):
    o,bm=newobj('legU',M_hide); ico(bm,1,(px,shoulderY-upper_h*0.5,pz),(0.1,upper_h*0.55,0.12)); fin(o,bm)
    o,bm=newobj('legL',M_hideD); ico(bm,1,(px,shoulderY-upper_h-lower_h*0.5,pz+0.02),(0.07,lower_h*0.55,0.08)); fin(o,bm)
    o,bm=newobj('paw',M_hideD); ico(bm,1,(px,0.06,pz+0.08),(0.1,0.06,0.14)); fin(o,bm)
    o,bm=newobj('claws',M_tooth)
    for cx in (-0.05,0,0.05): cone(bm,0.02,0.0,0.09,(px+cx,0.04,pz+0.2),(math.radians(70),0,0),4)
    fin(o,bm,smooth=False)
for s in (1,-1):
    leg(0.24*s, 0.42, 0.34, 0.26, 0.62)
    leg(0.26*s, -0.42, 0.3, 0.28, 0.58)
o,bm=newobj('tail',M_hide); cone(bm,0.09,0.02,0.55,(0,0.72,-0.78),(math.radians(52),0,0),6); fin(o,bm)
o,bm=newobj('tailspike',M_rock); cone(bm,0.06,0.0,0.22,(0,0.96,-0.98),(math.radians(30),0,0),4); fin(o,bm,smooth=False)

bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]
bpy.ops.object.join()
h=bpy.context.active_object; h.name='hound'
h.rotation_euler=(math.radians(90),0,0); bpy.ops.object.transform_apply(rotation=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
print('exported', out)
