#!/usr/bin/env python3
"""Warcraft III MDX (version 800) parser — pure Python, no Blender dependency.

Extracts the pieces the forge needs to rebuild a model as a rigged, animated
glTF: geosets (mesh + skin), the node graph (bones/helpers → skeleton), pivot
points (bone rest positions), sequences (animation intervals), and the per-node
KGTR/KGRT/KGSC keyframe tracks.

Format reference: the MDX chunked binary as implemented by mdx-m3-viewer /
warsmash. Coordinates are WC3-native (Z-up); axis conversion is left to the
glTF exporter downstream.
"""
import struct
from dataclasses import dataclass, field
from typing import Optional

NONE_ID = 0xFFFFFFFF


class Reader:
    def __init__(self, data, off=0, end=None):
        self.d = data; self.o = off; self.end = len(data) if end is None else end

    def tell(self): return self.o
    def eof(self): return self.o >= self.end
    def u32(self): v = struct.unpack_from('<I', self.d, self.o)[0]; self.o += 4; return v
    def i32(self): v = struct.unpack_from('<i', self.d, self.o)[0]; self.o += 4; return v
    def f32(self): v = struct.unpack_from('<f', self.d, self.o)[0]; self.o += 4; return v
    def u16(self): v = struct.unpack_from('<H', self.d, self.o)[0]; self.o += 2; return v
    def u8(self):  v = self.d[self.o]; self.o += 1; return v
    def tag(self): t = self.d[self.o:self.o + 4]; self.o += 4; return t.decode('latin1')
    def vec(self, n): v = struct.unpack_from('<%df' % n, self.d, self.o); self.o += 4 * n; return list(v)
    def name(self, n=80):
        raw = self.d[self.o:self.o + n]; self.o += n
        return raw.split(b'\x00', 1)[0].decode('latin1', 'replace')
    def skip(self, n): self.o += n


@dataclass
class Track:
    tag: str
    interp: int
    global_seq: int
    # keys: list of (time:int, value:list[float], in_tan, out_tan)
    keys: list = field(default_factory=list)


@dataclass
class Node:
    name: str
    object_id: int
    parent_id: int
    flags: int
    kind: str                 # 'bone' | 'helper' | 'attachment' | ...
    pivot: tuple = (0.0, 0.0, 0.0)
    geoset_id: int = NONE_ID
    tracks: dict = field(default_factory=dict)   # 'KGTR'|'KGRT'|'KGSC' -> Track


@dataclass
class Geoset:
    verts: list = field(default_factory=list)       # [[x,y,z], ...]
    norms: list = field(default_factory=list)
    uvs: list = field(default_factory=list)          # [[u,v], ...]
    faces: list = field(default_factory=list)        # [[i,j,k], ...]
    vgroups: list = field(default_factory=list)      # per-vertex matrix-group index (GNDX)
    matrix_groups: list = field(default_factory=list)  # list[list[node_object_id]] resolved
    material_id: int = 0


@dataclass
class Sequence:
    name: str
    start: int
    end: int
    non_looping: bool = False


@dataclass
class Model:
    version: int = 0
    name: str = ''
    geosets: list = field(default_factory=list)
    nodes: list = field(default_factory=list)         # in file order
    node_by_id: dict = field(default_factory=dict)    # object_id -> Node
    sequences: list = field(default_factory=list)
    textures: list = field(default_factory=list)
    materials: list = field(default_factory=list)     # list of {'texture_id': int}
    geoset_anims: dict = field(default_factory=dict)  # geoset_id -> {'alpha': float, 'track': Track|None}


# ---- track parsing --------------------------------------------------------
def _read_track(r: Reader, tag: str):
    n = r.u32(); interp = r.u32(); gseq = r.u32()
    comps = 4 if tag == 'KGRT' else 3
    t = Track(tag=tag, interp=interp, global_seq=gseq)
    for _ in range(n):
        time = r.i32(); val = r.vec(comps)
        it = ot = None
        if interp >= 2:
            it = r.vec(comps); ot = r.vec(comps)
        t.keys.append((time, val, it, ot))
    return t


def _read_node(r: Reader, kind: str) -> Node:
    """Read one MDLGENOBJECT starting at r; returns Node and leaves r at node end."""
    start = r.tell()
    incl = r.u32()
    name = r.name(80)
    oid = r.u32(); pid = r.u32(); flags = r.u32()
    node = Node(name=name, object_id=oid, parent_id=pid, flags=flags, kind=kind)
    end = start + incl
    while r.tell() < end:
        tg = r.tag()
        if tg in ('KGTR', 'KGRT', 'KGSC'):
            node.tracks[tg] = _read_track(r, tg)
        else:
            # unknown sub-chunk inside a node: bail to node end (shouldn't happen for bones)
            r.o = end
            break
    r.o = end
    return node


