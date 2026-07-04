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
#
# BODY METHOD (per the modeling tutorials): a single connected "skin skeleton" of
# edges is laid along the donor bones, then a Skin modifier inflates it into an
# organic, watertight body with per-joint radii, and a Subdivision Surface smooths it.
# This gives a continuous quad mesh with proper silhouette + edge-loops — not
# intersecting primitives — while still hugging the bones so auto-weights bind clean.
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
  'trim':   '#c79a42',    # accent (belts, pauldrons, boots)
  'cloth':  '#6a2f38',    # secondary cloth (lower legs)
  'head':   '#c9b79c',
  'hair':   '#2a2320',
  'weapon': 'sword',      # sword | axe | spear | staff | none
  'steel':  '#c2cad6',
  'wood':   '#6b4a2a',
  'subsurf': 2,           # subdivision level for the body
  'pauldrons': True,      # shoulder plates accent
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
    if not b: return None
    return arm.matrix_world @ b.head_local

# derive donor scale + true axes so our ~1.7-unit design constants match the donor rig,
# regardless of whether the import left it Y-up or Z-up.
_hd = bone('head'); _ft = bone('foot_l') or bone('ball_l')
U = ((_hd - _ft).length/1.7) if (_hd is not None and _ft is not None) else 1.0
UP = ((_hd - _ft).normalized()) if (_hd is not None and _ft is not None) else V((0,1,0))
print('DONOR_SCALE U=', round(U,2), 'UP=', tuple(round(x,2) for x in UP))
B = P['build'] * U

Mskin  = mat('u_skin',  P['skin'])
Marmor = mat('u_armor', P['armor'])
Mtrim  = mat('u_trim',  P['trim'])
Mcloth = mat('u_cloth', P['cloth'])
Mhead  = mat('u_head',  P['head'])
Mhair  = mat('u_hair',  P['hair'])
# body material order (polygon material_index maps into this): 0 armor,1 skin,2 head,3 cloth
BODY_MATS = [Marmor, Mskin, Mhead, Mcloth]

# ===================================================================================
# 1. SKIN SKELETON  — a connected edge graph along the bones, one vert per joint.
#    (r) is the skin radius at that joint, in world units. The Skin modifier inflates
#    these edges into an organic body; Subsurf then smooths to clean quads.
# ===================================================================================
def bp(nm, fallback=None):
    p = bone(nm)
    return p if p is not None else fallback

# joint table: name -> (world pos, radius, region-material-index into BODY_MATS)
pelv = bp('pelvis'); sp1 = bp('spine_01'); sp2 = bp('spine_02', sp1); sp3 = bp('spine_03')
neck = bp('neck_01'); head = bp('head')

verts = []      # (co, radius, matidx)
edges = []      # (i,j)
vidx  = {}      # key -> vert index

def addv(key, co, r, mi):
    vidx[key] = len(verts); verts.append((co, r*B, mi)); return vidx[key]

def link(a, b): edges.append((vidx[a], vidx[b]))

# spine chain (armor), thinning at the neck, opening back up at the head
addv('pelvis', pelv, 0.21, 0)
addv('spine1', sp1,  0.20, 0)
addv('spine2', sp2,  0.205,0)
addv('spine3', sp3,  0.18, 0)
addv('neck',   neck, 0.085,1)
# head sits a touch above the head bone so the skull reads as a mass, not a knob
head_top = head + UP*(0.14*U)
addv('head', head_top, 0.17, 2)
for a,b in (('pelvis','spine1'),('spine1','spine2'),('spine2','spine3'),('spine3','neck'),('neck','head')):
    link(a,b)

# arms (skin) — branch off the upper spine; clavicle if the donor has one
for s in ('l','r'):
    cl = bp('clavicle_'+s, sp3); ua = bp('upperarm_'+s); la = bp('lowerarm_'+s); ha = bp('hand_'+s)
    if ua is None: continue
    addv('cla_'+s, (sp3+ua)/2 if cl is None else cl, 0.13, 0)
    addv('ua_'+s,  ua, 0.105, 1)
    addv('la_'+s,  la, 0.082, 1)
    if ha is not None: addv('ha_'+s, ha, 0.06, 1)
    link('spine3','cla_'+s); link('cla_'+s,'ua_'+s); link('ua_'+s,'la_'+s)
    if ha is not None: link('la_'+s,'ha_'+s)

# legs — thigh/calf (armor) to foot (cloth)
for s in ('l','r'):
    th = bp('thigh_'+s); ca = bp('calf_'+s); ft = bp('foot_'+s); ba = bp('ball_'+s, ft)
    if th is None: continue
    addv('th_'+s, th, 0.135, 0)
    addv('ca_'+s, ca, 0.10, 0)
    if ft is not None: addv('ft_'+s, ft, 0.075, 3)
    if ba is not None and ba is not ft: addv('ba_'+s, ba, 0.06, 3)
    link('pelvis','th_'+s); link('th_'+s,'ca_'+s)
    if ft is not None: link('ca_'+s,'ft_'+s)
    if 'ba_'+s in vidx: link('ft_'+s,'ba_'+s)

# build the skin-skeleton mesh
skmesh = bpy.data.meshes.new(NAME+'_skin')
skmesh.from_pydata([co for co,_,_ in verts], edges, [])
skmesh.update()
body = bpy.data.objects.new(NAME, skmesh)
bpy.context.scene.collection.objects.link(body)

# ---- Skin modifier: set per-vert radius + mark the pelvis as root ----
skin = body.modifiers.new('Skin', 'SKIN')
sk_layer = body.data.skin_vertices[0].data
for i,(co,r,mi) in enumerate(verts):
    sk_layer[i].radius = (r, r)
