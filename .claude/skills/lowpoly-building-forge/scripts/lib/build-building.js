/* lowpoly-building-forge — build-building.js
 * Faction-themed buildings sharing one kit, reskinned + accented per race so each
 * reads as its faction: human (grey stone + blue shingle roof + timber + banner),
 * orc (tan stone + red tent + bone spikes + forge glow), elf (stone + green leaf
 * canopy + gold runes + leaf windows). window.LPF.buildBuilding(faction, kind). */
(function (root) {
  var THREE = root.THREE;
  var LPF = root.LPF = root.LPF || {};
  var K = LPF.kit;
  var at = K.at, facet = K.facet, smooth = K.smooth;
  var M = function (c, o) { return LPF.toon(c, Object.assign({ ramp: LPF.RAMP.cloth, rim: false }, o || {})); };
  var glowM = function (c, i) { return LPF.toon(c, { ramp: LPF.RAMP.metal, emissive: c, emissiveIntensity: i == null ? 1.2 : i, rim: false }); };

  var FACTIONS = {
    human: { stone: 0x868d98, stoneD: 0x5f656e, roof: 0x2f4f82, timber: 0x5a3e22, accent: 0xe4b53a, glow: 0xffd27a, banner: 0x2a4fa0 },
    orc: { stone: 0xa89878, stoneD: 0x7a6c4e, roof: 0x8a3320, timber: 0x4a2f1c, accent: 0xc23528, glow: 0xff7a18, bone: 0xe2dcc0, banner: 0x8a3320 },
    elf: { stone: 0x807d8e, stoneD: 0x5c5a6a, timber: 0x5a3e22, leaf: 0x5cb233, leafD: 0x356b22, accent: 0xf2c14e, glow: 0xffe07a, banner: 0x57c23a },
  };

  // Faction-flavored roof/crown for a keep or tower (group whose base sits at topY).
  function factionTop(faction, p, r, topY, glow, big) {
    var grp = new THREE.Group(); grp.position.y = topY;
    if (faction === 'elf') {
      grp.add(K.canopy(r * (big ? 1.25 : 1.0), big ? 9 : 6, M(p.leaf, { ramp: LPF.RAMP.skin }), M(p.leafD)));
      var orb = K.facet(new THREE.IcosahedronGeometry(big ? 0.3 : 0.2, 0), glowM(p.glow, 1.4)); orb.position.y = r * 0.85; grp.add(orb); glow.push(orb);
    } else if (faction === 'orc') {
      grp.add(K.tentRoof(r, r * 0.95, M(p.roof)));
      var ns = 7; for (var i = 0; i < ns; i++) { var a = i / ns * Math.PI * 2; var sp = K.boneSpike(0.55, M(p.bone)); K.at(sp, Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9); sp.rotation.z = Math.cos(a) * 0.5; sp.rotation.x = -Math.sin(a) * 0.5; grp.add(sp); }
    } else {
      var h = r * 1.25, c = K.coneRoof(r * 1.06, h, M(p.roof), 8); c.position.y = h / 2; grp.add(c);
      var fin = K.facet(new THREE.ConeGeometry(0.08, 0.5, 5), LPF.toon(p.accent, { ramp: LPF.RAMP.metal, rim: false })); fin.position.y = h + 0.2; grp.add(fin);
    }
    return grp;
  }
  // ring of merlons (crenellations) around a square top of half-width hw at height y
  function crenellate(g, hw, y, mat) {
    var n = 4, step = (hw * 2) / n;
    for (var s = -hw; s <= hw + 0.01; s += step) {
      [[s, hw], [s, -hw], [hw, s], [-hw, s]].forEach(function (q) { g.add(K.at(K.facet(new THREE.BoxGeometry(step * 0.55, 0.4, step * 0.55), mat), q[0], y, q[1])); });
    }
  }

  // ---- core helpers ----
  function rockMound(size, mat, tiers) {
    var g = new THREE.Group();
    for (var t = 0; t < tiers; t++) { var r = size * (1 - t * 0.16);
      g.add(K.at(K.facet(new THREE.CylinderGeometry(r, r * 1.1, 0.7, 9), mat), 0, t * 0.55 + 0.35, 0));
      var n = Math.round(r * 3.2); for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; var rk = K.facet(new THREE.IcosahedronGeometry(0.26 + (i % 3) * 0.08, 0), mat); K.at(rk, Math.cos(a) * r, t * 0.55 + 0.55, Math.sin(a) * r); rk.rotation.y = a; rk.scale.y = 0.8; g.add(rk); } }
    return g;
  }
  function scaffold(h, postMat, platMat) {
    var g = new THREE.Group(); var s = 0.55;
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (c) { var post = K.smooth(new THREE.CylinderGeometry(0.09, 0.11, h, 6), postMat); K.at(post, c[0] * s, h / 2, c[1] * s); post.rotation.x = c[1] * 0.05; post.rotation.z = -c[0] * 0.05; g.add(post); });
    g.add(K.at(K.facet(new THREE.BoxGeometry(s * 2.3, 0.08, 0.08), postMat), 0, h * 0.45, s));
    g.add(K.at(K.facet(new THREE.BoxGeometry(s * 2.3, 0.08, 0.08), postMat), 0, h * 0.62, -s));
    g.add(K.at(K.facet(new THREE.BoxGeometry(s * 2.5, 0.16, s * 2.5), platMat), 0, h, 0));
    var lad = new THREE.Group(); for (var i = 0; i < 5; i++) lad.add(K.at(K.facet(new THREE.BoxGeometry(0.42, 0.05, 0.05), postMat), 0, i * 0.36 + 0.25, 0));
    lad.add(K.at(K.facet(new THREE.BoxGeometry(0.05, h * 0.92, 0.05), postMat), -0.19, h * 0.46, 0)); lad.add(K.at(K.facet(new THREE.BoxGeometry(0.05, h * 0.92, 0.05), postMat), 0.19, h * 0.46, 0));
    K.at(lad, 0, 0, s + 0.12); g.add(lad); return g;
  }
  function horn(len, mat) { return K.facet(new THREE.ConeGeometry(len * 0.16, len, 5), mat); }
  function finishCore(g, faction, tier, glow) {
    g.userData = { glowMeshes: glow, faction: faction, tier: tier, footprint: { w: tier + 1, d: tier + 1 } };
    LPF.outlineGroup && LPF.outlineGroup(g, 0.03, 0x1a1620);
    var box = new THREE.Box3().setFromObject(g); var c = new THREE.Vector3(); box.getCenter(c);
    g.position.x -= c.x; g.position.z -= c.z; g.position.y -= box.min.y;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  // HUMAN: stone keep + crenellations + blue conical towers + banners
  function coreHuman(tier) {
    var p = FACTIONS.human, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber);
    var g = new THREE.Group(); var glow = [];
    g.add(K.foundation(4.0 + tier, 4.0 + tier, stoneD));
    var keepW = 2.6 + tier * 0.4, keepH = 2.6 + tier * 1.1;
    g.add(K.at(smooth(new THREE.BoxGeometry(keepW, keepH, keepW), stone), 0, keepH / 2, 0));
    g.add(K.at(smooth(new THREE.BoxGeometry(keepW * 1.05, 0.4, keepW * 1.05), stoneD), 0, keepH, 0));
    g.add(K.at(K.door(1.1, 1.5, timber), 0, 0, keepW / 2 + 0.02));
    var bw = K.window(0.6, 0.8, timber, glowM(p.glow)); K.at(bw, 0, keepH * 0.62, keepW / 2 + 0.02); g.add(bw); glow = glow.concat(bw.userData.glow);
    if (tier >= 2) crenellate(g, keepW / 2 + 0.1, keepH + 0.2, stone);
    g.add(factionTop('human', p, keepW * 0.58, keepH + 0.3, glow, tier >= 2));
    var towers = tier >= 3 ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : tier >= 2 ? [[1, -1], [-1, -1]] : [];
    var off = keepW / 2 + 0.75, th = keepH * 0.8, tr = 0.7;
    towers.forEach(function (c) { var tx = c[0] * off, tz = c[1] * off;
      g.add(K.at(K.tower(tr, th, stone, 8), tx, th / 2, tz));
      var cg = new THREE.Group(); crenellate(cg, tr + 0.05, th + 0.05, stone); cg.position.set(tx, 0, tz); g.add(cg);
      var top = factionTop('human', p, tr, th + 0.1, glow, false); top.position.x = tx; top.position.z = tz; g.add(top); });
    for (var i = 0; i < tier; i++) { var bn = K.banner(2.2 + tier * 0.3, M(p.banner), timber); K.at(bn, -keepW / 2 - 0.3, 0, (i - (tier - 1) / 2) * 0.9); g.add(bn); }
    return finishCore(g, 'human', tier, glow);
  }
  // ORC: rocky mound + big red tent hall + bone totems + wooden scaffold watchtower + forge cauldron
  function coreOrc(tier) {
    var p = FACTIONS.orc, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), bone = M(p.bone);
    var g = new THREE.Group(); var glow = [];
    g.add(rockMound(2.4 + tier * 0.5, stoneD, 1 + tier));
    var hallY = (1 + tier) * 0.55, hallW = 2.2 + tier * 0.35, hallH = 1.8 + tier * 0.5;
    g.add(K.at(smooth(new THREE.CylinderGeometry(hallW * 0.55, hallW * 0.62, hallH, 8), stone), 0, hallY + hallH / 2, 0));
    g.add(K.at(K.door(1.0, 1.4, timber), 0, hallY, hallW * 0.55 + 0.02));
    var ow = K.window(0.5, 0.5, timber, glowM(p.accent, 1.4)); K.at(ow, 0, hallY + hallH * 0.6, hallW * 0.55 + 0.02); g.add(ow); glow = glow.concat(ow.userData.glow);
    var tent = K.tentRoof(hallW * 0.72 + tier * 0.15, 1.4 + tier * 0.25, M(p.roof)); K.at(tent, 0, hallY + hallH, 0); g.add(tent);
    var ns = 6 + tier; for (var i = 0; i < ns; i++) { var a = i / ns * Math.PI * 2, R = hallW * 0.6; var sp = K.boneSpike(0.7, bone); K.at(sp, Math.cos(a) * R, hallY + hallH, Math.sin(a) * R); sp.rotation.z = Math.cos(a) * 0.5; sp.rotation.x = -Math.sin(a) * 0.5; g.add(sp); }
    // bone totems at the rim (scale with tier)
    var totems = tier >= 3 ? 4 : tier >= 2 ? 2 : 1; var tR = hallW * 0.55 + 1.3;
    for (var t = 0; t < totems; t++) { var a2 = t / totems * Math.PI * 2 + 0.6; var px = Math.cos(a2) * tR, pz = Math.sin(a2) * tR;
      g.add(K.at(smooth(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6), timber), px, 0.8, pz));
      var sk = K.facet(new THREE.SphereGeometry(0.26, 8, 6), bone); sk.scale.set(1, 1.1, 0.9); K.at(sk, px, 1.7, pz); g.add(sk);
      [-1, 1].forEach(function (s) { var hn = horn(0.4, bone); K.at(hn, px + 0.16 * s, 1.85, pz); hn.rotation.z = -s * 0.9; g.add(hn); }); }
    // wooden scaffold watchtower (tier >= 2)
    if (tier >= 2) { var sc = scaffold(2.6 + tier * 0.4, timber, stoneD); K.at(sc, tR * 0.7, hallY, -tR * 0.7); g.add(sc);
      var tt = K.tentRoof(0.8, 0.8, M(p.roof)); K.at(tt, tR * 0.7, hallY + 2.6 + tier * 0.4 + 0.1, -tR * 0.7); g.add(tt); }
    // forge cauldron with lava (bigger per tier)
    var fx = tR * 0.7, fz = tR * 0.6, fr = 0.45 + tier * 0.08;
    g.add(K.at(K.facet(new THREE.SphereGeometry(fr, 9, 7, 0, 6.3, Math.PI * 0.35, Math.PI * 0.65), M(0x2a2622)), fx, 0.55, fz));
    var lava = K.facet(new THREE.CylinderGeometry(fr * 0.82, fr * 0.82, 0.14, 9), glowM(p.glow, 1.8)); K.at(lava, fx, 0.78, fz); g.add(lava); glow.push(lava);
    return finishCore(g, 'orc', tier, glow);
  }
  // ELF: gnarled trunk-tower under a massive leaf canopy (Eldertree) + roots + runes + horns + satellite canopy huts
  function coreElf(tier) {
    var p = FACTIONS.elf, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), leaf = M(p.leaf, { ramp: LPF.RAMP.skin }), leafD = M(p.leafD);
    var g = new THREE.Group(); var glow = [];
    g.add(K.foundation(3.6 + tier * 0.8, 3.6 + tier * 0.8, stone));
    // gnarled trunk tower
    var trunkH = 3.0 + tier * 1.3, trunkR = 0.9 + tier * 0.18;
    g.add(K.at(smooth(new THREE.CylinderGeometry(trunkR * 0.8, trunkR * 1.2, trunkH, 8), timber), 0, trunkH / 2, 0));
    // flared roots
    var nr = 6; for (var i = 0; i < nr; i++) { var a = i / nr * Math.PI * 2; var root = K.facet(new THREE.CylinderGeometry(0.1, 0.34, 1.4, 6), timber); K.at(root, Math.cos(a) * trunkR * 0.9, 0.6, Math.sin(a) * trunkR * 0.9); root.rotation.x = -Math.sin(a) * 0.5; root.rotation.z = Math.cos(a) * 0.5; g.add(root); }
    g.add(K.at(K.door(1.0, 1.5, timber), 0, 0, trunkR * 1.05));
    var lw = K.leafWindow(0.42, timber, glowM(p.glow, 0.9)); K.at(lw, 0, trunkH * 0.5, trunkR * 1.05); g.add(lw); glow = glow.concat(lw.userData.glow);
    // gold rune orbs climbing the trunk
    for (var r = 0; r < tier + 1; r++) { var orb = K.facet(new THREE.IcosahedronGeometry(0.18, 0), glowM(p.glow, 1.3)); K.at(orb, 0, trunkH * (0.3 + r * 0.18), trunkR * 1.0); g.add(orb); glow.push(orb); }
    // massive canopy crown (grows per tier)
    g.add(K.at(K.canopy(2.0 + tier * 0.5, 8 + tier * 2, leaf, leafD), 0, trunkH + 0.6 + tier * 0.3, 0));
    // horns jutting from the canopy
    var nh = 3 + tier; for (var h = 0; h < nh; h++) { var a3 = h / nh * Math.PI * 2; var hn = horn(0.9 + tier * 0.15, timber); K.at(hn, Math.cos(a3) * (1.4 + tier * 0.3), trunkH + 0.8, Math.sin(a3) * (1.4 + tier * 0.3)); hn.rotation.z = Math.cos(a3) * 0.7; hn.rotation.x = -Math.sin(a3) * 0.7; g.add(hn); }
    // satellite canopy huts (tier 2+)
    var huts = tier >= 3 ? 3 : tier >= 2 ? 2 : 0; var hR = 2.6 + tier * 0.4;
    for (var s = 0; s < huts; s++) { var a4 = s / huts * Math.PI * 2 + 0.5; var hx = Math.cos(a4) * hR, hz = Math.sin(a4) * hR;
      g.add(K.at(smooth(new THREE.BoxGeometry(1.3, 1.4, 1.3), stoneD), hx, 0.7, hz));
      g.add(K.at(K.canopy(1.0, 5, leaf, leafD), hx, 1.9, hz)); }
    return finishCore(g, 'elf', tier, glow);
  }
  function buildCore(faction, tier) {
    tier = Math.max(1, Math.min(3, tier || 1));
    return faction === 'orc' ? coreOrc(tier) : faction === 'elf' ? coreElf(tier) : coreHuman(tier);
  }
  LPF.buildCore = buildCore;

  LPF.buildBuilding = function (faction, kind, tier) {
    if (kind === 'core') return buildCore(faction, tier || 1);
    var p = FACTIONS[faction] || FACTIONS.human;
    var g = new THREE.Group(); var glow = [];
    var stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), accent = LPF.toon(p.accent, { ramp: LPF.RAMP.metal, rim: false });
    g.add(K.foundation(3.4, 3.0, stoneD));

    // shared stone walls (a chunky one-storey box) + arched door + window
    var bodyW = 2.8, bodyH = K.WALL_H, bodyD = 2.4;
    g.add(at(smooth(new THREE.BoxGeometry(bodyW, bodyH, bodyD), stone), 0, bodyH / 2, 0));
    g.add(at(K.door(0.9, 1.3, timber), 0, 0, bodyD / 2 + 0.02));

    if (faction === 'human') {
      // grey stone + timber corner posts + blue gable shingle roof + chimney + banner + warm window
      [-1, 1].forEach(function (s) { g.add(at(smooth(new THREE.BoxGeometry(0.2, bodyH, 0.2), timber), bodyW / 2 * s, bodyH / 2, bodyD / 2)); });   // timber corner posts
      g.add(at(K.gableRoof(bodyW + 0.5, bodyD + 0.5, 1.3, M(p.roof)), 0, bodyH, 0));
      g.add(at(smooth(new THREE.BoxGeometry(bodyW + 0.5, 0.12, bodyD + 0.5), timber), 0, bodyH, 0));   // eave board
      g.add(at(K.chimney(1.1, stoneD), bodyW * 0.3, bodyH + 0.7, -bodyD * 0.2));
      var hw = K.window(0.55, 0.7, timber, glowM(p.glow)); at(hw, -0.8, 1.4, bodyD / 2 + 0.02); g.add(hw); glow = glow.concat(hw.userData.glow);
      var bn = K.banner(2.0, M(p.banner), timber); at(bn, -bodyW / 2 - 0.2, 0, bodyD / 2 - 0.2); g.add(bn);
    } else if (faction === 'orc') {
      // tan stone + red draped tent roof + bone spikes around the eave + forge-glow window + cauldron
      var tent = K.tentRoof(1.85, 1.5, M(p.roof)); at(tent, 0, bodyH + 0.1, 0); g.add(tent);
      var bone = M(p.bone);
      var ns = 7; for (var i = 0; i < ns; i++) { var a = i / ns * Math.PI * 2; var sp = K.boneSpike(0.6, bone); at(sp, Math.cos(a) * bodyW * 0.6, bodyH + 0.1, Math.sin(a) * bodyD * 0.6); sp.rotation.z = Math.cos(a) * 0.5; sp.rotation.x = -Math.sin(a) * 0.5; g.add(sp); }
      g.add(at(smooth(new THREE.BoxGeometry(0.16, bodyH * 0.7, bodyD + 0.3), timber), bodyW / 2, bodyH * 0.45, 0));   // lashed beam
      var ow = K.window(0.5, 0.5, timber, glowM(p.accent, 1.4)); at(ow, -0.8, 1.4, bodyD / 2 + 0.02); g.add(ow); glow = glow.concat(ow.userData.glow);
      // forge cauldron with lava glow beside the hut
      var pot = facet(new THREE.SphereGeometry(0.4, 9, 7, 0, 6.3, Math.PI * 0.35, Math.PI * 0.65), M(0x2a2622)); at(pot, bodyW / 2 + 0.7, 0.5, bodyD * 0.2); g.add(pot);
      var lava = facet(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 9), glowM(p.glow, 1.8)); at(lava, bodyW / 2 + 0.7, 0.72, bodyD * 0.2); g.add(lava); glow.push(lava);
    } else { // elf
      // stone + big green leaf canopy crown + gnarled timber + gold rune orb + leaf-cross window
      g.add(at(K.canopy(2.0, 7, M(p.leaf, { ramp: LPF.RAMP.skin }), M(p.leafD)), 0, bodyH + 0.9, 0));
      [-1, 1].forEach(function (s) { var root = facet(new THREE.CylinderGeometry(0.12, 0.34, bodyH + 0.4, 6), timber); at(root, bodyW / 2 * s, (bodyH + 0.4) / 2 - 0.2, bodyD / 2 * 0.6); root.rotation.x = -0.12; g.add(root); });   // gnarled roots
      var lw = K.leafWindow(0.42, timber, glowM(p.glow, 0.9)); at(lw, 0, 1.5, bodyD / 2 + 0.05); g.add(lw); glow = glow.concat(lw.userData.glow);
      // gold rune orb on a small post
      var orb = facet(new THREE.IcosahedronGeometry(0.22, 0), glowM(p.glow, 1.4)); at(orb, bodyW / 2 + 0.5, 1.2, bodyD * 0.2); g.add(orb); glow.push(orb);
      g.add(at(smooth(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), timber), bodyW / 2 + 0.5, 0.6, bodyD * 0.2));
    }

    g.userData = { glowMeshes: glow, faction: faction, footprint: { w: 2, d: 2 } };
    LPF.outlineGroup && LPF.outlineGroup(g, 0.03, 0x1a1620);
    // center on origin, base at y=0
    var box = new THREE.Box3().setFromObject(g); var c = new THREE.Vector3(); box.getCenter(c);
    g.position.x -= c.x; g.position.z -= c.z; g.position.y -= box.min.y;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  LPF.setNight = function (b, on) { (b.userData.glowMeshes || []).forEach(function (m) { m.material.emissiveIntensity = on ? (m.material.userData.base || 1.4) : 0.0; }); };
})(typeof window !== 'undefined' ? window : globalThis);
