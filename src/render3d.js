/* ============================================================================
 * Warcrest — render3d.js   (3D engine renderer, Three.js)
 *
 * A drop-in 3D view of the LIVE game. The simulation (units, combat, economy,
 * pathfinding, AI, buildings, factions, heroes) is untouched — this module only
 * reads `s.entities` each frame and mirrors it into a Three.js scene built from
 * hand-authored low-poly geometry (the same procedural art proven in the race
 * demo). It is gated behind `RTS.Config.render3d` so the 2D pixel game is the
 * default until 3D is flipped on.
 *
 * The clever part: input/HUD/commands all route world<->screen math through
 * `RTS.Cam.screenToWorld` / `RTS.Cam.worldToScreen`. We override those two with
 * a 3D raycast / projection while 3D is active, so the entire existing input
 * and command system keeps working with zero changes.
 *
 * Coordinate convention:  world pixel (wx, wy)  ->  3D (x = wx, z = wy),
 * with elevation on the Y axis (FLAT=0, HIGH=+HIGH_RISE). 1 world px = 1 unit.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TILE = 64;
  var HIGH_RISE = 46;        // world-units a HIGH plateau stands above FLAT
  var WATER_DROP = -30;      // water surface sits below FLAT

  var THREE = null;          // resolved lazily once the vendor script loads
  var R = {                  // module-private renderer state
    enabled: false,
    inited: false,
    canvas: null, renderer: null, scene: null, camera: null,
    sun: null, amb: null, hemi: null,
    terrainMesh: null, waterMesh: null, decorGroup: null,
    ground: null,            // invisible flat plane for raycast picking
    raycaster: null,
    pool: {},                // id -> { obj, kind, builtFor } live entity meshes
    seen: {},                // id -> true this frame (for GC)
    ppool: {}, pseen: {},    // projectile meshes
    epool: {}, eseen: {},    // effect meshes
    mapId: null,             // terrain rebuilt when this changes
    ray: null, ndc: null,
    night: false,
  };

  /* ---- faction -> race styling ------------------------------------------ */
  // aurex = Iron Crown (humans), cinder = Raider Horde (orcs),
  // rimwalker = Rimwalkers (elves). Falls back to neutral.
  function raceOf(faction) {
    if (faction === 'cinder') return 'horde';
    if (faction === 'rimwalker') return 'elf';
    return 'crown';
  }

  /* ===========================================================================
   * Mesh helpers (built once THREE is available)
   * ========================================================================= */
  var P = null;              // shared material palette
  function M(h, opts) {
    var o = Object.assign({ color: h, flatShading: true, roughness: 1, metalness: 0 }, opts || {});
    return new THREE.MeshStandardMaterial(o);
  }
  function buildPalette() {
    P = {
      stone: M(0x9aa6b2), stoneD: M(0x6f7d8c), crownRoof: M(0x2f4f9e), crownTrim: M(0xdfe6f2), blue: M(0x3f63b8),
      wood: M(0x6b4a2a), woodD: M(0x4e351d), bone: M(0xd8cfa8), thatch: M(0x7a6a36), ember: M(0xc45a2a),
      orcSkin: M(0x6f9a3e), orcArmor: M(0x8a7a4a),
      bark: M(0x735036), leaf: M(0x3f7a3e), leaf2: M(0x4f8a4a), gold: M(0xd9b94a), elfTunic: M(0x5a8f5a),
      skin: M(0xe8b07a), steel: M(0xb9c2cc), dark: M(0x2a241a), white: M(0xeee7cf),
      enemyTint: M(0xb5483a), neutralG: M(0xb0a070),
      gmine: M(0xd9b94a), gmineRock: M(0x8a8276),
    };
  }
  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; return m;
  }
  function cone(r, h, seg, mat) { var m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat); m.castShadow = true; return m; }
  function cyl(r1, r2, h, seg, mat) { var m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.castShadow = true; return m; }
  function sphere(r, mat) { var m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat); m.castShadow = true; return m; }

  // The procedural builders below are authored at "race-demo" scale (a knight is
  // ~2 units tall). The world is in pixels (64px tiles), so every assembled mesh
  // is normalized up to world-pixel size before it enters the scene.
  var _box = null;
  function fitHeight(g, targetH) {
    if (!_box) _box = new THREE.Box3();
    _box.setFromObject(g); var sz = new THREE.Vector3(); _box.getSize(sz);
    var s = targetH / Math.max(sz.y, 0.001); g.scale.multiplyScalar(s); return g;
  }
  function fitWidth(g, targetW) {
    if (!_box) _box = new THREE.Box3();
    _box.setFromObject(g); var sz = new THREE.Vector3(); _box.getSize(sz);
    var s = targetW / Math.max(sz.x, sz.z, 0.001); g.scale.multiplyScalar(s); return g;
  }

  /* ---- buildings: Thronefall style --------------------------------------
   * Warm cream stone + red-brown roofs, crenellated battlements, clean low-poly
   * forms under strong directional light. A faction-colored banner keeps side
   * identity. Shared warm materials built once. */
  // Per-race building palette — Thronefall architecture: terracotta wall BODIES
  // with cream crenellated CAPS/tops. Each faction shifts the body+cap tint and
  // flies a faction banner for side identity.
  // Reference-matched: light STONE walls (body) + faction-colored ROOF/cap.
  var RACETINT = {
    crown: { body: 0xc7bc9f, bodyD: 0x9f9478, cap: 0x7c8caa, capD: 0x586585 },   // stone + blue-slate
    horde: { body: 0xbfb086, bodyD: 0x968760, cap: 0x9c3f2c, capD: 0x6c2718 },   // stone + red
    elf:   { body: 0xccc6ad, bodyD: 0xa49e85, cap: 0x4f9281, capD: 0x356458 },   // pale stone + teal
  };
  var BPR = {}, BP = null;
  function bpFor(race) {
    if (BPR[race]) return BPR[race];
    var t = RACETINT[race] || RACETINT.crown;
    BPR[race] = { body: M(t.body), bodyD: M(t.bodyD), cap: M(t.cap), capD: M(t.capD),
      wood: M(0x7a5436), woodD: M(0x573a24), door: M(0x3f2a18), gold: M(0xe4b53a) };
    return BPR[race];
  }
  function factionBanner(race) {
    return new THREE.MeshStandardMaterial({ color: (TFCOL[race] || TFCOL.crown).body, flatShading: true, roughness: 1 });
  }
  // ring of merlons around a square top (half-width hw, height y)
  function crenellate(g, hw, y, mat) {
    var n = 4, step = (hw * 2) / n;
    for (var s = -hw; s <= hw + 0.01; s += step) {
      [[s, hw], [s, -hw], [hw, s], [-hw, s]].forEach(function (p) { g.add(box(step * 0.6, 0.55, step * 0.6, mat, p[0], y, p[1])); });
    }
  }
  function sideStair(g, x, mat) { for (var i = 0; i < 6; i++) g.add(box(0.9, 0.34, 1.5, mat, x, 0.5 + i * 0.78, 0)); }
  function emberMat(c, e) { return new THREE.MeshStandardMaterial({ color: c, emissive: e || c, emissiveIntensity: 0.95, flatShading: true, roughness: 1 }); }
  // Per-race guard towers: each race gets its own silhouette (not just a recolor),
  // and an upgraded tower (towerType) adds a distinguishing topper for its line.
  function tfTower(race, tt) {
    if (race === 'horde') return tfTowerOrc(race, tt);
    if (race === 'elf') return tfTowerElf(race, tt);
    return tfTowerHuman(race, tt);
  }
  // HUMAN: round stone shaft + corbeled cap + crenellations + blue cone roof + gold finial
  //   arrow → mounted ballista bolt · bombard → cannon barrel
  function tfTowerHuman(race, tt) {
    var g = new THREE.Group();
    g.add(cyl(1.25, 1.45, 5.0, 8, BP.body).translateY(2.5));      // round stone shaft
    g.add(box(3.2, 0.6, 3.2, BP.cap, 0, 5.2, 0));                 // corbeled cap (overhangs)
    crenellate(g, 1.5, 5.75, BP.cap);
    g.add(box(0.6, 0.95, 0.18, BP.door, 0, 0.78, 1.27));
    for (var i = 0; i < 3; i++) { var a = i / 3 * Math.PI * 2; var sl = box(0.22, 0.55, 0.16, emberMat(0xffce7a, 0xb98a23), Math.cos(a) * 1.3, 3.6, Math.sin(a) * 1.3); g.add(sl); }   // arrow-slit glows
    if (!tt) {                                                     // base: blue cone roof + gold finial
      var roof = cone(1.45, 2.1, 8, BP.cap); roof.position.y = 6.95; g.add(roof);
      g.add(cyl(0.07, 0.07, 0.7, 5, BP.gold).translateY(8.35));
    } else {                                                       // upgraded: open battle deck + a war engine
      g.add(box(2.0, 0.16, 2.0, BP.woodD, 0, 5.65, 0));
      if (tt === 'arrow') {                                        // mounted ballista — bolt projects forward over the wall
        g.add(box(1.5, 0.16, 0.16, P.dark, 0, 6.3, -0.1));         // crossbar
        var stock = box(0.18, 0.18, 1.0, BP.woodD, 0, 6.3, -0.45); g.add(stock);
        var bolt = cyl(0.08, 0.04, 2.4, 6, BP.woodD); bolt.rotation.x = Math.PI / 2; bolt.position.set(0, 6.3, 0.95); g.add(bolt);
        g.add(box(0.05, 0.42, 0.42, BP.gold, 0, 6.3, -0.2));       // fletching
      } else {                                                     // bombard — iron cannon over a timber carriage
        g.add(box(1.2, 0.45, 1.2, BP.woodD, 0, 6.0, 0.1));         // carriage
        var barrel = cyl(0.32, 0.42, 2.0, 8, P.dark); barrel.rotation.x = Math.PI / 2.3; barrel.position.set(0, 6.5, 0.7); g.add(barrel);
      }
    }
    return g;
  }
  // ORC: rough shaft + lashed-wood scaffold platform + red tent roof + bone spikes + forge-glow eye
  //   barb → tall bone-shard cluster · catapult → skull-throwing arm
  function tfTowerOrc(race, tt) {
    var g = new THREE.Group();
    g.add(box(2.3, 4.4, 2.3, BP.body, 0, 2.2, 0));                // rough stone shaft
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { g.add(box(0.18, 1.5, 0.18, BP.wood, c[0] * 1.25, 4.6, c[1] * 1.25)); });   // scaffold posts
    g.add(box(2.9, 0.18, 2.9, BP.woodD, 0, 5.35, 0));             // platform
    var tent = cone(1.85, 1.9, 8, BP.cap); tent.position.y = 6.4; g.add(tent);    // red tent roof
    for (var i = 0; i < 7; i++) { var a = i / 7 * Math.PI * 2; var sp = cone(0.16, 0.7, 5, P.bone); sp.position.set(Math.cos(a) * 1.35, 5.6, Math.sin(a) * 1.35); sp.rotation.z = Math.cos(a) * 0.45; sp.rotation.x = -Math.sin(a) * 0.45; g.add(sp); }   // bone spikes
    g.add(box(0.5, 0.6, 0.16, emberMat(0xff7a18), 0, 3.4, 1.18)); // glowing forge-eye
    g.add(box(0.9, 1.2, 0.2, BP.door, 0, 0.85, 1.18));
    if (tt === 'barb') {                                          // tall bone-shard cluster bursting through the tent
      for (var s = 0; s < 4; s++) { var a3 = s / 4 * Math.PI * 2; var shard = cone(0.18, 2.0 - (s % 2) * 0.5, 5, P.bone); shard.position.set(Math.cos(a3) * 0.35, 8.0, Math.sin(a3) * 0.35); shard.rotation.z = Math.cos(a3) * 0.18; shard.rotation.x = -Math.sin(a3) * 0.18; g.add(shard); }
    } else if (tt === 'catapult') {                              // throwing arm rising forward over the tent, skull at the tip
      [-0.5, 0.5].forEach(function (o) { var leg = box(0.16, 1.4, 0.16, BP.wood, o, 6.0, 0.0); leg.rotation.x = 0.3; g.add(leg); });   // A-frame
      var arm = box(0.22, 2.8, 0.22, BP.wood, 0, 7.1, 0.6); arm.rotation.x = 0.8; g.add(arm);
      g.add(sphere(0.44, P.bone).translateY(8.2).translateZ(1.8)); // skull payload, high & forward
    }
    return g;
  }
  // ELF: gnarled tapered trunk + flared roots + leaf canopy crown + climbing rune orbs
  //   moonfire → bright moon orb · thornwall → bristling thorn crown
  function tfTowerElf(race, tt) {
    var g = new THREE.Group();
    g.add(cyl(0.85, 1.25, 4.6, 8, P.bark).translateY(2.3));       // gnarled trunk
    for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; var rt = cyl(0.1, 0.34, 1.3, 6, P.bark); rt.position.set(Math.cos(a) * 1.0, 0.6, Math.sin(a) * 1.0); rt.rotation.x = -Math.sin(a) * 0.5; rt.rotation.z = Math.cos(a) * 0.5; g.add(rt); }   // flared roots
    var crown = new THREE.Group(); crown.position.y = 5.3; crown.add(sphere(1.55, P.leaf));
    for (var j = 0; j < 6; j++) { var a2 = j / 6 * Math.PI * 2; var b = sphere(0.92, j % 2 ? P.leaf2 : P.leaf); b.position.set(Math.cos(a2) * 1.2, 0.35 + (j % 3) * 0.32, Math.sin(a2) * 1.2); crown.add(b); }
    g.add(crown);                                                  // leaf canopy crown
    for (var k = 0; k < 2; k++) { var orb = sphere(0.2, emberMat(0xffe07a, 0xd9b94a)); orb.position.set(0, 2.3 + k * 1.0, 1.05); g.add(orb); }   // rune orbs
    g.add(box(0.8, 1.2, 0.2, BP.door, 0, 0.85, 1.05));
    if (tt === 'moonfire') {                                      // bright moon orb floating above the canopy
      var moon = sphere(0.62, emberMat(0xd8e6ff, 0x8fb6ff)); moon.position.y = 7.4; g.add(moon);
      g.add(cyl(0.05, 0.05, 0.9, 5, P.bark).translateY(6.6));     // stem
    } else if (tt === 'thornwall') {                             // dark thorns bristling outward beyond the canopy
      for (var s = 0; s < 8; s++) { var a4 = s / 8 * Math.PI * 2; var th = cone(0.13, 1.4, 5, P.woodD); th.position.set(Math.cos(a4) * 2.1, 5.2, Math.sin(a4) * 2.1); th.rotation.z = Math.cos(a4) * 1.5; th.rotation.x = -Math.sin(a4) * 1.5; g.add(th); }
    }
    return g;
  }
  function tfKeep(race) {
    var g = new THREE.Group();
    g.add(box(5.6, 3.4, 5.6, BP.body, 0, 1.7, 0));                 // base tier
    g.add(box(6.0, 0.6, 6.0, BP.cap, 0, 3.55, 0)); crenellate(g, 2.9, 4.05, BP.cap);
    g.add(box(3.2, 2.6, 3.2, BP.body, 0, 5.0, 0));                 // upper tier
    g.add(box(3.6, 0.5, 3.6, BP.cap, 0, 6.3, 0)); crenellate(g, 1.7, 6.75, BP.cap);
    g.add(box(0.14, 1.7, 0.14, BP.woodD, 0, 7.6, 0)); g.add(box(1.1, 0.6, 0.05, factionBanner(race), 0.6, 7.5, 0));
    g.add(box(1.7, 2.1, 0.3, BP.door, 0, 1.05, 2.85));
    sideStair(g, 3.3, BP.capD);
    return g;
  }
  // ORC core (Warren Maw): rocky mound + red tent great-hall + bone spikes/totems + forge glow
  function tfKeepOrc(race) {
    var g = new THREE.Group();
    g.add(cyl(4.6, 5.2, 1.4, 9, BP.bodyD).translateY(0.7));                       // rocky mound
    for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2; var rk = sphere(0.7 + (i % 3) * 0.2, BP.bodyD); rk.position.set(Math.cos(a) * 4.6, 0.9, Math.sin(a) * 4.6); rk.scale.y = 0.7; g.add(rk); }
    g.add(cyl(2.8, 3.2, 3.2, 8, BP.body).translateY(2.9));                        // stone drum hall
    g.add(box(1.7, 2.1, 0.3, BP.door, 0, 1.6, 3.0));
    var tent = cone(3.7, 3.4, 8, BP.cap); tent.position.y = 6.0; g.add(tent);     // red tent roof
    var tent2 = cone(2.2, 2.0, 8, BP.cap); tent2.position.y = 8.1; g.add(tent2);  // stacked upper tent
    for (var j = 0; j < 9; j++) { var a2 = j / 9 * Math.PI * 2; var sp = cone(0.3, 1.3, 5, P.bone); sp.position.set(Math.cos(a2) * 3.0, 4.6, Math.sin(a2) * 3.0); sp.rotation.z = Math.cos(a2) * 0.5; sp.rotation.x = -Math.sin(a2) * 0.5; g.add(sp); }   // bone spikes
    [-1, 1].forEach(function (sd) { var px = sd * 4.0, pz = 3.0;                  // bone totems at the gate
      g.add(cyl(0.18, 0.22, 2.8, 6, BP.wood).translateX(px).translateY(1.4).translateZ(pz));
      var sk = sphere(0.55, P.bone); sk.scale.set(1, 1.1, 0.9); sk.position.set(px, 3.0, pz); g.add(sk);
      [-1, 1].forEach(function (s2) { var hn = cone(0.12, 0.5, 5, P.bone); hn.position.set(px + 0.28 * s2, 3.2, pz); hn.rotation.z = -s2 * 0.9; g.add(hn); }); });
    var lava = cyl(0.95, 0.95, 0.3, 9, emberMat(0xff7a18)); lava.position.set(4.3, 0.95, -2.0); g.add(lava);   // forge cauldron glow
    return g;
  }
  // ELF core (Eldertree): gnarled trunk + flared roots + giant leaf canopy + climbing rune orbs + horns
  function tfKeepElf(race) {
    var g = new THREE.Group();
    g.add(cyl(1.8, 2.6, 6.5, 8, P.bark).translateY(3.25));                        // gnarled trunk
    for (var i = 0; i < 7; i++) { var a = i / 7 * Math.PI * 2; var rt = cyl(0.25, 0.8, 2.4, 6, P.bark); rt.position.set(Math.cos(a) * 2.2, 1.0, Math.sin(a) * 2.2); rt.rotation.x = -Math.sin(a) * 0.5; rt.rotation.z = Math.cos(a) * 0.5; g.add(rt); }   // flared roots
    g.add(box(1.6, 2.2, 0.3, BP.door, 0, 1.6, 2.4));
    for (var r = 0; r < 3; r++) { var orb = sphere(0.4, emberMat(0xffe07a, 0xd9b94a)); orb.position.set(0, 3.0 + r * 1.3, 2.55); g.add(orb); }   // rune orbs
    var crown = new THREE.Group(); crown.position.y = 8.4; crown.add(sphere(3.7, P.leaf));   // giant canopy
    for (var k = 0; k < 9; k++) { var a3 = k / 9 * Math.PI * 2, e = 0.2 + (k % 3) * 0.32; var b = sphere(2.0 + (k % 3) * 0.5, k % 2 ? P.leaf2 : P.leaf); b.position.set(Math.cos(a3) * Math.cos(e) * 3.4, Math.sin(e) * 2.6, Math.sin(a3) * Math.cos(e) * 3.4); crown.add(b); }
    g.add(crown);
    for (var h = 0; h < 5; h++) { var a4 = h / 5 * Math.PI * 2; var hn = cone(0.2, 1.6, 5, P.bark); hn.position.set(Math.cos(a4) * 3.0, 7.6, Math.sin(a4) * 3.0); hn.rotation.z = Math.cos(a4) * 0.7; hn.rotation.x = -Math.sin(a4) * 0.7; g.add(hn); }   // horns from the canopy
    return g;
  }
  function tfHouse(race) {
    var g = new THREE.Group();
    g.add(box(4.4, 2.2, 3.6, BP.body, 0, 1.1, 0));
    g.add(box(4.8, 0.5, 4.0, BP.cap, 0, 2.25, 0));                 // cream flat top
    g.add(box(1.2, 1.5, 0.3, BP.door, 0, 0.75, 1.85));
    g.add(box(0.8, 0.8, 0.16, BP.cap, -1.4, 1.4, 1.85));
    g.add(cyl(1.0, 1.0, 2.5, 9, BP.body).translateX(3.0).translateY(1.25));   // round silo
    g.add(cyl(1.12, 1.12, 0.4, 9, BP.cap).translateX(3.0).translateY(2.55));
    return g;
  }
  function tfBarracks(race) {
    var g = new THREE.Group();
    g.add(box(6.0, 2.3, 3.6, BP.body, 0, 1.15, 0));
    g.add(box(6.4, 0.5, 4.0, BP.cap, 0, 2.35, 0));
    g.add(box(1.2, 1.5, 0.3, BP.door, 0, 0.75, 1.85));
    g.add(box(0.7, 0.8, 0.16, BP.cap, -1.9, 1.4, 1.85)); g.add(box(0.7, 0.8, 0.16, BP.cap, 1.9, 1.4, 1.85));
    g.add(box(0.14, 1.7, 0.14, BP.woodD, -2.8, 3.2, 0)); g.add(box(0.95, 0.55, 0.05, factionBanner(race), -2.3, 3.7, 0));
    return g;
  }
  function tfWindmill(race) {
    var g = new THREE.Group();
    g.add(cyl(1.5, 2.0, 4.4, 9, BP.body).translateY(2.2));
    g.add(cyl(2.1, 2.1, 0.5, 9, BP.cap).translateY(4.55));
    var capCone = cone(1.9, 1.2, 9, BP.cap); capCone.position.y = 5.35; g.add(capCone);
    var hub = new THREE.Group(); hub.position.set(0, 4.0, 2.1);
    for (var i = 0; i < 4; i++) { var blade = new THREE.Group(); blade.add(box(0.5, 2.6, 0.12, BP.wood, 0, 1.3, 0)); blade.rotation.z = i * Math.PI / 2; hub.add(blade); }
    g.add(hub); g.add(box(1.2, 1.6, 0.3, BP.door, 0, 0.8, 1.9));
    return g;
  }
  function tfFarm() {
    var g = new THREE.Group();
    g.add(box(4.8, 0.12, 5.2, BP.bodyD, 0, 0.04, 0));
    for (var i = -3; i <= 3; i++) g.add(box(0.5, 0.16, 4.8, (i % 2 ? BP.wood : BP.cap), i * 0.62, 0.12, 0));
    var hut = new THREE.Group(); hut.position.set(2.5, 0, -3.4);
    hut.add(box(1.8, 1.3, 1.8, BP.body, 0, 0.65, 0)); hut.add(box(2.0, 0.4, 2.0, BP.cap, 0, 1.45, 0)); g.add(hut);
    return g;
  }
  function tfForge() {
    var g = new THREE.Group();
    g.add(box(4.4, 2.3, 4.0, BP.body, 0, 1.15, 0));
    g.add(box(4.8, 0.5, 4.4, BP.cap, 0, 2.35, 0));
    g.add(cyl(0.6, 0.7, 2.8, 7, BP.bodyD).translateX(1.4).translateY(3.2).translateZ(-1.0));
    var ember = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff5a1a, emissiveIntensity: 0.9, flatShading: true }));
    ember.position.set(1.4, 4.7, -1.0); g.add(ember);
    g.add(box(1.5, 1.6, 0.3, BP.door, 0, 0.8, 2.05));
    return g;
  }
  function tfWall() {
    var g = new THREE.Group();
    g.add(box(5.4, 2.0, 1.5, BP.body, 0, 1.0, 0));
    g.add(box(5.6, 0.4, 1.7, BP.cap, 0, 2.1, 0));                  // cream cap
    for (var x = -2.2; x <= 2.21; x += 0.73) g.add(box(0.46, 0.5, 1.6, BP.cap, x, 2.5, 0));   // merlons
    return g;
  }
  // ── per-race building flourishes ──────────────────────────────────────────
  function orcSpikeRidge(g, halfW, y, z) {                          // bone spikes along a ridge
    var n = Math.max(3, Math.round(halfW * 2.6));
    for (var i = 0; i < n; i++) { var sp = cone(0.16, 0.72, 5, P.bone); sp.position.set(-halfW + (i + 0.5) * (halfW * 2 / n), y, z == null ? 0 : z); g.add(sp); }
  }
  function elfCanopy(g, r, x, y, z) {                               // clustered leaf crown
    var c = new THREE.Group(); c.position.set(x || 0, y, z || 0); c.add(sphere(r, P.leaf));
    for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2, e = 0.2 + (i % 3) * 0.3; var b = sphere(r * 0.6, i % 2 ? P.leaf2 : P.leaf); b.position.set(Math.cos(a) * r * 0.7, Math.sin(e) * r * 0.5, Math.sin(a) * r * 0.7); c.add(b); }
    g.add(c);
  }
  function emberMesh(x, y, z, r) {
    var m = new THREE.Mesh(new THREE.IcosahedronGeometry(r || 0.42, 0), new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff5a1a, emissiveIntensity: 0.9, flatShading: true }));
    m.position.set(x, y, z); return m;
  }
  // ORC: tan stone + red cap + bone spikes + lashed timber
  function tfHouseOrc() {
    var g = new THREE.Group();
    g.add(cyl(1.9, 2.2, 2.2, 8, BP.body).translateY(1.1));
    var t = cone(2.3, 1.8, 8, BP.cap); t.position.y = 3.0; g.add(t);
    orcSpikeRidge(g, 1.8, 2.2, 0);
    g.add(box(1.0, 1.3, 0.3, BP.door, 0, 0.65, 2.0));
    return g;
  }
  function tfBarracksOrc(race) {
    var g = new THREE.Group();
    g.add(box(6.0, 2.3, 3.4, BP.body, 0, 1.15, 0));
    g.add(box(6.4, 0.5, 3.8, BP.cap, 0, 2.35, 0));
    orcSpikeRidge(g, 2.9, 2.75, 0);
    g.add(box(1.2, 1.5, 0.3, BP.door, 0, 0.75, 1.75));
    g.add(box(0.16, 1.7, 3.7, BP.woodD, 3.0, 1.0, 0));            // lashed beam
    g.add(box(0.14, 1.7, 0.14, BP.woodD, -2.9, 3.2, 0)); g.add(box(0.95, 0.55, 0.05, factionBanner(race), -2.4, 3.7, 0));
    return g;
  }
  function tfForgeOrc() {
    var g = new THREE.Group();
    g.add(box(4.4, 2.2, 3.8, BP.body, 0, 1.1, 0));
    var t = cone(2.6, 1.7, 8, BP.cap); t.position.y = 3.0; g.add(t);
    orcSpikeRidge(g, 2.0, 2.2, 0);
    g.add(cyl(0.9, 1.0, 0.7, 9, BP.bodyD).translateX(2.4).translateY(0.5).translateZ(1.4));   // cauldron
    g.add(emberMesh(2.4, 1.0, 1.4, 0.62));                        // lava glow
    g.add(box(1.4, 1.6, 0.3, BP.door, 0, 0.8, 1.95));
    return g;
  }
  // ELF: stone + leaf canopy + gnarled bark + glow
  function tfHouseElf() {
    var g = new THREE.Group();
    g.add(box(3.4, 1.9, 3.0, BP.body, 0, 0.95, 0));
    elfCanopy(g, 2.4, 0, 2.7, 0);
    [-1, 1].forEach(function (s) { g.add(cyl(0.12, 0.3, 2.2, 6, P.bark).translateX(1.6 * s).translateY(0.9).translateZ(1.2)); });
    g.add(box(1.1, 1.3, 0.3, BP.door, 0, 0.65, 1.55));
    return g;
  }
  function tfBarracksElf() {
    var g = new THREE.Group();
    g.add(box(5.6, 2.0, 3.2, BP.body, 0, 1.0, 0));
    elfCanopy(g, 1.9, -1.5, 2.6, 0); elfCanopy(g, 1.9, 1.5, 2.6, 0);
    [-1, 1].forEach(function (s) { g.add(cyl(0.14, 0.34, 2.4, 6, P.bark).translateX(2.7 * s).translateY(1.0).translateZ(1.1)); });
    g.add(box(1.2, 1.5, 0.3, BP.door, 0, 0.75, 1.65));
    var orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: 0xffe07a, emissive: 0xd9b94a, emissiveIntensity: 0.9, flatShading: true })); orb.position.set(0, 2.4, 1.7); g.add(orb);
    return g;
  }
  function tfForgeElf() {
    var g = new THREE.Group();
    g.add(cyl(1.6, 2.2, 4.0, 8, P.bark).translateY(2.0));         // ancient trunk
    elfCanopy(g, 2.6, 0, 5.0, 0);
    g.add(cyl(1.3, 1.4, 0.4, 10, BP.body).translateX(2.3).translateY(0.2).translateZ(0.6));   // moonwell basin
    g.add(emberMesh(2.3, 0.45, 0.6, 0.5).translateY(0));
    var well = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x6fe0d6, emissive: 0x3fbfb0, emissiveIntensity: 0.9, flatShading: true })); well.position.set(2.3, 0.45, 0.6); g.add(well);
    g.add(box(1.2, 1.6, 0.3, BP.door, 0, 0.8, 1.7));
    return g;
  }
  // inverted-hull toon outline (works with the core three build; no post-pass):
  // a back-faced black shell slightly larger than each mesh reads as a dark edge.
  var OUTLINE_MAT = null;
  function addOutline(group, k) {
    if (!OUTLINE_MAT) OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x241d15, side: THREE.BackSide });
    var meshes = [];
    group.traverse(function (o) { if (o.isMesh && o.material !== OUTLINE_MAT) meshes.push(o); });
    meshes.forEach(function (m) {
      var h = new THREE.Mesh(m.geometry, OUTLINE_MAT);
      h.position.copy(m.position); h.quaternion.copy(m.quaternion); h.scale.copy(m.scale).multiplyScalar(1 + k);
      h.castShadow = false; h.receiveShadow = false; h.renderOrder = -1;
      (m.parent || group).add(h);
    });
  }
  function makeBuildingMesh(b) {
    var race = raceOf(b.faction);
    BP = bpFor(race);
    var t = b.type || '';
    var g;
    if (/core|keep|castle|townhall|citadel|chiefs_hall/.test(t)) g = race === 'horde' ? tfKeepOrc(race) : race === 'elf' ? tfKeepElf(race) : tfKeep(race);
    else if (/wall|gate|rampart/.test(t)) g = tfWall();
    else if (/turret|tower/.test(t)) g = tfTower(race, b.towerType);
    else if (/forge/.test(t)) g = race === 'horde' ? tfForgeOrc() : race === 'elf' ? tfForgeElf() : tfForge();
    else if (/foundry|barrack/.test(t)) g = race === 'horde' ? tfBarracksOrc(race) : race === 'elf' ? tfBarracksElf() : tfBarracks(race);
    else if (/conduit|sheep|farm|pen/.test(t)) g = tfFarm();
    else if (/windmill|mill|merchant|market/.test(t)) g = tfWindmill(race);
    else g = race === 'horde' ? tfHouseOrc() : race === 'elf' ? tfHouseElf() : tfHouse(race);
    g.traverse(function (o) { o.castShadow = true; o.receiveShadow = true; });
    addOutline(g, 0.06);
    fitWidth(g, (b.w || 128) * 0.92);
    return g;
  }

  /* ---- units: lore-styled roster (ported from the character workshop) ----
   * One TEMPLATE is built per (race, role) and CLONED per unit — clones share
   * geometry + materials, so a full army stays cheap. Joints are named so each
   * clone can be animated independently. */
  function sph(r, mat) { return sphere(r, mat); }
  function ring(r, t, mat) { var m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 16), mat); m.castShadow = true; return m; }
  function dome(r, mat) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.56), mat); m.castShadow = true; return m; }
  function crescent(r, t, mat) { var m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 5, 14, Math.PI * 1.25), mat); m.castShadow = true; return m; }
  function plate(w, h, d, base, trim, x, y, z) { var g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0);
    g.add(box(w, h, d, base, 0, 0, 0)); g.add(box(w + 0.16, h + 0.16, d * 0.6, trim, 0, 0, -d * 0.22)); return g; }

  var RACEDEF = {
    crown: { skin: 0xe6ab73, skinD: 0xcf9560, cloth: 0x3f63b8, cloth2: 0x2c477f, metal: 0xb9c3d2, metalD: 0x848fa0,
      trim: 0xe4b53a, trimD: 0xb98a23, leather: 0x6b4a2a, beard: 0xd1552a, hair: 0x8a4a24, gem: 0x57d06a, cape: 0xb22b33,
      scale: 1.0, hunch: 0.02, armLen: 1.0, headR: 0.56, build: 1.12, legLen: 0.9, hand: 1.35, foot: 1.4, pauld: 1.0 },
    horde: { skin: 0x5f8a3a, skinD: 0x4c7030, cloth: 0x6e2f1c, cloth2: 0x4a2014, metal: 0x55585c, metalD: 0x393c40,
      trim: 0x8a6a3a, trimD: 0x5e4824, leather: 0x4a3320, bone: 0xe2dcc0, fur: 0x6a5436, warpaint: 0xc23528,
      hair: 0x14100c, beard: 0x14100c, gem: 0xd8642a, cape: 0x3a2418,
      scale: 1.08, hunch: 0.34, armLen: 1.34, headR: 0.6, build: 1.55, legLen: 0.8, hand: 1.6, foot: 1.45, pauld: 1.3 },
    elf: { skin: 0xb39bd8, skinD: 0x9c84c4, cloth: 0x2f6a5e, cloth2: 0x214b43, metal: 0xd6dde6, metalD: 0xa7b0bd,
      trim: 0xd9c069, trimD: 0xb89a45, leather: 0x4a4030, leaf: 0x4f8a5a, hair: 0xe6e3dc, eye: 0xffd27a,
      beard: 0x000000, gem: 0x8fe0d6, cape: 0x2f6a4a,
      scale: 1.06, hunch: -0.04, armLen: 1.06, headR: 0.48, build: 0.86, legLen: 1.18, hand: 1.05, foot: 1.05, pauld: 0.7 },
  };

  function buildHumanoid(race, role) {
    var Pal = RACEDEF[race];
    var heavy = (role === 'warrior' || role === 'hero' || role === 'lancer');
    var caster = (role === 'caster');                   // mage / shaman / priestess (gem staff + robe)
    var orc = race === 'horde', elf = race === 'elf', crown = race === 'crown';
    var troll = (orc && role === 'archer');             // Horde ranged = troll headhunter (spears)
    var sk = M(troll ? 0x4f8f86 : Pal.skin), skD = M(troll ? 0x3d7a70 : Pal.skinD),
      cloth = M(Pal.cloth), cloth2 = M(Pal.cloth2),
      metal = M(Pal.metal, { metalness: .35, roughness: .5 }), metalD = M(Pal.metalD, { metalness: .3, roughness: .55 }),
      trim = M(Pal.trim, { metalness: .55, roughness: .4 }), trimD = M(Pal.trimD, { metalness: .5, roughness: .46 }),
      leather = M(Pal.leather), fur = M(Pal.fur || 0x6a5436), bone = M(Pal.bone || 0xe2dcc0),
      beardM = M(Pal.beard), hairM = M(troll ? 0xdd6a24 : Pal.hair),
      gemM = M(Pal.gem, { emissive: Pal.gem, emissiveIntensity: .55, roughness: .3 }),
      warpaint = M(troll ? 0x2f6f8a : (Pal.warpaint || 0xc23528)),
      eyeM = elf ? M(Pal.eye, { emissive: Pal.eye, emissiveIntensity: 1.0, roughness: .4 }) : M(orc ? 0xe8c33a : 0x241f17, orc ? { emissive: 0xc28a14, emissiveIntensity: .4 } : {}),
      dark = M(0x241f17), white = M(0xeee7cf);
    var g = new THREE.Group();
    var bw = Pal.build, hsc = Pal.hand, fsc = Pal.foot, legLen = Pal.legLen, armLen = Pal.armLen, headR = Pal.headR, hunch = Pal.hunch;
    if (troll) { bw = 1.0; hsc = 1.05; fsc = 1.1; legLen = 1.12; armLen = 1.42; headR = 0.5; hunch = 0.18; }

    function leg(side) {
      var j = new THREE.Group(); j.position.set(0.36 * bw * side, 2.5 * legLen, 0);
      if (troll) { j.add(box(0.34 * bw, 1.05 * legLen, 0.42, sk, 0, -0.5 * legLen, 0)); j.add(box(0.4 * bw, 0.32, 0.46, leather, 0, -0.72 * legLen, 0)); }
      else if (orc) { j.add(box(0.56 * bw, 1.0 * legLen, 0.6, sk, 0, -0.5 * legLen, 0)); j.add(box(0.5 * bw, 0.4, 0.62, leather, 0, -0.16 * legLen, 0)); }
      else if (elf) { j.add(box(0.36 * bw, 1.05 * legLen, 0.4, cloth2, 0, -0.52 * legLen, 0)); }
      else { j.add(box(0.5 * bw, 1.05 * legLen, 0.54, heavy ? metalD : leather, 0, -0.52 * legLen, 0)); }
      var shin = new THREE.Group(); shin.position.y = -1.02 * legLen;
      if (troll) { shin.add(box(0.3 * bw, 0.95 * legLen, 0.34, sk, 0, -0.48 * legLen, 0)); shin.add(box(0.44 * fsc, 0.24, 0.82 * fsc, leather, 0, -0.96 * legLen, 0.18)); }
      else if (orc) { shin.add(box(0.46 * bw, 0.9 * legLen, 0.46, sk, 0, -0.45 * legLen, 0)); shin.add(box(0.6 * bw * fsc, 0.4, 0.85 * fsc, metalD, 0, -0.95 * legLen, 0.1)); shin.add(ring(0.34 * bw, 0.1, fur).rotateX(Math.PI / 2).translateY(-0.55 * legLen)); }
      else if (elf) { shin.add(box(0.32 * bw, 0.95 * legLen, 0.36, cloth2, 0, -0.48 * legLen, 0)); shin.add(box(0.4 * fsc, 0.3, 0.72 * fsc, leather, 0, -0.96 * legLen, 0.14)); shin.add(box(0.34 * fsc, 0.12, 0.34 * fsc, metal, 0, -0.86 * legLen, 0.1)); }
      else { shin.add(box(0.44 * bw, 0.95 * legLen, 0.48, heavy ? metal : leather, 0, -0.48 * legLen, 0)); shin.add(box(0.56 * bw * fsc, 0.34, 0.82 * fsc, metalD, 0, -0.98 * legLen, 0.12)); shin.add(box(0.5 * bw * fsc, 0.2, 0.34 * fsc, trim, 0, -1.0 * legLen, 0.45 * fsc)); if (heavy) { var r = ring(0.32 * bw, 0.06, trim); r.rotation.x = Math.PI / 2; r.position.y = -0.62 * legLen; shin.add(r); } }
      j.add(shin); j.userData = { shin: shin }; return j;
    }
    var legL = leg(-1), legR = leg(1); legL.name = 'legL'; legR.name = 'legR'; legL.userData.shin.name = 'shinL'; legR.userData.shin.name = 'shinR'; g.add(legL, legR);

    var torsoPivot = new THREE.Group(); torsoPivot.position.y = 2.5 * legLen; torsoPivot.rotation.x = hunch; torsoPivot.name = 'torso'; g.add(torsoPivot);
    if (troll) {
      torsoPivot.add(box(0.92 * bw, 1.5, 0.58, sk, 0, 0.86, 0));
      torsoPivot.add(box(0.8, 0.16, 0.04, warpaint, 0, 1.06, 0.3)); torsoPivot.add(box(0.6, 0.14, 0.04, warpaint, 0, 0.68, 0.3));
      torsoPivot.add(box(0.2, 0.7, 0.1, leather, 0, 0.85, 0.31).rotateZ(0.3));
      torsoPivot.add(box(0.9 * bw, 0.24, 0.6, leather, 0, 0.16, 0));
      torsoPivot.add(box(0.6, 0.95, 0.12, cloth, 0, -0.32, 0.32)); torsoPivot.add(box(0.6, 0.95, 0.12, cloth, 0, -0.32, -0.32));
      [-0.22, 0, 0.22].forEach(function (o) { torsoPivot.add(box(0.1, 0.1, 0.1, bone, o, 1.34, 0.28)); });
    } else if (orc) {
      torsoPivot.add(box(1.55 * bw, 1.45, 0.92, sk, 0, 0.86, 0));
      torsoPivot.add(box(0.5, 0.42, 0.22, sk, -0.34, 1.2, 0.42)); torsoPivot.add(box(0.5, 0.42, 0.22, sk, 0.34, 1.2, 0.42));
      [-1, 1].forEach(function (s) { var st = box(0.2, 1.9, 0.12, leather, 0, 0.8, 0.46); st.rotation.z = s * 0.42; torsoPivot.add(st); });
      torsoPivot.add(box(0.7, 0.1, 0.04, warpaint, 0, 0.95, 0.5)); torsoPivot.add(box(0.5, 0.1, 0.04, warpaint, 0, 0.6, 0.5));
      if (heavy) { torsoPivot.add(box(0.8, 1.1, 0.5, metalD, -0.38, 0.95, 0.4)); torsoPivot.add(ring(0.55, 0.12, fur).rotateX(Math.PI / 2).translateY(1.5)); }
      torsoPivot.add(box(1.45 * bw, 0.3, 0.94, leather, 0, 0.16, 0)); torsoPivot.add(box(0.32, 0.3, 0.1, bone, 0, 0.16, 0.5));
      torsoPivot.add(box(0.7, 0.95, 0.14, leather, 0, -0.3, 0.42)); torsoPivot.add(box(0.7, 0.95, 0.14, leather, 0, -0.3, -0.42));
    } else if (elf) {
      torsoPivot.add(box(1.0 * bw, 1.5, 0.6, cloth, 0, 0.86, 0));
      if (heavy) { torsoPivot.add(plate(0.92 * bw, 1.05, 0.34, metal, trim, 0, 0.98, 0.34));
        torsoPivot.add(crescent(0.22, 0.05, metal).translateY(1.05).translateZ(0.56)); torsoPivot.add(box(0.2, 0.2, 0.1, gemM, 0, 0.75, 0.56));
        [-1, 1].forEach(function (s) { var lf = cone(0.16, 0.5, 4, M(Pal.leaf)); lf.position.set(0.32 * s, 1.45, 0.2); lf.rotation.z = s * 0.5; torsoPivot.add(lf); }); }
      else if (role === 'archer') { torsoPivot.add(box(1.0 * bw, 1.3, 0.62, leather, 0, 0.9, 0)); torsoPivot.add(box(0.18, 1.5, 0.1, M(Pal.leaf), -0.3, 0.85, 0.34).rotateZ(0.3)); }
      torsoPivot.add(box(0.9 * bw, 0.22, 0.64, leather, 0, 0.18, 0)); torsoPivot.add(box(0.2, 0.2, 0.08, gemM, 0, 0.18, 0.34));
      torsoPivot.add(box(0.7, 0.6, 0.12, cloth2, 0, -0.18, 0.3));
    } else {
      torsoPivot.add(box(1.4 * bw, 1.6, 0.82, heavy ? metalD : cloth, 0, 0.86, 0));
      if (heavy) { torsoPivot.add(plate(1.3 * bw, 1.15, 0.5, metal, trim, 0, 0.98, 0.42));
        if (role === 'hero') torsoPivot.add(box(0.26, 0.26, 0.12, gemM, 0, 1.02, 0.74));
        torsoPivot.add(plate(1.2 * bw, 0.6, 0.4, metalD, trim, 0, 0.0, 0.34)); }
      else torsoPivot.add(box(0.42, 1.3, 0.06, trimD, 0, 0.74, 0.43));
      torsoPivot.add(box(1.42 * bw, 0.3, 0.84, leather, 0, 0.18, 0));
      torsoPivot.add(box(0.34, 0.32, 0.1, trim, 0, 0.18, 0.45)); torsoPivot.add(box(0.16, 0.16, 0.06, gemM, 0, 0.18, 0.5));
    }

    if (orc && !troll && heavy) {
      var grp = new THREE.Group(); grp.position.set(0.92 * bw, 1.62, 0); grp.add(dome(0.7 * Pal.pauld, metalD));
      [0, 1, 2, 3].forEach(function (i) { var sp = cone(0.13, 0.5, 5, bone); var a = i / 4 * Math.PI - 0.4; sp.position.set(Math.cos(a) * 0.5, 0.3 + Math.sin(a) * 0.3, 0); sp.rotation.z = -a + Math.PI / 2; grp.add(sp); });
      torsoPivot.add(grp);
      var furL = new THREE.Group(); furL.position.set(-0.92 * bw, 1.6, 0);
      [0, 0.2, -0.2].forEach(function (o) { furL.add(box(0.4, 0.45, 0.4, fur, 0, o * 0.5, o)); }); torsoPivot.add(furL);
    } else if (elf && heavy) {
      [-1, 1].forEach(function (s) { var lf = cone(0.34 * Pal.pauld, 0.5, 5, metal); lf.position.set(0.7 * bw * s, 1.55, 0); lf.rotation.z = s * 0.7; lf.scale.set(1, 1, 0.6); torsoPivot.add(lf);
        torsoPivot.add(crescent(0.18, 0.04, trim).translateX(0.7 * bw * s).translateY(1.5)); });
    } else if (crown && heavy) {
      [-1, 1].forEach(function (s) { var grp2 = new THREE.Group(); grp2.position.set(0.86 * bw * s, 1.6, 0);
        var pd = dome(0.5, metalD); pd.scale.set(1.05, 0.62, 1.05); pd.position.y = 0.02; grp2.add(pd);   // flatter steel pauldron
        var r = ring(0.46, 0.06, trim); r.rotation.x = Math.PI / 2; r.position.y = -0.02; grp2.add(r);    // gold ridge
        grp2.add(box(0.66, 0.12, 0.66, trim, 0, 0.16, 0));                                                 // crest plate
        torsoPivot.add(grp2); });
    }

    function arm(side) {
      var j = new THREE.Group(); j.position.set((troll ? 0.58 : orc ? 0.86 : 0.78) * bw * side, 1.42, 0);
      if (troll) { j.add(box(0.3, 1.0 * armLen, 0.32, sk, 0, -0.48 * armLen, 0)); j.add(ring(0.22, 0.05, bone).rotateX(Math.PI / 2).translateY(-0.2)); }
      else if (orc) { j.add(box(0.48, 1.0 * armLen, 0.5, sk, 0, -0.48 * armLen, 0)); j.add(ring(0.28, 0.07, bone).rotateX(Math.PI / 2).translateY(-0.2)); }
      else if (elf) { j.add(box(0.32, 1.0 * armLen, 0.34, heavy ? metal : M(Pal.cloth), 0, -0.48 * armLen, 0)); }
      else { j.add(box(0.4, 1.0 * armLen, 0.44, heavy ? metal : M(Pal.cloth), 0, -0.48 * armLen, 0)); }
      var fore = new THREE.Group(); fore.position.y = -0.94 * armLen;
      if (troll) { fore.add(box(0.26, 0.84 * armLen, 0.28, sk, 0, -0.4 * armLen, 0)); fore.add(box(0.3, 0.3, 0.3, leather, 0, -0.62 * armLen, 0)); fore.add(box(0.34 * hsc, 0.34, 0.34 * hsc, sk, 0, -0.84 * armLen, 0.04)); }
      else if (orc) { fore.add(box(0.42, 0.8 * armLen, 0.44, sk, 0, -0.4 * armLen, 0)); fore.add(box(0.46, 0.34, 0.46, leather, 0, -0.66 * armLen, 0)); fore.add(box(0.54 * hsc, 0.42, 0.54 * hsc, sk, 0, -0.85 * armLen, 0.04)); }
      else if (elf) { fore.add(box(0.28, 0.82 * armLen, 0.3, sk, 0, -0.4 * armLen, 0)); fore.add(box(0.34, 0.4, 0.34, leather, 0, -0.6 * armLen, 0)); fore.add(box(0.36 * hsc, 0.34, 0.36 * hsc, leather, 0, -0.84 * armLen, 0.04)); }
      else { fore.add(box(0.36, 0.82 * armLen, 0.38, heavy ? metalD : sk, 0, -0.4 * armLen, 0)); fore.add(box(0.5 * hsc, 0.42, 0.5 * hsc, heavy ? metal : leather, 0, -0.82 * armLen, 0.04)); if (heavy) fore.add(box(0.5 * hsc, 0.12, 0.5 * hsc, trim, 0, -0.66 * armLen, 0.04)); }
      j.add(fore); j.userData = { fore: fore }; return j;
    }
    var armL = arm(-1), armR = arm(1); armL.name = 'armL'; armR.name = 'armR'; torsoPivot.add(armL, armR);
    var rfore = armR.userData.fore, lfore = armL.userData.fore;

    var headPivot = new THREE.Group(); headPivot.position.y = 1.78; headPivot.name = 'head'; torsoPivot.add(headPivot);
    headPivot.add(cyl(0.2, 0.24, 0.26, 8, sk).translateY(-0.08));
    var head = sph(headR, sk); head.scale.set(1, elf ? 1.12 : 1.02, 0.96); head.position.y = 0.34; headPivot.add(head);
    if (troll) {
      headPivot.add(box(0.3, 0.34, 0.5, sk, 0, 0.28, headR * 0.78)); headPivot.add(box(0.16, 0.22, 0.16, skD, 0, 0.18, headR * 1.05));
      headPivot.add(box(0.62, 0.08, 0.04, warpaint, 0, 0.42, headR * 0.86));
      headPivot.add(box(0.12, 0.09, 0.09, eyeM, -0.15, 0.46, headR * 0.82)); headPivot.add(box(0.12, 0.09, 0.09, eyeM, 0.15, 0.46, headR * 0.82));
      [-1, 1].forEach(function (s) { var tk = cone(0.09, 0.5, 5, bone); tk.position.set(0.2 * s, 0.1, headR * 0.6); tk.rotation.x = 0.4; tk.rotation.z = s * 0.15; headPivot.add(tk); });
      [-0.16, 0, 0.16].forEach(function (o, i) { var mo = cone(0.1, 0.55 + (i === 1 ? 0.25 : 0), 4, hairM); mo.position.set(o, 0.66, -0.02); headPivot.add(mo); });
      headPivot.add(cone(0.1, 0.6, 4, sk).translateX(-headR * 0.95).translateY(0.3).rotateZ(0.7)); headPivot.add(cone(0.1, 0.6, 4, sk).translateX(headR * 0.95).translateY(0.3).rotateZ(-0.7));
      var fth = box(0.06, 0.5, 0.14, M(0xd84a3a), 0.2, 0.95, -0.1); fth.rotation.z = 0.3; headPivot.add(fth);
    } else if (orc) {
      headPivot.add(box(0.66, 0.18, 0.16, skD, 0, 0.46, headR * 0.7)); headPivot.add(box(0.62, 0.32, 0.46, sk, 0, 0.06, headR * 0.5));
      headPivot.add(box(0.7, 0.1, 0.04, warpaint, 0, 0.36, headR * 0.82));
      headPivot.add(box(0.14, 0.1, 0.1, eyeM, -0.16, 0.4, headR * 0.78)); headPivot.add(box(0.14, 0.1, 0.1, eyeM, 0.16, 0.4, headR * 0.78));
      [-1, 1].forEach(function (s) { var tk = cone(0.1, 0.42, 5, bone); tk.position.set(0.2 * s, 0.0, headR * 0.66); tk.rotation.x = -0.5; tk.rotation.z = -s * 0.2; headPivot.add(tk); });
      [-0.18, 0, 0.18].forEach(function (o) { var mo = cone(0.1, 0.4, 4, hairM); mo.position.set(o, 0.62, -0.05); headPivot.add(mo); });
      headPivot.add(cone(0.12, 0.34, 4, skD).translateX(-headR * 0.94).translateY(0.34).rotateZ(0.4)); headPivot.add(cone(0.12, 0.34, 4, skD).translateX(headR * 0.94).translateY(0.34).rotateZ(-0.4));
      if (heavy) { headPivot.add(ring(headR + 0.04, 0.06, bone).rotateX(Math.PI / 2).translateY(0.4)); }
    } else if (elf) {
      headPivot.add(box(0.16, 0.1, 0.06, eyeM, -0.15, 0.36, headR * 0.84)); headPivot.add(box(0.16, 0.1, 0.06, eyeM, 0.15, 0.36, headR * 0.84));
      headPivot.add(cone(0.09, 0.5, 4, sk).translateX(-headR * 0.92).translateY(0.34).rotateZ(0.5)); headPivot.add(cone(0.09, 0.5, 4, sk).translateX(headR * 0.92).translateY(0.34).rotateZ(-0.5));
      if (role !== 'archer') { headPivot.add(box(0.56, 1.3, 0.16, hairM, 0, -0.1, -headR * 0.7));
        headPivot.add(box(0.2, 1.4, 0.14, hairM, -0.34, -0.15, -headR * 0.4)); headPivot.add(box(0.2, 1.4, 0.14, hairM, 0.34, -0.15, -headR * 0.4));
        headPivot.add(dome(headR + 0.04, hairM).translateY(0.34)); }
      // brown branch antlers sweeping up + back from the brow (both sides)
      var antlerM = M(0x6e4a2a);
      [-1, 1].forEach(function (s) {
        var an = new THREE.Group(); an.position.set(headR * 0.5 * s, 0.5, -0.04); an.rotation.z = s * 0.5; an.rotation.x = -0.35;
        an.add(cone(0.06, 0.8, 4, antlerM).translateY(0.4));                         // main beam
        var t1 = cone(0.045, 0.42, 4, antlerM); t1.position.set(s * 0.16, 0.46, 0); t1.rotation.z = s * 0.8; an.add(t1);   // lower tine
        var t2 = cone(0.04, 0.34, 4, antlerM); t2.position.set(s * 0.1, 0.72, 0.06); t2.rotation.z = s * 0.35; t2.rotation.x = -0.3; an.add(t2);   // upper tine
        headPivot.add(an);
      });
    } else {
      headPivot.add(box(0.46, 0.1, 0.06, dark, 0, 0.4, headR * 0.86));
      headPivot.add(box(0.62, 0.6, 0.42, beardM, 0, 0.02, headR * 0.5)); headPivot.add(box(0.5, 0.5, 0.36, beardM, 0, -0.34, headR * 0.55)); headPivot.add(box(0.32, 0.36, 0.26, beardM, 0, -0.72, headR * 0.5));
    }
    // helm / headgear
    if (crown && heavy) { var helm = dome(headR + 0.08, metal); helm.position.y = 0.4; helm.scale.set(1, 1.05, 1); headPivot.add(helm);
      headPivot.add(box(0.9, 0.18, 0.9, trim, 0, 0.5, 0)); headPivot.add(box(0.12, 0.5, 0.14, metalD, 0, 0.5, headR * 0.78));
      [-1, 1].forEach(function (s) { var wg = box(0.5, 0.26, 0.1, trim, 0.5 * s, 0.62, -0.1); wg.rotation.z = s * 0.5; headPivot.add(wg); });
      if (role === 'hero') [-1, 1].forEach(function (s) { var w2 = box(0.42, 0.2, 0.08, trim, 0.62 * s, 0.82, -0.1); w2.rotation.z = s * 0.7; headPivot.add(w2); }); }
    else if (orc && !troll && role === 'hero') { headPivot.add(box(headR * 1.9, 0.3, headR * 1.9, metalD, 0, 0.52, 0));
      [-1, 1].forEach(function (s) { var hn = crescent(0.34, 0.08, bone); hn.position.set(0.34 * s, 0.7, 0); hn.rotation.z = s * 1.4; headPivot.add(hn); }); }
    else if (elf && heavy) { headPivot.add(ring(headR + 0.02, 0.05, trim).rotateX(Math.PI / 2).translateY(0.42));
      headPivot.add(crescent(0.2, 0.05, metal).translateY(0.66).translateZ(headR * 0.3));
      if (role === 'hero') [-1, 1].forEach(function (s) { var fin = cone(0.12, 0.6, 4, metal); fin.position.set(0.3 * s, 0.55, -0.2); fin.rotation.z = s * 0.9; fin.rotation.x = -0.5; headPivot.add(fin); }); }
    else if (caster) {
      if (crown) { var wh = cone(headR + 0.1, 1.5, 8, cloth2); wh.position.y = 0.95; wh.rotation.z = 0.08; headPivot.add(wh);
        headPivot.add(cyl(headR + 0.16, headR + 0.16, 0.12, 8, cloth2).translateY(0.42)); headPivot.add(box(0.18, 0.18, 0.08, M(Pal.gem, { emissive: Pal.gem, emissiveIntensity: .8 }), 0, 0.55, headR * 0.55)); }
      else if (orc) { headPivot.add(box(headR * 1.9, 0.22, headR * 1.9, leather, 0, 0.5, 0));
        [-0.3, -0.1, 0.1, 0.3].forEach(function (o) { var fe = box(0.05, 0.6, 0.14, o < 0 ? warpaint : M(0xd84a3a), o, 0.85, -0.1); fe.rotation.z = o * 0.6; fe.rotation.x = -0.3; headPivot.add(fe); });
        [-1, 1].forEach(function (s) { headPivot.add(cone(0.08, 0.4, 5, bone).translateX(headR * s).translateY(0.5).rotateZ(-s * 0.9)); }); }
      else { headPivot.add(dome(headR + 0.06, cloth).translateY(0.34)); headPivot.add(box(0.5, 1.3, 0.16, hairM, 0, -0.1, -headR * 0.7));
        headPivot.add(crescent(0.2, 0.05, trim).translateY(0.7).translateZ(headR * 0.2)); headPivot.add(box(0.16, 0.16, 0.08, M(Pal.gem, { emissive: Pal.gem, emissiveIntensity: .8 }), 0, 0.4, headR * 0.62)); }
    }
    else if (role === 'archer' && !troll) { var hd = cone(headR + 0.14, 0.8, 8, elf ? M(Pal.leaf) : cloth2); hd.position.y = 0.52; headPivot.add(hd);
      headPivot.add(box(headR * 1.7, 0.6, 0.2, elf ? M(Pal.leaf) : cloth2, 0, 0.2, -headR * 0.7));
      if (elf) headPivot.add(crescent(0.14, 0.04, trim).translateY(0.5).translateZ(headR * 0.5)); }
    else if (crown) { var cap = dome(headR + 0.05, hairM); cap.position.y = 0.34; headPivot.add(cap); }

    if (role === 'hero') { var cape = box((orc ? 1.5 : 1.4) * bw, 2.3, 0.12, M(Pal.cape), 0, 0.5, -0.46); cape.rotation.x = 0.13; torsoPivot.add(cape);
      torsoPivot.add(box(1.5 * bw, 0.3, 0.16, elf ? metal : trim, 0, 1.55, -0.42));
      if (elf) torsoPivot.add(crescent(0.18, 0.05, metal).translateY(1.55).translateZ(-0.34)); }

    function holdR(o) { o.position.add(new THREE.Vector3(0, -0.95 * armLen, 0.06)); rfore.add(o); }
    if (role === 'worker') {
      var tool = new THREE.Group(); tool.add(cyl(0.07, 0.07, 1.8, 6, leather).translateY(-0.2)); tool.add(box(0.8, 0.18, 0.18, metalD, 0, 0.62, 0)); tool.add(box(0.2, 0.3, 0.18, metal, 0.34, 0.6, 0));
      holdR(tool); tool.rotation.z = 0.5; armR.rotation.x = -0.5;
    } else if (role === 'warrior') {
      if (orc) { var axe = new THREE.Group(); axe.add(cyl(0.11, 0.11, 2.1, 6, leather)); axe.add(box(0.22, 1.0, 1.1, metalD, 0, 0.9, 0.32)); axe.add(box(0.22, 0.5, 0.5, metalD, 0, 1.35, 0.62)); axe.add(box(0.24, 0.95, 0.16, bone, 0, 0.85, -0.2)); holdR(axe); axe.rotation.z = 0.32;
        var oshield = box(0.16, 1.1, 0.95, metalD, -0.05, -0.4, 0.2); lfore.add(oshield); lfore.add(box(0.2, 0.3, 0.3, bone, 0, -0.4, 0.28)); armL.rotation.x = -0.4; }
      else if (elf) { var gl = new THREE.Group(); gl.add(cyl(0.07, 0.07, 2.4, 6, leather).translateY(0.1)); gl.add(crescent(0.5, 0.07, metal).translateY(1.35)); holdR(gl); gl.rotation.z = 0.1; armR.rotation.x = -0.15;
        var leafShield = new THREE.Group(); var lblade = cone(0.62, 1.5, 5, M(Pal.leaf)); lblade.scale.set(1, 1, 0.16); leafShield.add(lblade);
        leafShield.add(box(0.06, 1.35, 0.05, M(Pal.cloth2), 0, 0, 0.05)); leafShield.add(box(0.16, 0.16, 0.08, gemM, 0, 0.1, 0.06));
        leafShield.position.set(-0.05, -0.4, 0.24); lfore.add(leafShield); armL.rotation.x = -0.45; }
      else { var sw = new THREE.Group(); sw.add(box(0.13, 1.8, 0.14, metal, 0, 0.6, 0)); sw.add(box(0.6, 0.16, 0.18, trim, 0, -0.2, 0)); sw.add(box(0.16, 0.4, 0.16, leather, 0, -0.5, 0)); sw.add(sph(0.13, trim).translateY(-0.74)); holdR(sw); sw.rotation.z = 0.18;
        var shield = plate(0.14, 1.2, 0.95, M(Pal.cloth), trim, -0.05, -0.4, 0.22); lfore.add(shield); lfore.add(box(0.16, 0.4, 0.34, gemM, 0, -0.4, 0.3)); armL.rotation.x = -0.45; }
    } else if (role === 'lancer') {
      var lance = new THREE.Group(); lance.add(cyl(0.06, 0.06, 3.7, 6, leather).translateY(0.2));
      lance.add(cone(0.13, 0.72, 6, metal).translateY(2.1)); lance.add(ring(0.15, 0.05, trim).rotateX(Math.PI / 2).translateY(1.55));
      lance.add(box(0.46, 0.36, 0.03, M(Pal.cape), 0.27, 1.6, 0));          // pennon
      holdR(lance); lance.rotation.z = 0.05; armR.rotation.x = -0.12;
      if (elf) { var lsE = new THREE.Group(); var lbE = cone(0.6, 1.4, 5, M(Pal.leaf)); lbE.scale.set(1, 1, 0.16); lsE.add(lbE); lsE.add(box(0.05, 1.25, 0.05, M(Pal.cloth2), 0, 0, 0.05)); lsE.position.set(-0.05, -0.4, 0.24); lfore.add(lsE); }
      else { var lsh = plate(0.14, 1.25, 0.82, M(Pal.cloth), trim, -0.05, -0.4, 0.22); lfore.add(lsh); lfore.add(box(0.14, 0.36, 0.3, gemM, 0, -0.4, 0.3)); }
      armL.rotation.x = -0.45;
    } else if (caster) {
      var gemBright = M(Pal.gem, { emissive: Pal.gem, emissiveIntensity: .95, roughness: .25 });
      var staff = new THREE.Group(); staff.add(cyl(0.06, 0.06, 2.9, 6, leather).translateY(0.1));
      if (crown) { staff.add(ring(0.22, 0.05, trim).rotateX(Math.PI / 2).translateY(1.55)); staff.add(sph(0.18, gemBright).translateY(1.55)); }
      else if (orc) { var skull = sph(0.2, bone); skull.scale.set(1, 1.1, 0.9); skull.position.y = 1.55; staff.add(skull);
        [-1, 1].forEach(function (s) { staff.add(cone(0.07, 0.32, 4, bone).translateX(0.16 * s).translateY(1.78).rotateZ(-s * 0.5)); });
        [-1, 1].forEach(function (s) { var fe = box(0.05, 0.42, 0.12, warpaint, 0.06 * s, 1.3, 0); fe.rotation.z = s * 0.3; staff.add(fe); }); staff.add(sph(0.09, gemBright).translateY(1.55).translateZ(0.16)); }
      else { staff.add(crescent(0.34, 0.06, metal).translateY(1.5)); staff.add(sph(0.15, gemBright).translateY(1.52)); }
      holdR(staff); staff.rotation.z = 0.04; armR.rotation.x = -0.12;
      // flowing robe over the legs
      var robeMat = crown ? cloth : orc ? leather : cloth;
      var robe = cyl(0.5 * bw, 1.0 * bw, 2.5, 9, robeMat); robe.position.y = 1.55; g.add(robe);
      g.add(cyl(1.0 * bw, 1.0 * bw, 0.16, 9, elf ? M(Pal.gem, { emissive: Pal.gem, emissiveIntensity: .5 }) : trim).translateY(0.34));   // hem band
      torsoPivot.add(box(0.34, 0.32, 0.1, gemBright, 0, 0.5, 0.34));        // chest gem clasp
    } else if (role === 'archer') {
      if (troll) {
        var mkSpear = function () { var sp = new THREE.Group(); sp.add(cyl(0.05, 0.05, 2.6, 6, leather)); sp.add(cone(0.12, 0.5, 4, bone).translateY(1.45)); sp.add(box(0.16, 0.14, 0.14, M(0xd84a3a), 0, 1.05, 0)); return sp; };
        var held = mkSpear(); held.position.set(0, -0.9 * armLen, 0.1); held.rotation.x = -0.5; rfore.add(held); armR.rotation.x = 0.6; armR.rotation.z = 0.2;
        [-0.12, 0, 0.12].forEach(function (o) { var s2 = mkSpear(); s2.scale.setScalar(0.9); s2.position.set(-0.5 + o, 1.2, -0.42); s2.rotation.x = 0.5; s2.rotation.z = 0.2 + o; torsoPivot.add(s2); });
      } else if (elf) { var bow = new THREE.Group(); bow.add(box(0.04, 1.6, 0.05, metal, 0, -0.5, 0.28));
        bow.add(crescent(0.34, 0.05, metal).translateY(0.18).translateZ(0.28)); bow.add(crescent(0.34, 0.05, metal).translateY(-1.18).translateZ(0.28).rotateZ(Math.PI)); bow.add(box(0.02, 2.0, 0.02, white, 0, -0.5, 0.28)); lfore.add(bow); armL.rotation.x = -0.5; armR.rotation.x = -0.58; }
      else { var bow2 = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 5, 14, Math.PI), trim); bow2.rotation.z = Math.PI / 2; bow2.position.set(0, -0.5, 0.28); lfore.add(bow2); lfore.add(box(0.02, 1.95, 0.02, white, 0, -0.5, 0.28)); armL.rotation.x = -0.5; armR.rotation.x = -0.58; }
      if (!troll) { torsoPivot.add(cyl(0.18, 0.18, 0.95, 8, leather).translateX(-0.44).translateY(1.2).translateZ(-0.38));
        [0, 0.11, -0.11].forEach(function (o) { torsoPivot.add(box(0.04, 0.5, 0.04, white, -0.44 + o, 1.82, -0.38)); }); }
    } else if (role === 'hero') {
      if (crown) { var hm = new THREE.Group(); hm.add(cyl(0.11, 0.11, 2.5, 8, leather).translateY(0.1));
        [1.0, 1.25].forEach(function (y) { hm.add(cyl(0.13, 0.13, 0.12, 8, trim).translateY(y)); });
        hm.add(box(0.78, 0.95, 0.7, metal, 0, 1.5, 0)); hm.add(box(0.86, 0.3, 0.78, trim, 0, 1.18, 0)); hm.add(box(0.86, 0.3, 0.78, trim, 0, 1.82, 0)); hm.add(box(0.2, 0.4, 0.2, gemM, 0, 1.5, 0.4)); holdR(hm); hm.rotation.z = 0.18; armR.rotation.x = -0.2; }
      else if (orc) { var axe2 = new THREE.Group(); axe2.add(cyl(0.13, 0.13, 2.5, 6, leather));
        axe2.add(box(0.22, 1.05, 1.15, metalD, 0, 1.05, 0.36)); axe2.add(box(0.22, 1.05, 1.15, metalD, 0, 1.05, -0.36)); axe2.add(sph(0.22, bone).translateY(-1.15)); axe2.add(box(0.18, 0.4, 0.18, warpaint, 0, 1.05, 0)); holdR(axe2); axe2.rotation.z = 0.28; }
      else { var glaive = new THREE.Group(); glaive.add(cyl(0.08, 0.08, 2.7, 6, leather)); glaive.add(crescent(0.62, 0.08, metal).translateY(1.5));
        var orb = sph(0.16, M(Pal.gem, { emissive: Pal.gem, emissiveIntensity: .7, roughness: .3 })); orb.position.y = 1.5; glaive.add(orb); holdR(glaive); glaive.rotation.z = 0.08; }
    }

    g.userData = { isArcher: role === 'archer' };
    g.scale.setScalar(Pal.scale);
    g.traverse(function (o) { o.castShadow = true; });
    return g;
  }

  /* ---- Thronefall-minimal units ----------------------------------------
   * Clean team/faction-colored figures (body + shield/weapon), strong flat
   * shading. Read at RTS zoom by color + silhouette, not detail. (The detailed
   * lore roster still lives in the character workshop poc.) */
  var TFCOL = {
    crown: { body: 0x3f63b8, dark: 0x2b4682, trim: 0xdbe4f2 },   // Iron Crown — blue
    horde: { body: 0xb5462f, dark: 0x86301f, trim: 0xe0a060 },   // Raider Horde — ember red
    elf:   { body: 0x3f8a6a, dark: 0x2c6149, trim: 0xe6cf6a },   // Rimwalkers — teal/gold
  };
  function buildMinimalUnit(race, role) {
    var col = TFCOL[race] || TFCOL.crown;
    var body = M(col.body), bodyD = M(col.dark), trim = M(col.trim),
        skin = M(0xe7c69e), steel = M(0xb9c2cc), wood = M(0x6b4a2a),
        glow = M(col.trim, { emissive: col.trim, emissiveIntensity: .5 });
    var g = new THREE.Group();
    var hero = role === 'hero';
    var hipY = 0.7;
    function ml(side) { var j = new THREE.Group(); j.position.set(0.22 * side, hipY, 0); j.add(box(0.36, 0.72, 0.36, bodyD, 0, -0.36, 0)); return j; }
    var legL = ml(-1), legR = ml(1); legL.name = 'legL'; legR.name = 'legR'; g.add(legL, legR);
    // tapered torso + small head + helmet cap
    g.add(cyl(0.5, 0.7, 1.35, 8, body).translateY(1.38));
    g.add(sph(0.34, skin).translateY(2.25));
    g.add(dome(0.4, hero ? M(0xe4b53a) : steel).translateY(2.22));
    if (role === 'worker') {
      var t = box(0.1, 1.15, 0.1, wood, 0.42, 1.45, 0.12); t.rotation.z = 0.4; g.add(t);
      g.add(box(0.28, 0.22, 0.22, steel, 0.55, 2.02, 0.12));
    } else if (role === 'archer') {
      var bow = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 5, 12, Math.PI), wood);
      bow.rotation.z = Math.PI / 2; bow.position.set(-0.58, 1.55, 0.22); g.add(bow);
      g.add(box(0.02, 1.2, 0.02, M(0xeee7cf), -0.58, 1.55, 0.22));
    } else if (role === 'monk') {
      g.add(cyl(0.05, 0.05, 1.8, 6, wood).translateX(0.5).translateY(1.55).translateZ(0.1));
      g.add(sph(0.17, glow).translateX(0.5).translateY(2.5).translateZ(0.1));
      g.add(cone(0.4, 0.6, 7, bodyD).translateY(2.35));   // hood
    } else { // warrior / lancer / melee — kite shield + spear
      g.add(box(0.14, 1.0, 0.7, trim, -0.52, 1.42, 0.16));
      g.add(box(0.16, 0.5, 0.32, body, -0.54, 1.42, 0.16));   // emblem
      g.add(cyl(0.05, 0.05, 2.0, 6, wood).translateX(0.5).translateY(1.6).translateZ(0.1));
      g.add(cone(0.1, 0.32, 4, steel).translateX(0.5).translateY(2.65).translateZ(0.1));
    }
    if (hero) {
      var cape = box(0.95, 1.45, 0.1, trim, 0, 1.45, -0.36); cape.rotation.x = 0.12; g.add(cape);
      g.add(box(0.14, 0.5, 0.14, M(0xe4b53a), 0, 2.0, 0));
    }
    g.traverse(function (o) { o.castShadow = true; });
    addOutline(g, 0.12);
    return g;
  }

  var unitTemplates = {};
  function mapRole(u) {
    if (u.heroId || u.role === 'hero') return 'hero';
    var r = u.role;
    if (r === 'pawn' || r === 'worker') return 'worker';
    if (r === 'archer') return 'archer';
    if (r === 'monk' || r === 'priest' || r === 'caster') return 'caster';   // mage/shaman/priestess
    if (r === 'lancer') return 'lancer';
    return 'warrior';
  }
  function unitTemplate(race, role) {
    var key = race + ':' + role;
    if (unitTemplates[key]) return unitTemplates[key];
    var g = buildHumanoid(race, role);   // DETAILED roster (reversed from minimal pegs)
    fitHeight(g, role === 'hero' ? 60 : role === 'worker' ? 34 : 48);
    unitTemplates[key] = g;
    return g;
  }
  /* ---- glTF model pipeline ----------------------------------------------
   * Procedural primitives top out at "low-poly robots". To reach the smooth,
   * sculpted reference look, render real modeled .glb assets instead. A model
   * is registered per (race:role) key (or 'race:*' / '*' wildcards); when one
   * is loaded it replaces the procedural body, otherwise we fall back to it —
   * so the game looks identical until real assets are dropped in. */
  var UNIT_MODELS = {};        // 'crown:warrior' -> { url, height, yaw, anims:{idle,walk,attack,death} }
  var modelProtos = {};        // key -> { scene, clips }
  var _gltf = null, _clock = null;
  function modelKeys(race, role) { return [race + ':' + role, race + ':*', '*']; }
  function protoFor(race, role) {
    var ks = modelKeys(race, role);
    for (var i = 0; i < ks.length; i++) if (modelProtos[ks[i]]) return { proto: modelProtos[ks[i]], cfg: UNIT_MODELS[ks[i]] };
    return null;
  }
  function registerUnitModel(key, cfg) { UNIT_MODELS[key] = cfg; }
  var _urlCache = {};
  function loadOne(url) {
    if (_urlCache[url]) return _urlCache[url];   // each .glb fetched/decoded once, reused across keys
    _urlCache[url] = new Promise(function (res) {
      _gltf.load(url, function (gltf) { res({ scene: gltf.scene, clips: gltf.animations || [] }); },
        undefined, function () { res(null); });   // on error → null → procedural fallback
    });
    return _urlCache[url];
  }
  function loadUnitModels() {
    THREE = THREE || window.THREE;
    if (!THREE || !THREE.GLTFLoader) return Promise.resolve(false);
    if (!_gltf) _gltf = new THREE.GLTFLoader();
    var keys = Object.keys(UNIT_MODELS);
    return Promise.all(keys.map(function (k) {
      if (modelProtos[k]) return Promise.resolve();
      return loadOne(UNIT_MODELS[k].url).then(function (p) { if (p) modelProtos[k] = p; });
    })).then(function () { return true; });
  }
  // when models finish loading mid-match, drop existing unit meshes (without
  // disposing shared procedural geometry) so syncList rebuilds them as models
  function rebuildUnitMeshes() {
    for (var id in R.pool) {
      var sl = R.pool[id];
      if (sl && sl.kind === 'unit') { R.scene.remove(sl.obj); if (sl.hp) R.scene.remove(sl.hp); delete R.pool[id]; }
    }
  }
  /* Default roster: KayKit "Adventurers" (CC0, stylized low-poly) mapped per
   * race/role for silhouette variety. 5 models reused across keys (loaded once).
   * Closest free match to the sculpted reference look; real per-race orc/elf
   * assets can override any key later. */
  var KK = 'assets/models/kaykit/';
  var KK_ANIM = { idle: 'Idle', walk: 'Walking_C', death: 'Death_A' };
  // Per-race skin/identity tint multiplied over the (human-skinned) KayKit atlas so
  // each race reads on sight: orcs go green-skinned/savage, night elves go violet,
  // humans stay natural. Tints are light so they shift hue without darkening much.
  var RACE_TINT = { crown: null, horde: 0x6e9b3e, elf: 0x8a5cd0 };
  function kk(name, role, race) {
    var atk = role === 'caster' ? 'Spellcast_Shoot' : role === 'archer' ? '1H_Ranged_Shoot' : '1H_Melee_Attack_Slice_Diagonal';
    return { url: KK + name + '.glb', yaw: Math.PI, tint: RACE_TINT[race] || null,
      height: role === 'hero' ? 62 : role === 'worker' ? 38 : (race === 'horde' ? 54 : race === 'elf' ? 50 : 50),
      anims: { idle: KK_ANIM.idle, walk: KK_ANIM.walk, death: KK_ANIM.death, attack: atk } };
  }
  var KAYKIT_ROSTER = {
    'crown:worker': kk('Rogue', 'worker', 'crown'), 'crown:warrior': kk('Knight', 'warrior', 'crown'), 'crown:lancer': kk('Knight', 'lancer', 'crown'),
    'crown:archer': kk('Rogue', 'archer', 'crown'), 'crown:caster': kk('Mage', 'caster', 'crown'), 'crown:hero': kk('Knight', 'hero', 'crown'),
    'horde:worker': kk('Barbarian', 'worker', 'horde'), 'horde:warrior': kk('Barbarian', 'warrior', 'horde'), 'horde:lancer': kk('Barbarian', 'lancer', 'horde'),
    'horde:archer': kk('Rogue', 'archer', 'horde'), 'horde:caster': kk('Mage', 'caster', 'horde'), 'horde:hero': kk('Barbarian', 'hero', 'horde'),
    'elf:worker': kk('Rogue', 'worker', 'elf'), 'elf:warrior': kk('Rogue_Hooded', 'warrior', 'elf'), 'elf:lancer': kk('Rogue_Hooded', 'lancer', 'elf'),
    'elf:archer': kk('Rogue', 'archer', 'elf'), 'elf:caster': kk('Mage', 'caster', 'elf'), 'elf:hero': kk('Rogue_Hooded', 'hero', 'elf'),
  };
  var _modelsKicked = false;
  function setupDefaultModels() {
    if (_modelsKicked) return; _modelsKicked = true;
    var q = location.search;
    // Default roster = the race-specific PROCEDURAL units (orc tusks, elf antlers,
    // human knights) which face their travel direction. The generic KayKit
    // adventurer .glb set is opt-in (?models=kaykit) and the robot is ?models=demo.
    if (/[?&]models=demo/.test(q)) {
      registerUnitModel('*', { url: 'assets/models/RobotExpressive.glb', height: 50, anims: { idle: 'Idle', walk: 'Walking' } });
    } else if (/[?&]models=kaykit/.test(q)) {
      for (var k in KAYKIT_ROSTER) registerUnitModel(k, KAYKIT_ROSTER[k]);
    } else {
      return;   // procedural (default + ?models=off/none/procedural) — nothing to load
    }
    loadUnitModels().then(function (ok) { if (ok && R.enabled) rebuildUnitMeshes(); });
  }
  // tinted-material cache: one clone per (tint, original material), shared across
  // every instance of that race so we keep material sharing (no per-unit clones).
  var _tintMats = {};
  function tintedMaterial(orig, tintHex) {
    var bucket = _tintMats[tintHex] || (_tintMats[tintHex] = new WeakMap());
    if (bucket.has(orig)) return bucket.get(orig);
    var m = orig.clone();
    m.color = new THREE.Color(tintHex);   // multiplies the baked atlas map → race skin tint
    bucket.set(orig, m); return m;
  }
  function makeModelMesh(entry, race, role, u) {
    var cfg = entry.cfg, proto = entry.proto;
    var root = (THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(proto.scene) : proto.scene.clone());
    var holder = new THREE.Group(); holder.add(root);
    holder.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      if (cfg.tint && o.material) {
        o.material = Array.isArray(o.material)
          ? o.material.map(function (mm) { return tintedMaterial(mm, cfg.tint); })
          : tintedMaterial(o.material, cfg.tint);
      }
    });
    fitHeight(holder, cfg.height || (role === 'hero' ? 60 : role === 'worker' ? 34 : 48));
    var ud = { model: true, isArcher: role === 'archer', yaw: cfg.yaw || 0 };
    if (proto.clips && proto.clips.length) {
      var mixer = new THREE.AnimationMixer(root); var actions = {};
      var an = cfg.anims || {};
      ['idle', 'walk', 'attack', 'death'].forEach(function (k) {
        var clip = an[k] && THREE.AnimationClip.findByName(proto.clips, an[k]);
        if (clip) actions[k] = mixer.clipAction(clip);
      });
      if (actions.idle) actions.idle.play();
      ud.mixer = mixer; ud.actions = actions; ud.cur = 'idle';
    }
    holder.userData = ud;
    return holder;
  }
  function makeUnitMesh(u) {
    var race = raceOf(u.faction), role = mapRole(u);
    var entry = protoFor(race, role);
    if (entry) return makeModelMesh(entry, race, role, u);
    var tmpl = unitTemplate(race, role);
    var g = tmpl.clone();
    var ud = {
      legL: g.getObjectByName('legL'), legR: g.getObjectByName('legR'),
      shinL: g.getObjectByName('shinL'), shinR: g.getObjectByName('shinR'),
      armL: g.getObjectByName('armL'), armR: g.getObjectByName('armR'),
      torso: g.getObjectByName('torso'),
      isArcher: role === 'archer'
    };
    // arms carry a weapon pose (rotation.x set at build) — remember it so the
    // walk cycle can swing AROUND the pose instead of overwriting it.
    if (ud.armL) ud.armLBase = ud.armL.rotation.x;
    if (ud.armR) ud.armRBase = ud.armR.rotation.x;
    g.userData = ud;
    return g;
  }

  /* ---- resource (gold mine) --------------------------------------------- */
  function makeResourceMesh() {
    var g = new THREE.Group();
    g.add(cyl(2.4, 3.0, 1.4, 7, P.gmineRock).translateY(0.7));
    [[-1, 0.4, 0.6], [0.9, 0.6, -0.5], [0.2, 0.9, 0.9], [-0.6, 0.5, -0.8]].forEach(function (n) {
      var c = box(0.7, 0.7, 0.7, P.gmine, n[0], 1.3 + n[1], n[2]); c.rotation.y = n[0]; g.add(c);
    });
    g.traverse(function (o) { o.castShadow = true; o.receiveShadow = true; });
    fitHeight(g, 52);
    return g;
  }
  function makeTreeMesh() {
    var g = new THREE.Group();
    g.add(cyl(0.28, 0.42, 2.2, 6, P.bark).translateY(1.1));
    var c = cone(1.5, 2.8, 7, P.leaf); c.position.y = 3.3; g.add(c);
    var c2 = cone(1.1, 1.9, 7, P.leaf2); c2.position.y = 4.4; g.add(c2);
    g.traverse(function (o) { o.castShadow = true; });
    fitHeight(g, 64 + Math.random() * 22);
    return g;
  }

  /* ===========================================================================
   * Terrain — build a blocky heightmap mesh once per map
   * ========================================================================= */
  function elevAt(grid, cx, cy) {
    if (!grid) return 0;
    if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) return WATER_DROP;
    var h = grid.heights[cx + cy * grid.cols];
    if (h < 0) return WATER_DROP;
    return h >= 1 ? HIGH_RISE : 0;
  }
  // world (wx, wy) -> ground Y for placing entities
  function groundYAt(s, wx, wy) {
    var grid = s && s.map && s.map.terrainGrid;
    if (!grid) return 0;
    var cx = Math.floor(wx / TILE), cy = Math.floor(wy / TILE);
    return Math.max(0, elevAt(grid, cx, cy)); // entities never sink into water here
  }

  function buildTerrain(s) {
    var grid = s && s.map && s.map.terrainGrid;
    if (R.terrainMesh) { R.scene.remove(R.terrainMesh); disposeObj(R.terrainMesh); R.terrainMesh = null; }
    if (R.waterMesh) { R.scene.remove(R.waterMesh); disposeObj(R.waterMesh); R.waterMesh = null; }
    var W = (s.map && s.map.w) || RTS.Config.world.w;
    var H = (s.map && s.map.h) || RTS.Config.world.h;

    // water plane spanning the whole world (shows through gaps / below cliffs)
    var wmat = new THREE.MeshStandardMaterial({ color: 0x2a5b86, roughness: 0.45, metalness: 0.1, transparent: true, opacity: 0.92 });
    var wm = new THREE.Mesh(new THREE.PlaneGeometry(W + 800, H + 800), wmat);
    wm.rotation.x = -Math.PI / 2; wm.position.set(W / 2, WATER_DROP + 6, H / 2); wm.receiveShadow = true;
    R.waterMesh = wm; R.scene.add(wm);

    if (!grid) return;
    // merge per-tile top quads + cliff side quads into one BufferGeometry
    var positions = [], normals = [], colors = [];
    var cTop = new THREE.Color(0x5d9a3e), cTopHi = new THREE.Color(0x74b04e), cCliff = new THREE.Color(0x6e5d40), cSand = new THREE.Color(0xc9b483);
    function quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, col) {
      // two tris a-b-c, a-c-d
      var nx = 0, ny = 1, nz = 0;
      var verts = [ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz];
      // crude normal from first tri
      var ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
      var len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
      for (var i = 0; i < 6; i++) {
        positions.push(verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2]);
        normals.push(nx, ny, nz);
        colors.push(col.r, col.g, col.b);
      }
    }
    var cols = grid.cols, rows = grid.rows;
    for (var cy = 0; cy < rows; cy++) {
      for (var cx = 0; cx < cols; cx++) {
        var h = grid.heights[cx + cy * cols];
        if (h < 0) continue; // water tile: leave gap, water plane shows
        var y = h >= 1 ? HIGH_RISE : 0;
        var x0 = cx * TILE, x1 = x0 + TILE, z0 = cy * TILE, z1 = z0 + TILE;
        var topCol = h >= 1 ? cTopHi : cTop;
        // CCW-from-above winding so the top-face normal points UP (sun-lit)
        quad(x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0, topCol);
        // cliff faces toward any lower neighbor (incl. water)
        var nb = [[0, -1, x0, z0, x1, z0], [1, 0, x1, z0, x1, z1], [0, 1, x1, z1, x0, z1], [-1, 0, x0, z1, x0, z0]];
        for (var k = 0; k < 4; k++) {
          var e = nb[k]; var ne = elevAt(grid, cx + e[0], cy + e[1]);
          if (ne < y) {
            var sx = e[2], sz = e[3], ex = e[4], ez = e[5];
            var col = ne <= WATER_DROP ? cSand : cCliff;
            quad(sx, y, sz, ex, y, ez, ex, ne, ez, sx, ne, sz, col);
          }
        }
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    var tmat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    var tm = new THREE.Mesh(geo, tmat); tm.receiveShadow = true; tm.castShadow = true;
    R.terrainMesh = tm; R.scene.add(tm);

    // decor (trees) — built once with the terrain
    if (R.decorGroup) { R.scene.remove(R.decorGroup); disposeObj(R.decorGroup); }
    R.decorGroup = new THREE.Group();
    var decor = s.map && s.map.decor;
    if (decor) {
      decor.forEach(function (d) {
        if (d.kind !== 'tree' && d.kind !== 'grove_tree') return;
        var t = makeTreeMesh(); t.position.set(d.x, groundYAt(s, d.x, d.y), d.y);
        R.decorGroup.add(t);
      });
    }
    R.scene.add(R.decorGroup);
  }

  function disposeObj(o) {
    if (o.userData && o.userData.model) return;   // glTF clones share prototype geometry/materials — never dispose
    o.traverse && o.traverse(function (c) {
      if (c.geometry) c.geometry.dispose();
    });
  }

  /* ===========================================================================
   * Init
   * ========================================================================= */
  var IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test((typeof navigator !== 'undefined' && navigator.userAgent) || '');
  // Surface a 3D failure to the player instead of silently dropping to 2D.
  function warn3d(msg) {
    try { if (RTS.toast && RTS.Game) RTS.toast(RTS.Game.state, msg); } catch (e) {}
    try { console.warn('[Render3D] ' + msg); } catch (e) {}
    try {
      var el = document.getElementById('r3d-msg');
      if (!el) { el = document.createElement('div'); el.id = 'r3d-msg';
        el.style.cssText = 'position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:9999;background:rgba(40,20,16,.92);color:#ffd9b0;font:600 13px system-ui;padding:10px 16px;border-radius:10px;max-width:80%;text-align:center;pointer-events:none;';
        document.body.appendChild(el); }
      el.textContent = msg; el.style.display = 'block';
      setTimeout(function () { if (el) el.style.display = 'none'; }, 5000);
    } catch (e) {}
  }
  function init() {
    if (R.inited) return true;
    THREE = window.THREE;
    if (!THREE) { warn3d('3D engine: graphics library failed to load.'); return false; }
    var cv = document.getElementById('game3d');
    if (!cv) {
      cv = document.createElement('canvas'); cv.id = 'game3d';
      // pointer-events:none so taps fall THROUGH to the #game canvas underneath,
      // where RTS.Input listens — the whole input path keeps working unchanged.
      // z-index above #game (1) so 3D covers the 2D world, below #hud (20).
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:5;display:none;pointer-events:none;';
      var hud = document.getElementById('hud') || document.body;
      hud.parentNode.insertBefore(cv, hud);
    }
    R.canvas = cv;
    try {
      // gentler options on phones: antialias off (some mobile GPUs reject the
      // context with it on), allow software fallback rather than failing hard.
      R.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !IS_MOBILE, powerPreference: 'default', failIfMajorPerformanceCaveat: false });
    } catch (e) { warn3d('3D engine: this device could not start WebGL. Staying in 2D.'); return false; }
    if (!R.renderer || !R.renderer.getContext || !R.renderer.getContext()) { warn3d('3D engine: no WebGL context. Staying in 2D.'); return false; }
    R.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
    R.renderer.shadowMap.enabled = true; R.renderer.shadowMap.type = IS_MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if ('outputEncoding' in R.renderer && THREE.sRGBEncoding) R.renderer.outputEncoding = THREE.sRGBEncoding;
    R.scene = new THREE.Scene();
    R.scene.background = new THREE.Color(0xbfd8e6);
    R.scene.fog = new THREE.Fog(0xc8dcc6, 1400, 3600);
    R.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 8, 9000);
    R.amb = new THREE.AmbientLight(0xfff3df, 0.42); R.scene.add(R.amb);
    R.hemi = new THREE.HemisphereLight(0xfdeecb, 0x4a5230, 0.2); R.scene.add(R.hemi);
    R.sun = new THREE.DirectionalLight(0xfff0cf, 1.6);
    R.sun.castShadow = true; R.sun.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
    var sc = R.sun.shadow.camera; sc.near = 50; sc.far = 2600; sc.left = -900; sc.right = 900; sc.top = 900; sc.bottom = -900;
    R.sun.shadow.bias = -0.0006;
    R.scene.add(R.sun); R.scene.add(R.sun.target);
    R.raycaster = new THREE.Raycaster();
    R.ray = new THREE.Vector2(); R.ndc = new THREE.Vector2();
    buildPalette();
    // Bloom glow pass: emissive VFX (projectiles, magic, impacts, building glows)
    // bloom above a high luminance threshold so the lit world doesn't smear.
    // Skipped on mobile for performance.
    R.composer = null;
    if (!IS_MOBILE && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass) {
      try {
        var iw = window.innerWidth, ih = window.innerHeight;
        R.composer = new THREE.EffectComposer(R.renderer);
        R.composer.addPass(new THREE.RenderPass(R.scene, R.camera));
        R.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(iw, ih), 0.6, 0.55, 0.88);
        R.composer.addPass(R.bloom);
        R.composer.setSize(iw, ih);
      } catch (e) { R.composer = null; }
    }
    window.addEventListener('resize', resize);
    R.inited = true;
    return true;
  }

  function resize() {
    if (!R.inited) return;
    var w = window.innerWidth, h = window.innerHeight;
    R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
    R.renderer.setSize(w, h, false);
    if (R.composer) R.composer.setSize(w, h);
  }

  /* ===========================================================================
   * Camera — derive an angled RTS camera from the 2D camera (s.camera)
   * The 2D view shows world rect [cam.x, cam.y] sized (W/zoom, H/zoom). We aim
   * the 3D camera at the center of that rect and pull back proportional to it.
   * ========================================================================= */
  var PITCH = 0.84;          // radians above horizon — a Thronefall-ish 3/4 tilt
  function viewCenter(s) {
    var c = s.camera, vw = window.innerWidth, vh = window.innerHeight;
    return { x: c.x + (vw / c.zoom) / 2, z: c.y + (vh / c.zoom) / 2, span: vh / c.zoom };
  }
  function placeCamera(s) {
    var v = viewCenter(s);
    var dist = v.span * 0.52 / Math.tan(R.camera.fov * Math.PI / 360);  // tighter framing
    var tgtY = 18;
    R.camera.position.set(v.x, tgtY + dist * Math.sin(PITCH), v.z + dist * Math.cos(PITCH));
    R.camera.lookAt(v.x, tgtY, v.z);
    // park the sun + shadow frustum over the view center
    R.sun.position.set(v.x + 520, 900, v.z + 360);
    R.sun.target.position.set(v.x, 0, v.z); R.sun.target.updateMatrixWorld();
  }

  /* ===========================================================================
   * Cam override — screenToWorld / worldToScreen via the 3D camera
   * Saves the originals so we can restore on toggle-off.
   * ========================================================================= */
  var savedCam = null;
  function installCamOverride(s) {
    if (savedCam || !RTS.Cam) return;
    savedCam = { s2w: RTS.Cam.screenToWorld, w2s: RTS.Cam.worldToScreen };
    RTS.Cam.screenToWorld = function (st, sx, sy) {
      if (!R.enabled || !R.inited) return savedCam.s2w.call(RTS.Cam, st, sx, sy);
      placeCamera(st);
      R.ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
      R.raycaster.setFromCamera(R.ndc, R.camera);
      // prefer the real terrain surface (accurate on plateaus + ramps)
      if (R.terrainMesh) {
        var hit = R.raycaster.intersectObject(R.terrainMesh, false);
        if (hit && hit.length) return { x: hit[0].point.x, y: hit[0].point.z };
      }
      // fall back to the FLAT ground plane (y=0)
      var o = R.raycaster.ray.origin, dir = R.raycaster.ray.direction;
      if (Math.abs(dir.y) < 1e-5) return { x: o.x, y: o.z };
      var t = -o.y / dir.y;
      return { x: o.x + dir.x * t, y: o.z + dir.z * t };
    };
    RTS.Cam.worldToScreen = function (st, wx, wy) {
      if (!R.enabled || !R.inited) return savedCam.w2s.call(RTS.Cam, st, wx, wy);
      placeCamera(st);
      var v = new THREE.Vector3(wx, groundYAt(st, wx, wy), wy).project(R.camera);
      return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
    };
  }
  function removeCamOverride() {
    if (!savedCam) return;
    RTS.Cam.screenToWorld = savedCam.s2w; RTS.Cam.worldToScreen = savedCam.w2s; savedCam = null;
  }

  // plop dust: a flat ring puffs out + fades when something is placed/spawned
  var DUST_GEO = null, DUST_MAT = null, dustPool = [], dustActive = [];
  function spawnDust(x, gy, z, r0) {
    if (RTS.Config && RTS.Config.reducedMotion) return;
    if (!DUST_GEO) {
      DUST_GEO = new THREE.RingGeometry(0.62, 1, 18);
      DUST_MAT = new THREE.MeshBasicMaterial({ color: 0xece2c2, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    }
    var m = dustPool.pop();
    if (!m) { m = new THREE.Mesh(DUST_GEO, DUST_MAT.clone()); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; R.scene.add(m); }
    m.visible = true; m.position.set(x, gy + 1.5, z); m.userData = { born: performance.now(), r0: r0 || 22 };
    dustActive.push(m);
  }
  function updateDust() {
    for (var i = dustActive.length - 1; i >= 0; i--) {
      var m = dustActive[i], t = (performance.now() - m.userData.born) / 360;
      if (t >= 1) { m.visible = false; dustActive.splice(i, 1); dustPool.push(m); continue; }
      var r = m.userData.r0 * (0.4 + t * 1.15); m.scale.set(r, r, r); m.material.opacity = 0.6 * (1 - t);
    }
  }

  // "plop": easeOutBack scale pop when an entity first appears (Thronefall feel)
  function spawnPop(slot) {
    if (RTS.Config && RTS.Config.reducedMotion) return 1;
    var t = (performance.now() - slot.born) / 240;
    if (t >= 1 || t < 0) return 1;
    var u = t - 1, c1 = 1.70158, c3 = c1 + 1;
    return Math.max(0.05, 1 + c3 * u * u * u + c1 * u * u);   // 0 → overshoot → 1
  }

  /* ===========================================================================
   * Per-frame sync — mirror s.entities into pooled meshes
   * ========================================================================= */
  function syncList(s, list, kind) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e) continue;                 // dead units linger (corpse fade) — animate, don't skip
      R.seen[e.id] = true;
      var slot = R.pool[e.id];
      // rebuild if faction/role/type changed underneath an id (rare)
      var sig = kind + ':' + (e.faction || '') + ':' + (e.role || e.type || '') + ':' + (e.team || 0) + ':' + (e.heroId || '') + ':' + (e.towerType || '');
      if (slot && slot.sig !== sig) { freeSlot(slot); slot = null; }
      if (!slot) {
        var obj;
        if (kind === 'unit') obj = makeUnitMesh(e);
        else if (kind === 'building') obj = makeBuildingMesh(e);
        else obj = makeResourceMesh();
        R.scene.add(obj);
        if (!_box) _box = new THREE.Box3();
        _box.setFromObject(obj); var bs = new THREE.Vector3(); _box.getSize(bs);
        slot = R.pool[e.id] = { obj: obj, sig: sig, kind: kind, baseS: obj.scale.y, topY: bs.y, born: performance.now() };
        spawnDust(e.x, groundYAt(s, e.x, e.y), e.y, kind === 'building' ? (e.w || 120) * 0.5 : 22);   // plop
      }
      var o = slot.obj;
      var gy = groundYAt(s, e.x, e.y);
      o.position.set(e.x, gy, e.y);
      if (e.dead) {                       // death: topple + sink + shrink (renderer-timed)
        if (kind === 'unit') {
          if (!slot.deathT) slot.deathT = performance.now();
          var dp = Math.min(1, (performance.now() - slot.deathT) / 480);
          o.position.y = gy - dp * 4; o.rotation.z = dp * 1.5; o.scale.setScalar(slot.baseS * (1 - dp * 0.18));   // topple over, lie flat
        }
        if (slot.hp) slot.hp.visible = false;
        continue;
      }
      if (kind === 'unit') {
        var ud = o.userData;
        // facing: ease the rendered yaw toward the sim facing at a max turn-rate
        // so units arc into turns instead of snapping (sim aim stays instant).
        var targetYaw = -(e.facing || 0) + Math.PI / 2 + ((ud && ud.yaw) || 0);
        if (slot._yaw === undefined) slot._yaw = targetYaw;
        slot._yaw = approachAngle(slot._yaw, targetYaw, (RTS.Config.turnRate || 11) * R.renderDt);
        o.rotation.y = slot._yaw;
        // locomotion: cadence tracks ground speed so feet don't slide
        var spd = Math.sqrt((e.vx || 0) * (e.vx || 0) + (e.vy || 0) * (e.vy || 0));
        var moving = e.moveTo || spd > 4;
        if (ud && ud.model && ud.actions) {           // glTF model: crossfade idle<->walk clips
          var want = moving && ud.actions.walk ? 'walk' : 'idle';
          if (ud.cur !== want && ud.actions[want]) {
            var from = ud.actions[ud.cur];
            ud.actions[want].reset().play();
            if (from) ud.actions[want].crossFadeFrom(from, 0.2, false);
            ud.cur = want;
          }
        } else if (ud && ud.legL) {
          // advance the stride by DISTANCE travelled (phase per world-unit), so
          // a faster unit strides faster and a stopped unit's feet are planted.
          slot._stride = (slot._stride || 0) + (moving ? spd * R.renderDt * 0.135 : 0);
          var ph = slot._stride, amp = Math.min(1, spd / 70), bob = (slot.topY || 40);
          if (moving) {
            var sw = Math.sin(ph) * 0.7 * amp;
            ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
            if (ud.shinL) { ud.shinL.rotation.x = Math.max(0, -sw) * 0.9; ud.shinR.rotation.x = Math.max(0, sw) * 0.9; }
            if (ud.armL) ud.armL.rotation.x = (ud.armLBase || 0) - sw * 0.55;   // arms counter-swing the legs
            if (ud.armR) ud.armR.rotation.x = (ud.armRBase || 0) + sw * 0.40;
            if (ud.torso) ud.torso.rotation.y = sw * 0.12;                      // slight torso counter-twist
            o.position.y += Math.abs(Math.sin(ph)) * bob * 0.03 * amp;          // body bob (two steps / cycle)
          } else {
            ud.legL.rotation.x *= 0.8; ud.legR.rotation.x *= 0.8;
            if (ud.shinL) { ud.shinL.rotation.x *= 0.8; ud.shinR.rotation.x *= 0.8; }
            if (ud.armL) ud.armL.rotation.x += ((ud.armLBase || 0) - ud.armL.rotation.x) * 0.18;
            if (ud.armR) ud.armR.rotation.x += ((ud.armRBase || 0) - ud.armR.rotation.x) * 0.18;
            if (ud.torso) ud.torso.rotation.y *= 0.8;
            o.position.y += Math.sin(performance.now() * 0.0018 + (e._idlePhase || 0)) * bob * 0.006;   // idle breathing
          }
        }
        // hit reaction: a brief scale-pop (per-instance; can't tint shared mats)
        var pop = e.hitFlash > 0 ? 1 + Math.min(0.16, e.hitFlash * 0.5) : 1;
        o.scale.setScalar(slot.baseS * pop * spawnPop(slot));   // + plop on spawn
        // attack lunge: nudge forward (toward facing) on the attack frame
        if (e.muzzleFlash > 0) {
          var lf = Math.min(e.muzzleFlash, 0.13) * 64;
          o.position.x += Math.cos(e.facing || 0) * lf; o.position.z += Math.sin(e.facing || 0) * lf;
        }
        // rising edge of muzzleFlash = a fresh attack → spawn a flash/slash burst
        if ((e.muzzleFlash || 0) > (slot._mf || 0) + 1e-4) {
          var fa = e.facing || 0, fh = gy + (slot.topY || 40) * 0.52;
          if (e.ranged) fxFlash(e.x + Math.cos(fa) * 17, fh, e.y + Math.sin(fa) * 17, 0xffe6a0, 0.8, 0.1);
          else fxFlash(e.x + Math.cos(fa) * 16, fh, e.y + Math.sin(fa) * 16, 0xfff0d8, 1.0, 0.12);   // melee slash spark
        }
        slot._mf = e.muzzleFlash || 0;
      } else if (kind === 'building') {
        // rise from the ground while under construction (relative to fitted scale)
        var prog = e.built ? 1 : Math.max(0.08, e.progress || 0);
        o.scale.y = slot.baseS * prog;
      }
      updateHealthBar(s, slot, e, gy);
    }
  }

  /* ---- health bars: billboarded bg+fill quads above damaged entities ----- */
  var hpBg = null, hpFillG = null, hpFillR = null, hpFillN = null;
  function hpMats() {
    if (hpBg) return;
    hpBg = new THREE.MeshBasicMaterial({ color: 0x10130c, transparent: true, opacity: 0.72, depthTest: false });
    hpFillG = new THREE.MeshBasicMaterial({ color: 0x6fdc5a, depthTest: false });
    hpFillR = new THREE.MeshBasicMaterial({ color: 0xe2533f, depthTest: false });
    hpFillN = new THREE.MeshBasicMaterial({ color: 0xd9c558, depthTest: false });
  }
  var UNIT_QUAD = null;
  function updateHealthBar(s, slot, e, gy) {
    var maxHp = e.maxHp || 0;
    var ratio = maxHp ? Math.max(0, Math.min(1, (e.hp || 0) / maxHp)) : 1;
    var sel = (s.selectedIds || []).indexOf(e.id) >= 0;
    var show = maxHp && (ratio < 0.999 || sel);
    if (!show) { if (slot.hp) slot.hp.visible = false; return; }
    hpMats();
    if (!UNIT_QUAD) UNIT_QUAD = new THREE.PlaneGeometry(1, 1);
    if (!slot.hp) {
      var g = new THREE.Group(); g.renderOrder = 999;
      var bg = new THREE.Mesh(UNIT_QUAD, hpBg); bg.renderOrder = 999;
      var team = e.team === (RTS.TEAM && RTS.TEAM.ENEMY) ? hpFillR : e.team === (RTS.TEAM && RTS.TEAM.NEUTRAL) ? hpFillN : hpFillG;
      var fill = new THREE.Mesh(UNIT_QUAD, team); fill.renderOrder = 1000;
      g.add(bg); g.add(fill); g.userData = { bg: bg, fill: fill };
      R.scene.add(g); slot.hp = g;
    }
    var g2 = slot.hp; g2.visible = true;
    var w = slot.kind === 'building' ? Math.max(46, (e.w || 80) * 0.7) : 34;
    var h = slot.kind === 'building' ? 8 : 5;
    var topY = gy + (slot.topY || 40) + (slot.kind === 'building' ? 16 : 10);
    g2.position.set(e.x, topY, e.y);
    g2.quaternion.copy(R.camera.quaternion);
    var bg2 = g2.userData.bg, fill2 = g2.userData.fill;
    bg2.scale.set(w + 3, h + 3, 1);
    fill2.scale.set(w * ratio, h, 1);
    fill2.position.set(-(w * (1 - ratio)) / 2, 0, 0.5);
  }

  // selection rings (re-created cheaply each frame into a single group)
  // selection rings + build-plot markers — pooled & pulsing (no per-frame alloc)
  var selGroup = null, SEL_GEO = null, SEL_MAT = null, selPool = [], PLOT_GEO = null, PLOT_MAT = null, plotPool = [];
  function flatRing(geo, mat) { var m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.renderOrder = 3; return m; }
  function drawSelection(s) {
    if (!selGroup) {
      selGroup = new THREE.Group(); R.scene.add(selGroup);
      SEL_GEO = new THREE.RingGeometry(0.78, 1, 26);
      SEL_MAT = new THREE.MeshBasicMaterial({ color: 0x8fffb0, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false });
    }
    var ids = s.selectedIds || [], t = performance.now() * 0.001, pulse = 1 + Math.sin(t * 5) * 0.07;
    for (var i = 0; i < ids.length; i++) {
      var slot = R.pool[ids[i]];
      var m = selPool[i];
      if (!slot) { if (m) m.visible = false; continue; }
      if (!m) { m = flatRing(SEL_GEO, SEL_MAT); selGroup.add(m); selPool[i] = m; }
      m.visible = true;
      var r = (slot.kind === 'building') ? 38 : 17;
      m.scale.set(r * pulse, r * pulse, 1);
      m.position.set(slot.obj.position.x, slot.obj.position.y + 1.2, slot.obj.position.z);
    }
    for (var j = ids.length; j < selPool.length; j++) if (selPool[j]) selPool[j].visible = false;
  }
  // Thronefall fixed build plots: pulsing gold ground rings on unused spots
  function drawBuildPlots(s) {
    var plots = s.map && s.map.buildPlots;
    if (!plots) { for (var k = 0; k < plotPool.length; k++) if (plotPool[k]) plotPool[k].visible = false; return; }
    if (!PLOT_GEO) {
      PLOT_GEO = new THREE.RingGeometry(0.66, 1, 22);
      PLOT_MAT = new THREE.MeshBasicMaterial({ color: 0xf0d24b, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    }
    var t = performance.now() * 0.001, pulse = 1 + Math.sin(t * 3) * 0.13;
    for (var i = 0; i < plots.length; i++) {
      var p = plots[i], m = plotPool[i];
      if (!m) { m = flatRing(PLOT_GEO, PLOT_MAT); (selGroup || R.scene).add(m); plotPool[i] = m; }
      if (p.used) { m.visible = false; continue; }
      m.visible = true; m.scale.set(30 * pulse, 30 * pulse, 1);
      m.position.set(p.x, groundYAt(s, p.x, p.y) + 1.0, p.y);
    }
    for (var j = plots.length; j < plotPool.length; j++) if (plotPool[j]) plotPool[j].visible = false;
  }

  function freeSlot(sl) {
    R.scene.remove(sl.obj); disposeObj(sl.obj);
    if (sl.hp) { R.scene.remove(sl.hp); }
  }
  function gc() {
    for (var id in R.pool) {
      if (!R.seen[id]) { freeSlot(R.pool[id]); delete R.pool[id]; }
    }
    R.seen = {};
  }

  /* ---- projectiles: per-type shape, ballistic arc, trails --------------- */
  // ---- projectile archetypes: shape + flight by what fired it -------------
  var _pGeo = null, _pv = null, _pq = null, _pf = null;
  function projGeoKit() {
    if (_pGeo) return _pGeo;
    // arrow/spear lie along +X (tip at +X) so a single direction quaternion aims them
    var shaft = new THREE.CylinderGeometry(0.7, 0.7, 16, 5); shaft.rotateZ(-Math.PI / 2);
    var head = new THREE.ConeGeometry(1.7, 4.5, 6); head.rotateZ(-Math.PI / 2); head.translate(10, 0, 0);
    var sshaft = new THREE.CylinderGeometry(0.6, 0.6, 28, 5); sshaft.rotateZ(-Math.PI / 2);
    var shead = new THREE.ConeGeometry(1.5, 5, 6); shead.rotateZ(-Math.PI / 2); shead.translate(16, 0, 0);
    _pGeo = {
      arrowShaft: shaft, arrowHead: head, spearShaft: sshaft, spearHead: shead,
      ball: new THREE.IcosahedronGeometry(4.6, 0),
      orb: new THREE.SphereGeometry(3.4, 8, 6),
      tail: (function () { var g = new THREE.ConeGeometry(2.6, 22, 7); g.rotateZ(Math.PI / 2); g.translate(-12, 0, 0); return g; })(),
    };
    return _pGeo;
  }
  function projKind(p) {
    if (p.heroId || p.role === 'monk' || p.role === 'caster' || p.role === 'priest') return 'magic';
    if (p.splash > 0) return 'siege';
    if (p.faction === 'cinder' && p.role === 'archer') return 'spear';
    return 'arrow';
  }
  // shared, cached materials so projectile cleanup is a plain scene-remove
  // (NEVER dispose — geometry + materials here are reused across all shots)
  var _pMat = {};
  function pBasic(colHex, opacity) {
    var key = colHex + ':' + (opacity == null ? 1 : opacity);
    if (_pMat[key]) return _pMat[key];
    var o = opacity == null ? 1 : opacity;
    return _pMat[key] = new THREE.MeshBasicMaterial({ color: colHex, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
  }
  function makeProjMesh(kind, colHex) {
    var K = projGeoKit(), g = new THREE.Group();
    if (kind === 'magic') {
      g.add(new THREE.Mesh(K.orb, pBasic(colHex, 1)));
      g.add(new THREE.Mesh(K.tail, pBasic(colHex, 0.5)));
    } else if (kind === 'siege') {
      if (!_pMat.siege) _pMat.siege = M(0x3a342c);
      g.add(new THREE.Mesh(K.ball, _pMat.siege));
      var st = new THREE.Mesh(K.tail, pBasic(0xff7a2a, 0.5)); st.scale.set(0.7, 0.7, 0.7); g.add(st);
    } else {   // arrow / spear
      var sp = kind === 'spear';
      g.add(new THREE.Mesh(sp ? K.spearShaft : K.arrowShaft, P.wood));
      g.add(new THREE.Mesh(sp ? K.spearHead : K.arrowHead, P.steel));
      // Thronefall-style flight streak trailing the shaft (thin, pale, fading)
      var streak = new THREE.Mesh(K.tail, pBasic(0xfff0c8, 0.4));
      streak.scale.set(sp ? 1.15 : 0.9, 0.32, 0.32);
      streak.position.x = sp ? -14 : -8;
      g.add(streak);
    }
    return g;
  }
  function syncProjectiles(s) {
    var list = s.entities && s.entities.projectiles; if (!list) return;
    if (!_pv) { _pv = new THREE.Vector3(); _pq = new THREE.Quaternion(); _pf = new THREE.Vector3(1, 0, 0); }
    for (var i = 0; i < list.length; i++) {
      var p = list[i]; if (!p) continue; R.pseen[p.id] = true;
      var sl = R.ppool[p.id];
      if (!sl) {
        var col = 0xffe08a; try { col = new THREE.Color(p.color || '#ffe08a').getHex(); } catch (e) {}
        var kind = projKind(p);
        var m = makeProjMesh(kind, col);
        R.scene.add(m);
        // remember launch geometry so a parabolic ARC can be derived from progress
        var d0 = Math.max(1, Math.hypot((p.lastX || p.x) - p.x, (p.lastY || p.y) - p.y));
        var H = kind === 'siege' ? Math.min(260, d0 * 0.34) : kind === 'magic' ? 0 : Math.min(70, d0 * 0.11);
        sl = R.ppool[p.id] = { m: m, kind: kind, d0: d0, H: H };
      }
      var gy = groundYAt(s, p.x, p.y) + 22;
      var tx = p.lastX, ty = p.lastY;
      var dx = tx - p.x, dz = ty - p.y, dh = Math.hypot(dx, dz) || 1;
      var prog = Math.max(0, Math.min(1, 1 - dh / sl.d0));
      var h = sl.H ? sl.H * 4 * prog * (1 - prog) : 0;
      sl.m.position.set(p.x, gy + h, p.y);
      sl.lx = p.x; sl.lz = p.y; sl.lgy = gy;   // remember for the impact burst on removal
      if (sl.kind === 'magic') { sl.m.rotation.y = -Math.atan2(dz, dx); }   // tail trails behind
      else {
        // aim along the 3D velocity (horizontal dir + arc slope) for yaw + pitch
        var slope = sl.H ? (4 * sl.H * (1 - 2 * prog)) / sl.d0 : 0;
        _pv.set(dx / dh, slope, dz / dh).normalize();
        _pq.setFromUnitVectors(_pf, _pv); sl.m.quaternion.copy(_pq);
      }
    }
    for (var id in R.ppool) {
      // geometry + materials are shared/cached — just unhook the group from the scene
      if (!R.pseen[id]) {
        var ps = R.ppool[id];
        if (ps.lx != null) fxImpact(ps.lx, ps.lgy, ps.lz, ps.kind);   // burst where it landed
        R.scene.remove(ps.m); delete R.ppool[id];
      }
    }
    R.pseen = {};
  }

  /* ---- effects: impact bursts + ground shock rings ----------------------- */
  var ringGeo = null, sparkGeo = null;
  function syncEffects(s) {
    var list = s.entities && s.entities.effects; if (!list) return;
    if (!ringGeo) ringGeo = new THREE.RingGeometry(0.55, 1, 18);
    if (!sparkGeo) sparkGeo = new THREE.IcosahedronGeometry(4, 0);
    for (var i = 0; i < list.length; i++) {
      var e = list[i]; if (!e) continue;
      var k = e.kind;
      if (k !== 'boom' && k !== 'nova' && k !== 'ring' && k !== 'spark') continue;
      R.eseen[e.id] = true;
      var sl = R.epool[e.id];
      var gy = groundYAt(s, e.x, e.y);
      if (!sl) {
        var col = 0xffcf6b; try { col = new THREE.Color(e.color || '#ffcf6b').getHex(); } catch (er) {}
        var mesh;
        if (k === 'spark') {
          mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true }));
          mesh.position.set(e.x, gy + 24, e.y);
        } else {
          mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
          mesh.rotation.x = -Math.PI / 2; mesh.position.set(e.x, gy + 2, e.y);
        }
        R.scene.add(mesh); sl = R.epool[e.id] = { m: mesh, k: k, baseR: e.r || 18 };
      }
      var prog = e.max ? 1 - Math.max(0, (e.life || 0) / e.max) : 1; // 0→1 over life
      var m = sl.m;
      if (k === 'spark') { m.scale.setScalar(1 - prog * 0.6); m.material.opacity = 1 - prog; }
      else { var rr = sl.baseR * (0.4 + prog * 1.7); m.scale.set(rr, rr, rr); m.material.opacity = (1 - prog) * 0.8; }
    }
    for (var id in R.epool) {
      if (!R.eseen[id]) { var s3 = R.epool[id]; R.scene.remove(s3.m); s3.m.material.dispose(); delete R.epool[id]; }
    }
    R.eseen = {};
  }

  /* ---- render-only VFX: impacts + muzzle/melee flashes -------------------
   * The 2D Particles system draws under the 3D canvas (invisible here), so the
   * 3D view spawns + animates its own short-lived bursts, decoupled from the
   * sim's effect entities. Geometry is shared; per-burst materials animate
   * opacity and are disposed on expiry (geometry never is). */
  var flashGeo = null;
  function fxGeos() {
    if (!ringGeo) ringGeo = new THREE.RingGeometry(0.55, 1, 18);
    if (!flashGeo) flashGeo = new THREE.SphereGeometry(3, 8, 6);
  }
  function fxMat(col, op) { return new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op == null ? 1 : op, depthWrite: false }); }
  function fxImpact(x, gy, z, kind) {
    if (!R.fx) R.fx = []; fxGeos();
    var col = kind === 'siege' ? 0xffb24d : kind === 'magic' ? 0x9a6cff : 0xffe6b0;
    var big = kind === 'siege' ? 2.4 : kind === 'magic' ? 1.3 : 1.0;
    var ring = new THREE.Mesh(ringGeo, fxMat(col, 0.9)); ring.rotation.x = -Math.PI / 2; ring.position.set(x, gy + 2, z);
    var flash = new THREE.Mesh(flashGeo, fxMat(col, 1)); flash.position.set(x, gy + 9 * big, z); flash.scale.setScalar(big);
    R.scene.add(ring); R.scene.add(flash);
    R.fx.push({ kind: 'impact', ring: ring, flash: flash, t: 0, life: kind === 'siege' ? 0.5 : 0.34, big: big });
  }
  function fxFlash(x, y, z, col, scl, life) {
    if (!R.fx) R.fx = []; fxGeos();
    var flash = new THREE.Mesh(flashGeo, fxMat(col == null ? 0xffe08a : col, 1)); flash.position.set(x, y, z); flash.scale.setScalar(scl || 1);
    R.scene.add(flash);
    R.fx.push({ kind: 'flash', flash: flash, t: 0, life: life || 0.13, scl: scl || 1 });
  }
  function updateFx(dt) {
    var list = R.fx; if (!list || !list.length) return;
    for (var i = list.length - 1; i >= 0; i--) {
      var f = list[i]; f.t += dt; var p = f.t / f.life;
      if (p >= 1) {
        if (f.ring) { R.scene.remove(f.ring); f.ring.material.dispose(); }
        if (f.flash) { R.scene.remove(f.flash); f.flash.material.dispose(); }
        list.splice(i, 1); continue;
      }
      if (f.kind === 'impact') {
        var rr = (0.4 + p * 1.9) * f.big * 13;
        f.ring.scale.set(rr, rr, rr); f.ring.material.opacity = (1 - p) * 0.85;
        f.flash.scale.setScalar(Math.max(0.01, (1 - p * 0.7) * f.big)); f.flash.material.opacity = 1 - p;
      } else {
        f.flash.scale.setScalar(Math.max(0.01, f.scl * (1 - p * 0.55))); f.flash.material.opacity = 1 - p;
      }
    }
  }

  /* ===========================================================================
   * Public: render one frame (called from the game loop when enabled)
   * ========================================================================= */
  // shortest-arc angle approach: move `cur` toward `target` by at most `maxStep`
  function approachAngle(cur, target, maxStep) {
    var d = target - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (d > maxStep) d = maxStep; else if (d < -maxStep) d = -maxStep;
    return cur + d;
  }
  function render(s) {
    if (!R.enabled) return;
    if (!R.inited && !init()) return;
    var _now = performance.now();
    R.renderDt = R._lastT ? Math.min(0.05, (_now - R._lastT) / 1000) : 0.016;
    R._lastT = _now;
    var mid = s.mapId + ':' + ((s.map && s.map.terrainGrid && s.map.terrainGrid.cols) || 0);
    if (mid !== R.mapId) { R.mapId = mid; buildTerrain(s); }
    placeCamera(s);
    var en = s.entities || {};
    syncList(s, en.buildings, 'building');
    syncList(s, en.resources, 'resource');
    syncList(s, en.units, 'unit');
    syncProjectiles(s);
    syncEffects(s);
    drawSelection(s);
    drawBuildPlots(s);
    drawFloats(s);
    drawMarquee(s);
    updateDust(s);
    updateFx(R.renderDt);
    gc();
    // advance any glTF skeletal animations
    if (!_clock) _clock = new THREE.Clock();
    var dt = _clock.getDelta();
    for (var pid in R.pool) { var psl = R.pool[pid]; if (psl && psl.obj && psl.obj.userData && psl.obj.userData.mixer) psl.obj.userData.mixer.update(dt); }
    // screen shake: jolt the camera (render-only; placeCamera resets next frame,
    // so picking via screenToWorld is unaffected). Driven by s.screenShake.
    if (s.screenShake > 0 && !(RTS.Config && RTS.Config.reducedMotion)) {
      var sh = Math.min(s.screenShake, 8) * 3.2;
      R.camera.position.x += (Math.random() - 0.5) * sh;
      R.camera.position.y += (Math.random() - 0.5) * sh;
    }
    if (R.composer) R.composer.render(); else R.renderer.render(R.scene, R.camera);
  }

  /* ---- floating text (gold gains, dodges, ability casts) as DOM billboards -- */
  var floatPool = [], floatBox = null;
  function drawFloats(s) {
    var fx = s.entities && s.entities.effects;
    if (!fx) return;
    if (!floatBox) {
      floatBox = document.createElement('div');
      floatBox.id = 'r3d-floats';
      floatBox.style.cssText = 'position:fixed;inset:0;z-index:15;pointer-events:none;overflow:hidden;';
      (document.getElementById('hud') || document.body).parentNode.insertBefore(floatBox, document.getElementById('hud'));
    }
    floatBox.style.display = '';
    var used = 0;
    for (var i = 0; i < fx.length; i++) {
      var e = fx[i];
      if (e.kind !== 'float' || !e.text) continue;
      var sc = RTS.Cam.worldToScreen(s, e.x, e.y);
      var prog = e.max ? 1 - Math.max(0, (e.life || 0) / e.max) : 1;   // 0→1
      var el = floatPool[used];
      if (!el) { el = document.createElement('div');
        el.style.cssText = 'position:absolute;font:800 15px system-ui,sans-serif;text-shadow:0 2px 4px rgba(0,0,0,.6);white-space:nowrap;transform:translate(-50%,-50%);';
        floatBox.appendChild(el); floatPool[used] = el; }
      el.textContent = e.text;
      el.style.color = e.color || '#ffe08a';
      el.style.left = sc.x + 'px';
      el.style.top = (sc.y - prog * 34) + 'px';
      el.style.opacity = Math.max(0, 1 - prog);
      el.style.display = 'block';
      used++;
    }
    for (var j = used; j < floatPool.length; j++) floatPool[j].style.display = 'none';
  }

  /* ---- drag-select marquee (the 2D renderer drew it; 3D needs its own) ----
   * selectionBox is in world coords; projecting both corners back to screen
   * round-trips to ~the cursor points, so the screen rectangle matches the drag. */
  var marqueeEl = null;
  function drawMarquee(s) {
    if (!marqueeEl) {
      marqueeEl = document.createElement('div'); marqueeEl.id = 'r3d-marquee';
      marqueeEl.style.cssText = 'position:fixed;border:2px solid rgba(143,255,176,.9);background:rgba(143,255,176,.14);z-index:16;pointer-events:none;display:none;';
      (document.getElementById('hud') || document.body).parentNode.insertBefore(marqueeEl, document.getElementById('hud'));
    }
    var b = s.selectionBox;
    if (!b) { marqueeEl.style.display = 'none'; return; }
    var a = RTS.Cam.worldToScreen(s, b.x1, b.y1), c = RTS.Cam.worldToScreen(s, b.x2, b.y2);
    marqueeEl.style.display = 'block';
    marqueeEl.style.left = Math.min(a.x, c.x) + 'px'; marqueeEl.style.top = Math.min(a.y, c.y) + 'px';
    marqueeEl.style.width = Math.abs(a.x - c.x) + 'px'; marqueeEl.style.height = Math.abs(a.y - c.y) + 'px';
  }

  function setNight(on) {
    R.night = on; if (!R.inited) return;
    if (on) { R.scene.background.setHex(0x18223c); R.scene.fog.color.setHex(0x1c2640); R.sun.color.setHex(0x9fb0e0); R.sun.intensity = 0.5; R.amb.intensity = 0.55; }
    else { R.scene.background.setHex(0xbfd8e6); R.scene.fog.color.setHex(0xc8dcc6); R.sun.color.setHex(0xfff0d0); R.sun.intensity = 1.45; R.amb.intensity = 0.72; }
  }

  function enable(s) {
    if (!init()) { console.warn('[Render3D] THREE not loaded'); return false; }
    R.enabled = true;
    document.body.classList.add('r3d-on');
    R.canvas.style.display = 'block';
    // #game stays visible (it receives input) but is fully covered by the opaque
    // 3D canvas; the loop stops repainting it, so it just sits frozen underneath.
    resize();
    installCamOverride(s);
    R.mapId = null; // force terrain rebuild
    // render units from modeled .glb assets (KayKit Adventurers by default);
    // ?models=demo for the sample robot, ?models=off to force procedural bodies.
    setupDefaultModels();
    return true;
  }
  function disable() {
    R.enabled = false;
    document.body.classList.remove('r3d-on');
    if (R.canvas) R.canvas.style.display = 'none';
    if (floatBox) floatBox.style.display = 'none';
    if (marqueeEl) marqueeEl.style.display = 'none';
    removeCamOverride();
  }

  RTS.Render3D = {
    render: render,
    enable: enable,
    disable: disable,
    setNight: setNight,
    isEnabled: function () { return R.enabled; },
    // glTF model pipeline: register a .glb per 'race:role' (or 'race:*' / '*'),
    // then loadUnitModels() to fetch them. Units spawned after load use the model;
    // anything unregistered keeps the procedural body.
    registerUnitModel: registerUnitModel,
    loadUnitModels: loadUnitModels,
    hasModel: function (race, role) { return !!protoFor(race, role); },
    _state: R,
    // Debug/preview: build a guard-tower mesh for a faction + optional towerType
    // ('arrow'|'bombard'|'barb'|'catapult'|'moonfire'|'thornwall'). Used by the
    // offline tower-preview harness; harmless in-game.
    _previewTower: function (faction, towerType) {
      THREE = THREE || window.THREE;
      if (!P) buildPalette();
      var race = raceOf(faction);
      BP = bpFor(race);
      var g = tfTower(race, towerType);
      g.traverse(function (o) { o.castShadow = true; o.receiveShadow = true; });
      addOutline(g, 0.06);
      return g;
    },
    // Debug/preview: build a unit mesh and freeze it at a stride phase so the
    // walk pose (legs/arms swing, torso twist) is visible in a still. Harmless.
    _previewUnit: function (faction, role, phase) {
      THREE = THREE || window.THREE;
      if (!P) buildPalette();
      var g = makeUnitMesh({ faction: faction, role: role, id: 1 });
      var ud = g.userData; var sw = Math.sin(phase || 0) * 0.7;
      if (ud && ud.legL) {
        ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
        if (ud.shinL) { ud.shinL.rotation.x = Math.max(0, -sw) * 0.9; ud.shinR.rotation.x = Math.max(0, sw) * 0.9; }
        if (ud.armL) ud.armL.rotation.x = (ud.armLBase || 0) - sw * 0.55;
        if (ud.armR) ud.armR.rotation.x = (ud.armRBase || 0) + sw * 0.40;
        if (ud.torso) ud.torso.rotation.y = sw * 0.12;
      }
      g.traverse(function (o) { o.castShadow = true; o.receiveShadow = true; });
      return g;
    },
    // Debug/preview: a finished building mesh for a faction (default core). Harmless.
    _previewBuilding: function (faction, type) {
      THREE = THREE || window.THREE; if (!P) buildPalette();
      return makeBuildingMesh({ faction: faction, type: type || 'core', w: 256, h: 192, built: true });
    },
    // Debug/preview: a projectile mesh of a kind aimed along a climbing diagonal
    // so shape, aim (yaw+pitch) and trail are visible in a still. Harmless.
    _previewProj: function (kind, colHex) {
      THREE = THREE || window.THREE; if (!P) buildPalette();
      var g = makeProjMesh(kind, colHex == null ? 0xffe08a : colHex);
      if (kind === 'magic') { g.rotation.y = -Math.atan2(0.6, 1); }
      else { g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0.4, 0.55).normalize()); }
      return g;
    },
  };

})(window.RTS = window.RTS || {});
