/* ============================================================================
 * EXOFRONT — map.js
 * Four battlefields with Tiny Swords heightmap terrain (island / plateaus / paths).
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var W = function () { return RTS.Config.world.w; };
  var H = function () { return RTS.Config.world.h; };

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function decorR(kind, rnd) {
    var base = RTS.SizeRef.decorWorldR(kind);
    return base * (0.85 + rnd() * 0.3);
  }

  function decor(seed, count, worldW, worldH, rockRatio) {
    var rnd = mulberry(seed);
    var out = [];
    for (var d = 0; d < count; d++) {
      var kind = rnd() < rockRatio ? 'rock' : 'bush';
      out.push({
        x: 120 + rnd() * (worldW - 240),
        y: 120 + rnd() * (worldH - 240),
        r: decorR(kind, rnd),
        kind: kind,
      });
    }
    return out;
  }

  function clearOfPoints(x, y, spots, minDist) {
    if (!spots || !spots.length) return true;
    for (var i = 0; i < spots.length; i++) {
      if (RTS.dist(x, y, spots[i].x, spots[i].y) < minDist) return false;
    }
    return true;
  }

  function shoreTrees(grid, seed, fillChance) {
    fillChance = fillChance == null ? 0.12 : fillChance;
    var rnd = mulberry(seed);
    var out = [];
    var cols = grid.cols;
    var rows = grid.rows;
    var TILE = RTS.Terrain.TILE;
    var FLAT = RTS.Terrain.FLAT;
    var WATER = RTS.Terrain.WATER;
    var heights = grid.heights;

    function at(cx, cy) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return WATER;
      return heights[cx + cy * cols];
    }

    var cx, cy, nearWater, wx, wy;
    for (cy = 0; cy < rows; cy++) {
      for (cx = 0; cx < cols; cx++) {
        if (at(cx, cy) !== FLAT) continue;
        nearWater = at(cx, cy - 1) === WATER || at(cx + 1, cy) === WATER ||
          at(cx, cy + 1) === WATER || at(cx - 1, cy) === WATER;
        if (!nearWater) continue;
        if (rnd() > fillChance) continue;
        wx = cx * TILE + TILE * (0.15 + rnd() * 0.7);
        wy = cy * TILE + TILE * (0.15 + rnd() * 0.7);
        out.push({
          x: wx,
          y: wy,
          r: RTS.SizeRef.decorWorldR('tree') * (0.8 + rnd() * 0.55),
          kind: 'tree',
        });
      }
    }
    return out;
  }

  function interiorForest(grid, seed, count, avoid, minDist) {
    minDist = minDist == null ? 100 : minDist;
    var rnd = mulberry(seed);
    var out = [];
    var cols = grid.cols;
    var rows = grid.rows;
    var TILE = RTS.Terrain.TILE;
    var FLAT = RTS.Terrain.FLAT;
    var heights = grid.heights;
    var tries = 0;
    var maxTries = count * 14;

    while (out.length < count && tries < maxTries) {
      tries++;
      var cx = 1 + Math.floor(rnd() * (cols - 2));
      var cy = 1 + Math.floor(rnd() * (rows - 2));
      if (heights[cx + cy * cols] !== FLAT) continue;
      var wx = cx * TILE + TILE * (0.1 + rnd() * 0.8);
      var wy = cy * TILE + TILE * (0.1 + rnd() * 0.8);
      if (!clearOfPoints(wx, wy, avoid, minDist)) continue;
      out.push({
        x: wx,
        y: wy,
        r: RTS.SizeRef.decorWorldR('tree') * (0.85 + rnd() * 0.65),
        kind: 'tree',
      });
    }
    return out;
  }

  function scatterRocks(grid, seed, count, avoid, minDist) {
    minDist = minDist == null ? 72 : minDist;
    var rnd = mulberry(seed);
    var out = [];
    var cols = grid.cols;
    var rows = grid.rows;
    var TILE = RTS.Terrain.TILE;
    var FLAT = RTS.Terrain.FLAT;
    var heights = grid.heights;
    var tries = 0;
    var maxTries = count * 12;

    while (out.length < count && tries < maxTries) {
      tries++;
      var cx = 1 + Math.floor(rnd() * (cols - 2));
      var cy = 1 + Math.floor(rnd() * (rows - 2));
      if (heights[cx + cy * cols] !== FLAT) continue;
      var wx = cx * TILE + TILE * (0.2 + rnd() * 0.6);
      var wy = cy * TILE + TILE * (0.2 + rnd() * 0.6);
      if (!clearOfPoints(wx, wy, avoid, minDist)) continue;
      out.push({
        x: wx,
        y: wy,
        r: decorR('rock', rnd),
        kind: 'rock',
      });
    }
    return out;
  }

  function forestFromMapgen(mg, avoid) {
    var rnd = mulberry(mg.treeSeed || 42);
    var out = [];
    var cols = mg.cols, rows = mg.rows, TILE = mg.tile || 64;
    var p = mg.treeDensity != null ? mg.treeDensity : 0.72;
    var i, j, wx, wy;
    for (i = 0; i < rows; i++) {
      for (j = 0; j < cols; j++) {
        if (!mg.forest[i * cols + j]) continue;
        if (rnd() > p) continue;
        wx = j * TILE + 32 + Math.floor(rnd() * 33) - 16;
        wy = (i + 1) * TILE + Math.floor(rnd() * 25) - 12;
        if (!clearOfPoints(wx, wy, avoid, 72)) continue;
        out.push({
          x: wx,
          y: wy,
          r: RTS.SizeRef.decorWorldR('tree') * (0.85 + rnd() * 0.55),
          kind: 'tree',
        });
      }
    }
    return out;
  }

  function rocksFromList(spots, avoid) {
    var out = [];
    var rnd = mulberry(9105);
    spots.forEach(function (spot) {
      var dx, dy, k;
      for (k = 0; k < 4; k++) {
        dx = [-40, 20, 10, -15][k];
        dy = [0, -20, 30, -35][k];
        out.push({
          x: spot.x + dx + Math.floor(rnd() * 9) - 4,
          y: spot.y + dy + Math.floor(rnd() * 9) - 4,
          r: decorR('rock', rnd),
          kind: 'rock',
        });
      }
    });
    return out;
  }

  function finishMap(s, meta) {
    meta.w = meta.w || W();
    meta.h = meta.h || H();
    if (meta.terrainDef && RTS.Terrain) {
      meta.terrainGrid = RTS.Terrain.buildGrid(meta.w, meta.h, meta.terrainDef);
      var avoid = meta.avoidDecor || [];
      if (meta.mapgenForest && RTS.SapphireMapgen) {
        meta.decor = (meta.decor || []).concat(forestFromMapgen(RTS.SapphireMapgen, avoid));
      } else {
        if (meta.shoreSeed != null) {
          meta.decor = (meta.decor || []).concat(
            shoreTrees(meta.terrainGrid, meta.shoreSeed, meta.shoreFill));
        }
        if (meta.forestSeed != null) {
          meta.decor = (meta.decor || []).concat(
            interiorForest(meta.terrainGrid, meta.forestSeed, meta.forestCount || 90, avoid));
        }
      }
      if (meta.mapgenRocks && RTS.SapphireMapgen && RTS.SapphireMapgen.rocks) {
        meta.decor = (meta.decor || []).concat(rocksFromList(RTS.SapphireMapgen.rocks, avoid));
      } else if (meta.rockSeed != null) {
        meta.decor = (meta.decor || []).concat(
          scatterRocks(meta.terrainGrid, meta.rockSeed, meta.rockCount || 55, avoid));
      }
    }
    s.map = meta;
    RTS.recalcSupply(s, RTS.TEAM.PLAYER);
    RTS.recalcSupply(s, RTS.TEAM.ENEMY);
  }

  function mine(s, x, y, amount) {
    RTS.makeResource(s, x, y, amount);
  }

  function spawnBase(s, team, cx, cy, faction, isEnemy, opts) {
    opts = opts || {};
    var core = RTS.makeBuilding(s, 'core', team, cx, cy, faction, true);
    var rallyDx = opts.rallyDx != null ? opts.rallyDx : (isEnemy ? -130 : 130);
    var rallyDy = opts.rallyDy != null ? opts.rallyDy : (isEnemy ? 40 : -40);
    core.rally = { x: cx + rallyDx, y: cy + rallyDy };
    if (!isEnemy) core.autoMine = true;
    if (opts.foundry) RTS.makeBuilding(s, 'foundry', team, opts.foundry.x, opts.foundry.y, faction, true);
    if (opts.forge) RTS.makeBuilding(s, 'forge', team, opts.forge.x, opts.forge.y, faction, true);
    var workers = opts.workers != null ? opts.workers : 0;
    for (var i = 0; i < workers; i++) {
      var ox = isEnemy ? -70 - i * 26 : 70 + i * 26;
      RTS.makeUnit(s, 'worker', team, cx + ox, cy + (isEnemy ? 64 : 64), faction);
    }
  }

  /* ---- 1. Sapphire Shores — from tools/mapgen (import-mapgen.py) ---------- */
  function buildSapphireShores(s) {
    var mg = RTS.SapphireMapgen;
    if (!mg) {
      console.error('SapphireMapgen data missing — run scripts/import-mapgen.py');
      return;
    }
    var pf = s.playerFaction, ef = s.enemyFaction;
    var px = mg.playerBase.x, py = mg.playerBase.y;
    var ex = mg.enemyBase.x, ey = mg.enemyBase.y;

    spawnBase(s, RTS.TEAM.PLAYER, px, py, pf, false, { rallyDx: 130, rallyDy: 90 });
    spawnBase(s, RTS.TEAM.ENEMY, ex, ey, ef, true, { rallyDx: -130, rallyDy: 90 });

    mg.gold.forEach(function (g) { mine(s, g.x, g.y, g.amount); });

    var decorAvoid = [{ x: px, y: py }, { x: ex, y: ey }];
    mg.gold.forEach(function (g) { decorAvoid.push({ x: g.x, y: g.y }); });

    finishMap(s, {
      id: 'sapphire_shores',
      name: 'Sapphire Shores',
      theme: 'grass',
      w: mg.world.w,
      h: mg.world.h,
      decor: [],
      avoidDecor: decorAvoid,
      mapgenForest: true,
      mapgenRocks: true,
      terrainDef: {
        theme: 'grass',
        tileset: 'color1',
        terrainMask: { cols: mg.cols, rows: mg.rows, heights: mg.heights },
      },
      intro: 'Sapphire Shores — forested isles linked by a shallow lane',
      win: 'The enemy Castle crumbles. The archipelago is yours.',
      lose: 'Your line broke against the tide. The shores fall.',
    });
  }

  /* ---- 2. Ember Divide — east vs west, volcanic channel ------------------ */
  function buildEmberDivide(s) {
    var w = W(), h = H();
    var pf = s.playerFaction, ef = s.enemyFaction;
    var midY = h * 0.5;

    spawnBase(s, RTS.TEAM.PLAYER, 280, midY, pf, false, { rallyDx: 120, rallyDy: 0 });
    spawnBase(s, RTS.TEAM.ENEMY, w - 280, midY, ef, true, { rallyDx: -120, rallyDy: 0 });

    mine(s, 400, midY - 220, 2800);
    mine(s, 400, midY + 220, 2800);
    mine(s, w - 400, midY - 220, 2800);
    mine(s, w - 400, midY + 220, 2800);
    mine(s, 360, midY - 380, 2600);
    mine(s, 360, midY + 380, 2500);
    mine(s, w - 360, midY - 380, 2600);
    mine(s, w - 360, midY + 380, 2500);
    mine(s, 980, midY - 150, 3000);
    mine(s, 1100, midY + 130, 2900);
    mine(s, 1500, midY - 110, 2900);
    mine(s, 1620, midY + 160, 2800);
    mine(s, 1280, midY - 300, 2700);
    mine(s, 1320, midY + 310, 2700);
    mine(s, 1180, midY, 2600);

    finishMap(s, {
      id: 'ember_divide',
      name: 'Ember Divide',
      theme: 'volcanic',
      decor: decor(8821, 38, w, h, 0.75),
      shoreSeed: 8822,
      terrainDef: {
        theme: 'volcanic',
        tileset: 'color3',
        island: { x: 64, y: 320, w: w - 128, h: h - 640 },
      },
      intro: 'Ember Divide — cross the molten channel before they fortify',
      win: 'The eastern furnaces go dark. The divide is sealed.',
      lose: 'The divide swallowed your army. Retreat is all that remains.',
    });
  }

  /* ---- 3. Highland Crossing — north vs south, meadow terraces -------------- */
  function buildHighlandCrossing(s) {
    var w = W(), h = H();
    var pf = s.playerFaction, ef = s.enemyFaction;
    var midX = w * 0.5;
    var py = h - 280, ey = 280;

    spawnBase(s, RTS.TEAM.PLAYER, midX, py, pf, false, { rallyDx: 0, rallyDy: -120 });
    spawnBase(s, RTS.TEAM.ENEMY, midX, ey, ef, true, { rallyDx: 0, rallyDy: 120 });

    mine(s, midX - 220, py - 190, 2800);
    mine(s, midX + 220, py - 190, 2800);
    mine(s, midX - 220, ey + 190, 2800);
    mine(s, midX + 220, ey + 190, 2800);
    mine(s, midX - 380, py - 320, 2700);
    mine(s, midX + 380, py - 320, 2700);
    mine(s, midX - 380, ey + 320, 2700);
    mine(s, midX + 380, ey + 320, 2700);
    mine(s, w * 0.24, h * 0.44, 2900);
    mine(s, w * 0.24, h * 0.56, 2800);
    mine(s, w * 0.76, h * 0.44, 2900);
    mine(s, w * 0.76, h * 0.56, 2800);
    mine(s, midX - 180, h * 0.5, 3000);
    mine(s, midX + 180, h * 0.5, 3000);
    mine(s, midX, h * 0.42, 2700);
    mine(s, midX, h * 0.58, 2700);

    finishMap(s, {
      id: 'highland_crossing',
      name: 'Highland Crossing',
      theme: 'meadow',
      decor: decor(12007, 36, w, h, 0.35),
      shoreSeed: 12008,
      terrainDef: {
        theme: 'meadow',
        tileset: 'color2',
        island: { x: 320, y: 72, w: w - 640, h: h - 144 },
      },
      intro: 'Highland Crossing — control the crossing or lose the war',
      win: 'The highlands bow to your banner. The crossing is secure.',
      lose: 'Your Castle fell to the frost wind. The crossing is lost.',
    });
  }

  /* ---- 4. Crown Isthmus — NW vs SE, narrow waist, amber tileset ---------- */
  function buildCrownIsthmus(s) {
    var w = W(), h = H();
    var pf = s.playerFaction, ef = s.enemyFaction;
    var px = 320, py = 320;
    var ex = w - 320, ey = h - 320;

    spawnBase(s, RTS.TEAM.PLAYER, px, py, pf, false, { rallyDx: 110, rallyDy: 110 });
    spawnBase(s, RTS.TEAM.ENEMY, ex, ey, ef, true, { rallyDx: -110, rallyDy: -110 });

    mine(s, px + 60, py - 140, 2800);
    mine(s, px - 140, py + 60, 2600);
    mine(s, px + 200, py + 200, 2700);
    mine(s, ex - 60, ey + 140, 2800);
    mine(s, ex + 140, ey - 60, 2600);
    mine(s, ex - 200, ey - 200, 2700);
    mine(s, w * 0.5, h * 0.5 - 80, 3100);
    mine(s, w * 0.5, h * 0.5 + 80, 3000);
    mine(s, w * 0.5 - 200, h * 0.5, 2900);
    mine(s, w * 0.5 + 200, h * 0.5, 2900);
    mine(s, w * 0.38, h * 0.38, 2800);
    mine(s, w * 0.62, h * 0.62, 2800);
    mine(s, w * 0.35, h * 0.65, 2600);
    mine(s, w * 0.65, h * 0.35, 2600);
    mine(s, w * 0.5, h * 0.32, 2700);
    mine(s, w * 0.5, h * 0.68, 2700);

    finishMap(s, {
      id: 'crown_isthmus',
      name: 'Crown Isthmus',
      theme: 'amber',
      decor: decor(55103, 34, w, h, 0.5),
      shoreSeed: 55104,
      terrainDef: {
        theme: 'amber',
        tileset: 'color4',
        island: { x: 80, y: 80, w: w - 160, h: h - 160 },
        waterRects: [
          { x: 0, y: 480, w: 780, h: 840 },
          { x: 1820, y: 480, w: 780, h: 840 },
        ],
      },
      intro: 'Crown Isthmus — punch through the waist or be flanked',
      win: 'The isthmus is yours. The crown tips in your favor.',
      lose: 'Choked on the narrow front, your Castle fell.',
    });
  }

  RTS.Maps = {
    sapphire_shores: {
      id: 'sapphire_shores',
      name: 'Sapphire Shores',
      tagline: 'Grass · Island archipelago',
      blurb: 'Forested isles with a shallow central lane — bases at the north shores.',
      build: buildSapphireShores,
    },
    ember_divide: {
      id: 'ember_divide',
      name: 'Ember Divide',
      tagline: 'East vs west over volcanic shallows',
      blurb: 'Horizontal land bridge with lava seas north and south. Fight for the winding center nodes.',
      build: buildEmberDivide,
    },
    highland_crossing: {
      id: 'highland_crossing',
      name: 'Highland Crossing',
      tagline: 'North vs south meadow terraces',
      blurb: 'Vertical front with wide side terraces. Secure the flanks to fund the push through the pass.',
      build: buildHighlandCrossing,
    },
    crown_isthmus: {
      id: 'crown_isthmus',
      name: 'Crown Isthmus',
      tagline: 'NW vs SE through a narrow waist',
      blurb: 'Twin elevated corners joined by a tight isthmus. Contested gold sits in the choke.',
      build: buildCrownIsthmus,
    },
  };

  /* Visible in map select — other maps kept in RTS.Maps but archived */
  RTS.MapList = ['sapphire_shores'];

  RTS.buildMap = function (s, mapId) {
    mapId = mapId || s.mapId || 'sapphire_shores';
    if (RTS.MapList.indexOf(mapId) < 0) mapId = 'sapphire_shores';
    var def = RTS.Maps[mapId] || RTS.Maps.sapphire_shores;
    s.mapId = def.id;
    def.build(s);
  };

})(window.RTS = window.RTS || {});
