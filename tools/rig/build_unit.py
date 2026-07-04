#!/usr/bin/env python3
# Warcrest unit pipeline — author a low-poly humanoid in Blender *around* a shipped
# donor skeleton, bind it (clean by construction), reuse the donor's clips, export a
# game-ready <name>_anim.glb. Runs headless here and on a desktop Blender:
#
#   blender -b -noaudio --python tools/rig/build_unit.py -- \
#       --name skeleton_warrior --donor elf_warrior --spec '{...}' --out assets/models
#
# The --spec JSON is the "direction": palette + proportions + weapon. Reproduce a
# reference by filling it in. Because the body is generated on the donor's bones, the
# donor's idle/run/attack animations drive it correctly with automatic weights.
import bpy, bmesh, mathutils, math, sys, json, os
V = mathutils.Vector

def argval(flag, default=None):
    a = sys.argv
    if '--' in a: a = a[a.index('--')+1:]
    return a[a.index(flag)+1] if flag in a else default

NAME  = argval('--name', 'test_unit')
DONOR = argval('--donor', 'elf_warrior')
OUT   = argval('--out', os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'models'))
ROOT  = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SPEC  = json.loads(argval('--spec', '{}'))

# ---- direction defaults (overridden by --spec) ----
P = {
  'height': 1.0,          # relative scale multiplier
  'build': 1.0,           # limb thickness multiplier
  'skin':   '#c9b79c',    # exposed flesh/bone
  'armor':  '#3a4660',    # torso/legs
  'trim':   '#c79a42',    # accent (belts, pauldrons)
  'cloth':  '#6a2f38',    # secondary cloth
  'head':   '#c9b79c',
  'hair':   '#2a2320',
  'weapon': 'sword',      # sword | axe | spear | staff | none
  'steel':  '#c2cad6',
  'wood':   '#6b4a2a',
}
P.update(SPEC)

def hx(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))

def mat(name, hexcol, emit=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    c = hx(hexcol)
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = 0.7
    if emit>0:
        try: b.inputs['Emission Color'].default_value=(*c,1)
        except: pass
        b.inputs['Emission Strength'].default_value = emit
    return m

# ---------- scene reset + donor import ----------
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.armatures):
    for d in list(blk): blk.remove(d)
donor_path = os.path.join(ROOT, 'assets', 'models', DONOR + '_anim.glb')
bpy.ops.import_scene.gltf(filepath=donor_path)
arm = next(o for o in bpy.data.objects if o.type=='ARMATURE')
# keep the armature + its actions; drop the donor's meshes — we build our own body on its bones
for o in list(bpy.data.objects):
    if o.type=='MESH': bpy.data.objects.remove(o, do_unlink=True)
arm.name = 'Armature'

def bone(nm):
    b = arm.data.bones.get(nm)
    if not b: return None, None
    return arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local

# ---------- primitive builders (return bmesh geometry merged into one mesh) ----------
mesh_parts = []   # (bmesh, material)

def seg(p0, p1, r0, r1, m, squash=1.0):
    """Tapered capsule-ish cylinder from p0->p1 (radii r0,r1). squash flattens front-back."""
    bm = bmesh.new()
    d = (p1 - p0); L = d.length or 1e-4; dirn = d / L
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r0, radius2=r1, depth=L)
    # cone is along +Z centered at origin; move up so base at 0, then orient p0->p1
    quat = V((0,0,1)).rotation_difference(dirn)
    mtx = mathutils.Matrix.Translation(p0) @ quat.to_matrix().to_4x4() @ mathutils.Matrix.Translation((0,0,L/2))
    bmesh.ops.transform(bm, matrix=mtx, verts=bm.verts)
    if squash != 1.0:
        cy = sum((v.co.y for v in bm.verts), 0.0)/len(bm.verts)
        for v in bm.verts: v.co.z *= squash   # flatten front-back (depth), keeping height
    mesh_parts.append((bm, m))

