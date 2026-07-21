#!/usr/bin/env python3
"""Refine preferred topo Bizzo toward Joey's official T-pose — starting FROM the blend.

Loads assets/models/blender/bizzo_cat_topo.blend (user-preferred connected mesh)
and applies targeted Multires-density sculpt deformations + surface-card refresh.

Does NOT rebuild from primitives. Does NOT voxel-remesh (keeps silhouette).

  ./tools/blender-monitor/bin/run-job.sh --name bizzo-topo-refine \\
    tools/blender-character/follow_joey_cat_topo_refine.py
"""
from __future__ import annotations

import math
import shutil
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

REPO = Path("/workspace")
OUT_DIR = REPO / "assets/models/blender"
REF_DIR = OUT_DIR / "joey_cat_refs"
DEMO = OUT_DIR / "bizzo_demo"
ART = Path("/opt/cursor/artifacts/blender_joey_bizzo")
BASE_BLEND = OUT_DIR / "bizzo_cat_topo.blend"
BASE_BACKUP = OUT_DIR / "bizzo_cat_topo_base.blend"
OUT_BLEND = OUT_DIR / "bizzo_cat_topo.blend"
OUT_GLB = OUT_DIR / "bizzo_cat_topo.glb"
OUT_FRONT = ART / "topo_front.png"
OUT_SIDE = ART / "topo_side.png"
OUT_BACK = ART / "topo_back.png"
OUT_CMP = ART / "topo_compare_ref.png"

sys.path.insert(0, str(REPO / "tools/blender-monitor/lib"))
from monitor_preview import Monitor  # noqa: E402

MON: Monitor | None = None

# Joey palette (brighter than previous tan)
PAL = {
    "fur": (0.94, 0.56, 0.18),
    "coat": (0.72, 0.52, 0.90),
    "pink": (0.96, 0.50, 0.76),
    "muzzle": (0.98, 0.98, 0.98),
    "eye_white": (1.0, 1.0, 1.0),
    "pupil": (0.02, 0.02, 0.02),
    "brow": (0.22, 0.10, 0.04),
    "sole": (0.97, 0.97, 0.97),
    "mouth": (0.05, 0.05, 0.05),
}