# ---- chunk parsers --------------------------------------------------------
def _parse_seqs(r: Reader, end, model):
    while r.tell() < end:
        nm = r.name(80)
        s, e = r.u32(), r.u32()
        r.f32()                      # moveSpeed
        flags = r.u32()
        r.f32(); r.u32()             # rarity, syncPoint
        r.skip(28)                   # extent (radius + min3 + max3)
        model.sequences.append(Sequence(nm, s, e, bool(flags & 1)))


def _parse_texs(r: Reader, end, model):
    while r.tell() < end:
        rid = r.u32(); path = r.name(260); r.u32()   # replaceableId, path, flags
        model.textures.append({'replaceable_id': rid, 'path': path})


def _parse_mtls(r: Reader, end, model):
    while r.tell() < end:
        mstart = r.tell(); msize = r.u32()
        mend = mstart + msize
        r.u32(); r.u32()             # priorityPlane, flags
        tex_id = 0
        # LAYS
        if r.tell() < mend:
            tag = r.tag()
            if tag == 'LAYS':
                nlays = r.u32()
                for li in range(nlays):
                    lstart = r.tell(); lsize = r.u32()
                    lend = lstart + lsize
                    r.u32()          # filterMode
                    r.u32()          # shadingFlags
                    tid = r.u32()    # textureId
                    if li == 0: tex_id = tid
                    r.o = lend
        model.materials.append({'texture_id': tex_id})
        r.o = mend


def _parse_geos(r: Reader, end, model):
    while r.tell() < end:
        gstart = r.tell(); gsize = r.u32(); gend = gstart + gsize
        g = Geoset()
        assert r.tag() == 'VRTX'
        nv = r.u32()
        for _ in range(nv): g.verts.append(r.vec(3))
        assert r.tag() == 'NRMS'
        nn = r.u32()
        for _ in range(nn): g.norms.append(r.vec(3))
        assert r.tag() == 'PTYP'
        npt = r.u32(); ptyps = [r.u32() for _ in range(npt)]
        assert r.tag() == 'PCNT'
        npc = r.u32(); pcnts = [r.u32() for _ in range(npc)]
        assert r.tag() == 'PVTX'
        npv = r.u32(); idx = [r.u16() for _ in range(npv)]
        # build faces (all groups are triangle lists in practice; ptyp 4 = triangles)
        pos = 0
        for c in pcnts:
            tri = idx[pos:pos + c]; pos += c
            for t in range(0, len(tri) - 2, 3):
                g.faces.append([tri[t], tri[t + 1], tri[t + 2]])
        assert r.tag() == 'GNDX'
        ng = r.u32(); g.vgroups = [r.u8() for _ in range(ng)]
        assert r.tag() == 'MTGC'
        nmg = r.u32(); mtgc = [r.u32() for _ in range(nmg)]
        assert r.tag() == 'MATS'
        nms = r.u32(); mats = [r.u32() for _ in range(nms)]
        # resolve matrix groups: MTGC gives sizes, MATS is the flat list of node object ids
        p = 0
        for sz in mtgc:
            g.matrix_groups.append(mats[p:p + sz]); p += sz
        g.material_id = r.u32()
        r.u32()                       # selectionGroup
        r.u32()                       # selectionFlags
        # version 800 has lod / lodName here for some exporters; then bounds + extents
        # Rather than track every optional field, scan for UVAS from here.
        # bounds: radius + min3 + max3
        # We seek the 'UVAS' tag which precedes UV data.
        uvas_off = model_find(r.d, b'UVAS', r.tell(), gend)
        if uvas_off >= 0:
            r.o = uvas_off + 4
            nuv = r.u32()             # number of UV layers
            if r.tell() < gend and r.d[r.o:r.o + 4] == b'UVBS':
                r.tag(); nu = r.u32()
                for _ in range(nu): g.uvs.append(r.vec(2))
        r.o = gend
        model.geosets.append(g)


def model_find(data, needle, start, end):
    i = data.find(needle, start, end)
    return i


def _parse_nodes(r: Reader, end, model, kind):
    while r.tell() < end:
        node = _read_node(r, kind)
        if kind == 'bone':
            node.geoset_id = r.u32(); r.u32()   # geosetId, geosetAnimId
        model.nodes.append(node)
        model.node_by_id[node.object_id] = node


