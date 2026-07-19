#!/usr/bin/env python3
# Auto-rig a static sculpt (Tripo/AI-3D creep) to a KayKit "Big Rig" and inherit its clips.
#   --weights transfer  : copy the KayKit body's ARTIST weights onto the sculpt by nearest
#                         surface (Data Transfer). Best deformation — the sculpt skins like the
#                         KayKit character. (default)
#   --weights proximity : weight each vert to its nearest bone by segment distance (fallback).
# Also authors a mold-anchored "Idle" (endpoints = the exact sculpt, subtle breathe between).
#
#   blender -b -noaudio --python tools/rig/rig_to_kaykit.py -- \
#     --mesh assets/models/stone_revenant.glb --rig assets/models/kaykit/Barbarian.glb \
#     --name stone_revenant --weights transfer --out assets/models
import bpy, mathutils, os, sys
from mathutils import Euler
V=mathutils.Vector
def arg(f,d=None):
    a=sys.argv; a=a[a.index('--')+1:] if '--' in a else a
    return a[a.index(f)+1] if f in a else d
MESH=arg('--mesh'); RIG=arg('--rig'); NAME=arg('--name','rigged_unit'); MODE=arg('--weights','transfer')
OUT=arg('--out', os.path.join(os.path.dirname(__file__),'..','..','assets','models'))

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
for blk in (bpy.data.meshes,bpy.data.armatures,bpy.data.actions):
    for x in list(blk): blk.remove(x)
def bbox(objs):
    mn=V((1e9,)*3); mx=V((-1e9,)*3)
    for o in objs:
        for c in o.bound_box:
            w=o.matrix_world@V(c)
            for i in range(3): mn[i]=min(mn[i],w[i]); mx[i]=max(mx[i],w[i])
    return mn,mx
# --- KayKit rig (keep the body mesh as a weight-source for transfer mode) ---
bpy.ops.import_scene.gltf(filepath=RIG)
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
barb_meshes=[o for o in bpy.data.objects if o.type=='MESH']
rmn,rmx=bbox(barb_meshes); rig_h=rmx.z-rmn.z; rig_footz=rmn.z; rig_cx=(rmn.x+rmx.x)/2; rig_cy=(rmn.y+rmx.y)/2
# join the KayKit meshes into one source
for o in bpy.context.selected_objects: o.select_set(False)
for o in barb_meshes: o.select_set(True)
bpy.context.view_layer.objects.active=barb_meshes[0]
if len(barb_meshes)>1: bpy.ops.object.join()
barb=bpy.context.view_layer.objects.active
# --- sculpt: fit to the rig ---
bpy.ops.import_scene.gltf(filepath=MESH)
# the sculpt is the LARGEST non-source mesh (some rigs ship stray helper meshes, e.g. an eye icosphere)
gol=max((o for o in bpy.data.objects if o.type=='MESH' and o is not barb), key=lambda o: len(o.data.polygons))
gmn,gmx=bbox([gol]); gol.scale=(rig_h/(gmx.z-gmn.z),)*3; bpy.context.view_layer.update()
gmn,gmx=bbox([gol])
gol.location.x+=rig_cx-(gmn.x+gmx.x)/2; gol.location.y+=rig_cy-(gmn.y+gmx.y)/2; gol.location.z+=rig_footz-gmn.z
bpy.context.view_layer.update()

if MODE=='transfer':
    # copy the KayKit body's artist weights onto the sculpt via a Data Transfer MODIFIER.
    # Pre-create matching-name groups on the sculpt (the modifier fills, it won't create).
    for vg in barb.vertex_groups:
        if not gol.vertex_groups.get(vg.name): gol.vertex_groups.new(name=vg.name)
    for o in bpy.context.selected_objects: o.select_set(False)
    gol.select_set(True); bpy.context.view_layer.objects.active=gol
    md=gol.modifiers.new('dt','DATA_TRANSFER'); md.object=barb
    md.use_vert_data=True; md.data_types_verts={'VGROUP_WEIGHTS'}
    md.vert_mapping='POLYINTERP_NEAREST'
    md.layers_vgroup_select_src='ALL'; md.layers_vgroup_select_dst='NAME'
    bpy.ops.object.modifier_apply(modifier='dt')
    bpy.data.objects.remove(barb, do_unlink=True)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL')
    gol.parent=arm; gol.matrix_parent_inverse=arm.matrix_world.inverted()
    m=gol.modifiers.new('Armature','ARMATURE'); m.object=arm
