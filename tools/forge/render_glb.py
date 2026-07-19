#!/usr/bin/env python3
"""Headless Blender render of a glb for critique: imports the model, sets an
action + frame, and renders N camera angles. Usage:
  python3 tools/forge/render_glb.py <in.glb> <out_dir> [clip:frame ...]
"""
import sys, os, math
import bpy
from mathutils import Vector

def main():
    glb, outdir = sys.argv[1], sys.argv[2]
    shots = sys.argv[3:] or ['Idle:1', 'Walk:mid', 'Attack:mid', 'Death:end']
    os.makedirs(outdir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)

    # bounds of all meshes
    lo = Vector((1e9, 1e9, 1e9)); hi = -lo
    arm = None
    for o in bpy.data.objects:
        if o.type == 'ARMATURE': arm = o
        if o.type == 'MESH':
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                lo = Vector((min(lo[i], w[i]) for i in range(3)))
                hi = Vector((max(hi[i], w[i]) for i in range(3)))
    center = (lo + hi) * 0.5
    size = max((hi - lo)[i] for i in range(3)) or 1.0

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    try: scene.cycles.device = 'CPU'; scene.cycles.samples = 24
    except Exception: pass
    scene.render.resolution_x = 480; scene.render.resolution_y = 600
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('W'); scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.14, 0.16, 0.20, 1)

    cam_data = bpy.data.cameras.new('C'); cam = bpy.data.objects.new('C', cam_data)
    scene.collection.objects.link(cam); scene.camera = cam
    sun_d = bpy.data.lights.new('S', 'SUN'); sun_d.energy = 3.0
    sun = bpy.data.objects.new('S', sun_d); scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(55), 0, math.radians(35))

    from mathutils import Matrix
    # glTF import renames actions ("Death"→"Death_Rig") and stashes them in NLA;
    # match on the stripped name and mute NLA so the assigned action drives.
    actions = {}
    for a in bpy.data.actions:
        actions[a.name] = a
        actions[a.name.replace('_Rig', '')] = a
    if arm and arm.animation_data:
        for tr in arm.animation_data.nla_tracks:
            tr.mute = True
    for shot in shots:
        clip, _, fr = shot.partition(':')
        act = actions.get(clip)
        nframes = 2
        if arm:
            arm.animation_data_create()
            if act is None:                                # rest: clear any stale pose
                arm.animation_data.action = None
                for pb in arm.pose.bones:
                    pb.matrix_basis = Matrix.Identity(4)
            else:
                arm.animation_data.action = act
                nframes = int(act.frame_range[1])
        if fr == 'mid': frame = max(1, nframes // 2)
        elif fr == 'end': frame = nframes
        else: frame = int(fr) if fr else 1
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        for ang in (35, 150):
            a = math.radians(ang)
            r = size * 2.6
            cam.location = center + Vector((math.sin(a) * r, -math.cos(a) * r, size * 0.08))
            d = (center - cam.location)
            cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
            scene.render.filepath = os.path.join(outdir, f'{clip}_{ang:03d}.png')
            bpy.ops.render.render(write_still=True)
            print('rendered', scene.render.filepath)

if __name__ == '__main__':
    main()
