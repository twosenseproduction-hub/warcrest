import bpy, bmesh, math, sys
from mathutils import Vector, Matrix, Euler
out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)

def D(h, k=0.62):
    return ((h>>16&255)/255*k, (h>>8&255)/255*k, (h&255)/255*k, 1)
def mat(name, hexc, emiss=None, ei=0.0, k=0.62, rough=0.9):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=D(hexc,k)
    if 'Metallic' in b.inputs: b.inputs['Metallic'].default_value=0.0
    b.inputs['Roughness'].default_value=rough
    if emiss is not None:
        b.inputs['Emission Color'].default_value=(*[c/255 for c in (emiss>>16&255,emiss>>8&255,emiss&255)],1)
        b.inputs['Emission Strength'].default_value=ei
    return m

# CINDER HOUND ref palette: charcoal-black rock + ORANGE lava cracks/maw + GREEN eyes
M_char  = mat('char',  0x201d24, k=0.7)     # charred black rock (raised)
M_charD = mat('charD', 0x141218, k=0.7)     # deepest black (recesses/belly)
M_lava  = mat('lava',  0xff5a12, 0xff5210, 1.2)   # glowing orange lava crack
M_maw   = mat('maw',   0xff7a1e, 0xff6a16, 1.4)   # glowing orange maw interior
M_eye   = mat('eye',   0x76ff6a, 0x5dff52, 0.9)   # glowing green eye
M_tooth = mat('tooth', 0xdcd6c0)

objs=[]
def newobj(name, mat_):
    me=bpy.data.meshes.new(name); o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); o.data.materials.append(mat_); objs.append(o); return o,bmesh.new()
def fin(o,bm,smooth=False):
    bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth=smooth
def ico(bm,r,loc,scale=(1,1,1),sub=1):
    res=bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r)
    bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Matrix.Diagonal(Vector((*scale,1.0))),verts=res['verts']); return res['verts']
def cone(bm,r1,r2,depth,loc,rot=(0,0,0),v=6):
    res=bmesh.ops.create_cone(bm,cap_ends=True,segments=v,radius1=r1,radius2=r2,depth=depth)
    bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4(),verts=res['verts']); return res['verts']
def box(bm,sx,sy,sz,loc,rot=(0,0,0)):
    res=bmesh.ops.create_cube(bm,size=1)
    bmesh.ops.transform(bm,matrix=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4()@Matrix.Diagonal(Vector((sx,sy,sz,1.0))),verts=res['verts']); return res['verts']

# Body: chiseled charred wolf/pitbull. axes X=right, Y=up, Z=forward(+head).
o,bm=newobj('torso',M_char)
ico(bm,1,(0,0.72,0.28),(0.34,0.4,0.42)); ico(bm,1,(0,0.6,-0.05),(0.3,0.32,0.4)); ico(bm,1,(0,0.66,-0.42),(0.37,0.39,0.36)); fin(o,bm)
o,bm=newobj('belly',M_charD); ico(bm,1,(0,0.48,-0.05),(0.27,0.2,0.6)); fin(o,bm)
o,bm=newobj('neck',M_char); ico(bm,1,(0,0.62,0.58),(0.21,0.23,0.28)); fin(o,bm)
# head: broad pitbull skull + blunt muzzle
o,bm=newobj('head',M_char); ico(bm,1,(0,0.52,0.84),(0.27,0.27,0.28)); ico(bm,1,(0,0.46,1.08),(0.2,0.17,0.24)); fin(o,bm)
o,bm=newobj('jaw',M_charD); box(bm,0.3,0.16,0.34,(0,0.36,1.02)); fin(o,bm)
# glowing orange maw + teeth
o,bm=newobj('maw',M_maw); box(bm,0.26,0.14,0.28,(0,0.43,1.06)); fin(o,bm)
o,bm=newobj('teeth',M_tooth)
for s in (1,-1):
    cone(bm,0.05,0.0,0.2,(0.11*s,0.4,1.24),(math.radians(190),0,0),4)   # upper fangs
    cone(bm,0.04,0.0,0.15,(0.1*s,0.34,1.22),(math.radians(8),0,0),4)    # lower fangs
