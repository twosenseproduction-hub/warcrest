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

  /* ---- buildings --------------------------------------------------------- */
  function crownKeep() {
    var g = new THREE.Group();
    g.add(box(5, 4, 5, P.stone, 0, 2, 0)); g.add(box(6, 0.9, 6, P.stoneD, 0, 4.2, 0));
    [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]].forEach(function (p) {
      var t = cyl(0.8, 0.9, 5.6, 7, P.stone); t.position.set(p[0], 2.8, p[1]); g.add(t);
      var r = cone(1.1, 1.5, 7, P.crownRoof); r.position.set(p[0], 5.9, p[1]); g.add(r);
    });
    g.add(box(1.4, 2, 0.3, P.woodD, 0, 1, 2.55));
    return g;
  }
  function hordeHut() {
    var g = new THREE.Group();
    g.add(box(7, 2.4, 5.4, P.wood, 0, 1.2, 0)); g.add(box(7.2, 0.5, 5.6, P.woodD, 0, 2.5, 0));
    var roof = cone(5.2, 2.6, 4, P.thatch); roof.rotation.y = Math.PI / 4; roof.position.y = 3.8; roof.scale.set(1, 1, 0.78); g.add(roof);
    [[-3, -2.2], [3, -2.2], [-3, 2.2], [3, 2.2]].forEach(function (p) { var s = cone(0.45, 1.8, 6, P.bone); s.position.set(p[0], 2.6, p[1]); g.add(s); });
    var sk = sphere(0.7, P.bone); sk.position.set(0, 3.0, 2.7); g.add(sk);
    g.add(box(1.6, 2, 0.3, P.dark, 0, 1, 2.75));
    return g;
  }
  function elfHall() {
    var g = new THREE.Group();
    var trunk = cyl(1.2, 1.6, 5, 7, P.bark); trunk.position.y = 2.5; g.add(trunk);
    g.add(box(3.4, 1.8, 3.4, P.wood, 0, 4.3, 0)); g.add(box(3.7, 0.3, 3.7, P.gold, 0, 5.3, 0));
    g.add(box(0.9, 1.2, 0.2, P.gold, 0, 4.0, 1.75));
    var c1 = cone(3.4, 3.2, 7, P.leaf); c1.position.y = 7.2; g.add(c1);
    var c2 = cone(2.6, 2.6, 7, P.leaf2); c2.position.set(1.6, 6.4, 0.6); g.add(c2);
    var c3 = cone(2.4, 2.4, 7, P.leaf2); c3.position.set(-1.5, 6.2, -0.8); g.add(c3);
    return g;
  }
  // generic smaller structure (barracks/forge/tower/etc.) tinted by race
  function genericBuilding(race, type) {
    var g = new THREE.Group();
    var wallMat = race === 'horde' ? P.wood : race === 'elf' ? P.elfTunic : P.stone;
    var roofMat = race === 'horde' ? P.thatch : race === 'elf' ? P.leaf : P.crownRoof;
    var tower = /turret|tower|conduit/.test(type || '');
    if (tower) {
      g.add(cyl(1.4, 1.7, 5, 8, wallMat).translateY(2.5));
      var top = box(3.2, 1, 3.2, P.stoneD, 0, 5.1, 0); g.add(top);
      var spire = cone(1.6, 2.2, 8, roofMat); spire.position.y = 6.4; g.add(spire);
    } else {
      g.add(box(4.4, 2.6, 4, wallMat, 0, 1.3, 0));
      var roof = cone(3.6, 2, 4, roofMat); roof.rotation.y = Math.PI / 4; roof.position.y = 3.6; g.add(roof);
      g.add(box(1.2, 1.6, 0.3, P.woodD, 0, 0.8, 2.05));
    }
    return g;
  }
  function makeBuildingMesh(b) {
    var race = raceOf(b.faction);
    var t = b.type || '';
    var g;
    if (/core|keep|castle|hall|townhall|citadel|core/.test(t)) {
      g = race === 'horde' ? hordeHut() : race === 'elf' ? elfHall() : crownKeep();
    } else {
      g = genericBuilding(race, t);
    }
    g.traverse(function (o) { o.castShadow = true; o.receiveShadow = true; });
    fitWidth(g, (b.w || 128) * 0.92);
    return g;
  }

  /* ---- units ------------------------------------------------------------- */
  function knight(tint) {
    var g = new THREE.Group(); var body = tint || P.blue;
    var lL = box(0.32, 1, 0.32, P.steel, -0.22, 0.5, 0), lR = box(0.32, 1, 0.32, P.steel, 0.22, 0.5, 0); g.add(lL, lR);
    g.add(box(0.95, 1.1, 0.6, body, 0, 1.55, 0)); g.add(box(1.05, 0.28, 0.7, P.crownTrim, 0, 2.05, 0));
    g.add(box(0.6, 0.6, 0.58, P.skin, 0, 2.42, 0)); g.add(box(0.66, 0.34, 0.64, P.steel, 0, 2.66, 0));
    var sw = box(0.12, 1.7, 0.12, P.steel, 0.62, 1.9, 0.2); sw.rotation.z = 0.28; g.add(sw);
    g.add(box(0.1, 0.9, 0.7, body, -0.6, 1.6, 0.1));
    g.userData = { lL: lL, lR: lR }; g.scale.setScalar(0.62); return g;
  }
  function orcBrute(tint) {
    var g = new THREE.Group();
    var lL = box(0.42, 0.8, 0.42, P.orcArmor, -0.28, 0.4, 0), lR = box(0.42, 0.8, 0.42, P.orcArmor, 0.28, 0.4, 0); g.add(lL, lR);
    var torso = box(1.4, 1.1, 0.85, tint || P.orcSkin, 0, 1.35, 0); torso.rotation.x = 0.18; g.add(torso);
    g.add(box(1.7, 0.4, 1.0, P.bone, 0, 1.85, 0.06));
    g.add(box(0.7, 0.62, 0.66, tint || P.orcSkin, 0, 2.2, 0.16));
    g.add(box(0.12, 0.18, 0.12, P.white, -0.16, 2.05, 0.5)); g.add(box(0.12, 0.18, 0.12, P.white, 0.16, 2.05, 0.5));
    var ax = new THREE.Group(); ax.add(cyl(0.1, 0.1, 2.0, 6, P.wood)); ax.add(box(0.18, 0.7, 0.9, P.steel, 0, 0.8, 0.3));
    ax.position.set(0.75, 1.4, 0.1); ax.rotation.z = 0.5; g.add(ax);
    g.userData = { lL: lL, lR: lR }; g.scale.setScalar(0.66); return g;
  }
  function elfUnit(tint, ranged) {
    var g = new THREE.Group(); var body = tint || P.elfTunic;
    var lL = box(0.26, 1.0, 0.26, body, -0.18, 0.5, 0), lR = box(0.26, 1.0, 0.26, body, 0.18, 0.5, 0); g.add(lL, lR);
    g.add(box(0.72, 1.15, 0.45, body, 0, 1.55, 0)); g.add(box(0.8, 0.22, 0.5, P.gold, 0, 1.95, 0));
    g.add(box(0.54, 0.58, 0.52, P.skin, 0, 2.32, 0));
    var hood = cone(0.5, 0.7, 6, P.leaf); hood.position.y = 2.75; g.add(hood);
    if (ranged) {
      var bow = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 5, 10, Math.PI), P.gold);
      bow.position.set(-0.5, 1.6, 0.2); bow.rotation.z = Math.PI / 2; g.add(bow);
    } else {
      var sp = box(0.1, 1.9, 0.1, P.wood, 0.5, 1.7, 0.15); g.add(sp);
    }
    g.userData = { lL: lL, lR: lR }; g.scale.setScalar(0.6); return g;
  }
  // worker — small, tool, race-tinted
  function worker(race) {
    var g = new THREE.Group();
    var c = race === 'horde' ? P.orcSkin : race === 'elf' ? P.elfTunic : P.skin;
    var cloth = race === 'horde' ? P.woodD : race === 'elf' ? P.leaf2 : P.ember;
    var lL = box(0.24, 0.7, 0.24, P.woodD, -0.15, 0.35, 0), lR = box(0.24, 0.7, 0.24, P.woodD, 0.15, 0.35, 0); g.add(lL, lR);
    g.add(box(0.6, 0.8, 0.4, cloth, 0, 1.1, 0));
    g.add(box(0.42, 0.42, 0.4, c, 0, 1.7, 0));
    var tool = box(0.08, 1.0, 0.08, P.wood, 0.4, 1.3, 0.1); tool.rotation.z = 0.3; g.add(tool);
    g.userData = { lL: lL, lR: lR }; g.scale.setScalar(0.58); return g;
  }
  function makeUnitMesh(u) {
    var race = raceOf(u.faction);
    var role = u.role || 'warrior';
    var enemyTint = u.team === (RTS.TEAM && RTS.TEAM.ENEMY) ? P.enemyTint : null;
    var g;
    if (role === 'pawn' || role === 'worker') g = worker(race);
    else if (race === 'horde') g = orcBrute(enemyTint || P.orcSkin);
    else if (race === 'elf') g = elfUnit(enemyTint, role === 'archer');
    else g = knight(enemyTint);
    var hero = u.heroId || role === 'hero';
    if (hero) { var crown = cone(0.34, 0.5, 6, P.gold); crown.position.y = 3.0; g.add(crown); }
    g.traverse(function (o) { o.castShadow = true; });
    // normalize to world-pixel height: rank-and-file ~40px, heroes taller
    fitHeight(g, hero ? 62 : (role === 'pawn' || role === 'worker') ? 34 : 42);
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
  function init() {
    if (R.inited) return true;
    THREE = window.THREE;
    if (!THREE) return false;
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
    R.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    R.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.renderer.shadowMap.enabled = true; R.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputEncoding' in R.renderer && THREE.sRGBEncoding) R.renderer.outputEncoding = THREE.sRGBEncoding;
    R.scene = new THREE.Scene();
    R.scene.background = new THREE.Color(0xbfd8e6);
    R.scene.fog = new THREE.Fog(0xc8dcc6, 1400, 3600);
    R.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 8, 9000);
    R.amb = new THREE.AmbientLight(0xffffff, 0.46); R.scene.add(R.amb);
    R.hemi = new THREE.HemisphereLight(0xe8ecdf, 0x46502f, 0.22); R.scene.add(R.hemi);
    R.sun = new THREE.DirectionalLight(0xfff0d0, 1.25);
    R.sun.castShadow = true; R.sun.shadow.mapSize.set(2048, 2048);
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
  var PITCH = 0.92;          // radians above horizon (lower = more oblique)
  function viewCenter(s) {
    var c = s.camera, vw = window.innerWidth, vh = window.innerHeight;
    return { x: c.x + (vw / c.zoom) / 2, z: c.y + (vh / c.zoom) / 2, span: vh / c.zoom };
  }
  function placeCamera(s) {
    var v = viewCenter(s);
    var dist = v.span * 0.6 / Math.tan(R.camera.fov * Math.PI / 360);
    var tgtY = 20;
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
        // simple walk bob when moving
        var moving = e.moveTo || (Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 4);
        if (o.userData && o.userData.lL) {
          var sw = moving ? Math.sin((RTS._renderT || 0) * 9 + (e._idlePhase || 0) * 6) * 0.5 : 0;
          o.userData.lL.rotation.x = sw; o.userData.lR.rotation.x = -sw;
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
  var selGroup = null;
  function drawSelection(s) {
    if (!selGroup) { selGroup = new THREE.Group(); R.scene.add(selGroup); }
    while (selGroup.children.length) { var c = selGroup.children.pop(); if (c.geometry) c.geometry.dispose(); }
    var ids = s.selectedIds || [];
    ids.forEach(function (id) {
      var slot = R.pool[id]; if (!slot) return;
      var u = slot.obj;
      var r = 26;
      var ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 22), new THREE.MeshBasicMaterial({ color: 0x7ff0a0, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(u.position.x, u.position.y + 1.5, u.position.z);
      selGroup.add(ring);
    });
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
