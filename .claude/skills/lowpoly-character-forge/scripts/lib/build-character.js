/* lowpoly-character-forge — build-character.js
 * Composes parts + materials into posed chibi characters. buildElf targets the
 * night-elf reference (blue-violet skin, white+gold hair, GREEN faceted leaf-gem
 * pauldrons, gold cuffs, green eyes, long pointed ears, gem blade). buildOrc:
 * green skin, tusks, heavy brow, hunched, big axe. Every value is a named param so
 * the critique loop converges one knob at a time. window.LPF.build*. */
(function (root) {
  var THREE = root.THREE;
  var LPF = root.LPF = root.LPF || {};
  var P = LPF.parts;

  function facetMesh(geo, mat) { return new THREE.Mesh(LPF.facet(geo), mat); }
  function smoothMesh(geo, mat) { return new THREE.Mesh(LPF.smooth(geo), mat); }
  function at(m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); return m; }  // position is read-only — use .set

  // shared head builder: skin sphere + (optional) brow + eyes + ears
  function buildHead(g, opt) {
    var skin = opt.skin, headY = opt.headY, hs = opt.headScale, headR = 0.5 * hs;
    var head = smoothMesh(P.headGeo(headR, opt.taper == null ? 0.18 : opt.taper), skin);
    head.position.y = headY; head.scale.z = 0.92; g.add(head);
    // green eyes
    var eyeM = LPF.toon(opt.eye || 0x6fe06a, { ramp: LPF.RAMP.metal, emissive: opt.eye || 0x6fe06a, emissiveIntensity: 0.18, rim: false });
    [-1, 1].forEach(function (s) {
      var e = new THREE.Mesh(new THREE.SphereGeometry(0.08 * hs, 8, 6), eyeM);
      e.position.set(0.16 * hs * s, headY + 0.03, headR * 0.86); g.add(e);
    });
    if (opt.brow) { // heavy orc brow
      var brow = smoothMesh(new THREE.BoxGeometry(0.7 * hs, 0.16, 0.2), skin);
      brow.position.set(0, headY + 0.16, headR * 0.78); g.add(brow);
    }
    // ears
    [-1, 1].forEach(function (s) {
      var ear = smoothMesh(P.extrude(P.pointedShape(opt.earLen, 0.16), 0.08), skin);
      ear.position.set(headR * 0.85 * s, headY + 0.04, -0.05);
      ear.rotation.z = -s * (opt.earDroop == null ? 0.9 : opt.earDroop); ear.rotation.y = s * 0.3; g.add(ear);
    });
    return head;
  }

  var ELF = {
    palette: { skin: 0x6356a8, cloth: 0x244a4a, accent: 0xf2c14e, gem: 0x57c23a, blade: 0x8fe66a,
      hair: 0xede8da, hairTip: 0xf2c14e, eye: 0x76e85a, sash: 0xcf5c86 },
    headScale: 1.2, earLen: 0.85, torsoH: 1.25, limbLen: 0.9, outline: 0.028, stance: 0.5,
  };

  LPF.buildElf = function (params) {
    var p = Object.assign({}, ELF, params || {});
    var pal = Object.assign({}, ELF.palette, (params && params.palette) || {});
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimColor: 0xbfa0ff });
    var cloth = LPF.toon(pal.cloth, { ramp: LPF.RAMP.cloth });
    var accent = LPF.toon(pal.accent, { ramp: LPF.RAMP.metal });
    var hair = LPF.toon(pal.hair, { ramp: LPF.RAMP.cloth });
    var hairTip = LPF.toon(pal.hairTip, { ramp: LPF.RAMP.cloth });
    var sashM = LPF.toon(pal.sash, { ramp: LPF.RAMP.cloth });
    var gem = LPF.toon(pal.gem, { ramp: LPF.RAMP.metal, emissive: pal.gem, emissiveIntensity: 0.3, rim: false });
    var blade = LPF.toon(pal.blade, { ramp: LPF.RAMP.metal, emissive: pal.blade, emissiveIntensity: 1.4, rim: false });
    var g = new THREE.Group();
    var emissives = [];

    // legs + boots
    [-1, 1].forEach(function (s) {
      g.add(at(smoothMesh(P.limbGeo(0.16, p.limbLen), cloth), 0.17 * s, p.limbLen * 0.5, 0));
      var boot = smoothMesh(P.limbGeo(0.17, 0.22), accent); boot.position.set(0.17 * s, 0.12, 0.04); g.add(boot);
    });
    // torso + pink sash + gold belt
    var torso = smoothMesh(P.torsoGeo(0.4, 0.58, p.torsoH), cloth);
    torso.position.y = p.limbLen + p.torsoH * 0.5; g.add(torso);
    var sash = smoothMesh(P.torsoGeo(0.46, 0.46, 0.34), sashM); sash.position.y = p.limbLen + p.torsoH * 0.62; g.add(sash);
    var belt = smoothMesh(P.torsoGeo(0.5, 0.5, 0.14), accent); belt.position.y = p.limbLen + p.torsoH * 0.2; g.add(belt);

    var shoulderY = p.limbLen + p.torsoH;
    // GREEN faceted leaf-gem pauldrons (the signature accent)
    [-1, 1].forEach(function (s) {
      var pg = facetMesh(P.leafGemGeo(0.7, 0.9), gem);
      pg.position.set(0.5 * s, shoulderY - 0.06, 0); pg.rotation.z = -s * 0.5; g.add(pg); emissives.push(pg);
    });

    // head + white/gold hair
    var headY = shoulderY + 0.5 * p.headScale;
    buildHead(g, { skin: skin, headY: headY, headScale: p.headScale, earLen: p.earLen, eye: pal.eye });
    var hairBack = smoothMesh(P.headGeo(0.54 * p.headScale, 0.12), hair);
    hairBack.position.set(0, headY + 0.06, -0.12); hairBack.scale.set(1.04, 1.1, 0.9); g.add(hairBack);
    // swept-up gold-tipped crest (3 cones)
    [-0.22, 0, 0.22].forEach(function (o, i) {
      var spike = facetMesh(new THREE.ConeGeometry(0.1, 0.5 + (i === 1 ? 0.2 : 0), 4), hairTip);
      spike.position.set(o, headY + 0.5 * p.headScale, -0.05); spike.rotation.x = -0.3; g.add(spike);
    });

    // arms + gold cuffs (right raised)
    var armL = smoothMesh(P.limbGeo(0.13, p.limbLen * 0.9), skin);
    armL.position.set(-0.46, shoulderY - 0.32, 0); armL.rotation.z = 0.35; g.add(armL);
    g.add(at(smoothMesh(P.limbGeo(0.15, 0.18), accent), -0.54, shoulderY - 0.66, 0));
    var armR = P.joint(0.46, shoulderY - 0.12, 0);
    armR.add(at(smoothMesh(P.limbGeo(0.13, p.limbLen * 0.9), skin), 0, -p.limbLen * 0.45, 0));
    armR.add(at(smoothMesh(P.limbGeo(0.15, 0.18), accent), 0, -p.limbLen * 0.8, 0));
    armR.rotation.z = -1.0 * p.stance - 0.5; g.add(armR);

    // gem glaive in the raised hand: shaft + green crystal blade
    var shaft = smoothMesh(P.limbGeo(0.05, 1.6), accent); shaft.position.y = -p.limbLen * 0.9; armR.add(shaft);
    var gemBlade = facetMesh(P.crystalGeo(0.34, 2.0), blade);
    gemBlade.position.y = -p.limbLen * 0.9 + 0.95; armR.add(gemBlade); emissives.push(gemBlade);

    g.userData.emissiveMeshes = emissives;
    if (p.outline) LPF.outlineGroup(g, p.outline, 0x1a1226);
    var box = new THREE.Box3().setFromObject(g); var c = new THREE.Vector3(); box.getCenter(c);
    g.position.x -= c.x; g.position.z -= c.z; g.position.y -= box.min.y;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  var ORC = {
    palette: { skin: 0x5f8a2e, skinD: 0x55772f, cloth: 0x5a3a22, accent: 0x8a6a3a, bone: 0xe2dcc0,
      blade: 0xb9c2cc, eye: 0xe8c33a, hair: 0x1c160f, sash: 0x9c3f2c },
    headScale: 1.25, earLen: 0.4, earDroop: 1.3, torsoH: 1.3, limbLen: 0.78, outline: 0.03, stance: 0.55, hunch: 0.28,
  };

  LPF.buildOrc = function (params) {
    var p = Object.assign({}, ORC, params || {});
    var pal = Object.assign({}, ORC.palette, (params && params.palette) || {});
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimColor: 0xc9e08a });
    var cloth = LPF.toon(pal.cloth, { ramp: LPF.RAMP.cloth });
    var accent = LPF.toon(pal.accent, { ramp: LPF.RAMP.metal });
    var bone = LPF.toon(pal.bone, { ramp: LPF.RAMP.cloth });
    var sashM = LPF.toon(pal.sash, { ramp: LPF.RAMP.cloth });
    var steel = LPF.toon(pal.blade, { ramp: LPF.RAMP.metal });
    var hair = LPF.toon(pal.hair, { ramp: LPF.RAMP.cloth });
    var g = new THREE.Group();

    var bw = 1.35; // broad build
    [-1, 1].forEach(function (s) {
      var leg = smoothMesh(P.limbGeo(0.22, p.limbLen), skin); leg.position.set(0.24 * s, p.limbLen * 0.5, 0); g.add(leg);
      var lc = smoothMesh(P.torsoGeo(0.26, 0.3, 0.4), cloth); lc.position.set(0.24 * s, p.limbLen * 0.78, 0); g.add(lc);
    });
    // barrel torso (hunched fwd)
    var torsoPivot = P.joint(0, p.limbLen, 0); torsoPivot.rotation.x = p.hunch; g.add(torsoPivot);
    var torso = smoothMesh(P.torsoGeo(0.6 * bw, 0.5 * bw, p.torsoH), skin); torso.position.y = p.torsoH * 0.5; torsoPivot.add(torso);
    var sash = smoothMesh(P.torsoGeo(0.18, 0.18, p.torsoH * 1.1), sashM); sash.position.set(0.1, p.torsoH * 0.5, 0.34); sash.rotation.z = 0.3; torsoPivot.add(sash);

    var shoulderY = p.torsoH;
    // bone-spike pauldrons
    [-1, 1].forEach(function (s) {
      var pd = smoothMesh(new THREE.SphereGeometry(0.34, 10, 8), accent); pd.scale.y = 0.7; pd.position.set(0.62 * bw * 0.5 * s + 0.3 * s, shoulderY + 0.05, 0); torsoPivot.add(pd);
      [0, 1, 2].forEach(function (i) { var sp = facetMesh(P.tuskGeo(0.07, 0.3), bone); sp.position.set((0.5 * s) + (i - 1) * 0.12 * s, shoulderY + 0.2, 0); sp.rotation.z = (i - 1) * 0.3; torsoPivot.add(sp); });
    });

    // head: green, heavy brow, tusks, top-knot
    var headY = shoulderY + 0.5 * p.headScale;
    buildHead(torsoPivot, { skin: skin, headY: headY, headScale: p.headScale, earLen: p.earLen, earDroop: p.earDroop, eye: pal.eye, brow: true, taper: 0.05 });
    // jaw + upward tusks
    var jaw = smoothMesh(new THREE.BoxGeometry(0.5 * p.headScale, 0.26, 0.4), skin); jaw.position.set(0, headY - 0.28, 0.3); torsoPivot.add(jaw);
    [-1, 1].forEach(function (s) { var tk = facetMesh(P.tuskGeo(0.1, 0.55), bone); tk.position.set(0.2 * s, headY - 0.2, 0.52); tk.rotation.x = -0.15; tk.rotation.z = -s * 0.22; torsoPivot.add(tk); });
    // black top-knot
    var knot = smoothMesh(new THREE.SphereGeometry(0.16, 8, 6), hair); knot.position.set(0, headY + 0.5 * p.headScale, -0.05); torsoPivot.add(knot);

    // arms (thick), right holds a big axe
    var armL = smoothMesh(P.limbGeo(0.2, p.limbLen), skin); armL.position.set(-0.62 * bw, shoulderY - 0.2, 0); armL.rotation.z = 0.4; torsoPivot.add(armL);
    var armR = P.joint(0.62 * bw, shoulderY, 0);
    armR.add(at(smoothMesh(P.limbGeo(0.2, p.limbLen), skin), 0, -p.limbLen * 0.5, 0));
    armR.rotation.z = -0.5; armR.rotation.x = -0.3; torsoPivot.add(armR);
    // axe: haft + steel head
    var haft = smoothMesh(P.limbGeo(0.06, 1.7), accent); haft.position.y = -p.limbLen * 0.7; armR.add(haft);
    var head2 = facetMesh(new THREE.BoxGeometry(0.16, 0.7, 0.7), steel); head2.position.set(0, -p.limbLen * 0.7 + 0.7, 0.28); armR.add(head2);
    var head3 = facetMesh(new THREE.CylinderGeometry(0.0, 0.45, 0.5, 3), steel); head3.rotation.z = Math.PI / 2; head3.position.set(0, -p.limbLen * 0.7 + 0.7, 0.5); armR.add(head3);

    g.userData.emissiveMeshes = [];
    if (p.outline) LPF.outlineGroup(g, p.outline, 0x141008);
    var box = new THREE.Box3().setFromObject(g); var c = new THREE.Vector3(); box.getCenter(c);
    g.position.x -= c.x; g.position.z -= c.z; g.position.y -= box.min.y;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  LPF.buildCharacter = function (name, params) {
    if (name === 'orc') return LPF.buildOrc(params);
    return LPF.buildElf(params);
  };
})(typeof window !== 'undefined' ? window : globalThis);
