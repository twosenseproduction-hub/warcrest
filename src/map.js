/* ============================================================================
 * EXOFRONT — map.js
 * Four battlefields with Tiny Swords heightmap terrain (island / plateaus / paths).
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var W = function () { return RTS.Config.world.w; };
  var H = function () { return RTS.Config.world.h; };

  function dist(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function mineAmount(isStarting) {
    var C = RTS.Config.mineAmounts;
    return isStarting ? C.starting : C.expansion;
  }

  function isStartingMine(x, y, bases) {
    var R = RTS.Config.mineAmounts.startRadius;
    for (var i = 0; i < bases.length; i++) {
      if (dist(x, y, bases[i].x, bases[i].y) <= R) return true;
    }
    return false;
  }

  function isHomeGoldOnMap(mg, g) {
    var minP = Infinity, minE = Infinity, homeP = null, homeE = null;
    mg.gold.forEach(function (o) {
      var pd = dist(o.x, o.y, mg.playerBase.x, mg.playerBase.y);
      var ed = dist(o.x, o.y, mg.enemyBase.x, mg.enemyBase.y);
      if (pd < minP) { minP = pd; homeP = o; }
      if (ed < minE) { minE = ed; homeE = o; }
    });
    return g === homeP || g === homeE;
  }

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function decorR(kind, rnd, spriteIdx) {
    var base = RTS.SizeRef.decorWorldR(kind, spriteIdx);
    return base * (0.88 + rnd() * 0.24);
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

  function decorTreeSpriteIdx(x, y) {
    var h = ((x | 0) * 73856093 ^ (y | 0) * 19349663) >>> 0;
    return h % 3;
  }

  function coniferJitterXY(col, row, TILE, rnd) {
    var jx, jy, x, y, tries = 0;
    do {
      jx = Math.floor(rnd() * 17) - 8;
      jy = Math.floor(rnd() * 17) - 8;
      x = col * TILE + TILE * 0.5 + jx;
      y = (row + 1) * TILE - 8 + jy;
      tries++;
    } while (tries < 48 && decorTreeSpriteIdx(x, y) === 0);
    return { x: x, y: y };
  }

  function symCol(cols, col) {
    return col < cols / 2 ? col : cols - 1 - col;
  }

  function symRnd(row, col, cols, seed) {
    var h = ((row * 7919 + symCol(cols, col) * 104729 + seed) >>> 0);
    return (h % 10000) / 10000;
  }

  function coastalDist(grid) {
    var cols = grid.cols, rows = grid.rows;
    var FLAT = RTS.Terrain.FLAT, WATER = RTS.Terrain.WATER;
    var heights = grid.heights;
    var d = new Int8Array(cols * rows);
    var i, cx, cy, di, ni, n, e, s, w;
    for (i = 0; i < d.length; i++) d[i] = 99;
    for (cy = 0; cy < rows; cy++) {
      for (cx = 0; cx < cols; cx++) {
        if (heights[cx + cy * cols] !== FLAT) continue;
        n = cy > 0 && heights[cx + (cy - 1) * cols] === WATER;
        e = cx < cols - 1 && heights[cx + 1 + cy * cols] === WATER;
        s = cy < rows - 1 && heights[cx + (cy + 1) * cols] === WATER;
        w = cx > 0 && heights[cx - 1 + cy * cols] === WATER;
        if (n || e || s || w) d[cx + cy * cols] = 1;
      }
    }
    for (di = 0; di < 2; di++) {
      for (cy = 0; cy < rows; cy++) {
        for (cx = 0; cx < cols; cx++) {
          ni = cx + cy * cols;
          if (d[ni] !== 99) continue;
          if (heights[ni] !== FLAT) continue;
          n = cy > 0 && d[cx + (cy - 1) * cols] === 1;
          e = cx < cols - 1 && d[cx + 1 + cy * cols] === 1;
          s = cy < rows - 1 && d[cx + (cy + 1) * cols] === 1;
          w = cx > 0 && d[cx - 1 + cy * cols] === 1;
          if (n || e || s || w) d[ni] = 2;
        }
      }
    }
    return d;
  }

  function nearWorldPoint(wx, wy, spots, tileRadius) {
    if (!spots || !spots.length) return false;
    var TILE = RTS.Terrain.TILE;
    var r = (tileRadius != null ? tileRadius : 5) * TILE;
    for (var i = 0; i < spots.length; i++) {
      if (RTS.dist(wx, wy, spots[i].x, spots[i].y) < r) return true;
    }
    return false;
  }

  function coastalRingTrees(grid, seed, avoid) {
    var cols = grid.cols, rows = grid.rows;
    var TILE = RTS.Terrain.TILE;
    var FLAT = RTS.Terrain.FLAT;
    var heights = grid.heights;
    var tz = RTS.TerraformZones;
    var dist = coastalDist(grid);
    var out = [];
    var cx, cy, cd, chance, wx, wy, r;

    for (cy = 0; cy < rows; cy++) {
      for (cx = 0; cx < cols; cx++) {
        if (heights[cx + cy * cols] !== FLAT) continue;
        if (tz && tz.isForestWallTile(cy, cx)) continue;
        if (tz && tz.isAdjacentToCorridor(cy, cx)) continue;
        cd = dist[cx + cy * cols];
        if (cd === 1) chance = 0.9;
        else if (cd === 2) chance = 0.55;
        else continue;
        r = symRnd(cy, cx, cols, seed || 4207);
        if (r > chance) continue;
        wx = cx * TILE + TILE * (0.15 + symRnd(cy, cx, cols, (seed || 4207) + 17) * 0.7);
        wy = cy * TILE + TILE * (0.15 + symRnd(cy, cx, cols, (seed || 4207) + 31) * 0.7);
        if (tz && tz.decorOnCorridor(wx, wy, TILE)) continue;
        if (nearWorldPoint(wx, wy, avoid, 5)) continue;
        out.push({
          x: wx,
          y: wy,
          r: RTS.SizeRef.decorWorldR('tree') * (0.8 + symRnd(cy, cx, cols, (seed || 4207) + 53) * 0.55),
          kind: 'tree',
        });
      }
    }
    return out;
  }

  function shoreTrees(grid, seed, fillChance) {
    return coastalRingTrees(grid, seed, null);
  }

  function waterDeepRocks(grid, seed, avoid) {
    var cols = grid.cols, rows = grid.rows;
    var TILE = RTS.Terrain.TILE;
    var WATER = RTS.Terrain.WATER;
    var heights = grid.heights;
    var dist = new Int8Array(cols * rows);
    var i, cx, cy, qi, qj, nr, nc, ni, key, seen, queue, dirs;
    for (i = 0; i < dist.length; i++) dist[i] = -1;
    queue = [];
    for (cy = 0; cy < rows; cy++) {
      for (cx = 0; cx < cols; cx++) {
        if (heights[cx + cy * cols] !== WATER) continue;
        dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        for (qi = 0; qi < 4; qi++) {
          nr = cy + dirs[qi][0]; nc = cx + dirs[qi][1];
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          if (heights[nc + nr * cols] >= RTS.Terrain.FLAT) {
            ni = cx + cy * cols;
            if (dist[ni] < 0) { dist[ni] = 0; queue.push([cx, cy]); }
            break;
          }
        }
      }
    }
    seen = {};
    while (queue.length) {
      var cur = queue.shift();
      cx = cur[0]; cy = cur[1];
      ni = cx + cy * cols;
      for (qi = 0; qi < 4; qi++) {
        nr = cy + [[0, -1], [1, 0], [0, 1], [-1, 0]][qi][0];
        nc = cx + [[0, -1], [1, 0], [0, 1], [-1, 0]][qi][1];
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        key = nc + ',' + nr;
        if (seen[key]) continue;
        if (heights[nc + nr * cols] !== WATER) continue;
        seen[key] = true;
        dist[nc + nr * cols] = dist[ni] + 1;
        queue.push([nc, nr]);
      }
    }
    var out = [];
    var rnd = mulberry(seed || 9105);
    for (cy = 0; cy < rows; cy++) {
      for (cx = 0; cx < cols; cx++) {
        ni = cx + cy * cols;
        if (heights[ni] !== WATER) continue;
        if (dist[ni] < 1) continue;
        if (symRnd(cy, cx, cols, seed || 9105) > 0.08) continue;
        var wx = cx * TILE + TILE * (0.2 + symRnd(cy, cx, cols, (seed || 9105) + 7) * 0.6);
        var wy = cy * TILE + TILE * (0.2 + symRnd(cy, cx, cols, (seed || 9105) + 11) * 0.6);
        if (!clearOfPoints(wx, wy, avoid, 48)) continue;
        out.push({ x: wx, y: wy, r: decorR('rock', rnd), kind: 'rock' });
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
    var tz = RTS.TerraformZones;
    var i, j, wx, wy;
    for (i = 0; i < rows; i++) {
      for (j = 0; j < cols; j++) {
        if (!mg.forest[i * cols + j]) continue;
        if (tz && (tz.isCorridorTile(i, j) || tz.isForestWallTile(i, j))) continue;
        if (rnd() > p) continue;
        wx = j * TILE + 32 + Math.floor(rnd() * 33) - 16;
        wy = (i + 1) * TILE + Math.floor(rnd() * 25) - 12;
        if (tz && tz.decorOnCorridor(wx, wy, TILE)) continue;
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

  function forestWallTrees(grid, seed) {
    var tz = RTS.TerraformZones;
    if (!grid || !grid.forestWall) return [];
    seed = seed || 8801;
    var out = [];
    var cols = grid.cols, rows = grid.rows, TILE = RTS.Terrain.TILE;
    var baseR = RTS.SizeRef.decorWorldR('tree', 0);
    var row, col, sc, jx, jy, x, y;
    for (row = 0; row < rows; row++) {
      for (col = 0; col < cols; col++) {
        if (!grid.forestWall[col + row * cols]) continue;
        sc = symCol(cols, col);
        jx = Math.floor(symRnd(row, sc, cols, seed) * 17) - 8;
        jy = Math.floor(symRnd(row, sc, cols, seed + 11) * 17) - 8;
        x = col * TILE + TILE * 0.5 + jx;
        y = (row + 1) * TILE - 8 + jy;
        out.push({
          x: x,
          y: y,
          r: baseR * (0.95 + symRnd(row, sc, cols, seed + 23) * 0.2),
          kind: 'tree',
          forestWall: true,
          tileRow: row,
          tileCol: col,
        });
      }
    }
    return out;
  }

  function rocksFromList(spots, avoid) {
    var out = [];
    var rnd = mulberry(9105);
    var tz = RTS.TerraformZones;
    spots.forEach(function (spot) {
      var dx, dy, k, x, y;
      for (k = 0; k < 4; k++) {
        dx = [-40, 20, 10, -15][k];
        dy = [0, -20, 30, -35][k];
        x = spot.x + dx + Math.floor(rnd() * 9) - 4;
        y = spot.y + dy + Math.floor(rnd() * 9) - 4;
        if (tz && tz.decorOnCorridor(x, y)) continue;
        out.push({
          x: x,
          y: y,
          r: decorR('rock', rnd),
          kind: 'rock',
        });
      }
    });
    return out;
  }

  function initPathGrid(meta) {
    var TILE = RTS.TILE || 64;
    var cols = Math.ceil((meta.w || W()) / TILE);
    var rows = Math.ceil((meta.h || H()) / TILE);
    var terrain = meta.terrainGrid;
    var grid = [];
    var r, c, wx, wy;
    for (r = 0; r < rows; r++) {
      grid[r] = [];
      for (c = 0; c < cols; c++) {
        wx = c * TILE + TILE / 2;
        wy = r * TILE + TILE / 2;
        var isWater = RTS.Terrain && RTS.Terrain.isWater(terrain, wx, wy);
        grid[r][c] = isWater ? 1 : 0;
      }
    }
    meta.pathGrid = grid;
    meta.pathGridCols = cols;
    meta.pathGridRows = rows;
    return grid;
  }

  /* Mark tree trunk footprints as impassable on the path grid.
   * Uses 55% of the visual radius as the blocking circle — tight enough
   * that units can squeeze along forest edges but can't path through a trunk.
   * forestWall trees are skipped; their cells are already blocked by terrain. */
  function markTreesOnPathGrid(meta) {
    if (!meta.pathGrid || !meta.decor || !meta.decor.length) return;
    var TILE = RTS.TILE || 64;
    var cols = meta.pathGridCols;
    var rows = meta.pathGridRows;
    var grid = meta.pathGrid;
    var BLOCK_RATIO = 0.55;

    meta.decor.forEach(function (d) {
      if (d.kind !== 'tree') return;
      if (d.forestWall) return; // terrain mask already covers these
      var blockR = d.r * BLOCK_RATIO;
      // Clamp search to the bounding box of the blocking circle
      var cMinC = Math.max(0, Math.floor((d.x - blockR) / TILE));
      var cMaxC = Math.min(cols - 1, Math.floor((d.x + blockR) / TILE));
      var cMinR = Math.max(0, Math.floor((d.y - blockR) / TILE));
      var cMaxR = Math.min(rows - 1, Math.floor((d.y + blockR) / TILE));
      var r, c, cx, cy;
      for (r = cMinR; r <= cMaxR; r++) {
        for (c = cMinC; c <= cMaxC; c++) {
          cx = c * TILE + TILE * 0.5;
          cy = r * TILE + TILE * 0.5;
          if (dist(cx, cy, d.x, d.y) < blockR) {
            grid[r][c] = 1;
          }
        }
      }
    });
  }

  function syncMapBuildingFootprints(s) {
    if (!s.map || !s.map.pathGrid) return;
    s.entities.buildings.forEach(function (b) {
      if (b.dead) return;
      RTS.markBuildingFootprint(s, b, true);
    });
  }

  function finishMap(s, meta) {
    meta.w = meta.w || W();
    meta.h = meta.h || H();
    if (meta.terrainDef && RTS.Terrain) {
      meta.terrainGrid = RTS.Terrain.buildGrid(meta.w, meta.h, meta.terrainDef);
      var avoid = meta.avoidDecor || [];
      if (meta.coastalRing) {
        meta.decor = (meta.decor || []).concat(
          coastalRingTrees(meta.terrainGrid, meta.shoreSeed, avoid));
      } else if (meta.mapgenForest && RTS.SapphireMapgen) {
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
      if (meta.waterRocks) {
        meta.decor = (meta.decor || []).concat(
          waterDeepRocks(meta.terrainGrid, meta.rockSeed, avoid));
      } else if (meta.mapgenRocks && RTS.SapphireMapgen && RTS.SapphireMapgen.rocks) {
        meta.decor = (meta.decor || []).concat(rocksFromList(RTS.SapphireMapgen.rocks, avoid));
      } else if (meta.rockSeed != null) {
        meta.decor = (meta.decor || []).concat(
          scatterRocks(meta.terrainGrid, meta.rockSeed, meta.rockCount || 55, avoid));
      }
      if (meta.terraformForestWalls !== false && RTS.TerraformZones) {
        meta.decor = (meta.decor || []).concat(
          forestWallTrees(meta.terrainGrid, meta.forestWallSeed || 8801));
      }
      initPathGrid(meta);
      markTreesOnPathGrid(meta);
    } else {
      initPathGrid(meta);
      markTreesOnPathGrid(meta);
    }
    s.map = meta;
    syncMapBuildingFootprints(s);
    RTS.recalcSupply(s, RTS.TEAM.PLAYER);
    RTS.recalcSupply(s, RTS.TEAM.ENEMY);
    if (RTS.linkDepositHomeNodes) RTS.linkDepositHomeNodes(s);
  }

  function mine(s, x, y, isStarting) {
    RTS.makeResource(s, x, y, mineAmount(!!isStarting));
  }

  function spawnBase(s, team, cx, cy, faction, isEnemy, opts) {
    opts = opts || {};
    var core = RTS.makeBuilding(s, 'core', team, cx, cy, faction, true);
    RTS.markBuildingFootprint(s, core, true);
    var rallyDx = opts.rallyDx != null ? opts.rallyDx : (isEnemy ? -130 : 130);
    var rallyDy = opts.rallyDy != null ? opts.rallyDy : (isEnemy ? 40 : -40);
    core.rally = { x: cx + rallyDx, y: cy + rallyDy };
    core.autoMine = true;
    var b;
    if (opts.conduit) {
      b = RTS.makeBuilding(s, 'conduit', team, opts.conduit.x, opts.conduit.y, faction, true);
      RTS.markBuildingFootprint(s, b, true);
    }
    if (opts.foundry) {
      b = RTS.makeBuilding(s, 'foundry', team, opts.foundry.x, opts.foundry.y, faction, true);
      RTS.markBuildingFootprint(s, b, true);
    }
    if (opts.forge) {
      b = RTS.makeBuilding(s, 'forge', team, opts.forge.x, opts.forge.y, faction, true);
      RTS.markBuildingFootprint(s, b, true);
    }
    var workers = opts.workers != null ? opts.workers : 0;
    for (var i = 0; i < workers; i++) {
      var ox = isEnemy ? -70 - i * 26 : 70 + i * 26;
      RTS.makeUnit(s, 'pawn', team, cx + ox, cy + (isEnemy ? 64 : 64), faction);
    }
    if (!isEnemy && faction === 'aurex' && RTS.makeHero) {
      var heroRallyDx = opts.rallyDx != null ? opts.rallyDx : 130;
      var valdris = RTS.makeHero(s, 'valdris', team, cx + heroRallyDx * 0.55, cy + 52, faction);
      if (valdris && team === RTS.TEAM.PLAYER) {
        RTS.log(s, 'Valdris the Ironwarden stands with your host', 'good');
      }
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

    mg.gold.forEach(function (g) { mine(s, g.x, g.y, isHomeGoldOnMap(mg, g)); });

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
      coastalRing: true,
      shoreSeed: 4207,
      waterRocks: true,
      rockSeed: 9105,
      terrainDef: {
        theme: 'grass',
        tileset: 'color1',
        terrainMask: { cols: mg.cols, rows: mg.rows, heights: mg.heights },
      },
      intro: 'Sapphire Shores — forested isles linked by a shallow lane',
      win: 'The enemy heartland falls. The Reach is yours.',
      lose: 'Your keep falls. The shores are lost.',
    });
  }

  /* ---- 2. Ember Divide — east vs west, volcanic channel ------------------ */
  function buildEmberDivide(s) {
    var w = W(), h = H();
    var pf = s.playerFaction, ef = s.enemyFaction;
    var midY = h * 0.5;

    spawnBase(s, RTS.TEAM.PLAYER, 280, midY, pf, false, { rallyDx: 120, rallyDy: 0 });
    spawnBase(s, RTS.TEAM.ENEMY, w - 280, midY, ef, true, { rallyDx: -120, rallyDy: 0 });

    var playerSpawn = { x: 280, y: midY };
    var enemySpawn = { x: w - 280, y: midY };
    var bases = [playerSpawn, enemySpawn];

    mine(s, 400, midY - 220, isStartingMine(400, midY - 220, bases));
    mine(s, 400, midY + 220, isStartingMine(400, midY + 220, bases));
    mine(s, w - 400, midY - 220, isStartingMine(w - 400, midY - 220, bases));
    mine(s, w - 400, midY + 220, isStartingMine(w - 400, midY + 220, bases));
    mine(s, 360, midY - 380, false);
    mine(s, 360, midY + 380, false);
    mine(s, w - 360, midY - 380, false);
    mine(s, w - 360, midY + 380, false);
    mine(s, 980, midY - 150, false);
    mine(s, 1100, midY + 130, false);
    mine(s, 1500, midY - 110, false);
    mine(s, 1620, midY + 160, false);
    mine(s, 1280, midY - 300, false);
    mine(s, 1320, midY + 310, false);
    mine(s, 1180, midY, false);

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

    var playerSpawn = { x: midX, y: py };
    var enemySpawn = { x: midX, y: ey };
    var bases = [playerSpawn, enemySpawn];

    mine(s, midX - 220, py - 190, isStartingMine(midX - 220, py - 190, bases));
    mine(s, midX + 220, py - 190, isStartingMine(midX + 220, py - 190, bases));
    mine(s, midX - 220, ey + 190, isStartingMine(midX - 220, ey + 190, bases));
    mine(s, midX + 220, ey + 190, isStartingMine(midX + 220, ey + 190, bases));
    mine(s, midX - 380, py - 320, false);
    mine(s, midX + 380, py - 320, false);
    mine(s, midX - 380, ey + 320, false);
    mine(s, midX + 380, ey + 320, false);
    mine(s, w * 0.24, h * 0.44, false);
    mine(s, w * 0.24, h * 0.56, false);
    mine(s, w * 0.76, h * 0.44, false);
    mine(s, w * 0.76, h * 0.56, false);
    mine(s, midX - 180, h * 0.5, false);
    mine(s, midX + 180, h * 0.5, false);
    mine(s, midX, h * 0.42, false);
    mine(s, midX, h * 0.58, false);

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

    var bases = [{ x: px, y: py }, { x: ex, y: ey }];
    mine(s, px + 60, py - 140, isStartingMine(px + 60, py - 140, bases));
    mine(s, px - 140, py + 60, isStartingMine(px - 140, py + 60, bases));
    mine(s, px + 200, py + 200, isStartingMine(px + 200, py + 200, bases));
    mine(s, ex - 60, ey + 140, isStartingMine(ex - 60, ey + 140, bases));
    mine(s, ex + 140, ey - 60, isStartingMine(ex + 140, ey - 60, bases));
    mine(s, ex - 200, ey - 200, isStartingMine(ex - 200, ey - 200, bases));
    mine(s, w * 0.5, h * 0.5 - 80, false);
    mine(s, w * 0.5, h * 0.5 + 80, false);
    mine(s, w * 0.5 - 200, h * 0.5, false);
    mine(s, w * 0.5 + 200, h * 0.5, false);
    mine(s, w * 0.38, h * 0.38, false);
    mine(s, w * 0.62, h * 0.62, false);
    mine(s, w * 0.35, h * 0.65, false);
    mine(s, w * 0.65, h * 0.35, false);
    mine(s, w * 0.5, h * 0.32, false);
    mine(s, w * 0.5, h * 0.68, false);

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
      blurb: 'Twin elevated corners joined by a tight isthmus. Contested Ironstone sits in the choke.',
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
