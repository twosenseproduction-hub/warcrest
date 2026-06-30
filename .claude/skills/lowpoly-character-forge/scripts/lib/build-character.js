/* lowpoly-character-forge — build-character.js
 * Composes parts + materials into posed chibi characters with FLOATING HANDS
 * (Thronefall/Among-Us). Each role gets distinct gear + an exaggerated weapon so
 * the roster reads at a glance. Races: elf (violet, antlers, leaf-gems), orc
 * (green, tusks, hunched) with a TROLL archer variant (teal, lanky, spears).
 * window.LPF.build*. */
(function (root) {
  var THREE = root.THREE;
  var LPF = root.LPF = root.LPF || {};
  var P = LPF.parts;

  function facetMesh(geo, mat) { return new THREE.Mesh(LPF.facet(geo), mat); }
  function smoothMesh(geo, mat) { return new THREE.Mesh(LPF.smooth(geo), mat); }
  function at(m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); return m; }
  function floatingHand(mat, r) { var m = smoothMesh(new THREE.SphereGeometry(r || 0.17, 10, 8), mat); m.scale.set(1, 0.85, 1.1); return m; }

  /* ---- exaggerated weapons (returns Group; userData.glow = emissive parts) ---- */
  function gemGlaive(m, len) { len = len || 1.9; var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.06, len), m.accent));
    var b = facetMesh(P.crystalGeo(0.5, 2.3), m.blade); at(b, 0, len * 0.5 + 0.55, 0); g.add(b); g.userData.glow = [b]; return g; }
  function gemStaff(m) { var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.06, 2.0), m.wood || m.accent));
    var ring = facetMesh(new THREE.TorusGeometry(0.26, 0.06, 6, 6), m.accent); at(ring, 0, 1.1, 0); g.add(ring);
    var orb = facetMesh(P.crystalGeo(0.34, 1.3), m.gem); at(orb, 0, 1.12, 0); g.add(orb); g.userData.glow = [orb]; return g; }
  function gemTool(m) { var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.055, 1.2), m.wood || m.accent));
    var head = facetMesh(P.crystalGeo(0.26, 1.1), m.gem); at(head, 0, 0.66, 0.06); head.rotation.z = 1.15; g.add(head); g.userData.glow = [head]; return g; }
  function pick(m) { var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.055, 1.2), m.wood || m.accent));
    var head = facetMesh(new THREE.ConeGeometry(0.16, 0.82, 4), m.steel); at(head, 0, 0.66, 0); head.rotation.z = Math.PI / 2; g.add(head); return g; }
  function bow(m) { var g = new THREE.Group();
    var arc = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 6, 16, Math.PI * 1.05), m.wood || m.accent); arc.rotation.z = -Math.PI / 2; g.add(arc);
    g.add(at(smoothMesh(new THREE.BoxGeometry(0.02, 1.6, 0.02), m.string || m.accent), 0, 0, 0)); return g; }
  function bigAxe(m, sc) { sc = sc || 1; var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.075, 2.0), m.wood || m.accent));
    var hb = facetMesh(new THREE.BoxGeometry(0.2, 0.95 * sc, 0.92 * sc), m.steel); at(hb, 0, 1.05, 0.36 * sc); g.add(hb);
    var edge = facetMesh(new THREE.CylinderGeometry(0.0, 0.62 * sc, 0.7 * sc, 3), m.steel); edge.rotation.z = Math.PI / 2; at(edge, 0, 1.05, 0.66 * sc); g.add(edge); return g; }
  function spear(m, len, headMat) { len = len || 2.5; var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.055, len), m.wood || m.accent));
    var sh = facetMesh(new THREE.ConeGeometry(0.16, 0.7, 4), headMat || m.steel); at(sh, 0, len * 0.5 + 0.3, 0); g.add(sh);
    var bind = smoothMesh(new THREE.TorusGeometry(0.09, 0.035, 5, 6), m.sash || m.accent); bind.rotation.x = Math.PI / 2; at(bind, 0, len * 0.5 - 0.05, 0); g.add(bind);
    if (headMat && headMat.userData && headMat.userData.glow) g.userData.glow = [sh]; return g; }
  // Sentinel moon-polearm: pole + a large curved crescent blade (melee).
  function moonPolearm(m) { var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.055, 2.0), m.wood || m.accent));
    var cr = new THREE.Mesh(LPF.facet(new THREE.TorusGeometry(0.46, 0.08, 5, 14, Math.PI * 1.15)), m.blade); at(cr, 0, 1.25, 0); cr.rotation.z = -0.5; g.add(cr);
    g.userData.glow = [cr]; return g; }
  // Glaive-thrower disc: double-crescent throwing glaive held flat in hand (ranged).
  function throwGlaive(m) { var g = new THREE.Group(); var glow = [];
    g.add(facetMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 6), m.accent));
    [0.25, Math.PI + 0.25].forEach(function (rot) { var bl = new THREE.Mesh(LPF.facet(new THREE.TorusGeometry(0.44, 0.07, 5, 12, Math.PI * 0.8)), m.blade); bl.rotation.z = rot; g.add(bl); glow.push(bl); });
    g.userData.glow = glow; return g; }
  // Druid staff: gnarled wood + a glowing leaf-gem cluster.
  function druidStaff(m) { var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.06, 2.0), m.wood || m.accent));
    var orb = facetMesh(P.crystalGeo(0.24, 1.2), m.gem); at(orb, 0, 1.05, 0); g.add(orb);
    [-1, 1].forEach(function (s) { var lf = facetMesh(P.leafGemGeo(0.46, 0.7), m.gem); at(lf, 0.2 * s, 0.92, 0); lf.rotation.z = -s * 0.7; g.add(lf); });
    g.userData.glow = [orb]; return g; }
  // Witch-doctor totem staff: skull + jaw + feathers.
  function witchStaff(m) { var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.06, 2.0), m.wood || m.accent));
    var skull = facetMesh(new THREE.SphereGeometry(0.2, 8, 6), m.bone); at(skull, 0, 1.08, 0); skull.scale.set(1, 1.1, 0.9); g.add(skull);
    g.add(at(facetMesh(new THREE.BoxGeometry(0.2, 0.1, 0.16), m.bone), 0, 0.95, 0.04));
    [-1, 1].forEach(function (s) { g.add(at(facetMesh(new THREE.SphereGeometry(0.05, 5, 4), m.eye), 0.07 * s, 1.12, 0.16)); });
    [-1, 0, 1].forEach(function (o) { var f = facetMesh(new THREE.ConeGeometry(0.05, 0.45, 4), o === 0 ? m.sash : m.feather); at(f, 0.1 * o, 0.86, -0.05); f.rotation.z = o * 0.4; f.rotation.x = -0.3; g.add(f); }); return g; }

  // ---- human arms ----
  function sword(m, len) { len = len || 1.7; var g = new THREE.Group();
    g.add(at(facetMesh(new THREE.BoxGeometry(0.12, len, 0.05), m.steel), 0, len * 0.5 + 0.2, 0));
    g.add(at(smoothMesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), m.accent), 0, 0.2, 0));       // crossguard
    g.add(smoothMesh(P.limbGeo(0.05, 0.3), m.wood || m.accent));                               // grip
    g.add(at(facetMesh(new THREE.SphereGeometry(0.09, 6, 5), m.accent), 0, -0.16, 0)); return g; }
  function warhammer(m) { var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.06, 2.0), m.wood || m.accent));
    g.add(at(facetMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), m.steel), 0, 1.05, 0));
    g.add(at(facetMesh(new THREE.BoxGeometry(0.16, 0.42, 0.42), m.accent), 0, 1.05, 0.34));
    g.add(at(facetMesh(new THREE.ConeGeometry(0.1, 0.3, 4), m.accent), 0, 1.4, 0)); return g; }
  function crossbow(m) { var g = new THREE.Group();
    g.add(at(smoothMesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), m.wood || m.accent), 0, 0.1, 0));   // stock
    g.add(at(facetMesh(new THREE.BoxGeometry(1.05, 0.08, 0.1), m.steel), 0, 0.45, 0.06));        // limbs
    g.add(at(smoothMesh(new THREE.BoxGeometry(0.02, 0.02, 0.6), m.steel), 0, 0.45, 0.3)); return g; }
  // Rifleman DOUBLE-BARREL musket: two steel barrels + wooden stock + muzzles + hammer.
  function rifle(m) { var g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      var barrel = facetMesh(new THREE.CylinderGeometry(0.045, 0.05, 1.7, 7), m.steel); barrel.rotation.x = Math.PI / 2; at(barrel, 0.075 * s, 0.06, 0.95); g.add(barrel);
      var muzzle = facetMesh(new THREE.CylinderGeometry(0.075, 0.075, 0.18, 7), m.steel); muzzle.rotation.x = Math.PI / 2; at(muzzle, 0.075 * s, 0.06, 1.78); g.add(muzzle);
    });
    g.add(at(smoothMesh(new THREE.BoxGeometry(0.22, 0.26, 0.78), m.wood || m.accent), 0, -0.04, 0.12));        // stock
    g.add(at(smoothMesh(new THREE.BoxGeometry(0.24, 0.13, 0.7), m.wood || m.accent), 0, 0.03, 0.55));          // fore-grip (spans both barrels)
    g.add(at(facetMesh(new THREE.BoxGeometry(0.07, 0.17, 0.08), m.steel), 0, 0.18, 0.34));                     // hammer
    return g; }
  function holyMace(m) { var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.05, 1.4), m.wood || m.accent));
    var head = facetMesh(new THREE.SphereGeometry(0.2, 7, 6), m.accent); at(head, 0, 0.75, 0); g.add(head);
    g.add(at(facetMesh(P.crystalGeo(0.13, 1.3), m.gem), 0, 0.92, 0)); g.userData.glow = [g.children[g.children.length - 1]]; return g; }
  function wizardStaff(m) { var g = new THREE.Group(); g.add(smoothMesh(P.limbGeo(0.055, 2.0), m.wood || m.accent));
    var ring = facetMesh(new THREE.TorusGeometry(0.2, 0.045, 6, 6), m.accent); at(ring, 0, 1.05, 0); g.add(ring);
    var orb = facetMesh(P.crystalGeo(0.2, 1.3), m.gem); at(orb, 0, 1.06, 0); g.add(orb);
    g.userData.glow = [orb]; return g; }
  function kiteShield(m) { var g = new THREE.Group();
    var body = facetMesh(new THREE.BoxGeometry(0.78, 1.05, 0.13), m.cloth || m.steel); g.add(body);   // big blue kite
    g.add(at(facetMesh(new THREE.ConeGeometry(0.46, 0.55, 3), m.cloth || m.steel), 0, -0.68, 0));     // tapered point
    g.add(at(facetMesh(new THREE.TorusGeometry(0.4, 0.05, 4, 4, Math.PI), m.accent), 0, 0.34, 0.09)); // gold top trim
    [-1, 1].forEach(function (s) { var bar = facetMesh(new THREE.BoxGeometry(0.07, 0.46, 0.06), m.steel); at(bar, 0.14 * s, 0.06, 0.09); bar.rotation.z = s * 0.6; g.add(bar); });  // white chevron
    return g; }

  // Long flowing cape that WRAPS the body: curved shell segments (open partial
  // cylinders centered on the back) + a shoulder mantle over the shoulders, each
  // segment curving back and flaring wider toward the hem.
  function flowCape(mat, segs, baseR) {
    mat.side = THREE.DoubleSide;   // open shells — show the inner face too
    var g = new THREE.Group(); var arc = 1.5, segLen = 0.42, t0 = -Math.PI / 2 - arc / 2;
    // shoulder mantle over the upper back (slightly wider than the drape)
    var mArc = 1.8;
    g.add(at(new THREE.Mesh(LPF.facet(new THREE.CylinderGeometry(baseR * 1.16, baseR * 1.05, 0.34, 12, 1, true, -Math.PI / 2 - mArc / 2, mArc)), mat), 0, -0.06, 0));
    var chain = new THREE.Group(); chain.position.y = -0.22; g.add(chain); var node = chain;
    for (var i = 0; i < segs; i++) {
      var j = new THREE.Group(); j.rotation.x = 0.06 + i * 0.06; if (i > 0) j.position.y = -segLen;
      var r = baseR * (1 + i * 0.17);
      j.add(at(new THREE.Mesh(LPF.facet(new THREE.CylinderGeometry(r, r * 1.05, segLen * 1.04, 12, 1, true, t0, arc)), mat), 0, -segLen * 0.5, 0));
      node.add(j); node = j;
    }
    return g;
  }

  /* ---- accessories ---- */
  function shield(m, r) { r = r || 0.6; var g = new THREE.Group();
    var disc = facetMesh(new THREE.CylinderGeometry(r, r, 0.14, 8), m.steel || m.accent); disc.rotation.x = Math.PI / 2; g.add(disc);
    var rim = facetMesh(new THREE.TorusGeometry(r, 0.06, 5, 8), m.accent); rim.rotation.x = Math.PI / 2; at(rim, 0, 0, 0.02); g.add(rim);
    var boss = facetMesh(P.crystalGeo(0.16, 1.2), m.gem || m.accent); at(boss, 0, 0, 0.12); g.add(boss); if (m.gem) g.userData.glow = [boss]; return g; }
  function quiver(m) { var g = new THREE.Group(); g.add(smoothMesh(new THREE.CylinderGeometry(0.13, 0.15, 0.66, 7), m.wood || m.accent));
    [-0.07, 0, 0.07].forEach(function (o) { g.add(at(facetMesh(new THREE.ConeGeometry(0.045, 0.2, 4), m.accent), o, 0.45, 0)); }); return g; }

  /* ---- shared head ---- */
  function buildHead(g, opt) {
    var skin = opt.skin, headY = opt.headY, hs = opt.headScale, headR = 0.5 * hs;
    var head = smoothMesh(P.headGeo(headR, opt.taper == null ? 0.18 : opt.taper), skin);
    head.position.y = headY; head.scale.z = 0.92; g.add(head);
    var eyeM = opt.eyeGlow === false ? LPF.toon(0x241f17, { ramp: LPF.RAMP.cloth, rim: false })
      : LPF.toon(opt.eye || 0x6fe06a, { ramp: LPF.RAMP.metal, emissive: opt.eye || 0x6fe06a, emissiveIntensity: 0.18, rim: false });
    [-1, 1].forEach(function (s) { var e = new THREE.Mesh(new THREE.SphereGeometry((opt.eyeGlow === false ? 0.05 : 0.062) * hs, 8, 6), eyeM); e.position.set(0.15 * hs * s, headY + 0.02, headR * 0.92); g.add(e); });
    if (opt.brow) {   // two angled brow ridges + a small nose → reads as a face
      [-1, 1].forEach(function (s) { var b = smoothMesh(new THREE.BoxGeometry(0.3 * hs, 0.06, 0.12), skin); b.position.set(0.16 * hs * s, headY + 0.14, headR * 0.82); b.rotation.z = s * 0.16; g.add(b); });
      var nose = smoothMesh(new THREE.ConeGeometry(0.055 * hs, 0.2 * hs, 5), skin); nose.rotation.x = Math.PI * 0.5; nose.position.set(0, headY - 0.04, headR * 0.92); g.add(nose);
    }
    var ears = opt.ears || 'pointed';
    if (ears === 'pointed') { [-1, 1].forEach(function (s) { var ear = smoothMesh(P.extrude(P.pointedShape(opt.earLen, 0.16), 0.08), skin);
      ear.position.set(headR * 0.85 * s, headY + 0.04, -0.05); ear.rotation.z = -s * (opt.earDroop == null ? 0.9 : opt.earDroop); ear.rotation.y = s * 0.3; g.add(ear); }); }
    else if (ears === 'round') { [-1, 1].forEach(function (s) { var ear = smoothMesh(new THREE.SphereGeometry(0.11 * hs, 7, 6), skin); ear.position.set(headR * 0.92 * s, headY - 0.02, 0); ear.scale.set(0.55, 1, 0.7); g.add(ear); }); }
    return headR;
  }
  function antler(mat, side) { var g = new THREE.Group();
    var b1 = facetMesh(new THREE.CylinderGeometry(0.045, 0.06, 0.4, 5), mat); at(b1, side * 0.06, 0.2, 0); b1.rotation.z = side * 0.45; g.add(b1);
    var b2 = facetMesh(new THREE.CylinderGeometry(0.03, 0.045, 0.4, 5), mat); at(b2, side * 0.26, 0.5, 0); b2.rotation.z = side * 0.85; g.add(b2);
    var b3 = facetMesh(new THREE.CylinderGeometry(0.02, 0.032, 0.3, 5), mat); at(b3, side * 0.5, 0.66, 0); b3.rotation.z = side * 1.2; g.add(b3);
    var t1 = facetMesh(new THREE.CylinderGeometry(0.018, 0.035, 0.28, 5), mat); at(t1, side * 0.16, 0.42, 0.08); t1.rotation.x = -0.5; t1.rotation.z = side * 0.1; g.add(t1);
    var t2 = facetMesh(new THREE.CylinderGeometry(0.016, 0.03, 0.24, 5), mat); at(t2, side * 0.34, 0.62, 0.06); t2.rotation.x = -0.5; t2.rotation.z = side * 0.4; g.add(t2);
    return g; }

  function placeHands(g, parent, skin, handY, x, r, hands) {
    var rH = at(floatingHand(skin, r), x, handY, 0.16);
    var lH = at(floatingHand(skin, r), -x, handY, 0.16);
    if (hands.right) { hands.right.position.copy(rH.position); hands.right.rotation.z = hands.rRotZ != null ? hands.rRotZ : -0.38; hands.right.rotation.x = hands.rTilt || 0; parent.add(hands.right); }
    if (hands.left) { hands.left.position.copy(lH.position); hands.left.rotation.z = hands.lRot || 0; parent.add(hands.left); }
    parent.add(rH); parent.add(lH);
    return [].concat(hands.right && hands.right.userData.glow || [], hands.left && hands.left.userData.glow || []);
  }
  function finish(g) {
    var box = new THREE.Box3().setFromObject(g); var c = new THREE.Vector3(); box.getCenter(c);
    g.position.x -= c.x; g.position.z -= c.z; g.position.y -= box.min.y;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  /* ============================ NIGHT ELF ============================ */
  var ELF = {
    // Tuned toward the WoW Night-Elf reference: lavender skin + hair, green
    // tabard over brown leather, cyan glowing runes/eyes.
    palette: { skin: 0x8f7ad0, cloth: 0x3c6b39, accent: 0x6f4a28, gem: 0x7fe6d8, blade: 0xaef0e0,
      hair: 0x9d8ad6, hairTip: 0x7d6abf, eye: 0xcffcff, sash: 0x5a3f28, antler: 0x5e4126, wood: 0x6e4a2a, steel: 0xb7beca },
    // adult heroic proportions (not chibi): small head, neck, long legs, swept ears
    headScale: 0.78, earLen: 0.8, earDroop: 0.5, torsoH: 1.62, limbLen: 1.55, outline: 0.024,
  };
  LPF.buildElf = function (params) {
    var p = Object.assign({}, ELF, params || {});
    var role = (params && params.role) || 'warrior';
    var pal = Object.assign({}, ELF.palette, (params && params.palette) || {});
    var M = function (c, o) { return LPF.toon(c, Object.assign({ ramp: LPF.RAMP.cloth }, o || {})); };
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimColor: 0xbfa0ff, rimStrength: 0.2 });
    var cloth = M(pal.cloth), accent = LPF.toon(pal.accent, { ramp: LPF.RAMP.metal }), hair = M(pal.hair), hairTip = M(pal.hairTip),
      sashM = M(pal.sash), antlerM = M(pal.antler), steel = LPF.toon(pal.steel, { ramp: LPF.RAMP.metal });
    var gem = LPF.toon(pal.gem, { ramp: LPF.RAMP.metal, emissive: pal.gem, emissiveIntensity: 0.3, rim: false });
    var blade = LPF.toon(pal.blade, { ramp: LPF.RAMP.metal, emissive: pal.blade, emissiveIntensity: 1.4, rim: false }); blade.userData.glow = true;
    var mats = { accent: accent, gem: gem, blade: blade, steel: steel, wood: M(pal.wood), string: hair, sash: sashM };
    var F = { worker: { pauld: false, head: 'none' }, warrior: { pauld: true, head: 'none' }, lancer: { pauld: true, head: 'helm' },
      archer: { pauld: false, head: 'hood', cape: true, shoulderPad: true }, caster: { pauld: false, head: 'none', pelt: true }, hero: { pauld: true, cape: true } }[role] || {};
    var g = new THREE.Group(); var glow = [];

    // ── lathed anatomy (profile silhouettes, not stacked tubes) ──────────────
    var hipX = 0.2;
    // legs: bare lavender, tapered thigh→calf→ankle, with brown sandal wraps
    [-1, 1].forEach(function (s) {
      var legPts = [[0.09, 0], [0.11, 0.07], [0.155, p.limbLen * 0.34], [0.115, p.limbLen * 0.6], [0.165, p.limbLen * 0.92], [0.15, p.limbLen]];
      g.add(at(smoothMesh(P.profileLimb(legPts, 12), skin), hipX * s, 0, 0));
      [0.1, 0.26, 0.42].forEach(function (h) { var w = smoothMesh(new THREE.TorusGeometry(0.13, 0.035, 5, 10), accent); w.rotation.x = Math.PI / 2; at(w, hipX * s, h, 0.01); g.add(w); });
      g.add(at(smoothMesh(new THREE.SphereGeometry(0.13, 8, 6), accent), hipX * s, 0.02, 0.06));   // foot
    });
    var ty0 = p.limbLen, th = p.torsoH;
    // hourglass torso: hips → narrow waist → chest → broad shoulders → neck base
    var torsoPts = [[0.3, 0], [0.27, th * 0.18], [0.23, th * 0.34], [0.32, th * 0.6], [0.38, th * 0.86], [0.3, th * 0.95], [0.14, th]];
    g.add(at(smoothMesh(P.profileLimb(torsoPts, 18), cloth), 0, ty0, 0));
    // flared tabard/skirt hanging from the waist over the thighs
    var skirtPts = [[0.5, 0], [0.47, 0.18], [0.36, 0.42], [0.28, 0.6]];
    g.add(at(smoothMesh(P.profileLimb(skirtPts, 18), cloth), 0, ty0 - 0.16, 0));
    g.add(at(smoothMesh(new THREE.BoxGeometry(0.17, 0.52, 0.04), sashM), 0, ty0 + 0.06, 0.45));   // front tabard panel
    // waist belt + glowing rune
    g.add(at(smoothMesh(P.profileLimb([[0.29, 0], [0.31, 0.1], [0.29, 0.18]], 16), sashM), 0, ty0 + th * 0.3, 0));
    var beltRune = facetMesh(P.crystalGeo(0.1, 1.0), gem); at(beltRune, 0, ty0 + th * 0.39, 0.3); g.add(beltRune); glow.push(beltRune);

    var shoulderY = ty0 + th;
    g.add(at(smoothMesh(P.profileLimb([[0.1, 0], [0.13, 0.1], [0.1, 0.18]], 12), skin), 0, shoulderY - 0.06, 0));   // neck
    // arms: lathed shoulder→wrist (bare skin + bracer), slight outward splay
    var armHandY = ty0 + th * 0.22;
    [-1, 1].forEach(function (s) {
      var alen = (shoulderY - 0.04) - armHandY;
      var armPts = [[0.075, 0], [0.1, alen * 0.32], [0.085, alen * 0.6], [0.135, alen * 0.92], [0.12, alen]];
      var arm = smoothMesh(P.profileLimb(armPts, 12), skin); at(arm, 0.46 * s, armHandY, 0.02); arm.rotation.z = s * 0.07; g.add(arm);
      var br = smoothMesh(new THREE.TorusGeometry(0.12, 0.035, 5, 10), accent); br.rotation.x = Math.PI / 2; at(br, 0.46 * s, armHandY + 0.05, 0.02); g.add(br);
    });
    if (F.pauld) [-1, 1].forEach(function (s) {   // brown leather pauldron + small green leaf fin (per reference)
      var pa = smoothMesh(new THREE.SphereGeometry(role === 'hero' ? 0.26 : 0.22, 9, 7), accent); pa.scale.set(1.15, 0.72, 1.05); at(pa, 0.42 * s, shoulderY - 0.02, 0); g.add(pa);
      var fin = facetMesh(P.leafGemGeo(0.36, 0.5), M(pal.cloth)); at(fin, 0.5 * s, shoulderY + 0.12, -0.02); fin.rotation.z = -s * 0.6; g.add(fin);
    });
    if (F.cape) { var cp = flowCape(M(role === 'hero' ? pal.cloth : pal.sash), 5, 0.5); at(cp, 0, shoulderY + 0.24, -0.12); g.add(cp); }   // back-hugging cloak
    if (F.shoulderPad) [-1, 1].forEach(function (s) {   // WC3 Night Elf Archer: big upswept pauldrons
      var base = facetMesh(new THREE.SphereGeometry(0.27, 9, 7), M(pal.cloth)); base.scale.set(1.15, 0.72, 1.05); at(base, 0.46 * s, shoulderY + 0.02, 0); g.add(base);
      var fin = facetMesh(new THREE.ConeGeometry(0.17, 0.62, 5), M(pal.cloth)); fin.scale.set(1, 1, 0.45); at(fin, 0.5 * s, shoulderY + 0.32, -0.02); fin.rotation.z = s * 0.55; g.add(fin);
      var trim = facetMesh(new THREE.TorusGeometry(0.22, 0.04, 5, 9), accent); trim.rotation.x = Math.PI / 2; at(trim, 0.46 * s, shoulderY - 0.05, 0); g.add(trim);
    });
    if (F.pelt) { // druid fur mantle over the shoulders
      var pelt = smoothMesh(new THREE.SphereGeometry(0.5, 10, 7), M(pal.antler)); pelt.scale.set(1.15, 0.55, 1.0); at(pelt, 0, shoulderY - 0.02, 0); g.add(pelt); }

    var headY = shoulderY + 0.5 * p.headScale;
    var headR = buildHead(g, { skin: skin, headY: headY, headScale: p.headScale, earLen: p.earLen, earDroop: p.earDroop, eye: pal.eye, brow: true, taper: 0.3 });
    if (F.head === 'hood') { // Night Elf Archer cowl: rounded hood over top+back, point at the rear
      var hd = facetMesh(new THREE.SphereGeometry(0.5 * p.headScale + 0.13, 9, 7, 0, Math.PI * 2, 0, 1.85), cloth); at(hd, 0, headY + 0.13, -0.12); hd.scale.set(1.12, 1.06, 1.22); g.add(hd);
      g.add(at(facetMesh(new THREE.ConeGeometry(0.18, 0.5, 5), cloth), 0, headY + 0.22, -0.42)); }
    else { // swept-back hair volume (back + nape) — not a full cap
      var hb = smoothMesh(new THREE.SphereGeometry(0.56 * p.headScale, 12, 9), hair); hb.scale.set(1.06, 1.0, 1.12); at(hb, 0, headY + 0.04, -0.2); g.add(hb);
      g.add(at(smoothMesh(new THREE.ConeGeometry(0.17 * p.headScale, 0.32, 6), hair), 0, headY + 0.32 * p.headScale, headR * 0.32));   // forehead peak
      g.add(at(smoothMesh(new THREE.SphereGeometry(0.18 * p.headScale, 9, 8), hair), 0, headY + 0.5 * p.headScale, -0.14));            // top knot
      [-1, 1].forEach(function (s) { var lk = smoothMesh(P.profileLimb([[0.05, 0], [0.09, 0.28], [0.05, 0.56]], 8), hair); at(lk, headR * 0.92 * s, headY - 0.56, headR * 0.28); lk.rotation.z = s * 0.08; g.add(lk); });   // face-framing side locks
      [-1, 1].forEach(function (s) { var br = smoothMesh(P.limbGeo(0.05, 0.62), hair); at(br, headR * 0.5 * s, headY - 0.34, -0.22); g.add(br);
        g.add(at(smoothMesh(new THREE.SphereGeometry(0.055, 7, 6), hairTip), headR * 0.5 * s, headY - 0.66, -0.22)); });            // back braids
      if (F.head === 'helm') { var helm = facetMesh(new THREE.SphereGeometry(0.56 * p.headScale, 9, 6, 0, 6.3, 0, 1.7), steel); at(helm, 0, headY + 0.12, 0); g.add(helm);
        g.add(at(facetMesh(new THREE.ConeGeometry(0.08, 0.45, 4), accent), 0, headY + 0.62 * p.headScale, 0)); } }

    var rWeapon = role === 'caster' ? druidStaff(mats) : role === 'worker' ? gemTool(mats)
      : role === 'archer' ? null : role === 'hero' ? gemGlaive(mats, 2.3)
      : moonPolearm(mats);   // warrior = Sentinel moon-polearm
    var hands = { right: rWeapon, left: role === 'archer' ? bow(mats) : null, rTilt: 0, lRot: 0.2 };
    var handY = p.limbLen + p.torsoH * 0.22;
    glow = glow.concat(placeHands(g, g, skin, handY, 0.52, 0.16, hands));

    g.userData.emissiveMeshes = glow;
    if (p.outline) LPF.outlineGroup(g, p.outline, 0x1a1226);
    return finish(g);
  };

  /* ============================ ORC + TROLL ============================ */
  var ORC = {
    palette: { skin: 0x5f8a2e, cloth: 0x5a3a22, accent: 0x8a6a3a, bone: 0xe2dcc0, blade: 0xb9c2cc,
      eye: 0xe8c33a, hair: 0x1c160f, sash: 0x9c3f2c, wood: 0x4e351d, steel: 0xb9c2cc, feather: 0xc23528 },
    headScale: 1.25, earLen: 0.4, earDroop: 1.3, torsoH: 1.3, limbLen: 0.78, outline: 0.03, hunch: 0.26,
  };
  LPF.buildOrc = function (params) {
    var p = Object.assign({}, ORC, params || {});
    var role = (params && params.role) || 'warrior';
    var troll = (role === 'archer');   // Horde ranged = troll headhunter
    var pal = Object.assign({}, ORC.palette, (params && params.palette) || {});
    if (troll) { pal = Object.assign({}, pal, { skin: 0x4f8f86, hair: 0xdd6a24, sash: 0x2f6f8a }); }
    var M = function (c, o) { return LPF.toon(c, Object.assign({ ramp: LPF.RAMP.cloth }, o || {})); };
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimColor: troll ? 0x9fe0d6 : 0xc9e08a, rimStrength: 0.2 });
    var cloth = M(pal.cloth), accent = LPF.toon(pal.accent, { ramp: LPF.RAMP.metal }), bone = M(pal.bone),
      sashM = M(pal.sash), steel = LPF.toon(pal.steel, { ramp: LPF.RAMP.metal }), hair = M(pal.hair);
    var mats = { accent: accent, gem: bone, blade: steel, steel: steel, wood: M(pal.wood), sash: sashM, bone: bone,
      eye: LPF.toon(pal.eye, { ramp: LPF.RAMP.metal, emissive: pal.eye, emissiveIntensity: 0.4, rim: false }), feather: M(pal.feather) };
    var g = new THREE.Group();
    var bw = troll ? 1.0 : 1.35;
    var limbLen = troll ? 1.05 : p.limbLen, torsoH = troll ? 1.2 : p.torsoH, headScale = troll ? 1.05 : p.headScale, hunch = troll ? 0.14 : p.hunch;
    var F = { worker: { pauld: false }, warrior: { pauld: true }, lancer: { pauld: true, head: 'helm' },
      caster: { pauld: false, head: 'mask' }, hero: { pauld: true, cape: true } }[role] || {};

    [-1, 1].forEach(function (s) { g.add(at(smoothMesh(P.limbGeo(troll ? 0.16 : 0.22, limbLen), skin), (troll ? 0.2 : 0.24) * s, limbLen * 0.5, 0));
      g.add(at(smoothMesh(P.torsoGeo(0.24, 0.3, 0.4), cloth), (troll ? 0.2 : 0.24) * s, limbLen * 0.78, 0)); });
    var tp = P.joint(0, limbLen, 0); tp.rotation.x = hunch; g.add(tp);
    tp.add(at(smoothMesh(P.torsoGeo(0.6 * bw, 0.5 * bw, torsoH), skin), 0, torsoH * 0.5, 0));
    var sash = at(smoothMesh(P.torsoGeo(0.18, 0.18, torsoH * 1.1), sashM), 0.1, torsoH * 0.5, 0.34); sash.rotation.z = 0.3; tp.add(sash);

    var shoulderY = torsoH;
    if (F.pauld) [-1, 1].forEach(function (s) {
      var pd = smoothMesh(new THREE.SphereGeometry(0.34, 10, 8), accent); pd.scale.y = 0.7; at(pd, 0.62 * bw * 0.5 * s + 0.3 * s, shoulderY + 0.05, 0); tp.add(pd);
      [0, 1, 2].forEach(function (i) { var sp = facetMesh(P.tuskGeo(0.07, 0.3), bone); at(sp, (0.5 * s) + (i - 1) * 0.12 * s, shoulderY + 0.2, 0); sp.rotation.z = (i - 1) * 0.3; tp.add(sp); }); });
    if (F.cape) { var cp = smoothMesh(new THREE.BoxGeometry(0.95 * bw, 1.4, 0.08), sashM); at(cp, 0, torsoH * 0.55, -0.36 * bw); cp.rotation.x = 0.12; tp.add(cp); }

    var headY = shoulderY + 0.5 * headScale;
    var headR = buildHead(tp, { skin: skin, headY: headY, headScale: headScale, earLen: troll ? 0.55 : p.earLen, earDroop: p.earDroop, eye: pal.eye, brow: true, taper: 0.05 });
    tp.add(at(smoothMesh(new THREE.BoxGeometry(0.52 * headScale, 0.3, 0.42), skin), 0, headY - 0.28, 0.3));
    var mouthM = LPF.toon(0x3a1410, { ramp: LPF.RAMP.cloth, rim: false });
    tp.add(at(smoothMesh(new THREE.BoxGeometry(0.34 * headScale, 0.14, 0.12), mouthM), 0, headY - 0.24, 0.47));
    [-1, 1].forEach(function (s) { var tk = facetMesh(P.tuskGeo(0.13, 0.68), bone); at(tk, 0.16 * s, headY - 0.0, 0.45); tk.rotation.x = -0.1; tk.rotation.z = -s * 0.16; tp.add(tk); });
    if (troll) { [-0.16, 0, 0.16].forEach(function (o, i) { var mo = facetMesh(new THREE.ConeGeometry(0.09, 0.55 + (i === 1 ? 0.2 : 0), 4), hair); at(mo, o, headY + 0.5 * headScale, -0.04); tp.add(mo); }); }
    else if (F.head === 'helm') { var helm = facetMesh(new THREE.SphereGeometry(0.58 * headScale, 9, 6, 0, 6.3, 0, 1.7), steel); at(helm, 0, headY + 0.1, 0); tp.add(helm);
      [-1, 1].forEach(function (s) { tp.add(at(facetMesh(P.tuskGeo(0.06, 0.4), bone), 0.5 * headScale * s, headY + 0.3, 0)); }); }
    else if (F.head === 'mask') { // witch-doctor bone skull mask over the face + feathered headdress
      var mask = facetMesh(new THREE.SphereGeometry(0.5 * headScale, 9, 7, 0, 6.3, 0, 1.5), bone); at(mask, 0, headY + 0.04, 0.06); mask.scale.set(1.02, 1.0, 1.05); tp.add(mask);
      [-1, 1].forEach(function (s) { tp.add(at(facetMesh(new THREE.SphereGeometry(0.07, 6, 5), LPF.toon(0x201712, { ramp: LPF.RAMP.cloth, rim: false })), 0.17 * headScale * s, headY + 0.08, 0.45 * headScale)); });
      [-0.22, -0.07, 0.07, 0.22].forEach(function (o) { var f = facetMesh(new THREE.ConeGeometry(0.05, 0.5, 4), o < 0 ? M(pal.feather) : LPF.toon(0xd8c14a, { ramp: LPF.RAMP.cloth })); at(f, o, headY + 0.5 * headScale, -0.08); f.rotation.z = o * 0.7; f.rotation.x = -0.3; tp.add(f); }); }
    else { tp.add(at(smoothMesh(new THREE.SphereGeometry(0.16, 8, 6), hair), 0, headY + 0.5 * headScale, -0.05)); }

    var rWeapon = troll ? spear(mats, 2.7, steel) : role === 'caster' ? witchStaff(mats)
      : role === 'worker' ? pick(mats) : role === 'lancer' ? spear(mats, 2.6, steel)
      : role === 'hero' ? bigAxe(mats, 1.25) : bigAxe(mats, 1.0);
    var hands = { right: rWeapon, left: null, rTilt: (troll || role === 'lancer') ? -0.3 : 0 };
    var handY = torsoH * 0.22;
    placeHands(g, tp, skin, handY, 0.66 * bw, troll ? 0.16 : 0.2, hands);

    g.userData.emissiveMeshes = [];
    if (p.outline) LPF.outlineGroup(g, p.outline, 0x141008);
    return finish(g);
  };

  /* ============================ ARMORED ORC WARRIOR ============================
   * Matches the Google-Flow reference: stocky black-plate orc, red spiked dome
   * helm over a green tusked face, notched dark-iron sword, bound-plank shield. */
  // Two-handed orc war-axe: chunky wood haft + a heavy faceted iron head with a
  // forward cutting blade, a back pick, and a top spike. Built head-up (+Y).
  function warAxe(wood, iron, ironD) {
    var g = new THREE.Group();
    g.add(smoothMesh(P.limbGeo(0.08, 2.2), wood));                                     // haft (v3: longer for two-handed grip)
    var hy = 1.0;
    g.add(at(facetMesh(new THREE.BoxGeometry(0.2, 0.34, 0.26), ironD), 0, hy, 0));      // iron collar/socket
    g.add(at(facetMesh(new THREE.BoxGeometry(0.16, 0.78, 0.46), iron), 0, hy, 0.36));   // blade body (forward)
    var edge = facetMesh(new THREE.ConeGeometry(0.46, 0.7, 3), iron); edge.rotation.z = Math.PI / 2; edge.rotation.y = Math.PI / 2; at(edge, 0, hy, 0.7); g.add(edge);   // tapered cutting edge
    g.add(at(facetMesh(new THREE.ConeGeometry(0.2, 0.5, 4), iron), 0, hy - 0.42, 0.5)); // lower beard point
    var pick = facetMesh(new THREE.ConeGeometry(0.12, 0.62, 4), ironD); pick.rotation.z = -Math.PI / 2; at(pick, 0, hy, -0.34); g.add(pick);   // back pick
    g.add(at(facetMesh(new THREE.ConeGeometry(0.085, 0.42, 4), ironD), 0, hy + 0.5, 0));    // top spike
    return g;
  }
  LPF.buildOrcWarrior = function (params) {
    // outline 0 by default: the inverted-hull shell bakes into the .glb as solid
    // black backfaces that read as a blob in the game renderer. Pass outline>0
    // only for standalone turntable critique.
    // v3: head-to-body ratio bumped a touch (1.18→1.24) for the reference's
    // big-headed read under the hood, without ballooning the silhouette.
    var p = Object.assign({ headScale: 1.24, torsoH: 1.0, limbLen: 0.74, outline: 0 }, params || {});
    // Leather-grunt palette: brown laced leather over lots of green skin, a red +
    // near-black angular helm, dark-iron axe. Bases pushed dark for the bright rig.
    // Base colours set to the reference's measured per-region targets (with the
    // forge rig dimmed so previews render near these values). ΔE-calibrated.
    var pal = Object.assign({ skin: 0x537d22, skinD: 0x3a5a1a, leather: 0x5a3d24, leatherD: 0x38240f,
      lace: 0xb89a62, helm: 0x762012, hoodD: 0x591810, crown: 0x1a1620, iron: 0x3a3f47, ironD: 0x23262c,
      wood: 0x6e4a2a, bone: 0xe6dcc0, eye: 0x9be03a }, (params && params.palette) || {});
    var Mc = function (c, o) { return LPF.toon(c, Object.assign({ ramp: LPF.RAMP.cloth }, o || {})); };
    var Mm = function (c, o) { return LPF.toon(c, Object.assign({ ramp: LPF.RAMP.metal }, o || {})); };
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimColor: 0xc9e08a, rimStrength: 0.22 });
    var leather = Mc(pal.leather), leatherD = Mc(pal.leatherD), lace = Mc(pal.lace),
      helm = Mc(pal.helm, { rimColor: 0xd24a2a, rimStrength: 0.12 }), hoodD = Mc(pal.hoodD), crown = Mm(pal.crown, { rimColor: 0x4a4652, rimStrength: 0.14 }),
      iron = Mm(pal.iron), ironD = Mm(pal.ironD), wood = Mc(pal.wood), bone = Mc(pal.bone),
      mouth = LPF.toon(0x24120c, { ramp: LPF.RAMP.cloth, rim: false }),
      eye = LPF.toon(pal.eye, { ramp: LPF.RAMP.metal, emissive: pal.eye, emissiveIntensity: 0.5, rim: false });
    var g = new THREE.Group(); var glow = [];
    var bw = 1.45, L = p.limbLen, TH = p.torsoH, hs = p.headScale, hipY = L;

    // ── legs: bare green thighs + chunky ROUNDED boots, all smooth-shaded ──
    [-1, 1].forEach(function (s) {
      g.add(at(smoothMesh(P.profileLimb([[0.21, 0.26], [0.25, 0.46], [0.2, L]], 12), skin), 0.27 * s, 0, 0));    // green thigh
      var boot = smoothMesh(new THREE.SphereGeometry(0.27, 14, 10), leatherD); boot.scale.set(1.0, 0.94, 1.42); at(boot, 0.27 * s, 0.17, 0.12); g.add(boot);   // rounded chunky boot
      g.add(at(smoothMesh(new THREE.SphereGeometry(0.21, 12, 9), skin), 0.27 * s, L * 0.56, 0.06));              // green knee
    });
    // ── hip: a short smooth leather skirt flaring over the thighs ──
    g.add(at(smoothMesh(P.profileLimb([[0.5, 0], [0.44, 0.2], [0.36, 0.38]], 18), leatherD), 0, hipY - 0.28, 0));

    // ── torso: a smooth rounded leather barrel + a simple darker central placket ──
    var torso = smoothMesh(P.profileLimb([[0.42, 0], [0.52, TH * 0.45], [0.48, TH * 0.82], [0.34, TH]], 18), leather);
    torso.scale.set(1.16, 1.0, 0.82); at(torso, 0, hipY + 0.04, 0); g.add(torso);
    g.add(at(smoothMesh(P.limbGeo(0.09, TH * 0.66), leatherD), 0, hipY + TH * 0.5, 0.32));                       // central placket (smooth)
    var belt = smoothMesh(new THREE.CylinderGeometry(0.5, 0.52, 0.2, 18), crown); belt.scale.set(1.16, 1, 0.84); at(belt, 0, hipY + 0.04, 0); g.add(belt);   // smooth rounded belt

    var shoulderY = hipY + TH;
    // ── pauldrons: smooth rounded leather caps (axe shoulder a touch bigger = asym) ──
    [-1, 1].forEach(function (s) {
      var sz = s < 0 ? 0.4 : 0.35, x = 0.5 * bw * 0.5 * s + 0.2 * s;
      var pd = smoothMesh(new THREE.SphereGeometry(sz, 14, 10), leather); pd.scale.set(1.16, 0.92, 1.12); at(pd, x, shoulderY + 0.02, 0); g.add(pd);
    });
    var lsp = facetMesh(new THREE.ConeGeometry(0.1, 0.34, 5), crown); at(lsp, -0.62, shoulderY + 0.2, -0.04); lsp.rotation.z = 0.42; g.add(lsp);   // one shoulder spike (asym, kept)

    // ── arms: BARE GREEN, chunky, big fists. Simple stance (pose left as-is —
    //    look first): right arm hangs, left holds the war-axe low at the side. ──
    var armHandY = hipY + TH * 0.16, alen = (shoulderY - 0.08) - armHandY;
    g.add(at(smoothMesh(P.profileLimb([[0.17, 0], [0.21, alen * 0.42], [0.16, alen * 0.74], [0.2, alen]], 10), skin), 0.6, armHandY, 0.02));
    g.add(at(smoothMesh(new THREE.SphereGeometry(0.22, 9, 7), skin), 0.6, armHandY - 0.09, 0.12));             // big fist
    var axArm = new THREE.Group(); axArm.position.set(-0.56, shoulderY - 0.08, 0.05); axArm.rotation.z = -0.6;
    var aL = (shoulderY - armHandY) + 0.16;
    axArm.add(smoothMesh(P.profileLimb([[0.2, -aL], [0.16, -aL * 0.7], [0.21, -aL * 0.34], [0.16, 0]], 10), skin));
    axArm.add(at(smoothMesh(new THREE.SphereGeometry(0.22, 9, 7), skin), 0, -aL - 0.02, 0.05));                 // fist
    var axe = warAxe(wood, iron, ironD); at(axe, 0, -aL - 0.05, 0.1); axe.rotation.z = Math.PI; axe.rotation.x = 0.16; axArm.add(axe);
    g.add(axArm);

    // ── head: a big ROUNDED chibi orc head, SMOOTH-shaded (matches the smooth
    //    low-poly style pack — no boxy facets, no flat disc). Heavy rounded jaw for
    //    the orc read. Face features omitted for now — shaping head + hood first. ──
    var headY = shoulderY + 0.42 * hs, headR = 0.5 * hs;
    var head = smoothMesh(P.headGeo(headR, 0.04), skin); at(head, 0, headY, 0.02); head.scale.set(1.05, 1.06, 0.96); g.add(head);
    var jaw = smoothMesh(new THREE.SphereGeometry(headR * 0.84, 14, 10), skin); jaw.scale.set(1.0, 0.62, 0.92); at(jaw, 0, headY - 0.26, 0.06); g.add(jaw);   // heavy rounded orc jaw

    // ── HOOD: a SMOOTH, thin red cowl hugging the head and sweeping BACK to a point
    //    (teardrop), like the reference topology. Smooth-shaded, traces the skull,
    //    open at the face. ──
    var hood = smoothMesh(new THREE.SphereGeometry(headR + 0.06, 18, 13, 0, Math.PI * 2, 0, 1.95), helm);
    at(hood, 0, headY + 0.05, -0.05); hood.scale.set(1.08, 1.06, 1.02); g.add(hood);                           // skull-hugging cowl
    var peak = smoothMesh(new THREE.SphereGeometry(0.24 * hs, 14, 10), helm); peak.scale.set(0.62, 0.58, 1.8);
    at(peak, 0, headY + 0.32 * hs, -0.52 * hs); peak.rotation.x = -0.62; g.add(peak);                          // swept-back hood peak
    // thin black rim band at the brow + a black crown spike riding the swept peak
    var band = smoothMesh(new THREE.TorusGeometry(headR + 0.05, 0.045, 8, 18), crown); band.rotation.x = Math.PI / 2; at(band, 0, headY + 0.2, -0.02); band.scale.set(1.04, 1.0, 1.04); g.add(band);
    var cspike = facetMesh(new THREE.ConeGeometry(0.1, 0.46, 5), crown); at(cspike, 0, headY + 0.5 * hs, -0.5 * hs); cspike.rotation.x = -0.62; g.add(cspike);

    g.userData.emissiveMeshes = glow;
    if (p.outline) LPF.outlineGroup(g, p.outline, 0x0f0c08);
    return finish(g);
  };

  /* ============================ IRON CROWN (HUMAN) ============================ */
  var HUMAN = {
    palette: { skin: 0xe6b07a, cloth: 0x2f5aa8, accent: 0xe4b53a, steel: 0xc2ccd8, leather: 0x6b4a2a,
      hair: 0x6b4a2a, beard: 0x5a3a22, gem: 0x52b6e8, eye: 0x2a241a, wood: 0x6b4a2a },
    headScale: 1.15, torsoH: 1.25, limbLen: 0.9, outline: 0.028,
  };
  LPF.buildHuman = function (params) {
    var p = Object.assign({}, HUMAN, params || {});
    var role = (params && params.role) || 'warrior';
    var pal = Object.assign({}, HUMAN.palette, (params && params.palette) || {});
    var M = function (c, o) { return LPF.toon(c, Object.assign({ ramp: LPF.RAMP.cloth }, o || {})); };
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimStrength: 0.18 });
    var tabard = M(pal.cloth), accent = LPF.toon(pal.accent, { ramp: LPF.RAMP.metal }), steel = LPF.toon(pal.steel, { ramp: LPF.RAMP.metal }),
      leather = M(pal.leather), hair = M(pal.hair), beardM = M(pal.beard);
    var gem = LPF.toon(pal.gem, { ramp: LPF.RAMP.metal, emissive: pal.gem, emissiveIntensity: 0.5, rim: false });
    var armored = (role === 'warrior' || role === 'hero');
    var bodyMat = role === 'caster' ? tabard : armored ? steel : leather;
    var mats = { accent: accent, gem: gem, steel: steel, blade: steel, wood: M(pal.wood), cloth: tabard, string: hair };
    var F = { worker: { head: 'cap', beard: true }, warrior: { head: 'helm', pauld: true, shield: true },
      lancer: { head: 'helm', pauld: true, shield: true }, archer: { head: 'riflehelm', beard: true, cape: true },
      caster: { head: 'wizhat', robe: true }, hero: { head: 'winghelm', pauld: true, cape: true, beard: true } }[role] || {};
    var g = new THREE.Group(); var glow = [];

    // Rifleman is a short, stocky, big-bearded dwarf (per the Alliance roster)
    var dwarf = (role === 'archer');
    var limbLen = dwarf ? p.limbLen * 0.58 : p.limbLen, torsoH = dwarf ? p.torsoH * 0.95 : p.torsoH,
      headScale = dwarf ? p.headScale * 1.3 : p.headScale, bw = dwarf ? 1.32 : 1.0;

    [-1, 1].forEach(function (s) { g.add(at(smoothMesh(P.limbGeo(0.18 * bw, limbLen), armored ? steel : leather), 0.19 * bw * s, limbLen * 0.5, 0));
      g.add(at(smoothMesh(P.limbGeo(0.19 * bw, 0.22), leather), 0.19 * bw * s, 0.12, 0.04)); });
    g.add(at(smoothMesh(P.torsoGeo(0.42 * bw, 0.6 * bw, torsoH), bodyMat), 0, limbLen + torsoH * 0.5, 0));
    if (armored) g.add(at(smoothMesh(new THREE.BoxGeometry(0.32, torsoH * 0.95, 0.12), tabard), 0, limbLen + torsoH * 0.5, 0.46 * bw));   // blue tabard strip
    g.add(at(smoothMesh(P.torsoGeo(0.52 * bw, 0.52 * bw, 0.14), accent), 0, limbLen + torsoH * 0.18, 0));   // gold belt
    if (armored) g.add(at(smoothMesh(new THREE.BoxGeometry(0.74, 0.1, 0.1), accent), 0, limbLen + torsoH * 0.8, 0.44 * bw));   // gold chest trim
    if (F.robe) g.add(at(smoothMesh(P.torsoGeo(0.42, 0.72, 1.05), tabard), 0, p.limbLen * 0.62, 0));

    var shoulderY = limbLen + torsoH;
    if (F.pauld) [-1, 1].forEach(function (s) { var pd = facetMesh(new THREE.SphereGeometry(0.32, 9, 7), steel); pd.scale.y = 0.7; at(pd, 0.54 * bw * s, shoulderY - 0.02, 0); g.add(pd);
      var r = facetMesh(new THREE.TorusGeometry(0.28, 0.05, 5, 8), accent); r.rotation.x = Math.PI / 2; at(r, 0.54 * bw * s, shoulderY - 0.05, 0); g.add(r); });
    if (F.cape) { var cp = flowCape(M(role === 'hero' ? 0x9c2b2b : pal.cloth), 5, 0.5 * bw); at(cp, 0, shoulderY + 0.24, -0.12 * bw); g.add(cp); }   // back-hugging cloak

    var headY = shoulderY + 0.5 * headScale;
    var headR = buildHead(g, { skin: skin, headY: headY, headScale: headScale, eye: pal.eye, eyeGlow: false, ears: 'round', taper: 0.16 });
    g.add(at(smoothMesh(P.headGeo(0.54 * headScale, 0.1), hair), 0, headY + 0.12, -0.06));
    if (F.beard) { var bd = smoothMesh(new THREE.BoxGeometry(0.46 * headScale, dwarf ? 0.62 : 0.36, 0.34), beardM); at(bd, 0, headY - (dwarf ? 0.44 : 0.34), headR * 0.5); g.add(bd); }
    if (F.head === 'helm') { g.add(at(facetMesh(new THREE.SphereGeometry(headR + 0.06, 9, 6, 0, 6.3, 0, 1.7), steel), 0, headY + 0.1, 0));
      g.add(at(facetMesh(new THREE.BoxGeometry(0.1, 0.42, 0.12), steel), 0, headY - 0.02, headR * 0.92));
      var plume = facetMesh(new THREE.ConeGeometry(0.13, 0.55, 5), tabard); at(plume, 0, headY + 0.62 * headScale, -0.06); g.add(plume); }   // blue plume
    else if (F.head === 'winghelm') { g.add(at(facetMesh(new THREE.SphereGeometry(headR + 0.07, 9, 6, 0, 6.3, 0, 1.7), steel), 0, headY + 0.12, 0));
      [-1, 1].forEach(function (s) { var w = facetMesh(new THREE.ConeGeometry(0.1, 0.42, 4), accent); at(w, (headR + 0.1) * s, headY + 0.22, -0.04); w.rotation.z = s * 1.2; g.add(w); }); }
    else if (F.head === 'wizhat') { g.add(at(facetMesh(new THREE.CylinderGeometry(0.72 * headScale, 0.72 * headScale, 0.06, 9), tabard), 0, headY + 0.33, 0));
      var cone = facetMesh(new THREE.ConeGeometry(0.4 * headScale, 1.15, 9), tabard); at(cone, 0, headY + 0.88, -0.02); cone.rotation.z = 0.08; g.add(cone);
      var hg = facetMesh(new THREE.SphereGeometry(0.12, 7, 6), gem); at(hg, 0, headY + 0.42, headR * 0.62); g.add(hg); glow.push(hg); }
    else if (F.head === 'dwarfhelm') { g.add(at(facetMesh(new THREE.SphereGeometry(headR + 0.08, 9, 6, 0, 6.3, 0, 1.55), steel), 0, headY + 0.14, 0));
      var brim = facetMesh(new THREE.TorusGeometry(headR + 0.04, 0.06, 5, 10), accent); brim.rotation.x = Math.PI / 2; at(brim, 0, headY + 0.2, 0); g.add(brim);
      g.add(at(facetMesh(new THREE.BoxGeometry(0.1, 0.34, 0.12), steel), 0, headY + 0.0, headR * 0.95)); }
    else if (F.head === 'hood') { // cowl over top+back, face/beard open at front
      var hood = facetMesh(new THREE.SphereGeometry(headR + 0.14, 9, 7, 0, Math.PI * 2, 0, 1.8), tabard); at(hood, 0, headY + 0.12, -0.16); hood.scale.set(1.12, 1.08, 1.22); g.add(hood);
      g.add(at(facetMesh(new THREE.ConeGeometry(0.2, 0.5, 5), tabard), 0, headY + 0.22, -0.42)); }   // hood drape/point at back
    else if (F.head === 'riflehelm') { // WC3 dwarf blue kettle-helm: blue dome + steel brim + knob
      var kh = facetMesh(new THREE.SphereGeometry(headR + 0.1, 9, 7, 0, Math.PI * 2, 0, 1.55), tabard); at(kh, 0, headY + 0.16, 0); kh.scale.set(1.08, 1.0, 1.08); g.add(kh);
      var br = facetMesh(new THREE.TorusGeometry(headR + 0.07, 0.055, 5, 11), steel); br.rotation.x = Math.PI / 2; at(br, 0, headY + 0.17, 0); g.add(br);
      g.add(at(facetMesh(new THREE.SphereGeometry(0.07, 6, 5), steel), 0, headY + 0.16 + headR + 0.06, 0)); }
    else if (F.head === 'cap') { g.add(at(smoothMesh(new THREE.SphereGeometry(headR + 0.04, 9, 6, 0, 6.3, 0, 1.5), leather), 0, headY + 0.1, 0)); }

    var rWeapon = role === 'caster' ? wizardStaff(mats) : role === 'worker' ? pick(mats)
      : role === 'archer' ? rifle(mats) : role === 'hero' ? warhammer(mats)
      : role === 'lancer' ? spear(mats, 2.5, steel) : sword(mats, 1.7);
    var leftItem = F.shield ? kiteShield(mats) : null;
    var hands = { right: rWeapon, left: leftItem, rRotZ: role === 'archer' ? 0 : undefined, rTilt: role === 'archer' ? -0.12 : 0 };
    var handY = limbLen + torsoH * 0.22;
    glow = glow.concat(placeHands(g, g, skin, handY, 0.52 * bw, 0.16, hands));

    g.userData.emissiveMeshes = glow;
    if (p.outline) LPF.outlineGroup(g, p.outline, 0x1a1620);
    return finish(g);
  };

  /* ============================ MOUNTED CAVALRY ============================
   * Elf Huntress on a panther / Orc Raider on a dire wolf — the races' distinct
   * "different approach to combat". A quadruped mount + a seated rider built from
   * the same race head/parts. */
  LPF.buildMounted = function (race, params) {
    var elf = race === 'elf', human = race === 'human', orc = !elf && !human;
    var pal = human ? HUMAN.palette : orc ? ORC.palette : ELF.palette;
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimColor: elf ? 0xbfa0ff : human ? 0xffd9a8 : 0xc9e08a, rimStrength: 0.2 });
    var cloth = LPF.toon(pal.cloth, { ramp: LPF.RAMP.cloth });
    var accent = LPF.toon(pal.accent, { ramp: LPF.RAMP.metal });
    var steel = LPF.toon(pal.steel, { ramp: LPF.RAMP.metal });
    var sashM = LPF.toon(pal.sash || pal.cloth, { ramp: LPF.RAMP.cloth });
    var gem = LPF.toon(pal.gem || 0x57c23a, { ramp: LPF.RAMP.metal, emissive: pal.gem || 0x57c23a, emissiveIntensity: 0.3, rim: false });
    var blade = LPF.toon(elf ? pal.blade : pal.steel, { ramp: LPF.RAMP.metal, emissive: elf ? pal.blade : 0x000000, emissiveIntensity: elf ? 1.2 : 0, rim: false }); if (elf) blade.userData.glow = true;
    // mount fur: panther (elf) / dire wolf (orc) / chestnut warhorse (human)
    var fur = LPF.toon(human ? 0x8a5a32 : elf ? 0x2c2738 : 0x7b7f86, { ramp: LPF.RAMP.skin, rim: false });
    var furD = LPF.toon(human ? 0x523619 : elf ? 0x1c1926 : 0x55585c, { ramp: LPF.RAMP.cloth });
    var mEye = LPF.toon(human ? 0x201510 : elf ? 0x5ff0dc : 0xf0b43a, { ramp: LPF.RAMP.metal, emissive: human ? 0x000000 : elf ? 0x5ff0dc : 0xf0b43a, emissiveIntensity: human ? 0 : 0.85, rim: false });
    var markM = LPF.toon(elf ? 0x4fd6c4 : 0xb5402f, { ramp: LPF.RAMP.cloth, rim: false });
    var g = new THREE.Group(); var glow = [];
    var bodyY = 1.05;

    // ---- mount: body, 4 legs, neck+head, tail ----
    var body = smoothMesh(new THREE.CapsuleGeometry(0.46, 1.5, 4, 10), fur); body.rotation.x = Math.PI / 2; at(body, 0, bodyY, -0.1); g.add(body);
    var chest = smoothMesh(new THREE.SphereGeometry(0.5, 10, 8), fur); at(chest, 0, bodyY, 0.85); chest.scale.set(1, 1, 0.9); g.add(chest);
    var haunch = smoothMesh(new THREE.SphereGeometry(0.52, 10, 8), fur); at(haunch, 0, bodyY + 0.05, -0.95); g.add(haunch);
    [[0.32, 0.85], [-0.32, 0.85], [0.32, -0.85], [-0.32, -0.85]].forEach(function (p) {
      var thigh = smoothMesh(P.limbGeo(0.16, 0.55), fur); at(thigh, p[0], bodyY - 0.45, p[1]); g.add(thigh);
      var paw = smoothMesh(new THREE.SphereGeometry(0.16, 8, 6), furD); at(paw, p[0], 0.14, p[1] + (p[1] > 0 ? 0.04 : -0.02)); paw.scale.set(1, 0.7, 1.3); g.add(paw);
    });
    // neck + head forward
    var neck = smoothMesh(P.limbGeo(0.22, 0.6), fur); at(neck, 0, bodyY + 0.4, 1.1); neck.rotation.x = elf ? 0.9 : human ? 0.85 : 0.7; g.add(neck);
    var mHeadY = bodyY + (elf ? 0.75 : human ? 0.88 : 0.7), mHeadZ = elf ? 1.45 : human ? 1.55 : 1.5;
    var mhead = smoothMesh(new THREE.SphereGeometry(0.34, 10, 8), fur); at(mhead, 0, mHeadY, mHeadZ); mhead.scale.set(1, 0.95, human ? 1.3 : 1.15); g.add(mhead);
    if (elf) { // panther: short muzzle, pointed ears
      g.add(at(smoothMesh(new THREE.BoxGeometry(0.26, 0.22, 0.3), fur), 0, mHeadY - 0.05, mHeadZ + 0.28));
      [-1, 1].forEach(function (s) { g.add(at(facetMesh(new THREE.ConeGeometry(0.1, 0.22, 4), fur), 0.18 * s, mHeadY + 0.32, mHeadZ - 0.05)); });
    } else if (human) { // horse: long muzzle, small ears, forelock + neck mane
      g.add(at(smoothMesh(new THREE.BoxGeometry(0.26, 0.28, 0.62), fur), 0, mHeadY - 0.1, mHeadZ + 0.42));
      g.add(at(facetMesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), furD), 0, mHeadY - 0.16, mHeadZ + 0.72));
      [-1, 1].forEach(function (s) { g.add(at(facetMesh(new THREE.ConeGeometry(0.07, 0.2, 4), fur), 0.13 * s, mHeadY + 0.34, mHeadZ - 0.04)); });
      var hm = smoothMesh(new THREE.BoxGeometry(0.14, 0.85, 0.5), furD); at(hm, 0, mHeadY + 0.1, mHeadZ - 0.52); hm.rotation.x = 0.55; g.add(hm);
    } else { // wolf: long snout, shaggy
      g.add(at(smoothMesh(new THREE.BoxGeometry(0.24, 0.2, 0.5), fur), 0, mHeadY - 0.08, mHeadZ + 0.34));
      g.add(at(facetMesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), furD), 0, mHeadY - 0.08, mHeadZ + 0.6));
      [-1, 1].forEach(function (s) { g.add(at(facetMesh(new THREE.ConeGeometry(0.11, 0.26, 4), furD), 0.16 * s, mHeadY + 0.34, mHeadZ - 0.02)); });
      var mane = smoothMesh(new THREE.SphereGeometry(0.4, 9, 7), furD); at(mane, 0, mHeadY - 0.1, mHeadZ - 0.45); mane.scale.set(1.1, 1.1, 0.7); g.add(mane);
    }
    [-1, 1].forEach(function (s) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), mEye); at(e, 0.13 * s, mHeadY + 0.05, mHeadZ + 0.26); g.add(e); glow.push(e); });
    if (!human) { // tribal markings (teal panther / red wolf); horses go unmarked
      [-1, 1].forEach(function (s) { var mk = facetMesh(new THREE.ConeGeometry(0.05, 0.22, 3), markM); at(mk, 0.21 * s, mHeadY - 0.02, mHeadZ + 0.16); mk.rotation.x = 1.4; mk.rotation.z = s * 0.5; g.add(mk); });
      [-0.78, 0.5].forEach(function (z) { var st = facetMesh(new THREE.BoxGeometry(0.46, 0.05, 0.14), markM); at(st, 0, bodyY + 0.44, z); g.add(st); });
    }
    // S-curved, tufted tail: a jointed chain whose segment angles alternate so
    // the tail flows back, dips, rises, then curls over (a sinuous cat tail).
    if (human) { // horse tail: hangs down and back
      var ht = smoothMesh(P.limbGeo(0.1, 1.0), furD); at(ht, 0, bodyY - 0.05, -1.3); ht.rotation.x = 2.3; g.add(ht);
      g.add(at(smoothMesh(P.limbGeo(0.07, 0.6), furD), 0, bodyY - 0.45, -1.4));
    } else {
      var tail = new THREE.Group(); var segLen = 0.32;
      var tdefs = [{ r: 0.085, a: 0.0 }, { r: 0.07, a: 0.75 }, { r: 0.055, a: -1.0 }, { r: 0.045, a: -0.75 }, { r: 0.038, a: 0.55 }];
      var seg = tail;
      tdefs.forEach(function (d, i) {
        var j = new THREE.Group(); j.rotation.x = d.a; if (i > 0) j.position.y = segLen;
        j.add(at(smoothMesh(P.limbGeo(d.r, segLen), elf ? fur : furD), 0, segLen * 0.5, 0));
        seg.add(j); seg = j;
      });
      seg.add(at(facetMesh(new THREE.SphereGeometry(0.1, 7, 6), elf ? markM : furD), 0, segLen + 0.04, 0));
      at(tail, 0, bodyY + 0.28, -1.22); tail.rotation.x = -0.45; g.add(tail);
    }

    // ---- rider (own group, seated back on the saddle) ----
    var rider = new THREE.Group();
    var seatY = bodyY + 0.5, hs = 0.95;
    rider.add(at(smoothMesh(P.torsoGeo(0.32, 0.42, 0.85), cloth), 0, seatY + 0.45, 0));
    rider.add(at(smoothMesh(P.torsoGeo(0.36, 0.36, 0.22), sashM), 0, seatY + 0.7, 0));
    // legs draped down the flanks
    [-1, 1].forEach(function (s) {
      var thigh = smoothMesh(P.limbGeo(0.13, 0.5), cloth); at(thigh, 0.34 * s, seatY + 0.08, 0.05); thigh.rotation.z = -s * 0.5; thigh.rotation.x = 0.3; rider.add(thigh);
      var calf = smoothMesh(P.limbGeo(0.12, 0.44), skin); at(calf, 0.5 * s, seatY - 0.38, 0.12); calf.rotation.z = -s * 0.1; rider.add(calf);
    });
    var headY = seatY + 1.05;
    var headR = buildHead(rider, { skin: skin, headY: headY, headScale: hs, earLen: elf ? 0.8 : 0.4, ears: human ? 'round' : 'pointed', earDroop: elf ? 0.9 : 1.3, eye: pal.eye, eyeGlow: human ? false : undefined, brow: orc, taper: elf ? 0.18 : 0.05 });
    if (elf) { var hb = smoothMesh(P.headGeo(0.52 * hs, 0.12), LPF.toon(pal.hair, { ramp: LPF.RAMP.cloth })); at(hb, 0, headY + 0.06, -0.12); hb.scale.set(1.04, 1.1, 0.9); rider.add(hb);
      [-1, 1].forEach(function (s) { var a = antler(LPF.toon(pal.antler, { ramp: LPF.RAMP.cloth }), s); at(a, headR * 0.55 * s, headY + 0.3, -0.04); rider.add(a); }); }
    else if (human) { // Knight: hair + steel helm + noseguard + blue plume
      rider.add(at(smoothMesh(P.headGeo(0.5 * hs, 0.1), LPF.toon(pal.hair, { ramp: LPF.RAMP.cloth })), 0, headY + 0.08, -0.05));
      rider.add(at(facetMesh(new THREE.SphereGeometry(0.5 * hs + 0.06, 9, 6, 0, 6.3, 0, 1.7), steel), 0, headY + 0.1, 0));
      rider.add(at(facetMesh(new THREE.BoxGeometry(0.1, 0.4, 0.12), steel), 0, headY - 0.02, 0.5 * hs * 0.92));
      var pl = facetMesh(new THREE.ConeGeometry(0.12, 0.5, 5), cloth); at(pl, 0, headY + 0.62 * hs, -0.06); rider.add(pl); }
    else { rider.add(at(smoothMesh(new THREE.BoxGeometry(0.52 * hs, 0.3, 0.42), skin), 0, headY - 0.28, 0.3));
      rider.add(at(smoothMesh(new THREE.BoxGeometry(0.34 * hs, 0.14, 0.12), LPF.toon(0x3a1410, { ramp: LPF.RAMP.cloth, rim: false })), 0, headY - 0.24, 0.47));
      [-1, 1].forEach(function (s) { var tk = facetMesh(P.tuskGeo(0.11, 0.55), LPF.toon(pal.bone, { ramp: LPF.RAMP.cloth })); at(tk, 0.15 * s, headY - 0.02, 0.45); tk.rotation.z = -s * 0.16; rider.add(tk); });
      rider.add(at(smoothMesh(new THREE.SphereGeometry(0.14, 8, 6), LPF.toon(pal.hair, { ramp: LPF.RAMP.cloth })), 0, headY + 0.5 * hs, -0.05)); }
    var mats = { accent: accent, gem: gem, blade: blade, steel: steel, wood: LPF.toon(pal.wood, { ramp: LPF.RAMP.cloth }), sash: sashM };
    // Huntress throws a glaive; Raider wields a spear; Knight couches a long lance
    var wpn = elf ? throwGlaive(mats) : spear(mats, human ? 3.2 : 2.5, steel);
    if (elf) wpn.scale.setScalar(1.25);
    var rH = at(floatingHand(skin, 0.15), 0.42, seatY + 0.35, 0.25);
    var lH = at(floatingHand(skin, 0.15), -0.42, seatY + 0.35, 0.2);
    wpn.position.copy(rH.position);
    if (elf) { wpn.position.y += 0.25; wpn.position.z += 0.15; wpn.rotation.x = -0.2; }
    else if (human) { wpn.rotation.x = 1.45; wpn.position.z += 0.1; }   // couched lance, tip leveled FORWARD (+Z)
    else { wpn.rotation.z = -0.4; wpn.rotation.x = -0.25; }
    rider.add(wpn); rider.add(rH); rider.add(lH);
    if (human) { var sh = kiteShield(mats); sh.scale.setScalar(0.9); sh.position.copy(lH.position); sh.position.z += 0.12; rider.add(sh); }
    (wpn.userData.glow || []).forEach(function (x) { glow.push(x); });
    rider.position.set(0, -0.08, -0.34);   // seat back onto the mid-back, slightly lower
    g.add(rider);

    g.userData.emissiveMeshes = glow;
    LPF.outlineGroup(g, 0.026, elf ? 0x1a1226 : 0x141008);
    return finish(g);
  };

  /* ============================ METABALL BODIES (#4) ============================
   * Fuse a skeleton of metaballs into ONE seamless implicit skin via MarchingCubes,
   * then bake it to a static smooth mesh. No part-overlap seams — fully organic.
   * balls: [[x,y,z,strength,subtract], ...] in field space [0,1]. */
  LPF.metaballSkin = function (balls, mat, opts) {
    opts = opts || {};
    if (!THREE.MarchingCubes) { console.warn('MarchingCubes not loaded'); return new THREE.Group(); }
    var res = opts.res || 64;
    var mc = new THREE.MarchingCubes(res, mat, true, false, 300000);
    mc.isolation = opts.isolation != null ? opts.isolation : 60;
    mc.reset();
    balls.forEach(function (b) { mc.addBall(b[0], b[1], b[2], b[3] == null ? 0.55 : b[3], b[4] == null ? 12 : b[4]); });
    mc.update();
    var count = mc.count | 0;
    var src = mc.geometry.attributes.position.array;
    var arr = new Float32Array(count * 3); arr.set(src.subarray(0, count * 3));
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    if (THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeVertices) geo = THREE.BufferGeometryUtils.mergeVertices(geo, 1e-4);
    geo.computeVertexNormals();
    geo.computeBoundingBox(); var bb = geo.boundingBox; var h = (bb.max.y - bb.min.y) || 1;
    var sc = (opts.height || 3.2) / h;
    geo.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2);
    geo.scale(sc, sc, sc);
    var m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  // Humanoid metaball skeleton (field space [0,1]); athletic elf proportions.
  LPF.elfSkeletonBalls = function () {
    var b = [], CX = 0.5, CZ = 0.5, SUB = 24;                 // tight falloff so limbs don't fuse
    // legs (ankle→thigh) — spaced wide so the gap survives
    [-1, 1].forEach(function (s) { var x = CX + 0.1 * s;
      [[0.08, 0.18], [0.16, 0.2], [0.26, 0.24], [0.36, 0.2], [0.43, 0.26]].forEach(function (p) { b.push([x, p[0], CZ, p[1], SUB]); }); });
    b.push([CX, 0.47, CZ, 0.32, SUB]);                        // hips
    [[0.53, 0.26], [0.59, 0.24], [0.65, 0.28], [0.7, 0.3]].forEach(function (p) { b.push([CX, p[0], CZ, p[1], SUB]); }); // waist→chest→shoulders
    [-1, 1].forEach(function (s) { b.push([CX + 0.13 * s, 0.69, CZ, 0.22, SUB]); });   // shoulders
    [-1, 1].forEach(function (s) { var x0 = CX + 0.18 * s;    // arms (shoulder→wrist), splayed out from torso
      [[0.66, 0.17], [0.6, 0.15], [0.54, 0.14], [0.49, 0.13]].forEach(function (p, i) { b.push([x0 + 0.015 * s * i, p[0], CZ, p[1], SUB]); }); });
    b.push([CX, 0.73, CZ, 0.16, SUB]);                        // neck
    b.push([CX, 0.82, CZ, 0.27, SUB]);                        // head
    return b;
  };

  /* ===================== BLOCKY NIGHT ELF (archer concept) =====================
   * Matches the moody low-poly concept: a faceted CUBE head with pointed ears, a
   * jagged pale crown and a top spike, a slim robed body with a belt and a raised
   * back collar, thin straight legs, and a stepped C-curve bow held to the side.
   * Deliberately ANGULAR / flat-shaded (not the smooth heroic elf). */
  LPF.buildNightElf = function (params) {
    var p = Object.assign({ outline: 0 }, params || {});
    var pal = Object.assign({ skin: 0x8d88c6, skinD: 0x6f6aa6, robe: 0x2c2c4e, robeD: 0x1c1c34,
      boot: 0x121023, crown: 0xd9d4ea, bow: 0x9a93c6, eye: 0xbfeaff }, (params && params.palette) || {});
    var Mc = function (c, o) { return LPF.toon(c, Object.assign({ ramp: LPF.RAMP.cloth }, o || {})); };
    var Mm = function (c, o) { return LPF.toon(c, Object.assign({ ramp: LPF.RAMP.metal }, o || {})); };
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimColor: 0xb6a6ff, rimStrength: 0.2 });
    var skinD = Mc(pal.skinD), robe = Mc(pal.robe), robeD = Mc(pal.robeD), boot = Mc(pal.boot),
      crown = Mm(pal.crown, { rimColor: 0xffffff, rimStrength: 0.2 }), bowM = Mm(pal.bow),
      eye = LPF.toon(pal.eye, { ramp: LPF.RAMP.metal, emissive: pal.eye, emissiveIntensity: 0.6, rim: false });
    var g = new THREE.Group(); var glow = [];
    var hipY = 0.92, TH = 1.02, shoulderY = hipY + TH;

    // ── legs: thin straight, simple forward feet ──
    [-1, 1].forEach(function (s) {
      g.add(at(facetMesh(new THREE.BoxGeometry(0.2, hipY, 0.22), boot), 0.17 * s, hipY * 0.5, 0));
      g.add(at(facetMesh(new THREE.BoxGeometry(0.24, 0.16, 0.36), boot), 0.17 * s, 0.07, 0.09));
    });
    // ── torso: slim tapered robe + belt + raised back collar ──
    g.add(at(facetMesh(new THREE.BoxGeometry(0.6, TH, 0.42), robe), 0, hipY + TH * 0.5, 0));
    g.add(at(facetMesh(new THREE.BoxGeometry(0.64, 0.14, 0.46), robeD), 0, hipY + 0.05, 0));            // belt
    g.add(at(facetMesh(new THREE.BoxGeometry(0.5, 0.52, 0.16), robeD), 0, shoulderY - 0.08, -0.22));    // back collar/cloak
    [-1, 1].forEach(function (s) { g.add(at(facetMesh(new THREE.BoxGeometry(0.24, 0.24, 0.36), robe), 0.34 * s, shoulderY - 0.05, 0)); });   // shoulders
    // ── arms: thin (left hangs; right will hold the bow) ──
    g.add(at(facetMesh(new THREE.BoxGeometry(0.15, TH * 0.74, 0.17), skin), -0.42, hipY + TH * 0.46, 0.04));
    g.add(at(facetMesh(new THREE.BoxGeometry(0.15, TH * 0.66, 0.17), skin), 0.42, hipY + TH * 0.5, 0.12));

    // ── head: a faceted CUBE with pointed ears, a top spike, a jagged pale crown ──
    var headR = 0.27, headY = shoulderY + 0.05 + headR;
    g.add(at(facetMesh(new THREE.BoxGeometry(headR * 2, headR * 2, headR * 1.92), skin), 0, headY, 0.02));
    [-1, 1].forEach(function (s) { var ear = facetMesh(new THREE.ConeGeometry(0.12, 0.46, 4), skin); at(ear, headR * 1.02 * s, headY + 0.06, -0.06); ear.rotation.z = s * 1.15; ear.rotation.y = s * 0.4; g.add(ear); });   // pointed ears
    var spk = facetMesh(new THREE.ConeGeometry(0.09, 0.34, 4), skinD); at(spk, 0.22, headY + headR + 0.12, -0.08); spk.rotation.z = -0.32; g.add(spk);   // top spike
    [-0.34, -0.12, 0.12, 0.34].forEach(function (x, i) { var c = facetMesh(new THREE.ConeGeometry(0.08, i % 2 ? 0.3 : 0.2, 4), crown); at(c, x, headY + headR * 0.62 + (i % 2 ? 0.05 : 0), headR * 0.78); g.add(c); });   // jagged pale crown
    [-1, 1].forEach(function (s) { var e = at(facetMesh(new THREE.BoxGeometry(0.14, 0.06, 0.04), eye), 0.18 * s, headY + 0.02, headR * 0.97); g.add(e); glow.push(e); });   // glowing eyes

    // ── bow: a stepped C-curve (low-seg faceted arc) + string, held to the right ──
    var bowGrp = new THREE.Group();
    var arc = new THREE.Mesh(LPF.facet(new THREE.TorusGeometry(0.52, 0.05, 4, 7, Math.PI * 1.15)), bowM); arc.rotation.z = -Math.PI / 2; bowGrp.add(arc);
    bowGrp.add(at(facetMesh(new THREE.BoxGeometry(0.025, 0.98, 0.025), crown), 0.0, 0, 0));   // string
    at(bowGrp, 0.56, hipY + TH * 0.5, 0.16);
    g.add(bowGrp);

    g.userData.emissiveMeshes = glow;
    if (p.outline) LPF.outlineGroup(g, p.outline, 0x0c0a18);
    return finish(g);
  };

  /* ===================== MINIMALIST RED-HELM WARRIOR =====================
   * Matches the clean iso concept: a SMOOTH red dome helm with a pale face slot,
   * a chunky rounded grey body, small red shoulder/hip accents, a flat sword in
   * the left hand + a square shield in the right, and blocky grey legs with
   * L-feet. Soft matte flat colours. Rounded masses, simple blocky limbs/props. */
  LPF.buildRedWarrior = function (params) {
    var p = Object.assign({ outline: 0 }, params || {});
    var pal = Object.assign({ red: 0xb14a3c, redD: 0x8f3a2e, body: 0x9c988c, bodyD: 0x827d70,
      face: 0xece1cb, steel: 0xa9a399, steelD: 0x8b857a }, (params && params.palette) || {});
    var Mc = function (c, o) { return LPF.toon(c, Object.assign({ ramp: LPF.RAMP.cloth, rim: false }, o || {})); };
    var red = Mc(pal.red), redD = Mc(pal.redD), body = Mc(pal.body), bodyD = Mc(pal.bodyD),
      face = Mc(pal.face), steel = Mc(pal.steel), steelD = Mc(pal.steelD);
    var g = new THREE.Group();
    var hipY = 0.72, TH = 1.02, shoulderY = hipY + TH;

    // ── legs: thick grey blocks + forward L-feet ──
    [-1, 1].forEach(function (s) {
      g.add(at(facetMesh(new THREE.BoxGeometry(0.32, hipY, 0.34), body), 0.24 * s, hipY * 0.5, 0));
      g.add(at(facetMesh(new THREE.BoxGeometry(0.34, 0.18, 0.5), body), 0.24 * s, 0.09, 0.12));
    });
    // ── body: a smooth rounded grey barrel with a domed shoulder top ──
    var torso = smoothMesh(P.profileLimb([[0.46, 0], [0.6, TH * 0.46], [0.6, TH * 0.78], [0.46, TH]], 20), body);
    torso.scale.set(1.0, 1.0, 0.92); at(torso, 0, hipY + 0.02, 0); g.add(torso);
    var shoulders = smoothMesh(new THREE.SphereGeometry(0.58, 18, 14), body); shoulders.scale.set(1.04, 0.66, 0.96); at(shoulders, 0, shoulderY - 0.06, 0); g.add(shoulders);
    // (red accents are gauntlet cuffs at the wrists — built with the arms below)

    // ── head: pale face block under a TALL smooth red dome helm. The dome caps the
    //    crown + back + upper sides; the pale face stays exposed below the brow,
    //    framed by red helm sides, with a small nose poking from the slot. ──
    var headR = 0.38, headY = shoulderY + headR * 0.62;
    g.add(at(facetMesh(new THREE.BoxGeometry(headR * 1.4, headR * 1.5, headR * 1.18), face), 0, headY, 0.05));  // pale face
    var helm = smoothMesh(new THREE.SphereGeometry(headR + 0.06, 20, 15, 0, Math.PI * 2, 0, 1.58), red);
    at(helm, 0, headY + 0.15, -0.02); helm.scale.set(1.12, 1.32, 1.12); g.add(helm);                            // tall smooth red dome
    [-1, 1].forEach(function (s) { var ch = facetMesh(new THREE.BoxGeometry(0.1, headR * 1.3, headR * 1.12), red); at(ch, headR * 0.7 * s, headY - 0.02, 0.0); g.add(ch); });   // red helm sides framing the face
    g.add(at(facetMesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), face), 0, headY - 0.05, headR * 0.84));         // small nose poking from the slot

    // ── left arm + sword: short grey stub, RED gauntlet cuff at the wrist ──
    g.add(at(facetMesh(new THREE.BoxGeometry(0.2, 0.42, 0.22), body), -0.52, hipY + TH * 0.52, 0.04));         // short upper arm
    g.add(at(facetMesh(new THREE.BoxGeometry(0.22, 0.24, 0.26), red), -0.62, hipY + TH * 0.32, 0.1));          // red gauntlet
    var sword = new THREE.Group(); sword.position.set(-0.66, hipY + TH * 0.3, 0.14); sword.rotation.z = 0.66;
    sword.add(at(facetMesh(new THREE.BoxGeometry(0.12, 1.05, 0.05), steel), 0, -0.58, 0));                      // blade
    sword.add(at(facetMesh(new THREE.BoxGeometry(0.26, 0.08, 0.1), steelD), 0, -0.02, 0));                      // crossguard
    g.add(sword);
    // ── right arm + shield: short grey stub, RED gauntlet cuff, flat slab shield ──
    g.add(at(facetMesh(new THREE.BoxGeometry(0.2, 0.42, 0.22), body), 0.52, hipY + TH * 0.5, 0.04));           // short upper arm
    g.add(at(facetMesh(new THREE.BoxGeometry(0.22, 0.24, 0.26), red), 0.6, hipY + TH * 0.3, 0.12));            // red gauntlet
    var shield = facetMesh(new THREE.BoxGeometry(0.46, 0.6, 0.09), steel); at(shield, 0.74, hipY + TH * 0.2, 0.18); shield.rotation.y = -0.26; g.add(shield);

    g.userData.emissiveMeshes = [];
    if (p.outline) LPF.outlineGroup(g, p.outline, 0x3a322a);
    return finish(g);
  };

  LPF.buildCharacter = function (name, params) {
    var role = params && params.role;
    if (name === 'nightelf') return LPF.buildNightElf(params);
    if (name === 'redwarrior') return LPF.buildRedWarrior(params);
    if (name === 'meta') {   // metaball-skin proof (organic body, no armor)
      var skinM = LPF.toon(0x8f7ad0, { ramp: LPF.RAMP.skin, rimColor: 0xbfa0ff, rimStrength: 0.25 });
      return finish(LPF.metaballSkin(LPF.elfSkeletonBalls(), skinM, { res: 96, isolation: 40, height: 3.4 }));
    }
    if (name === 'orcwar') return LPF.buildOrcWarrior(params);
    if (role === 'lancer') return LPF.buildMounted(name, params);
    if (name === 'human') return LPF.buildHuman(params);
    if (name === 'orc') return LPF.buildOrc(params);
    return LPF.buildElf(params);
  };
})(typeof window !== 'undefined' ? window : globalThis);
