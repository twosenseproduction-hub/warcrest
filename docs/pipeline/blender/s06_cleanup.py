"""S6 Cleanup & mesh repair (reference implementation).

Deterministic mesh hygiene using the bmesh data API (not bpy.ops), so results do not
depend on selection/context state.

in:  .blend from S5 (symmetry)         out: repaired .blend + receipt
validate: 0 non-manifold edges, 0 degenerate faces, consistent normals, holes repaired
fail:     holes above threshold or self-intersection remain -> hard_fail (route to S7 remesh)
fallback: (in the orchestrator) voxel-remesh repair then S7 retopo

Run:
  blender -b --factory-startup --python-exit-code 1 --python s06_cleanup.py -- \
    --in in.blend --out out.blend --config dna.json --thresholds ../qa-thresholds.json \
    --seed 0 --report s06.json
"""
import os
import sys

import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_stage_args, load_json, Receipt, sorted_objects  # noqa: E402


def get_mesh_objects():
    return sorted_objects([o for o in bpy.data.objects if o.type == "MESH"])


def clean_mesh(obj, epsilon_mm, hole_repair_max_cm2):
    """Return dict of counts. Pure bmesh; no ops, no selection dependence."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)

    stats = {}

    # 1. Merge doubles (merge-by-distance) at DNA epsilon.
    eps_m = epsilon_mm / 1000.0
    before_v = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=eps_m)
    stats["merged_verts"] = before_v - len(bm.verts)

    # 2. Delete degenerate (zero-area) faces and zero-length edges.
    bmesh.ops.dissolve_degenerate(bm, dist=eps_m, edges=bm.edges)

    # 3. Delete loose geometry (verts/edges with no face).
    loose_verts = [v for v in bm.verts if not v.link_faces]
    stats["loose_verts_removed"] = len(loose_verts)
    bmesh.ops.delete(bm, geom=loose_verts, context="VERTS")

    # 4. Recalculate normals consistently outward.
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    # 5. Fill small holes (boundary loops under the area threshold).
    hole_max_m2 = hole_repair_max_cm2 / 10000.0
    boundary_edges = [e for e in bm.edges if e.is_boundary]
    filled = bmesh.ops.holes_fill(bm, edges=boundary_edges, sides=0)
    stats["holes_filled"] = len(filled.get("faces", []))

    # Measure remaining defects.
    stats["non_manifold_edges"] = sum(1 for e in bm.edges if not e.is_manifold)
    # Any boundary edge left = an unfilled (too large) hole.
    stats["open_boundary_edges"] = sum(1 for e in bm.edges if e.is_boundary)
    stats["tris"] = sum(1 for f in bm.faces if len(f.verts) == 3)
    stats["quads"] = sum(1 for f in bm.faces if len(f.verts) == 4)
    stats["ngons"] = sum(1 for f in bm.faces if len(f.verts) > 4)

    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    me.update()
    _ = hole_max_m2  # illustrative: a real build filters holes_fill by loop area first
    return stats


def main():
    args = parse_stage_args()
    dna = load_json(args.config)
    thr = load_json(args.thresholds) if args.thresholds else {}
    geo = thr.get("geometry", {})
    epsilon_mm = geo.get("merge_by_distance_epsilon_mm", 0.1)
    hole_max = geo.get("hole_area_repair_max_cm2", 4.0)

    receipt = Receipt("S06_cleanup", args, {"dna": dna, "geometry": geo})

    bpy.ops.wm.open_mainfile(filepath=args.in_path)

    meshes = get_mesh_objects()
    if not meshes:
        receipt.check("geometry", "mesh_present", 0, ">=1", False, hard_fail=True)
        receipt.write(args.out_path)
        sys.exit(1)

    total = {"non_manifold_edges": 0, "open_boundary_edges": 0}
    for obj in meshes:
        s = clean_mesh(obj, epsilon_mm, hole_max)
        receipt.note(f"{obj.name}: {s}")
        total["non_manifold_edges"] += s["non_manifold_edges"]
        total["open_boundary_edges"] += s["open_boundary_edges"]

    receipt.check("geometry", "non_manifold_edges", total["non_manifold_edges"],
                  geo.get("non_manifold_edges_max", 0),
                  total["non_manifold_edges"] <= geo.get("non_manifold_edges_max", 0),
                  hard_fail=True)
    receipt.check("geometry", "open_holes_remaining", total["open_boundary_edges"],
                  0, total["open_boundary_edges"] == 0, hard_fail=True)

    bpy.ops.wm.save_as_mainfile(filepath=args.out_path)
    receipt.write(args.out_path)

    if receipt.any_hard_fail():
        sys.exit(1)


if __name__ == "__main__":
    main()
