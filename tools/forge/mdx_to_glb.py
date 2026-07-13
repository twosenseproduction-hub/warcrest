#!/usr/bin/env python3
"""MDX (WC3, v800) → animated glTF via headless Blender (bpy).

Rebuilds the uploaded model as a game-ready, rigged, animated .glb:
  • one mesh per material, skinned to a FLAT armature (one bone per MDX node)
  • rigid multi-bone weights straight from the MDX matrix groups
  • Idle/Walk/Attack/Death actions baked from the chosen MDX sequences

Why a flat armature: an MDX node's matrix is IDENTITY at rest (vertices already
live in model space; bones carry only animation deltas about their pivot). We
compose the MDX parent hierarchy ourselves into each bone's world matrix, so
Blender never needs the bone parenting — which removes all bone-orientation /
parent-coupling headaches. Rest bone = T(pivot); posed bone = M_world(t)·T(pivot),
so the armature-deform (pose·rest⁻¹) reproduces the MDX world matrix exactly.

Run:  python3 tools/forge/mdx_to_glb.py <in.mdx> <out.glb>
      (bpy is imported; no Blender install needed)
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mdx_parse
import bpy
from mathutils import Matrix, Quaternion, Vector

NONE = mdx_parse.NONE_ID
FPS = 30

# Build in NATIVE MDX space (Z-up) and let Blender's exporter do the single,
# uniform Z-up→Y-up conversion over mesh + skeleton + animation together
# (export_yup=True below). This only works with a PROPER parented rig whose
# animation is stored as local bone matrix_basis — the standard shape the glTF
# exporter converts correctly. (Doing the axis flip by hand desynced the mesh
# from the baked animation and tipped the model 90°.) C is kept as an identity
# hook so the deform algebra below reads uniformly.
C = Matrix.Identity(4)

# Which MDX sequence feeds each game clip (first match by prefix wins).
CLIP_SOURCES = [
    ('Idle',   ['Stand Ready', 'Stand - 1', 'Stand']),
    ('Walk',   ['Walk']),
    ('Attack', ['Attack - 1', 'Attack']),
    ('Death',  ['Death']),
]

# Per-texture base colour (no .blp available in the upload) so the untextured
# mesh still reads with sensible regions once Warcrest toon-shades it. Keyed by
# a substring of the texture path; falls back to a neutral cloth colour.
TEX_COLORS = [
    ('HighElfArcher', (0.86, 0.74, 0.55)),  # skin/face
    ('Ranger',        (0.20, 0.42, 0.36)),  # ranger cloak/tunic (teal)
    ('Watcher',       (0.16, 0.30, 0.32)),  # dark hood
    ('Sylvanus',      (0.24, 0.20, 0.34)),  # dark ranger accents
    ('Furion',        (0.40, 0.30, 0.18)),  # leather/wood
    ('Assassin',      (0.30, 0.26, 0.22)),  # straps
    ('gutz',          (0.62, 0.16, 0.16)),  # innards (decay) — rarely visible
    ('star2',         (0.85, 0.78, 0.42)),  # sparkle
]


def _hex(h):
    return ((h >> 16 & 255) / 255.0, (h >> 8 & 255) / 255.0, (h & 255) / 255.0)


# Rimwalker elf faction palette (from render3d.js elf builder): lavender-violet
# skin/hair, forest-green cloth, dark-teal cape, silver metal, gold trim, brown
# leather, glowing cyan eyes. The uploaded .mdx has no .blp textures, so we
# colour per region. Several regions share the "team colour" (empty) texture, so
# for the Archer these are assigned per geoset index (identified by height + the
# nodes each geoset's skin references).
RW = {'skin': 0xb39bd8, 'hair': 0x9d8ad6, 'cloth': 0x3c6b39, 'cape': 0x2f6a4a,
      'leaf': 0x4f8a5a, 'leather': 0x6e4a2a, 'metal': 0xd6dde6, 'trim': 0xd9c069,
      'wood': 0x8a6a3a, 'eye': 0xcffcff, 'boot': 0x4a3524}
# geoset → region, identified by rendering each geoset mesh in a distinct colour
# from 4 angles (front/back/sides) and reading off the silhouette.
RIMWALKER_ARCHER_GEO = {
    2: RW['cape'],     # flowing cloak / cape down the back
    3: RW['hair'],     # hair (+ hooded head)
    4: RW['cloth'],    # torso tunic
    5: RW['trim'],     # belt / waist band
    6: RW['skin'],     # bare upper arm
    7: RW['cape'],     # leggings (dark teal-green)
    8: RW['leather'],  # belt pouch / midriff strap
    9: RW['leather'],  # shoulder + hip leather (pauldron straps, tassets)
    10: RW['leaf'],    # leaf-green collar / shoulder trim
    11: RW['leather'], # quiver + bow (leather + wood)
    12: RW['trim'],    # arrow fletching
}


def geo_color(model, gi, path):
    if model.name == 'Archer' and gi in RIMWALKER_ARCHER_GEO:
        return _hex(RIMWALKER_ARCHER_GEO[gi])
    for key, col in TEX_COLORS:
        if key.lower() in (path or '').lower():
            return col
    return (0.45, 0.47, 0.44)


# ---- MDX track sampling ---------------------------------------------------
def _lerp(a, b, s): return [a[i] + (b[i] - a[i]) * s for i in range(len(a))]


def sample(track, t, window=None):
    """Value of a track at time t (ms), or None if no track/applicable keys.

    MDX animation is SEQUENCE-LOCAL: within a sequence only that sequence's
    keyframes apply. `window=(start,end)` restricts sampling to keys inside the
    interval; a track with no in-window key returns None → the caller uses the
    node's default (identity rotation / zero translation / unit scale). This is
    essential: e.g. Bone_Root only animates during Death (falls to 167°) and that
    key persists globally, so without windowing Walk/Attack/Stand inherit the
    fallen pose. (Warcraft III does exactly this per-sequence sampling.)"""
    if track is None or not track.keys:
        return None
    keys = track.keys
    if window is not None:
        s, e = window
        keys = [k for k in keys if s - 1 <= k[0] <= e + 1]
        if not keys:
            return None
    if t <= keys[0][0]:
        return keys[0][1]
    if t >= keys[-1][0]:
        return keys[-1][1]
    lo, hi = 0, len(keys) - 1
    for i in range(len(keys) - 1):
        if keys[i][0] <= t <= keys[i + 1][0]:
            lo, hi = i, i + 1
            break
    (t0, v0, _i0, o0) = keys[lo]
    (t1, v1, i1, _o1) = keys[hi]
    span = (t1 - t0) or 1
    s = (t - t0) / span
    if track.interp <= 0:            # stepped
        return v0
    if track.tag == 'KGRT':          # quaternion → slerp (approx for hermite/bezier)
        qa = Quaternion((v0[3], v0[0], v0[1], v0[2]))
        qb = Quaternion((v1[3], v1[0], v1[1], v1[2]))
        q = qa.slerp(qb, max(0.0, min(1.0, s)))
        return [q.x, q.y, q.z, q.w]
    if track.interp == 1 or o0 is None or i1 is None:   # linear
        return _lerp(v0, v1, s)
    # hermite / bezier cubic with tangents (o0 = outTan at lo, i1 = inTan at hi)
    if track.interp == 3:            # bezier (de Casteljau)
        u = 1 - s
        return [u * u * u * v0[k] + 3 * u * u * s * o0[k] + 3 * u * s * s * i1[k] + s * s * s * v1[k]
                for k in range(len(v0))]
    h1 = 2 * s**3 - 3 * s**2 + 1     # hermite
    h2 = -2 * s**3 + 3 * s**2
    h3 = s**3 - 2 * s**2 + s
    h4 = s**3 - s**2
    return [h1 * v0[k] + h2 * v1[k] + h3 * o0[k] + h4 * i1[k] for k in range(len(v0))]


def node_local(node, t, window=None):
    piv = Vector(node.pivot)
    tr = sample(node.tracks.get('KGTR'), t, window) or [0, 0, 0]
    ro = sample(node.tracks.get('KGRT'), t, window) or [0, 0, 0, 1]
    sc = sample(node.tracks.get('KGSC'), t, window) or [1, 1, 1]
    q = Quaternion((ro[3], ro[0], ro[1], ro[2]))
    return (Matrix.Translation(Vector(tr)) @ Matrix.Translation(piv)
            @ q.to_matrix().to_4x4()
            @ Matrix.Diagonal(Vector((sc[0], sc[1], sc[2], 1.0)))
            @ Matrix.Translation(-piv))


def world_matrices(model, t, order, window=None):
    """MDX world matrix per node object_id at time t, sampled within `window`
    (the active sequence interval) so out-of-sequence keys don't leak in."""
    W = {}
    for nid in order:
        node = model.node_by_id[nid]
        L = node_local(node, t, window)
        p = node.parent_id
        W[nid] = (W[p] @ L) if (p in W) else L
    return W


