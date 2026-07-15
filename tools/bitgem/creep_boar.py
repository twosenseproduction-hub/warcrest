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
# DIREBOAR: dark brown hide, bristly mane, cream tusks, bone plates, leather straps, purple eyes
M_hide=mat('hide',0x5a4632,k=0.85); M_hideD=mat('hideD',0x3c2f20,k=0.85)
M_snout=mat('snout',0x7a5a48,k=0.85); M_mane=mat('mane',0x2a2018,k=0.8)
M_tusk=mat('tusk',0xe6ddc4); M_bone=mat('bone',0xd8cba8); M_strap=mat('strap',0x4a3420,k=0.85)
M_eye=mat('eye',0xb060e0,0x9a48d0,0.8)
objs=[]
def newobj(n,m): me=bpy.data.meshes.new(n); o=bpy.data.objects.new(n,me); bpy.context.collection.objects.link(o); o.data.materials.append(m); objs.append(o); return o,bmesh.new()
def fin(o,bm,s=True):
    bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth=s
def ico(bm,r,loc,sc=(1,1,1),sub=2):
    res=bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Matrix.Diagonal(Vector((*sc,1.0))),verts=res['verts']); return res['verts']
def cone(bm,r1,r2,d,loc,rot=(0,0,0),v=6):
    res=bmesh.ops.create_cone(bm,cap_ends=True,segments=v,radius1=r1,radius2=r2,depth=d); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4(),verts=res['verts']); return res['verts']
def box(bm,sx,sy,sz,loc,rot=(0,0,0)):
    res=bmesh.ops.create_cube(bm,size=1); bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4()@Matrix.Diagonal(Vector((sx,sy,sz,1.0))),verts=res['verts']); return res['verts']

# Bulky boar. X=right, Y=up, Z=forward(+head). Big front shoulders (hump), lower rear.
o,bm=newobj('torso',M_hide)
ico(bm,1,(0,0.78,0.15),(0.42,0.46,0.44)); ico(bm,1,(0,0.66,-0.3),(0.4,0.4,0.4)); fin(o,bm)   # shoulder hump + rear
o,bm=newobj('belly',M_hideD); ico(bm,1,(0,0.52,-0.05),(0.34,0.24,0.66)); fin(o,bm)
# head low + forward, big snout
o,bm=newobj('head',M_hide); ico(bm,1,(0,0.6,0.6),(0.28,0.3,0.3)); fin(o,bm)
o,bm=newobj('snout',M_snout); ico(bm,1,(0,0.5,0.9),(0.2,0.18,0.26)); fin(o,bm)
o,bm=newobj('nose',M_hideD); ico(bm,0.1,(0,0.48,1.06),(1,0.9,0.5),sub=1); fin(o,bm)
# purple eyes + brow
o,bm=newobj('eyes',M_eye)
for s in (1,-1): ico(bm,0.055,(0.16*s,0.68,0.78),(1,0.8,1),sub=1)
fin(o,bm)
o,bm=newobj('brow',M_hideD)
for s in (1,-1): ico(bm,0.09,(0.16*s,0.73,0.74),(1.2,0.6,0.8),sub=1)
fin(o,bm)
# ears
o,bm=newobj('ears',M_hideD)
for s in (1,-1): cone(bm,0.09,0.0,0.2,(0.24*s,0.8,0.55),(math.radians(-30),0,math.radians(40*s)),4);
fin(o,bm,s=False)
# TUSKS: big cream, curving up + out from lower snout
o,bm=newobj('tusks',M_tusk)
for s in (1,-1):
    base=Vector((0.13*s,0.44,0.98)); tip=Vector((0.3*s,0.74,1.05))
    d=(tip-base); q=Vector((0,0,1)).rotation_difference(d.normalized())
    res=bmesh.ops.create_cone(bm,cap_ends=True,segments=6,radius1=0.06,radius2=0.0,depth=d.length)
    bmesh.ops.transform(bm,matrix=Matrix.Translation((base+tip)*0.5)@q.to_matrix().to_4x4(),verts=res['verts'])
fin(o,bm)
# bristly MANE / mohawk along the neck+spine (dark spikes)
o,bm=newobj('mane',M_mane)
for z,h in [(0.5,0.28),(0.34,0.34),(0.16,0.3),(-0.02,0.24),(-0.2,0.18)]:
    cone(bm,0.06,0.0,h,(0,0.9+h*0.2,z),(math.radians(-12),0,0),4)
fin(o,bm,s=False)
# BONE PLATES on the back/flank (hexagonal-ish boxes)
o,bm=newobj('plates',M_bone)
for x,z in [(0.34,0.1),(0.36,-0.2),(-0.34,0.1),(-0.36,-0.2),(0.2,-0.4),(-0.2,-0.4)]:
    b=box(bm,0.16,0.03,0.2,(x,0.86,z),(math.radians(70),0,math.radians(-30 if x>0 else 30)))
fin(o,bm,s=False)
# leather STRAPS (harness) across shoulders + bone toggles
o,bm=newobj('straps',M_strap)
box(bm,0.5,0.05,0.08,(0,0.95,0.28),(0,0,0)); box(bm,0.08,0.05,0.5,(0.3,0.9,0.0),(0,0,0)); box(bm,0.08,0.05,0.5,(-0.3,0.9,0.0),(0,0,0))
fin(o,bm)
o,bm=newobj('toggles',M_bone)
for x,z in [(0.3,0.28),(-0.3,0.28),(0.32,-0.18),(-0.32,-0.18)]: cone(bm,0.04,0.04,0.06,(x,0.98,z),(0,0,0),5)
fin(o,bm,s=False)
# legs: stocky
def leg(px,pz,h,sy):
    o,bm=newobj('legU',M_hide); box(bm,0.16,0.18,h,(px,sy-h*0.5,pz)); fin(o,bm)
    o,bm=newobj('hoof',M_hideD); box(bm,0.14,0.2,0.1,(px,0.05,pz),(0,0,0)); fin(o,bm,s=False)
for s in (1,-1):
    leg(0.24*s,0.4,0.5,0.5); leg(0.26*s,-0.4,0.46,0.46)
# tail
o,bm=newobj('tail',M_hideD); cone(bm,0.04,0.02,0.3,(0,0.6,-0.62),(math.radians(150),0,0),5); fin(o,bm)
o,bm=newobj('tuft',M_mane); ico(bm,0.07,(0,0.42,-0.66),(1,1.3,1),sub=1); fin(o,bm,s=False)

bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
h=bpy.context.active_object; h.name='direboar'
h.rotation_euler=(math.radians(90),0,0); bpy.ops.object.transform_apply(rotation=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
print('exported', out)