def log(msg: str):
    print(f"[topo-refine] {msg}", flush=True)
    if MON is not None:
        MON.log(msg)


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def apply_tr(obj):
    active(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def mat_lookup(body):
    """Map material name → slot index on Bizzo."""
    out = {}
    for i, m in enumerate(body.data.materials):
        if m:
            out[m.name] = i
    return out


def retint_materials(body):
    for m in body.data.materials:
        if not m or m.name not in PAL:
            continue
        rgb = PAL[m.name]
        m.diffuse_color = (*rgb, 1.0)
        if m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == "BSDF_PRINCIPLED":
                    n.inputs["Base Color"].default_value = (*rgb, 1.0)
                    n.inputs["Roughness"].default_value = 0.88
                    break
    log("retinted materials toward Joey palette")


def setup_render():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = 1080
    sc.render.resolution_y = 1350
    if sc.world and sc.world.use_nodes:
        bg = sc.world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
    # Hide ref planes from beauty renders
    for name in ("FrontRef", "SideRef", "BackRef"):
        o = bpy.data.objects.get(name)
        if o:
            o.hide_render = True
            o.hide_viewport = True


def ensure_density(body):
    """Ensure Multires/Subsurf density for sculpt-like deform (apply to mesh)."""
    active(body)
    # Strip leftover Multires (export already applied subsurf in prior ship)
    for mod in list(body.modifiers):
        if mod.type in {"MULTIRES", "WIREFRAME"}:
            body.modifiers.remove(mod)
    # Add one Subsurf level if mesh is still coarse
    if len(body.data.vertices) < 20000:
        sub = body.modifiers.new("SubRefine", "SUBSURF")
        sub.levels = 1
        sub.render_levels = 1
        bpy.ops.object.modifier_apply(modifier=sub.name)
        log(f"applied Subsurf → verts={len(body.data.vertices)}")
    else:
        log(f"mesh already dense verts={len(body.data.vertices)}")


def smooth_laplacian(body, repeat=4, lambda_factor=0.35, border=0.0):
    active(body)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    for _ in range(repeat):
        bpy.ops.mesh.vertices_smooth(factor=lambda_factor, repeat=1)
    bpy.ops.object.mode_set(mode="OBJECT")
    log(f"laplacian smooth x{repeat}")


def sculpt_toward_joey(body):
    """Spatial deform on the preferred cage — diamond head, flare coat, round boots."""
    mi = mat_lookup(body)
    me = body.data
    coords = [v.co.copy() for v in me.vertices]
    zs = [c.z for c in coords]
    zmin, zmax = min(zs), max(zs)
    h = max(zmax - zmin, 1e-6)

    def nz(z):
        return (z - zmin) / h

    # Poly → material via first loop
    vert_mat = [-1] * len(me.vertices)
    for p in me.polygons:
        for vi in p.vertices:
            if vert_mat[vi] < 0:
                vert_mat[vi] = p.material_index

    fur_i = mi.get("fur", -1)
    coat_i = mi.get("coat", -1)
    muzzle_i = mi.get("muzzle", -1)
    eye_i = mi.get("eye_white", -1)
    pink_i = mi.get("pink", -1)
    sole_i = mi.get("sole", -1)
    brow_i = mi.get("brow", -1)
    mouth_i = mi.get("mouth", -1)
    pupil_i = mi.get("pupil", -1)

    for v in me.vertices:
        p = v.co
        t = nz(p.z)
        m = vert_mat[v.index]
        x, y, z = p.x, p.y, p.z
        ax = abs(x)

        # --- HEAD: widen into diamond / cheek silhouette (fur mid-head) ---
        if m == fur_i and 0.72 < t < 0.98:
            # Cheek band widest
            cheek = 1.0 - abs((t - 0.82) / 0.12)
            cheek = max(0.0, cheek)
            widen = 1.0 + 0.22 * cheek
            # Slightly flatten front of head box
            y *= 0.96
            x *= widen
            # Lift / size ears (top outer corners)
            if t > 0.90 and ax > 0.08 * h:
                z += 0.035 * h
                x *= 1.12
                y *= 0.92
            # Hair tuft zone — lean viewer's left (−X), pull up, taper tips
            if t > 0.93 and ax < 0.14 * h and y < 0.05 * h:
                z += 0.04 * h
                x -= 0.025 * h  # sweep −X
                # Point tips upward
                tip = (t - 0.93) / 0.07
                z += 0.02 * h * tip
                x *= 0.92

        # Cheek spikes already exist as fur cones — stretch them longer/sharper
        if m == fur_i and 0.74 < t < 0.88 and ax > 0.22 * h:
            x *= 1.18
            # Flatten Y so spikes read as side silhouette
            y *= 0.85

        # --- MUZZLE: wider bean, less ball protrusion ---
        if m == muzzle_i:
            x *= 1.12
            y = y * 0.82 + 0.04 * h  # pull slightly into face
            if t < 0.70:
                z += 0.01 * h

        # --- EYES: larger vertical ovals ---
        if m == eye_i:
            # Scale about eye center approx
            cx = 0.065 * h * (1 if x >= 0 else -1)
            cy, cz = 0.16 * h, 0.84 * h
            x = cx + (x - cx) * 1.18
            y = cy + (y - cy) * 0.95
            z = cz + (z - cz) * 1.22

        if m == pupil_i:
            cx = 0.065 * h * (1 if x >= 0 else -1)
            cy, cz = 0.18 * h, 0.82 * h
            x = cx + (x - cx) * 1.05
            y = cy + (y - cy) * 1.0
            z = cz + (z - cz) * 1.05

        # --- COLLAR: taller + wider funnel framing chin ---
        if m == coat_i and 0.62 < t < 0.78 and ax < 0.28 * h and abs(y) < 0.22 * h:
            # Heuristic: neck ring region
            ring = 1.0 - abs((t - 0.70) / 0.10)
            ring = max(0.0, ring)
            # Top of collar flares more
            top = max(0.0, (t - 0.68) / 0.10)
            flare = 1.0 + 0.28 * ring + 0.35 * top
            x *= flare
            y *= flare * 0.95
            if t > 0.72:
                z += 0.02 * h * top

        # --- COAT torso: stronger A-line / bell hem ---
        if m == coat_i and 0.28 < t < 0.62:
            # Exclude sleeves (far |x|)
            if ax < 0.22 * h:
                hem = max(0.0, (0.55 - t) / 0.30)
                flare = 1.0 + 0.32 * hem
                x *= flare
                y *= 1.0 + 0.18 * hem
            # Baggy sleeves — thicken mid sleeve
            elif 0.45 < t < 0.62 and ax > 0.25 * h:
                # radial thicken in YZ around arm axis roughly
                y *= 1.08

        # --- BOOTS: rounder sneaker read, push toe forward ---
        if m == coat_i and t < 0.22 and ax > 0.04 * h:
            # Forward toe (+Y)
            if y > 0.02 * h:
                y *= 1.18
            # Round side walls inward slightly at top of boot
            if t > 0.12:
                x *= 0.96
            else:
                x *= 1.02

        if m == sole_i:
            if y > 0:
                y *= 1.12
            x *= 1.04

        # Pink boot buttons — nudge onto tongue top-front
        if m == pink_i and t < 0.28:
            y += 0.01 * h
            z += 0.008 * h

        # Brows — pull down onto eyes, stronger inward angle via X shift
        if m == brow_i:
            z -= 0.025 * h
            y += 0.01 * h
            # Drag inner ends down/in
            if ax < 0.08 * h:
                z -= 0.012 * h
            x *= 0.96

        # Mouth / whiskers — keep on muzzle front
        if m == mouth_i and t > 0.55:
            # Likely whiskers or mouth near face
            if ax > 0.06 * h:
                # whiskers: lower onto muzzle, forward
                z = min(z, 0.74 * h)
                y = max(y, 0.18 * h)
            else:
                # mouth smirk
                z = 0.70 * h
                y = max(y, 0.20 * h)

        v.co = Vector((x, y, z))

    me.update()
    log("sculpt deform toward Joey silhouette applied")


def laplace_preserve_features(body):
    """Light smooth only on coat/fur bulk — skip face cards."""
    mi = mat_lookup(body)
    skip = {mi.get(n, -99) for n in ("brow", "mouth", "eye_white", "pupil", "pink", "sole")}
    me = body.data
    vert_mat = [-1] * len(me.vertices)
    for p in me.polygons:
        for vi in p.vertices:
            if vert_mat[vi] < 0:
                vert_mat[vi] = p.material_index

    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    for _ in range(2):
        new_co = {}
        for v in bm.verts:
            if vert_mat[v.index] in skip or not v.link_edges:
                continue
            avg = Vector((0, 0, 0))
            for e in v.link_edges:
                avg += e.other_vert(v).co
            avg /= len(v.link_edges)
            new_co[v.index] = v.co.lerp(avg, 0.25)
        for idx, co in new_co.items():
            bm.verts[idx].co = co
    bm.to_mesh(me)
    bm.free()
    me.update()
    log("feature-preserving smooth")


def plant(body):
    coords = [v.co.copy() for v in body.data.vertices]
    zmin = min(c.z for c in coords)
    xmid = 0.5 * (min(c.x for c in coords) + max(c.x for c in coords))
    ymid = 0.5 * (min(c.y for c in coords) + max(c.y for c in coords))
    for v in body.data.vertices:
        v.co.x -= xmid
        v.co.y -= ymid
        v.co.z -= zmin
    body.data.update()
    body.location = (0, 0, 0)


def frame_camera(view="front"):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    body = bpy.data.objects["Bizzo"]
    coords = [body.matrix_world @ v.co for v in body.data.vertices]
    xs, ys, zs = [c.x for c in coords], [c.y for c in coords], [c.z for c in coords]
    cx, cy, cz = 0.5 * (min(xs) + max(xs)), 0.5 * (min(ys) + max(ys)), 0.5 * (min(zs) + max(zs))
    h = max(zs) - min(zs)
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = h * 1.18
    if view == "front":
        cam.location = (cx, cy + h * 3.0, cz)
    elif view == "back":
        cam.location = (cx, cy - h * 3.0, cz)
    else:
        cam.location = (cx + h * 3.0, cy, cz)
    direction = Vector((cx, cy, cz)) - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render(path: Path, view="front"):
    path.parent.mkdir(parents=True, exist_ok=True)
    frame_camera(view)
    sc = bpy.context.scene
    sc.render.filepath = str(path)
    sc.render.image_settings.file_format = "PNG"
    if hasattr(sc.eevee, "taa_render_samples"):
        sc.eevee.taa_render_samples = 32
    bpy.ops.render.render(write_still=True)
    log(f"render {view} → {path}")


def export_glb(path: Path):
    body = bpy.data.objects["Bizzo"]
    active(body)
    for mod in list(body.modifiers):
        if mod.type in {"MULTIRES", "WIREFRAME"}:
            body.modifiers.remove(mod)
            continue
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            log(f"apply {mod.name}: {e}")
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_apply=True)
    log(f"glb → {path} verts={len(body.data.vertices)}")


