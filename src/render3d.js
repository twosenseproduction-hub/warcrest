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
  var RACETINT = {
    crown: { body: 0xb5503a, bodyD: 0x8a3b2b, cap: 0xe9dcc0, capD: 0xcdba8e },   // terracotta + cream
    horde: { body: 0x7d3528, bodyD: 0x551f17, cap: 0xccbd95, capD: 0xa8946a },   // oxblood + bone
    elf:   { body: 0x3f7d6a, bodyD: 0x2b5849, cap: 0xe7e6cf, capD: 0xc4c4a8 },   // teal + pale
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
  function tfTower(race) {
    var g = new THREE.Group();
    g.add(box(2.4, 5.0, 2.4, BP.body, 0, 2.5, 0));                 // terracotta shaft
    g.add(box(3.3, 0.7, 3.3, BP.cap, 0, 5.15, 0));                 // corbeled cream cap (overhangs)
    crenellate(g, 1.5, 5.7, BP.cap);
    sideStair(g, 1.95, BP.capD);
    g.add(box(0.7, 1.0, 0.18, BP.door, 0, 0.8, 1.22));
    g.add(box(0.7, 0.45, 0.05, factionBanner(race), 0, 6.3, 0));
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
    if (/core|keep|castle|townhall|citadel|chiefs_hall/.test(t)) g = tfKeep(race);
    else if (/wall|gate|rampart/.test(t)) g = tfWall();
    else if (/turret|tower/.test(t)) g = tfTower(race);
    else if (/forge/.test(t)) g = tfForge();
    else if (/foundry|barrack/.test(t)) g = tfBarracks(race);
    else if (/conduit|sheep|farm|pen/.test(t)) g = tfFarm();
    else if (/windmill|mill|merchant|market/.test(t)) g = tfWindmill(race);
    else g = tfHouse(race);
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
      trim: 0xd9c069, trimD: 0xb89a45, leather: 0x4a4030, leaf: 0x4f8a5a, hair: 0x3a6b62, eye: 0xffd27a,
      beard: 0x000000, gem: 0x8fe0d6, cape: 0x2f6a4a,
      scale: 1.06, hunch: -0.04, armLen: 1.06, headR: 0.48, build: 0.86, legLen: 1.18, hand: 1.05, foot: 1.05, pauld: 0.7 },
  };

  function buildHumanoid(race, role) {
    var Pal = RACEDEF[race];
    var heavy = (role === 'warrior' || role === 'hero');
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
      [-1, 1].forEach(function (s) { var grp2 = new THREE.Group(); grp2.position.set(0.86 * bw * s, 1.62, 0); grp2.add(dome(0.6, metal).translateY(-0.05)); var r = ring(0.55, 0.07, trim); r.rotation.x = Math.PI / 2; grp2.add(r); torsoPivot.add(grp2); });
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
      else if (elf) { var gl = new THREE.Group(); gl.add(cyl(0.07, 0.07, 2.4, 6, leather).translateY(0.1)); gl.add(crescent(0.5, 0.07, metal).translateY(1.35)); holdR(gl); gl.rotation.z = 0.1; armR.rotation.x = -0.15; }
      else { var sw = new THREE.Group(); sw.add(box(0.13, 1.8, 0.14, metal, 0, 0.6, 0)); sw.add(box(0.6, 0.16, 0.18, trim, 0, -0.2, 0)); sw.add(box(0.16, 0.4, 0.16, leather, 0, -0.5, 0)); sw.add(sph(0.13, trim).translateY(-0.74)); holdR(sw); sw.rotation.z = 0.18;
        var shield = plate(0.14, 1.2, 0.95, M(Pal.cloth), trim, -0.05, -0.4, 0.22); lfore.add(shield); lfore.add(box(0.16, 0.4, 0.34, gemM, 0, -0.4, 0.3)); armL.rotation.x = -0.45; }
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
    if (r === 'monk' || r === 'caster') return 'monk';
    return 'warrior';
  }
  function unitTemplate(race, role) {
    var key = race + ':' + role;
    if (unitTemplates[key]) return unitTemplates[key];
    var g = buildMinimalUnit(race, role);
    fitHeight(g, role === 'hero' ? 52 : role === 'worker' ? 32 : 40);
    unitTemplates[key] = g;
    return g;
  }
  function makeUnitMesh(u) {
    var race = raceOf(u.faction), role = mapRole(u);
    var tmpl = unitTemplate(race, role);
    var g = tmpl.clone();
    g.userData = {
      legL: g.getObjectByName('legL'), legR: g.getObjectByName('legR'),
      isArcher: role === 'archer'
    };
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
    window.addEventListener('resize', resize);
    R.inited = true;
    return true;
  }

  function resize() {
    if (!R.inited) return;
    var w = window.innerWidth, h = window.innerHeight;
    R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
    R.renderer.setSize(w, h, false);
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

  /* ===========================================================================
   * Per-frame sync — mirror s.entities into pooled meshes
   * ========================================================================= */
  function syncList(s, list, kind) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || e.dead) continue;
      R.seen[e.id] = true;
      var slot = R.pool[e.id];
      // rebuild if faction/role/type changed underneath an id (rare)
      var sig = kind + ':' + (e.faction || '') + ':' + (e.role || e.type || '') + ':' + (e.team || 0) + ':' + (e.heroId || '');
      if (slot && slot.sig !== sig) { freeSlot(slot); slot = null; }
      if (!slot) {
        var obj;
        if (kind === 'unit') obj = makeUnitMesh(e);
        else if (kind === 'building') obj = makeBuildingMesh(e);
        else obj = makeResourceMesh();
        R.scene.add(obj);
        if (!_box) _box = new THREE.Box3();
        _box.setFromObject(obj); var bs = new THREE.Vector3(); _box.getSize(bs);
        slot = R.pool[e.id] = { obj: obj, sig: sig, kind: kind, baseS: obj.scale.y, topY: bs.y };
      }
      var o = slot.obj;
      var gy = groundYAt(s, e.x, e.y);
      o.position.set(e.x, gy, e.y);
      if (kind === 'unit') {
        o.rotation.y = -(e.facing || 0) + Math.PI / 2;
        // walk cycle: swing legs (+ bend knees) while moving; relax on idle
        var moving = e.moveTo || (Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 4);
        var ud = o.userData;
        if (ud && ud.legL) {
          if (moving) {
            var sw = Math.sin((performance.now() * 0.001) * 9 + (e._idlePhase || 0) * 6) * 0.5;
            ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
            if (ud.shinL) { ud.shinL.rotation.x = Math.max(0, -sw * 0.7); ud.shinR.rotation.x = Math.max(0, sw * 0.7); }
          } else {
            ud.legL.rotation.x *= 0.8; ud.legR.rotation.x *= 0.8;
            if (ud.shinL) { ud.shinL.rotation.x *= 0.8; ud.shinR.rotation.x *= 0.8; }
          }
        }
        // hit reaction: a brief scale-pop (per-instance; can't tint shared mats)
        var pop = e.hitFlash > 0 ? 1 + Math.min(0.16, e.hitFlash * 0.5) : 1;
        o.scale.setScalar(slot.baseS * pop);
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

  /* ---- projectiles: small glowing motes flying between combatants -------- */
  var projGeo = null;
  function syncProjectiles(s) {
    var list = s.entities && s.entities.projectiles; if (!list) return;
    if (!projGeo) projGeo = new THREE.SphereGeometry(3.6, 6, 5);
    for (var i = 0; i < list.length; i++) {
      var p = list[i]; if (!p) continue; R.pseen[p.id] = true;
      var sl = R.ppool[p.id];
      if (!sl) {
        var col = 0xffe08a; try { col = new THREE.Color(p.color || '#ffe08a').getHex(); } catch (e) {}
        var m = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: col }));
        R.scene.add(m); sl = R.ppool[p.id] = { m: m };
      }
      sl.m.position.set(p.x, groundYAt(s, p.x, p.y) + 26, p.y);
    }
    for (var id in R.ppool) {
      if (!R.pseen[id]) { var s2 = R.ppool[id]; R.scene.remove(s2.m); s2.m.material.dispose(); delete R.ppool[id]; }
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

  /* ===========================================================================
   * Public: render one frame (called from the game loop when enabled)
   * ========================================================================= */
  function render(s) {
    if (!R.enabled) return;
    if (!R.inited && !init()) return;
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
    gc();
    R.renderer.render(R.scene, R.camera);
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
    return true;
  }
  function disable() {
    R.enabled = false;
    document.body.classList.remove('r3d-on');
    if (R.canvas) R.canvas.style.display = 'none';
    removeCamOverride();
  }

  RTS.Render3D = {
    render: render,
    enable: enable,
    disable: disable,
    setNight: setNight,
    isEnabled: function () { return R.enabled; },
    _state: R,
  };

})(window.RTS = window.RTS || {});
