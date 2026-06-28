/* lowpoly-character-forge — build-character.js
 * Composes parts + materials into posed chibi characters with FLOATING HANDS
 * (Thronefall/Clash aesthetic — no connecting arms). buildElf: blue-violet skin,
 * white+gold crest, branch antlers, long ears, green leaf-gem pauldrons. buildOrc:
 * green skin, heavy brow, white tusks, hunched. Both take a `role`
 * (worker/warrior/lancer/archer/caster/hero) that swaps the weapon. Named params
 * so the critique loop converges one knob at a time. window.LPF.build*. */
(function (root) {
  var THREE = root.THREE;
  var LPF = root.LPF = root.LPF || {};
  var P = LPF.parts;

  function facetMesh(geo, mat) { return new THREE.Mesh(LPF.facet(geo), mat); }
  function smoothMesh(geo, mat) { return new THREE.Mesh(LPF.smooth(geo), mat); }
  function at(m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); return m; }   // position is read-only — use .set
  // Floating hand: a slightly flattened rounded mitt, no arm. The Thronefall look.
  function floatingHand(mat, r) { var m = smoothMesh(new THREE.SphereGeometry(r || 0.17, 10, 8), mat); m.scale.set(1, 0.85, 1.1); return m; }

  // Branching antler (one side): a beam that sweeps up+out with two forward tines.
  // Reads as a deer/druid antler, not a radial spike burst. Built nose-to-tip so
  // each segment continues the previous one's direction.
  function antler(mat, side) {
    var g = new THREE.Group();
    var beam1 = facetMesh(new THREE.CylinderGeometry(0.045, 0.06, 0.4, 5), mat); at(beam1, side * 0.06, 0.2, 0); beam1.rotation.z = side * 0.45; g.add(beam1);
    var beam2 = facetMesh(new THREE.CylinderGeometry(0.03, 0.045, 0.4, 5), mat); at(beam2, side * 0.26, 0.5, 0); beam2.rotation.z = side * 0.85; g.add(beam2);
    var beam3 = facetMesh(new THREE.CylinderGeometry(0.02, 0.032, 0.3, 5), mat); at(beam3, side * 0.5, 0.66, 0); beam3.rotation.z = side * 1.2; g.add(beam3);
    var tine1 = facetMesh(new THREE.CylinderGeometry(0.018, 0.035, 0.28, 5), mat); at(tine1, side * 0.16, 0.42, 0.08); tine1.rotation.x = -0.5; tine1.rotation.z = side * 0.1; g.add(tine1);
    var tine2 = facetMesh(new THREE.CylinderGeometry(0.016, 0.03, 0.24, 5), mat); at(tine2, side * 0.34, 0.62, 0.06); tine2.rotation.x = -0.5; tine2.rotation.z = side * 0.4; g.add(tine2);
    return g;
  }

  // Shared head: skin sphere + green eyes + ears (+ optional heavy brow).
  function buildHead(g, opt) {
    var skin = opt.skin, headY = opt.headY, hs = opt.headScale, headR = 0.5 * hs;
    var head = smoothMesh(P.headGeo(headR, opt.taper == null ? 0.18 : opt.taper), skin);
    head.position.y = headY; head.scale.z = 0.92; g.add(head);
    var eyeM = LPF.toon(opt.eye || 0x6fe06a, { ramp: LPF.RAMP.metal, emissive: opt.eye || 0x6fe06a, emissiveIntensity: 0.18, rim: false });
    [-1, 1].forEach(function (s) {
      var e = new THREE.Mesh(new THREE.SphereGeometry(0.085 * hs, 8, 6), eyeM);
      e.position.set(0.17 * hs * s, headY + 0.02, headR * 0.88); g.add(e);
    });
    if (opt.brow) { var brow = smoothMesh(new THREE.BoxGeometry(0.72 * hs, 0.17, 0.22), skin); brow.position.set(0, headY + 0.17, headR * 0.78); g.add(brow); }
    [-1, 1].forEach(function (s) {
      var ear = smoothMesh(P.extrude(P.pointedShape(opt.earLen, 0.16), 0.08), skin);
      ear.position.set(headR * 0.85 * s, headY + 0.04, -0.05);
      ear.rotation.z = -s * (opt.earDroop == null ? 0.9 : opt.earDroop); ear.rotation.y = s * 0.3; g.add(ear);
    });
    return headR;
  }

  // weapon held in the RIGHT floating hand (returns a Group, posed by caller).
  // mats: { accent, gem, blade, steel, wood }
  function gemGlaive(m, len) { var g = new THREE.Group(); var shaft = smoothMesh(P.limbGeo(0.05, len || 1.6), m.accent); g.add(shaft);
    var b = facetMesh(P.crystalGeo(0.32, 2.0), m.blade); at(b, 0, (len || 1.6) * 0.5 + 0.45, 0); g.add(b); g.userData.glow = [b]; return g; }
  function gemStaff(m) { var g = new THREE.Group(); var shaft = smoothMesh(P.limbGeo(0.05, 1.7), m.wood || m.accent); g.add(shaft);
    var ring = facetMesh(new THREE.TorusGeometry(0.16, 0.04, 6, 5), m.accent); at(ring, 0, 1.0, 0); g.add(ring);
    var orb = facetMesh(P.crystalGeo(0.2, 1.3), m.gem); at(orb, 0, 1.0, 0); g.add(orb); g.userData.glow = [orb]; return g; }
  function tool(m) { var g = new THREE.Group(); var h = smoothMesh(P.limbGeo(0.04, 1.0), m.wood || m.accent); g.add(h);
    var head = facetMesh(P.crystalGeo(0.16, 1.2), m.gem); at(head, 0.0, 0.55, 0.06); head.rotation.z = 1.2; g.add(head); g.userData.glow = [head]; return g; }
  function bow(m) { var g = new THREE.Group();
    var arc = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 6, 14, Math.PI * 1.1), m.wood || m.accent); arc.rotation.z = -Math.PI / 2; g.add(arc);
    g.add(at(smoothMesh(new THREE.BoxGeometry(0.015, 1.15, 0.015), m.string || m.accent), 0, 0, 0)); return g; }
  function bigAxe(m) { var g = new THREE.Group(); var haft = smoothMesh(P.limbGeo(0.06, 1.8), m.wood || m.accent); g.add(haft);
    var hb = facetMesh(new THREE.BoxGeometry(0.16, 0.72, 0.7), m.steel); at(hb, 0, 0.95, 0.28); g.add(hb);
    var edge = facetMesh(new THREE.CylinderGeometry(0.0, 0.46, 0.52, 3), m.steel); edge.rotation.z = Math.PI / 2; at(edge, 0, 0.95, 0.52); g.add(edge); return g; }

  function placeWeapon(g, role, m, opts) {
    opts = opts || {};
    var hands = { right: null, left: null };
    if (role === 'archer') { hands.left = bow(m); hands.left.rotation.y = 0.2; }
    else if (role === 'caster') { hands.right = gemStaff(m); }
    else if (role === 'worker') { hands.right = tool(m); }
    else if (role === 'hero') { hands.right = opts.heroWeapon ? opts.heroWeapon(m) : gemGlaive(m, 1.9); }
    else { hands.right = opts.meleeWeapon ? opts.meleeWeapon(m) : gemGlaive(m, role === 'lancer' ? 2.0 : 1.6); }
    return hands;
  }

  function finish(g) {
    var box = new THREE.Box3().setFromObject(g); var c = new THREE.Vector3(); box.getCenter(c);
    g.position.x -= c.x; g.position.z -= c.z; g.position.y -= box.min.y;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  var ELF = {
    palette: { skin: 0x564a98, cloth: 0x163433, accent: 0xf2c14e, gem: 0x57c23a, blade: 0x8fe66a,
      hair: 0xede8da, hairTip: 0xf2c14e, eye: 0x76e85a, sash: 0xa84768, antler: 0x6e4a2a, wood: 0x7a5a38 },
    headScale: 1.2, earLen: 0.85, torsoH: 1.25, limbLen: 0.9, outline: 0.028,
  };
  LPF.buildElf = function (params) {
    var p = Object.assign({}, ELF, params || {});
    var role = (params && params.role) || 'warrior';
    var pal = Object.assign({}, ELF.palette, (params && params.palette) || {});
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimColor: 0xbfa0ff, rimStrength: 0.2 });
    var cloth = LPF.toon(pal.cloth, { ramp: LPF.RAMP.cloth });
    var accent = LPF.toon(pal.accent, { ramp: LPF.RAMP.metal });
    var hair = LPF.toon(pal.hair, { ramp: LPF.RAMP.cloth });
    var hairTip = LPF.toon(pal.hairTip, { ramp: LPF.RAMP.cloth });
    var sashM = LPF.toon(pal.sash, { ramp: LPF.RAMP.cloth });
    var antlerM = LPF.toon(pal.antler, { ramp: LPF.RAMP.cloth });
    var gem = LPF.toon(pal.gem, { ramp: LPF.RAMP.metal, emissive: pal.gem, emissiveIntensity: 0.3, rim: false });
    var blade = LPF.toon(pal.blade, { ramp: LPF.RAMP.metal, emissive: pal.blade, emissiveIntensity: 1.4, rim: false });
    var g = new THREE.Group(); var glow = [];

    [-1, 1].forEach(function (s) {
      g.add(at(smoothMesh(P.limbGeo(0.16, p.limbLen), cloth), 0.17 * s, p.limbLen * 0.5, 0));
      g.add(at(smoothMesh(P.limbGeo(0.17, 0.22), accent), 0.17 * s, 0.12, 0.04));
    });
    g.add(at(smoothMesh(P.torsoGeo(0.4, 0.58, p.torsoH), cloth), 0, p.limbLen + p.torsoH * 0.5, 0));
    g.add(at(smoothMesh(P.torsoGeo(0.46, 0.46, 0.34), sashM), 0, p.limbLen + p.torsoH * 0.62, 0));
    g.add(at(smoothMesh(P.torsoGeo(0.5, 0.5, 0.14), accent), 0, p.limbLen + p.torsoH * 0.2, 0));

    var shoulderY = p.limbLen + p.torsoH;
    [-1, 1].forEach(function (s) { var pg = facetMesh(P.leafGemGeo(0.7, 0.9), gem); at(pg, 0.5 * s, shoulderY - 0.06, 0); pg.rotation.z = -s * 0.5; g.add(pg); glow.push(pg); });

    var headY = shoulderY + 0.5 * p.headScale;
    var headR = buildHead(g, { skin: skin, headY: headY, headScale: p.headScale, earLen: p.earLen, eye: pal.eye });
    var hairBack = smoothMesh(P.headGeo(0.54 * p.headScale, 0.12), hair); at(hairBack, 0, headY + 0.06, -0.12); hairBack.scale.set(1.04, 1.1, 0.9); g.add(hairBack);
    // brown branch antlers sweeping up/out from the sides of the head
    [-1, 1].forEach(function (s) { var a = antler(antlerM, s); at(a, headR * 0.55 * s, headY + 0.3, -0.04); g.add(a); });
    // small gold hair tuft between them (not a spike burst)
    g.add(at(facetMesh(new THREE.ConeGeometry(0.1, 0.28, 5), hairTip), 0, headY + 0.52 * p.headScale, -0.02));

    // floating hands + role weapon
    var mats = { accent: accent, gem: gem, blade: blade, wood: LPF.toon(pal.wood, { ramp: LPF.RAMP.cloth }), string: hair };
    var hands = placeWeapon(g, role, mats, {});
    var handY = p.limbLen + p.torsoH * 0.22;   // low at the sides (Among Us)
    var rH = at(floatingHand(skin, 0.16), 0.52, handY, 0.16);
    var lH = at(floatingHand(skin, 0.16), -0.52, handY, 0.16);
    if (hands.right) { hands.right.position.copy(rH.position); hands.right.rotation.z = -0.35; g.add(hands.right); (hands.right.userData.glow || []).forEach(function (x) { glow.push(x); }); }
    if (hands.left) { hands.left.position.copy(lH.position); g.add(hands.left); }
    g.add(rH); g.add(lH);

    g.userData.emissiveMeshes = glow;
    if (p.outline) LPF.outlineGroup(g, p.outline, 0x1a1226);
    return finish(g);
  };

  var ORC = {
    palette: { skin: 0x5f8a2e, cloth: 0x5a3a22, accent: 0x8a6a3a, bone: 0xe2dcc0, blade: 0xb9c2cc,
      eye: 0xe8c33a, hair: 0x1c160f, sash: 0x9c3f2c, wood: 0x4e351d },
    headScale: 1.25, earLen: 0.4, earDroop: 1.3, torsoH: 1.3, limbLen: 0.78, outline: 0.03, hunch: 0.26,
  };
  LPF.buildOrc = function (params) {
    var p = Object.assign({}, ORC, params || {});
    var role = (params && params.role) || 'warrior';
    var pal = Object.assign({}, ORC.palette, (params && params.palette) || {});
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimColor: 0xc9e08a, rimStrength: 0.2 });
    var cloth = LPF.toon(pal.cloth, { ramp: LPF.RAMP.cloth });
    var accent = LPF.toon(pal.accent, { ramp: LPF.RAMP.metal });
    var bone = LPF.toon(pal.bone, { ramp: LPF.RAMP.cloth });
    var sashM = LPF.toon(pal.sash, { ramp: LPF.RAMP.cloth });
    var steel = LPF.toon(pal.blade, { ramp: LPF.RAMP.metal });
    var hair = LPF.toon(pal.hair, { ramp: LPF.RAMP.cloth });
    var g = new THREE.Group(); var bw = 1.35;

    [-1, 1].forEach(function (s) {
      g.add(at(smoothMesh(P.limbGeo(0.22, p.limbLen), skin), 0.24 * s, p.limbLen * 0.5, 0));
      g.add(at(smoothMesh(P.torsoGeo(0.26, 0.3, 0.4), cloth), 0.24 * s, p.limbLen * 0.78, 0));
    });
    var torsoPivot = P.joint(0, p.limbLen, 0); torsoPivot.rotation.x = p.hunch; g.add(torsoPivot);
    torsoPivot.add(at(smoothMesh(P.torsoGeo(0.6 * bw, 0.5 * bw, p.torsoH), skin), 0, p.torsoH * 0.5, 0));
    var sash = at(smoothMesh(P.torsoGeo(0.18, 0.18, p.torsoH * 1.1), sashM), 0.1, p.torsoH * 0.5, 0.34); sash.rotation.z = 0.3; torsoPivot.add(sash);

    var shoulderY = p.torsoH;
    [-1, 1].forEach(function (s) {
      var pd = smoothMesh(new THREE.SphereGeometry(0.34, 10, 8), accent); pd.scale.y = 0.7; at(pd, 0.62 * bw * 0.5 * s + 0.3 * s, shoulderY + 0.05, 0); torsoPivot.add(pd);
      [0, 1, 2].forEach(function (i) { var sp = facetMesh(P.tuskGeo(0.07, 0.3), bone); at(sp, (0.5 * s) + (i - 1) * 0.12 * s, shoulderY + 0.2, 0); sp.rotation.z = (i - 1) * 0.3; torsoPivot.add(sp); });
    });

    var headY = shoulderY + 0.5 * p.headScale;
    var headR = buildHead(torsoPivot, { skin: skin, headY: headY, headScale: p.headScale, earLen: p.earLen, earDroop: p.earDroop, eye: pal.eye, brow: true, taper: 0.05 });
    torsoPivot.add(at(smoothMesh(new THREE.BoxGeometry(0.52 * p.headScale, 0.3, 0.42), skin), 0, headY - 0.28, 0.3));
    // dark mouth — the tusks emerge from here, not from thin air
    var mouthM = LPF.toon(0x3a1410, { ramp: LPF.RAMP.cloth, rim: false });
    torsoPivot.add(at(smoothMesh(new THREE.BoxGeometry(0.34 * p.headScale, 0.14, 0.12), mouthM), 0, headY - 0.24, 0.47));
    // tusks rooted in the jaw/mouth (base embedded), jutting up past the lip
    [-1, 1].forEach(function (s) { var tk = facetMesh(P.tuskGeo(0.13, 0.68), bone); at(tk, 0.16 * s, headY - 0.0, 0.45); tk.rotation.x = -0.1; tk.rotation.z = -s * 0.16; torsoPivot.add(tk); });
    torsoPivot.add(at(smoothMesh(new THREE.SphereGeometry(0.16, 8, 6), hair), 0, headY + 0.5 * p.headScale, -0.05));

    // floating hands + role weapon
    var mats = { accent: accent, gem: bone, blade: steel, steel: steel, wood: LPF.toon(pal.wood, { ramp: LPF.RAMP.cloth }) };
    var hands = placeWeapon(g, role, mats, { meleeWeapon: bigAxe, heroWeapon: bigAxe });
    var handY = p.torsoH * 0.22;   // low at the sides (Among Us)
    var rH = at(floatingHand(skin, 0.2), 0.66 * bw, handY, 0.2);
    var lH = at(floatingHand(skin, 0.2), -0.66 * bw, handY, 0.2);
    if (hands.right) { hands.right.position.copy(rH.position); hands.right.rotation.z = -0.4; torsoPivot.add(hands.right); }
    if (hands.left) { hands.left.position.copy(lH.position); torsoPivot.add(hands.left); }
    torsoPivot.add(rH); torsoPivot.add(lH);

    g.userData.emissiveMeshes = [];
    if (p.outline) LPF.outlineGroup(g, p.outline, 0x141008);
    return finish(g);
  };

  LPF.buildCharacter = function (name, params) {
    if (name === 'orc') return LPF.buildOrc(params);
    return LPF.buildElf(params);
  };
})(typeof window !== 'undefined' ? window : globalThis);