else:
    bpy.data.objects.remove(barb, do_unlink=True)
    for o in bpy.context.selected_objects: o.select_set(False)
    gol.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active=arm
    bpy.ops.object.parent_set(type='ARMATURE_NAME')
    segs=[]
    for bn in arm.data.bones:
        if any(k in bn.name.lower() for k in ('ik','ctrl','pole','target','_end')): continue
        segs.append((bn.name, arm.matrix_world@bn.head_local, arm.matrix_world@bn.tail_local))
    def seg_dist(P,H,T):
        d=T-H; L2=d.dot(d)
        if L2<1e-9: return (P-H).length
        t=max(0.0,min(1.0,(P-H).dot(d)/L2)); return (P-(H+d*t)).length
    grp={nm:(gol.vertex_groups.get(nm) or gol.vertex_groups.new(name=nm)) for nm,_,_ in segs}
    mw=gol.matrix_world
    for v in gol.data.vertices:
        P=mw@v.co
        ds=sorted((seg_dist(P,H,T),nm) for nm,H,T in segs)[:3]
        ws=[((1.0/(d+1e-3))**4.0, nm) for d,nm in ds]; tot=sum(w for w,_ in ws) or 1.0
        for w,nm in ws: grp[nm].add([v.index], w/tot, 'REPLACE')

# safety: weld any unweighted verts to the spine
spine=gol.vertex_groups.get('spine') or gol.vertex_groups.get('chest') or gol.vertex_groups.new(name='spine')
orphans=[v.index for v in gol.data.vertices if len(v.groups)==0]
if orphans: spine.add(orphans,1.0,'REPLACE')
print('weights',MODE,'; orphans',len(orphans))

# --- optional: merge extra clip glbs (e.g. Rig_Large_*) onto the golem's armature ---
ANIMS=arg('--anims','')
if ANIMS:
    keep=set(bpy.data.objects)
    for ap in ANIMS.split(','):
        bpy.ops.import_scene.gltf(filepath=ap.strip())
        for o in list(bpy.data.objects):
            if o not in keep and o.type in ('ARMATURE','MESH','EMPTY'):
                bpy.data.objects.remove(o, do_unlink=True)   # keep the actions, drop the anim rig
    print('merged clips; total actions',len(bpy.data.actions))

# --- mold-anchored Idle (endpoints = identity = the exact sculpt) + subtle breathe ---
for a in list(bpy.data.actions):
    if a.name.lower()=='idle': bpy.data.actions.remove(a)
arm.animation_data_create(); idle=bpy.data.actions.new('Idle'); arm.animation_data.action=idle
for pb in arm.pose.bones: pb.rotation_mode='QUATERNION'
BR=['spine','chest','head','upperarm.l','upperarm.r']
def keypose(frame,pose):
    for bn in BR:
        pb=arm.pose.bones.get(bn)
        if not pb: continue
        pb.rotation_quaternion=Euler(pose.get(bn,(0,0,0)),'XYZ').to_quaternion()
        pb.keyframe_insert('rotation_quaternion', frame=frame)
peak={'spine':(-0.05,0,0),'chest':(0.025,0,0),'head':(-0.035,0,0),'upperarm.l':(0.02,0,0.05),'upperarm.r':(0.02,0,-0.05)}
keypose(0,{}); keypose(12,{}); keypose(48,peak); keypose(84,{})
for f in idle.fcurves:
    for kp in f.keyframe_points: kp.interpolation='BEZIER'
bpy.context.scene.frame_start=0; bpy.context.scene.frame_end=84
for pb in arm.pose.bones: pb.rotation_quaternion=(1,0,0,0)

bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); gol.select_set(True)
os.makedirs(OUT,exist_ok=True); out=os.path.join(OUT,NAME+'_anim.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, use_selection=True, export_apply=False)
print('BUILT',out,os.path.getsize(out),'bytes; clips',len(bpy.data.actions))
