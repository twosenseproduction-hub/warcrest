/* ============================================================================
 * Warcrest — pathfind.js
 * Coarse grid A* around built structures (+ water). Units follow waypoints
 * instead of steering straight into walls.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var CELL = RTS.TILE || 64;
  var SQRT2 = 1.41421356237;
  var WAYPOINT_R = 22;
  var STUCK_REPLAN = 0.4;
  var NAV_REBUILD = 0.55;

  var DIRS = [
    { dx: 1, dy: 0, c: 1 }, { dx: -1, dy: 0, c: 1 },
    { dx: 0, dy: 1, c: 1 }, { dx: 0, dy: -1, c: 1 },
    { dx: 1, dy: 1, c: SQRT2 }, { dx: -1, dy: 1, c: SQRT2 },
    { dx: 1, dy: -1, c: SQRT2 }, { dx: -1, dy: -1, c: SQRT2 },
  ];

  function dist(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function cellIdx(cols, cx, cy) { return cx + cy * cols; }

  function inCell(cols, rows, cx, cy) {
    return cx >= 0 && cy >= 0 && cx < cols && cy < rows;
  }

  function buildingObstacleRect(b, s, pad) {
    pad = pad == null ? 16 : pad;
    if (RTS.Assets && RTS.Assets.buildingCollisionRect) {
      var r = RTS.Assets.buildingCollisionRect(b, s);
      return { l: r.l - pad, r: r.r + pad, t: r.t - pad, b: r.b + pad };
    }
    var hw = b.w * 0.42 + pad, hh = b.h * 0.32 + pad;
    return { l: b.x - hw, r: b.x + hw, t: b.y - hh, b: b.y + hh * 0.55 };
  }

  function markRectBlocked(blocked, cols, rows, rect, cell) {
    cell = cell || CELL;
    var x0 = Math.max(0, Math.floor(rect.l / cell));
    var y0 = Math.max(0, Math.floor(rect.t / cell));
    var x1 = Math.min(cols - 1, Math.floor(rect.r / cell));
    var y1 = Math.min(rows - 1, Math.floor(rect.b / cell));
    var cx, cy, wx, wy, i;
    for (cy = y0; cy <= y1; cy++) {
      for (cx = x0; cx <= x1; cx++) {
        wx = cx * cell + cell * 0.5;
        wy = cy * cell + cell * 0.5;
        if (wx >= rect.l && wx <= rect.r && wy >= rect.t && wy <= rect.b) {
          i = cellIdx(cols, cx, cy);
          blocked[i] = 1;
        }
      }
    }
  }

  function unblockBuildingFootprint(b, blocked, cols, rows, tile) {
    tile = tile || CELL;
    var col = Math.round(b.x / tile);
    var row = Math.round(b.y / tile);
    var halfW = Math.round(b.w / tile / 2);
    var halfH = Math.round(b.h / tile / 2);
    var r, c;
    for (r = row - halfH; r < row + halfH; r++) {
      for (c = col - halfW; c < col + halfW; c++) {
        if (inCell(cols, rows, c, r)) blocked[cellIdx(cols, c, r)] = 0;
      }
    }
  }

  function overlayForestWall(blocked, cols, rows, terrain) {
    if (!terrain || !terrain.forestWall) return;
    var r, c;
    for (r = 0; r < rows && r < terrain.rows; r++) {
      for (c = 0; c < cols && c < terrain.cols; c++) {
        if (terrain.forestWall[c + r * terrain.cols]) {
          blocked[cellIdx(cols, c, r)] = 1;
        }
      }
    }
  }

  function buildNavGrid(s, opts) {
    opts = opts || {};
    var skipId = opts.skipBuildingId || null;
    var W = RTS.Config.world.w, H = RTS.Config.world.h;
    var cols = Math.ceil(W / CELL);
    var rows = Math.ceil(H / CELL);
    var blocked = new Uint8Array(cols * rows);
    var pathGrid = s.map && s.map.pathGrid;
    var terrain = s.map && s.map.terrainGrid;
    var r, c, i;

    if (pathGrid) {
      for (r = 0; r < rows; r++) {
        if (!pathGrid[r]) continue;
        for (c = 0; c < cols; c++) {
          if (pathGrid[r][c]) blocked[cellIdx(cols, c, r)] = 1;
        }
      }
      overlayForestWall(blocked, cols, rows, terrain);
    } else if (terrain && RTS.Terrain) {
      var wx, wy;
      for (r = 0; r < rows; r++) {
        for (c = 0; c < cols; c++) {
          wx = c * CELL + CELL * 0.5;
          wy = r * CELL + CELL * 0.5;
          if (RTS.Terrain.isWater(terrain, wx, wy)) {
            blocked[cellIdx(cols, c, r)] = 1;
          }
        }
      }
      overlayForestWall(blocked, cols, rows, terrain);
      var buildings = s.entities.buildings;
      for (i = 0; i < buildings.length; i++) {
        var b = buildings[i];
        if (b.dead || !b.built) continue;
        if (skipId && b.id === skipId) continue;
        markRectBlocked(blocked, cols, rows, buildingObstacleRect(b, s, 16));
      }
    }

    if (skipId) {
      var skipB = RTS.getById(s, skipId);
      if (skipB && !skipB.dead) unblockBuildingFootprint(skipB, blocked, cols, rows);
    }

    return {
      cols: cols, rows: rows, blocked: blocked, cell: CELL,
      at: s.timers ? s.timers.gameTime : 0,
    };
  }

  function getNav(s, opts) {
    opts = opts || {};
    var skipId = opts.skipBuildingId || '';
    var key = skipId || '_default';
    if (!s._navBySkip) s._navBySkip = {};
    var cached = s._navBySkip[key];
    if (!cached || s._navDirty ||
        (s.timers && s.timers.gameTime - cached.at > NAV_REBUILD)) {
      cached = buildNavGrid(s, opts);
      s._navBySkip[key] = cached;
      if (!skipId) s._nav = cached;
      s._navDirty = false;
    }
    return cached;
  }

  function octile(cx0, cy0, cx1, cy1) {
    var dx = Math.abs(cx1 - cx0), dy = Math.abs(cy1 - cy0);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  }

  function nearestWalkable(nav, cx, cy) {
    if (inCell(nav.cols, nav.rows, cx, cy) && !nav.blocked[cellIdx(nav.cols, cx, cy)]) {
      return { cx: cx, cy: cy };
    }
    var maxR = 12, r, d, nx, ny, i;
    for (r = 1; r <= maxR; r++) {
      for (d = 0; d < 8; d++) {
        nx = cx + Math.round(Math.cos(d * Math.PI / 4) * r);
        ny = cy + Math.round(Math.sin(d * Math.PI / 4) * r);
        if (!inCell(nav.cols, nav.rows, nx, ny)) continue;
        i = cellIdx(nav.cols, nx, ny);
        if (!nav.blocked[i]) return { cx: nx, cy: ny };
      }
    }
    return null;
  }

  function astar(nav, scx, scy, gcx, gcy, skipCell) {
    var cols = nav.cols, rows = nav.rows, blocked = nav.blocked;
    var startI = cellIdx(cols, scx, scy);
    var goalI = cellIdx(cols, gcx, gcy);
    if (blocked[startI] || blocked[goalI]) return null;

    var size = cols * rows;
    var gScore = new Float32Array(size);
    var fScore = new Float32Array(size);
    var came = new Int32Array(size);
    var open = new Uint8Array(size);
    var closed = new Uint8Array(size);
    var i, j, k, ci, ni, tentative, h0;

    for (i = 0; i < size; i++) {
      gScore[i] = Infinity;
      fScore[i] = Infinity;
      came[i] = -1;
    }

    gScore[startI] = 0;
    fScore[startI] = octile(scx, scy, gcx, gcy);
    open[startI] = 1;

    var guard = 0;
    while (guard++ < 6000) {
      var best = -1, bestF = Infinity;
      for (i = 0; i < size; i++) {
        if (open[i] && fScore[i] < bestF) { bestF = fScore[i]; best = i; }
      }
      if (best < 0) return null;
      if (best === goalI) break;

      open[best] = 0;
      closed[best] = 1;
      ci = best;
      var ccx = ci % cols, ccy = (ci / cols) | 0;

      for (j = 0; j < DIRS.length; j++) {
        var nx = ccx + DIRS[j].dx, ny = ccy + DIRS[j].dy;
        if (!inCell(cols, rows, nx, ny)) continue;
        ni = cellIdx(cols, nx, ny);
        if (closed[ni] || blocked[ni]) continue;
        if (skipCell && nx === skipCell.cx && ny === skipCell.cy) continue;
        if (DIRS[j].c > 1.1) {
          if (blocked[cellIdx(cols, ccx + DIRS[j].dx, ccy)] ||
              blocked[cellIdx(cols, ccx, ccy + DIRS[j].dy)]) continue;
        }
        tentative = gScore[ci] + DIRS[j].c;
        if (tentative < gScore[ni]) {
          came[ni] = ci;
          gScore[ni] = tentative;
          fScore[ni] = tentative + octile(nx, ny, gcx, gcy);
          open[ni] = 1;
        }
      }
    }

    if (came[goalI] < 0 && goalI !== startI) return null;

    var path = [];
    k = goalI;
    while (k >= 0 && k !== startI) {
      path.push({
        x: (k % cols) * CELL + CELL * 0.5,
        y: ((k / cols) | 0) * CELL + CELL * 0.5,
      });
      k = came[k];
    }
    path.reverse();
    return path;
  }

  function findPath(s, x0, y0, x1, y1, opts) {
    opts = opts || {};
    var nav = getNav(s, opts);
    var scx = Math.floor(x0 / CELL), scy = Math.floor(y0 / CELL);
    var gcx = Math.floor(x1 / CELL), gcy = Math.floor(y1 / CELL);
    var start = nearestWalkable(nav, scx, scy);
    var goal = nearestWalkable(nav, gcx, gcy);
    if (!start || !goal) return null;

    var skipCell = null;
    if (opts.skipBuildingId) {
      var b = RTS.getById(s, opts.skipBuildingId);
      if (b) skipCell = { cx: Math.floor(b.x / CELL), cy: Math.floor(b.y / CELL) };
    }

    if (start.cx === goal.cx && start.cy === goal.cy) return [];

    if (!segmentBlocked(s, x0, y0, x1, y1, opts)) return null;

    return astar(nav, start.cx, start.cy, goal.cx, goal.cy, skipCell);
  }

  function segmentBlocked(s, x0, y0, x1, y1, opts) {
    opts = opts || {};
    var dx = x1 - x0, dy = y1 - y0;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var steps = Math.max(2, Math.ceil(len / (CELL * 0.45)));
    var i, t, x, y;
    for (i = 1; i <= steps; i++) {
      t = i / steps;
      x = x0 + dx * t;
      y = y0 + dy * t;
      if (pointBlocked(s, x, y, opts)) return true;
    }
    return false;
  }

  function pointBlocked(s, x, y, opts) {
    opts = opts || {};
    var nav = getNav(s, opts);
    var cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    if (!inCell(nav.cols, nav.rows, cx, cy)) return true;
    if (nav.blocked[cellIdx(nav.cols, cx, cy)]) return true;
    if (opts.skipBuildingId) {
      var b = RTS.getById(s, opts.skipBuildingId);
      if (b && !b.dead) {
        var r = buildingObstacleRect(b, s, 8);
        if (x >= r.l && x <= r.r && y >= r.t && y <= r.b) return false;
      }
    }
    return false;
  }

  function clearNav(u) {
    u._navPath = null;
    u._navGoal = null;
    u._navIdx = 0;
    u._navStuckT = 0;
  }

  function wouldEnterWater(s, ux, uy, vx, vy, dt) {
    var grid = s.map && s.map.terrainGrid;
    if (!grid || !RTS.Terrain) return false;
    var nx = ux + vx * dt, ny = uy + vy * dt;
    return RTS.Terrain.isWater(grid, nx, ny);
  }

  function directMoveToward(s, u, tx, ty, dt, stop) {
    var dx = tx - u.x, dy = ty - u.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d <= stop) { u.vx = 0; u.vy = 0; return; }
    var vx = dx / d * u.speed, vy = dy / d * u.speed;
    if (s && wouldEnterWater(s, u.x, u.y, vx, vy, dt)) {
      u.vx = 0; u.vy = 0;
      return;
    }
    u.vx = vx;
    u.vy = vy;
    u.facing = Math.atan2(dy, dx);
  }

  function moveToward(s, u, tx, ty, dt, stop, opts) {
    opts = opts || {};
    stop = stop == null ? 6 : stop;
    var gx = opts.chasing ? Math.round(tx / 56) * 56 : Math.round(tx);
    var gy = opts.chasing ? Math.round(ty / 56) * 56 : Math.round(ty);
    var goalKey = gx + ',' + gy + ',' + (opts.skipBuildingId || '');
    var dGoal = dist(u.x, u.y, tx, ty);
    if (dGoal <= stop) {
      u.vx = 0; u.vy = 0;
      clearNav(u);
      return;
    }

    var needPlan = u._navGoal !== goalKey || u._navPath == null;
    if (opts.chasing && u._navPath && u._navPath.length) {
      u._navReplan = (u._navReplan || 0) - dt;
      needPlan = needPlan && u._navReplan <= 0;
    }

    if (needPlan) {
      u._navPath = findPath(s, u.x, u.y, tx, ty, opts);
      if (u._navPath === null) u._navPath = [];
      u._navGoal = goalKey;
      u._navIdx = 0;
      u._navStuckT = 0;
      u._navLastX = u.x;
      u._navLastY = u.y;
      u._navReplan = opts.chasing ? 0.35 : 0;
    }

    if (dist(u.x, u.y, u._navLastX, u._navLastY) < 2.5) {
      u._navStuckT = (u._navStuckT || 0) + dt;
    } else {
      u._navStuckT = 0;
      u._navLastX = u.x;
      u._navLastY = u.y;
    }
    if (u._navStuckT > STUCK_REPLAN) {
      u._navPath = findPath(s, u.x, u.y, tx, ty, opts) || [];
      u._navIdx = 0;
      u._navStuckT = 0;
    }

    var wx = tx, wy = ty, finalStop = stop;
    if (u._navPath.length) {
      while (u._navIdx < u._navPath.length - 1) {
        var wp = u._navPath[u._navIdx];
        if (dist(u.x, u.y, wp.x, wp.y) < WAYPOINT_R) u._navIdx++;
        else break;
      }
      var cur = u._navPath[u._navIdx];
      wx = cur.x;
      wy = cur.y;
      if (u._navIdx < u._navPath.length - 1) finalStop = 8;
    }

    directMoveToward(s, u, wx, wy, dt, finalStop);
  }

  RTS.Pathfind = {
    CELL: CELL,
    markDirty: function (s) {
      if (s) {
        s._navDirty = true;
        s._navBySkip = null;
      }
    },
    clearNav: clearNav,
    findPath: findPath,
    moveToward: moveToward,
  };
})(window.RTS = window.RTS || {});
