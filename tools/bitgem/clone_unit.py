#!/usr/bin/env python3
"""Clone a Bitgem unit OUT OF BLENDER — the exact-fidelity base for building new
units. Imports an existing rigged/textured .glb, optionally swaps in a palette
atlas as the base-colour texture (for units exported without it, e.g. the orcs),
and re-exports a self-contained .glb with rig + animations + embedded texture.

This is the starting point for the kitbash+repaint workflow: copy a real mesh
(exact style), then edit geometry / recolour the atlas in Blender to make a new
unit — instead of rebuilding from primitives.

Run headless:
  python3 tools/bitgem/clone_unit.py <src.glb> <out.glb> [atlas.png]

Notes
- Uses the `bpy` module (Blender 4.2). export_yup round-trips glTF orientation.
- If <atlas.png> is given, it's packed and wired to every material's Base Color
  over the existing UVs (the meshes already carry atlas UVs).
"""
import bpy, sys

def main():
    args = [a for a in sys.argv[sys.argv.index('--') + 1:]] if '--' in sys.argv else sys.argv[1:]
    src, out = args[0], args[1]
    atlas = args[2] if len(args) > 2 else None
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    if atlas:
        img = bpy.data.images.load(atlas); img.pack()
        for mat in bpy.data.materials:
            if not mat.use_nodes:
                mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get('Principled BSDF')
            if not bsdf:
                continue
            tx = mat.node_tree.nodes.new('ShaderNodeTexImage'); tx.image = img
            for lk in list(bsdf.inputs['Base Color'].links):
                mat.node_tree.links.remove(lk)
            mat.node_tree.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
            bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
            if 'Metallic' in bsdf.inputs:
                bsdf.inputs['Metallic'].default_value = 0.0
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',
                              export_animations=True, export_skins=True, export_yup=True)
    print('cloned', src, '->', out)

if __name__ == '__main__':
    main()
