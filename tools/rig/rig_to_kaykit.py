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
# clean glTF scene-root empties (exporter bug)
for o in list(bpy.data.objects):
    if o.type=='EMPTY':
        for c in list(o.children):
            mw=c.matrix_world.copy(); c.parent=None; c.matrix_world=mw
        bpy.data.objects.remove(o,do_unlink=True)
# bind (automatic weights)
for o in bpy.context.selected_objects: o.select_set(False)
gol.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active=arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# fully weight orphan verts -> a central bone (prevents the exporter neutral-bone crash)
central=None
for cand in ('Hips','spine','Spine','Root','root','Pelvis','pelvis','spine_01'):
    if gol.vertex_groups.get(cand): central=cand; break
if central is None:
    central=arm.data.bones[0].name
    if not gol.vertex_groups.get(central): gol.vertex_groups.new(name=central)
orphans=[v.index for v in gol.data.vertices if len(v.groups)==0]
if orphans: gol.vertex_groups.get(central).add(orphans,1.0,'REPLACE')
# export armature + sculpt + all clips
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); gol.select_set(True)
os.makedirs(OUT,exist_ok=True); out=os.path.join(OUT,NAME+'_anim.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, use_selection=True, export_apply=False)
print('BUILT',out,os.path.getsize(out),'bytes; clips',len(bpy.data.actions),'; orphan-verts',len(orphans))