sk_layer[vidx['pelvis']].use_root = True
skin.use_smooth_shade = True
# subdivision surface for a smooth, rounded silhouette with clean quads
sub = body.modifiers.new('Subsurf', 'SUBSURF')
sub.levels = int(P['subsurf']); sub.render_levels = int(P['subsurf'])

# bake modifiers into real geometry
for o in bpy.context.selected_objects: o.select_set(False)
body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.modifier_apply(modifier='Skin')
bpy.ops.object.modifier_apply(modifier='Subsurf')

# ===================================================================================
# 2. REGION MATERIALS — classify each polygon by the nearest labelled joint so the
#    single skinned mesh reads as skin / armor / head / cloth without seams.
# ===================================================================================
for m in BODY_MATS: body.data.materials.append(m)
region_pts = [(co, mi) for co,_,mi in verts]
mw = body.matrix_world
for poly in body.data.polygons:
    c = mw @ poly.center
    best, bmi = 1e18, 0
    for pco, mi in region_pts:
        d = (pco - c).length_squared
        if d < best: best, bmi = d, mi
    poly.material_index = bmi
    poly.use_smooth = True

# ===================================================================================
# 3. ACCENT PIECES — a few crisp low-poly props read better than trying to model
#    everything in the skin mesh: hair cap, belt, pauldrons, boots. Joined into body.
# ===================================================================================
accent = []
def blob(center, rx, ry, rz, m):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=9, radius=1.0)
    bmesh.ops.transform(bm, matrix=mathutils.Matrix.Translation(center) @ mathutils.Matrix.Diagonal((rx,ry,rz,1)), verts=bm.verts)
    accent.append((bm, m))
def box(center, sx, sy, sz, m):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=mathutils.Matrix.Translation(center) @ mathutils.Matrix.Diagonal((sx,sy,sz,1)), verts=bm.verts)
    accent.append((bm, m))

# hair cap over the crown
blob(head_top + UP*(0.05*U), 0.175*U, 0.15*U, 0.175*U, Mhair)
# belt at the pelvis/spine1 midpoint
blob((pelv+sp1)/2, 0.24*B, 0.07*B, 0.20*B, Mtrim)
# pauldrons — sit just over the shoulder joint, a touch outboard, kept small so they
# read as a plate and don't balloon past the arm
if P['pauldrons']:
    for s in ('l','r'):
        ua = bp('upperarm_'+s); sp = bp('spine_03', ua)
        if ua is not None:
            outward = (ua - sp); outward = outward.normalized() if outward.length else V((0,0,0))
            blob(ua + UP*(0.05*U) + outward*(0.03*U), 0.105*B, 0.07*B, 0.105*B, Mtrim)
# boots
for s in ('l','r'):
    ft = bp('foot_'+s)
    if ft is not None: box(ft - UP*(0.02*U), 0.13*U, 0.09*U, 0.24*U, Mtrim)

if accent:
    objs=[]
    for i,(bm,m) in enumerate(accent):
        mm=bpy.data.meshes.new('%s_a%d'%(NAME,i)); bm.to_mesh(mm); bm.free()
        ob=bpy.data.objects.new('%s_a%d'%(NAME,i), mm); bpy.context.scene.collection.objects.link(ob)
        mm.materials.append(m)
        for p in mm.polygons: p.use_smooth=True
        objs.append(ob)
    for o in bpy.context.selected_objects: o.select_set(False)
    body.select_set(True)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()

# ===================================================================================
# 4. WEAPON — bone-parented to hand_r so it rides the animation.
# ===================================================================================
WEAP = P['weapon']
weap_parts = []
def wpart(bm, m): weap_parts.append((bm,m))
if WEAP != 'none':
    Msteel, Mwood = mat('u_steel',P['steel']), mat('u_wood',P['wood'])
    ha = bone('hand_r')
    if ha is not None:
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

# ---------- bind body to the donor armature (auto weights — clean because geo hugs bones) ----------
for o in bpy.context.selected_objects: o.select_set(False)
body.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# weapon: bone-parent to hand_r so it follows the hand through the clips.
# matrix_parent_inverse must cancel the bone's rest transform or the prop flies off.
if weap_parts:
    objs=[]
    for i,(bm,m) in enumerate(weap_parts):
        mm=bpy.data.meshes.new('%s_w%d'%(NAME,i)); bm.to_mesh(mm); bm.free()
        ob=bpy.data.objects.new('%s_w%d'%(NAME,i), mm); bpy.context.scene.collection.objects.link(ob)
        mm.materials.append(m)
        for p in mm.polygons: p.use_smooth=True
        objs.append(ob)
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    weap = bpy.context.view_layer.objects.active; weap.name = NAME+'_weapon'
    pb = arm.pose.bones.get('hand_r')
    weap.parent = arm; weap.parent_type='BONE'; weap.parent_bone='hand_r'
    if pb: weap.matrix_parent_inverse = (arm.matrix_world @ pb.matrix).inverted()

# ---------- export ----------
os.makedirs(OUT, exist_ok=True)
outpath = os.path.join(OUT, NAME + '_anim.glb')
for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=outpath, export_format='GLB', export_animations=True,
    export_apply=False, use_selection=True)
tri = sum(len(p.vertices)-2 for p in body.data.polygons)
print('BUILT', outpath, os.path.getsize(outpath), 'bytes; body tris ~', tri, '; actions:', [a.name for a in bpy.data.actions])
