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
import bmesh
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


def _norm(s):
    return ''.join(s.lower().split()).replace('-', '')


def find_sequence(model, sources):
    """Match a source name to a model sequence, whitespace/dash-insensitive and
    prefix-tolerant (WC3 naming varies: 'Attack - 1' vs 'Attack -1' vs 'Attack')."""
    seqs = model.sequences
    for src in sources:
        ns = _norm(src)
        for s in seqs:                       # exact (normalized) first
            if _norm(s.name) == ns:
                return s
        for s in seqs:                       # then prefix (e.g. 'Attack' → 'Attack1')
            if _norm(s.name).startswith(ns):
                return s
    return None

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
    # night-elf textures (Moon Hunter / Huntress and kin)
    ('Priestess',     (0.69, 0.66, 0.82)),  # moon-priestess rider: pale lavender
    ('Sentinel',      (0.24, 0.44, 0.42)),  # sentinel armour: teal
    ('IronRaven',     (0.26, 0.28, 0.34)),  # dark iron / raven feathers
]


def _s2l(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _hex(h):
    # hex is an sRGB display colour; Blender colour sockets & colour attributes
    # are LINEAR, so convert (otherwise mid-tones read washed-out/pale).
    return (_s2l((h >> 16 & 255) / 255.0), _s2l((h >> 8 & 255) / 255.0), _s2l((h & 255) / 255.0))


# Rimwalker elf faction palette (from render3d.js elf builder): lavender-violet
# skin/hair, forest-green cloth, dark-teal cape, silver metal, gold trim, brown
# leather, glowing cyan eyes. The uploaded .mdx has no .blp textures, so we
# colour per region. Several regions share the "team colour" (empty) texture, so
# for the Archer these are assigned per geoset index (identified by height + the
# nodes each geoset's skin references).
# Palette tuned to the "night purple archer" reference: deep violet skin, olive
# green cloth with gold geometric patterning, dark carved wood, warm gold trim.
RW = {'skin': 0x4e4270, 'hair': 0x241a2e, 'cloth': 0x4f6a33, 'cape': 0x3a5427,
      'leaf': 0x6f8a37, 'leather': 0x5a3d22, 'metal': 0xcaa63c, 'trim': 0xcaa63c,
      'wood': 0x5a3d22, 'eye': 0xcffcff, 'boot': 0x3f2c1a, 'gold': 0xcaa63c}
# geoset → region, identified by rendering each geoset mesh in a distinct colour
# from 4 angles (front/back/sides) and reading off the silhouette.
# geoset → (material region, base colour). Region drives the procedural
# hand-painted detail baked into the albedo (weave, grain, strands, mottle …).
# Identified by rendering each geoset in a distinct colour from 4 angles.
# Night-Elf face feature colours (ref: WoW NE face set) — painted per vertex on
# the head geoset by the node each vertex is skinned to (Eye L/R, Lip A, else face).
# deeper/saturated so they survive the game's bright toon ramp (a light base
# washes to white and the features stop contrasting).
FACE_EYE = 0x8fe6ff    # punchy cyan glow
FACE_LIP = 0x241018    # near-black lips
FACE_SKIN = 0x4e4270   # deep violet skin
FACE_PAINT = 0xe6ddc8  # bone-white war-paint markings
FACE_BROW = 0x2a2038   # dark brow / eye socket

RIMWALKER_ARCHER_GEO = {
    2:  ('tribal',  RW['cape']),     # flowing cloak / cape down the back
    3:  ('face',    RW['skin']),     # head: face + glowing eyes + dark lips
    4:  ('tribal',  RW['cloth']),    # torso tunic (gold-patterned)
    5:  ('trim',    RW['trim']),     # belt / waist band (gold)
    6:  ('skin',    RW['skin']),     # bare upper arm
    7:  ('tribal',  RW['cape']),     # leggings (gold-patterned)
    8:  ('metal',   RW['gold']),     # forearm bands (gold)
    9:  ('leather', RW['leather']),  # shoulder + hip leather
    10: ('tribal',  RW['leaf']),     # leaf-green collar / shoulder trim (patterned)
    11: ('wood',    RW['wood']),     # quiver + bow (carved dark wood)
    12: ('trim',    RW['trim']),     # arrow fletching (gold)
}

# Moon Hunter (Huntress) — Night Elf sentinel on a nightsaber. Geosets IDed by
# the distinct-colour render: g0 cat body, g1 paws, g2 cape, g4 rider (face/skin),
# g5 hair, g6 glaive blade, g7 glaive haft, g8/g9 armour accents.
MOON_HUNTER_GEO = {
    0:  ('tiger', 0x35386a),   # nightsaber body — dark indigo hide + stripes + pale belly
    1:  ('skin',  0x1d1e33),   # paws — near-black
    2:  ('cloth', 0x2f4a66),   # sentinel cape — deep teal-blue
    4:  ('face',  0xb39bd8),   # rider: lavender skin (+ eyes/lips if present)
    5:  ('hair',  0x2b2750),   # hair / headdress — dark violet
    6:  ('metal', 0xc6d2dc),   # moon glaive blade — bright moon-silver
    7:  ('wood',  0x4a3a2a),   # glaive haft — dark wood
    8:  ('cloth', 0x3a5a72),   # armour accent — teal
    9:  ('metal', 0xc6d2dc),   # buckle / accent — silver
}

GEO_MAPS = {'Archer': RIMWALKER_ARCHER_GEO, 'HuntressNew': MOON_HUNTER_GEO}


def geo_region(model, gi, path):
    """Return (region, rgb) for a geoset. region ∈ skin/cloth/leather/metal/
    hair/wood/trim/face and selects the painted-material pattern. Per-model geoset
    maps (GEO_MAPS) win; otherwise fall back to texture-name colour heuristics."""
    gmap = GEO_MAPS.get(model.name)
    if gmap and gi in gmap:
        region, hexc = gmap[gi]
        return region, _hex(hexc)
    lin = lambda c: (_s2l(c[0]), _s2l(c[1]), _s2l(c[2]))     # tuples are sRGB
    # 'skin' = soft mottle, a safer default surface than fabric weave for
    # arbitrary units (hide, armour, fur) when we don't have a per-geoset map.
    for key, col in TEX_COLORS:
        if key.lower() in (path or '').lower():
            return 'skin', lin(col)
    return 'skin', lin((0.33, 0.38, 0.50))                   # team-colour/panther: slate blue


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
    for _clip, sources in CLIP_SOURCES:
        if _clip == 'Idle':
            s = find_sequence(model, sources)
            if s:
                return s
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


def painted_material(name, region, rgb):
    """A procedural hand-painted material per region. The pattern (fabric weave,
    skin mottle, leather grain, hair strands, wood grain, metal streaks) is baked
    into the albedo so it survives glTF export and reads as real material detail
    under Warcrest's toon shader. Base Color is driven by a pattern→2-shade ramp."""
    import mathutils
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    nt = mat.node_tree; nodes = nt.nodes; links = nt.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 0.5 if region in ('metal', 'trim') else 0.92
    if 'Metallic' in bsdf.inputs:
        bsdf.inputs['Metallic'].default_value = 0.5 if region in ('metal', 'trim') else 0.0
    tc = nodes.new('ShaderNodeTexCoord')
    mp = nodes.new('ShaderNodeMapping')
    # Generated coords (0..1 over each part's bounding box) → pattern frequency is
    # in "cycles across the part", readable regardless of the part's world size.
    links.new(tc.outputs['Generated'], mp.inputs['Vector'])

    def noise(scale, detail=2.0):
        n = nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        links.new(mp.outputs['Vector'], n.inputs['Vector']); return n.outputs['Fac']
    def wave(scale, dist=0.0, bands=True):
        w = nodes.new('ShaderNodeTexWave')
        w.wave_type = 'BANDS' if bands else 'RINGS'
        w.inputs['Scale'].default_value = scale
        w.inputs['Distortion'].default_value = dist
        links.new(mp.outputs['Vector'], w.inputs['Vector']); return w.outputs['Fac']
    def voronoi(scale):
        v = nodes.new('ShaderNodeTexVoronoi'); v.feature = 'F1'; v.inputs['Scale'].default_value = scale
        links.new(mp.outputs['Vector'], v.inputs['Vector']); return v.outputs['Distance']
    def band(direction, scale):
        w = nodes.new('ShaderNodeTexWave'); w.wave_type = 'BANDS'
        try: w.bands_direction = direction
        except Exception: pass
        w.inputs['Scale'].default_value = scale
        links.new(mp.outputs['Vector'], w.inputs['Vector'])
        # THIN bright line at each band crossing (narrow peak → sparse lattice)
        r = nodes.new('ShaderNodeValToRGB'); e = r.color_ramp.elements
        e[0].position = 0.45; e[0].color = (0, 0, 0, 1)
        e[1].position = 0.5; e[1].color = (1, 1, 1, 1)
        e.new(0.55); e[2].color = (0, 0, 0, 1)
        links.new(w.outputs['Fac'], r.inputs['Fac'])
        return r.outputs['Color']
    def mix(a, b, fac):
        m = nodes.new('ShaderNodeMixRGB'); m.blend_type = 'MULTIPLY'; m.inputs['Fac'].default_value = fac
        links.new(a, m.inputs['Color1']);
        if hasattr(b, 'default_value') or True:
            try: links.new(b, m.inputs['Color2'])
            except Exception: m.inputs['Color2'].default_value = b
        return m.outputs['Color']

    # face: base colour comes from the per-vertex feature colours (skin/eyes/lips)
    # painted in build_meshes; add a faint skin mottle over it.
    if region == 'face':
        vc = nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'facecol'
        n = nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 5.0
        links.new(mp.outputs['Vector'], n.inputs['Vector'])
        mrg = nodes.new('ShaderNodeMixRGB'); mrg.blend_type = 'MULTIPLY'; mrg.inputs['Fac'].default_value = 0.12
        links.new(vc.outputs['Color'], mrg.inputs['Color1'])
        links.new(n.outputs['Fac'], mrg.inputs['Color2'])
        links.new(mrg.outputs['Color'], bsdf.inputs['Base Color'])
        return mat

    def genZ():
        sep = nodes.new('ShaderNodeSeparateXYZ')
        links.new(mp.outputs['Vector'], sep.inputs['Vector']); return sep.outputs['Z']
    def col4(c):
        return (min(1.0, c[0]), min(1.0, c[1]), min(1.0, c[2]), 1.0)

    # nightsaber hide: wavy dark tiger stripes over the base + a pale underbelly
    if region == 'tiger':
        st = wave(8.0, 3.2)                                  # wavy markings
        sr = nodes.new('ShaderNodeValToRGB'); se = sr.color_ramp.elements
        se[0].position = 0.40; se[0].color = (1, 1, 1, 1)    # stripe (mask=1)
        se[1].position = 0.56; se[1].color = (0, 0, 0, 1)    # base (mask=0)
        links.new(st, sr.inputs['Fac'])
        m1 = nodes.new('ShaderNodeMixRGB'); m1.blend_type = 'MIX'
        m1.inputs['Color1'].default_value = col4(rgb)
        m1.inputs['Color2'].default_value = col4((rgb[0] * 0.36, rgb[1] * 0.36, rgb[2] * 0.42))
        links.new(sr.outputs['Color'], m1.inputs['Fac'])
        br = nodes.new('ShaderNodeValToRGB'); be = br.color_ramp.elements
        be[0].position = 0.30; be[0].color = (1, 1, 1, 1)    # low (belly) → pale
        be[1].position = 0.5; be[1].color = (0, 0, 0, 1)
        links.new(genZ(), br.inputs['Fac'])
        m2 = nodes.new('ShaderNodeMixRGB'); m2.blend_type = 'MIX'
        links.new(m1.outputs['Color'], m2.inputs['Color1'])
        m2.inputs['Color2'].default_value = col4((rgb[0] * 1.9 + 0.10, rgb[1] * 1.9 + 0.10, rgb[2] * 1.9 + 0.12))
        links.new(br.outputs['Color'], m2.inputs['Fac'])
        links.new(m2.outputs['Color'], bsdf.inputs['Base Color'])
        return mat

    # hair: layered strands (coarse × fine) shaded root→mid→highlight
    if region == 'hair':
        s1 = wave(30.0, 0.5); s2 = wave(74.0, 0.15)
        hf = nodes.new('ShaderNodeMixRGB'); hf.blend_type = 'MULTIPLY'; hf.inputs['Fac'].default_value = 0.5
        links.new(s1, hf.inputs['Color1']); links.new(s2, hf.inputs['Color2'])
        hr = nodes.new('ShaderNodeValToRGB'); he = hr.color_ramp.elements
        root, tip = he[0], he[1]
        root.position = 0.12; root.color = col4((rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.55))
        mid = he.new(0.5); mid.color = col4(rgb)                                            # mid tone
        tip.position = 0.88; tip.color = col4((rgb[0] * 1.55, rgb[1] * 1.5, rgb[2] * 1.75)) # highlight
        links.new(hf.outputs['Color'], hr.inputs['Fac'])
        links.new(hr.outputs['Color'], bsdf.inputs['Base Color'])
        return mat

    # choose a 0..1 pattern per region (scales = cycles across the part)
    if region == 'skin':
        fac = noise(3.0, 2.0)          # soft large tonal mottle
    elif region == 'wood':
        fac = wave(12.0, 1.3)          # wavy grain along the shaft
    elif region == 'leather':
        fac = voronoi(9.0)             # pebbled grain
    elif region == 'metal':
        fac = wave(30.0, 0.1)          # brushed streaks
    elif region == 'trim':
        fac = noise(5.0, 2.0)
    elif region in ('cloth', 'tribal'):
        # woven fabric (weave × folds) → 2-tone ramp. 'tribal' adds a GOLD
        # geometric lattice overlay (crossed thin bands); 'cloth' is plain.
        weave = wave(26.0, 0.0)
        folds = noise(3.0, 2.0)
        wf = nodes.new('ShaderNodeMixRGB'); wf.blend_type = 'MULTIPLY'; wf.inputs['Fac'].default_value = 0.55
        links.new(weave, wf.inputs['Color1']); links.new(folds, wf.inputs['Color2'])
        cr = nodes.new('ShaderNodeValToRGB'); ce = cr.color_ramp.elements
        dk = tuple(min(1.0, c * 0.55) for c in rgb); lt = tuple(min(1.0, c * 1.2) for c in rgb)
        ce[0].position = 0.34; ce[0].color = (dk[0], dk[1], dk[2], 1)
        ce[1].position = 0.66; ce[1].color = (lt[0], lt[1], lt[2], 1)
        links.new(wf.outputs['Color'], cr.inputs['Fac'])
        if region == 'cloth':
            links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])
            return mat
        gx = band('X', 6.0); gy = band('Y', 6.0)
        grid = nodes.new('ShaderNodeMixRGB'); grid.blend_type = 'LIGHTEN'; grid.inputs['Fac'].default_value = 1.0
        links.new(gx, grid.inputs['Color1']); links.new(gy, grid.inputs['Color2'])
        gcol = _hex(RW['gold'])
        gld = nodes.new('ShaderNodeMixRGB'); gld.blend_type = 'MIX'
        links.new(grid.outputs['Color'], gld.inputs['Fac'])
        links.new(cr.outputs['Color'], gld.inputs['Color1'])
        gld.inputs['Color2'].default_value = (gcol[0], gcol[1], gcol[2], 1)
        links.new(gld.outputs['Color'], bsdf.inputs['Base Color'])
        return mat

    ramp = nodes.new('ShaderNodeValToRGB')
    dark = tuple(min(1.0, c * 0.58) for c in rgb)
    light = tuple(min(1.0, c * 1.2) for c in rgb)
    contrast = 0.5 if region in ('leather', 'wood', 'hair') else 0.36
    ramp.color_ramp.elements[0].position = 0.5 - contrast / 2
    ramp.color_ramp.elements[0].color = (dark[0], dark[1], dark[2], 1)
    ramp.color_ramp.elements[1].position = 0.5 + contrast / 2
    ramp.color_ramp.elements[1].color = (light[0], light[1], light[2], 1)
    links.new(fac, ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def paint_bake(painted):
    """Bake each geoset's procedural material to an albedo texture on its UVs and
    rewire Base Color to the baked image so glTF exports a real baseColorTexture."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    try: scene.cycles.device = 'CPU'; scene.cycles.samples = 4
    except Exception: pass
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.margin = 8
    for obj, region, rgb in painted:
        mat = obj.data.materials[0]; nt = mat.node_tree
        img = bpy.data.images.new(f'{obj.name}_alb', 512, 512, alpha=False)
        img.generated_color = (rgb[0], rgb[1], rgb[2], 1.0)
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
        nt.nodes.active = tex
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True); bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True, margin=8)
        bsdf = nt.nodes.get('Principled BSDF')
        for l in list(bsdf.inputs['Base Color'].links):
            nt.links.remove(l)
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bpy.ops.object.select_all(action='DESELECT')
    print('  painted + baked %d geoset textures' % len(painted))


def build_meshes(model, arm_obj, bone_names):
    objs = []
    painted = []
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
        # region + colour → procedural painted material (baked later)
        texid = model.materials[g.material_id]['texture_id'] if g.material_id < len(model.materials) else 0
        path = model.textures[texid]['path'] if texid < len(model.textures) else ''
        region, col = geo_region(model, gi, path)
        if os.environ.get('FORGE_DEBUG_GEO'):     # distinct colour per geoset for ID
            import colorsys
            region, col = 'skin', colorsys.hsv_to_rgb((gi * 0.147) % 1.0, 0.85, 1.0)
        # face: paint per-vertex feature colours (eyes / lips / skin) BEFORE the
        # material references the 'facecol' layer; baked into the albedo.
        if region == 'face':
            byid = model.node_by_id
            cattr = mesh.color_attributes.new(name='facecol', type='FLOAT_COLOR', domain='POINT')
            # geometry frame for placing war-paint: MDX Z=up, Y=front. Find the
            # eye height and the front so we can lay a cheek stripe under the eyes.
            def kind(vidx):
                grp = g.vgroups[vidx] if vidx < len(g.vgroups) else 0
                nids = g.matrix_groups[grp] if grp < len(g.matrix_groups) else []
                return [byid[n].name for n in nids if n in byid]
            eye_zs = [g.verts[i][2] for i in range(len(g.verts)) if any('Eye' in n for n in kind(i))]
            has_eyes = bool(eye_zs)
            eye_z = sum(eye_zs) / len(eye_zs) if has_eyes else 0
            ys = [v[1] for v in g.verts]; y_front = min(ys) + 0.68 * (max(ys) - min(ys))
            xs = [v[0] for v in g.verts]; cx = (min(xs) + max(xs)) / 2; xw = (max(xs) - min(xs)) or 1
            zs = [v[2] for v in g.verts]; zh = (max(zs) - min(zs)) or 1
            # no eye NODES (e.g. Huntress): place features by position within the
            # head sub-mesh ('Head'-skinned verts) so the face still gets eyes+brow.
            hidx = [i for i in range(len(g.verts)) if any('Head' in n for n in kind(i))]
            if not hidx:
                hidx = list(range(len(g.verts)))
            hv = [g.verts[i] for i in hidx]
            hy0, hy1 = min(p[1] for p in hv), max(p[1] for p in hv)
            hz0, hz1 = min(p[2] for p in hv), max(p[2] for p in hv)
            hxs = [p[0] for p in hv]; hcx = (min(hxs) + max(hxs)) / 2; hxw = (max(hxs) - min(hxs)) or 1
            hset = set(hidx)
            def rel(v):
                ry = (v[1] - hy0) / ((hy1 - hy0) or 1)
                rz = (v[2] - hz0) / ((hz1 - hz0) or 1)
                rx = (v[0] - hcx) / (hxw / 2 or 1)
                return ry, rz, rx
            for vidx in range(len(g.verts)):
                names = kind(vidx)
                vx, vy, vz = g.verts[vidx]
                c = _hex(FACE_SKIN)
                if any('Eye' in n for n in names):
                    c = _hex(FACE_EYE)
                elif any('Lip' in n for n in names):
                    c = _hex(FACE_LIP)
                elif has_eyes and (vy > y_front and abs(vz - eye_z) < 0.10 * zh
                                   and 0.12 * xw < abs(vx - cx) < 0.5 * xw):
                    c = _hex(FACE_PAINT)     # archer: under-eye cheek war-paint
                elif not has_eyes and vidx in hset:
                    ry, rz, rx = rel(g.verts[vidx])
                    if ry > 0.55 and 0.50 < rz < 0.70 and 0.10 < abs(rx) < 0.62:
                        c = _hex(FACE_EYE)   # glowing eyes (placed by position)
                    elif ry > 0.5 and 0.70 <= rz < 0.86:
                        c = _hex(FACE_BROW)  # dark brow band
                cattr.data[vidx].color = (c[0], c[1], c[2], 1.0)
        mat = painted_material(f'mat{gi}', region, col)
        mesh.materials.append(mat)
        # UVs (drive the baked texture; without them the geoset stays flat-shaded)
        has_uv = bool(g.uvs and len(g.uvs) == len(g.verts))
        if has_uv:
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
        if has_uv:
            painted.append((obj, region, col))
    if skipped:
        print('  skipped hidden geosets (alpha≈0 in idle):', skipped)
    return objs, painted


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

    made = []
    for clip, sources in CLIP_SOURCES:
        seq = find_sequence(model, sources)
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


# ---- added accessory geometry (dreads / beads / feathers / fringe) -----------
# Original low-poly pieces generated procedurally and rigidly bound to the MDX
# skeleton so they animate with the body — the reference's beadwork/dreads/
# feathers are geometry, not texture, so we add them rather than paint them.
BEAD_PALETTE = [0xb5402f, 0xd9a63a, 0x2f6bb5, 0xe6ddc8, 0x3a7a45, 0x8a3b8f]
ACC = {'dread': 0x3a2416, 'cuff': 0xd9b24a, 'cowrie': 0xe6ddc8,
       'feather': 0xe6ddc8, 'leaf': 0x6f8a37, 'quill': 0x8a5a2a}


def _accobj(name, bm, clay, bone_name, arm_obj):
    me = bpy.data.meshes.new(name)
    bm.normal_update(); bm.to_mesh(me); bm.free()
    me.attributes.active_color = me.color_attributes.get('acccol')
    try: me.color_attributes.render_color_index = list(me.color_attributes).index(me.color_attributes['acccol'])
    except Exception: pass
    mat = bpy.data.materials.new(name + '_m'); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 0.85
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'acccol'
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    me.materials.append(mat)
    obj = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(obj)
    vg = obj.vertex_groups.new(name=bone_name)
    vg.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    m = obj.modifiers.new('Armature', 'ARMATURE'); m.object = arm_obj
    obj.parent = arm_obj
    return obj


def _newbm():
    bm = bmesh.new(); clay = bm.verts.layers.float_color.new('acccol'); return bm, clay


def _sphere(bm, clay, r, pos, color, scale=(1, 1, 1)):
    res = bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=5, radius=r)
    M = Matrix.Translation(Vector(pos)) @ Matrix.Diagonal(Vector((scale[0], scale[1], scale[2], 1.0)))
    bmesh.ops.transform(bm, matrix=M, verts=res['verts'])
    c = _hex(color)
    for v in res['verts']:
        v[clay] = (c[0], c[1], c[2], 1.0)


def _cone(bm, clay, r1, r2, depth, matrix, color, seg=6):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth)
    bmesh.ops.transform(bm, matrix=matrix, verts=res['verts'])
    c = _hex(color)
    for v in res['verts']:
        v[clay] = (c[0], c[1], c[2], 1.0)


def _aim(frm, to):
    """4x4 that places a +Z cone of the given depth from `frm` toward `to`
    (returns matrix positioning a unit cone centred at the midpoint)."""
    frm = Vector(frm); to = Vector(to); d = to - frm
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return Matrix.Translation((frm + to) * 0.5) @ q.to_matrix().to_4x4()


def add_accessories(model, arm_obj, bone_names):
    if model.name != 'Archer':
        return
    byname = {n.name: n for n in model.nodes}
    def piv(nm): return Vector(byname[nm].pivot)
    head, chest = piv('Bone_Head'), piv('Bone_Chest')
    # face front: compare eye vertices' X to the head pivot X
    g3 = model.geosets[3]; byid = model.node_by_id
    ex = []
    for i in range(len(g3.verts)):
        grp = g3.vgroups[i] if i < len(g3.vgroups) else 0
        nids = g3.matrix_groups[grp] if grp < len(g3.matrix_groups) else []
        if any('Eye' in byid[n].name for n in nids if n in byid): ex.append(g3.verts[i][0])
    front = 1.0 if (ex and (sum(ex) / len(ex)) > head.x) else -1.0

    # ── dreadlocks (→ head) ──
    bm, clay = _newbm()
    NL = 12
    for i in range(NL):
        a = i / NL * 2 * math.pi
        rx, ry = 6.5, 7.5
        # bias locks toward the back/sides (away from the face-front) so they read
        back = -front * math.cos(a)                       # +1 at the back
        top = Vector((head.x + math.cos(a) * rx, head.y + math.sin(a) * ry, head.z + 7))
        out = Vector((math.cos(a) * 7, math.sin(a) * 7, 0))
        drop = -40 - 8 * max(0, back)                     # longer at the back
        end = top + Vector((0, 0, drop)) + out
        _cone(bm, clay, 2.0, 1.0, (end - top).length, _aim(top, end), ACC['dread'], seg=5)
        qm = Vector((0, 0, 1)).rotation_difference((end - top).normalized()).to_matrix().to_4x4()
        if i % 2 == 0:  # gold cuff on alternate locks
            _cone(bm, clay, 2.5, 2.5, 2.6, Matrix.Translation(top.lerp(end, 0.22)) @ qm, ACC['cuff'], seg=6)
        # a cowrie/bead near the tip of some locks
        if i % 3 == 0:
            _sphere(bm, clay, 1.6, top.lerp(end, 0.92), BEAD_PALETTE[i % len(BEAD_PALETTE)])
    _accobj('acc_dreads', bm, clay, bone_names[byname['Bone_Head'].object_id], arm_obj)

    # ── beaded necklaces + cowrie (→ chest) ──
    bm, clay = _newbm()
    for strand, (nb, zc, rad) in enumerate([(20, 74, 10.5), (22, 72, 12.5), (18, 70.5, 8.5)]):
        for i in range(nb):
            t = (i / (nb - 1)) * 2 - 1
            pos = Vector((chest.x + front * (7 + strand), t * rad, zc - (1 - t * t) * 8))
            _sphere(bm, clay, 1.35, pos, BEAD_PALETTE[(i + strand) % len(BEAD_PALETTE)])
    for i in range(6):  # cowrie shells dangling at the front-centre
        _sphere(bm, clay, 1.5, (chest.x + front * 9, (i - 2.5) * 2.2, 60 - abs(i - 2.5) * 0.6),
                ACC['cowrie'], scale=(0.6, 0.9, 1.5))
    _accobj('acc_necklace', bm, clay, bone_names[byname['Bone_Chest'].object_id], arm_obj)

    # ── shoulder feather fringe (→ chest) ──
    bm, clay = _newbm()
    for s in (1, -1):
        sh = Vector((chest.x + front * 2, s * 10.5, 80))
        for j in range(5):
            spread = (j - 2) * 0.32
            end = sh + Vector((front * 2, s * 4 + spread * 6, -12 - abs(spread) * 3))
            col = [ACC['feather'], ACC['leaf'], ACC['quill']][j % 3]
            _cone(bm, clay, 2.6, 0.25, (end - sh).length, _aim(sh, end), col, seg=4)
    _accobj('acc_fringe', bm, clay, bone_names[byname['Bone_Chest'].object_id], arm_obj)

    # ── forearm + ankle bead bands (→ limb bones) ──
    for side, arm_b, foot_b in (('L', 'Bone_Arm2_L', 'Bone_Foot_L'), ('R', 'Bone_Arm2_R', 'Bone_Foot_R')):
        bm, clay = _newbm()
        ap = piv(arm_b)
        for band, dz in ((0, 0), (1, -7)):
            for i in range(10):
                a = i / 10 * 2 * math.pi
                _sphere(bm, clay, 1.15, (ap.x + math.cos(a) * 3.4, ap.y + math.sin(a) * 3.4, ap.z + dz),
                        BEAD_PALETTE[(i + band) % len(BEAD_PALETTE)])
        _accobj('acc_arm_' + side, bm, clay, bone_names[byname[arm_b].object_id], arm_obj)
        bm, clay = _newbm()
        fp = piv(foot_b)
        for band, dz in ((0, 8), (1, 13)):
            for i in range(10):
                a = i / 10 * 2 * math.pi
                _sphere(bm, clay, 1.2, (fp.x + math.cos(a) * 3.6, fp.y + math.sin(a) * 3.6, fp.z + dz),
                        BEAD_PALETTE[(i + band) % len(BEAD_PALETTE)])
        _accobj('acc_ankle_' + side, bm, clay, bone_names[byname[foot_b].object_id], arm_obj)
    print('  added accessories: dreads, necklace, fringe, arm+ankle beads')


def add_cat_features(model, arm_obj, bone_names):
    """Moon Hunter's nightsaber: glowing eyes + fangs on the cat's head, bound to
    'Bone Wolf Head' so they animate. Cat faces +X (muzzle ref sits at higher X)."""
    byname = {n.name: n for n in model.nodes}
    hb = byname.get('Bone Wolf Head')
    if hb is None:
        return
    hp = Vector(hb.pivot); bone = bone_names[hb.object_id]
    bm, clay = _newbm()
    # big glowing amber eyes on the upper snout (raised a touch so they read from
    # the game's elevated camera), splayed to each side and forward
    for s in (1, -1):
        _sphere(bm, clay, 3.3, (hp.x + 13, hp.y + s * 6.2, hp.z + 5.0), 0xffcf3a, scale=(1.0, 1.2, 1.05))
    # fangs — white cones pointing down from the upper jaw at the muzzle front
    for s in (1, -1):
        for fx in (0.0, 4.5):
            top = Vector((hp.x + 19 + fx, hp.y + s * 3.0, hp.z - 1.5))
            tip = top + Vector((0, 0, -6.5))
            _cone(bm, clay, 1.15, 0.08, (top - tip).length, _aim(top, tip), 0xece6d4, seg=4)
    _accobj('acc_cat_face', bm, clay, bone, arm_obj)
    print('  added cat features: eyes + fangs (→ Bone Wolf Head)')


def main():
    inp, outp = sys.argv[1], sys.argv[2]
    model = mdx_parse.parse(inp)
    order = topo_order(model)
    print('parsed: %d nodes, %d geosets, %d sequences' %
          (len(model.nodes), len(model.geosets), len(model.sequences)))
    clear_scene()
    arm_obj, bone_names = build_armature(model, order)
    _objs, painted = build_meshes(model, arm_obj, bone_names)
    if not os.environ.get('FORGE_NO_PAINT'):
        paint_bake(painted)          # bake hand-painted albedo before pose mode
    if not os.environ.get('FORGE_NO_ACC'):
        add_accessories(model, arm_obj, bone_names)   # dreads/beads/feathers, rigged
        add_cat_features(model, arm_obj, bone_names)   # nightsaber eyes + fangs
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