def make_compare():
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return
    ref = REF_DIR / "ref_00_Ha3JhPE.png"
    if not ref.exists() or not OUT_FRONT.exists():
        return

    def crop_char(im):
        im = im.convert("RGBA")
        px = im.load()
        w, h = im.size
        xs, ys = [], []
        for y in range(0, h, 2):
            for x in range(0, w, 2):
                r, g, b, a = px[x, y]
                if a < 8 or r + g + b < 24:
                    continue
                xs.append(x)
                ys.append(y)
        if not xs:
            return im
        return im.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))

    a = crop_char(Image.open(ref))
    b = crop_char(Image.open(OUT_FRONT))
    th = 1000

    def fit(im):
        r = th / im.height
        return im.resize((max(1, int(im.width * r)), th), Image.Resampling.LANCZOS)

    a, b = fit(a), fit(b)
    canvas = Image.new("RGBA", (a.width + b.width + 60, th + 60), (8, 8, 12, 255))
    canvas.paste(a, (20, 40), a)
    canvas.paste(b, (a.width + 40, 40), b)
    d = ImageDraw.Draw(canvas)
    d.text((20, 10), "Joey official ref", fill=(220, 220, 230, 255))
    d.text((a.width + 40, 10), "Topo refine from preferred base", fill=(220, 220, 230, 255))
    canvas.save(OUT_CMP)
    log(f"compare → {OUT_CMP}")


