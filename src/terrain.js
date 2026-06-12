/* ============================================================================
 * EXOFRONT — terrain.js
 * Tiny Swords tilemap renderer (per Pixel Frog tilemap guide):
 *   BG water → foam → flat ground → shadow → elevated top → cliffs
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TILE = 64;
  var WATER = -1;
  var FLAT = 0;
  var HIGH = 1;

  var TILESETS = {
    color1: 'Terrain/Tileset/Tilemap_color1.png',
    color2: 'Terrain/Tileset/Tilemap_color2.png',
    color3: 'Terrain/Tileset/Tilemap_color3.png',
    color4: 'Terrain/Tileset/Tilemap_color4.png',
    color5: 'Terrain/Tileset/Tilemap_color5.png',
  };

  var THEME_TILESET = {
    grass: 'color1',
    meadow: 'color2',
    volcanic: 'color3',
    amber: 'color4',
    frost: 'color5',
  };

  /* 4-neighbor bitmask (N=1,E=2,S=4,W=8) → flat-ground tile 1–16.
   * Tile 6 = plain center fill; 1–5,7–16 = outward grass fringe toward missing sides. */
  var GUIDE_TILE = [
    16, 12, 13,  9,
     4,  8,  1,  5,
    15, 11, 14, 10,
     3,  7,  2,  6,
  ];

  /* Cliff atlas cells (cols 0–3 row 4–5 = land cliffs, 5–8 = water cliffs). */
  var CLIFF = {
    S: { col: 0, row: 4 },
    N: { col: 3, row: 4 },
    E: { col: 5, row: 4 },
    W: { col: 6, row: 4 },
    SE: { col: 7, row: 4 },
    SW: { col: 8, row: 4 },
  };

  function idx(cols, cx, cy) { return cx + cy * cols; }

  function inBounds(cols, rows, cx, cy) {
    return cx >= 0 && cy >= 0 && cx < cols && cy < rows;
  }

  function heightAt(grid, cx, cy) {
    if (!inBounds(grid.cols, grid.rows, cx, cy)) return WATER;
    return grid.heights[idx(grid.cols, cx, cy)];
  }

  function sameLevel(grid, cx, cy, level) {
    return heightAt(grid, cx, cy) === level;
  }

  function bitmask(grid, cx, cy, level) {
    var b = 0;
    if (sameLevel(grid, cx, cy - 1, level)) b |= 1;
    if (sameLevel(grid, cx + 1, cy, level)) b |= 2;
    if (sameLevel(grid, cx, cy + 1, level)) b |= 4;
    if (sameLevel(grid, cx - 1, cy, level)) b |= 8;
    return b;
  }

  /* Flat ground: fringe only toward water/void — plateaus count as connected land. */
  function flatGroundBitmask(grid, cx, cy) {
    var b = 0;
    if (isLand(heightAt(grid, cx, cy - 1))) b |= 1;
    if (isLand(heightAt(grid, cx + 1, cy))) b |= 2;
    if (isLand(heightAt(grid, cx, cy + 1))) b |= 4;
    if (isLand(heightAt(grid, cx - 1, cy))) b |= 8;
    return b;
  }

  function guideToSrc(tileNum, blockCol, blockRow) {
    var i = (tileNum || 5) - 1;
    return {
      x: (blockCol + (i % 4)) * TILE,
      y: (blockRow + ((i / 4) | 0)) * TILE,
    };
  }

  function autotileSrc(bit, blockCol, blockRow) {
    return guideToSrc(GUIDE_TILE[bit] || 5, blockCol, blockRow);
  }

  function fillRectWorld(h, cols, rows, x, y, w, ht, level) {
    var x0 = Math.max(0, Math.floor(x / TILE));
    var y0 = Math.max(0, Math.floor(y / TILE));
    var x1 = Math.min(cols, Math.ceil((x + w) / TILE));
    var y1 = Math.min(rows, Math.ceil((y + ht) / TILE));
    for (var cy = y0; cy < y1; cy++) {
      for (var cx = x0; cx < x1; cx++) {
        h[idx(cols, cx, cy)] = level;
      }
    }
  }

  function fillCircleWorld(h, cols, rows, cxw, cyw, r, level) {
    var cx0 = Math.floor((cxw - r) / TILE);
    var cy0 = Math.floor((cyw - r) / TILE);
    var cx1 = Math.ceil((cxw + r) / TILE);
    var cy1 = Math.ceil((cyw + r) / TILE);
    var rr = r * r;
    for (var cy = cy0; cy < cy1; cy++) {
      for (var cx = cx0; cx < cx1; cx++) {
        if (!inBounds(cols, rows, cx, cy)) continue;
        var tx = cx * TILE + TILE / 2;
        var ty = cy * TILE + TILE / 2;
        if ((tx - cxw) * (tx - cxw) + (ty - cyw) * (ty - cyw) <= rr) {
          h[idx(cols, cx, cy)] = level;
        }
      }
    }
  }

  function carveBezierPath(h, cols, rows, path, level, halfW) {
    halfW = halfW || 2;
    var steps = 72;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var mt = 1 - t;
      var px = mt * mt * mt * path.x0 + 3 * mt * mt * t * path.c1x +
        3 * mt * t * t * path.c2x + t * t * t * path.x1;
      var py = mt * mt * mt * path.y0 + 3 * mt * mt * t * path.c1y +
        3 * mt * t * t * path.c2y + t * t * t * path.y1;
      fillCircleWorld(h, cols, rows, px, py, halfW * TILE, level);
    }
  }

  function applyTerrainMask(h, cols, rows, mask) {
    var mc = mask.cols, mr = mask.rows;
    var cx, cy, v;
    for (cy = 0; cy < rows; cy++) {
      for (cx = 0; cx < cols; cx++) {
        v = WATER;
        if (cx < mc && cy < mr) v = mask.heights[cx + cy * mc];
        h[cx + cy * cols] = v;
      }
    }
  }

  function buildGrid(W, H, def) {
    var cols = Math.ceil(W / TILE);
    var rows = Math.ceil(H / TILE);
    var h = new Int8Array(cols * rows);
    var i;
    for (i = 0; i < h.length; i++) h[i] = WATER;

    if (def.terrainMask) {
      applyTerrainMask(h, cols, rows, def.terrainMask);
    } else if (def.island) {
      fillRectWorld(h, cols, rows, def.island.x, def.island.y, def.island.w, def.island.h, FLAT);
    }
    if (def.plateaus) {
      def.plateaus.forEach(function (p) {
        fillCircleWorld(h, cols, rows, p.x, p.y, p.r, p.level != null ? p.level : HIGH);
      });
    }
    if (!def.terrainMask) {
      if (def.path) {
        carveBezierPath(h, cols, rows, def.path, FLAT, def.pathHalfW || 2.5);
      }
      if (def.extraFlats) {
        def.extraFlats.forEach(function (f) {
          fillCircleWorld(h, cols, rows, f.x, f.y, f.r, FLAT);
        });
      }
    }
    if (def.waterRects) {
      def.waterRects.forEach(function (r) {
        fillRectWorld(h, cols, rows, r.x, r.y, r.w, r.h, WATER);
      });
    }
    if (def.waterPools) {
      def.waterPools.forEach(function (p) {
        fillCircleWorld(h, cols, rows, p.x, p.y, p.r, WATER);
      });
    }

    return {
      cols: cols,
      rows: rows,
      heights: h,
      tileset: def.tileset || 'color1',
      theme: def.theme || 'grass',
    };
  }

  function drawAtlasTile(ctx, atlas, col, row, dx, dy) {
    ctx.drawImage(atlas, col * TILE, row * TILE, TILE, TILE, dx, dy, TILE, TILE);
  }

  function drawFoam(ctx, foam, frame, dx, dy, flip) {
    var fw = 192;
    var sx = frame * fw;
    ctx.save();
    if (flip) {
      ctx.translate(dx + fw / 2, dy + fw / 2);
      ctx.scale(-1, 1);
      ctx.translate(-(dx + fw / 2), -(dy + fw / 2));
    }
    ctx.drawImage(foam, sx, 0, fw, fw, dx - fw / 2 + TILE / 2, dy - fw / 2 + TILE / 2, fw, fw);
    ctx.restore();
  }

  function isLand(h) { return h >= FLAT; }

  function render(ctx, s, grid, vx, vy, vw, vh) {
    var Assets = RTS.Assets;
    if (!Assets || !Assets.ready) return false;

    var atlas = Assets.img(TILESETS[grid.tileset] || TILESETS.color1);
    var water = Assets.img('Terrain/Tileset/Water Background color.png');
    var foam = Assets.img('Terrain/Tileset/Water Foam.png');
    var shadow = Assets.img('Terrain/Tileset/Shadow.png');
    if (!atlas || !water) return false;

    var cols = grid.cols, rows = grid.rows;
    var tx0 = Math.max(0, Math.floor(vx / TILE) - 1);
    var ty0 = Math.max(0, Math.floor(vy / TILE) - 1);
    var tx1 = Math.min(cols, Math.ceil((vx + vw) / TILE) + 2);
    var ty1 = Math.min(rows, Math.ceil((vy + vh) / TILE) + 2);
    var t = s.timers.gameTime;
    var cx, cy, h, dx, dy, bit, src, n, e, ss, se, sw, w, ne, nw;

    /* Layer 1 — water background */
    for (cy = ty0; cy < ty1; cy++) {
      for (cx = tx0; cx < tx1; cx++) {
        if (grid.heights[idx(cols, cx, cy)] !== WATER) continue;
        dx = cx * TILE; dy = cy * TILE;
        ctx.drawImage(water, 0, 0, TILE, TILE, dx, dy, TILE, TILE);
      }
    }

    /* Layer 2 — water foam on shores */
    if (foam) {
      for (cy = ty0; cy < ty1; cy++) {
        for (cx = tx0; cx < tx1; cx++) {
          if (grid.heights[idx(cols, cx, cy)] !== WATER) continue;
          n = isLand(heightAt(grid, cx, cy - 1));
          e = isLand(heightAt(grid, cx + 1, cy));
          ss = isLand(heightAt(grid, cx, cy + 1));
          w = isLand(heightAt(grid, cx - 1, cy));
          if (!n && !e && !ss && !w) continue;
          dx = cx * TILE; dy = cy * TILE;
          var frame = ((cx * 17 + cy * 31 + (t * 6 | 0)) % 16 + 16) % 16;
          drawFoam(ctx, foam, frame, dx, dy, (cx + cy) % 2 === 0);
        }
      }
    }

    /* Layer 3 — flat ground */
    for (cy = ty0; cy < ty1; cy++) {
      for (cx = tx0; cx < tx1; cx++) {
        if (grid.heights[idx(cols, cx, cy)] !== FLAT) continue;
        bit = flatGroundBitmask(grid, cx, cy);
        src = autotileSrc(bit, 0, 0);
        dx = cx * TILE; dy = cy * TILE;
        ctx.drawImage(atlas, src.x, src.y, TILE, TILE, dx, dy, TILE, TILE);
      }
    }

    /* Layer 4 — elevated shadows (disabled) */

    /* Layer 5 — elevated tops */
    for (cy = ty0; cy < ty1; cy++) {
      for (cx = tx0; cx < tx1; cx++) {
        if (grid.heights[idx(cols, cx, cy)] !== HIGH) continue;
        bit = bitmask(grid, cx, cy, HIGH);
        src = autotileSrc(bit, 5, 0);
        dx = cx * TILE; dy = cy * TILE;
        ctx.drawImage(atlas, src.x, src.y, TILE, TILE, dx, dy, TILE, TILE);
      }
    }

    /* Layer 6 — cliff faces toward lower terrain */
    for (cy = ty0; cy < ty1; cy++) {
      for (cx = tx0; cx < tx1; cx++) {
        if (grid.heights[idx(cols, cx, cy)] !== HIGH) continue;
        dx = cx * TILE; dy = cy * TILE;
        n = heightAt(grid, cx, cy - 1);
        e = heightAt(grid, cx + 1, cy);
        ss = heightAt(grid, cx, cy + 1);
        w = heightAt(grid, cx - 1, cy);
        ne = heightAt(grid, cx + 1, cy - 1);
        nw = heightAt(grid, cx - 1, cy - 1);
        se = heightAt(grid, cx + 1, cy + 1);
        sw = heightAt(grid, cx - 1, cy + 1);

        if (ss < HIGH) {
          var c = (ss === WATER) ? CLIFF.SW : CLIFF.S;
          drawAtlasTile(ctx, atlas, c.col, c.row, dx, dy);
        }
        if (n < HIGH) {
          c = (n === WATER) ? CLIFF.N : CLIFF.N;
          drawAtlasTile(ctx, atlas, c.col, c.row, dx, dy);
        }
        if (e < HIGH && ne < HIGH && se < HIGH) {
          c = (e === WATER) ? CLIFF.SE : CLIFF.E;
          drawAtlasTile(ctx, atlas, c.col, c.row, dx, dy);
        }
        if (w < HIGH && nw < HIGH && sw < HIGH) {
          c = (w === WATER) ? CLIFF.SW : CLIFF.W;
          drawAtlasTile(ctx, atlas, c.col, c.row, dx, dy);
        }
      }
    }

    return true;
  }

  /* Smooth ground — do NOT snap to tile grid (that caused unit/building jumping). */
  function groundY(grid, wx, wy) {
    if (!grid) return wy;
    var cx = Math.floor(wx / TILE);
    var cy = Math.floor(wy / TILE);
    if (!inBounds(grid.cols, grid.rows, cx, cy)) return wy;
    var h = grid.heights[idx(grid.cols, cx, cy)];
    if (h === WATER) return wy;
    return wy + 10;
  }

  RTS.Terrain = {
    TILE: TILE,
    WATER: WATER,
    FLAT: FLAT,
    HIGH: HIGH,
    buildGrid: buildGrid,
    render: render,
    groundY: groundY,
    themeTileset: function (theme) { return THEME_TILESET[theme] || 'color1'; },
    tilesetPath: function (key) { return TILESETS[key]; },
  };

})(window.RTS = window.RTS || {});
