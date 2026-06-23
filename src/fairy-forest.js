/* ============================================================================
 * fairy-forest.js
 * Pixel Crawler — Fairy Forest 1.7 terrain + decor for Aelindra grove maps.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var BASE = 'assets/Pixel Crawler/Pixel Crawler - Fairy Forest 1.7/Assets/';
  var TILE_CELL = 16;
  var GAME_TILE = 64;
  var TREE_CELL = 208;
  var PROP_CELL = 32;

  var imgs = {};
  var ready = false;

  var GRASS_TILES = [[2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [4, 2]];
  var DIRT_TILES = [[1, 3], [2, 3], [3, 3]];
  var WATER_TILES = [[8, 12], [9, 12], [10, 12], [8, 13], [9, 13], [10, 13]];

  var PROP_SLOTS = {
    flower: [[9, 0], [10, 0], [11, 0], [12, 0], [9, 1]],
    mushroom: [[6, 4], [7, 4], [6, 5], [7, 5]],
    bush: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [0, 2]],
    rock: [[3, 3], [4, 3], [5, 9], [6, 9], [3, 2]],
    vine: [[9, 5], [10, 5], [11, 5]],
    stump: [[0, 10], [1, 10], [2, 10]],
  };

  var PROP_HEIGHT = {
    flower: 64,
    mushroom: 52,
    bush: 40,
    rock: 34,
    vine: 72,
    stump: 28,
  };

  function hashId(x, y) {
    return ((x | 0) * 73856093 ^ (y | 0) * 19349663) >>> 0;
  }

  function loadImg(name) {
    return RTS.Assets.loadImg(name, BASE).then(function (img) {
      imgs[name] = img;
      return img;
    });
  }

  function pick(arr, h) {
    return arr[h % arr.length];
  }

  function drawTile(ctx, tilesImg, col, row, dx, dy, scale) {
    scale = scale || (GAME_TILE / TILE_CELL);
    var sz = TILE_CELL * scale;
    ctx.drawImage(
      tilesImg,
      col * TILE_CELL, row * TILE_CELL, TILE_CELL, TILE_CELL,
      dx, dy, sz, sz
    );
  }

  function renderTerrain(ctx, s, grid, vx, vy, vw, vh) {
    var tiles = imgs['Tiles.png'];
    var waterBg = RTS.Assets.img('Terrain/Tileset/Water Background color.png');
    if (!tiles) return false;

    var cols = grid.cols;
    var rows = grid.rows;
    var heights = grid.heights;
    var tx0 = Math.max(0, Math.floor(vx / GAME_TILE) - 1);
    var ty0 = Math.max(0, Math.floor(vy / GAME_TILE) - 1);
    var tx1 = Math.min(cols, Math.ceil((vx + vw) / GAME_TILE) + 2);
    var ty1 = Math.min(rows, Math.ceil((vy + vh) / GAME_TILE) + 2);
    var cx, cy, dx, dy, h, idx;

    for (cy = ty0; cy < ty1; cy++) {
      for (cx = tx0; cx < tx1; cx++) {
        dx = cx * GAME_TILE;
        dy = cy * GAME_TILE;
        h = heights[cx + cy * cols];
        if (h < RTS.Terrain.FLAT) {
          if (waterBg) {
            ctx.drawImage(waterBg, 0, 0, GAME_TILE, GAME_TILE, dx, dy, GAME_TILE, GAME_TILE);
          } else {
            ctx.fillStyle = '#2a6cad';
            ctx.fillRect(dx, dy, GAME_TILE, GAME_TILE);
          }
          idx = hashId(cx, cy);
          var wt = pick(WATER_TILES, idx);
          drawTile(ctx, tiles, wt[0], wt[1], dx, dy);
        } else {
          ctx.fillStyle = '#2a5230';
          ctx.fillRect(dx, dy, GAME_TILE, GAME_TILE);
          idx = hashId(cx * 3, cy * 5);
          var gt = (h > RTS.Terrain.FLAT && (idx % 17 === 0))
            ? pick(DIRT_TILES, idx)
            : pick(GRASS_TILES, idx);
          drawTile(ctx, tiles, gt[0], gt[1], dx, dy);
        }
      }
    }

    var light = imgs['Light.png'];
    if (light && s && !RTS.Config.reducedMotion) {
      ctx.save();
      ctx.globalAlpha = 0.08 + Math.sin((s.timers.gameTime || 0) * 0.4) * 0.02;
      ctx.globalCompositeOperation = 'screen';
      var lw = light.width;
      var lh = light.height;
      for (dx = tx0 * GAME_TILE; dx < tx1 * GAME_TILE; dx += lw * 0.85) {
        for (dy = ty0 * GAME_TILE; dy < ty1 * GAME_TILE; dy += lh * 0.85) {
          ctx.drawImage(light, dx - vx * 0.02, dy - vy * 0.02, lw, lh);
        }
      }
      ctx.restore();
    }
    return true;
  }

  function groundY(grid, x, y) {
    if (grid && RTS.Terrain && RTS.Terrain.groundY) return RTS.Terrain.groundY(grid, x, y);
    return y;
  }

  function drawTree(ctx, d, s) {
    var img = imgs['Tree.png'];
    if (!img) return;
    var idx = d.spriteIdx != null ? d.spriteIdx : 0;
    var col = idx % 6;
    var row = Math.floor(idx / 6);
    var sx = col * TREE_CELL;
    var sy = row * TREE_CELL;
    if (sx + TREE_CELL > img.width || sy + TREE_CELL > img.height) return;

    var targetH = d.targetH || (200 - col * 28);
    var sc = targetH / TREE_CELL;
    var w = TREE_CELL * sc;
    var ht = TREE_CELL * sc;
    var footY = groundY(s && s.map && s.map.terrainGrid, d.x, d.y);

    if (RTS.Art && RTS.Art.drawShadow) {
      RTS.Art.drawShadow(ctx, d.x, footY + ht * 0.06, (d.r || 24) * 1.1, 0.28);
    }
    ctx.drawImage(img, sx, sy, TREE_CELL, TREE_CELL, d.x - w / 2, footY - ht * 0.88, w, ht);
  }

  function drawProp(ctx, d, s) {
    var img = imgs['Props.png'];
    if (!img) return;
    var slots = PROP_SLOTS[d.prop] || PROP_SLOTS.bush;
    var h = hashId(d.x, d.y);
    var slot = slots[d.variant != null ? d.variant % slots.length : h % slots.length];
    var sx = slot[0] * PROP_CELL;
    var sy = slot[1] * PROP_CELL;
    if (sx + PROP_CELL > img.width || sy + PROP_CELL > img.height) return;

    var targetH = d.targetH || PROP_HEIGHT[d.prop] || 40;
    var sc = targetH / PROP_CELL;
    var w = PROP_CELL * sc;
    var ht = PROP_CELL * sc;
    var footY = groundY(s && s.map && s.map.terrainGrid, d.x, d.y);
    var footRatio = d.prop === 'vine' ? 0.95 : (d.prop === 'flower' ? 0.82 : 0.72);

    if (RTS.Art && RTS.Art.drawShadow) {
      RTS.Art.drawShadow(ctx, d.x, footY + ht * 0.05, (d.r || 10) * 0.9, 0.22);
    }

    if (d.prop === 'flower' && !RTS.Config.reducedMotion) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#5ce8ff';
      ctx.beginPath();
      ctx.ellipse(d.x, footY - ht * 0.35, w * 0.55, ht * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(img, sx, sy, PROP_CELL, PROP_CELL, d.x - w / 2, footY - ht * footRatio, w, ht);
  }

  function drawDecor(ctx, d, s) {
    if (d.kind === 'grove_tree') {
      drawTree(ctx, d, s);
      return true;
    }
    if (d.kind === 'grove_prop') {
      drawProp(ctx, d, s);
      return true;
    }
    return false;
  }

  RTS.FairyForest = {
    BASE: BASE,
    PROP_SLOTS: PROP_SLOTS,

    load: function () {
      return Promise.all([
        loadImg('Tree.png'),
        loadImg('Tiles.png'),
        loadImg('Props.png'),
        loadImg('Light.png'),
      ]).then(function () {
        ready = true;
      }).catch(function (err) {
        console.warn('Fairy Forest assets failed to load', err);
        ready = false;
      });
    },

    isReady: function () { return ready; },

    renderTerrain: renderTerrain,
    drawDecor: drawDecor,

    treeIndex: function (row, col) {
      return row * 6 + col;
    },
  };
})(window.RTS = window.RTS || {});
