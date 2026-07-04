#!/usr/bin/env python3
# Merge KayKit clip glbs (Rig_*_General + Rig_*_MovementBasic) onto a mesh-only KayKit character,
# producing <name>_anim.glb (mesh + rig + all clips). The clips share the character's bone names,
# so they retarget for free.
#   blender -b -noaudio --python tools/rig/kaykit_merge_anims.py -- \
#     --mesh assets/models/kaykit/Druid.glb --anims A.glb,B.glb --name druid --out assets/models
import bpy, os, sys
def arg(f,d=None):
    a=sys.argv; a=a[a.index('--')+1:] if '--' in a else a
    return a[a.index(f)+1] if f in a else d
MESH=arg('--mesh'); ANIMS=arg('--anims').split(','); NAME=arg('--name'); OUT=arg('--out','assets/models')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
for blk in (bpy.data.meshes,bpy.data.armatures,bpy.data.actions):
    for x in list(blk): blk.remove(x)
bpy.ops.import_scene.gltf(filepath=MESH)
charArm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
charObjs=set(bpy.data.objects)
for ap in ANIMS:
    bpy.ops.import_scene.gltf(filepath=ap.strip())
    for o in list(bpy.data.objects):
        if o not in charObjs and o.type in ('ARMATURE','MESH','EMPTY'):
            bpy.data.objects.remove(o, do_unlink=True)   # drop the anim rig, keep its actions
# assign every action to the character armature via NLA (so all export)
charArm.animation_data_create()
for act in list(bpy.data.actions):
    tr=charArm.animation_data.nla_tracks.new(); tr.strips.new(act.name, int(act.frame_range[0]), act)
os.makedirs(OUT,exist_ok=True); out=os.path.join(OUT,NAME+'_anim.glb')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, use_selection=True)
print('BUILT',out,os.path.getsize(out),'bytes; clips',len(bpy.data.actions))