def blob(center, rx, ry, rz, m):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=1.0)
    S = mathutils.Matrix.Diagonal((rx,ry,rz,1))
    bmesh.ops.transform(bm, matrix=mathutils.Matrix.Translation(center) @ S, verts=bm.verts)
    mesh_parts.append((bm, m))

def box(center, sx, sy, sz, m):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    S = mathutils.Matrix.Diagonal((sx,sy,sz,1))
    bmesh.ops.transform(bm, matrix=mathutils.Matrix.Translation(center) @ S, verts=bm.verts)
    mesh_parts.append((bm, m))

# derive donor scale so my ~1.7-unit design constants match the (large) donor skeleton
_hd = bone('head')[0]; _ft = bone('foot_l')[0] or bone('ball_l')[0]
U = ((_hd - _ft).length/1.7) if (_hd is not None and _ft is not None) else 1.0
print('DONOR_SCALE U=', round(U,2))
B = P['build'] * U
Mskin, Marmor, Mtrim, Mcloth, Mhead, Mhair = (mat('u_skin',P['skin']), mat('u_armor',P['armor']),
    mat('u_trim',P['trim']), mat('u_cloth',P['cloth']), mat('u_head',P['head']), mat('u_hair',P['hair']))

# torso: a filled chest+belly from pelvis to the neck, plus a chest mass at the sternum
pelv = bone('pelvis')[0]; sp1 = bone('spine_01')[0]; sp3 = bone('spine_03')[0]; neck = bone('neck_01')[0]
seg(pelv, neck, 0.15*B, 0.17*B, Marmor, squash=0.72)             # torso trunk (wider, reaches the neck)
blob(sp3, 0.20*B, 0.16*B, 0.13*B, Marmor)                       # chest mass
box((pelv+sp1)/2, 0.22*B, 0.15*B, 0.15*B, Mcloth)                # hips
blob((pelv+sp1)/2 + V((0,-0.02,0))*U, 0.23*B, 0.06*B, 0.17*B, Mtrim)   # belt
# neck bridges torso to head so the head never floats
hd = bone('head')[0]
if neck and hd: seg(neck, hd, 0.07*B, 0.06*B, Mskin)
# shoulders sit at the arm sockets (sides), not the sternum
for s in ('l','r'):
    ua = bone('upperarm_'+s)[0]
    if ua: blob(ua, 0.12*B, 0.11*B, 0.12*B, Mtrim)

# head + hair
if hd:
    blob(hd + V((0,0.06,0.02))*U, 0.15*U, 0.17*U, 0.15*U, Mhead)
    blob(hd + V((0,0.13,-0.03))*U, 0.155*U, 0.12*U, 0.155*U, Mhair)   # hair cap

# arms
for side in ('l','r'):
    ua=bone('upperarm_'+side)[0]; la=bone('lowerarm_'+side)[0]; ha=bone('hand_'+side)[0]
    if ua and la: seg(ua, la, 0.085*B, 0.07*B, Mskin)
    if la and ha: seg(la, ha, 0.07*B, 0.055*B, Mskin)
    if ha: blob(ha, 0.07*U, 0.07*U, 0.065*U, Mskin)

# legs
for side in ('l','r'):
    th=bone('thigh_'+side)[0]; ca=bone('calf_'+side)[0]; ft=bone('foot_'+side)[0]
    if th and ca: seg(th, ca, 0.11*B, 0.085*B, Marmor)
    if ca and ft: seg(ca, ft, 0.085*B, 0.06*B, Mcloth)
    if ft: box(ft + V((0,-0.02,0.05))*U, 0.12*U, 0.08*U, 0.22*U, Mtrim)   # boot

