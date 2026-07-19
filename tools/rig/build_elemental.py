#!/usr/bin/env python3
# Stone Revenant — the green/purple rock elemental from the two reference views (IMG_2064/65).
# Built procedurally from reference (2-view silhouette scan can't recover this form faithfully):
# charred rock plates, GREEN lava cracks, PURPLE energy pools, shoulder+back spikes, skull face.
#   blender -b -noaudio --python tools/rig/build_elemental.py -- --out assets/models
import bpy, bmesh, mathutils, math, sys, os, random
V=mathutils.Vector; random.seed(11)

def argval(f,d=None):
    a=sys.argv; a=a[a.index('--')+1:] if '--' in a else a
    return a[a.index(f)+1] if f in a else d
OUT=argval('--out', os.path.join(os.path.dirname(__file__),'..','..','assets','models')); NAME=argval('--name','stone_revenant')

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
for blk in (bpy.data.meshes,bpy.data.materials):
    for d in list(blk): blk.remove(d)
def mat(n,rgb,rough=0.9,emit=None,estr=0.0):
    m=bpy.data.materials.new(n); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*rgb,1); b.inputs['Roughness'].default_value=rough
    try: b.inputs['Metallic'].default_value=0.0
    except: pass
    if emit is not None:
        try: b.inputs['Emission Color'].default_value=(*emit,1)
        except: b.inputs['Emission'].default_value=(*emit,1)
        b.inputs['Emission Strength'].default_value=estr
    return m
M_stone =mat('rev_stone',(0.11,0.11,0.12),0.95)                       # dark charred rock
M_dark  =mat('rev_dark', (0.06,0.06,0.07),0.97)                       # near-black rock (spikes/recess)
M_green =mat('rev_green',(0.10,0.30,0.05),0.5,emit=(0.28,1.0,0.10),estr=1.5)  # toxic-green lava cracks/eyes
M_purple=mat('rev_purp', (0.15,0.03,0.28),0.5,emit=(0.42,0.05,1.0), estr=1.1)  # deep violet energy pools

parts=[]
def craggy(bm,a):
    for v in bm.verts: v.co+=V((random.uniform(-1,1),random.uniform(-1,1),random.uniform(-1,1)))*a
def rock(c,s,m,crag=0.13):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1.0)
    bmesh.ops.transform(bm,matrix=mathutils.Matrix.Diagonal((s[0],s[1],s[2],1)),verts=bm.verts)
    bmesh.ops.bevel(bm,geom=bm.verts[:]+bm.edges[:],offset=min(s)*0.18,segments=2,affect='EDGES')
    craggy(bm,min(s)*crag); bmesh.ops.transform(bm,matrix=mathutils.Matrix.Translation(c),verts=bm.verts); parts.append((bm,m))
def orb(c,r,m,sq=(1,1,1)):
    bm=bmesh.new(); bmesh.ops.create_icosphere(bm,subdivisions=2,radius=r)
    bmesh.ops.transform(bm,matrix=mathutils.Matrix.Translation(c)@mathutils.Matrix.Diagonal((sq[0],sq[1],sq[2],1)),verts=bm.verts); parts.append((bm,m))
def cone(base,length,r,m,tilt=(0,0,0)):
    bm=bmesh.new(); bmesh.ops.create_cone(bm,cap_ends=True,segments=6,radius1=r,radius2=0.0,depth=length)
    bmesh.ops.translate(bm,vec=(0,0,length/2),verts=bm.verts)
    rot=mathutils.Euler(tilt).to_matrix().to_4x4(); bmesh.ops.transform(bm,matrix=rot,verts=bm.verts)
    bmesh.ops.transform(bm,matrix=mathutils.Matrix.Translation(base),verts=bm.verts); parts.append((bm,m))
def cracks(c,half,n):
    for _ in range(n):
        m=M_green
        ax=random.randint(0,2); sgn=random.choice([-1,1]); p=[random.uniform(-half[i]*0.75,half[i]*0.75) for i in range(3)]; p[ax]=half[ax]*sgn*1.02
        L=random.uniform(0.22,0.5); w=random.uniform(0.04,0.07); dims=[w,w,w]; la=random.choice([i for i in range(3) if i!=ax]); dims[la]=L
        bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1.0); bmesh.ops.transform(bm,matrix=mathutils.Matrix.Diagonal((dims[0],dims[1],dims[2],1)),verts=bm.verts)
        r=mathutils.Euler((random.uniform(-.5,.5),random.uniform(-.5,.5),random.uniform(-.5,.5))); bmesh.ops.rotate(bm,verts=bm.verts,cent=(0,0,0),matrix=r.to_matrix())
        bmesh.ops.transform(bm,matrix=mathutils.Matrix.Translation(V(c)+V(p)),verts=bm.verts); parts.append((bm,m))

# ---- legs + clawed feet ----
for s in (-1,1):
    rock((0.62*s,0,0.95),(0.85,0.9,1.9),M_stone,0.11)
    rock((0.66*s,0.05,0.15),(1.0,1.35,0.5),M_dark,0.12)
    for t in (-0.3,0,0.3): cone((0.66*s+t*0.5,-0.55,0.12),0.5,0.11,M_dark,tilt=(-1.9,0,0))   # toe claws
    cracks((0.62*s,-0.2,1.0),(0.45,0.45,0.9),4)
