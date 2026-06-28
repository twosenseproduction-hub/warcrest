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
    [-1, 1].forEach(function (s) { var e = new THREE.Mesh(new THREE.SphereGeometry((opt.eyeGlow === false ? 0.06 : 0.085) * hs, 8, 6), eyeM); e.position.set(0.17 * hs * s, headY + 0.02, headR * 0.88); g.add(e); });
    if (opt.brow) { var brow = smoothMesh(new THREE.BoxGeometry(0.72 * hs, 0.17, 0.22), skin); brow.position.set(0, headY + 0.17, headR * 0.78); g.add(brow); }
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
    palette: { skin: 0x564a98, cloth: 0x163433, accent: 0xf2c14e, gem: 0x57c23a, blade: 0x8fe66a,
      hair: 0xede8da, hairTip: 0xf2c14e, eye: 0x76e85a, sash: 0xa84768, antler: 0x6e4a2a, wood: 0x7a5a38, steel: 0xcfd6de },
    headScale: 1.2, earLen: 0.85, torsoH: 1.25, limbLen: 0.9, outline: 0.028,
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
      archer: { pauld: false, head: 'none' }, caster: { pauld: false, head: 'none', pelt: true }, hero: { pauld: true, cape: true } }[role] || {};
    var g = new THREE.Group(); var glow = [];

    [-1, 1].forEach(function (s) { g.add(at(smoothMesh(P.limbGeo(0.16, p.limbLen), cloth), 0.17 * s, p.limbLen * 0.5, 0));
      g.add(at(smoothMesh(P.limbGeo(0.17, 0.22), accent), 0.17 * s, 0.12, 0.04)); });
    g.add(at(smoothMesh(P.torsoGeo(0.4, 0.58, p.torsoH), cloth), 0, p.limbLen + p.torsoH * 0.5, 0));
    g.add(at(smoothMesh(P.torsoGeo(0.46, 0.46, 0.34), sashM), 0, p.limbLen + p.torsoH * 0.62, 0));
    g.add(at(smoothMesh(P.torsoGeo(0.5, 0.5, 0.14), accent), 0, p.limbLen + p.torsoH * 0.2, 0));

    var shoulderY = p.limbLen + p.torsoH;
    if (F.pauld) [-1, 1].forEach(function (s) { var pg = facetMesh(P.leafGemGeo(role === 'hero' ? 0.85 : 0.7, 0.9), gem); at(pg, 0.5 * s, shoulderY - 0.06, 0); pg.rotation.z = -s * 0.5; g.add(pg); glow.push(pg); });
    if (F.cape) { var cp = smoothMesh(new THREE.BoxGeometry(0.95, 1.5, 0.08), sashM); at(cp, 0, p.limbLen + p.torsoH * 0.55, -0.34); cp.rotation.x = 0.12; g.add(cp); }
    if (F.pelt) { // druid fur mantle over the shoulders
      var pelt = smoothMesh(new THREE.SphereGeometry(0.5, 10, 7), M(pal.antler)); pelt.scale.set(1.15, 0.55, 1.0); at(pelt, 0, shoulderY - 0.02, 0); g.add(pelt); }

    var headY = shoulderY + 0.5 * p.headScale;
    var headR = buildHead(g, { skin: skin, headY: headY, headScale: p.headScale, earLen: p.earLen, eye: pal.eye });
    if (F.head === 'hood') { var hd = facetMesh(new THREE.ConeGeometry(0.62 * p.headScale, 0.95, 7), cloth); at(hd, 0, headY + 0.18, 0); g.add(hd); }
    else { var hairBack = smoothMesh(P.headGeo(0.54 * p.headScale, 0.12), hair); at(hairBack, 0, headY + 0.06, -0.12); hairBack.scale.set(1.04, 1.1, 0.9); g.add(hairBack);
      [-1, 1].forEach(function (s) { var a = antler(antlerM, s); at(a, headR * 0.55 * s, headY + 0.3, -0.04); g.add(a); });
      g.add(at(facetMesh(new THREE.ConeGeometry(0.1, 0.28, 5), hairTip), 0, headY + 0.52 * p.headScale, -0.02));
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
      lancer: { head: 'helm', pauld: true, shield: true }, archer: { head: 'hood', beard: true, cape: true },
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
    if (F.cape) { var cp = smoothMesh(new THREE.BoxGeometry(0.9 * bw, dwarf ? 1.0 : 1.5, 0.08), M(role === 'hero' ? 0x9c2b2b : pal.cloth)); at(cp, 0, shoulderY - (dwarf ? 0.35 : 0.1), -0.34 * bw); cp.rotation.x = 0.12; g.add(cp); }

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
    var elf = race === 'elf';
    var pal = elf ? ELF.palette : ORC.palette;
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin, rimColor: elf ? 0xbfa0ff : 0xc9e08a, rimStrength: 0.2 });
    var cloth = LPF.toon(pal.cloth, { ramp: LPF.RAMP.cloth });
    var accent = LPF.toon(pal.accent, { ramp: LPF.RAMP.metal });
    var steel = LPF.toon(pal.steel, { ramp: LPF.RAMP.metal });
    var sashM = LPF.toon(pal.sash, { ramp: LPF.RAMP.cloth });
    var gem = LPF.toon(pal.gem || 0x57c23a, { ramp: LPF.RAMP.metal, emissive: pal.gem || 0x57c23a, emissiveIntensity: 0.3, rim: false });
    var blade = LPF.toon(elf ? pal.blade : pal.steel, { ramp: LPF.RAMP.metal, emissive: elf ? pal.blade : 0x000000, emissiveIntensity: elf ? 1.2 : 0, rim: false }); if (elf) blade.userData.glow = true;
    // mount fur
    var fur = LPF.toon(elf ? 0x2c2738 : 0x7b7f86, { ramp: LPF.RAMP.skin, rim: false });
    var furD = LPF.toon(elf ? 0x1c1926 : 0x55585c, { ramp: LPF.RAMP.cloth });
    var mEye = LPF.toon(elf ? 0x5ff0dc : 0xf0b43a, { ramp: LPF.RAMP.metal, emissive: elf ? 0x5ff0dc : 0xf0b43a, emissiveIntensity: 0.85, rim: false });
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
    var neck = smoothMesh(P.limbGeo(0.22, 0.6), fur); at(neck, 0, bodyY + 0.4, 1.1); neck.rotation.x = elf ? 0.9 : 0.7; g.add(neck);
    var mHeadY = bodyY + (elf ? 0.75 : 0.7), mHeadZ = elf ? 1.45 : 1.5;
    var mhead = smoothMesh(new THREE.SphereGeometry(0.34, 10, 8), fur); at(mhead, 0, mHeadY, mHeadZ); mhead.scale.set(1, 0.95, 1.15); g.add(mhead);
    if (elf) { // panther: short muzzle, pointed ears
      g.add(at(smoothMesh(new THREE.BoxGeometry(0.26, 0.22, 0.3), fur), 0, mHeadY - 0.05, mHeadZ + 0.28));
      [-1, 1].forEach(function (s) { g.add(at(facetMesh(new THREE.ConeGeometry(0.1, 0.22, 4), fur), 0.18 * s, mHeadY + 0.32, mHeadZ - 0.05)); });
    } else { // wolf: long snout, shaggy
      g.add(at(smoothMesh(new THREE.BoxGeometry(0.24, 0.2, 0.5), fur), 0, mHeadY - 0.08, mHeadZ + 0.34));
      g.add(at(facetMesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), furD), 0, mHeadY - 0.08, mHeadZ + 0.6));
      [-1, 1].forEach(function (s) { g.add(at(facetMesh(new THREE.ConeGeometry(0.11, 0.26, 4), furD), 0.16 * s, mHeadY + 0.34, mHeadZ - 0.02)); });
      var mane = smoothMesh(new THREE.SphereGeometry(0.4, 9, 7), furD); at(mane, 0, mHeadY - 0.1, mHeadZ - 0.45); mane.scale.set(1.1, 1.1, 0.7); g.add(mane);
    }
    [-1, 1].forEach(function (s) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), mEye); at(e, 0.13 * s, mHeadY + 0.05, mHeadZ + 0.26); g.add(e); glow.push(e); });
    // tribal markings: teal cheek flashes + back stripes (elf) / red war-paint (orc)
    [-1, 1].forEach(function (s) { var mk = facetMesh(new THREE.ConeGeometry(0.05, 0.22, 3), markM); at(mk, 0.21 * s, mHeadY - 0.02, mHeadZ + 0.16); mk.rotation.x = 1.4; mk.rotation.z = s * 0.5; g.add(mk); });
    [-0.78, 0.5].forEach(function (z) { var st = facetMesh(new THREE.BoxGeometry(0.46, 0.05, 0.14), markM); at(st, 0, bodyY + 0.44, z); g.add(st); });
    // S-curved, tufted tail: a jointed chain whose segment angles alternate so
    // the tail flows back, dips, rises, then curls over (a sinuous cat tail).
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
    var headR = buildHead(rider, { skin: skin, headY: headY, headScale: hs, earLen: elf ? 0.8 : 0.4, earDroop: elf ? 0.9 : 1.3, eye: pal.eye, brow: !elf, taper: elf ? 0.18 : 0.05 });
    if (elf) { var hb = smoothMesh(P.headGeo(0.52 * hs, 0.12), LPF.toon(pal.hair, { ramp: LPF.RAMP.cloth })); at(hb, 0, headY + 0.06, -0.12); hb.scale.set(1.04, 1.1, 0.9); rider.add(hb);
      [-1, 1].forEach(function (s) { var a = antler(LPF.toon(pal.antler, { ramp: LPF.RAMP.cloth }), s); at(a, headR * 0.55 * s, headY + 0.3, -0.04); rider.add(a); }); }
    else { rider.add(at(smoothMesh(new THREE.BoxGeometry(0.52 * hs, 0.3, 0.42), skin), 0, headY - 0.28, 0.3));
      rider.add(at(smoothMesh(new THREE.BoxGeometry(0.34 * hs, 0.14, 0.12), LPF.toon(0x3a1410, { ramp: LPF.RAMP.cloth, rim: false })), 0, headY - 0.24, 0.47));
      [-1, 1].forEach(function (s) { var tk = facetMesh(P.tuskGeo(0.11, 0.55), LPF.toon(pal.bone, { ramp: LPF.RAMP.cloth })); at(tk, 0.15 * s, headY - 0.02, 0.45); tk.rotation.z = -s * 0.16; rider.add(tk); });
      rider.add(at(smoothMesh(new THREE.SphereGeometry(0.14, 8, 6), LPF.toon(pal.hair, { ramp: LPF.RAMP.cloth })), 0, headY + 0.5 * hs, -0.05)); }
    var mats = { accent: accent, gem: gem, blade: blade, steel: steel, wood: LPF.toon(pal.wood, { ramp: LPF.RAMP.cloth }), sash: sashM };
    var wpn = elf ? throwGlaive(mats) : spear(mats, 2.5, steel);   // Huntress throws a glaive; Raider wields a spear
    if (elf) wpn.scale.setScalar(1.25);
    var rH = at(floatingHand(skin, 0.15), 0.42, seatY + 0.35, 0.25);
    var lH = at(floatingHand(skin, 0.15), -0.42, seatY + 0.35, 0.2);
    wpn.position.copy(rH.position);
    if (elf) { wpn.position.y += 0.25; wpn.position.z += 0.15; wpn.rotation.x = -0.2; }
    else { wpn.rotation.z = -0.4; wpn.rotation.x = -0.25; }
    rider.add(wpn); rider.add(rH); rider.add(lH);
    (wpn.userData.glow || []).forEach(function (x) { glow.push(x); });
    rider.position.set(0, -0.08, -0.34);   // seat back onto the mid-back, slightly lower
    g.add(rider);

    g.userData.emissiveMeshes = glow;
    LPF.outlineGroup(g, 0.026, elf ? 0x1a1226 : 0x141008);
    return finish(g);
  };

  LPF.buildCharacter = function (name, params) {
    var role = params && params.role;
    if (role === 'lancer' && (name === 'orc' || name === 'elf')) return LPF.buildMounted(name, params);
    if (name === 'human') return LPF.buildHuman(params);
    if (name === 'orc') return LPF.buildOrc(params);
    return LPF.buildElf(params);
  };
})(typeof window !== 'undefined' ? window : globalThis);
