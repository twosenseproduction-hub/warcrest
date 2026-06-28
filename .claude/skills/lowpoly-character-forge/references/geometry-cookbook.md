# Geometry cookbook

Builders live in `scripts/lib/parts.js` (`LPF.parts`). Compose in `build-character.js`.

## Pattern: group-per-part for posing
A `THREE.Group` per character and per limb; pose by setting group `.rotation`. Nest a
limb mesh under a joint group offset to the shoulder/hip so rotation pivots correctly:
```js
const armR = LPF.parts.joint(0.5, shoulderY, 0);   // pivot at shoulder
const upper = new THREE.Mesh(LPF.smooth(LPF.parts.limbGeo(0.13, 0.9)), skin);
upper.position.y = -0.45; armR.add(upper);
armR.rotation.z = -1.1;                              // raised stance
```

## Forms
- **Head / organic blobs:** `LPF.parts.headGeo(r, taper)` — icosphere with a vertical
  taper. Displace position attribute for custom shapes, then `computeVertexNormals()`.
  A small random vertex jitter makes forms read hand-crafted vs mechanical.
- **Pointed ears / leaves / curved blades:** 2D `THREE.Shape` (`moveTo`/`bezierCurveTo`)
  → `ExtrudeGeometry`. `LPF.parts.pointedShape(len,w)`, `LPF.parts.bladeGeo(len,w)`.
  Always `geometry.center()` after extrude/lathe (origin sits at a corner).
- **Staffs / horns / vases (radial symmetry):** `LPF.parts.lathe(profilePts, seg)`.
- **Torso / limbs:** `CapsuleGeometry` (smooth rounded) with cylinder fallback;
  `LPF.parts.torsoGeo`, `LPF.parts.limbGeo`.

## Color blocking — three strategies
1. **Separate material per region** (recommended): no UVs, each region its own toon
   ramp + emissive. Merge same-material static parts to cut draw calls.
2. **Vertex colors:** `color` BufferAttribute + `vertexColors:true`; flat blocking,
   exports cleanly to glTF.
3. **UV + texture:** only for painted within-region detail; procedural meshes rarely
   have good UVs — prefer matcap or vertex colors.

## Posing / animation
Static action poses (group rotations) are the right call for a code-only pipeline and
for hero renders / sprite sheets. Hand-weighting a `SkinnedMesh` procedurally is the
weak point — for in-game skeletal animation, export `.glb` and rig in Blender (or reuse
an existing animated rig). GSAP can drive parameter idle motion (breathing, turntable)
without a skeleton.

## Performance
~1,800–2,300 tris/character. `THREE.BufferGeometryUtils.mergeGeometries` to combine
same-material parts; check `renderer.info.render.triangles` / `.calls`. Outlines double
outlined geometry — selective.
