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
  var SHALLOW_DROP = -7;     // wadeable shallow-water shelf sits just below FLAT

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
    windUniform: { value: 0 },  // shared time uniform driving foliage sway
    envTime: 0,                 // accumulates real time for env animation
    waterGeo: null, motes: null,
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
  // smooth (non-faceted) material — for organic limbs/skin ported from the forge
  function Ms(h, opts) { return new THREE.MeshStandardMaterial(Object.assign({ color: h, flatShading: false, roughness: 0.86, metalness: 0 }, opts || {})); }
  // anatomical lathed limb from a [radius, y] silhouette (smooth normals), NOT centred
  function prof(pts, seg) {
    var v = pts.map(function (p) { return new THREE.Vector2(Math.max(0.001, p[0]), p[1]); });
    var g = new THREE.LatheGeometry(v, seg || 12); g.computeVertexNormals(); return g;
  }
  function profMesh(pts, mat, seg) { var m = new THREE.Mesh(prof(pts, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }

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
    crown: { body: 0xc7bc9f, bodyD: 0x9f9478, cap: 0x3a5fae, capD: 0x274479 },   // stone + royal-blue roof
    horde: { body: 0xbfb086, bodyD: 0x968760, cap: 0xb23a26, capD: 0x7a2415 },   // stone + deep-red roof
    elf:   { body: 0xccc6ad, bodyD: 0xa49e85, cap: 0x2f8f7a, capD: 0x1f6253 },   // pale stone + teal roof
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
  // pitched gable roof (ridge along Z): two sloped planes + triangular gable ends.
  // Turns a flat-capped box into a WC3-style peaked building. base sits at y.
  function roofGable(w, d, ph, mat, wallMat, y, overh) {
    overh = overh == null ? 0.34 : overh;
    var g = new THREE.Group(); g.position.y = y;
    var halfW = w / 2 + overh, ang = Math.atan2(ph, halfW), slope = Math.hypot(halfW, ph);
    [-1, 1].forEach(function (s) {
      var pl = box(slope, 0.16, d + overh * 2, mat, 0, 0, 0);
      pl.position.set(s * halfW / 2, ph / 2, 0); pl.rotation.z = -s * ang; g.add(pl);
    });
    var shp = new THREE.Shape(); shp.moveTo(-w / 2, 0); shp.lineTo(w / 2, 0); shp.lineTo(0, ph); shp.closePath();
    var eg = new THREE.ExtrudeGeometry(shp, { depth: d, bevelEnabled: false }); eg.translate(0, 0, -d / 2);
    var tg = new THREE.Mesh(eg, wallMat || mat); tg.castShadow = true; tg.receiveShadow = true; g.add(tg);
    return g;
  }
  // 4-sided pyramid/hip roof (for square towers + silos). base at y.
  function roofPyramid(w, d, ph, mat, y) {
    var r = Math.hypot(w, d) * 0.5;
    var c = cone(r, ph, 4, mat); c.rotation.y = Math.PI / 4;
    c.scale.set((w * 0.72) / r, 1, (d * 0.72) / r); c.position.y = y + ph / 2; return c;
  }
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
    g.add(roofGable(4.4, 3.6, 1.7, BP.cap, BP.bodyD, 2.2));         // pitched roof
    g.add(box(1.2, 1.5, 0.3, BP.door, 0, 0.75, 1.85));
    g.add(box(0.8, 0.8, 0.16, BP.woodD, -1.4, 1.4, 1.85));         // shutter window
    g.add(cyl(1.0, 1.0, 2.5, 9, BP.body).translateX(3.0).translateY(1.25));   // round silo
    g.add(cone(1.3, 1.4, 10, BP.cap).translateX(3.0).translateY(3.2));        // conical silo cap
    return g;
  }
  function tfBarracks(race) {
    var g = new THREE.Group();
    g.add(box(6.0, 2.3, 3.6, BP.body, 0, 1.15, 0));
    g.add(roofGable(6.0, 3.6, 1.85, BP.cap, BP.bodyD, 2.3));
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
    g.add(roofGable(4.4, 4.0, 1.6, BP.cap, BP.bodyD, 2.3));
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
    g.add(roofGable(6.0, 3.4, 1.7, BP.cap, BP.bodyD, 2.3));
    orcSpikeRidge(g, 2.9, 3.05, 1.7);
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
  // ── per-race conduit / supply building (the "farm" slot) ───────────────────
  // CROWN: tilled field + stone granary (handled by tfFarm above).
  // ORC: a raw war-pen — churned earth, lashed-log fence, a meat-drying rack.
  function tfFarmOrc() {
    var g = new THREE.Group();
    g.add(cyl(3.0, 3.2, 0.2, 9, BP.bodyD).translateY(0.1));                       // churned earth pad
    for (var i = -2; i <= 2; i++) g.add(cyl(0.12, 0.16, 1.3, 5, BP.wood).translateX(i * 1.2).translateY(0.65).translateZ(-2.6));   // fence posts
    g.add(box(5.2, 0.14, 0.14, BP.woodD, 0, 1.0, -2.6));                          // top rail
    [-1, 1].forEach(function (s) { g.add(cyl(0.13, 0.16, 2.1, 5, BP.wood).translateX(s * 1.7).translateY(1.05).translateZ(0.5)); });   // rack uprights
    var pole = cyl(0.1, 0.1, 3.6, 5, BP.woodD); pole.rotation.z = Math.PI / 2; pole.position.set(0, 2.0, 0.5); g.add(pole);          // rack pole
    for (var k = -1; k <= 1; k++) g.add(box(0.36, 0.72, 0.08, M(0x7a3b2a), k * 0.95, 1.5, 0.5));   // hanging meat strips
    var hut = new THREE.Group(); hut.position.set(-2.2, 0, -1.6);
    hut.add(cyl(1.0, 1.2, 1.3, 7, BP.body).translateY(0.65)); hut.add(cone(1.5, 1.1, 7, BP.cap).translateY(1.7)); g.add(hut);
    orcSpikeRidge(g, 1.0, 0.78, 2.8);
    return g;
  }
  // ELF: a moonwell grove — glowing pool ringed by mossy stones + canopy saplings.
  function tfFarmElf() {
    var g = new THREE.Group();
    g.add(cyl(2.9, 3.1, 0.42, 12, BP.bodyD).translateY(0.21));                    // mossy stone ring
    var pool = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.16, 16), new THREE.MeshStandardMaterial({ color: 0x6fe0d6, emissive: 0x3fbfb0, emissiveIntensity: 0.85, flatShading: true }));
    pool.position.y = 0.48; g.add(pool);                                          // glowing moonwell
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; var st = sphere(0.34, BP.body); st.scale.y = 0.8; st.position.set(Math.cos(a) * 2.5, 0.5, Math.sin(a) * 2.5); g.add(st); }   // ring stones
    elfCanopy(g, 1.3, -2.3, 1.7, -1.5); elfCanopy(g, 1.05, 2.3, 1.4, 1.6);
    g.add(cyl(0.14, 0.3, 1.7, 6, P.bark).translateX(-2.3).translateY(0.85).translateZ(-1.5));
    g.add(cyl(0.12, 0.26, 1.4, 6, P.bark).translateX(2.3).translateY(0.7).translateZ(1.6));
    var moon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), new THREE.MeshStandardMaterial({ color: 0xd8e6ff, emissive: 0x8fb6ff, emissiveIntensity: 0.95, flatShading: true }));
    moon.position.set(0, 1.7, 0); g.add(moon);                                    // floating moon mote over the well
    return g;
  }
  // ── per-race wall ─────────────────────────────────────────────────────────
  // CROWN: stone crenellated rampart (tfWall above).
  // ORC: sharpened-log palisade on an earthen berm, lashed with a crossbeam.
  function tfWallOrc() {
    var g = new THREE.Group();
    g.add(box(5.4, 1.0, 1.5, BP.bodyD, 0, 0.5, 0));                               // earthen berm
    for (var x = -2.4; x <= 2.41; x += 0.6) {
      g.add(cyl(0.26, 0.3, 2.2, 6, BP.wood).translateX(x).translateY(1.45).translateZ(0));   // log
      g.add(cone(0.27, 0.5, 6, BP.woodD).translateX(x).translateY(2.75));                    // sharpened tip
    }
    g.add(box(5.2, 0.2, 0.18, BP.woodD, 0, 1.85, 0.55));                          // lashing crossbeam
    orcSpikeRidge(g, 1.5, 2.95, -0.45);                                           // bone trophies
    return g;
  }
  // ELF: a living hedgerow — low stone base, bark posts, a leafy thorned crest.
  function tfWallElf() {
    var g = new THREE.Group();
    g.add(box(5.2, 1.2, 1.3, BP.body, 0, 0.6, 0));                                // low stone base
    for (var x = -2.0; x <= 2.01; x += 1.0) g.add(cyl(0.2, 0.28, 1.9, 6, P.bark).translateX(x).translateY(1.45));   // bark posts
    for (var x2 = -2.3; x2 <= 2.31; x2 += 0.66) { var lf = sphere(0.72, (Math.round(x2) % 2 ? P.leaf2 : P.leaf)); lf.scale.set(1.0, 0.85, 1.0); lf.position.set(x2, 2.3, 0); g.add(lf); }   // leafy crest
    for (var t = -2.1; t <= 2.11; t += 0.7) { var th = cone(0.1, 0.6, 5, P.woodD); th.position.set(t, 2.5, 0.5); th.rotation.x = 0.7; g.add(th); }   // thorns
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
    else if (/wall|gate|rampart/.test(t)) g = race === 'horde' ? tfWallOrc() : race === 'elf' ? tfWallElf() : tfWall();
    else if (/turret|tower/.test(t)) g = tfTower(race, b.towerType);
    else if (/forge/.test(t)) g = race === 'horde' ? tfForgeOrc() : race === 'elf' ? tfForgeElf() : tfForge();
    else if (/foundry|barrack/.test(t)) g = race === 'horde' ? tfBarracksOrc(race) : race === 'elf' ? tfBarracksElf() : tfBarracks(race);
    else if (/conduit|sheep|farm|pen/.test(t)) g = race === 'horde' ? tfFarmOrc() : race === 'elf' ? tfFarmElf() : tfFarm();
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
    elf: { skin: 0xb39bd8, skinD: 0x9c84c4, cloth: 0x3c6b39, cloth2: 0x2a4f28, metal: 0xd6dde6, metalD: 0xa7b0bd,
      trim: 0xd9c069, trimD: 0xb89a45, leather: 0x6e4a2a, leaf: 0x4f8a5a, hair: 0x9d8ad6, eye: 0xcffcff,
      beard: 0x000000, gem: 0x8fe0d6, cape: 0x2f6a4a,
      scale: 1.06, hunch: -0.04, armLen: 1.06, headR: 0.48, build: 0.86, legLen: 1.18, hand: 1.05, foot: 1.05, pauld: 0.7 },
  };

  // Low-poly steed for cavalry (lancers): horse for crown, war-panther for elf,
  // dire-wolf for horde. hipY = the rider's hip height so the saddle lines up.
  function buildMount(race, Pal, hipY) {
    var g = new THREE.Group();
    var horse = race === 'crown', cat = race === 'elf', wolf = race === 'horde';
    var bodyHex = cat ? 0x46406a : wolf ? 0x5b4c3b : 0x6e4f2e;
    var darkHex = cat ? 0x322c4d : wolf ? 0x40352a : 0x47331f;
    var body = M(bodyHex), dk = M(darkHex), hoof = M(0x1f1812);
    var saddle = M(Pal.cloth), saddleT = M(Pal.trim, { metalness: .4, roughness: .5 });
    var by = Math.max(1.4, hipY - 0.5);     // back height
    // barrel + chest + hindquarters
    g.add(box(0.96, 1.02, 2.6, body, 0, by, 0.0));
    g.add(box(0.82, 0.92, 0.9, body, 0, by, 1.2));
    g.add(box(0.9, 0.98, 0.9, body, 0, by, -1.15));
    // neck + head toward +Z (unit forward)
    var neck = box(0.5, 0.95, 0.64, body, 0, by + 0.48, 1.62); neck.rotation.x = -0.6; g.add(neck);
    if (horse) {
      g.add(box(0.42, 0.5, 1.05, body, 0, by + 0.92, 2.25));
      g.add(box(0.2, 0.78, 0.66, dk, 0, by + 0.66, 1.5).rotateX(-0.6));        // mane
      [-1, 1].forEach(function (s) { g.add(cone(0.1, 0.28, 4, body).translateX(0.14 * s).translateY(by + 1.4).translateZ(2.0)); });
    } else if (cat) {
      g.add(box(0.5, 0.5, 0.6, body, 0, by + 0.74, 2.2));
      [-1, 1].forEach(function (s) { g.add(cone(0.12, 0.26, 4, body).translateX(0.18 * s).translateY(by + 1.08).translateZ(2.1)); });
    } else {
      g.add(box(0.46, 0.5, 0.92, body, 0, by + 0.82, 2.2));
      [-1, 1].forEach(function (s) { g.add(cone(0.12, 0.3, 4, dk).translateX(0.16 * s).translateY(by + 1.26).translateZ(1.95)); });
      g.add(box(0.5, 0.5, 0.5, dk, 0, by + 0.2, -1.15));                        // shaggy scruff
    }
    // tail at -Z
    var tg = new THREE.Group(); tg.position.set(0, by + 0.1, -1.55);
    tg.add((cat ? cyl(0.11, 0.05, 1.5, 5, body) : box(0.2, 0.2, 1.0, dk)).translateZ(cat ? -0.55 : -0.4));
    tg.rotation.x = cat ? 0.7 : 1.0; g.add(tg);
    // 4 legs (ground to body)
    function ml(x, z) { var L = new THREE.Group(); L.position.set(x, by, z);
      L.add(box(0.26, by, 0.3, body, 0, -by * 0.5, 0)); L.add(box(0.32, 0.26, 0.42, hoof, 0, -by, 0.05)); return L; }
    g.add(ml(0.42, 1.0), ml(-0.42, 1.0), ml(0.42, -1.05), ml(-0.42, -1.05));
    // saddle + blanket
    g.add(box(1.04, 0.2, 1.3, saddle, 0, by + 0.55, -0.05));
    g.add(box(1.12, 0.1, 1.52, saddleT, 0, by + 0.47, -0.05));
    g.traverse(function (o) { o.castShadow = true; });
    return g;
  }

  function buildHumanoid(race, role, heroId) {
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
    // smooth (organic) materials — forge look, now for ALL races
    var skSmooth = Ms(troll ? 0x4f8f86 : Pal.skin, { roughness: 0.82 });
    var clothSmooth = Ms(Pal.cloth);
    var metalSmooth = Ms(Pal.metal, { metalness: 0.35, roughness: 0.5 });
    var metalDSmooth = Ms(Pal.metalD, { metalness: 0.3, roughness: 0.55 });
    var g = new THREE.Group();
    var bw = Pal.build, hsc = Pal.hand, fsc = Pal.foot, legLen = Pal.legLen, armLen = Pal.armLen, headR = Pal.headR, hunch = Pal.hunch;
    if (troll) { bw = 1.0; hsc = 1.05; fsc = 1.1; legLen = 1.12; armLen = 1.42; headR = 0.5; hunch = 0.18; }

    function leg(side) {
      var j = new THREE.Group(); j.position.set(0.36 * bw * side, 2.5 * legLen, 0);
      if (troll) { var TLt = 1.05 * legLen;   // lanky troll thigh (lathed)
        j.add(profMesh([[0.13 * bw, -TLt], [0.18 * bw, -TLt * 0.6], [0.15 * bw, 0]], skSmooth, 10));
        j.add(box(0.4 * bw, 0.3, 0.46, leather, 0, -0.72 * legLen, 0)); }
      else if (orc) { var TLo = 1.0 * legLen;   // thick muscular orc thigh (lathed)
        j.add(profMesh([[0.22 * bw, -TLo], [0.32 * bw, -TLo * 0.55], [0.27 * bw, 0]], skSmooth, 12));
        j.add(box(0.5 * bw, 0.4, 0.62, leather, 0, -0.16 * legLen, 0)); }
      else if (elf) { var TL = 1.05 * legLen;   // bare lavender thigh, tapered (lathed)
        j.add(profMesh([[0.13 * bw, -TL], [0.19 * bw, -TL * 0.62], [0.15 * bw, -TL * 0.18], [0.17 * bw, 0]], skSmooth, 12)); }
      else { var TLc = 1.05 * legLen;   // armored knight greave (lathed)
        j.add(profMesh([[0.2 * bw, -TLc], [0.27 * bw, -TLc * 0.6], [0.22 * bw, 0]], heavy ? metalDSmooth : Ms(Pal.leather), 12)); }
      var shin = new THREE.Group(); shin.position.y = -1.02 * legLen;
      if (troll) { var SLt = 0.95 * legLen;
        shin.add(profMesh([[0.085 * bw, -SLt], [0.14 * bw, -SLt * 0.5], [0.1 * bw, 0]], skSmooth, 10));
        shin.add(box(0.44 * fsc, 0.24, 0.82 * fsc, leather, 0, -0.96 * legLen, 0.18)); }
      else if (orc) { var SLo = 0.9 * legLen;
        shin.add(profMesh([[0.16 * bw, -SLo], [0.24 * bw, -SLo * 0.5], [0.2 * bw, 0]], skSmooth, 12));
        shin.add(box(0.6 * bw * fsc, 0.4, 0.85 * fsc, metalDSmooth, 0, -0.95 * legLen, 0.1)); shin.add(ring(0.34 * bw, 0.1, fur).rotateX(Math.PI / 2).translateY(-0.55 * legLen)); }
      else if (elf) { var SL = 0.95 * legLen;   // bare lavender calf (lathed) + sandal wraps
        shin.add(profMesh([[0.085 * bw, -SL], [0.15 * bw, -SL * 0.5], [0.11 * bw, 0]], skSmooth, 12));
        shin.add(box(0.34 * fsc, 0.22, 0.72 * fsc, leather, 0, -SL, 0.16));
        [-0.3, -0.55, -0.8].forEach(function (f) { var w = ring(0.13 * bw, 0.03, leather); w.rotation.x = Math.PI / 2; w.position.set(0, SL * f, 0.01); shin.add(w); }); }
      else { var SLc = 0.95 * legLen;   // knight greave (lathed) + sabaton
        shin.add(profMesh([[0.18 * bw, -SLc], [0.24 * bw, -SLc * 0.5], [0.2 * bw, 0]], heavy ? metalSmooth : Ms(Pal.leather), 12));
        shin.add(box(0.56 * bw * fsc, 0.34, 0.82 * fsc, metalDSmooth, 0, -0.98 * legLen, 0.12)); shin.add(box(0.5 * bw * fsc, 0.2, 0.34 * fsc, trim, 0, -1.0 * legLen, 0.45 * fsc)); if (heavy) { var r = ring(0.32 * bw, 0.06, trim); r.rotation.x = Math.PI / 2; r.position.y = -0.62 * legLen; shin.add(r); } }
      j.add(shin); j.userData = { shin: shin }; return j;
    }
    var legL = leg(-1), legR = leg(1); legL.name = 'legL'; legR.name = 'legR'; legL.userData.shin.name = 'shinL'; legR.userData.shin.name = 'shinR'; g.add(legL, legR);

    var torsoPivot = new THREE.Group(); torsoPivot.position.y = 2.5 * legLen; torsoPivot.rotation.x = hunch; torsoPivot.name = 'torso'; g.add(torsoPivot);
    if (troll) {
      var tt = profMesh([[0.34 * bw, 0.1], [0.42 * bw, 0.6], [0.5 * bw, 1.05], [0.4 * bw, 1.45], [0.22 * bw, 1.6]], skSmooth, 12); tt.scale.set(1, 1, 0.72); torsoPivot.add(tt);
      torsoPivot.add(box(0.8, 0.16, 0.04, warpaint, 0, 1.06, 0.3)); torsoPivot.add(box(0.6, 0.14, 0.04, warpaint, 0, 0.68, 0.3));
      torsoPivot.add(box(0.2, 0.7, 0.1, leather, 0, 0.85, 0.31).rotateZ(0.3));
      torsoPivot.add(box(0.9 * bw, 0.24, 0.6, leather, 0, 0.16, 0));
      torsoPivot.add(box(0.6, 0.95, 0.12, cloth, 0, -0.32, 0.32)); torsoPivot.add(box(0.6, 0.95, 0.12, cloth, 0, -0.32, -0.32));
      [-0.22, 0, 0.22].forEach(function (o) { torsoPivot.add(box(0.1, 0.1, 0.1, bone, o, 1.34, 0.28)); });
    } else if (orc) {
      // broad muscular orc torso (lathed, scaled wide + shallow)
      var ot = profMesh([[0.5 * bw, 0.12], [0.62 * bw, 0.6], [0.8 * bw, 1.1], [0.62 * bw, 1.5], [0.3 * bw, 1.62]], skSmooth, 14); ot.scale.set(1.0, 1, 0.72); torsoPivot.add(ot);
      torsoPivot.add(box(0.5, 0.42, 0.22, sk, -0.34, 1.2, 0.42)); torsoPivot.add(box(0.5, 0.42, 0.22, sk, 0.34, 1.2, 0.42));
      [-1, 1].forEach(function (s) { var st = box(0.2, 1.9, 0.12, leather, 0, 0.8, 0.46); st.rotation.z = s * 0.42; torsoPivot.add(st); });
      torsoPivot.add(box(0.7, 0.1, 0.04, warpaint, 0, 0.95, 0.5)); torsoPivot.add(box(0.5, 0.1, 0.04, warpaint, 0, 0.6, 0.5));
      if (heavy) { torsoPivot.add(box(0.8, 1.1, 0.5, metalD, -0.38, 0.95, 0.4)); torsoPivot.add(ring(0.55, 0.12, fur).rotateX(Math.PI / 2).translateY(1.5)); }
      torsoPivot.add(box(1.45 * bw, 0.3, 0.94, leather, 0, 0.16, 0)); torsoPivot.add(box(0.32, 0.3, 0.1, bone, 0, 0.16, 0.5));
      torsoPivot.add(box(0.7, 0.95, 0.14, leather, 0, -0.3, 0.42)); torsoPivot.add(box(0.7, 0.95, 0.14, leather, 0, -0.3, -0.42));
    } else if (elf) {
      // lathed hourglass torso + hanging tabard/skirt (ported from the forge)
      torsoPivot.add(profMesh([[0.42 * bw, 0], [0.33 * bw, 0.45], [0.46 * bw, 0.95], [0.52 * bw, 1.4], [0.42 * bw, 1.52], [0.18 * bw, 1.62]], clothSmooth, 16));
      torsoPivot.add(profMesh([[0.62 * bw, -0.62], [0.56 * bw, -0.3], [0.42 * bw, 0.12], [0.34 * bw, 0.36]], clothSmooth, 16));
      torsoPivot.add(box(0.2, 0.72, 0.05, M(Pal.cloth2), 0, -0.26, 0.43));   // front tabard panel
      if (heavy) { torsoPivot.add(plate(0.92 * bw, 1.05, 0.34, metal, trim, 0, 0.98, 0.34));
        torsoPivot.add(crescent(0.22, 0.05, metal).translateY(1.05).translateZ(0.56)); torsoPivot.add(box(0.2, 0.2, 0.1, gemM, 0, 0.75, 0.56));
        [-1, 1].forEach(function (s) { var lf = cone(0.16, 0.5, 4, M(Pal.leaf)); lf.position.set(0.32 * s, 1.45, 0.2); lf.rotation.z = s * 0.5; torsoPivot.add(lf); }); }
      else if (role === 'archer') { torsoPivot.add(box(1.0 * bw, 1.3, 0.62, leather, 0, 0.9, 0)); torsoPivot.add(box(0.18, 1.5, 0.1, M(Pal.leaf), -0.3, 0.85, 0.34).rotateZ(0.3)); }
      torsoPivot.add(box(0.9 * bw, 0.22, 0.64, leather, 0, 0.18, 0)); torsoPivot.add(box(0.2, 0.2, 0.08, gemM, 0, 0.18, 0.34));
      torsoPivot.add(box(0.7, 0.6, 0.12, cloth2, 0, -0.18, 0.3));
    } else {
      // knight torso — armored cuirass V (lathed, scaled wide + shallow)
      var ct = profMesh([[0.42 * bw, 0.1], [0.5 * bw, 0.55], [0.6 * bw, 1.1], [0.5 * bw, 1.5], [0.26 * bw, 1.62]], heavy ? metalDSmooth : clothSmooth, 14); ct.scale.set(1.05, 1, 0.78); torsoPivot.add(ct);
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
      var UA = 1.0 * armLen;
      if (troll) { j.add(profMesh([[0.1, -UA], [0.14, -UA * 0.5], [0.12, 0]], skSmooth, 10)); j.add(ring(0.22, 0.05, bone).rotateX(Math.PI / 2).translateY(-0.2)); }
      else if (orc) { j.add(profMesh([[0.18, -UA], [0.27, -UA * 0.5], [0.23, 0]], skSmooth, 12)); j.add(ring(0.3, 0.07, bone).rotateX(Math.PI / 2).translateY(-0.2)); }
      else if (elf) { j.add(profMesh([[0.1, -UA], [0.14, -UA * 0.5], [0.12, 0]], heavy ? metalSmooth : skSmooth, 10)); }
      else { j.add(profMesh([[0.15, -UA], [0.21, -UA * 0.5], [0.17, 0]], heavy ? metalSmooth : clothSmooth, 10)); }
      var fore = new THREE.Group(); fore.position.y = -0.94 * armLen;
      var FAo = 0.82 * armLen;
      if (troll) { fore.add(profMesh([[0.075, -FAo], [0.11, -FAo * 0.5], [0.095, 0]], skSmooth, 10)); fore.add(box(0.3, 0.3, 0.3, leather, 0, -0.62 * armLen, 0)); fore.add(sph(0.17 * hsc, skSmooth).translateY(-0.86 * armLen).translateZ(0.04)); }
      else if (orc) { fore.add(profMesh([[0.15, -FAo], [0.2, -FAo * 0.5], [0.18, 0]], skSmooth, 12)); fore.add(box(0.46, 0.34, 0.46, leather, 0, -0.66 * armLen, 0)); fore.add(sph(0.26 * hsc, skSmooth).translateY(-0.86 * armLen).translateZ(0.04)); }
      else if (elf) { var FA = 0.82 * armLen;   // lathed forearm + bracer ring + hand
        fore.add(profMesh([[0.075, -FA], [0.11, -FA * 0.5], [0.095, 0]], skSmooth, 10));
        var brc = ring(0.13, 0.035, leather); brc.rotation.x = Math.PI / 2; brc.position.y = -0.5 * FA; fore.add(brc);
        fore.add(sph(0.13 * hsc, skSmooth).translateY(-0.86 * armLen).translateZ(0.04)); }
      else { fore.add(profMesh([[0.12, -FAo], [0.17, -FAo * 0.5], [0.14, 0]], heavy ? metalDSmooth : skSmooth, 10)); fore.add(sph(0.22 * hsc, heavy ? metalSmooth : skSmooth).translateY(-0.84 * armLen).translateZ(0.04)); if (heavy) fore.add(box(0.5 * hsc, 0.12, 0.5 * hsc, trim, 0, -0.66 * armLen, 0.04)); }
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
      // glowing eyes + angled brows + nose
      headPivot.add(box(0.13, 0.08, 0.06, eyeM, -0.14, 0.34, headR * 0.86)); headPivot.add(box(0.13, 0.08, 0.06, eyeM, 0.14, 0.34, headR * 0.86));
      [-1, 1].forEach(function (s) { var bw2 = box(0.16, 0.05, 0.08, sk, 0.14 * s, 0.46, headR * 0.8); bw2.rotation.z = s * 0.18; headPivot.add(bw2); });
      var nz = cone(0.05, 0.16, 5, sk); nz.rotation.x = Math.PI * 0.5; nz.position.set(0, 0.28, headR * 0.92); headPivot.add(nz);
      // long swept ears
      headPivot.add(cone(0.09, 0.55, 4, sk).translateX(-headR * 0.92).translateY(0.34).rotateZ(0.55)); headPivot.add(cone(0.09, 0.55, 4, sk).translateX(headR * 0.92).translateY(0.34).rotateZ(-0.55));
      // lavender hair: swept-back volume + top-knot + face-frame locks + back braids (no antlers, per reference)
      headPivot.add(dome(headR + 0.05, hairM).translateY(0.34).translateZ(-0.05));
      headPivot.add(box(0.52, 0.5, 0.42, hairM, 0, 0.22, -headR * 0.6));
      headPivot.add(sph(0.16, hairM).translateY(0.62).translateZ(-0.08));
      headPivot.add(cone(0.13, 0.26, 5, hairM).translateY(0.5).translateZ(headR * 0.5));
      [-1, 1].forEach(function (s) { headPivot.add(profMesh([[0.04, -0.5], [0.085, -0.2], [0.05, 0]], hairM, 6).translateX(headR * 0.9 * s).translateY(0.32).translateZ(headR * 0.28)); });
      [-1, 1].forEach(function (s) { headPivot.add(cyl(0.05, 0.04, 0.62, 5, hairM).translateX(headR * 0.5 * s).translateY(-0.12).translateZ(-headR * 0.6));
        headPivot.add(sph(0.05, hairM).translateX(headR * 0.5 * s).translateY(-0.42).translateZ(-headR * 0.6)); });
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
      if (elf) {
        // Huntress — wields a moon glaive (crescent blade), not a lance/spear
        var hgl = new THREE.Group(); hgl.add(cyl(0.07, 0.07, 2.8, 6, leather).translateY(0.15));
        hgl.add(crescent(0.56, 0.08, metal).translateY(1.5));
        var hgo = sph(0.14, M(Pal.gem, { emissive: Pal.gem, emissiveIntensity: .7, roughness: .3 })); hgo.position.y = 1.5; hgl.add(hgo);
        holdR(hgl); hgl.rotation.z = 0.08; armR.rotation.x = -0.15;
        var lsE = new THREE.Group(); var lbE = cone(0.6, 1.4, 5, M(Pal.leaf)); lbE.scale.set(1, 1, 0.16); lsE.add(lbE); lsE.add(box(0.05, 1.25, 0.05, M(Pal.cloth2), 0, 0, 0.05)); lsE.position.set(-0.05, -0.4, 0.24); lfore.add(lsE);
      } else {
        var lance = new THREE.Group(); lance.add(cyl(0.06, 0.06, 3.7, 6, leather).translateY(0.2));
        lance.add(cone(0.13, 0.72, 6, metal).translateY(2.1)); lance.add(ring(0.15, 0.05, trim).rotateX(Math.PI / 2).translateY(1.55));
        lance.add(box(0.46, 0.36, 0.03, M(Pal.cape), 0.27, 1.6, 0));          // pennon
        holdR(lance); lance.rotation.z = 0.05; armR.rotation.x = -0.12;
        var lsh = plate(0.14, 1.25, 0.82, M(Pal.cloth), trim, -0.05, -0.4, 0.22); lfore.add(lsh); lfore.add(box(0.14, 0.36, 0.3, gemM, 0, -0.4, 0.3));
      }
      armL.rotation.x = -0.45;
      // mount the rider on a steed: build it, then seat the rider astride (legs
      // splayed over the saddle) and hide the rider legs from the walk cycle so
      // they don't pedal — the upper body still animates.
      g.add(buildMount(race, Pal, 2.5 * legLen));
      legL.name = ''; legR.name = '';
      if (legL.userData.shin) { legL.userData.shin.name = ''; legL.userData.shin.rotation.x = 0.8; }
      if (legR.userData.shin) { legR.userData.shin.name = ''; legR.userData.shin.rotation.x = 0.8; }
      legL.rotation.set(-0.5, 0, 0.5); legR.rotation.set(-0.5, 0, -0.5);
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
      else if (heroId === 'aelindra') {
        // Aelindra the Wild Rider — mounted moonfire archer. Great recurved
        // moonbow in the bow hand, nocked moonfire arrow, astride a war-panther.
        var mbow = new THREE.Group();
        mbow.add(box(0.05, 1.9, 0.06, metal, 0, -0.5, 0.3));
        mbow.add(crescent(0.42, 0.06, metal).translateY(0.32).translateZ(0.3));
        mbow.add(crescent(0.42, 0.06, metal).translateY(-1.32).translateZ(0.3).rotateZ(Math.PI));
        var moonglow = M(Pal.gem, { emissive: Pal.gem, emissiveIntensity: .9, roughness: .3 });
        mbow.add(box(0.02, 2.3, 0.02, moonglow, 0, -0.5, 0.3));   // glowing string
        mbow.add(sph(0.1, moonglow).translateY(-0.5).translateZ(0.3));   // nocked moonfire mote
        lfore.add(mbow); armL.rotation.x = -0.5; armR.rotation.x = -0.62; armR.rotation.z = 0.12;
        // moonfire quiver on the back
        torsoPivot.add(cyl(0.18, 0.18, 0.95, 8, leather).translateX(-0.44).translateY(1.2).translateZ(-0.38));
        [0, 0.11, -0.11].forEach(function (o) { torsoPivot.add(box(0.04, 0.5, 0.04, moonglow, -0.44 + o, 1.82, -0.38)); });
        // seat her astride a war-panther, legs splayed, hidden from the walk cycle
        g.add(buildMount(race, Pal, 2.5 * legLen));
        legL.name = ''; legR.name = '';
        if (legL.userData.shin) { legL.userData.shin.name = ''; legL.userData.shin.rotation.x = 0.8; }
        if (legR.userData.shin) { legR.userData.shin.name = ''; legR.userData.shin.rotation.x = 0.8; }
        legL.rotation.set(-0.5, 0, 0.5); legR.rotation.set(-0.5, 0, -0.5);
      }
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
    if (r === 'siege') return 'siege';
    return 'warrior';
  }
  function unitTemplate(race, role, heroId) {
    var key = race + ':' + role + (heroId ? ':' + heroId : '');
    if (unitTemplates[key]) return unitTemplates[key];
    var g = buildHumanoid(race, role, heroId);   // DETAILED roster (reversed from minimal pegs)
    // Larger so the per-race detail (antlers, glaive, tusks) reads at RTS zoom.
    fitHeight(g, role === 'hero' ? 74 : role === 'worker' ? 44 : role === 'lancer' ? 74 : 60);
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
  var weaponProtos = {};       // weapon url -> { scene } — separate-weapon GLBs, attached to a hand bone
  var _gltf = null, _clock = null;
  // A specific hero may carry its own bespoke model ('hero:thoryn'), which wins
  // over the generic race:role lookup; otherwise fall back to race-wide keys.
  function modelKeys(race, role, heroId) {
    var ks = [];
    if (heroId) ks.push('hero:' + heroId);
    ks.push(race + ':' + role, race + ':*', '*');
    return ks;
  }
  function protoFor(race, role, heroId) {
    var ks = modelKeys(race, role, heroId);
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
    var jobs = keys.map(function (k) {
      if (modelProtos[k]) return Promise.resolve();
      return loadOne(UNIT_MODELS[k].url).then(function (p) { if (p) modelProtos[k] = p; });
    });
    // Preload any separately-authored weapon meshes the same way, so they're
    // ready to mount onto a hand bone when a unit mesh is built.
    keys.forEach(function (k) {
      var specs = [];
      if (UNIT_MODELS[k].weapon) specs.push(UNIT_MODELS[k].weapon);
      if (UNIT_MODELS[k].attachments) specs = specs.concat(UNIT_MODELS[k].attachments);
      specs.forEach(function (w) {
        if (w && w.url && !weaponProtos[w.url]) {
          jobs.push(loadOne(w.url).then(function (p) { if (p) weaponProtos[w.url] = p; }));
        }
      });
    });
    return Promise.all(jobs).then(function () { return true; });
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
      // Default = procedural, EXCEPT a few hand-authored / generated .glb units.
      // cinder (orc) warrior: forged armored-orc. rimwalker (elf) archer: Tripo3D
      // image-to-model from the Rimwalker concept art (model front = +X, so
      // yaw = +PI/2 to match the +Z-front convention used by registerUnitModel).
      // Grunt (horde/Orc warrior): Tripo orc from the user's "grunt in leather armor"
      // concept, Mixamo-rigged (idle/run/overhead-chop), vertex-colour reskin (green
      // skin + brown armor). Front = +Z (Mixamo) so yaw = 0. Spiked orc felling-axe
      // in the right hand, blade up. Replaces the earlier cinder_warrior orc.
      registerUnitModel('horde:warrior', { url: 'assets/models/grunt_mx.glb?v=20260701a', height: 58, yaw: 0,
        anims: { idle: 'idle', walk: 'walk', attack: 'attack' }, stripRootMotion: true, attackRate: 1.0,
        weapon: { url: 'assets/models/w_orc_axe.glb?v=20260701a', bone: 'mixamorigRightHand', pos: [0.03, 0.16, 0], rot: [0, 1.5708, 3.14159], scale: 0.55 } });
      // Footman (crown/Human warrior): Tripo grey-plate knight from the user's own
      // concept, Mixamo-rigged (idle/run/slash), vertex-colour reskin. Front = +Z
      // (Mixamo) so yaw = 0. Steel sword in the right hand, blue cross kite-shield
      // on the left arm — both Tripo-generated from the user's weapon concepts.
      registerUnitModel('crown:warrior', { url: 'assets/models/footman_mx.glb?v=20260701a', height: 56, yaw: 0,
        anims: { idle: 'idle', walk: 'walk', attack: 'attack' }, stripRootMotion: true, attackRate: 1.0,
        weapon: { url: 'assets/models/w_footman_sword.glb?v=20260701a', bone: 'mixamorigRightHand', pos: [0, 0.06, 0], rot: [0, 0, 1.5708], scale: 0.85 },
        attachments: [{ url: 'assets/models/w_footman_shield.glb?v=20260701a', bone: 'mixamorigLeftHand', pos: [0, 0, 0], rot: [0, 1.5708, 0], scale: 0.6 }] });
      // ── New T-pose-authored Night Elf roster (clean rigs) + separate weapons
      //    mounted on a hand bone. All bodies front = +X, so yaw = -PI/2.
      // Bark Archer: Mixamo auto-rigged (clean deformation) with real idle/run/
      // bow-draw mocap; the Tripo texture atlas can't survive re-rigging so the
      // skin is baked as vertex colours. Front = +Z (Mixamo), so yaw = 0. Elven
      // longbow in the left hand; the draw clip drives attack, projectile fires.
      registerUnitModel('elf:archer', { url: 'assets/models/rim_archer_mx.glb?v=20260701a', height: 74, yaw: 0,
        anims: { idle: 'idle', walk: 'walk', attack: 'attack' }, stripRootMotion: true, attackRate: 1.1,
        weapon: { url: 'assets/models/w_longbow.glb?v=20260701a', bone: 'mixamorigLeftHand', pos: [0.05, 0, 0.05], rot: [0, 0, 0], scale: 1.0 } });
      // Huntress: panther rider, biped-rigged — her arms animate while the leg
      // bones are frozen (stripBones) so the panther body stays intact. Moon
      // glaive in the right hand.
      registerUnitModel('elf:lancer', { url: 'assets/models/rim_huntress.glb?v=20260630k', height: 66, yaw: -Math.PI / 2,
        anims: { idle: 'NlaTrack', walk: 'NlaTrack.001' }, stripRootMotion: true,
        stripBones: 'Thigh|Calf|Foot|Toe|Pelvis|Hip|Waist|Spine',
        weapon: { url: 'assets/models/w_moonglaive.glb?v=20260630k', bone: 'R_Hand', pos: [0.03, 0.02, -0.02], rot: [1.396, 0, 0.175], scale: 0.45 } });
      // Dryad: centaur, biped-rigged with frozen leg bones (stripBones) so the
      // deer body stays intact while her arms animate. Leaf spear in the right hand.
      registerUnitModel('elf:caster', { url: 'assets/models/rim_dryad.glb?v=20260630l', height: 64, yaw: -Math.PI / 2,
        anims: { idle: 'NlaTrack', walk: 'NlaTrack.001' }, stripRootMotion: true,
        stripBones: 'Thigh|Calf|Foot|Toe|Pelvis|Hip|Waist|Spine',
        weapon: { url: 'assets/models/w_leafspear.glb?v=20260630i', bone: 'R_Hand', pos: [0.03, 0.02, -0.02], rot: [1.396, 0, 0.175], scale: 0.93 } });
      // Druid (of the Claw): rigged idle/walk + bear-claw gauntlet on the right
      // hand. Fills the melee/warrior slot, replacing the procedural Thornguard.
      registerUnitModel('elf:warrior', { url: 'assets/models/rim_druid.glb?v=20260630i', height: 76, yaw: -Math.PI / 2,
        anims: { idle: 'NlaTrack', walk: 'NlaTrack.001' }, stripRootMotion: true,
        weapon: { url: 'assets/models/w_bearclaw.glb?v=20260630k', bone: 'R_Hand', pos: [0.005, 0.085, 0.01], rot: [2.007, 0, 0], scale: 0.38 } });
      registerUnitModel('elf:siege', { url: 'assets/models/rim_glaive_thrower.glb?v=20260630b', height: 54, yaw: -Math.PI / 2, noBob: true });
      registerUnitModel('elf:worker', { url: 'assets/models/rim_wisp.glb?v=20260630b', height: 30, yaw: -Math.PI / 2, glow: 0x9fe6ff, glowI: 0.45, glowSize: 1.1, hover: 16 });
      // Thoryn the Bladedrifter — bespoke Demon Hunter model (front = +X).
      registerUnitModel('hero:thoryn', { url: 'assets/models/demon_hunter.glb?v=20260630e', height: 78, yaw: -Math.PI / 2 });
      loadUnitModels().then(function (ok) { if (ok && R.enabled) rebuildUnitMeshes(); });
      return;
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
  // Soft additive glow halo (WC3 wisp aura): a cached radial-gradient sprite.
  var _glowTex = null;
  function glowSprite(colHex, size) {
    if (!_glowTex && typeof document !== 'undefined') {
      var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
      var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(255,255,255,0.33)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); _glowTex = new THREE.CanvasTexture(c);
    }
    var m = new THREE.SpriteMaterial({ map: _glowTex, color: colHex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    var s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
  }
  // Bright toon/cel ramp (Thronefall look): a 3-step gradient kept high so the
  // shadow bands stay light rather than muddy. Built once, shared.
  var _toonGrad = null;
  function toonGrad() {
    if (_toonGrad) return _toonGrad;
    var fmt = THREE.RedFormat || THREE.LuminanceFormat;
    var t = new THREE.DataTexture(new Uint8Array([190, 225, 255]), 3, 1, fmt);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    return _toonGrad = t;
  }
  // Convert a Tripo PBR material to flat, bright cel shading that keeps the
  // baked texture colour. A small emissive = albedo*0.12 lifts the dark side so
  // colours read true to the concept art under the game's warm, low-ambient sun.
  function toonify(mm, vc) {
    if (!mm || mm.isMeshToonMaterial) return mm;
    var t = new THREE.MeshToonMaterial({
      color: mm.color ? mm.color.clone() : new THREE.Color(0xffffff),
      map: mm.map || null, gradientMap: toonGrad(),
      transparent: !!mm.transparent, opacity: mm.opacity != null ? mm.opacity : 1,
      alphaTest: mm.alphaTest || 0, side: mm.side,
      vertexColors: !!vc,   // reskinned (Mixamo) units carry baked COLOR_0 vertex colours
    });
    // texture-lit units get an albedo emissive lift for readability; vertex-colour
    // units already read bright off the toon ramp, so skip the flat grey lift.
    if (mm.color && !vc) { t.emissive = mm.color.clone().multiplyScalar(0.12); if (mm.map) t.emissiveMap = mm.map; t.emissiveIntensity = 1; }
    t.name = mm.name;
    return t;
  }
  function toonifyMesh(o) {
    if (!o.isMesh || !o.material) return;
    var vc = !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color);
    o.material = Array.isArray(o.material) ? o.material.map(function (m) { return toonify(m, vc); }) : toonify(o.material, vc);
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
      // Tripo-generated meshes ship glossy, smooth PBR that clashes with the
      // game's flat-shaded look. Convert to bright toon/cel shading (keeps the
      // baked colours; matches the concept + Thronefall style).
      toonifyMesh(o);
    });
    // recenter so the unit pivot sits at ground-center: X/Z centered, feet at y=0.
    // Generated (Tripo) meshes aren't authored centered, so without this they render
    // offset from the unit's logical position and swing around when the unit turns.
    var _rb = new THREE.Box3().setFromObject(root), _rc = new THREE.Vector3(); _rb.getCenter(_rc);
    var _sz = new THREE.Vector3(); _rb.getSize(_sz);
    root.position.x -= _rc.x; root.position.z -= _rc.z; root.position.y -= _rb.min.y;
    fitHeight(holder, cfg.height || (role === 'hero' ? 60 : role === 'worker' ? 34 : 48));
    // glow (WC3 wisp): make the mesh emissive + add a soft additive halo at its
    // center. Added after fitHeight so the big halo doesn't skew the height fit.
    if (cfg.glow) {
      var gcol = new THREE.Color(cfg.glow);
      root.traverse(function (o) { if (o.isMesh && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (mm) {
        if ('emissive' in mm) { mm.emissive = gcol; mm.emissiveIntensity = cfg.glowI || 1.4; }
      }); });
      var halo = glowSprite(cfg.glow, _sz.y * (cfg.glowSize || 2.3)); halo.position.set(0, _sz.y * 0.5, 0); holder.add(halo);
    }
    var ud = { model: true, isArcher: role === 'archer', yaw: cfg.yaw || 0, noBob: !!cfg.noBob, hover: cfg.hover || 0 };
    if (proto.clips && proto.clips.length) {
      var mixer = new THREE.AnimationMixer(root); var actions = {};
      var an = cfg.anims || {};
      ['idle', 'walk', 'attack', 'death'].forEach(function (k) {
        var clip = an[k] && THREE.AnimationClip.findByName(proto.clips, an[k]);
        if (!clip) return;
        // attack clips can be long preset motions — trim to a short brace/loose window
        if (k === 'attack' && cfg.attackTrim && THREE.AnimationUtils && THREE.AnimationUtils.subclip) {
          clip = THREE.AnimationUtils.subclip(clip, 'attack', Math.round(cfg.attackTrim[0] * 30), Math.round(cfg.attackTrim[1] * 30), 30);
        }
        // strip root/translation so the clip plays IN PLACE (the game drives world
        // position; retargeted clips otherwise carry root motion that drifts/spazzes)
        if (cfg.stripRootMotion) {
          var kept = clip.tracks.filter(function (t) { return !/\.position$/.test(t.name); });
          clip = new THREE.AnimationClip(clip.name, clip.duration, kept);
        }
        // Freeze named bones at their bind pose (drop their tracks). Used for the
        // mounted Huntress: a biped rig animates her arms but folds the panther
        // body — stripping the leg/lower-body bones keeps the mount intact while
        // her upper body still moves.
        if (cfg.stripBones) {
          var reb = new RegExp(cfg.stripBones, 'i');
          var kept2 = clip.tracks.filter(function (t) { return !reb.test(t.name); });
          clip = new THREE.AnimationClip(clip.name, clip.duration, kept2);
        }
        var act = mixer.clipAction(clip);
        if (k === 'attack') { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
        actions[k] = act;
      });
      if (actions.idle) actions.idle.play();
      if (actions.attack) mixer.addEventListener('finished', function (ev) { if (ev.action === actions.attack) ud._atkPlaying = false; });
      ud.mixer = mixer; ud.actions = actions; ud.cur = 'idle'; ud._atkRate = cfg.attackRate || 1.2;
      // aim overlay: sample arm-bone rotations from a named clip at one instant
      // (without playing it), so on attack we raise the arms into an aim pose
      // rather than running the long preset clip (which spazzes + drifts the root).
      if (cfg.aim) {
        var aclip = THREE.AnimationClip.findByName(proto.clips, cfg.aim.clip);
        if (aclip) {
          ud.aimBones = []; ud._aim = 0; ud._aimHold = cfg.aim.hold || 0.5;
          (cfg.aim.bones || []).forEach(function (bn) {
            var bone = root.getObjectByName(bn), trk = null;
            for (var ti = 0; ti < aclip.tracks.length; ti++) if (aclip.tracks[ti].name === bn + '.quaternion') trk = aclip.tracks[ti];
            if (bone && trk) { var v = trk.createInterpolant().evaluate(cfg.aim.time || 0); ud.aimBones.push({ b: bone, q: new THREE.Quaternion(v[0], v[1], v[2], v[3]) }); }
          });
        }
      }
    }
    attachWeapon(root, cfg, ud);
    // Authored static arm/hand pose (from the weapon-editor): resolve each named
    // bone to a ref + euler; the per-frame loop overrides them after the mixer.
    if (cfg.pose) {
      ud.poseBones = [];
      Object.keys(cfg.pose).forEach(function (bn) {
        var bone = root.getObjectByName(bn);
        if (bone) ud.poseBones.push({ b: bone, e: cfg.pose[bn] });
      });
      // Apply once now — clip-less rigs have no mixer, so nothing re-poses them
      // per frame; a one-time set persists. (Mixer units get re-applied each frame.)
      ud.poseBones.forEach(function (p) { p.b.rotation.set(p.e[0], p.e[1], p.e[2]); });
    }
    holder.userData = ud;
    return holder;
  }
  // Mount a separately-authored weapon GLB onto a named hand/attachment bone of
  // the (ideally T/A-posed) body. cfg.weapon = {
  //   url,                     // the weapon .glb (preloaded by loadUnitModels)
  //   bone:  'R_Hand',         // bone name to parent to (falls back to body root)
  //   pos:   [x, y, z],        // local offset within the bone (bone units)
  //   rot:   [x, y, z],        // local euler rotation (radians)
  //   scale: 1,                // uniform scale within the bone
  //   detachOnFire: true,      // record the node so the fire hook can release it
  // }
  // Because the weapon is its own node it follows the hand through every clip and
  // can later be detached to fly as a real projectile — neither possible when the
  // weapon is baked into the body mesh.
  // Mount ONE prop (weapon/shield/quiver/effect) spec onto a bone. Returns the node.
  function attachOne(root, w, ud) {
    if (!w || !w.url) return null;
    var proto = weaponProtos[w.url];
    if (!proto) return null;                  // not loaded (yet) → skip, no crash
    var parent = (w.bone && root.getObjectByName(w.bone)) || root;
    var wm = (THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(proto.scene) : proto.scene.clone());
    var node = new THREE.Group(); node.add(wm);
    if (w.scale) node.scale.setScalar(w.scale);
    if (w.pos) node.position.set(w.pos[0] || 0, w.pos[1] || 0, w.pos[2] || 0);
    if (w.rot) node.rotation.set(w.rot[0] || 0, w.rot[1] || 0, w.rot[2] || 0);
    node.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; toonifyMesh(o); } });
    parent.add(node);
    if (w.detachOnFire) { ud.weapon = node; ud.weaponHome = parent; }
    return node;
  }
  // cfg.weapon = a single held weapon (back-compat). cfg.attachments = an array of
  // extra mounts (shields, quivers, back-slung weapons, effect anchors) — each the
  // same {url,bone,pos,rot,scale} spec, authored via the weapon-editor.
  function attachWeapon(root, cfg, ud) {
    if (cfg && cfg.weapon) attachOne(root, cfg.weapon, ud);
    if (cfg && cfg.attachments && cfg.attachments.length) {
      for (var i = 0; i < cfg.attachments.length; i++) attachOne(root, cfg.attachments[i], ud);
    }
  }
  function makeUnitMesh(u) {
    var race = raceOf(u.faction), role = mapRole(u);
    var entry = protoFor(race, role, u.heroId);
    if (entry) return makeModelMesh(entry, race, role, u);
    var tmpl = unitTemplate(race, role, u.heroId);
    var g = tmpl.clone();
    var ud = {
      legL: g.getObjectByName('legL'), legR: g.getObjectByName('legR'),
      shinL: g.getObjectByName('shinL'), shinR: g.getObjectByName('shinR'),
      armL: g.getObjectByName('armL'), armR: g.getObjectByName('armR'),
      torso: g.getObjectByName('torso'),
      isArcher: role === 'archer' || u.heroId === 'aelindra'
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
  /* ---- Low-poly trees (KayKit / Bitgem style), drawn via InstancedMesh ------
   * Two species (conifer + broadleaf). Each is baked ONCE into a single merged,
   * vertex-coloured geometry; a whole forest then renders as ~2 draw calls
   * (one InstancedMesh per species) instead of thousands of little meshes —
   * essential now that the 3D view is the default on dense maps. */
  function rgb3(hex) { return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; }
  function partMat(x, y, z, ry, rz, s) {
    var m = new THREE.Matrix4();
    var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, rz || 0));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s || 1, s || 1, s || 1));
    return m;
  }
  function bakeInto(geo, m4, c, pos, nor, col) {
    var g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m4);
    var pa = g.attributes.position.array, na = g.attributes.normal.array, i;
    for (i = 0; i < pa.length; i++) { pos.push(pa[i]); nor.push(na[i]); }
    for (i = 0; i < pa.length / 3; i++) { col.push(c[0], c[1], c[2]); }
    g.dispose && g.dispose();
  }
  function mergeParts(parts) {
    var pos = [], nor = [], col = [];
    parts.forEach(function (p) { bakeInto(p.geo, p.m, p.c, pos, nor, col); });
    var merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    merged.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    merged.computeBoundingBox();
    return merged;
  }
  var TREE_PROTOS = null, TREE_MAT = null;
  function treeProtos() {
    if (TREE_PROTOS) return TREE_PROTOS;
    var bark = rgb3(0x6b4a32), barkD = rgb3(0x553c28);
    var pine = rgb3(0x2f6d3a), pineHi = rgb3(0x3c8048);
    var leaf = rgb3(0x4f8a46), leafHi = rgb3(0x66a957);
    var I = function (r) { return new THREE.IcosahedronGeometry(r, 0); };
    // conifer: tapered trunk + 3 stacked cones
    var conifer = mergeParts([
      { geo: new THREE.CylinderGeometry(0.22, 0.4, 2.0, 6), m: partMat(0, 1.0, 0), c: bark },
      { geo: new THREE.ConeGeometry(1.7, 2.6, 7), m: partMat(0, 2.7, 0), c: pine },
      { geo: new THREE.ConeGeometry(1.3, 2.2, 7), m: partMat(0, 3.9, 0), c: pineHi },
      { geo: new THREE.ConeGeometry(0.9, 1.8, 7), m: partMat(0, 5.05, 0), c: pine },
    ]);
    // broadleaf: trunk + rounded icosahedron canopy cluster
    var broad = mergeParts([
      { geo: new THREE.CylinderGeometry(0.26, 0.44, 2.1, 6), m: partMat(0, 1.05, 0), c: barkD },
      { geo: I(1.55), m: partMat(0, 3.35, 0), c: leaf },
      { geo: I(1.05), m: partMat(1.2, 3.0, 0.3), c: leafHi },
      { geo: I(1.05), m: partMat(-1.0, 3.15, -0.4), c: leaf },
      { geo: I(0.95), m: partMat(0.1, 4.15, 0.2), c: leafHi },
    ]);
    TREE_PROTOS = { conifer: conifer, broad: broad };
    return TREE_PROTOS;
  }
  // Foliage material — vertex-coloured, flat-shaded, with a wind sway injected
  // into the vertex shader (foliage tops sway, bases stay put). uTime is bumped
  // each frame in updateEnv. Use ONLY on instanced meshes (reads instanceMatrix).
  function treeMat() {
    if (TREE_MAT) return TREE_MAT;
    TREE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
    TREE_MAT.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = R.windUniform;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        'float wph = instanceMatrix[3].x * 0.018 + instanceMatrix[3].z * 0.018;\n' +
        'float hf = max(transformed.y, 0.0);\n' +
        'transformed.x += sin(uTime * 1.6 + wph) * 0.11 * hf;\n' +
        'transformed.z += cos(uTime * 1.3 + wph) * 0.08 * hf;\n'
      );
    };
    return TREE_MAT;
  }
  // Static (no-sway) vertex-coloured material for rocks/pebbles.
  var ROCK_MAT = null;
  function rockMat() {
    if (!ROCK_MAT) ROCK_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
    return ROCK_MAT;
  }

  /* ---- ground decor prototypes (merged vertex-coloured geos, instanced) ----- */
  var DECOR_PROTOS = null;
  function decorProtos() {
    if (DECOR_PROTOS) return DECOR_PROTOS;
    var rockC = rgb3(0x7c786f), rockHi = rgb3(0x908b80), rockLo = rgb3(0x5d5950);
    // boulder: a lumpy icosahedron, deformed for irregular facets
    var rg = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
    var rp = rg.attributes.position.array;
    for (var i = 0; i < rp.length; i += 3) {
      var hh = Math.sin(rp[i] * 5.1 + rp[i + 1] * 3.3 + rp[i + 2] * 4.7);
      var f = 0.78 + (hh - Math.floor(hh)) * 0.0 + hh * 0.16;
      rp[i] *= f * 1.15; rp[i + 1] *= f * 0.82; rp[i + 2] *= f * 1.05;
    }
    var rock = mergeParts([{ geo: rg, m: partMat(0, 0.7, 0), c: rockC }]);
    // tint top facets lighter / bottom darker via a second pass on the merged colors
    var rc = rock.attributes.color.array, rpos = rock.attributes.position.array;
    for (var j = 0; j < rpos.length; j += 3) {
      var up = rpos[j + 1];
      var c = up > 0.7 ? rockHi : up < 0.2 ? rockLo : rockC;
      rc[j] = c[0]; rc[j + 1] = c[1]; rc[j + 2] = c[2];
    }
    rock.computeBoundingBox();
    // grass tuft: a few thin tapered blades fanning out
    var leaf = rgb3(0x5a9b46), leafHi = rgb3(0x72b257);
    var blades = [];
    for (var b = 0; b < 5; b++) {
      var a = b / 5 * Math.PI * 2;
      blades.push({ geo: new THREE.ConeGeometry(0.12, 1.0, 3), m: partMat(Math.cos(a) * 0.18, 0.5, Math.sin(a) * 0.18, a, Math.cos(a) * 0.5), c: b % 2 ? leafHi : leaf });
    }
    var tuft = mergeParts(blades); tuft.computeBoundingBox();
    // flower: green stem + pale head (per-instance tint colours the bloom)
    var flower = mergeParts([
      { geo: new THREE.CylinderGeometry(0.05, 0.07, 0.9, 4), m: partMat(0, 0.45, 0), c: rgb3(0x4f8a46) },
      { geo: new THREE.IcosahedronGeometry(0.28, 0), m: partMat(0, 1.0, 0), c: rgb3(0xf0e8d0) },
    ]); flower.computeBoundingBox();
    DECOR_PROTOS = { rock: rock, tuft: tuft, flower: flower };
    return DECOR_PROTOS;
  }

  /* ===========================================================================
   * Terrain — build a blocky heightmap mesh once per map
   * ========================================================================= */
  function elevAt(grid, cx, cy) {
    if (!grid) return 0;
    if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) return WATER_DROP;
    var i = cx + cy * grid.cols;
    // shallow ford: a wadeable shelf just below grass level (still walkable —
    // groundYAt clamps entities to >=0 so they wade rather than sink).
    if (grid.shallow && grid.shallow[i] === 1) return SHALLOW_DROP;
    var h = grid.heights[i];
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
  // like groundYAt but decor over deep water sits AT the water surface (so water
  // rocks read as sea stones, not blobs floating at land level).
  function surfaceYAt(s, wx, wy) {
    var grid = s && s.map && s.map.terrainGrid;
    if (!grid) return 0;
    var cx = Math.floor(wx / TILE), cy = Math.floor(wy / TILE);
    var e = elevAt(grid, cx, cy);
    if (e <= WATER_DROP) return WATER_DROP + 7;
    return Math.max(0, e);
  }

  function buildTerrain(s) {
    var grid = s && s.map && s.map.terrainGrid;
    if (R.terrainMesh) { R.scene.remove(R.terrainMesh); disposeObj(R.terrainMesh); R.terrainMesh = null; }
    if (R.waterMesh) { R.scene.remove(R.waterMesh); disposeObj(R.waterMesh); R.waterMesh = null; }
    var W = (s.map && s.map.w) || RTS.Config.world.w;
    var H = (s.map && s.map.h) || RTS.Config.world.h;

    // water plane spanning the whole world (shows through gaps / below cliffs)
    var wmat = new THREE.MeshStandardMaterial({ color: 0x123f5e, roughness: 0.66, metalness: 0.0, transparent: true, opacity: 0.96, flatShading: true });
    // Segmented so it can ripple; flat-shaded so the moving facets catch the sun
    // and shimmer (low-poly water). Animated per-frame in updateEnv.
    var wsegX = Math.max(16, Math.min(70, Math.round((W + 800) / 150)));
    var wsegY = Math.max(16, Math.min(70, Math.round((H + 800) / 150)));
    var wgeo = new THREE.PlaneGeometry(W + 800, H + 800, wsegX, wsegY);
    var wm = new THREE.Mesh(wgeo, wmat);
    wm.rotation.x = -Math.PI / 2; wm.position.set(W / 2, WATER_DROP + 6, H / 2); wm.receiveShadow = true;
    R.waterMesh = wm; R.waterGeo = wgeo; R.scene.add(wm);

    if (!grid) return;
    // ── Smooth heightfield terrain ────────────────────────────────────────────
    // Instead of independent flat per-tile quads with vertical cliff faces (which
    // read as blocky stairs), build ONE continuous surface from SHARED corner
    // vertices whose heights are the average of the adjacent tile levels. Coasts
    // then slope down into the water (sandy beach) and the land gently domes —
    // the soft, faceted low-poly look. Flat-shaded for the facets.
    var positions = [], normals = [], colors = [];
    var cTop = new THREE.Color(0x4c7826), cSand = new THREE.Color(0x7e6438);
    var cHigh = new THREE.Color(0x8a8163);      // dry highland (grass fades to this up high)
    var cCliff = new THREE.Color(0x6f665b);     // rock/cliff tint applied to steep land faces
    var cShallow = new THREE.Color(0x2a8a9e);   // wadeable shallow-water shelf
    var cols = grid.cols, rows = grid.rows;
    function tlevel(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return WATER_DROP;
      var i = tx + ty * cols;
      if (grid.shallow && grid.shallow[i] === 1) return SHALLOW_DROP;
      var hh = grid.heights[i];
      return hh < 0 ? WATER_DROP : (hh >= 1 ? HIGH_RISE : 0);
    }
    function tshallow(tx, ty) {
      return tx >= 0 && ty >= 0 && tx < cols && ty < rows && grid.shallow && grid.shallow[tx + ty * cols] === 1;
    }
    // Per-corner height (VH) + shallow flag (VS): a vertex is shared by its up-to-4
    // neighbouring tiles, so averaging their levels smooths every step into a slope.
    var vstride = cols + 1;
    var VH = new Float32Array(vstride * (rows + 1));
    var VS = new Uint8Array(vstride * (rows + 1));
    var VJX = new Float32Array(vstride * (rows + 1));   // organic XZ jitter so the
    var VJZ = new Float32Array(vstride * (rows + 1));   // coastline isn't a grid zigzag
    var JIT = TILE * 0.32;
    function rndAt(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }
    // smooth value noise + a few octaves (fbm), for organic micro-elevation so
    // flat interior land gently rolls instead of reading dead-flat. ~0..1.
    function vnoise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = rndAt(xi, yi), b = rndAt(xi + 1, yi), c = rndAt(xi, yi + 1), d = rndAt(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y) { var s = 0, amp = 0.5, f = 1; for (var o = 0; o < 3; o++) { s += vnoise(x * f, y * f) * amp; f *= 2; amp *= 0.5; } return s; }
    for (var vy = 0; vy <= rows; vy++) {
      for (var vx = 0; vx <= cols; vx++) {
        var sum = 0, anySh = false, allLand = true;
        for (var oy = -1; oy <= 0; oy++) {
          for (var ox = -1; ox <= 0; ox++) {
            var lv = tlevel(vx + ox, vy + oy);
            if (tshallow(vx + ox, vy + oy)) anySh = true;
            if (lv <= WATER_DROP) allLand = false;
            sum += lv;
          }
        }
        var yv;
        if (anySh) yv = SHALLOW_DROP;                 // hold fords as a flat wadeable shelf
        else {
          yv = sum / 4;
          // gentle dome + multi-octave noise roll so flat land undulates naturally
          // (small amplitude — units path on the tile grid, not this micro-relief).
          if (allLand) yv += 1.2 + Math.sin(vx * 0.55 + 1.3) * Math.cos(vy * 0.5 + 0.7) * 2.2
            + (fbm(vx * 0.23, vy * 0.23) - 0.45) * 8;
        }
        var vi = vx + vy * vstride;
        VH[vi] = yv;
        VS[vi] = anySh ? 1 : 0;
        // keep the outer map border un-jittered (no cracks at the world edge);
        // also calm the jitter on water-adjacent corners so the waterline reads as
        // a smooth shore instead of a lacy sawtooth (inland stays organic).
        var edge = (vx === 0 || vy === 0 || vx === cols || vy === rows);
        var jam = allLand ? 1 : 0.3;
        VJX[vi] = edge ? 0 : (rndAt(vx, vy) - 0.5) * 2 * JIT * jam;
        VJZ[vi] = edge ? 0 : (rndAt(vx + 7.3, vy + 1.9) - 0.5) * 2 * JIT * jam;
      }
    }
    function vcol(vx, vy, out) {
      var i = vx + vy * vstride, yv = VH[i];
      if (VS[i]) { out.copy(cShallow); return; }
      var jh = Math.sin(vx * 12.9898 + vy * 78.233) * 43758.5453; jh -= Math.floor(jh);
      if (yv > -2) {
        out.copy(cTop);
        if (yv > 10) out.lerp(cHigh, Math.min(1, (yv - 10) / 26));     // grass → dry highland up high
        out.multiplyScalar(0.88 + jh * 0.14);
      }
      else if (yv > -11) out.copy(cTop).lerp(cSand, (-2 - yv) / 9);    // grass → sand beach (narrow band)
      else out.copy(cSand).multiplyScalar(0.8);                         // submerged sand
    }
    var cA = new THREE.Color(), cB = new THREE.Color(), cC = new THREE.Color(), cD = new THREE.Color();
    function pushTri(ax, ay, az, ca, bx, by, bz, cb, gx, gy, gz, cc) {
      var ux = bx - ax, uy = by - ay, uz = bz - az, wx = gx - ax, wy = gy - ay, wz = gz - az;
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      var l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      positions.push(ax, ay, az, bx, by, bz, gx, gy, gz);
      normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      // slope-based cliff tint (the technique from the terrain tutorials): steep LAND
      // faces (small |ny|) blend toward rock, so hillsides and the highland rim read
      // as cliff instead of stretched grass. Gated to land (avgY>2) so beaches stay sandy.
      var slope = 1 - Math.abs(ny), avgY = (ay + by + gy) / 3, t = 0;
      if (avgY > 2) { t = (slope - 0.22) / 0.33; t = t < 0 ? 0 : t > 1 ? 1 : t; t *= 0.85; }
      var rk = cCliff.r, gk = cCliff.g, bk = cCliff.b;
      colors.push(
        ca.r + (rk - ca.r) * t, ca.g + (gk - ca.g) * t, ca.b + (bk - ca.b) * t,
        cb.r + (rk - cb.r) * t, cb.g + (gk - cb.g) * t, cb.b + (bk - cb.b) * t,
        cc.r + (rk - cc.r) * t, cc.g + (gk - cc.g) * t, cc.b + (bk - cc.b) * t);
    }
    for (var cy = 0; cy < rows; cy++) {
      for (var cx = 0; cx < cols; cx++) {
        var h00 = VH[cx + cy * vstride], h10 = VH[cx + 1 + cy * vstride];
        var h01 = VH[cx + (cy + 1) * vstride], h11 = VH[cx + 1 + (cy + 1) * vstride];
        if (Math.max(h00, h10, h01, h11) <= WATER_DROP + 1) continue;  // deep water → gap (water plane shows)
        // Kill the shoreline "lace": clamp drawn corners to sit a touch ABOVE the
        // water surface (WATER_DROP+6) so the terrain never crosses the water plane
        // and z-fights it. Deep-water quads are already skipped above (gap), so the
        // water plane still shows; the beach edge just meets it cleanly. Clamp is
        // per-vertex-deterministic, so shared corners stay crack-free.
        var WL = WATER_DROP + 18;   // clamp beach edge clear of the water surface + wave peaks (~5.5)
        var y00 = h00 < WL ? WL : h00, y10 = h10 < WL ? WL : h10, y01 = h01 < WL ? WL : h01, y11 = h11 < WL ? WL : h11;
        var i00 = cx + cy * vstride, i10 = cx + 1 + cy * vstride, i01 = cx + (cy + 1) * vstride, i11 = cx + 1 + (cy + 1) * vstride;
        var ax0 = cx * TILE + VJX[i00], az0 = cy * TILE + VJZ[i00];
        var bx0 = (cx + 1) * TILE + VJX[i10], bz0 = cy * TILE + VJZ[i10];
        var cx1 = (cx + 1) * TILE + VJX[i11], cz1 = (cy + 1) * TILE + VJZ[i11];
        var dx0 = cx * TILE + VJX[i01], dz1 = (cy + 1) * TILE + VJZ[i01];
        vcol(cx, cy, cA); vcol(cx + 1, cy, cB); vcol(cx + 1, cy + 1, cC); vcol(cx, cy + 1, cD);
        pushTri(ax0, y00, az0, cA, dx0, y01, dz1, cD, cx1, y11, cz1, cC);
        pushTri(ax0, y00, az0, cA, cx1, y11, cz1, cC, bx0, y10, bz0, cB);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    var tmat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    var tm = new THREE.Mesh(geo, tmat); tm.receiveShadow = true; tm.castShadow = true;
    R.terrainMesh = tm; R.scene.add(tm);

    // decor (trees) — instanced per species, built once with the terrain
    if (R.decorGroup) { R.scene.remove(R.decorGroup); disposeObj(R.decorGroup); }
    R.decorGroup = new THREE.Group();
    var decor = (s.map && s.map.decor) || [];
    var trees = decor.filter(function (d) { return d.kind === 'tree' || d.kind === 'grove_tree'; });
    if (trees.length) {
      var protos = treeProtos();
      var hCon = protos.conifer.boundingBox.max.y - protos.conifer.boundingBox.min.y;
      var hBro = protos.broad.boundingBox.max.y - protos.broad.boundingBox.min.y;
      var conList = [], broList = [];
      trees.forEach(function (d) {
        var hsh = ((Math.floor(d.x) * 73856093) ^ (Math.floor(d.y) * 19349663)) >>> 0;
        ((hsh & 1) ? broList : conList).push({ d: d, h: hsh });
      });
      var dummy = new THREE.Object3D(), tc = new THREE.Color();
      var mkInst = function (geo, list, protoH, baseH) {
        if (!list.length) return null;
        var im = new THREE.InstancedMesh(geo, treeMat(), list.length);
        im.castShadow = true; im.receiveShadow = true;
        list.forEach(function (it, i) {
          var d = it.d, hsh = it.h;
          var sc = (baseH + ((hsh >>> 8) & 31)) / protoH;   // ±31px height variety
          dummy.position.set(d.x, groundYAt(s, d.x, d.y), d.y);
          dummy.rotation.set(0, ((hsh >>> 4) & 63) / 63 * Math.PI * 2, 0);
          dummy.scale.set(sc, sc * (0.92 + ((hsh >>> 13) & 7) / 7 * 0.2), sc);
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
          // per-tree colour variety (the Object-Info→ColorRamp trick): brightness
          // AND a warm↔cool hue skew so trees read as individuals, not clones.
          var tb = 0.84 + ((hsh >>> 16) & 15) / 15 * 0.24;
          var thue = (((hsh >>> 20) & 15) / 15 - 0.5) * 0.16;
          tc.setRGB(tb * (1 + thue), tb, tb * (1 - thue));
          im.setColorAt(i, tc);
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        return im;
      };
      var imC = mkInst(protos.conifer, conList, hCon, 60);
      var imB = mkInst(protos.broad, broList, hBro, 58);
      if (imC) R.decorGroup.add(imC);
      if (imB) R.decorGroup.add(imB);
    }

    // ground decor: instanced rocks / pebbles / grass tufts / flowers — these are
    // already generated into s.map.decor but were never drawn in 3D. One
    // InstancedMesh per kind keeps it cheap.
    var DP = decorProtos();
    var FLOWER_TINTS = [0xff8a8a, 0xffe27a, 0xc69cff, 0xff9ecb, 0xfff4e0];
    function instDecor(proto, mat, list, baseH, jitH, kindTintArr) {
      if (!list || !list.length) return;
      var ph = (proto.boundingBox.max.y - proto.boundingBox.min.y) || 1;
      var im = new THREE.InstancedMesh(proto, mat, list.length);
      im.castShadow = (mat === rockMat()); im.receiveShadow = true;
      var dm = new THREE.Object3D(), col = new THREE.Color();
      for (var i = 0; i < list.length; i++) {
        var d = list[i];
        var hsh = ((Math.floor(d.x) * 73856093) ^ (Math.floor(d.y) * 19349663)) >>> 0;
        var th = baseH + ((hsh >>> 8) & 31) / 31 * jitH;
        var sc = th / ph;
        dm.position.set(d.x, surfaceYAt(s, d.x, d.y), d.y);
        dm.rotation.set(0, ((hsh >>> 4) & 63) / 63 * Math.PI * 2, 0);
        var sx = sc * (0.78 + ((hsh >>> 2) & 7) / 7 * 0.5);
        var sz = sc * (0.78 + ((hsh >>> 11) & 7) / 7 * 0.5);
        dm.scale.set(sx, sc, sz); dm.updateMatrix();
        im.setMatrixAt(i, dm.matrix);
        if (kindTintArr) { col.setHex(kindTintArr[hsh % kindTintArr.length]); im.setColorAt(i, col); }
        else { var t = 0.78 + ((hsh >>> 16) & 15) / 15 * 0.2; var hj = (((hsh >>> 20) & 15) / 15 - 0.5) * 0.12; col.setRGB(t * (1 + hj), t, t * (1 - hj * 0.5)); im.setColorAt(i, col); }
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      R.decorGroup.add(im);
    }
    instDecor(DP.rock, rockMat(), decor.filter(function (d) { return d.kind === 'rock'; }), 17, 14);
    instDecor(DP.rock, rockMat(), decor.filter(function (d) { return d.kind === 'pebble'; }), 8, 5);
    instDecor(DP.tuft, treeMat(), decor.filter(function (d) { return d.kind === 'grass'; }), 17, 10);
    instDecor(DP.flower, treeMat(), decor.filter(function (d) { return d.kind === 'flower'; }), 19, 8, FLOWER_TINTS);

    R.scene.add(R.decorGroup);

    // ── gradient sky dome (built once; follows the camera in updateEnv) ────────
    if (!R.skyDome) {
      var skyGeo = new THREE.SphereGeometry(7000, 24, 16);
      var sp = skyGeo.attributes.position, scol = [];
      var skyTop = new THREE.Color(0x274670), skyHorizon = new THREE.Color(0x6b8194);
      for (var si = 0; si < sp.count; si++) {
        var ny = Math.max(0, sp.getY(si) / 7000);
        var sc2 = skyHorizon.clone().lerp(skyTop, Math.pow(ny, 0.6));
        scol.push(sc2.r, sc2.g, sc2.b);
      }
      skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(scol, 3));
      R.skyDome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
      R.skyDome.frustumCulled = false;
      R.scene.add(R.skyDome);
    }
    R.skyDome.position.set(W / 2, 0, H / 2);

    // ── ambient drifting motes (pollen) ───────────────────────────────────────
    if (R.motes) { R.scene.remove(R.motes); R.motes.geometry.dispose(); R.motes.material.dispose(); R.motes = null; }
    var MN = 240, mp = new Float32Array(MN * 3);
    for (var mi = 0; mi < MN; mi++) {
      mp[mi * 3] = Math.random() * W; mp[mi * 3 + 1] = 18 + Math.random() * 190; mp[mi * 3 + 2] = Math.random() * H;
    }
    var mgeo = new THREE.BufferGeometry();
    mgeo.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    var mmat = new THREE.PointsMaterial({ color: 0xfff3d6, size: 7, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    R.motes = new THREE.Points(mgeo, mmat); R.motes.frustumCulled = false; R.scene.add(R.motes);

    // ── drifting cloud shadows: a dark plane just above the ground whose alpha
    // comes from a soft-blob texture, scrolled in updateEnv ──────────────────
    if (!R.cloudTex && typeof document !== 'undefined') {
      var ccv = document.createElement('canvas'); ccv.width = ccv.height = 256;
      var cg = ccv.getContext('2d');
      cg.fillStyle = '#000'; cg.fillRect(0, 0, 256, 256);
      for (var ci = 0; ci < 15; ci++) {
        var bx = Math.random() * 256, by = Math.random() * 256, br = 34 + Math.random() * 64;
        var grd = cg.createRadialGradient(bx, by, 0, bx, by, br);
        grd.addColorStop(0, 'rgba(255,255,255,' + (0.45 + Math.random() * 0.4).toFixed(2) + ')');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        cg.fillStyle = grd; cg.beginPath(); cg.arc(bx, by, br, 0, 7); cg.fill();
      }
      R.cloudTex = new THREE.CanvasTexture(ccv);
      R.cloudTex.wrapS = R.cloudTex.wrapT = THREE.RepeatWrapping;
    }
    if (R.cloudMesh) { R.scene.remove(R.cloudMesh); R.cloudMesh.geometry.dispose(); R.cloudMesh = null; }
    if (R.cloudTex) {
      R.cloudTex.repeat.set((W + 1200) / 1500, (H + 1200) / 1500);
      var cmat = new THREE.MeshBasicMaterial({ color: 0x0a0e16, transparent: true, opacity: 0.34, alphaMap: R.cloudTex, depthWrite: false, fog: false });
      var cmesh = new THREE.Mesh(new THREE.PlaneGeometry(W + 1200, H + 1200), cmat);
      cmesh.rotation.x = -Math.PI / 2; cmesh.position.set(W / 2, 16, H / 2);
      cmesh.frustumCulled = false;
      R.cloudMesh = cmesh; R.scene.add(cmesh);
    }
  }

  /* ---- per-frame environment animation: wind, water ripple, motes, sky ----- */
  function updateEnv(dt) {
    R.envTime += dt;
    var t = R.envTime;
    R.windUniform.value = t;
    var g = R.waterGeo;
    if (g) {
      var p = g.attributes.position.array;
      for (var i = 0; i < p.length; i += 3) {
        var x = p[i], y = p[i + 1];
        p[i + 2] = Math.sin(x * 0.012 + t * 1.1) * 2.2 + Math.sin(y * 0.015 - t * 0.9) * 1.9 + Math.sin((x + y) * 0.007 + t * 0.6) * 1.4;
      }
      g.attributes.position.needsUpdate = true;
    }
    if (R.motes) {
      var mp2 = R.motes.geometry.attributes.position.array;
      for (var j = 0; j < mp2.length; j += 3) {
        mp2[j + 1] += dt * 7;
        mp2[j] += Math.sin(t * 0.5 + j) * 0.18;
        if (mp2[j + 1] > 212) mp2[j + 1] = 16;
      }
      R.motes.geometry.attributes.position.needsUpdate = true;
    }
    if (R.skyDome && R.camera) R.skyDome.position.set(R.camera.position.x, 0, R.camera.position.z);
    if (R.cloudTex) { R.cloudTex.offset.x += dt * 0.0045; R.cloudTex.offset.y += dt * 0.0022; }
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
    // Fog pushed well past the play field (camera sits ~2000+ units out): the old
    // 1400→3600 fog washed the whole board into a pale haze. Now only the far
    // horizon fades, so the field reads crisp and saturated.
    R.scene.fog = new THREE.Fog(0xcfe0d6, 4200, 9500);     // faint, far — soft depth only
    R.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 8, 9000);
    // Soft daylight: a NEUTRAL fill (the old warm fill is what yellow-washed the
    // grass) + a gently warm key sun, so colours read true — not washed, not garish.
    R.amb = new THREE.AmbientLight(0xb9c4d0, 0.20); R.scene.add(R.amb);
    R.hemi = new THREE.HemisphereLight(0x8ea6c2, 0x39481f, 0.16); R.scene.add(R.hemi);
    R.sun = new THREE.DirectionalLight(0xffe2a8, 1.2);
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
        R.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(iw, ih), 0.5, 0.6, 0.93);
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
        if (ud && ud.model && ud.actions) {           // glTF model: idle<->walk + one-shot attack clip
          var atkA = ud.actions.attack;
          var freshAtk = (e.muzzleFlash || 0) > (ud._mfA || 0) + 1e-4;
          if (freshAtk && atkA) {                      // fresh attack → play the shoot clip once
            var fromA = ud.actions[ud.cur];
            atkA.reset(); atkA.timeScale = ud._atkRate || 1.2; atkA.play();
            if (fromA && fromA !== atkA) atkA.crossFadeFrom(fromA, 0.1, false);
            ud.cur = 'attack'; ud._atkPlaying = true;
          }
          if (freshAtk && ud.aimBones) ud._aim = 1;    // fresh attack → raise arms into the aim pose
          ud._mfA = e.muzzleFlash || 0;
          if (!ud._atkPlaying) {                       // not mid-shot: crossfade idle<->walk
            var want = moving && ud.actions.walk ? 'walk' : 'idle';
            if (ud.cur !== want && ud.actions[want]) {
              var from = ud.actions[ud.cur];
              ud.actions[want].reset().play();
              if (from && from !== ud.actions[want]) ud.actions[want].crossFadeFrom(from, 0.2, false);
              ud.cur = want;
            }
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
        } else if (ud && !ud.noBob) {
          // no clip rig and no procedural legs (static glTF units + mounted units
          // whose legs are hidden, e.g. the Huntress and Aelindra): a gentle life
          // bob so they aren't frozen — a saddle sway while moving, breathing at rest.
          // (skipped for machines like the Glaive Thrower — noBob)
          o.position.y += ud.hover || 0;   // floaters (Wisp) hover off the ground
          var bobH = slot.topY || 40;
          if (moving) {
            slot._bob = (slot._bob || 0) + spd * R.renderDt * 0.11;
            o.position.y += Math.abs(Math.sin(slot._bob)) * bobH * 0.02;
          } else {
            o.position.y += Math.sin(performance.now() * 0.0017 + (e._idlePhase || 0)) * bobH * 0.006;
          }
        }
        // hit reaction: a brief scale-pop (per-instance; can't tint shared mats)
        var pop = e.hitFlash > 0 ? 1 + Math.min(0.16, e.hitFlash * 0.5) : 1;
        o.scale.setScalar(slot.baseS * pop * spawnPop(slot));   // + plop on spawn
        // rising edge of muzzleFlash = a fresh attack → kick off an arm swing + flash
        if ((e.muzzleFlash || 0) > (slot._mf || 0) + 1e-4) {
          slot._atk = 0; slot._atkMelee = !e.ranged;
          var fa = e.facing || 0, fh = gy + (slot.topY || 40) * 0.52;
          if (e.ranged) fxFlash(e.x + Math.cos(fa) * 17, fh, e.y + Math.sin(fa) * 17, 0xffe6a0, 0.8, 0.1);
          else fxFlash(e.x + Math.cos(fa) * 16, fh, e.y + Math.sin(fa) * 16, 0xfff0d8, 1.0, 0.12);
        }
        slot._mf = e.muzzleFlash || 0;
        // attack swing: drive the WEAPON arm (+ a little torso lean & step) over
        // ~0.3s so a strike reads as an arm swing, not a full-body jerk. Runs after
        // the walk pose so it overrides the weapon arm for the swing window.
        if (ud && ud.legL && slot._atk != null && slot._atk >= 0) {
          var AD = 0.30; slot._atk += R.renderDt;
          var ap = slot._atk / AD;
          var tb = ud._torsoBaseX; if (tb === undefined) tb = ud._torsoBaseX = (ud.torso ? ud.torso.rotation.x : 0);
          if (ap >= 1) {
            slot._atk = -1;
            if (ud.armR) ud.armR.rotation.x = (ud.armRBase || 0);
            if (ud.torso) ud.torso.rotation.x = tb;
          } else {
            var swingR, lean;
            if (slot._atkMelee) {
              if (ap < 0.28) swingR = -1.5 * (ap / 0.28);                          // wind up (raise)
              else if (ap < 0.55) swingR = -1.5 + 2.4 * ((ap - 0.28) / 0.27);      // strike down/forward
              else swingR = 0.9 * (1 - (ap - 0.55) / 0.45);                        // recover
              lean = Math.sin(ap * Math.PI) * 0.13;
            } else {
              swingR = (ap < 0.5) ? 0.6 * (ap / 0.5) : 0.6 * (1 - (ap - 0.5) / 0.5);   // draw → release
              lean = Math.sin(ap * Math.PI) * 0.05;
              if (ud.armL) ud.armL.rotation.x = (ud.armLBase || 0) - 0.15 * Math.sin(ap * Math.PI);
            }
            if (ud.armR) ud.armR.rotation.x = (ud.armRBase || 0) + swingR;
            if (ud.torso) ud.torso.rotation.x = tb + lean;
            o.position.x += Math.cos(e.facing || 0) * lean * 26;                   // gentle step into the blow
            o.position.z += Math.sin(e.facing || 0) * lean * 26;
          }
        }
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
    if (p.faction === 'rimwalker' && (p.role === 'lancer' || p.role === 'siege')) return 'glaive';   // Huntress + Glaive Thrower hurl spinning glaives
    if (p.splash > 0) return 'siege';
    if (p.faction === 'cinder' && p.role === 'archer') return 'spear';
    return 'arrow';
  }
  // Huntress moon-glaive: a camera-facing sprite that spins as it flies.
  var _glaiveMat = null;
  function glaiveMat() {
    if (_glaiveMat) return _glaiveMat;
    _glaiveMat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, depthWrite: false, alphaTest: 0.12 });
    new THREE.TextureLoader().load('assets/fx/glaive.png?v=20260630a', function (tex) {
      if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
      _glaiveMat.map = tex; _glaiveMat.needsUpdate = true;
    });
    return _glaiveMat;
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
    if (kind === 'glaive') {
      var spr = new THREE.Sprite(glaiveMat()); spr.scale.set(30, 30, 1); g.add(spr);
    } else if (kind === 'magic') {
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
        var H = kind === 'siege' ? Math.min(260, d0 * 0.34) : kind === 'magic' ? 0 : kind === 'glaive' ? Math.min(48, d0 * 0.09) : Math.min(70, d0 * 0.11);
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
      else if (sl.kind === 'glaive') { glaiveMat().rotation = (performance.now() * 0.02) % (Math.PI * 2); }   // sprite billboards; spin it in-plane
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

  /* ---- skill-VFX sprite sheets as 3D billboards -------------------------
   * The 2D SkillVFX (vines, leaves, heal sprouts, auras) draw on the hidden
   * 2D canvas, so ability casts were invisible in 3D. Load each sheet once and
   * billboard it as a camera-facing Sprite, advancing the frame strip off the
   * effect's elapsed life — so every ability's animation now reads in 3D. */
  var _skillTex = {};
  function skillTexture(sheet) {
    if (_skillTex[sheet] !== undefined) return _skillTex[sheet] || null;
    _skillTex[sheet] = null;   // pending
    try {
      new THREE.TextureLoader().load('assets/skills/' + sheet + '.png?v=20260626a', function (tex) {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        _skillTex[sheet] = tex;
      }, undefined, function () { _skillTex[sheet] = false; });
    } catch (er) { _skillTex[sheet] = false; }
    return null;
  }

  /* ---- effects: impact bursts + ground shock rings ----------------------- */
  var ringGeo = null, sparkGeo = null, beamGeo = null, pillarGeo = null, burstGeo = null;
  function syncEffects(s) {
    var list = s.entities && s.entities.effects; if (!list) return;
    if (!ringGeo) ringGeo = new THREE.RingGeometry(0.55, 1, 18);
    if (!sparkGeo) sparkGeo = new THREE.IcosahedronGeometry(4, 0);
    if (!beamGeo) beamGeo = new THREE.BoxGeometry(1, 1, 1);
    if (!pillarGeo) pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
    if (!burstGeo) burstGeo = new THREE.IcosahedronGeometry(1, 0);
    for (var i = 0; i < list.length; i++) {
      var e = list[i]; if (!e) continue;
      var k = e.kind;
      if (k === 'beam' || k === 'pillar' || k === 'burst') {        // richer ability VFX
        R.eseen[e.id] = true;
        var bsl = R.epool[e.id];
        var bgy = groundYAt(s, e.x, e.y);
        if (!bsl) {
          var bcol = 0xffffff; try { bcol = new THREE.Color(e.color || '#ffffff').getHex(); } catch (er2) {}
          var geo = k === 'beam' ? beamGeo : k === 'pillar' ? pillarGeo : burstGeo;
          var bm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: bcol, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
          R.scene.add(bm); bsl = R.epool[e.id] = { m: bm, k: k };
        }
        var bp = e.max ? 1 - Math.max(0, (e.life || 0) / e.max) : 1;   // 0→1 over life
        var bmm = bsl.m;
        if (k === 'beam') {
          var x2 = e.x2 != null ? e.x2 : e.x, y2 = e.y2 != null ? e.y2 : e.y;
          var dx = x2 - e.x, dz = y2 - e.y, len = Math.hypot(dx, dz) || 1;
          bmm.position.set((e.x + x2) / 2, bgy + (e.hy || 14), (e.y + y2) / 2);
          bmm.rotation.y = Math.atan2(dx, dz);
          var bw = (e.w || 10) * (1 - bp * 0.4);
          bmm.scale.set(bw, bw, len);
          bmm.material.opacity = (1 - bp) * 0.9;
        } else if (k === 'pillar') {
          var ph = e.hgt || 70, pr = e.r || 22;
          bmm.position.set(e.x, bgy + ph * 0.5, e.y);
          bmm.scale.set(pr, ph, pr);
          bmm.material.opacity = Math.sin(Math.min(1, bp) * Math.PI) * 0.6;
        } else {                                                       // burst
          var br = (e.maxR || 40) * (0.3 + bp * 1.05);
          bmm.position.set(e.x, bgy + (e.hy || 16), e.y);
          bmm.scale.setScalar(br);
          bmm.material.opacity = (1 - bp) * 0.85;
        }
        continue;
      }
      if (k === 'skillfx') {                                    // billboarded ability sprite
        R.eseen[e.id] = true;
        var base = skillTexture(e.sheet);
        if (!base) continue;
        var ssl = R.epool[e.id];
        if (!ssl) {
          var frames = e.frames || 1;
          var tx = base.clone(); tx.needsUpdate = true; tx.repeat.x = 1 / frames;
          var smat = new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: false });
          var spr = new THREE.Sprite(smat);
          var scl = (e.scale || 3) * 5.5;
          spr.scale.set(scl, scl * ((e.fh || 16) / (e.fw || 16)), 1);
          R.scene.add(spr);
          ssl = R.epool[e.id] = { m: spr, k: k, frames: frames, fps: e.fps || 16, tex: tx, scl: scl, texMat: smat };
        }
        var elp = (e.max || 1) - (e.life || 0);
        var fi = Math.floor(elp * ssl.fps);
        fi = e.loop ? (fi % ssl.frames) : Math.min(ssl.frames - 1, fi);
        ssl.tex.offset.x = fi / ssl.frames;
        var sgy = groundYAt(s, e.x, e.y);
        ssl.m.position.set(e.x, sgy + ssl.scl * 0.45, e.y);
        ssl.m.material.opacity = e.hold ? 1 : Math.min(1, (e.life / (e.max || 1)) * 2.0 + 0.15);
        continue;
      }
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
      if (!R.eseen[id]) { var s3 = R.epool[id]; R.scene.remove(s3.m); s3.m.material.dispose(); if (s3.tex) s3.tex.dispose(); delete R.epool[id]; }
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
    updateEnv(R.renderDt);
    gc();
    // advance any glTF skeletal animations
    if (!_clock) _clock = new THREE.Clock();
    var dt = _clock.getDelta();
    for (var pid in R.pool) {
      var psl = R.pool[pid]; if (!(psl && psl.obj && psl.obj.userData && psl.obj.userData.mixer)) continue;
      var pud = psl.obj.userData; pud.mixer.update(dt);
      // static pose overlay: override specific bones to an authored orientation
      // each frame (after the mixer). Lets the arms/hands be posed by hand via
      // the weapon-editor and hold that pose on top of idle/walk.
      if (pud.poseBones) {
        for (var pi = 0; pi < pud.poseBones.length; pi++) {
          var pb = pud.poseBones[pi]; pb.b.rotation.set(pb.e[0], pb.e[1], pb.e[2]);
        }
      }
      // aim overlay: after the mixer poses the body (idle), bend the arm bones toward
      // the cached aim pose by a weight that snaps up on attack and eases back down.
      if (pud.aimBones && pud._aim > 0) {
        for (var ai = 0; ai < pud.aimBones.length; ai++) pud.aimBones[ai].b.quaternion.slerp(pud.aimBones[ai].q, pud._aim);
        pud._aim = Math.max(0, pud._aim - dt / (pud._aimHold || 0.5));
      }
    }
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
    else { R.scene.background.setHex(0x5a7488); R.scene.fog.color.setHex(0x6b7d86); R.sun.color.setHex(0xffe2a8); R.sun.intensity = 1.2; R.amb.intensity = 0.2; }
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
