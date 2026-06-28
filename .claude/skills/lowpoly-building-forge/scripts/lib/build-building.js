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

  LPF.buildBuilding = function (faction, kind) {
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