def sync_demo():
    DEMO.mkdir(parents=True, exist_ok=True)
    for src, name in (
        (OUT_FRONT, "01_front.png"),
        (OUT_SIDE, "02_side.png"),
        (OUT_BACK, "03_back.png"),
        (OUT_CMP, "04_compare_ref_vs_ours.png"),
    ):
        if src.exists():
            (DEMO / name).write_bytes(src.read_bytes())
            log(f"demo ← {name}")


def main():
    global MON
    MON = Monitor.from_env(job="follow_joey_cat_topo_refine", preview_samples=4)
    stages = 6
    try:
        if not BASE_BLEND.exists():
            raise FileNotFoundError(f"missing preferred base {BASE_BLEND}")

        MON.stage("backup", index=1, total=stages, preview=False)
        if not BASE_BACKUP.exists():
            shutil.copy2(BASE_BLEND, BASE_BACKUP)
            log(f"backed up base → {BASE_BACKUP}")
        else:
            log(f"base backup already exists → {BASE_BACKUP}")

        MON.stage("load", index=2, total=stages, preview=False)
        bpy.ops.wm.open_mainfile(filepath=str(BASE_BLEND))
        setup_render()
        body = bpy.data.objects.get("Bizzo")
        if body is None:
            raise RuntimeError("Bizzo object not found in preferred blend")
        log(f"loaded Bizzo verts={len(body.data.vertices)}")

        MON.stage("sculpt", index=3, total=stages, preview=False)
        ensure_density(body)
        retint_materials(body)
        sculpt_toward_joey(body)
        laplace_preserve_features(body)
        plant(body)
        smooth(body)
        # Multires ready for further hand sculpt
        if not any(m.type == "MULTIRES" for m in body.modifiers):
            body.modifiers.new("Multires", "MULTIRES")
        frame_camera("front")
        MON.preview(message="refined topo front", force=True)

        MON.stage("save", index=4, total=stages, preview=False)
        ART.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))

        MON.stage("renders", index=5, total=stages, preview=False)
        render(OUT_FRONT, "front")
        render(OUT_SIDE, "side")
        render(OUT_BACK, "back")
        make_compare()
        sync_demo()

        MON.stage("export", index=6, total=stages, preview=False)
        export_glb(OUT_GLB)
        export_glb(ART / "bizzo_cat_topo.glb")
        frame_camera("front")
        MON.preview(message="final refined topo", force=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
        MON.done("Topo refine from preferred base complete")
    except Exception as e:
        if MON is not None:
            MON.fail(str(e))
        raise


if __name__ == "__main__":
    main()
