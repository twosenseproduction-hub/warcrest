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
  // Building matte ramp: a touch deeper than the shared character cloth ramp so
  // big flat stone/roof faces don't blow out to near-white under the key + ACES.
  var BRAMP = LPF.makeRamp([28, 96, 152]);
  var M = function (c, o) { return LPF.toon(c, Object.assign({ ramp: BRAMP, rim: false }, o || {})); };
  // Magic prop glow (lava, orbs, runes, moonwells): glows by day, brighter at night.
  var glowM = function (c, i) {
    var iv = i == null ? 1.2 : i;
    var m = LPF.toon(c, { ramp: LPF.RAMP.metal, emissive: c, emissiveIntensity: iv, rim: false });
    m.userData.dayI = iv; m.userData.nightI = iv * 1.45; return m;
  };
  // Window glass pane: DARK by day (emissive off), warm glow at night. Base is a
  // dark glass tone so daytime windows read as recessed glass, not white stickers.
  var paneM = function (c, i) {
    var iv = i == null ? 1.4 : i;
    var m = LPF.toon(0x1f232c, { ramp: LPF.RAMP.cloth, emissive: c, emissiveIntensity: 0.0, rim: false });
    m.userData.dayI = 0.0; m.userData.nightI = iv; return m;
  };

  var FACTIONS = {
    human: { stone: 0x70767f, stoneD: 0x474c54, roof: 0x2f4f82, timber: 0x5a3e22, accent: 0xe4b53a, glow: 0xffce7a, banner: 0x2a4fa0 },
    orc: { stone: 0x8c7e60, stoneD: 0x5e5238, roof: 0x7e2f1d, timber: 0x4a2f1c, accent: 0xc23528, glow: 0xff7a18, bone: 0xddd6bc, banner: 0x7e2f1d },
    elf: { stone: 0x6a6878, stoneD: 0x474655, timber: 0x5a3e22, leaf: 0x5cb233, leafD: 0x2f6320, accent: 0xf2c14e, glow: 0xffe07a, banner: 0x57c23a },
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
    var bw = K.window(0.6, 0.8, timber, paneM(p.glow)); K.at(bw, 0, keepH * 0.62, keepW / 2 + 0.02); g.add(bw); glow = glow.concat(bw.userData.glow);
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
    // dramatic per-tier scale: a hut, a stronghold, a great war-camp
    var moundTiers = [2, 3, 4][tier - 1], moundR = [2.0, 2.9, 3.8][tier - 1];
    var hallW = [2.0, 2.7, 3.4][tier - 1], hallH = [1.7, 2.4, 3.2][tier - 1];
    g.add(rockMound(moundR, stoneD, moundTiers));
    var hallY = moundTiers * 0.55;
    g.add(K.at(smooth(new THREE.CylinderGeometry(hallW * 0.55, hallW * 0.62, hallH, 8), stone), 0, hallY + hallH / 2, 0));
    g.add(K.at(K.door(1.0, 1.4, timber), 0, hallY, hallW * 0.55 + 0.02));
    var ow = K.window(0.5, 0.5, timber, paneM(p.accent, 1.4)); K.at(ow, 0, hallY + hallH * 0.62, hallW * 0.55 + 0.02); g.add(ow); glow = glow.concat(ow.userData.glow);
    var tent = K.tentRoof(hallW * 0.72, hallH * 0.75, M(p.roof)); K.at(tent, 0, hallY + hallH, 0); g.add(tent);
    if (tier >= 2) { var tent2 = K.tentRoof(hallW * 0.5, hallH * 0.5, M(p.roof)); K.at(tent2, 0, hallY + hallH * 1.6, 0); g.add(tent2); }   // stacked upper tent
    var ns = 6 + tier * 2; for (var i = 0; i < ns; i++) { var a = i / ns * Math.PI * 2, R = hallW * 0.6; var sp = K.boneSpike(0.7, bone); K.at(sp, Math.cos(a) * R, hallY + hallH, Math.sin(a) * R); sp.rotation.z = Math.cos(a) * 0.5; sp.rotation.x = -Math.sin(a) * 0.5; g.add(sp); }
    // CURVED BONE ARCH over the entrance — grows each tier
    var arch = K.boneArch(hallW * 0.9 + tier * 0.3, 1.6 + tier * 0.6, bone); K.at(arch, 0, hallY, hallW * 0.55 + 0.7); g.add(arch);
    // bone totems at the rim
    var totems = [1, 2, 4][tier - 1]; var tR = moundR + 0.5;
    for (var t = 0; t < totems; t++) { var a2 = t / totems * Math.PI * 2 + 0.6; var px = Math.cos(a2) * tR, pz = Math.sin(a2) * tR;
      g.add(K.at(smooth(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6), timber), px, 0.8, pz));
      var sk = K.facet(new THREE.SphereGeometry(0.26, 8, 6), bone); sk.scale.set(1, 1.1, 0.9); K.at(sk, px, 1.7, pz); g.add(sk);
      [-1, 1].forEach(function (s) { var hn = horn(0.4, bone); K.at(hn, px + 0.16 * s, 1.85, pz); hn.rotation.z = -s * 0.9; g.add(hn); }); }
    // palisade ring of sharpened stakes (tier >= 2)
    if (tier >= 2) { var np = 14 + tier * 4; for (var k = 0; k < np; k++) { var pa = k / np * Math.PI * 2; if (Math.abs(pa - Math.PI / 2) < 0.5) continue; // gap at the gate
      var stake = K.boneSpike(1.2, timber); K.at(stake, Math.cos(pa) * (moundR + 0.2), 0.5, Math.sin(pa) * (moundR + 0.2)); stake.rotation.z = Math.cos(pa) * 0.12; stake.rotation.x = -Math.sin(pa) * 0.12; g.add(stake); } }
    // wooden scaffold watchtowers (1 at T2, 2 at T3)
    var watch = tier >= 3 ? 2 : tier >= 2 ? 1 : 0;
    for (var w = 0; w < watch; w++) { var wa = (w ? -1 : 1) * 0.8; var sc = scaffold(2.8 + tier * 0.5, timber, stoneD); K.at(sc, Math.cos(wa) * tR * 0.9, hallY, -Math.abs(Math.sin(wa)) * tR * 0.9 - 0.5); g.add(sc);
      var tt = K.tentRoof(0.8, 0.8, M(p.roof)); K.at(tt, Math.cos(wa) * tR * 0.9, hallY + 2.8 + tier * 0.5 + 0.1, -Math.abs(Math.sin(wa)) * tR * 0.9 - 0.5); g.add(tt); }
    // forge cauldron with lava (bigger per tier)
    var fr = 0.45 + tier * 0.1;
    g.add(K.at(K.facet(new THREE.SphereGeometry(fr, 9, 7, 0, 6.3, Math.PI * 0.35, Math.PI * 0.65), M(0x2a2622)), tR * 0.7, 0.55, tR * 0.5));
    var lava = K.facet(new THREE.CylinderGeometry(fr * 0.82, fr * 0.82, 0.14, 9), glowM(p.glow, 1.8)); K.at(lava, tR * 0.7, 0.55 + fr * 0.4, tR * 0.5); g.add(lava); glow.push(lava);
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
    var lw = K.leafWindow(0.42, timber, paneM(p.glow, 0.9)); K.at(lw, 0, trunkH * 0.5, trunkR * 1.05); g.add(lw); glow = glow.concat(lw.userData.glow);
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

  function buildHouse(faction) {
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
      var hw = K.window(0.55, 0.7, timber, paneM(p.glow)); at(hw, -0.8, 1.4, bodyD / 2 + 0.02); g.add(hw); glow = glow.concat(hw.userData.glow);
      var bn = K.banner(2.0, M(p.banner), timber); at(bn, -bodyW / 2 - 0.2, 0, bodyD / 2 - 0.2); g.add(bn);
    } else if (faction === 'orc') {
      // tan stone + red draped tent roof + bone spikes around the eave + forge-glow window + cauldron
      var tent = K.tentRoof(1.85, 1.5, M(p.roof)); at(tent, 0, bodyH + 0.1, 0); g.add(tent);
      var bone = M(p.bone);
      var ns = 7; for (var i = 0; i < ns; i++) { var a = i / ns * Math.PI * 2; var sp = K.boneSpike(0.6, bone); at(sp, Math.cos(a) * bodyW * 0.6, bodyH + 0.1, Math.sin(a) * bodyD * 0.6); sp.rotation.z = Math.cos(a) * 0.5; sp.rotation.x = -Math.sin(a) * 0.5; g.add(sp); }
      g.add(at(smooth(new THREE.BoxGeometry(0.16, bodyH * 0.7, bodyD + 0.3), timber), bodyW / 2, bodyH * 0.45, 0));   // lashed beam
      var ow = K.window(0.5, 0.5, timber, paneM(p.accent, 1.4)); at(ow, -0.8, 1.4, bodyD / 2 + 0.02); g.add(ow); glow = glow.concat(ow.userData.glow);
      // forge cauldron with lava glow beside the hut
      var pot = facet(new THREE.SphereGeometry(0.4, 9, 7, 0, 6.3, Math.PI * 0.35, Math.PI * 0.65), M(0x2a2622)); at(pot, bodyW / 2 + 0.7, 0.5, bodyD * 0.2); g.add(pot);
      var lava = facet(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 9), glowM(p.glow, 1.8)); at(lava, bodyW / 2 + 0.7, 0.72, bodyD * 0.2); g.add(lava); glow.push(lava);
    } else { // elf
      // stone + big green leaf canopy crown + gnarled timber + gold rune orb + leaf-cross window
      g.add(at(K.canopy(2.0, 7, M(p.leaf, { ramp: LPF.RAMP.skin }), M(p.leafD)), 0, bodyH + 0.9, 0));
      [-1, 1].forEach(function (s) { var root = facet(new THREE.CylinderGeometry(0.12, 0.34, bodyH + 0.4, 6), timber); at(root, bodyW / 2 * s, (bodyH + 0.4) / 2 - 0.2, bodyD / 2 * 0.6); root.rotation.x = -0.12; g.add(root); });   // gnarled roots
      var lw = K.leafWindow(0.42, timber, paneM(p.glow, 0.9)); at(lw, 0, 1.5, bodyD / 2 + 0.05); g.add(lw); glow = glow.concat(lw.userData.glow);
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
  }

  // ORC BARRACKS: long bone-spiked hall with a red awning + bone arch entrance + weapon rack
  function orcBarracks() {
    var p = FACTIONS.orc, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), bone = M(p.bone);
    var g = new THREE.Group(); var glow = [];
    g.add(rockMound(3.0, stoneD, 1));
    var w = 4.4, h = 2.2, d = 2.6, y = 0.55;
    g.add(K.at(smooth(new THREE.BoxGeometry(w, h, d), stone), 0, y + h / 2, 0));
    g.add(K.at(K.tentRoof(w * 0.42, 1.1, M(p.roof)), -w * 0.25, y + h, 0));
    g.add(K.at(K.tentRoof(w * 0.42, 1.1, M(p.roof)), w * 0.25, y + h, 0));
    var ns = 10; for (var i = 0; i < ns; i++) { var sp = K.boneSpike(0.6, bone); K.at(sp, -w / 2 + (i + 0.5) * w / ns, y + h + 0.1, d / 2 * (i % 2 ? 1 : -1)); g.add(sp); }
    g.add(K.at(K.door(1.1, 1.5, timber), 0, y, d / 2 + 0.02));
    var arch = K.boneArch(2.0, 1.9, bone); K.at(arch, 0, y, d / 2 + 0.6); g.add(arch);
    var ow = K.window(0.5, 0.5, timber, paneM(p.accent, 1.4)); K.at(ow, -1.4, y + h * 0.6, d / 2 + 0.02); g.add(ow); glow = glow.concat(ow.userData.glow);
    // weapon rack of spears leaning on the wall
    for (var s = 0; s < 4; s++) { var sp2 = smooth(new THREE.CylinderGeometry(0.04, 0.04, 1.9, 5), timber); K.at(sp2, w / 2 + 0.25, 1.0, -0.7 + s * 0.32); sp2.rotation.x = 0.18; g.add(sp2);
      g.add(K.at(facet(new THREE.ConeGeometry(0.08, 0.3, 4), bone), w / 2 + 0.25 + 0.17, 1.95, -0.7 + s * 0.32)); }
    return finishB(g, 'orc', { w: 3, d: 2 }, glow);
  }
  // ORC TOWER: stone drum + wooden scaffold cap + red tent + bone spikes + forge-glow eye
  function orcTower() {
    var p = FACTIONS.orc, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), bone = M(p.bone);
    var g = new THREE.Group(); var glow = [];
    g.add(rockMound(1.8, stoneD, 1));
    var r = 1.0, h = 3.6, y = 0.55;
    g.add(K.at(K.tower(r, h, stone, 8), 0, y + h / 2, 0));
    g.add(K.at(scaffold(1.0, timber, stoneD), 0, y + h, 0));
    g.add(K.at(K.tentRoof(r * 1.1, 1.3, M(p.roof)), 0, y + h + 1.0, 0));
    var ns = 7; for (var i = 0; i < ns; i++) { var a = i / ns * Math.PI * 2; var sp = K.boneSpike(0.6, bone); K.at(sp, Math.cos(a) * r, y + h + 0.9, Math.sin(a) * r); sp.rotation.z = Math.cos(a) * 0.5; sp.rotation.x = -Math.sin(a) * 0.5; g.add(sp); }
    var eye = facet(new THREE.BoxGeometry(0.4, 0.5, 0.16), glowM(p.glow, 1.5)); K.at(eye, 0, y + h * 0.7, r + 0.02); g.add(eye); glow.push(eye);
    g.add(K.at(K.door(0.9, 1.3, timber), 0, y, r + 0.02));
    return finishB(g, 'orc', { w: 1, d: 1 }, glow);
  }
  // ORC WAR FORGE (tier-2 unit building): big lava cauldron + anvil + bellows + ember chimney
  function orcForge() {
    var p = FACTIONS.orc, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), bone = M(p.bone), iron = M(0x2a2622);
    var g = new THREE.Group(); var glow = [];
    g.add(rockMound(3.0, stoneD, 1));
    var y = 0.55;
    g.add(K.at(smooth(new THREE.BoxGeometry(3.0, 2.0, 2.4), stone), -0.6, y + 1.0, 0));              // forge house
    g.add(K.at(K.tentRoof(1.7, 1.1, M(p.roof)), -0.6, y + 2.0, 0));
    // big lava cauldron centerpiece
    var pot = facet(new THREE.SphereGeometry(0.85, 10, 8, 0, 6.3, Math.PI * 0.32, Math.PI * 0.68), iron); K.at(pot, 1.4, y + 0.7, 0.3); g.add(pot);
    g.add(K.at(smooth(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6), iron), 1.4, y + 0.35, 0.3));   // pot leg
    var lava = facet(new THREE.CylinderGeometry(0.72, 0.72, 0.16, 10), glowM(p.glow, 1.9)); K.at(lava, 1.4, y + 1.05, 0.3); g.add(lava); glow.push(lava);
    // crossbeam over the cauldron (lashed timber)
    g.add(K.at(smooth(new THREE.BoxGeometry(0.14, 0.14, 2.4), timber), 1.4, y + 2.0, 0.3));
    [-1, 1].forEach(function (s) { g.add(K.at(smooth(new THREE.CylinderGeometry(0.1, 0.12, 2.2, 6), timber), 1.4, y + 1.1, 0.3 + s * 1.0)); });
    // anvil + molten ingot
    g.add(K.at(facet(new THREE.BoxGeometry(0.6, 0.3, 0.3), iron), -0.6, y + 0.45, 1.4));
    g.add(K.at(facet(new THREE.BoxGeometry(0.25, 0.12, 0.18), iron), -0.6, y + 0.3, 1.4));
    var ingot = facet(new THREE.BoxGeometry(0.22, 0.1, 0.14), glowM(p.glow, 1.6)); K.at(ingot, -0.6, y + 0.66, 1.4); g.add(ingot); glow.push(ingot);
    // ember chimney
    g.add(K.at(facet(new THREE.BoxGeometry(0.5, 1.4, 0.5), stoneD), -1.6, y + 2.3, -0.6));
    var ember = facet(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 8), glowM(p.glow, 1.7)); K.at(ember, -1.6, y + 3.05, -0.6); g.add(ember); glow.push(ember);
    // bone spikes on the forge house
    var ns = 6; for (var i = 0; i < ns; i++) { var sp = K.boneSpike(0.55, bone); K.at(sp, -0.6 - 1.5 + i * 0.6, y + 2.0, -1.2); g.add(sp); }
    return finishB(g, 'orc', { w: 3, d: 2 }, glow);
  }
  // ORC RESEARCH (upgrade — Bonecaller's Altar / Spirit Lodge): glowing altar + bone totem ring + spirit orbs
  function orcResearch() {
    var p = FACTIONS.orc, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), bone = M(p.bone);
    var g = new THREE.Group(); var glow = [];
    g.add(rockMound(2.6, stoneD, 1));
    var y = 0.55;
    // central altar stone with a glowing rune
    g.add(K.at(facet(new THREE.CylinderGeometry(0.9, 1.05, 0.9, 8), stone), 0, y + 0.45, 0));
    g.add(K.at(facet(new THREE.BoxGeometry(1.0, 0.3, 1.0), stoneD), 0, y + 0.95, 0));
    var rune = facet(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 8), glowM(p.glow, 1.6)); K.at(rune, 0, y + 1.12, 0); g.add(rune); glow.push(rune);
    var crystal = facet(new THREE.OctahedronGeometry(0.34, 0), glowM(p.accent, 1.4)); crystal.scale.y = 1.6; K.at(crystal, 0, y + 1.55, 0); g.add(crystal); glow.push(crystal);
    // ring of bone totems (post + skull + horns)
    var nt = 5; for (var t = 0; t < nt; t++) { var a = t / nt * Math.PI * 2; var px = Math.cos(a) * 2.0, pz = Math.sin(a) * 2.0;
      g.add(K.at(smooth(new THREE.CylinderGeometry(0.12, 0.14, 1.8, 6), timber), px, y + 0.9, pz));
      var sk = facet(new THREE.SphereGeometry(0.26, 8, 6), bone); sk.scale.set(1, 1.1, 0.9); K.at(sk, px, y + 1.85, pz); g.add(sk);
      [-1, 1].forEach(function (s) { var hn = horn(0.4, bone); K.at(hn, px + 0.16 * s, y + 2.0, pz); hn.rotation.z = -s * 0.9; g.add(hn); });
      var so = facet(new THREE.IcosahedronGeometry(0.12, 0), glowM(p.glow, 1.2)); K.at(so, px, y + 2.25, pz); g.add(so); glow.push(so); }
    return finishB(g, 'orc', { w: 2, d: 2 }, glow);
  }
  // ---- ELF buildings (stone + leaf canopy + gnarled wood + gold runes + horns) ----
  function elfBarracks() {
    var p = FACTIONS.elf, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), leaf = M(p.leaf, { ramp: LPF.RAMP.skin }), leafD = M(p.leafD);
    var g = new THREE.Group(); var glow = [];
    g.add(K.foundation(4.4, 3.2, stoneD));
    var w = 3.8, h = 2.0, d = 2.4;
    g.add(K.at(smooth(new THREE.BoxGeometry(w, h, d), stone), 0, h / 2, 0));
    g.add(K.at(K.canopy(1.6, 6, leaf, leafD), -w * 0.25, h + 0.5, 0));
    g.add(K.at(K.canopy(1.6, 6, leaf, leafD), w * 0.25, h + 0.5, 0));
    g.add(K.at(K.door(1.2, 1.5, timber), 0, 0, d / 2 + 0.02));
    var lw = K.leafWindow(0.4, timber, paneM(p.glow, 0.9)); K.at(lw, -1.3, h * 0.6, d / 2 + 0.02); g.add(lw); glow = glow.concat(lw.userData.glow);
    [-1, 1].forEach(function (s) { g.add(K.at(facet(new THREE.CylinderGeometry(0.14, 0.3, h + 0.3, 6), timber), w / 2 * s, (h + 0.3) / 2 - 0.15, d / 2 * 0.7)); });
    var orb = facet(new THREE.IcosahedronGeometry(0.2, 0), glowM(p.glow, 1.3)); K.at(orb, 0, h + 0.2, d / 2 + 0.3); g.add(orb); glow.push(orb);
    [-1, 1].forEach(function (s) { var hn = horn(0.6, timber); K.at(hn, w * 0.42 * s, h + 0.7, 0); hn.rotation.z = -s * 0.7; g.add(hn); });
    return finishB(g, 'elf', { w: 3, d: 2 }, glow);
  }
  function elfTower() {
    var p = FACTIONS.elf, timber = M(p.timber), leaf = M(p.leaf, { ramp: LPF.RAMP.skin }), leafD = M(p.leafD);
    var g = new THREE.Group(); var glow = [];
    g.add(K.foundation(2.4, 2.4, M(p.stoneD)));
    var r = 0.9, h = 3.8;
    g.add(K.at(smooth(new THREE.CylinderGeometry(r * 0.8, r * 1.1, h, 8), timber), 0, h / 2, 0));
    var nr = 5; for (var i = 0; i < nr; i++) { var a = i / nr * Math.PI * 2; var root = facet(new THREE.CylinderGeometry(0.08, 0.26, 1.1, 6), timber); K.at(root, Math.cos(a) * r * 0.9, 0.5, Math.sin(a) * r * 0.9); root.rotation.x = -Math.sin(a) * 0.5; root.rotation.z = Math.cos(a) * 0.5; g.add(root); }
    g.add(K.at(K.canopy(1.7, 7, leaf, leafD), 0, h + 0.5, 0));
    var lw = K.leafWindow(0.4, timber, paneM(p.glow, 1.0)); K.at(lw, 0, h * 0.6, r * 1.0); g.add(lw); glow = glow.concat(lw.userData.glow);
    for (var k = 0; k < 2; k++) { var orb = facet(new THREE.IcosahedronGeometry(0.16, 0), glowM(p.glow, 1.3)); K.at(orb, 0, h * (0.35 + k * 0.2), r * 0.95); g.add(orb); glow.push(orb); }
    [-1, 1].forEach(function (s) { var hn = horn(0.7, timber); K.at(hn, r * 1.2 * s, h + 0.3, 0); hn.rotation.z = -s * 0.8; g.add(hn); });
    return finishB(g, 'elf', { w: 1, d: 1 }, glow);
  }
  // ELF tier-2 "Ancient of War": big ancient tree-building + moonwell pool
  function elfForge() {
    var p = FACTIONS.elf, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), leaf = M(p.leaf, { ramp: LPF.RAMP.skin }), leafD = M(p.leafD);
    var g = new THREE.Group(); var glow = [];
    g.add(K.foundation(4.8, 4.0, stoneD));
    var r = 1.3, h = 3.6;
    g.add(K.at(smooth(new THREE.CylinderGeometry(r * 0.85, r * 1.25, h, 8), timber), 0, h / 2, 0));
    var nr = 7; for (var i = 0; i < nr; i++) { var a = i / nr * Math.PI * 2; var root = facet(new THREE.CylinderGeometry(0.12, 0.4, 1.6, 6), timber); K.at(root, Math.cos(a) * r * 0.95, 0.7, Math.sin(a) * r * 0.95); root.rotation.x = -Math.sin(a) * 0.55; root.rotation.z = Math.cos(a) * 0.55; g.add(root); }
    var lw = K.leafWindow(0.5, timber, paneM(p.glow, 1.0)); K.at(lw, 0, h * 0.55, r * 1.05); g.add(lw); glow = glow.concat(lw.userData.glow);
    g.add(K.at(K.door(1.2, 1.6, timber), 0, 0, r * 1.05));
    g.add(K.at(K.canopy(2.6, 11, leaf, leafD), 0, h + 0.8, 0));
    g.add(K.at(facet(new THREE.CylinderGeometry(0.9, 1.0, 0.4, 9), stone), 2.2, 0.2, 0.6));
    var well = facet(new THREE.CylinderGeometry(0.72, 0.72, 0.12, 9), glowM(0x6fe0d6, 1.5)); K.at(well, 2.2, 0.42, 0.6); g.add(well); glow.push(well);
    [-1, 1].forEach(function (s) { var hn = horn(1.0, timber); K.at(hn, 1.6 * s, h + 1.0, 0); hn.rotation.z = -s * 0.7; g.add(hn); });
    return finishB(g, 'elf', { w: 3, d: 3 }, glow);
  }
  // ELF research "Moonwell": glowing basin + rune crystal + leaf-canopy arches
  function elfResearch() {
    var p = FACTIONS.elf, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), leaf = M(p.leaf, { ramp: LPF.RAMP.skin }), leafD = M(p.leafD);
    var g = new THREE.Group(); var glow = [];
    g.add(rockMound(2.6, stoneD, 1));
    var y = 0.55;
    g.add(K.at(facet(new THREE.CylinderGeometry(1.4, 1.55, 0.7, 10), stone), 0, y + 0.35, 0));
    var water = facet(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 10), glowM(0x6fe0d6, 1.4)); K.at(water, 0, y + 0.7, 0); g.add(water); glow.push(water);
    var cr = facet(new THREE.OctahedronGeometry(0.4, 0), glowM(p.glow, 1.5)); cr.scale.y = 1.8; K.at(cr, 0, y + 1.4, 0); g.add(cr); glow.push(cr);
    var na = 3; for (var i = 0; i < na; i++) { var a = i / na * Math.PI * 2 + 0.5; var px = Math.cos(a) * 2.0, pz = Math.sin(a) * 2.0;
      g.add(K.at(facet(new THREE.CylinderGeometry(0.14, 0.2, 2.2, 6), timber), px, y + 1.1, pz));
      g.add(K.at(K.canopy(0.8, 4, leaf, leafD), px, y + 2.3, pz));
      var so = facet(new THREE.IcosahedronGeometry(0.12, 0), glowM(p.glow, 1.2)); K.at(so, px, y + 1.9, pz); g.add(so); glow.push(so); }
    return finishB(g, 'elf', { w: 2, d: 2 }, glow);
  }
  // ---- HUMAN buildings (grey stone + timber framing + blue roofs + banners) ----
  function humanBarracks() {
    var p = FACTIONS.human, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber);
    var g = new THREE.Group(); var glow = [];
    g.add(K.foundation(4.4, 3.2, stoneD));
    var w = 3.8, h = 2.2, d = 2.6;
    g.add(K.at(smooth(new THREE.BoxGeometry(w, h, d), stone), 0, h / 2, 0));
    [-1, 1].forEach(function (s) { g.add(K.at(smooth(new THREE.BoxGeometry(0.2, h, 0.2), timber), w / 2 * s, h / 2, d / 2)); });
    g.add(K.at(smooth(new THREE.BoxGeometry(w, 0.16, 0.16), timber), 0, h * 0.55, d / 2 + 0.02));
    g.add(K.at(K.gableRoof(w + 0.5, d + 0.5, 1.4, M(p.roof)), 0, h, 0));
    g.add(K.at(smooth(new THREE.BoxGeometry(w + 0.5, 0.12, d + 0.5), timber), 0, h, 0));
    g.add(K.at(K.door(1.2, 1.5, timber), 0, 0, d / 2 + 0.02));
    [-1, 1].forEach(function (s) { var hw = K.window(0.5, 0.7, timber, paneM(p.glow)); K.at(hw, 1.1 * s, h * 0.55, d / 2 + 0.02); g.add(hw); glow = glow.concat(hw.userData.glow); });
    var bn = K.banner(2.4, M(p.banner), timber); K.at(bn, -w / 2 - 0.3, 0, d / 2 - 0.2); g.add(bn);
    return finishB(g, 'human', { w: 3, d: 2 }, glow);
  }
  function humanTower() {
    var p = FACTIONS.human, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber);
    var g = new THREE.Group(); var glow = [];
    g.add(K.foundation(2.4, 2.4, stoneD));
    var r = 1.0, h = 3.8;
    g.add(K.at(K.tower(r, h, stone, 8), 0, h / 2, 0));
    crenellate(g, r + 0.05, h + 0.05, stone);
    var ch = 1.4, cone = K.coneRoof(r * 1.05, ch, M(p.roof), 8); K.at(cone, 0, h + 0.5 + ch / 2, 0); g.add(cone);
    g.add(K.at(facet(new THREE.ConeGeometry(0.07, 0.5, 5), LPF.toon(p.accent, { ramp: LPF.RAMP.metal, rim: false })), 0, h + 0.5 + ch + 0.2, 0));
    for (var i = 0; i < 3; i++) { var a = i / 3 * Math.PI * 2; var sl = K.window(0.22, 0.5, timber, paneM(p.glow)); K.at(sl, Math.cos(a) * r, h * 0.6, Math.sin(a) * r); sl.rotation.y = -a + Math.PI / 2; g.add(sl); glow = glow.concat(sl.userData.glow); }
    g.add(K.at(K.door(0.9, 1.3, timber), 0, 0, r + 0.02));
    return finishB(g, 'human', { w: 1, d: 1 }, glow);
  }
  // HUMAN tier-2 "Blacksmith / Mill": timber+stone hall + ember chimney + forge glow + waterwheel
  function humanForge() {
    var p = FACTIONS.human, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber), iron = M(0x3a3d42);
    var g = new THREE.Group(); var glow = [];
    g.add(K.foundation(4.8, 3.6, stoneD));
    var w = 3.2, h = 2.2, d = 2.6;
    g.add(K.at(smooth(new THREE.BoxGeometry(w, h, d), stone), -0.4, h / 2, 0));
    [-1, 1].forEach(function (s) { g.add(K.at(smooth(new THREE.BoxGeometry(0.2, h, 0.2), timber), -0.4 + w / 2 * s, h / 2, d / 2)); });
    g.add(K.at(K.gableRoof(w + 0.5, d + 0.5, 1.3, M(p.roof)), -0.4, h, 0));
    g.add(K.at(smooth(new THREE.BoxGeometry(w + 0.5, 0.12, d + 0.5), timber), -0.4, h, 0));
    g.add(K.at(K.door(1.1, 1.5, timber), -0.4, 0, d / 2 + 0.02));
    g.add(K.at(K.chimney(1.6, stoneD), -1.6, h + 1.0, -0.6));
    var ember = facet(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8), glowM(0xff8a3a, 1.6)); K.at(ember, -1.6, h + 1.85, -0.6); g.add(ember); glow.push(ember);
    var fg = K.window(0.6, 0.5, timber, paneM(0xff8a3a, 1.5)); K.at(fg, 0.7, h * 0.45, d / 2 + 0.02); g.add(fg); glow = glow.concat(fg.userData.glow);
    g.add(K.at(K.waterwheel(1.1, timber, iron), w / 2 + 0.2, 1.1, 0.4));
    var bn = K.banner(2.2, M(p.banner), timber); K.at(bn, -w / 2 - 0.7, 0, d / 2 - 0.2); g.add(bn);
    return finishB(g, 'human', { w: 3, d: 2 }, glow);
  }
  // HUMAN research "Arcane Sanctum": stone hall + tall blue cone roof + glowing arcane orb + tall windows
  function humanResearch() {
    var p = FACTIONS.human, stone = M(p.stone), stoneD = M(p.stoneD), timber = M(p.timber);
    var g = new THREE.Group(); var glow = [];
    g.add(K.foundation(3.4, 3.0, stoneD));
    var w = 2.6, h = 2.8, d = 2.4;
    g.add(K.at(smooth(new THREE.BoxGeometry(w, h, d), stone), 0, h / 2, 0));
    var ch = 1.7, cone = K.coneRoof(w * 0.64, ch, M(p.roof), 8); K.at(cone, 0, h + ch / 2, 0); g.add(cone);
    var orb = facet(new THREE.IcosahedronGeometry(0.28, 0), glowM(0x6fb4ff, 1.6)); K.at(orb, 0, h + ch + 0.2, 0); g.add(orb); glow.push(orb);
    g.add(K.at(K.door(1.0, 1.4, timber), 0, 0, d / 2 + 0.02));
    [-0.7, 0.7].forEach(function (x) { var ww = K.window(0.4, 1.2, timber, paneM(0x6fb4ff, 1.0)); K.at(ww, x, h * 0.55, d / 2 + 0.02); g.add(ww); glow = glow.concat(ww.userData.glow); });
    var bn = K.banner(2.4, M(p.banner), timber); K.at(bn, -w / 2 - 0.3, 0, d / 2 - 0.2); g.add(bn);
    return finishB(g, 'human', { w: 2, d: 2 }, glow);
  }
  function finishB(g, faction, fp, glow) {
    g.userData = { glowMeshes: glow, faction: faction, footprint: fp };
    LPF.outlineGroup && LPF.outlineGroup(g, 0.03, 0x1a1620);
    var box = new THREE.Box3().setFromObject(g); var c = new THREE.Vector3(); box.getCenter(c);
    g.position.x -= c.x; g.position.z -= c.z; g.position.y -= box.min.y;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  LPF.buildBuilding = function (faction, kind, tier) {
    if (kind === 'core') return buildCore(faction, tier || 1);
    if (kind === 'barracks' && faction === 'orc') return orcBarracks();
    if (kind === 'tower' && faction === 'orc') return orcTower();
    if (kind === 'forge' && faction === 'orc') return orcForge();
    if (kind === 'research' && faction === 'orc') return orcResearch();
    if (kind === 'barracks' && faction === 'elf') return elfBarracks();
    if (kind === 'tower' && faction === 'elf') return elfTower();
    if (kind === 'forge' && faction === 'elf') return elfForge();
    if (kind === 'research' && faction === 'elf') return elfResearch();
    if (kind === 'barracks' && faction === 'human') return humanBarracks();
    if (kind === 'tower' && faction === 'human') return humanTower();
    if (kind === 'forge' && faction === 'human') return humanForge();
    if (kind === 'research' && faction === 'human') return humanResearch();
    return buildHouse(faction);
  };

  // Day/night toggle. Each glow material carries dayI/nightI; magic props keep a
  // soft day glow, window panes go fully dark by day. Call this for BOTH states.
  LPF.setNight = function (b, on) {
    (b.userData.glowMeshes || []).forEach(function (m) {
      var u = m.material.userData;
      m.material.emissiveIntensity = on ? (u.nightI != null ? u.nightI : 1.4) : (u.dayI != null ? u.dayI : 0.0);
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
