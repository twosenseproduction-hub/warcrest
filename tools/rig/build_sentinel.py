#!/usr/bin/env python3
# Ridge Sentinel — a hulking ironstone golem creep for Verath, built headless in Blender.
# Ashen rock plates with a glowing molten core + ember-lit seams (the "ash + flame" element).
#   blender -b -noaudio --python tools/rig/build_sentinel.py -- --out assets/models
import bpy, bmesh, mathutils, math, sys, os, random
V = mathutils.Vector
random.seed(7)   # deterministic craggy shape

def argval(f,d=None):
    a=sys.argv; a=a[a.index('--')+1:] if '--' in a else a
    return a[a.index(f)+1] if f in a else d
OUT  = argval('--out', os.path.join(os.path.dirname(__file__),'..','..','assets','models'))
NAME = argval('--name','ridge_sentinel')

# ---- reset ----
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.materials):
    for d in list(blk): blk.remove(d)

def mat(name, rgb, rough=0.9, emit=None, estr=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*rgb,1)
    b.inputs['Roughness'].default_value=rough
    try: b.inputs['Metallic'].default_value=0.0
    except: pass
    if emit is not None:
        try: b.inputs['Emission Color'].default_value=(*emit,1)
        except: b.inputs['Emission'].default_value=(*emit,1)
        b.inputs['Emission Strength'].default_value=estr
    return m

M_stone  = mat('sent_stone',  (0.15,0.135,0.12), 0.95)            # charred basalt (WC3-infernal dark, so the lava pops)
M_dark   = mat('sent_dark',   (0.08,0.07,0.06), 0.97)             # near-black cinder rock
M_molten = mat('sent_molten', (0.35,0.08,0.0), 0.5, emit=(1.0,0.26,0.04), estr=1.7)  # molten lava (orange-red, not yellow)
M_ember  = mat('sent_ember',  (0.45,0.15,0.02),0.5, emit=(1.0,0.40,0.09), estr=2.0)  # ember seams / eyes

parts=[]   # (bmesh, material)
def craggy(bm, amt):
    """random-displace verts for a rough rock look"""
    for v in bm.verts:
        v.co += V((random.uniform(-1,1),random.uniform(-1,1),random.uniform(-1,1)))*amt

def rock(center, size, m, crag=0.13, subsurf=True, squashY=1.0):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1.0)
    bmesh.ops.transform(bm, matrix=mathutils.Matrix.Diagonal((size[0],size[1]*squashY,size[2],1)), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=bm.verts[:]+bm.edges[:], offset=min(size)*0.18, segments=2, affect='EDGES')
    craggy(bm, min(size)*crag)
    bmesh.ops.transform(bm, matrix=mathutils.Matrix.Translation(center), verts=bm.verts)
    parts.append((bm,m))

def orb(center, r, m):
    bm=bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
    bmesh.ops.transform(bm, matrix=mathutils.Matrix.Translation(center), verts=bm.verts)
    parts.append((bm,m))

def crack_field(center, half, n, m=None):
    """scatter n thin glowing lava veins across the outer surface of a chunk (WC3-infernal cracks)"""
    for _ in range(n):
        mm = m or (M_ember if random.random()<0.55 else M_molten)
        ax=random.randint(0,2); sgn=random.choice([-1,1])
        p=[random.uniform(-half[i]*0.75,half[i]*0.75) for i in range(3)]
        p[ax]=half[ax]*sgn*1.02                                    # sit just proud of the surface
        L=random.uniform(0.22,0.55); w=random.uniform(0.04,0.075)
        dims=[w,w,w]; la=random.choice([i for i in range(3) if i!=ax]); dims[la]=L
        bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1.0)
        bmesh.ops.transform(bm,matrix=mathutils.Matrix.Diagonal((dims[0],dims[1],dims[2],1)),verts=bm.verts)
        rot=mathutils.Euler((random.uniform(-0.5,0.5),random.uniform(-0.5,0.5),random.uniform(-0.5,0.5)))
        bmesh.ops.rotate(bm,verts=bm.verts,cent=(0,0,0),matrix=rot.to_matrix())
        bmesh.ops.transform(bm,matrix=mathutils.Matrix.Translation(V(center)+V(p)),verts=bm.verts)
        parts.append((bm,mm))

