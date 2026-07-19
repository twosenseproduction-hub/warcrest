#!/usr/bin/env python3
# Bring an AI-image-to-3D export (Tripo / Meshy / Rodin: FBX/OBJ/GLB + a basecolor texture)
# into the game as a low-poly, textured GLB creep/unit. Handles the common case: a single
# multi-million-tri sculpt with a baked PBR set -> decimate, re-texture with basecolor,
# orient to face +Z, scale + plant feet, export <name>.glb. (This is how the dragon/Thoryn came in.)
#
#   blender -b -noaudio --python tools/rig/import_ai3d.py -- \
#     --in model.fbx --tex basecolor.jpg --name stone_revenant --height 4.6 --yaw -90 --out assets/models
#
# The game re-flattens PBR to its toon look on load (add the name to RIG_SPECS + the flatten list).
import bpy, mathutils, os, sys, math
V=mathutils.Vector
def arg(f,d=None):
    a=sys.argv; a=a[a.index('--')+1:] if '--' in a else a
    return a[a.index(f)+1] if f in a else d
IN=arg('--in'); TEX=arg('--tex'); NAME=arg('--name','ai_unit'); HEIGHT=float(arg('--height','4.6'))
YAW=float(arg('--yaw','0')); TRIS=int(arg('--tris','16000'))
OUT=arg('--out', os.path.join(os.path.dirname(__file__),'..','..','assets','models'))

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
ext=os.path.splitext(IN)[1].lower()
if ext=='.fbx': bpy.ops.import_scene.fbx(filepath=IN)
elif ext=='.obj': bpy.ops.wm.obj_import(filepath=IN)
elif ext in ('.glb','.gltf'): bpy.ops.import_scene.gltf(filepath=IN)
else: raise SystemExit('unsupported input '+ext)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in bpy.context.selected_objects: o.select_set(False)
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
if len(meshes)>1: bpy.ops.object.join()
ob=bpy.context.view_layer.objects.active; ob.name=NAME
# orient to face +Z, bake rotation
if YAW: ob.rotation_euler=(0,0,math.radians(YAW)); bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
# decimate to target tri budget
ob.data.calc_loop_triangles(); n=len(ob.data.loop_triangles)
if n>TRIS:
    d=ob.modifiers.new('dec','DECIMATE'); d.ratio=TRIS/float(n); bpy.ops.object.modifier_apply(modifier='dec')
for p in ob.data.polygons: p.use_smooth=True
# re-texture with the basecolor (if given)
if TEX:
    mat=bpy.data.materials.new(NAME+'_mat'); mat.use_nodes=True; b=mat.node_tree.nodes.get('Principled BSDF')
    img=bpy.data.images.load(TEX); img.colorspace_settings.name='sRGB'
    tn=mat.node_tree.nodes.new('ShaderNodeTexImage'); tn.image=img
    mat.node_tree.links.new(tn.outputs['Color'], b.inputs['Base Color'])
    try: b.inputs['Metallic'].default_value=0.0
    except: pass
    ob.data.materials.clear(); ob.data.materials.append(mat)
# scale to HEIGHT, centre X/Y, plant feet at z=0
def bounds():
    mn=V((1e9,)*3); mx=V((-1e9,)*3)
    for v in ob.data.vertices:
        w=ob.matrix_world@v.co
        for i in range(3): mn[i]=min(mn[i],w[i]); mx[i]=max(mx[i],w[i])
    return mn,mx
bpy.context.view_layer.update(); mn,mx=bounds(); size=mx-mn; up=max(range(3),key=lambda i:size[i])
ob.scale=(HEIGHT/size[up],)*3; bpy.context.view_layer.update(); mn,mx=bounds()
ob.location.x-=(mn.x+mx.x)/2; ob.location.y-=(mn.y+mx.y)/2; ob.location.z-=mn.z
os.makedirs(OUT,exist_ok=True); out=os.path.join(OUT,NAME+'.glb')
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True)
ob.data.calc_loop_triangles()
print('BUILT',out,os.path.getsize(out),'bytes; tris',len(ob.data.loop_triangles))
