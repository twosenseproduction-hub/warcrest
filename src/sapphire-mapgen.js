/* Symmetric Sapphire Shores — left half canonical, right = mirror. Zones: data/symmetric_zones.json */
(function (RTS) {
  'use strict';
  var COLS = 48, ROWS = 30, LEFT_COLS = 24, TILE = 64;

  var LEFT_HEIGHTS = new Int8Array([
      -1,-1,-1,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,-1,-1,-1,
      -1,-1,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,0,0,0,-1,0,0,0,0,
      -1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
      -1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,
      -1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,0,0,0,
      -1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,-1,-1,0,0,0,
      -1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,0,0,
      -1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,0,0,0,0,0,0,
      -1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,-1,-1,0,0,0,0,0,0,0,
      -1,-1,-1,-1,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,0,0,0,0,0,0,0,
      -1,-1,-1,-1,0,0,0,0,0,0,0,0,0,-1,-1,-1,0,0,0,0,0,0,0,0,
      -1,-1,-1,-1,-1,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,
      -1,-1,-1,-1,-1,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,
      -1,0,0,0,0,-1,-1,-1,-1,-1,0,0,-1,0,0,0,-1,-1,0,0,0,0,0,0,
      -1,0,0,0,-1,-1,-1,0,0,0,0,0,-1,0,0,0,-1,-1,-1,0,0,0,0,0,
      -1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,0,
      -1,-1,0,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,
      -1,-1,0,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,0,0,
      -1,-1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,0,0,
      -1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,0,0,0,
      -1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,
      -1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,
      -1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,0,0,0,0,
      -1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,-1,-1,0,0,-1,-1,-1,-1,0,0,0,
      -1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,-1,-1,0,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
    ]);
  var LEFT_FOREST = new Uint8Array([
      0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,
      0,0,1,1,1,0,1,1,1,1,0,0,0,0,0,0,1,1,1,0,1,1,1,1,
      0,0,1,1,0,0,0,0,1,1,1,1,1,0,0,0,1,1,1,1,0,0,1,1,
      0,0,1,1,1,0,0,0,1,1,1,1,1,1,1,1,0,0,1,0,0,0,0,0,
      0,0,1,1,1,1,1,0,0,1,1,1,1,1,1,1,0,0,0,0,0,1,0,0,
      0,0,0,1,1,1,1,0,0,1,1,1,1,1,1,1,1,0,0,0,0,1,0,0,
      0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,
      0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,0,0,1,
      0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,
      0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,
      0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,
      0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,
      0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,
      0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,1,1,1,0,0,
      0,0,0,0,0,0,0,0,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
      0,0,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
      0,0,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
      0,0,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,
      0,0,0,1,0,1,1,1,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
      0,0,0,0,0,0,1,0,0,0,1,1,1,1,1,1,1,1,0,0,1,1,0,0,
      0,0,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,0,0,0,1,1,1,0,
      0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,1,0,0,0,0,0,1,1,1,
      0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,0,
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
    ]);

  function mirrorGrid(left, leftCols, fullCols, rows, Typed) {
    var out = new Typed(fullCols * rows);
    var r, c, v, mc;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < leftCols; c++) {
        v = left[c + r * leftCols];
        out[c + r * fullCols] = v;
        mc = (fullCols - 1) - c;
        out[mc + r * fullCols] = v;
      }
    }
    return out;
  }

  var heights = mirrorGrid(LEFT_HEIGHTS, LEFT_COLS, COLS, ROWS, Int8Array);
  var forest = mirrorGrid(LEFT_FOREST, LEFT_COLS, COLS, ROWS, Uint8Array);

  RTS.SapphireMapgen = {
    cols: COLS,
    rows: ROWS,
    tile: TILE,
    world: { w: COLS * TILE, h: ROWS * TILE },
    heights: heights,
    forest: forest,
    treeDensity: 0.72,
    treeSeed: 42,
    playerBase: { x: 544, y: 330 },
    enemyBase: { x: 2527, y: 330 },
    gold: [
          {
                "x": 395,
                "y": 153,
                "amount": 2800
          },
          {
                "x": 523,
                "y": 1298,
                "amount": 2600
          },
          {
                "x": 1487,
                "y": 1266,
                "amount": 3200
          },
          {
                "x": 2676,
                "y": 153,
                "amount": 2800
          },
          {
                "x": 2548,
                "y": 1298,
                "amount": 2600
          },
          {
                "x": 1584,
                "y": 1266,
                "amount": 3200
          }
    ],
    mirrorCol: function (col) { return (COLS - 1) - col; },
    symmetric: true,
  };

  /* ──────────────────────────────────────────────────────────────────────────
   * parseSapphireTMJ(tmj) — rebuild the mapgen data from a Tiled JSON map so the
   * .tmj is the source of truth for gameplay. Terrain shape (and therefore
   * pathing + shoreline trees), base positions, and gold nodes all come from the
   * map file. Editing assets/maps/sapphire-shores.tmj in Tiled / Phaser Editor
   * now drives the match. Returns null on malformed input so callers can fall
   * back to the built-in data above.
   *
   * Encoding (see tools/export-map.js):
   *   ground   tilelayer : non-zero  → flat land (height 0)
   *   elevated tilelayer : non-zero  → high land (height 1)
   *   (neither)          : water (height -1)
   *   forest   objectgroup : one object per forested tile
   *   spawns   objectgroup : spawn_player / spawn_enemy / gold_node(+amount)
   * ------------------------------------------------------------------------- */
  function parseSapphireTMJ(tmj) {
    if (!tmj || !tmj.layers || !tmj.width || !tmj.height) return null;
    var cols = tmj.width | 0, rows = tmj.height | 0;
    var tile = (tmj.tilewidth | 0) || TILE;
    var n = cols * rows;

    function tileLayer(name) {
      for (var i = 0; i < tmj.layers.length; i++) {
        var L = tmj.layers[i];
        if (L.type === 'tilelayer' && L.name === name) return L.data || null;
      }
      return null;
    }
    function objLayer(name) {
      for (var i = 0; i < tmj.layers.length; i++) {
        var L = tmj.layers[i];
        if (L.type === 'objectgroup' && L.name === name) return L.objects || [];
      }
      return [];
    }

    var ground = tileLayer('ground');
    var elevated = tileLayer('elevated');
    if (!ground || ground.length < n) return null;

    var heights = new Int8Array(n);
    for (var i = 0; i < n; i++) {
      if (elevated && elevated[i]) heights[i] = 1;
      else if (ground[i]) heights[i] = 0;
      else heights[i] = -1;
    }

    var forest = new Uint8Array(n);
    objLayer('forest').forEach(function (o) {
      var c = Math.floor((o.x + (o.width || 0) * 0.5) / tile);
      var r = Math.floor((o.y + (o.height || 0) * 0.5) / tile);
      if (c >= 0 && r >= 0 && c < cols && r < rows) forest[c + r * cols] = 1;
    });

    // Ramps — passable breaks in cliff walls (object layer, like forest).
    var ramp = new Uint8Array(n);
    objLayer('ramps').forEach(function (o) {
      var c = Math.floor((o.x + (o.width || 0) * 0.5) / tile);
      var r = Math.floor((o.y + (o.height || 0) * 0.5) / tile);
      if (c >= 0 && r >= 0 && c < cols && r < rows) ramp[c + r * cols] = 1;
    });

    // Shallows — wadeable shallow-water fords: walkable FLAT tiles rendered as
    // shallow water (object layer, like ramps).
    var shallow = new Uint8Array(n);
    objLayer('shallows').forEach(function (o) {
      var c = Math.floor((o.x + (o.width || 0) * 0.5) / tile);
      var r = Math.floor((o.y + (o.height || 0) * 0.5) / tile);
      if (c >= 0 && r >= 0 && c < cols && r < rows) shallow[c + r * cols] = 1;
    });

    function propAmount(o) {
      if (!o.properties) return null;
      for (var i = 0; i < o.properties.length; i++) {
        if (o.properties[i].name === 'amount') return o.properties[i].value;
      }
      return null;
    }

    var playerBase = null, enemyBase = null, gold = [];
    objLayer('spawns').forEach(function (o) {
      // export-map.js stores POI x/y as world centres (not Tiled top-left).
      var pt = { x: o.x, y: o.y };
      if (o.type === 'spawn_player') playerBase = pt;
      else if (o.type === 'spawn_enemy') enemyBase = pt;
      else if (o.type === 'gold_node') {
        gold.push({ x: o.x, y: o.y, amount: propAmount(o) || 2800 });
      }
    });

    if (!playerBase || !enemyBase || !gold.length) return null;

    return {
      cols: cols,
      rows: rows,
      tile: tile,
      world: { w: cols * tile, h: rows * tile },
      heights: heights,
      forest: forest,
      ramp: ramp,
      shallow: shallow,
      treeDensity: 0.72,
      treeSeed: 42,
      playerBase: playerBase,
      enemyBase: enemyBase,
      gold: gold,
      mirrorCol: function (col) { return (cols - 1) - col; },
      symmetric: true,
      fromTMJ: true,
    };
  }

  RTS.parseSapphireTMJ = parseSapphireTMJ;
  RTS.parseMapTMJ = parseSapphireTMJ;
})(typeof window !== 'undefined' ? (window.RTS = window.RTS || {}) : {});
