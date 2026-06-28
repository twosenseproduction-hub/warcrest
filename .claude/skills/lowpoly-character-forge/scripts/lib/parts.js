/* lowpoly-character-forge — parts.js
 * Parametric low-poly primitive builders. Keep segment counts low (sphere
 * 16x10, cyl 8-12) for a Bitgem-class ~2k-tri budget; smoothing comes from
 * LPF.smooth (materials.js). Each builder returns a THREE.Mesh/Geometry that
 * the character composer groups and poses. Browser-global: window.LPF.parts. */
(function (root) {
  var THREE = root.THREE;
  var LPF = root.LPF = root.LPF || {};
  var P = LPF.parts = {};

  // Icosphere head, tapered toward the crown for a chibi read.
  P.headGeo = function (r, taper) {
    var g = new THREE.IcosahedronGeometry(r || 1, 2);
    var pos = g.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i), t = 1 - (taper || 0.18) * (y / (r || 1) * 0.5 + 0.5);
      pos.setX(i, pos.getX(i) * t); pos.setZ(i, pos.getZ(i) * t);
    }
    g.computeVertexNormals(); return g;
  };

  // Pointed elf ear / leaf blade as an extruded 2D shape (mirror for the pair).
  P.pointedShape = function (len, w) {
    len = len || 1; w = w || 0.4;
    var s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(w, 0.1 * len, w * 0.7, 0.7 * len, 0, len);
    s.bezierCurveTo(-w * 0.7, 0.7 * len, -w, 0.1 * len, 0, 0);
    return s;
  };
  P.extrude = function (shape, depth) {
    var g = new THREE.ExtrudeGeometry(shape, { depth: depth || 0.12, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.02, bevelThickness: 0.02 });
    g.center(); return g;
  };

  // Tapered torso (capsule-ish via cylinder with different radii) or capsule.
  P.torsoGeo = function (rTop, rBot, h) {
    if (THREE.CapsuleGeometry && rTop === rBot) return new THREE.CapsuleGeometry(rTop, h, 4, 12);
    return new THREE.CylinderGeometry(rTop || 0.5, rBot || 0.7, h || 1.4, 12, 1);
  };

  // Limb as a capsule (smooth rounded), fallback to cylinder.
  P.limbGeo = function (r, len) {
    if (THREE.CapsuleGeometry) return new THREE.CapsuleGeometry(r || 0.16, len || 0.9, 3, 8);
    return new THREE.CylinderGeometry(r, r, len, 8);
  };

  // Radial-symmetry forms (staff, horn, vase) via lathe of a 2D profile.
  P.lathe = function (profile, seg) {
    var pts = profile.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var g = new THREE.LatheGeometry(pts, seg || 10); g.center(); return g;
  };

  // Curved emissive blade: a tapered extruded crescent.
  P.bladeGeo = function (len, w) {
    len = len || 1.4; w = w || 0.22;
    var s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(w, len * 0.5, 0.04, len);
    s.quadraticCurveTo(-w * 0.4, len * 0.5, -w * 0.5, 0);
    var g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
    g.center(); return g;
  };

  // Convenience: build a posable joint group at a position.
  P.joint = function (x, y, z) { var j = new THREE.Group(); j.position.set(x || 0, y || 0, z || 0); return j; };
})(typeof window !== 'undefined' ? window : globalThis);
