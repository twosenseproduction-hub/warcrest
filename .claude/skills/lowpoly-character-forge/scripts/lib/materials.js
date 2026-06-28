/* lowpoly-character-forge — materials.js
 * The Bitgem look is a SHADING trick, not a geometry trick: smooth-normaled
 * low-poly geometry + banded toon ramps + fresnel rim + inverted-hull outline
 * (+ emissive bloom, applied at the composer in the render harness).
 * Browser-global module: attaches to window.LPF. Uses the global THREE (r144). */
(function (root) {
  var THREE = root.THREE;
  var LPF = root.LPF = root.LPF || {};

  // A small NearestFilter ramp is what produces toon banding. `vals` are 0..255
  // luminance stops, dark -> light. 2 texels = crisp two-tone; 4-5 = soft skin.
  LPF.makeRamp = function (vals) {
    var arr = new Uint8Array(vals);
    var tex = new THREE.DataTexture(arr, vals.length, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    return tex;
  };
  LPF.RAMP = {
    skin: LPF.makeRamp([55, 115, 180, 230]),   // soft 4-step, tops below full so color stays saturated
    cloth: LPF.makeRamp([38, 200]),            // crisp two-tone, deep shadow
    metal: LPF.makeRamp([45, 110, 180, 235, 255]),
  };

  // Toon material with a gradient ramp + optional fresnel rim injected.
  LPF.toon = function (color, opts) {
    opts = opts || {};
    var m = new THREE.MeshToonMaterial({
      color: color,
      gradientMap: opts.ramp || LPF.RAMP.skin,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity != null ? opts.emissiveIntensity : 1,
    });
    if (opts.rim !== false) LPF.fresnelInject(m, opts);
    return m;
  };

  // Inject a view-space fresnel rim into any lit material via onBeforeCompile.
  // rimColor cool, rimPower ~3, confined to lit hemisphere for a clean edge.
  LPF.fresnelInject = function (material, opts) {
    opts = opts || {};
    var rimColor = new THREE.Color(opts.rimColor != null ? opts.rimColor : 0x9ad8ff);
    var rimPower = opts.rimPower != null ? opts.rimPower : 3.0;
    var rimStrength = opts.rimStrength != null ? opts.rimStrength : 0.3;
    material.onBeforeCompile = function (sh) {
      sh.uniforms.uRimColor = { value: rimColor };
      sh.uniforms.uRimPower = { value: rimPower };
      sh.uniforms.uRimStrength = { value: rimStrength };
      sh.vertexShader = 'varying vec3 vWN; varying vec3 vWP;\n' + sh.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n  vWN = normalize(mat3(modelMatrix) * objectNormal);\n  vWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = 'uniform vec3 uRimColor; uniform float uRimPower; uniform float uRimStrength; varying vec3 vWN; varying vec3 vWP;\n' +
        sh.fragmentShader.replace(
          '#include <dithering_fragment>',
          'float rim = 1.0 - max(0.0, dot(normalize(vWN), normalize(cameraPosition - vWP)));\n  rim = pow(rim, uRimPower) * uRimStrength;\n  gl_FragColor.rgb += uRimColor * rim;\n  #include <dithering_fragment>');
    };
    material.needsUpdate = true;
    return material;
  };

  // Inverted-hull outline: a backface shell pushed out along normals. Cheap,
  // per-object, matches the chibi aesthetic. Returns a mesh to add as a sibling.
  LPF.outlineMesh = function (mesh, thickness, color) {
    thickness = thickness == null ? 0.03 : thickness;
    var m = new THREE.MeshBasicMaterial({ color: color == null ? 0x161020 : color, side: THREE.BackSide });
    m.onBeforeCompile = function (sh) {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
        'vec3 transformed = position + normalize(objectNormal) * ' + thickness.toFixed(4) + ';');
    };
    var o = new THREE.Mesh(mesh.geometry, m);
    o.scale.copy(mesh.scale); o.position.copy(mesh.position); o.rotation.copy(mesh.rotation);
    return o;
  };

  // Wrap a group: add an outline sibling for every mesh under it.
  LPF.outlineGroup = function (group, thickness, color) {
    var adds = [];
    group.traverse(function (o) { if (o.isMesh) adds.push(o); });
    adds.forEach(function (o) { var ol = LPF.outlineMesh(o, thickness, color); o.parent.add(ol); });
    return group;
  };

  // "Low-poly but smooth" — weld coincident verts then average normals.
  // Strip normal/uv first or mergeVertices won't weld (community gotcha).
  LPF.smooth = function (geo, tol) {
    geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
    if (THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeVertices) {
      geo = THREE.BufferGeometryUtils.mergeVertices(geo, tol == null ? 1e-4 : tol);
    }
    geo.computeVertexNormals();
    return geo;
  };
  // Deliberately faceted (gems/crystals): per-face normals.
  LPF.facet = function (geo) { var g = geo.toNonIndexed(); g.computeVertexNormals(); return g; };
})(typeof window !== 'undefined' ? window : globalThis);
