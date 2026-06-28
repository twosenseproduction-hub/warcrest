/* lowpoly-building-forge — kit-parts.js
 * Grid-locked kit of building parts (foundation, walls, roofs, windows, props)
 * built from primitives + the character forge's toon materials. Browser-global:
 * attaches to window.LPF.kit. Uses LPF.toon/facet/smooth + global THREE. */
(function (root) {
  var THREE = root.THREE;
  var LPF = root.LPF = root.LPF || {};
  var K = LPF.kit = {};
  function facet(geo, mat) { return new THREE.Mesh(LPF.facet(geo), mat); }
  function smooth(geo, mat) { return new THREE.Mesh(LPF.smooth(geo), mat); }
  function at(m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); return m; }
  K.at = at; K.facet = facet; K.smooth = smooth;

  K.TILE = 2.0;            // world units per RTS tile
  K.WALL_H = 2.4;

  // chunky rock foundation that the building sits on (top at y=0)
  K.foundation = function (w, d, mat) {
    var g = new THREE.Group();
    g.add(at(facet(new THREE.BoxGeometry(w * 1.04, 0.5, d * 1.04), mat), 0, -0.22, 0));
    // jittered rim rocks so it never looks like a flat slab
    var n = Math.max(8, Math.round((w + d) * 1.6));
    for (var i = 0; i < n; i++) {
      var t = i / n * Math.PI * 2, rx = w * 0.52, rz = d * 0.52;
      var rk = facet(new THREE.IcosahedronGeometry(0.22 + (i % 3) * 0.06, 0), mat);
      at(rk, Math.cos(t) * rx, -0.05, Math.sin(t) * rz); rk.rotation.y = t; rk.scale.y = 0.8; g.add(rk);
    }
    return g;
  };
  // plain box wall (centered, base at y=0)
  K.wall = function (w, h, t, mat) { return at(smooth(new THREE.BoxGeometry(w, h, t), mat), 0, h / 2, 0); };
  // round tower shaft
  K.tower = function (r, h, mat, seg) { return at(facet(new THREE.CylinderGeometry(r, r * 1.08, h, seg || 8), mat), 0, h / 2, 0); };
  // gable (pitched) roof — triangular prism spanning length L over depth D
  K.gableRoof = function (L, D, h, mat) {
    var s = new THREE.Shape(); s.moveTo(-D / 2, 0); s.lineTo(D / 2, 0); s.lineTo(0, h); s.lineTo(-D / 2, 0);
    var g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(-L / 2, 0, 0); g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  };
  // conical / tent roof (low-seg cone)
  K.coneRoof = function (r, h, mat, seg) { return facet(new THREE.ConeGeometry(r, h, seg || 8), mat); };
  // draped cloth tent roof: cone with scalloped lower edge (a second flared ring)
  K.tentRoof = function (r, h, mat) {
    var g = new THREE.Group(); g.add(at(facet(new THREE.ConeGeometry(r, h, 8), mat), 0, h / 2, 0));
    g.add(at(facet(new THREE.ConeGeometry(r * 1.12, h * 0.34, 8), mat), 0, h * 0.16, 0));   // flared skirt
    return g;
  };
  // window: dark frame + an emissive pane (tag pane into userData.glow)
  K.window = function (w, h, frameMat, glowMat) {
    var g = new THREE.Group(); g.add(at(facet(new THREE.BoxGeometry(w, h, 0.12), frameMat), 0, 0, 0));
    var pane = facet(new THREE.BoxGeometry(w * 0.6, h * 0.6, 0.16), glowMat); at(pane, 0, 0, 0.04); g.add(pane); g.userData.glow = [pane];
    return g;
  };
  // round leaf-cross window (elf): ring + a cross divider + glow pane
  K.leafWindow = function (r, frameMat, glowMat) {
    var g = new THREE.Group();
    var ring = facet(new THREE.TorusGeometry(r, 0.07, 6, 10), frameMat); ring.rotation.x = Math.PI / 2; g.add(ring);
    g.add(at(facet(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.1, 10), glowMat), 0, 0, -0.02));
    g.add(at(facet(new THREE.BoxGeometry(r * 1.9, 0.06, 0.14), frameMat), 0, 0, 0.03));
    g.add(at(facet(new THREE.BoxGeometry(0.06, r * 1.9, 0.14), frameMat), 0, 0, 0.03));
    g.userData.glow = [g.children[1]]; return g;
  };
  K.door = function (w, h, mat) {
    var g = new THREE.Group(); g.add(at(smooth(new THREE.BoxGeometry(w, h, 0.16), mat), 0, h / 2, 0));
    g.add(at(facet(new THREE.CylinderGeometry(w / 2, w / 2, 0.16, 8, 1, false, 0, Math.PI), mat), 0, h, 0)); // arched top
    return g;
  };
  // leaf-blob canopy (elf): clustered faceted icosphere clumps, two-tone
  K.canopy = function (radius, clumps, topMat, coreMat) {
    var g = new THREE.Group();
    g.add(at(facet(new THREE.IcosahedronGeometry(radius * 0.85, 0), coreMat), 0, 0, 0));
    for (var i = 0; i < clumps; i++) {
      var a = i / clumps * Math.PI * 2 + (i % 2) * 0.6, e = 0.2 + (i % 3) * 0.32;
      var b = facet(new THREE.IcosahedronGeometry(radius * (0.42 + (i % 3) * 0.12), 0), topMat);
      at(b, Math.cos(a) * Math.cos(e) * radius * 0.7, Math.sin(e) * radius * 0.6 + radius * 0.2, Math.sin(a) * Math.cos(e) * radius * 0.7);
      b.rotation.set(a, e, i); g.add(b);
    }
    return g;
  };
  // bone spike (orc): a straight tusk
  K.boneSpike = function (len, mat) { var c = facet(new THREE.ConeGeometry(len * 0.22, len, 5), mat); return c; };
  // curved bone tusk: a tapered chain of segments that arcs (side=+1/-1 curve dir)
  K.boneTusk = function (len, mat, side) {
    var g = new THREE.Group(); var seg = g, n = 5, sl = len / n;
    for (var i = 0; i < n; i++) {
      var j = new THREE.Group(); j.rotation.z = side * (0.18 + i * 0.13); if (i > 0) j.position.y = sl;
      j.add(at(facet(new THREE.ConeGeometry((1 - i / n) * len * 0.12 + 0.04, sl * 1.06, 6), mat), 0, sl / 2, 0));
      seg.add(j); seg = j;
    }
    return g;
  };
  // curved bone arch/gate: two big tusks rising and curving toward each other
  K.boneArch = function (span, len, mat) {
    var g = new THREE.Group();
    [-1, 1].forEach(function (s) { var t = K.boneTusk(len, mat, -s); at(t, s * span / 2, 0, 0); g.add(t); });
    return g;
  };
  // banner / flag cloth on a pole
  K.banner = function (h, mat, poleMat) {
    var g = new THREE.Group(); g.add(at(smooth(new THREE.CylinderGeometry(0.05, 0.05, h, 6), poleMat), 0, h / 2, 0));
    g.add(at(facet(new THREE.BoxGeometry(0.5, h * 0.5, 0.04), mat), 0.28, h * 0.72, 0)); return g;
  };
  K.chimney = function (h, mat) { return at(facet(new THREE.BoxGeometry(0.5, h, 0.5), mat), 0, h / 2, 0); };
  K.beam = function (len, mat) { return facet(new THREE.BoxGeometry(0.14, 0.14, len), mat); };
})(typeof window !== 'undefined' ? window : globalThis);