# hips + faint violet underglow (green dominates in the ref; purple is secondary)
rock((0,0,1.95),(2.0,1.25,0.95),M_dark,0.1); orb((0,-0.9,1.95),0.26,M_purple,sq=(1.3,0.45,0.7))
cracks((0,-0.4,2.0),(0.9,0.6,0.5),5)
# torso — broad chest; green cracks carry the glow, a faint violet pool beneath
rock((0,-0.05,3.25),(2.7,1.6,2.15),M_stone,0.13)
orb((0,-1.05,3.3),0.40,M_purple,sq=(1.25,0.5,0.9))                    # faint violet underlayer
cracks((0,-0.05,3.3),(1.4,0.85,1.05),22)                             # dense green lava cracks (the ref's signature)
# shoulders — big boulders, each with an UPRIGHT spike cluster
for s in (-1,1):
    rock((1.85*s,-0.05,3.95),(1.55,1.55,1.5),M_stone,0.16); cracks((1.85*s,-0.05,3.95),(0.78,0.78,0.75),7)
    orb((1.98*s,-0.9,3.9),0.20,M_purple,sq=(0.9,0.45,0.8))           # faint violet accent
    cone((1.9*s, 0.10,4.78),2.3,0.46,M_dark,tilt=(0.05,0.12*s,0))    # tall spike
    cone((2.55*s,0.12,4.45),1.5,0.32,M_dark,tilt=(0.10,0.42*s,0))    # outer
    cone((1.45*s,0.18,4.58),1.4,0.30,M_dark,tilt=(0.08,-0.14*s,0))   # inner
    cone((2.2*s,-0.25,4.5),1.1,0.26,M_dark,tilt=(-0.18,0.2*s,0))     # front
# back spikes (upright, from the side view)
cone((0,1.05,4.15),2.3,0.44,M_dark,tilt=(0.35,0,0))
cone((0,0.55,4.75),1.2,0.28,M_dark,tilt=(0.30,0,0))
# GREEN FLAME crown rising off the skull (static tongues; animated green fire+smoke added in-engine)
for (hx,hz,L,r) in [(0,5.35,1.5,0.38),(-0.34,5.1,1.0,0.24),(0.34,5.15,1.05,0.25),(0.06,5.75,0.9,0.18),(-0.12,5.0,0.7,0.16)]:
    cone((hx,-0.5,hz),L,r,M_green,tilt=(random.uniform(-0.25,0.25),0,random.uniform(-0.25,0.25)))
# two FLOATING GREEN CRYSTALS at the sides (the ref's signature shards) — bipyramid gems
def crystal(c,h,r):
    cone((c[0],c[1],c[2]),h*0.62,r,M_green); cone((c[0],c[1],c[2]),h*0.42,r,M_green,tilt=(math.pi,0,0))
for s in (-1,1): crystal((3.7*s,-0.15,3.35),1.5,0.42)
# arms — upper + forearm (with spike) + clawed fists
for s in (-1,1):
    rock((2.25*s,-0.05,3.0),(1.0,1.05,1.5),M_stone,0.12)
    rock((2.45*s,0.1,1.65),(1.05,1.1,1.5),M_stone,0.12); cone((2.75*s,0.35,2.1),0.9,0.24,M_dark,tilt=(-0.5,0,0.6*s))  # elbow spike
    rock((2.55*s,0.2,0.75),(1.35,1.4,1.2),M_dark,0.16)               # fist
    for t in (-0.4,-0.13,0.13,0.4): cone((2.55*s+t,-0.55,0.6),0.6,0.12,M_dark,tilt=(-1.6,0,0))   # finger claws
    cracks((2.35*s,0.0,2.3),(0.55,0.55,1.4),6); orb((2.55*s,-0.7,0.8),0.26,M_green)              # knuckle glow
# head — skull-ish: dark head, green eyes, fanged maw
rock((0,-0.4,4.55),(1.15,1.15,1.05),M_dark,0.14)
for s in (-1,1): orb((0.32*s,-1.0,4.7),0.15,M_green)                 # glowing eyes
rock((0,-1.02,4.2),(0.72,0.35,0.42),M_dark,0.2)                      # jaw
orb((0,-1.05,4.28),0.16,M_green)                                     # mouth glow
for t in (-0.28,-0.1,0.1,0.28): cone((t,-1.15,4.35),0.22,0.05,M_stone,tilt=(1.7,0,0))  # fangs (down)

# ---- realise + light subsurf ----
objs=[]
for i,(bm,m) in enumerate(parts):
    me=bpy.data.meshes.new('p%d'%i); bm.to_mesh(me); bm.free(); o=bpy.data.objects.new('p%d'%i,me)
    bpy.context.scene.collection.objects.link(o); me.materials.append(m); objs.append(o)
for o in bpy.context.selected_objects: o.select_set(False)
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
g=bpy.context.view_layer.objects.active; g.name=NAME
mod=g.modifiers.new('s','SUBSURF'); mod.levels=1; mod.render_levels=1; bpy.ops.object.modifier_apply(modifier='s')
for p in g.data.polygons: p.use_smooth=True
g.data.update(); zmin=min((g.matrix_world@V(v.co)).z for v in g.data.vertices); g.location.z-=zmin
os.makedirs(OUT,exist_ok=True); out=os.path.join(OUT,NAME+'.glb')
bpy.ops.object.select_all(action='DESELECT'); g.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_apply=True)
print('BUILT',out,os.path.getsize(out),'bytes; tris ~',sum(len(p.vertices)-2 for p in g.data.polygons))
