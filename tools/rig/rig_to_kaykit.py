#!/usr/bin/env python3
# Auto-rig a static sculpt (e.g. a Tripo/AI-3D creep) to a KayKit "Big Rig" skeleton and
# inherit its full animation library. Strips the KayKit mesh, fits the sculpt onto the
# skeleton, binds with automatic weights (rigid creeps bind cleanly), and exports
# <name>_anim.glb with every KayKit clip.
#
#   blender -b -noaudio --python tools/rig/rig_to_kaykit.py -- \
#     --mesh assets/models/stone_revenant.glb --rig assets/models/kaykit/Barbarian.glb \
#     --name stone_revenant --out assets/models
#
# Notes: heat-weighting can leave verts unweighted on a bulky sculpt; those are welded to a
# central bone (avoids the glTF exporter's neutral-bone crash and keeps the body rigid, which
# reads fine for a golem). Clip names are KayKit's (Idle / Walking_A / Running_A / 1H_Melee_* …);
# the game maps them to idle/run/attack when wiring.
import bpy, mathutils, os, sys
V=mathutils.Vector
def arg(f,d=None):
    a=sys.argv; a=a[a.index('--')+1:] if '--' in a else a
    return a[a.index(f)+1] if f in a else d
MESH=arg('--mesh'); RIG=arg('--rig'); NAME=arg('--name','rigged_unit')
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
# KayKit rig: keep armature + clips, drop its mesh
bpy.ops.import_scene.gltf(filepath=RIG)
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rmn,rmx=bbox([o for o in bpy.data.objects if o.type=='MESH'])
rig_h=rmx.z-rmn.z; rig_footz=rmn.z; rig_cx=(rmn.x+rmx.x)/2; rig_cy=(rmn.y+rmx.y)/2
for o in [o for o in bpy.data.objects if o.type=='MESH']: bpy.data.objects.remove(o,do_unlink=True)
# sculpt: fit to the rig
bpy.ops.import_scene.gltf(filepath=MESH)
gol=next(o for o in bpy.data.objects if o.type=='MESH')
gmn,gmx=bbox([gol]); gol.scale=(rig_h/(gmx.z-gmn.z),)*3; bpy.context.view_layer.update()
gmn,gmx=bbox([gol])
gol.location.x+=rig_cx-(gmn.x+gmx.x)/2; gol.location.y+=rig_cy-(gmn.y+gmx.y)/2; gol.location.z+=rig_footz-gmn.z
bpy.context.view_layer.update()
# NOTE: do NOT reparent/remove the glTF root empties — that bakes the Y-up correction rotation
# into the armature and the export double-applies it (flattens depth). Proximity weights below
# leave 0 orphan verts, so the exporter's neutral-bone crash (the old reason for that hack) is moot.
# bind: PROXIMITY weights (not heat) — heat-weighting fails across a multi-shell sculpt and
# orphans most verts. Instead weight every vertex to its nearest bones by segment distance, so
# joints actually articulate. parent_set(ARMATURE_NAME) sets up the modifier + empty bone groups.
for o in bpy.context.selected_objects: o.select_set(False)
gol.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active=arm
bpy.ops.object.parent_set(type='ARMATURE_NAME')   # modifier + bone-named groups, no weights
# deform-bone rest segments in world space (skip IK/control bones)
segs=[]
for bn in arm.data.bones:
    if any(k in bn.name.lower() for k in ('ik','ctrl','pole','target','_end')): continue
    segs.append((bn.name, arm.matrix_world@bn.head_local, arm.matrix_world@bn.tail_local))
def seg_dist(P,H,T):
    d=T-H; L2=d.dot(d)
    if L2<1e-9: return (P-H).length
    t=max(0.0,min(1.0,(P-H).dot(d)/L2)); return (P-(H+d*t)).length
grp={nm:(gol.vertex_groups.get(nm) or gol.vertex_groups.new(name=nm)) for nm,_,_ in segs}
mw=gol.matrix_world; K=3; POW=4.0
for v in gol.data.vertices:
    P=mw@v.co
    ds=sorted((seg_dist(P,H,T),nm) for nm,H,T in segs)[:K]
    ws=[((1.0/(d+1e-3))**POW, nm) for d,nm in ds]; tot=sum(w for w,_ in ws) or 1.0
    for w,nm in ws: grp[nm].add([v.index], w/tot, 'REPLACE')
orphans=[v.index for v in gol.data.vertices if len(v.groups)==0]   # should be 0 now
print('proximity-weighted; residual orphans',len(orphans),'; deform bones',len(segs))
# --- author a "mold" idle: endpoints = rest (identity = the exact sculpt), a brief dwell in the
# mold, then a subtle heavy-stone breathe and back. Rotation-only (survives position-track strip). ---
from mathutils import Euler
for a in list(bpy.data.actions):
    if a.name.lower()=='idle': bpy.data.actions.remove(a)   # replace KayKit's posed idle
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
keypose(0,{}); keypose(12,{}); keypose(48,peak); keypose(84,{})   # mold-dwell -> breathe -> return (loops)
for f in idle.fcurves:
    for kp in f.keyframe_points: kp.interpolation='BEZIER'
bpy.context.scene.frame_start=0; bpy.context.scene.frame_end=84
for pb in arm.pose.bones: pb.rotation_quaternion=(1,0,0,0)   # leave rig at rest for a clean bind-pose export
# export armature + sculpt + all clips
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); gol.select_set(True)
os.makedirs(OUT,exist_ok=True); out=os.path.join(OUT,NAME+'_anim.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, use_selection=True, export_apply=False)
print('BUILT',out,os.path.getsize(out),'bytes; clips',len(bpy.data.actions),'; orphan-verts',len(orphans))
