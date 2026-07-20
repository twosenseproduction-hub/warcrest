# Shared Blender primitive helpers for blender-reference-character.
# Loaded inside Blender: exec or import via blender --python scripts that add this dir to sys.path.
import bpy, math, mathutils

V = mathutils.Vector

def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for d in list(blk):
            blk.remove(d)

def mat(name, rgb, rough=0.55, metal=0.0, emit=None, estr=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*rgb, 1.0)
    b.inputs['Roughness'].default_value = rough
    try:
        b.inputs['Metallic'].default_value = metal
    except Exception:
        pass
    if emit is not None:
        try:
            b.inputs['Emission Color'].default_value = (*emit, 1.0)
        except Exception:
            b.inputs['Emission'].default_value = (*emit, 1.0)
        b.inputs['Emission Strength'].default_value = estr
    return m

def mat_from_card(card, key, rough=0.55, metal=0.0):
    rgb = hex_rgb(card['palette'][key])
    emit = estr = None
    em = (card.get('emissive') or {}).get(key)
    if em:
        emit = hex_rgb(em['color'])
        estr = float(em.get('strength', 1.0))
    return mat(f'c_{key}', rgb, rough=rough, metal=metal, emit=emit, estr=estr or 0.0)

def clear_sel():
    for o in bpy.context.selected_objects:
        o.select_set(False)

def activate(ob):
    clear_sel()
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob

def apply_TRS(ob, loc=False, rot=False, scale=False):
    activate(ob)
    bpy.ops.object.transform_apply(location=loc, rotation=rot, scale=scale)

def finish(ob, material, name, parts):
    ob.name = name
    if ob.data.materials:
        ob.data.materials[0] = material
    else:
        ob.data.materials.append(material)
    for p in ob.data.polygons:
        p.use_smooth = True
    parts.append(ob)
    return ob

def add_uv(loc, r, seg=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    return bpy.context.active_object

def add_ico(loc, r, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    return bpy.context.active_object

def add_cyl(loc, r, depth, seg=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=loc)
    return bpy.context.active_object

def add_cone(loc, r1, r2, depth, seg=8):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2, depth=depth, location=loc)
    return bpy.context.active_object

def add_cube(loc, scale):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.scale = scale
    apply_TRS(ob, scale=True)
    return ob

def add_torus(loc, maj, minr, seg=18, mseg=8):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=seg, minor_segments=mseg,
        major_radius=maj, minor_radius=minr, location=loc)
    return bpy.context.active_object

def scale_local(ob, sx, sy, sz):
    ob.scale = (sx, sy, sz)
    apply_TRS(ob, scale=True)

def rot_euler(ob, rx, ry, rz):
    ob.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    apply_TRS(ob, rot=True)

def limb_x(x0, x1, y, z, r, material, name, parts):
    mid = ((x0 + x1) * 0.5, y, z)
    ob = add_cyl(mid, r, abs(x1 - x0), seg=12)
    rot_euler(ob, 0, 90, 0)
    return finish(ob, material, name, parts)

def limb_z(x, y, z0, z1, r, material, name, parts):
    mid = (x, y, (z0 + z1) * 0.5)
    ob = add_cyl(mid, r, abs(z1 - z0), seg=12)
    return finish(ob, material, name, parts)

def leaf_plate(loc, sx, sy, sz, material, parts, rx=0, ry=0, rz=0, name='leaf'):
    import bmesh
    ob = add_ico(loc, 0.5, subdiv=2)
    scale_local(ob, sx, sy, sz)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    zmax = max((v.co.z for v in bm.verts), default=1.0) or 1.0
    for v in bm.verts:
        t = max(0.0, v.co.z / zmax)
        v.co.x *= 1.0 - 0.55 * t
        v.co.y *= 1.0 - 0.45 * t
    bm.to_mesh(ob.data)
    bm.free()
    if rx or ry or rz:
        rot_euler(ob, rx, ry, rz)
    return finish(ob, material, name, parts)

def join_and_ground(parts, name):
    clear_sel()
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = name
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    mn = min((body.matrix_world @ V(c)).z for c in body.bound_box)
    body.location.z -= mn
    cx = sum((body.matrix_world @ V(c)).x for c in body.bound_box) / 8.0
    body.location.x -= cx
    bpy.context.view_layer.update()
    return body