# ---- build the golem (Z up). Hunched, top-heavy: massive shoulders/arms, small sunken head ----
# legs — short thick pillars + feet
for s in (-1,1):
    rock((0.55*s, 0, 0.85), (0.75,0.8,1.7), M_stone, crag=0.10)          # thigh/shin block
    rock((0.6*s, 0.15, 0.12), (0.95,1.25,0.5), M_dark, crag=0.12)        # foot
# hips
rock((0,0,1.75), (1.9,1.2,0.9), M_dark, crag=0.10)
crack_field((0,-0.55,1.75),(0.95,0.6,0.45), 4)
# torso — big craggy chest boulder, tilted forward mass
rock((0,-0.1,3.1), (2.6,1.7,2.0), M_stone, crag=0.14)
# molten HEART — a bright core protruding from a broken cavity in the chest
rock((0,-0.55,3.15), (1.6,1.0,1.6), M_dark, crag=0.24)                   # dark cracked collar / cavity rim
orb((0,-1.1,3.2), 0.58, M_molten)                                       # exposed molten core
orb((0,-1.18,3.2), 0.34, M_ember)                                       # hotter inner glow
crack_field((0,-0.1,3.15),(1.3,0.85,1.0), 14)                           # lava veins spidering the torso
# shoulders — huge boulders, cracked
for s in (-1,1):
    rock((1.75*s,-0.1,3.7),(1.5,1.5,1.5), M_stone, crag=0.16)
    crack_field((1.75*s,-0.1,3.7),(0.75,0.75,0.75), 6)
# arms — upper + forearm + massive fists that nearly reach the ground
for s in (-1,1):
    rock((2.1*s,-0.1,2.9),(0.95,1.0,1.4), M_stone, crag=0.12)            # upper arm
    rock((2.35*s,0.15,1.55),(1.05,1.1,1.5), M_stone, crag=0.12)          # forearm
    rock((2.45*s,0.25,0.7),(1.5,1.5,1.3), M_dark, crag=0.18)             # fist
    crack_field((2.1*s,-0.1,2.9),(0.5,0.5,0.7), 4)
    crack_field((2.35*s,0.0,1.55),(0.55,0.55,0.75), 5)
    orb((2.45*s,-0.5,0.72),0.34, M_molten)                              # molten knuckles
    crack_field((2.45*s,0.1,0.7),(0.72,0.72,0.62), 5)                   # cracked fists
# legs get veins too
for s in (-1,1):
    crack_field((0.55*s,-0.35,0.9),(0.4,0.4,0.85), 4)
# head — small craggy rock sunk between the shoulders, molten maw + two bright eyes
rock((0,-0.35,4.35),(1.0,1.0,0.95), M_dark, crag=0.16)
for s in (-1,1):
    orb((0.30*s,-0.98,4.42),0.15, M_ember)                              # glowing eyes
orb((0,-0.95,4.05),0.13, M_molten)                                      # molten mouth-glow
crack_field((0,-0.35,4.35),(0.55,0.55,0.5), 4)

# ---- realise: join all parts into one object, light subsurf for rounded rock ----
objs=[]
for i,(bm,m) in enumerate(parts):
    me=bpy.data.meshes.new('p%d'%i); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('p%d'%i, me); bpy.context.scene.collection.objects.link(o)
    me.materials.append(m); objs.append(o)
for o in bpy.context.selected_objects: o.select_set(False)
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active=objs[0]
bpy.ops.object.join()
g=bpy.context.view_layer.objects.active; g.name=NAME
mod=g.modifiers.new('sub','SUBSURF'); mod.levels=1; mod.render_levels=1
bpy.ops.object.modifier_apply(modifier='sub')
for p in g.data.polygons: p.use_smooth=True
# drop to floor, centre
g.data.update()
zmin=min((g.matrix_world@V(v.co)).z for v in g.data.vertices)
g.location.z -= zmin

os.makedirs(OUT, exist_ok=True)
out=os.path.join(OUT, NAME+'.glb')
bpy.ops.object.select_all(action='DESELECT'); g.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True)
tri=sum(len(p.vertices)-2 for p in g.data.polygons)
print('BUILT', out, os.path.getsize(out),'bytes; tris ~',tri)
