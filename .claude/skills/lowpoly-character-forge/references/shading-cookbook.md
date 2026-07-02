# Shading cookbook

All helpers live in `scripts/lib/materials.js` (`window.LPF`). Recipes below.

## Smooth normals on low-poly (the core trick)
Lighting comes from vertex normals. Merge coincident verts then average:
```js
geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); // or mergeVertices won't weld
geo = THREE.BufferGeometryUtils.mergeVertices(geo, 1e-4);  // -> indexed
geo.computeVertexNormals();                                 // averaged = smooth
```
`LPF.smooth(geo)` does this. For faceted gems: `LPF.facet(geo)` (`toNonIndexed` + normals).
Gotcha: `ExtrudeGeometry` resists welding because attributes differ at shared positions —
strip them first (LPF.smooth does).

## Toon ramp (hand-painted bands)
`MeshToonMaterial` + a tiny `NearestFilter` `DataTexture` ramp. Texel count/values =
the bands. `NearestFilter` is what produces the banding.
```js
const ramp = LPF.makeRamp([55,115,180,230]);          // dark->light luminance stops
const skin = LPF.toon(0x8a5cd0, { ramp });            // soft 4-step skin
const cloth = LPF.toon(0x26314f, { ramp: LPF.RAMP.cloth }); // crisp 2-step
```
Keep top texel < 255 so the lit band keeps the base color saturated instead of
washing to white. `MeshToonMaterial` has ~constant contrast regardless of base color;
for dark fabrics that look under-shaded, tweak `getGradientIrradiance` via
`onBeforeCompile`.

Alternatives: `MeshMatcapMaterial` = fully baked painted look, ignores lights (great
for sprite-sheet bakes, identical in any environment); custom cel `ShaderMaterial` =
most control (band `step(NdotL)` + rim + emissive in one pass).

## Fresnel rim
`LPF.fresnelInject(material, { rimColor, rimPower, rimStrength })` injects a view-space
rim into any lit material. Keep `rimStrength` ~0.3 or it adds to blowout. Multiply by
`NdotL` to confine to lit areas; `smoothstep` for a crisp cutoff.

## Inverted-hull outline
`LPF.outlineMesh(mesh, thickness, color)` / `LPF.outlineGroup(group, thickness)`.
A backface shell pushed out along normals in the vertex shader — cheap, per-object,
matches the chibi look. Doubles outlined geometry, so apply to hero parts.

## Emissive + bloom
Bright emissive on the glowing part, bloom in the harness composer:
```js
const blade = LPF.toon(0x40ffa0, { emissive: 0x40ffa0, emissiveIntensity: 2.2, rim:false });
// render-page.html: new THREE.UnrealBloomPass(size, strength, radius, threshold)
//   strength ~0.6-0.8, radius ~0.4-0.5, threshold ~0.9
```
Bloom keys off luminance over `threshold`. **Dark background + restrained lighting**
(key ~1.1, ambient ~0.12) or lit diffuse exceeds threshold and the whole frame glows.
For mixed scenes use selective bloom (bloom-only pass with non-glowing objects blacked
out, composited over the base).

## Export caveat
`GLTFExporter` serializes geometry + standard materials only. Custom toon/fresnel/
outline `onBeforeCompile` shaders **do not** survive export — the engine reapplies them
(Warcrest does). Bake to vertex colors / `MeshStandardMaterial` if you need the look in
a vanilla glTF viewer.