def topo_order(model):
    seen, order = set(), []
    def visit(nid):
        if nid in seen or nid not in model.node_by_id: return
        node = model.node_by_id[nid]
        if node.parent_id in model.node_by_id and node.parent_id not in seen:
            visit(node.parent_id)
        seen.add(nid); order.append(nid)
    for n in model.nodes:
        visit(n.object_id)
    return order


# ---- Blender build --------------------------------------------------------
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def safe_name(node):
    base = (node.name or 'node').replace(' ', '_').replace('.', '_')
    return f'{base}__{node.object_id}'


def build_armature(model, order):
    arm_data = bpy.data.armatures.new('Rig')
    arm_obj = bpy.data.objects.new('Rig', arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    bone_names = {}
    for nid in order:
        node = model.node_by_id[nid]
        eb = arm_data.edit_bones.new(safe_name(node))
        head = C @ Vector(node.pivot)               # pivot in Y-up space
        eb.head = head
        eb.tail = head + Vector((0, 4.0, 0))        # +Y stub → identity rest 3x3
        eb.roll = 0.0
        bone_names[nid] = eb.name
    # parent per the MDX node hierarchy (the glTF exporter bakes animation
    # consistently only for a connected skeleton, not disconnected flat bones)
    ebones = arm_data.edit_bones
    for nid in order:
        node = model.node_by_id[nid]
        p = node.parent_id
        if p in bone_names:
            ebones[bone_names[nid]].parent = ebones[bone_names[p]]
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj, bone_names


def idle_sequence(model):
    seq_by_name = {s.name: s for s in model.sequences}
    for _clip, sources in CLIP_SOURCES:
        if _clip != 'Idle':
            continue
        for n in sources:
            if n in seq_by_name:
                return seq_by_name[n]
    return model.sequences[0] if model.sequences else None


def geoset_visible_in(model, gi, seq):
    """True if geoset gi is visible during sequence `seq`. WC3 alpha tracks are
    SEQUENCE-LOCAL: only keyframes whose time falls inside [seq.start, seq.end]
    apply; a lone key elsewhere (e.g. the decay-bone key at t=199333) does NOT
    hide the geoset during Stand. If no in-window key, the static alpha applies."""
    ga = model.geoset_anims.get(gi)
    if not ga or seq is None:
        return True
    track = ga['track']
    if track is None or not track.keys:
        return ga['alpha'] >= 0.5
    win = [k for k in track.keys if seq.start - 1 <= k[0] <= seq.end + 1]
    if not win:
        return ga['alpha'] >= 0.5
    # lowest alpha across the window (hidden if it spends the window invisible)
    lo = min(k[1][0] for k in win)
    return lo >= 0.5


def build_meshes(model, arm_obj, bone_names):
    objs = []
    seq_idle = idle_sequence(model)
    skipped = []
    for gi, g in enumerate(model.geosets):
        if not geoset_visible_in(model, gi, seq_idle):
            skipped.append(gi)
            continue
        mesh = bpy.data.meshes.new(f'geo{gi}')
        verts = [list(C @ Vector(v)) for v in g.verts]     # Z-up → Y-up
        faces = [tuple(f) for f in g.faces]
        mesh.from_pydata(verts, [], faces)
        mesh.validate()
        # material colour
        texid = model.materials[g.material_id]['texture_id'] if g.material_id < len(model.materials) else 0
        path = model.textures[texid]['path'] if texid < len(model.textures) else ''
        col = geo_color(model, gi, path)
        if os.environ.get('FORGE_DEBUG_GEO'):     # distinct colour per geoset for ID
            import colorsys
            col = colorsys.hsv_to_rgb((gi * 0.147) % 1.0, 0.85, 1.0)
        mat = bpy.data.materials.new(f'mat{gi}')
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            bsdf.inputs['Base Color'].default_value = (col[0], col[1], col[2], 1.0)
            bsdf.inputs['Roughness'].default_value = 0.9
            if 'Metallic' in bsdf.inputs: bsdf.inputs['Metallic'].default_value = 0.0
        mesh.materials.append(mat)
        # UVs (kept for when real textures are added later)
        if g.uvs and len(g.uvs) == len(g.verts):
            uvl = mesh.uv_layers.new(name='UVMap')
            for poly in mesh.polygons:
                for li in poly.loop_indices:
                    vidx = mesh.loops[li].vertex_index
                    u, v = g.uvs[vidx]
                    uvl.data[li].uv = (u, 1.0 - v)
        obj = bpy.data.objects.new(f'geo{gi}', mesh)
        bpy.context.collection.objects.link(obj)
        # vertex groups + rigid weights from matrix groups
        vg_cache = {}
        for vidx in range(len(g.verts)):
            grp = g.vgroups[vidx] if vidx < len(g.vgroups) else 0
            bones = g.matrix_groups[grp] if grp < len(g.matrix_groups) else []
            bones = [b for b in bones if b in bone_names] or [order0 for order0 in [next(iter(bone_names))]]
            w = 1.0 / len(bones)
            for bid in bones:
                bname = bone_names[bid]
                vgrp = obj.vertex_groups.get(bname) or obj.vertex_groups.new(name=bname)
                vgrp.add([vidx], w, 'REPLACE')
        mod = obj.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm_obj
        obj.parent = arm_obj
        objs.append(obj)
    if skipped:
        print('  skipped hidden geosets (alpha≈0 in idle):', skipped)
    return objs


def bake_actions(model, arm_obj, bone_names, order):
    scene = bpy.context.scene
    scene.render.fps = FPS
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    Cinv = C.inverted()
    # R = rest world (pure translation to Y-up pivot); parent lookup for local basis.
    R = {nid: Matrix.Translation(C @ Vector(model.node_by_id[nid].pivot)) for nid in order}
    parent_bone = {}
    for nid in order:
        p = model.node_by_id[nid].parent_id
        parent_bone[nid] = p if p in bone_names else None
    pbones = {nid: arm_obj.pose.bones[bone_names[nid]] for nid in order}

    seq_by_name = {s.name: s for s in model.sequences}
    made = []
    for clip, sources in CLIP_SOURCES:
        seq = next((seq_by_name[n] for n in sources if n in seq_by_name), None)
        if not seq:
            print('  (no source sequence for %s)' % clip); continue
        dur_ms = max(1, seq.end - seq.start)
        nframes = max(2, int(round(dur_ms / 1000.0 * FPS)))
        action = bpy.data.actions.new(clip)
        arm_obj.animation_data_create()
        arm_obj.animation_data.action = action
        for f in range(nframes):
            t = seq.start + (seq.end - seq.start) * (f / (nframes - 1))
            W = world_matrices(model, t, order, window=(seq.start, seq.end))
            scene.frame_set(f + 1)
            # desired bone WORLD pose: D = (C·W·C⁻¹)·R  (deform = C·W·C⁻¹ in Y-up)
            D = {nid: (C @ W[nid] @ Cinv) @ R[nid] for nid in order}
            for nid in order:
                pb = pbones[nid]
                p = parent_bone[nid]
                # local basis so bone-world = D[nid], independent of set-order:
                #   world = parent_world · (R_p⁻¹·R) · basis  ⇒  basis = R⁻¹·R_p·D_p⁻¹·D
                if p is not None:
                    pb.matrix_basis = R[nid].inverted() @ R[p] @ D[p].inverted() @ D[nid]
                else:
                    pb.matrix_basis = R[nid].inverted() @ D[nid]
            for nid in order:
                pb = pbones[nid]
                pb.keyframe_insert('location', frame=f + 1)
                pb.keyframe_insert('rotation_quaternion', frame=f + 1)
                pb.keyframe_insert('scale', frame=f + 1)
        action.use_fake_user = True
        made.append((clip, action, nframes))
        print('  baked %-7s from %-12s  frames=%d' % (clip, seq.name, nframes))
    # reset to rest
    for nid in order:
        pbones[nid].matrix_basis = Matrix.Identity(4)
    bpy.ops.object.mode_set(mode='OBJECT')
    arm_obj.animation_data.action = None
    return made


def main():
    inp, outp = sys.argv[1], sys.argv[2]
    model = mdx_parse.parse(inp)
    order = topo_order(model)
    print('parsed: %d nodes, %d geosets, %d sequences' %
          (len(model.nodes), len(model.geosets), len(model.sequences)))
    clear_scene()
    arm_obj, bone_names = build_armature(model, order)
    build_meshes(model, arm_obj, bone_names)
    made = bake_actions(model, arm_obj, bone_names, order)
    # export: one glTF animation per action
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=outp, export_format='GLB',
        export_yup=True, export_apply=False,         # uniform Z-up→Y-up (see C above)
        export_skins=True, export_animations=True,
        export_animation_mode='ACTIONS',
        export_draco_mesh_compression_enable=False,
        use_selection=False,
    )
    print('exported', outp, os.path.getsize(outp), 'bytes | clips:', [m[0] for m in made])


if __name__ == '__main__':
    main()