def _parse_atch(r: Reader, end, model):
    while r.tell() < end:
        astart = r.tell(); asize = r.u32(); aend = astart + asize
        node = _read_node(r, 'attachment')
        model.nodes.append(node); model.node_by_id[node.object_id] = node
        r.o = aend


def _parse_geoa(r: Reader, end, model):
    while r.tell() < end:
        astart = r.tell(); incl = r.u32(); aend = astart + incl
        alpha = r.f32(); r.u32()          # static alpha, flags
        r.vec(3)                          # static color
        gid = r.u32()
        track = None
        while r.tell() < aend:
            tg = r.tag()
            if tg == 'KGAO':
                track = _read_track_scalar(r)
            elif tg == 'KGAC':
                _read_track(r, 'KGAC')     # color track (ignored)
            else:
                break
        r.o = aend
        model.geoset_anims[gid] = {'alpha': alpha, 'track': track}


def _read_track_scalar(r: Reader):
    """KGAO alpha track: keys are (time, float)."""
    n = r.u32(); interp = r.u32(); gseq = r.u32()
    t = Track(tag='KGAO', interp=interp, global_seq=gseq)
    for _ in range(n):
        time = r.i32(); val = [r.f32()]
        it = ot = None
        if interp >= 2:
            it = [r.f32()]; ot = [r.f32()]
        t.keys.append((time, val, it, ot))
    return t


def _parse_pivt(r: Reader, end, model):
    pivots = []
    while r.tell() < end:
        pivots.append(tuple(r.vec(3)))
    model._pivots = pivots


def parse(path) -> Model:
    with open(path, 'rb') as f: data = f.read()
    assert data[:4] == b'MDLX', 'not an MDX'
    model = Model()
    r = Reader(data, 4)
    # first pass: collect top-level chunks
    chunks = []
    while not r.eof():
        tag = r.tag(); size = r.u32(); off = r.tell()
        chunks.append((tag, off, size)); r.skip(size)
    order = {'VERS': 0, 'MODL': 1, 'TEXS': 2, 'MTLS': 3, 'SEQS': 4, 'BONE': 5, 'HELP': 6, 'ATCH': 7, 'PIVT': 8, 'GEOS': 9}
    for tag, off, size in sorted(chunks, key=lambda c: order.get(c[0], 99)):
        rr = Reader(data, off, off + size)
        if tag == 'VERS': model.version = rr.u32()
        elif tag == 'MODL': model.name = rr.name(80)
        elif tag == 'SEQS': _parse_seqs(rr, off + size, model)
        elif tag == 'TEXS': _parse_texs(rr, off + size, model)
        elif tag == 'MTLS': _parse_mtls(rr, off + size, model)
        elif tag == 'BONE': _parse_nodes(rr, off + size, model, 'bone')
        elif tag == 'HELP': _parse_nodes(rr, off + size, model, 'helper')
        elif tag == 'ATCH': _parse_atch(rr, off + size, model)
        elif tag == 'GEOA': _parse_geoa(rr, off + size, model)
        elif tag == 'PIVT': _parse_pivt(rr, off + size, model)
        elif tag == 'GEOS': _parse_geos(rr, off + size, model)
    # attach pivots by objectId
    piv = getattr(model, '_pivots', [])
    for n in model.nodes:
        if 0 <= n.object_id < len(piv): n.pivot = piv[n.object_id]
    return model


if __name__ == '__main__':
    import sys
    m = parse(sys.argv[1])
    print('version', m.version, 'name', repr(m.name))
    print('textures:', [t['path'] for t in m.textures])
    print('materials:', m.materials)
    print('sequences:', [(s.name, s.start, s.end, 'NL' if s.non_looping else '') for s in m.sequences])
    print('nodes:', len(m.nodes), '| bones:', sum(1 for n in m.nodes if n.kind == 'bone'),
          'helpers:', sum(1 for n in m.nodes if n.kind == 'helper'),
          'attach:', sum(1 for n in m.nodes if n.kind == 'attachment'))
    print('geosets:', len(m.geosets))
    for i, g in enumerate(m.geosets):
        print('  geoset %d: verts=%d faces=%d uvs=%d matgroups=%d mat=%d'
              % (i, len(g.verts), len(g.faces), len(g.uvs), len(g.matrix_groups), g.material_id))
    # sample a couple of node tracks
    for n in m.nodes[:3]:
        print('  node', repr(n.name), 'id', n.object_id, 'parent', n.parent_id,
              'pivot', tuple(round(x, 1) for x in n.pivot),
              'tracks', {k: len(v.keys) for k, v in n.tracks.items()})