# ---------- weapon (bone-parented to hand_r so it rides the animation) ----------
WEAP = P['weapon']
weap_parts = []
def wpart(bm, m): weap_parts.append((bm,m))
if WEAP != 'none':
    Msteel, Mwood = mat('u_steel',P['steel']), mat('u_wood',P['wood'])
    ha = bone('hand_r')[0]
    if ha:
        if WEAP in ('sword','axe'):
            bm=bmesh.new(); bmesh.ops.create_cone(bm,cap_ends=True,segments=6,radius1=0.03,radius2=0.02,depth=1.1)
            bmesh.ops.transform(bm,matrix=mathutils.Matrix.Translation(ha+V((0,0.45,0))),verts=bm.verts); wpart(bm,Msteel)  # blade
            bm2=bmesh.new(); bmesh.ops.create_cube(bm2,size=1.0); bmesh.ops.transform(bm2,matrix=mathutils.Matrix.Translation(ha)@mathutils.Matrix.Diagonal((0.20,0.04,0.04,1)),verts=bm2.verts); wpart(bm2,Mwood)  # crossguard
        elif WEAP=='spear':
            bm=bmesh.new(); bmesh.ops.create_cone(bm,cap_ends=True,segments=6,radius1=0.02,radius2=0.02,depth=1.6)
            bmesh.ops.transform(bm,matrix=mathutils.Matrix.Translation(ha+V((0,0.5,0))),verts=bm.verts); wpart(bm,Mwood)
            bm2=bmesh.new(); bmesh.ops.create_cone(bm2,cap_ends=True,segments=6,radius1=0.06,radius2=0.0,depth=0.3); bmesh.ops.transform(bm2,matrix=mathutils.Matrix.Translation(ha+V((0,1.3,0))),verts=bm2.verts); wpart(bm2,Msteel)
        elif WEAP=='staff':
            bm=bmesh.new(); bmesh.ops.create_cone(bm,cap_ends=True,segments=6,radius1=0.025,radius2=0.025,depth=1.5); bmesh.ops.transform(bm,matrix=mathutils.Matrix.Translation(ha+V((0,0.45,0))),verts=bm.verts); wpart(bm,Mwood)

# ---------- realise bmesh parts into one body object ----------
def to_object(name, parts):
    me = bpy.data.meshes.new(name)
    merged = bmesh.new()
    tmp = bpy.data.meshes.new(name+'_tmp')
    for bm, m in parts:
        # assign material index by appending
        idx = None
    # build by converting each bm into the merged bmesh, tagging material via face layer later
    # simpler: create separate objects then join
    objs=[]
    for i,(bm,m) in enumerate(parts):
        mm=bpy.data.meshes.new('%s_p%d'%(name,i)); bm.to_mesh(mm); bm.free()
        ob=bpy.data.objects.new('%s_p%d'%(name,i), mm); bpy.context.scene.collection.objects.link(ob)
        mm.materials.append(m); objs.append(ob)
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    body=bpy.context.view_layer.objects.active; body.name=name
    # smooth shading
    for p in body.data.polygons: p.use_smooth=True
    return body

body = to_object(NAME, mesh_parts)

# ---------- bind body to the donor armature (auto weights — clean because geo hugs bones) ----------
for o in bpy.context.selected_objects: o.select_set(False)
body.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# weapon: bone-parent to hand_r so it follows the hand through the clips.
# matrix_parent_inverse must cancel the bone's rest transform or the prop flies off.
if weap_parts:
    weap = to_object(NAME+'_weapon', weap_parts)
    pb = arm.pose.bones.get('hand_r')
    weap.parent = arm; weap.parent_type='BONE'; weap.parent_bone='hand_r'
    if pb: weap.matrix_parent_inverse = (arm.matrix_world @ pb.matrix).inverted()

# ---------- export ----------
os.makedirs(OUT, exist_ok=True)
outpath = os.path.join(OUT, NAME + '_anim.glb')
for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=outpath, export_format='GLB', export_animations=True,
    export_apply=False, use_selection=True)
print('BUILT', outpath, os.path.getsize(outpath), 'bytes; actions:', [a.name for a in bpy.data.actions])
