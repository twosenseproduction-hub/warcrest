# Blender cookbook (headless, procedural)

Safe recipes for cloud/headless Blender 3.6–4.x. Prefer these over clever bmesh
matrix stacks — those caused exploded “fan” geometry on the first antler-elf pass.

## Scene conventions (Warcrest)

| Rule | Value |
|---|---|
| Up | +Z |
| Face | −Y (front camera sits on −Y looking toward origin) |
| Feet | z ≈ 0 after join + origin fix |
| T-pose arms | along ±X |
| Units | ~2–2.5 tall for preview; game scales on import |

## Materials

One **Principled BSDF** material per palette region. No UVs required for blockout.

```python
def mat(name, rgb, rough=0.55, metal=0.0, emit=None, estr=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    try: b.inputs['Metallic'].default_value = metal
    except: pass
    if emit is not None:
        try: b.inputs['Emission Color'].default_value = (*emit, 1)
        except: b.inputs['Emission'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = estr
    return m
```

Hex → RGB: `tuple(int(h[i:i+2],16)/255 for i in (1,3,5))` when `h` is `#rrggbb`.

## Primitives — prefer `bpy.ops`

```python
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=r, location=loc)
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r, depth=d, location=loc)
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=r, radius2=0, depth=d, location=loc)
bpy.ops.mesh.primitive_cube_add(size=1, location=loc)  # then scale + apply
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=loc)
bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc)
```

Always `transform_apply` scale/rotation on the **active** object only (deselect others first).

## Torus orientation (easy to get wrong)

Default torus lies in **XY**, hole axis = **+Z**.

| Want | Do |
|---|---|
| Belt / circlet / boot cuff (horizontal) | **no rotation** |
| Arm ring around an arm along ±X | `rotate Y 90°` then apply |
| Face-on halo (usually wrong) | rotate X 90° — avoid for clothing |

## Limbs

- Vertical (legs): cylinder at mid-z, depth = length, no rotation.
- Horizontal T-pose arms: cylinder, `rotate Y ±90°`, location at segment midpoint.
- Keep upper arm → forearm → bracer → hand continuous (no huge gaps).

## Leaf plates

Icosphere → non-uniform scale (thin Y) → pinch +Z verts inward in Edit/bmesh →
rotate into place. Keep sizes small (sx,sy,sz ≤ ~0.3). Giant scales = silhouette noise.

## Join + ground

```python
# select all parts, join
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
# shift so min Z → 0; center X → 0
```

## Export

```python
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True)
```

Static T-pose: `export_animations=False`. Rigged: keep NLA strips / actions.

## Render views

Use `scripts/render_views.py`. Auto-frame camera from mesh bbox. Soft dark world
`(0.12,0.12,0.14)`. Sun + area fill. EEVEE with mild bloom for eye/gem emissives.

## Avoid

- `bmesh.ops` transform chains that rotate capsules after partial applies
- Assuming `bmesh.ops.create_torus` exists (it does not on Blender 4.0)
- Applying transforms while multiple leftover objects are selected
- Building face toward +Y while renders assume −Y
