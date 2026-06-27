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

  // Natural ground detail — sparse grass tufts, flowers, and small pebbles on
  // land. Pure decoration (no collision); rides the offscreen decor cache.
  function groundDetail(grid, seed, count, worldW, worldH, avoid) {
    var rnd = mulberry(seed), out = [], placed = [], T = RTS.Terrain, tries = 0;
    while (out.length < count && tries < count * 10) {
      tries++;
      var x = 90 + rnd() * (worldW - 180), y = 90 + rnd() * (worldH - 180);
      if (T && T.isWater && T.isWater(grid, x, y)) continue;
      if (!clearOfPoints(x, y, avoid, 130)) continue;
      if (!clearOfPoints(x, y, placed, 48)) continue;
      var roll = rnd();
      var kind = roll < 0.5 ? 'grass' : (roll < 0.8 ? 'flower' : 'pebble');
      out.push({ x: x, y: y, r: RTS.SizeRef.decorWorldR(kind), kind: kind });
      placed.push({ x: x, y: y });
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
    var BLOCK_RATIO = 0.6;

    // Dedicated tree-only collision grid. The shared pathGrid mixes terrain,
    // buildings and trees; this grid lets the movement integrator push units
    // out of trees specifically (see RTS.isTreeBlocked / resolveTreeCollision)
    // without fighting the building/water collision passes.
    var tb = new Uint8Array(cols * rows);
    meta.treeBlocked = tb;
    meta.treeBlockedCols = cols;
    meta.treeBlockedRows = rows;

    meta.decor.forEach(function (d) {
      if (d.kind !== 'tree' && d.kind !== 'grove_tree') return;
      if (d.forestWall) return; // terrain mask already covers these
      // Always block the trunk's own cell so a tree is reliably solid even when
      // its blocking circle is smaller than a tile.
      var tc = Math.floor(d.x / TILE), tr = Math.floor(d.y / TILE);
      if (tc >= 0 && tc < cols && tr >= 0 && tr < rows) {
        grid[tr][tc] = 1;
        tb[tr * cols + tc] = 1;
      }
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
            tb[r * cols + c] = 1;
          }
        }
      }
    });
  }

  // True if the world point falls on a tree-blocked cell. Used by the movement
  // integrator so units treat trees as solid obstacles.
  RTS.isTreeBlocked = function (s, x, y) {
    var m = s && s.map;
    if (!m || !m.treeBlocked) return false;
    var TILE = RTS.TILE || 64;
    var c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    if (c < 0 || r < 0 || c >= m.treeBlockedCols || r >= m.treeBlockedRows) return false;
    return m.treeBlocked[r * m.treeBlockedCols + c] === 1;
  };

  /* Build cliff walls: a plateau (HIGH) is solid — the only way up or down is a
   * ramp. We realise this on the path grid by blocking each LOW (flat) cell that
   * sits at the foot of a cliff (4-adjacent to a HIGH cell), except ramp cells.
   * That gives a 1-tile impassable wall around every plateau with ramp gaps. */
  function markCliffsOnPathGrid(meta) {
    var terrain = meta.terrainGrid;
    if (!meta.pathGrid || !terrain || !terrain.heights || !RTS.Terrain) return;
    var TILE = RTS.TILE || 64;
    var cols = meta.pathGridCols, rows = meta.pathGridRows;
    var grid = meta.pathGrid;
    var HIGH = RTS.Terrain.HIGH;
    var hcols = terrain.cols, hrows = terrain.rows, hgt = terrain.heights;
    var ramp = terrain.ramp;
    function hAt(c, r) {
      if (c < 0 || r < 0 || c >= hcols || r >= hrows) return -1;
      return hgt[c + r * hcols];
    }
    function isRamp(c, r) {
      return ramp && c >= 0 && r >= 0 && c < hcols && r < hrows && ramp[c + r * hcols] === 1;
    }
    var cb = new Uint8Array(cols * rows);
    meta.cliffBlocked = cb;
    meta.cliffBlockedCols = cols;
    meta.cliffBlockedRows = rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (hAt(c, r) !== RTS.Terrain.FLAT) continue;  // walls live on flat ground
        if (isRamp(c, r)) continue;                     // ramp = passable gap
        if (hAt(c, r - 1) === HIGH || hAt(c, r + 1) === HIGH ||
            hAt(c - 1, r) === HIGH || hAt(c + 1, r) === HIGH) {
          grid[r][c] = 1;
          cb[r * cols + c] = 1;
        }
      }
    }
  }

  // True if the world point falls on a cliff-wall cell (solid plateau edge).
  RTS.isCliffBlocked = function (s, x, y) {
    var m = s && s.map;
    if (!m || !m.cliffBlocked) return false;
    var TILE = RTS.TILE || 64;
    var c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    if (c < 0 || r < 0 || c >= m.cliffBlockedCols || r >= m.cliffBlockedRows) return false;
    return m.cliffBlocked[r * m.cliffBlockedCols + c] === 1;
  };

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
    // Sync the active world bounds to THIS map so the camera clamp + minimap use
    // the real map size (was a fixed 3072x1920, which cut off larger maps).
    if (RTS.Config && RTS.Config.world) { RTS.Config.world.w = meta.w; RTS.Config.world.h = meta.h; }
    if (meta.terrainDef && RTS.Terrain) {
      meta.terrainGrid = RTS.Terrain.buildGrid(meta.w, meta.h, meta.terrainDef);
      // Attach the ramp grid so cliff rendering + collision can see ramp gaps.
      if (meta.ramp && meta.terrainGrid &&
          meta.terrainGrid.cols * meta.terrainGrid.rows === meta.ramp.length) {
        meta.terrainGrid.ramp = meta.ramp;
      }
      var avoid = meta.avoidDecor || [];
      if (meta.coastalRing) {
        meta.decor = (meta.decor || []).concat(
          coastalRingTrees(meta.terrainGrid, meta.shoreSeed, avoid));
      } else if (meta.mapgenForest) {
        var mg = RTS.CurrentMapgen || RTS.SapphireMapgen;
        if (mg) meta.decor = (meta.decor || []).concat(forestFromMapgen(mg, avoid));
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
      // sparse natural ground detail (grass/flowers/pebbles) on every non-grove map
      if (meta.groundDetail !== false && meta.theme !== 'grove') {
        var detailN = meta.detailCount != null
          ? meta.detailCount : Math.round((meta.w * meta.h) / 90000);
        meta.decor = (meta.decor || []).concat(
          groundDetail(meta.terrainGrid, meta.detailSeed || 7723, detailN, meta.w, meta.h, avoid));
      }
      initPathGrid(meta);
      markTreesOnPathGrid(meta);
      markCliffsOnPathGrid(meta);
    } else {
      initPathGrid(meta);
      markTreesOnPathGrid(meta);
      markCliffsOnPathGrid(meta);
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

  // A small neutral camp guarding an expansion mine. Units cluster just off the
  // mine, biased toward the map centre so they sit on the approach.
  function spawnCreepCamp(s, gx, gy, faction) {
    var W = (RTS.Config.world && RTS.Config.world.w) || 3072;
    var H = (RTS.Config.world && RTS.Config.world.h) || 1920;
    var toCx = (gx < W / 2) ? 1 : -1;          // push toward horizontal centre
    var toCy = (gy < H / 2) ? 1 : -1;
    var cx = gx + toCx * 70, cy = gy + toCy * 70;
    var camp = { x: cx, y: cy };
    var spots = [[-44, 0], [44, 0], [0, 40]];
    var roles = ['warrior', 'warrior', 'archer'];
    for (var i = 0; i < spots.length; i++) {
      var x = cx + spots[i][0], y = cy + spots[i][1];
      if (RTS.Terrain && RTS.Terrain.isWater && RTS.Terrain.isWater(s.map && s.map.terrainGrid, x, y)) {
        x = gx; y = gy;   // fall back onto the mine tile (always land)
      }
      RTS.makeCreep(s, roles[i], x, y, faction || 'cinder', camp);
    }
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
    if (!isEnemy && faction === 'aurex' && RTS.makeHero && !opts.skipHero) {
      var heroRallyDx = opts.rallyDx != null ? opts.rallyDx : 130;
      var valdris = RTS.makeHero(s, 'valdris', team, cx + heroRallyDx * 0.55, cy + 52, faction);
      if (valdris && team === RTS.TEAM.PLAYER) {
        RTS.log(s, 'Valdris the Ironwarden stands with your host', 'good');
      }
    }
  }

  /* ---- 1. Sapphire Shores — from tools/mapgen (import-mapgen.py) ---------- */
  function buildFromAuthoredTMJ(s, meta) {
    var mg = RTS.CurrentMapgen;
    if (!mg) {
      console.error('Map TMJ data missing for ' + meta.id);
      return;
    }
    var pf = s.playerFaction, ef = s.enemyFaction;
    var px = mg.playerBase.x, py = mg.playerBase.y;
    var ex = mg.enemyBase.x, ey = mg.enemyBase.y;
    var rallyDx = meta.rallyDx != null ? meta.rallyDx : 130;
    var rallyDy = meta.rallyDy != null ? meta.rallyDy : 90;

    spawnBase(s, RTS.TEAM.PLAYER, px, py, pf, false, { rallyDx: rallyDx, rallyDy: rallyDy, workers: 5 });
    spawnBase(s, RTS.TEAM.ENEMY, ex, ey, ef, true, { rallyDx: -rallyDx, rallyDy: rallyDy, workers: 5 });

    mg.gold.forEach(function (g) { mine(s, g.x, g.y, isHomeGoldOnMap(mg, g)); });

    var decorAvoid = [{ x: px, y: py }, { x: ex, y: ey }];
    mg.gold.forEach(function (g) { decorAvoid.push({ x: g.x, y: g.y }); });

    finishMap(s, {
      id: meta.id,
      name: meta.name,
      theme: meta.theme || 'grass',
      w: mg.world.w,
      h: mg.world.h,
      decor: [],
      avoidDecor: decorAvoid,
      mapgenForest: true,
      ramp: mg.ramp,   // ramp tiles (passable cliff gaps) from the .tmj
      // TerraformZones holds hardcoded corridor/forest-wall data authored for
      // one specific map; let an authored map opt out so its walls aren't
      // stamped onto an unrelated layout (Tideland sets this false).
      terraformForestWalls: meta.terraformForestWalls,
      shoreSeed: meta.shoreSeed != null ? meta.shoreSeed : 4207,
      waterRocks: meta.waterRocks !== false,
      rockSeed: meta.rockSeed != null ? meta.rockSeed : 9105,
      terrainDef: {
        theme: meta.theme || 'grass',
        tileset: 'color1',
        terrainMask: { cols: mg.cols, rows: mg.rows, heights: mg.heights },
        // TerraformZones rewrites heights from another map's authored data —
        // let a map opt out so its own plateaus/cliffs survive intact.
        applyTerraform: meta.applyTerraform,
      },
      intro: meta.intro,
      win: meta.win,
      lose: meta.lose,
    });

    // After the terrain grid exists, guard each auxiliary (non-main) mine with
    // a neutral creep camp — clear it to expand safely (WC3-style). Never spawn
    // a camp near a START base, even if that mine isn't the single closest one
    // (a second home-adjacent mine would otherwise drop creeps onto the base).
    if (meta.creepCamps !== false && RTS.makeCreep) {
      var SAFE = (meta.creepSafeRadius != null ? meta.creepSafeRadius : 9) * 64; // px
      mg.gold.forEach(function (g) {
        if (isHomeGoldOnMap(mg, g)) return;
        if (dist(g.x, g.y, px, py) < SAFE || dist(g.x, g.y, ex, ey) < SAFE) return;
        spawnCreepCamp(s, g.x, g.y, meta.creepFaction);
      });
    }
  }

  RTS._buildAuthoredTMJ = buildFromAuthoredTMJ;   // exposed for headless map previews

  function buildTideland(s) {
    // Ensure the map data is available even if the scene parse hasn't run.
    if (!RTS.CurrentMapgen && RTS._mapJSON && RTS._mapJSON.tideland_crossing && RTS.parseMapTMJ) {
      RTS.CurrentMapgen = RTS.parseMapTMJ(RTS._mapJSON.tideland_crossing);
    }
    buildFromAuthoredTMJ(s, {
      id: 'tideland_crossing',
      name: 'Tideland Crossing',
      theme: 'grass',
      rallyDx: 120,
      rallyDy: 90,
      // Tideland authors its own sparse forest + plateaus in gen_tideland.py —
      // don't let the global TerraformZones (authored for another map) stamp its
      // forest walls OR rewrite our heights/cliffs.
      terraformForestWalls: false,
      applyTerraform: false,
      intro: 'Tideland Crossing — island holds joined by land bridges. Clear the guarded mines to expand.',
      win: 'Tideland Crossing is yours — the tides bow to your banner.',
      lose: 'Your hold has slipped beneath the tides.',
    });

    // Neutral centre structures sit on the southern land bridge (the only route
    // between the two sides): merchant just south of the gulf, mercenaries at the
    // very bottom centre — rows 36 / 45 on the 72x50 board, matching the 'o'
    // markers in gen_tideland.py.
    var cw = (RTS.Config.world && RTS.Config.world.w) || 4608;
    var mt = RTS.makeBuilding(s, 'merchant', RTS.TEAM.NEUTRAL, cw / 2, 39 * 64 + 32, s.playerFaction, true);
    var mb = RTS.makeBuilding(s, 'mercenary', RTS.TEAM.NEUTRAL, cw / 2, 46 * 64 + 32, s.playerFaction, true);
    if (RTS.markBuildingFootprint) {
      if (mt) RTS.markBuildingFootprint(s, mt, true);
      if (mb) RTS.markBuildingFootprint(s, mb, true);
    }

    // Thronefall-style fixed BUILD PLOTS on the player's plateau — tap a plot to
    // raise a structure there (only shown/active in the Thronefall preview).
    s.map.buildPlots = [[17, 9], [21, 9], [24, 13], [8, 15], [16, 15], [13, 6]]
      .map(function (t) { return { x: t[0] * 64 + 32, y: t[1] * 64 + 32, used: false }; });
  }

  function buildRunicClearing(s) {
    buildFromAuthoredTMJ(s, {
      id: 'runic_clearing',
      name: 'Runic Clearing',
      theme: 'grass',
      rallyDx: 120,
      rallyDy: 90,
      shoreSeed: 7341,
      rockSeed: 3812,
      intro: 'Runic Clearing — an ancient forest clearing split by a standing-stone shrine',
      win: 'The runic altar is yours. The clearing bows to your banner.',
      lose: 'The forest reclaims the fallen. The clearing is lost.',
    });
  }

  function buildFairyClearing(s) {
    buildFromAuthoredTMJ(s, {
      id: 'fairy_clearing',
      name: 'Fairy Clearing',
      theme: 'grass',
      rallyDx: 120,
      rallyDy: 90,
      shoreSeed: 7341,
      rockSeed: 3812,
      intro: 'Fairy Clearing — an open flat field beneath the fairy-forest canopy',
      win: 'The clearing is yours. The fairy grove bows to your banner.',
      lose: 'The clearing is lost. The forest swallows your keep.',
    });
  }

  function buildSapphireShores(s) {
    buildFromAuthoredTMJ(s, {
      id: 'sapphire_shores',
      name: 'Sapphire Shores',
      theme: 'grass',
      shoreSeed: 4207,
      rockSeed: 9105,
      intro: 'Sapphire Shores — forested isles linked by a shallow lane',
      win: 'The enemy heartland falls. The Reach is yours.',
      lose: 'Your keep falls. The shores are lost.',
    });
  }

  /* ---- Turtle Cove — WC3 Turtle Rock–style island lattice ------------------ */
  function buildTurtleCove(s) {
    buildFromAuthoredTMJ(s, {
      id: 'turtle_cove',
      name: 'Turtle Cove',
      theme: 'grass',
      rallyDx: 120,
      rallyDy: 100,
      shoreSeed: 5107,
      rockSeed: 9109,
      intro: 'Turtle Cove — four gold corners and a contested center altar',
      win: 'The cove is yours. Every island bows to your banner.',
      lose: 'Cut off from the gold, your keep falls to the tide.',
    });
  }

  /* ---- 2. Ember Divide — east vs west, volcanic channel ------------------ */
  function buildEmberDivide(s) {
    var w = W(), h = H();
    var pf = s.playerFaction, ef = s.enemyFaction;
    var midY = h * 0.5;

    spawnBase(s, RTS.TEAM.PLAYER, 280, midY, pf, false, { rallyDx: 120, rallyDy: 0, workers: 5 });
    spawnBase(s, RTS.TEAM.ENEMY, w - 280, midY, ef, true, { rallyDx: -120, rallyDy: 0, workers: 5 });

    var playerSpawn = { x: 280, y: midY };
    var enemySpawn = { x: w - 280, y: midY };
    var bases = [playerSpawn, enemySpawn];

    // Starting mines pushed out to ~520px from core (was 400px) — wider worker path
    mine(s, 520, midY - 260, isStartingMine(520, midY - 260, bases));
    mine(s, 520, midY + 260, isStartingMine(520, midY + 260, bases));
    mine(s, w - 520, midY - 260, isStartingMine(w - 520, midY - 260, bases));
    mine(s, w - 520, midY + 260, isStartingMine(w - 520, midY + 260, bases));
    mine(s, 480, midY - 420, false);
    mine(s, 480, midY + 420, false);
    mine(s, w - 480, midY - 420, false);
    mine(s, w - 480, midY + 420, false);
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

    spawnBase(s, RTS.TEAM.PLAYER, midX, py, pf, false, { rallyDx: 0, rallyDy: -120, workers: 5 });
    spawnBase(s, RTS.TEAM.ENEMY, midX, ey, ef, true, { rallyDx: 0, rallyDy: 120, workers: 5 });

    var playerSpawn = { x: midX, y: py };
    var enemySpawn = { x: midX, y: ey };
    var bases = [playerSpawn, enemySpawn];

    // Starting mines pushed out to ~300px offset (was 190px) — more breathing room
    mine(s, midX - 310, py - 300, isStartingMine(midX - 310, py - 300, bases));
    mine(s, midX + 310, py - 300, isStartingMine(midX + 310, py - 300, bases));
    mine(s, midX - 310, ey + 300, isStartingMine(midX - 310, ey + 300, bases));
    mine(s, midX + 310, ey + 300, isStartingMine(midX + 310, ey + 300, bases));
    mine(s, midX - 480, py - 420, false);
    mine(s, midX + 480, py - 420, false);
    mine(s, midX - 480, ey + 420, false);
    mine(s, midX + 480, ey + 420, false);
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

    spawnBase(s, RTS.TEAM.PLAYER, px, py, pf, false, { rallyDx: 110, rallyDy: 110, workers: 5 });
    spawnBase(s, RTS.TEAM.ENEMY, ex, ey, ef, true, { rallyDx: -110, rallyDy: -110, workers: 5 });

    var bases = [{ x: px, y: py }, { x: ex, y: ey }];
    // Starting mines pushed outward ~100px further from core on each side
    mine(s, px + 120, py - 230, isStartingMine(px + 120, py - 230, bases));
    mine(s, px - 230, py + 120, isStartingMine(px - 230, py + 120, bases));
    mine(s, px + 300, py + 300, isStartingMine(px + 300, py + 300, bases));
    mine(s, ex - 120, ey + 230, isStartingMine(ex - 120, ey + 230, bases));
    mine(s, ex + 230, ey - 120, isStartingMine(ex + 230, ey - 120, bases));
    mine(s, ex - 300, ey - 300, isStartingMine(ex - 300, ey - 300, bases));
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

  function groveRiverPools(w, h, seed) {
    var rnd = mulberry(seed || 77102);
    var pools = [];
    var n = 14;
    var i, t;
    for (i = 0; i < n; i++) {
      t = i / Math.max(1, n - 1);
      pools.push({
        x: w * (0.28 + t * 0.38) + (rnd() - 0.5) * 48,
        y: h * (0.12 + t * 0.76) + (rnd() - 0.5) * 36,
        r: 62 + rnd() * 38,
      });
    }
    return pools;
  }

  function buildGroveDecor(seed, w, h, avoid, opts) {
    opts = opts || {};
    var rnd = mulberry(seed);
    var out = [];
    var cx = opts.clearX != null ? opts.clearX : w * 0.5;
    var cy = opts.clearY != null ? opts.clearY : h * 0.5;
    var rx = opts.clearRx || 360;
    var ry = opts.clearRy || 260;
    var FF = RTS.FairyForest;
    var treeIdx = FF && FF.treeIndex ? FF.treeIndex.bind(FF) : function (row, col) { return row * 6 + col; };

    function inClearing(x, y, pad) {
      pad = pad || 0;
      return Math.abs(x - cx) / (rx + pad) + Math.abs(y - cy) / (ry + pad) < 1;
    }

    var treeCount = opts.treeCount || 92;
    var t;
    for (t = 0; t < treeCount; t++) {
      var tx = 96 + rnd() * (w - 192);
      var ty = 96 + rnd() * (h - 192);
      if (inClearing(tx, ty, 40)) continue;
      if (!clearOfPoints(tx, ty, avoid, 88)) continue;
      var edgeBias = inClearing(tx, ty, 180) ? 0.55 : 0.25;
      var purple = rnd() < edgeBias;
      var size = Math.floor(rnd() * 4);
      var row = purple ? 3 : (rnd() < 0.55 ? 0 : 1);
      out.push({
        x: tx,
        y: ty,
        kind: 'grove_tree',
        spriteIdx: treeIdx(row, size),
        targetH: 210 - size * 32,
        r: 22 + size * 7,
      });
    }

    var ringTrees = opts.ringCount || 36;
    for (t = 0; t < ringTrees; t++) {
      var ang = (t / ringTrees) * Math.PI * 2 + rnd() * 0.15;
      var rad = 0.82 + rnd() * 0.12;
      tx = cx + Math.cos(ang) * rx * rad * 1.35;
      ty = cy + Math.sin(ang) * ry * rad * 1.35;
      if (tx < 80 || ty < 80 || tx > w - 80 || ty > h - 80) continue;
      if (!clearOfPoints(tx, ty, avoid, 72)) continue;
      size = Math.floor(rnd() * 3);
      row = rnd() < 0.42 ? 3 : 0;
      out.push({
        x: tx,
        y: ty,
        kind: 'grove_tree',
        spriteIdx: treeIdx(row, size),
        targetH: 230 - size * 34,
        r: 24 + size * 8,
      });
    }

    function scatterProp(prop, count, clearOk, minDist) {
      var p, x, y, k;
      for (p = 0; p < count; p++) {
        for (k = 0; k < 24; k++) {
          x = 120 + rnd() * (w - 240);
          y = 120 + rnd() * (h - 240);
          if (!clearOk && inClearing(x, y, -20)) continue;
          if (clearOk && !inClearing(x, y, 60)) continue;
          if (!clearOfPoints(x, y, avoid, minDist || 36)) continue;
          break;
        }
        if (k >= 24) continue;
        out.push({
          x: x,
          y: y,
          kind: 'grove_prop',
          prop: prop,
          variant: Math.floor(rnd() * 8),
          r: prop === 'rock' ? 14 : 10,
        });
      }
    }

    scatterProp('flower', opts.flowers || 18, true, 42);
    scatterProp('mushroom', opts.mushrooms || 14, true, 34);
    scatterProp('bush', opts.bushes || 26, false, 28);
    scatterProp('rock', opts.rocks || 16, false, 32);
    scatterProp('vine', opts.vines || 10, false, 40);
    scatterProp('stump', opts.stumps || 8, false, 36);

    return out;
  }

  /* ---- 5b. Aelindra grove — Fairy Forest environment ------------------------- */
  function buildAelindraGrove(s) {
    var w = W(), h = H();
    var px = 480, py = h * 0.5;
    var ex = w - 480, ey = h * 0.5;
    var clearX = w * 0.5;
    var clearY = h * 0.5;

    var aelindra = null;
    if (RTS.makeHero) {
      aelindra = RTS.makeHero(s, 'aelindra', RTS.TEAM.PLAYER, px, py, s.playerFaction);
      if (aelindra && RTS.UnitAI) {
        RTS.UnitAI.setCommand(aelindra, 'idle', {
          guardOrigin: { x: aelindra.x, y: aelindra.y },
        });
        aelindra._heroTestPassive = true;
      }
    }

    var goblinXs = [ex, ex - 52, ex - 52];
    var goblinYs = [ey - 72, ey, ey + 72];
    var g;
    for (g = 0; g < 3; g++) {
      var gob = RTS.makeUnit(s, 'lancer', RTS.TEAM.ENEMY, goblinXs[g], goblinYs[g], 'cinder');
      if (gob && RTS.UnitAI) {
        RTS.UnitAI.setCommand(gob, 'hold', {
          guardOrigin: { x: gob.x, y: gob.y },
        });
      }
    }

    var avoid = [
      { x: px, y: py }, { x: ex, y: ey },
      { x: goblinXs[0], y: goblinYs[0] },
      { x: goblinXs[1], y: goblinYs[1] },
      { x: goblinXs[2], y: goblinYs[2] },
    ];

    finishMap(s, {
      id: 'aelindra_grove',
      name: 'Aelindra Grove',
      theme: 'grove',
      decor: buildGroveDecor(88202, w, h, avoid, {
        clearX: clearX,
        clearY: clearY,
        clearRx: 340,
        clearRy: 250,
      }),
      terrainDef: {
        theme: 'grove',
        tileset: 'grove',
        applyTerraform: false,
        island: { x: 48, y: 48, w: w - 96, h: h - 96 },
        waterPools: groveRiverPools(w, h, 88203),
      },
      terraformForestWalls: false,
      intro: 'Verdant grove — glowing flowers, ancient trees, and a winding stream',
      win: 'The grove is cleansed.',
      lose: 'Aelindra has fallen.',
      heroTestFocus: aelindra ? aelindra.id : null,
      sandbox: true,
    });

    if (aelindra) {
      RTS.log(s, 'Aelindra Ashveil — the grove awaits. Move through the clearing to engage.', 'good');
    }
  }

  /* ---- 4b. Verdant Reach — hand-designed Rimwalker level ----------------------- */
  function buildVerdantReachDecor(w, h, cx, cy, avoid) {
    var out = [];
    var FF = RTS.FairyForest;
    var treeIdx = FF && FF.treeIndex ? FF.treeIndex.bind(FF) : function (r, c) { return r * 6 + c; };

    var rx = 680, ry = 460;

    function inClearing(x, y, pad) {
      pad = pad || 0;
      var ex = rx + pad, ey = ry + pad;
      return ((x - cx) * (x - cx)) / (ex * ex) + ((y - cy) * (y - cy)) / (ey * ey) < 1;
    }

    function addTree(x, y, row, size, targetH) {
      out.push({
        x: x, y: y,
        kind: 'grove_tree',
        spriteIdx: treeIdx(row || 0, size || 0),
        targetH: targetH || (220 - (size || 0) * 32),
        r: 24 + (size || 0) * 7,
      });
    }

    function addProp(x, y, prop, variant) {
      out.push({
        x: x, y: y,
        kind: 'grove_prop',
        prop: prop || 'rock',
        variant: variant || 0,
        r: prop === 'rock' ? 16 : (prop === 'stump' ? 12 : 10),
      });
    }

    /* 1. Dense forest ring — encircles clearing with path gaps N and S */
    var RING_N = 52;
    var RING_SCALE = 1.30;
    var PATH_HALF = 0.20;
    var rndRing = mulberry(99402);

    for (var ri = 0; ri < RING_N; ri++) {
      var ang = (ri / RING_N) * Math.PI * 2;
      var angN = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      var dNorth = Math.min(Math.abs(angN - Math.PI * 1.5), Math.PI * 2 - Math.abs(angN - Math.PI * 1.5));
      var dSouth = Math.min(Math.abs(angN - Math.PI * 0.5), Math.PI * 2 - Math.abs(angN - Math.PI * 0.5));
      if (dNorth < PATH_HALF || dSouth < PATH_HALF) continue;
      var jitter = 0.88 + rndRing() * 0.24;
      var tx = cx + Math.cos(ang) * rx * RING_SCALE * jitter;
      var ty = cy + Math.sin(ang) * ry * RING_SCALE * jitter;
      if (tx < 72 || ty < 72 || tx > w - 72 || ty > h - 72) continue;
      var rSize = Math.floor(rndRing() * 3);
      var rRow = rndRing() < 0.35 ? 3 : (rndRing() < 0.5 ? 1 : 0);
      addTree(tx, ty, rRow, rSize, 235 - rSize * 36);
    }

    /* 2. Outer forest fills the rest of the world */
    var rndOuter = mulberry(99403);
    for (var oi = 0; oi < 88; oi++) {
      var ox = 80 + rndOuter() * (w - 160);
      var oy = 80 + rndOuter() * (h - 160);
      if (inClearing(ox, oy, 120)) continue;
      var oSize = Math.floor(rndOuter() * 4);
      var oRow = rndOuter() < 0.28 ? 3 : (rndOuter() < 0.5 ? 1 : 0);
      addTree(ox, oy, oRow, oSize, 200 - oSize * 26);
    }

    /* 3. Stone circle — 5 standing stones ringing the clearing center */
    var STONE_R = 155;
    for (var si = 0; si < 5; si++) {
      var sAng = (si / 5) * Math.PI * 2 - Math.PI / 2;
      var sx = cx + Math.cos(sAng) * STONE_R;
      var sy = cy + Math.sin(sAng) * STONE_R;
      addProp(sx, sy, 'rock', si % 5);
      addProp(sx + Math.cos(sAng + 0.6) * 40, sy + Math.sin(sAng + 0.6) * 40, 'rock', (si + 3) % 5);
    }
    addProp(cx, cy, 'rock', 2);

    /* 4. Eastern ruins — crumbled stone cluster where enemies camp */
    var ruinsX = cx + rx * 0.70;
    var ruinsY = cy;
    var ruinLayout = [
      { dx: 0,   dy: -88, v: 0 }, { dx: -52, dy: -52, v: 1 }, { dx: 52,  dy: -50, v: 2 },
      { dx: 0,   dy: 88,  v: 3 }, { dx: -62, dy: 58,  v: 4 }, { dx: 64,  dy: 44,  v: 0 },
      { dx: -28, dy: 0,   v: 1 }, { dx: 36,  dy: 0,   v: 2 },
    ];
    ruinLayout.forEach(function (r) { addProp(ruinsX + r.dx, ruinsY + r.dy, 'rock', r.v); });
    addProp(ruinsX - 100, ruinsY - 118, 'stump', 0);
    addProp(ruinsX + 88, ruinsY + 98, 'stump', 2);

    /* 5. Western alcove — Aelindra spawn area (roots and vines) */
    var westX = cx - rx * 0.72;
    var westY = cy;
    [
      { dx: 0,   dy: -82, prop: 'vine' },  { dx: 0,  dy: 82, prop: 'vine' },
      { dx: -58, dy: -42, prop: 'stump' }, { dx: -58, dy: 44, prop: 'stump' },
    ].forEach(function (v, vi) { addProp(westX + v.dx, westY + v.dy, v.prop, vi % 3); });

    /* 6. Clearing flowers, mushrooms, and path-entrance markers */
    var clearDetail = [
      { x: cx - 310, y: cy - 60,       prop: 'flower' },
      { x: cx + 290, y: cy - 80,       prop: 'flower' },
      { x: cx - 280, y: cy + 72,       prop: 'flower' },
      { x: cx + 260, y: cy + 90,       prop: 'flower' },
      { x: cx - 430, y: cy + 148,      prop: 'mushroom' },
      { x: cx - 398, y: cy - 158,      prop: 'mushroom' },
      { x: cx + 350, y: cy + 168,      prop: 'mushroom' },
      { x: cx - 100, y: cy - ry * 0.82, prop: 'flower' },
      { x: cx + 100, y: cy - ry * 0.82, prop: 'flower' },
      { x: cx - 100, y: cy + ry * 0.82, prop: 'flower' },
      { x: cx + 100, y: cy + ry * 0.82, prop: 'flower' },
      { x: cx - rx * 0.88, y: cy - 120, prop: 'vine' },
      { x: cx - rx * 0.88, y: cy + 130, prop: 'vine' },
      { x: cx + rx * 0.50, y: cy - ry * 0.70, prop: 'stump' },
      { x: cx - rx * 0.54, y: cy + ry * 0.65, prop: 'stump' },
      { x: cx + rx * 0.44, y: cy + ry * 0.72, prop: 'stump' },
    ];
    clearDetail.forEach(function (d, di) {
      if (!inClearing(d.x, d.y, 30)) return;
      var ok = clearOfPoints(d.x, d.y, avoid, 100);
      if (ok) addProp(d.x, d.y, d.prop, di % 4);
    });

    return out;
  }

  function buildVerdantReach(s) {
    var w = W(), h = H();
    var cx = w * 0.5, cy = h * 0.5;
    var px = 480, py = cy;

    var aelindra = null;
    if (RTS.makeHero) {
      aelindra = RTS.makeHero(s, 'aelindra', RTS.TEAM.PLAYER, px, py, s.playerFaction);
      if (aelindra && RTS.UnitAI) {
        RTS.UnitAI.setCommand(aelindra, 'idle', {
          guardOrigin: { x: aelindra.x, y: aelindra.y },
        });
        aelindra._heroTestPassive = true;
      }
    }

    var rx = 680;
    var enemyCx = cx + rx * 0.70, enemyCy = cy;
    var goblinDefs = [
      { dx: 0,   dy: 0,   type: 'warrior' },
      { dx: -50, dy: -78, type: 'lancer' },
      { dx: -50, dy: 78,  type: 'lancer' },
      { dx: 80,  dy: -40, type: 'archer' },
      { dx: 80,  dy: 40,  type: 'archer' },
    ];
    goblinDefs.forEach(function (g) {
      var u = RTS.makeUnit(s, g.type, RTS.TEAM.ENEMY, enemyCx + g.dx, enemyCy + g.dy, 'cinder');
      if (u && RTS.UnitAI) RTS.UnitAI.setCommand(u, 'hold', { guardOrigin: { x: u.x, y: u.y } });
    });

    var avoid = [{ x: px, y: py }, { x: enemyCx, y: enemyCy }];

    finishMap(s, {
      id: 'verdant_reach',
      name: 'The Verdant Reach',
      theme: 'grove',
      decor: buildVerdantReachDecor(w, h, cx, cy, avoid),
      terrainDef: {
        theme: 'grove',
        tileset: 'grove',
        applyTerraform: false,
        island: { x: 48, y: 48, w: w - 96, h: h - 96 },
        waterPools: groveRiverPools(w, h, 99401),
      },
      terraformForestWalls: false,
      intro: 'The Verdant Reach — sacred Rimwalker ground, a great clearing ringed by ancient trees',
      win: 'The reach is held.',
      lose: 'Aelindra has fallen.',
      heroTestFocus: aelindra ? aelindra.id : null,
      sandbox: true,
    });

    if (aelindra) {
      RTS.log(s, 'Aelindra Ashveil — the Verdant Reach. Rimwalker territory. Move through the clearing and hold the ruins.', 'good');
    }
  }

  /* ---- 5. Aelindra vs goblins — bare grass duel -------------------------------- */
  function buildAelindraDuel(s) {
    var w = W(), h = H();
    var px = 520, py = h * 0.5;
    var ex = w - 520, ey = h * 0.5;

    var aelindra = null;
    if (RTS.makeHero) {
      aelindra = RTS.makeHero(s, 'aelindra', RTS.TEAM.PLAYER, px, py, s.playerFaction);
      if (aelindra && RTS.UnitAI) {
        RTS.UnitAI.setCommand(aelindra, 'idle', {
          guardOrigin: { x: aelindra.x, y: aelindra.y },
        });
        aelindra._heroTestPassive = true;
      }
    }

    var goblinXs = [ex, ex - 48, ex - 48];
    var goblinYs = [ey - 70, ey, ey + 70];
    for (var g = 0; g < 3; g++) {
      var gob = RTS.makeUnit(s, 'lancer', RTS.TEAM.ENEMY, goblinXs[g], goblinYs[g], 'cinder');
      if (gob && RTS.UnitAI) {
        RTS.UnitAI.setCommand(gob, 'hold', {
          guardOrigin: { x: gob.x, y: gob.y },
        });
      }
    }

    finishMap(s, {
      id: 'aelindra_duel',
      name: 'Aelindra vs Goblins',
      theme: 'grass',
      decor: [],
      terrainDef: {
        theme: 'grass',
        tileset: 'color1',
        island: { x: 64, y: 64, w: w - 128, h: h - 128 },
      },
      terraformForestWalls: false,
      intro: 'Open grass — Aelindra west, three Spear Goblins east',
      win: 'The goblins are routed.',
      lose: 'Aelindra has fallen.',
      heroTestFocus: aelindra ? aelindra.id : null,
      sandbox: true,
    });

      if (aelindra) {
        RTS.log(s, 'Aelindra Ashveil — right-click ground to move (or Move button, then click ground)', 'good');
      }
  }

  /* ---- 6. Aelindra hero test arena — open lane, target dummies ---------------- */
  function buildAelindraTest(s) {
    var w = W(), h = H();
    var pf = s.playerFaction, ef = s.enemyFaction;
    var px = 620, py = h * 0.5;
    var ex = w - 620, ey = h * 0.5;

    spawnBase(s, RTS.TEAM.PLAYER, px, py, pf, false, {
      workers: 0, rallyDx: 100, rallyDy: 0, skipHero: true,
    });
    spawnBase(s, RTS.TEAM.ENEMY, ex, ey, ef, true, {
      workers: 0, rallyDx: -100, rallyDy: 0, skipHero: true,
    });

    var aelindra = null;
    if (RTS.makeHero) {
      aelindra = RTS.makeHero(s, 'aelindra', RTS.TEAM.PLAYER, px + 100, py, s.playerFaction);
      if (aelindra) {
        if (RTS.UnitAI) {
          RTS.UnitAI.setCommand(aelindra, 'idle', {
            guardOrigin: { x: aelindra.x, y: aelindra.y },
          });
        }
        aelindra._heroTestPassive = true;
        RTS.log(s, 'Aelindra Ashveil — right-click ground to move (or Move button, then click ground)', 'good');
      }
    }

    RTS.makeUnit(s, 'pawn', RTS.TEAM.PLAYER, px + 50, py + 70, pf);
    RTS.makeUnit(s, 'pawn', RTS.TEAM.ENEMY, ex - 150, ey, ef);
    RTS.makeUnit(s, 'archer', RTS.TEAM.ENEMY, ex - 220, ey - 55, ef);
    RTS.makeUnit(s, 'warrior', RTS.TEAM.ENEMY, ex - 220, ey + 55, ef);

    mine(s, px - 100, py - 140, true);
    mine(s, ex + 100, ey + 140, true);

    finishMap(s, {
      id: 'aelindra_test',
      name: 'Aelindra Test Arena',
      theme: 'grass',
      decor: decor(99101, 14, w, h, 0.28),
      shoreSeed: 99102,
      terrainDef: {
        theme: 'grass',
        tileset: 'color1',
        island: { x: 100, y: 100, w: w - 200, h: h - 200 },
      },
      intro: 'Aelindra test arena — practice movement and attacks on training dummies',
      win: 'Test complete.',
      lose: 'Your keep fell.',
      heroTestFocus: aelindra ? aelindra.id : null,
    });
  }

  RTS.Maps = {
    fairy_clearing: {
      id: 'fairy_clearing',
      name: 'Fairy Clearing',
      tagline: 'Fairy Forest · Flat field',
      blurb: 'An open flat clearing beneath the fairy-forest canopy. No cliffs, no voids — fight for five gold nodes across unobstructed terrain.',
      build: buildFairyClearing,
    },
    runic_clearing: {
      id: 'runic_clearing',
      name: 'Runic Clearing',
      tagline: 'Grass · Ancient forest shrine',
      blurb: 'A vast sacred clearing ringed by a thinning forest. Runic standing stones dominate the upper-right — control the shrine to control the gold.',
      build: buildRunicClearing,
    },
    sapphire_shores: {
      id: 'sapphire_shores',
      name: 'Sapphire Shores',
      tagline: 'Grass · Island archipelago',
      blurb: 'Forested isles with a shallow central lane — bases at the north shores.',
      build: buildSapphireShores,
    },
    turtle_cove: {
      id: 'turtle_cove',
      name: 'Turtle Cove',
      tagline: 'Grass · Turtle Rock lattice',
      blurb: 'Four corner gold mines linked by shallow bridges — north spawns face off across the cove.',
      build: buildTurtleCove,
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
    aelindra_test: {
      id: 'aelindra_test',
      name: 'Aelindra Test Arena',
      tagline: 'Hero sandbox · Rimwalker',
      blurb: 'Open grass lane with Aelindra and enemy training dummies — for animation and combat testing.',
      build: buildAelindraTest,
    },
    aelindra_duel: {
      id: 'aelindra_duel',
      name: 'Aelindra vs Goblins',
      tagline: 'Open grass · 1v3 duel',
      blurb: 'Bare grass field — Aelindra on one flank, three Spear Goblins on the other. No bases, no waves.',
      build: buildAelindraDuel,
    },
    aelindra_grove: {
      id: 'aelindra_grove',
      name: 'Aelindra Grove',
      tagline: 'Fairy Forest · Magical clearing',
      blurb: 'Purple-canopy grove with glowing flowers, mushrooms, and a winding stream — Aelindra vs three goblins.',
      build: buildAelindraGrove,
    },
    verdant_reach: {
      id: 'verdant_reach',
      name: 'The Verdant Reach',
      tagline: 'Rimwalker territory · Ancient clearing',
      blurb: 'A vast sacred clearing ringed by ancient trees. Stone circle, crumbled ruins, and five waiting goblins.',
      build: buildVerdantReach,
    },
    tideland_crossing: {
      id: 'tideland_crossing',
      name: 'Tideland Crossing',
      tagline: '1v1 · island holds & guarded mines',
      blurb: 'Symmetric two-player isles joined by land bridges over shallow seas. Mains are safe; every expansion mine is guarded by a creep camp.',
      build: buildTideland,
    },
  };

  /* Visible in map select */
  RTS.MapList = ['fairy_clearing', 'tideland_crossing'];

  RTS.buildMap = function (s, mapId) {
    mapId = mapId || s.mapId || 'fairy_clearing';
    if (RTS.MapList.indexOf(mapId) < 0) mapId = 'fairy_clearing';
    var def = RTS.Maps[mapId] || RTS.Maps.fairy_clearing;
    s.mapId = def.id;
    def.build(s);
  };

})(window.RTS = window.RTS || {});