for x in (-0.05,0.05):
    cone(bm,0.03,0.0,0.1,(x,0.41,1.26),(math.radians(190),0,0),4)
fin(o,bm)
# green eyes under a heavy brow
o,bm=newobj('eyes',M_eye)
for s in (1,-1): ico(bm,1,(0.15*s,0.58,1.0),(0.06,0.055,0.05))
fin(o,bm,smooth=True)
o,bm=newobj('brow',M_char)
for s in (1,-1): box(bm,0.16,0.07,0.14,(0.14*s,0.64,0.98),(0,0,math.radians(16*s)))
fin(o,bm)
# sharp upright EARS (pitbull, pricked)
o,bm=newobj('ears',M_char)
for s in (1,-1): cone(bm,0.1,0.0,0.32,(0.19*s,0.78,0.82),(math.radians(-8),0,math.radians(14*s)),4)
fin(o,bm)
# legs: chiseled boxy, front taller. lava cracks added after.
def leg(px,pz,uh,lh,sy):
    o,bm=newobj('legU',M_char); box(bm,0.2,0.22,uh,(px,sy-uh*0.5,pz)); fin(o,bm)
    o,bm=newobj('legL',M_charD); box(bm,0.14,0.15,lh,(px,sy-uh-lh*0.5,pz+0.02)); fin(o,bm)
    o,bm=newobj('paw',M_charD); box(bm,0.2,0.28,0.12,(px,0.06,pz+0.05)); fin(o,bm)
    o,bm=newobj('claws',M_tooth)
    for cx in (-0.06,0,0.06): cone(bm,0.025,0.0,0.1,(px+cx,0.04,pz+0.2),(math.radians(70),0,0),4)
    fin(o,bm)
for s in (1,-1):
    leg(0.24*s,0.42,0.34,0.26,0.62); leg(0.26*s,-0.42,0.3,0.28,0.58)
# tail: lean, raised, glowing ember tip
o,bm=newobj('tail',M_char); cone(bm,0.09,0.03,0.5,(0,0.74,-0.78),(math.radians(48),0,0),5); fin(o,bm)
o,bm=newobj('tailtip',M_lava); ico(bm,1,(0,0.98,-0.92),(0.07,0.09,0.07)); fin(o,bm,smooth=True)
# ---- ORANGE LAVA CRACKS: thin glowing insets across chest, flanks, shoulders, haunch, legs ----
o,bm=newobj('cracks',M_lava)
cr=[ (0,0.55,0.5,0.05,0.28,0.04,(0.3,0,0)),      # chest vertical
     (0,0.62,0.05,0.05,0.5,0.04,(0,0,0)),         # spine line
     (0.3,0.6,0.2,0.04,0.22,0.04,(0,0,-0.5)),     # R shoulder
     (-0.3,0.6,0.2,0.04,0.22,0.04,(0,0,0.5)),     # L shoulder
     (0.32,0.6,-0.4,0.04,0.2,0.04,(0,0,0.4)),     # R haunch
     (-0.32,0.6,-0.4,0.04,0.2,0.04,(0,0,-0.4)),   # L haunch
     (0.24,0.45,0.42,0.03,0.18,0.03,(0,0,0)),     # R front leg
     (-0.24,0.45,0.42,0.03,0.18,0.03,(0,0,0)),
     (0.26,0.42,-0.42,0.03,0.18,0.03,(0,0,0)),
     (-0.26,0.42,-0.42,0.03,0.18,0.03,(0,0,0)) ]
for x,y,z,sx,sy,sz,rot in cr: box(bm,sx,sy,sz,(x,y,z),rot)
fin(o,bm,smooth=True)

bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]
bpy.ops.object.join()
h=bpy.context.active_object; h.name='cinderhound'
h.rotation_euler=(math.radians(90),0,0); bpy.ops.object.transform_apply(rotation=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
print('exported', out)
