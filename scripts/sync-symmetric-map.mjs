#!/usr/bin/env node
/**
 * Regenerate src/sapphire-mapgen.js and src/terraform-zones.js from
 * data/symmetric_zones.json. Left-half terrain is embedded; right half
 * is computed at load time via horizontal mirror.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const COLS = 48, ROWS = 30, LEFT = 24;

const zones = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/symmetric_zones.json'), 'utf8'));

const sandbox = {
  console,
  window: { innerWidth: 1280, matchMedia: () => ({ matches: false }) },
  RTS: {},
};
sandbox.window.RTS = sandbox.RTS;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/sapphire-mapgen.js'), 'utf8'), sandbox);

const old = sandbox.RTS.SapphireMapgen;
const leftH = [], leftF = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < LEFT; c++) {
    leftH.push(old.heights[c + r * COLS]);
    leftF.push(old.forest[c + r * COLS]);
  }
}

const goldAmounts = [
  [395, 153, 2800], [190, 867, 2700], [523, 1298, 2600], [1487, 1266, 3200],
  [2676, 153, 2800], [2881, 867, 2700], [2548, 1298, 2600], [1584, 1266, 3200],
];
const gold = zones.gold_sources_world_px.map(([x, y]) => {
  const m = goldAmounts.find((g) => g[0] === x && g[1] === y);
  return { x, y, amount: m ? m[2] : 2800 };
});

function arrStr(arr, name, typed) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += 24) {
    chunks.push('      ' + arr.slice(i, i + 24).join(','));
  }
  return `  var ${name} = new ${typed}([\n${chunks.join(',\n')}\n    ]);`;
}

const mapgen = `/* Symmetric Sapphire Shores — left half canonical, right = mirror. Zones: data/symmetric_zones.json */
(function (RTS) {
  'use strict';
  var COLS = 48, ROWS = 30, LEFT_COLS = 24, TILE = 64;

${arrStr(leftH, 'LEFT_HEIGHTS', 'Int8Array')}
${arrStr(leftF, 'LEFT_FOREST', 'Uint8Array')}

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
    playerBase: { x: ${zones.start_locations_world_px[0][0]}, y: ${zones.start_locations_world_px[0][1]} },
    enemyBase: { x: ${zones.start_locations_world_px[1][0]}, y: ${zones.start_locations_world_px[1][1]} },
    gold: ${JSON.stringify(gold, null, 6).replace(/^/gm, '    ').trim()},
    mirrorCol: function (col) { return (COLS - 1) - col; },
    symmetric: true,
  };
})(typeof window !== 'undefined' ? (window.RTS = window.RTS || {}) : {});
`;

const terraform = `/* Terraform zones — data/symmetric_zones.json (already mirrored; no expandSymmetric) */
(function (RTS) {
  'use strict';
  var COLS = 48;
  var ROWS = 30;
  var RAW = ${JSON.stringify({
    red_water_tiles: zones.red_water_tiles,
    blue_land_tiles: zones.blue_land_tiles,
    green_forest_tiles: zones.green_forest_tiles,
  }, null, 4).replace(/^/gm, '  ')};

  function tileKey(row, col) { return row + ',' + col; }
  function tilesToSet(tiles) {
    var set = {}, i;
    for (i = 0; i < tiles.length; i++) set[tileKey(tiles[i][0], tiles[i][1])] = true;
    return set;
  }
  function setToList(set) {
    var out = [], k, parts;
    for (k in set) {
      if (!set.hasOwnProperty(k)) continue;
      parts = k.split(',');
      out.push([parseInt(parts[0], 10), parseInt(parts[1], 10)]);
    }
    return out;
  }
  var WATER = -1;
  var FLAT = 0;
  function idx(cols, col, row) { return col + row * cols; }

  function applyToHeights(heights, cols, rows, zones, forestWallOut) {
    var r, c, i, k, parts;
    var water = zones.water;
    var corridor = zones.corridor;
    var forest = zones.forest;
    for (k in water) {
      if (!water.hasOwnProperty(k)) continue;
      parts = k.split(',');
      r = parseInt(parts[0], 10); c = parseInt(parts[1], 10);
      if (r >= 0 && r < rows && c >= 0 && c < cols) heights[idx(cols, c, r)] = WATER;
    }
    for (k in corridor) {
      if (!corridor.hasOwnProperty(k)) continue;
      parts = k.split(',');
      r = parseInt(parts[0], 10); c = parseInt(parts[1], 10);
      if (r >= 0 && r < rows && c >= 0 && c < cols) heights[idx(cols, c, r)] = FLAT;
    }
    for (k in forest) {
      if (!forest.hasOwnProperty(k)) continue;
      parts = k.split(',');
      r = parseInt(parts[0], 10); c = parseInt(parts[1], 10);
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        i = idx(cols, c, r);
        heights[i] = FLAT;
        if (forestWallOut) forestWallOut[i] = 1;
      }
    }
  }

  function buildForestWallMask(cols, rows, forestSet) {
    var fw = new Uint8Array(cols * rows);
    var k, parts, r, c;
    for (k in forestSet) {
      if (!forestSet.hasOwnProperty(k)) continue;
      parts = k.split(',');
      r = parseInt(parts[0], 10); c = parseInt(parts[1], 10);
      if (r >= 0 && r < rows && c >= 0 && c < cols) fw[idx(cols, c, r)] = 1;
    }
    return fw;
  }

  var expanded = {
    water: tilesToSet(RAW.red_water_tiles),
    corridor: tilesToSet(RAW.blue_land_tiles),
    forest: tilesToSet(RAW.green_forest_tiles),
  };
  var forestWallMask = buildForestWallMask(COLS, ROWS, expanded.forest);

  function isCorridorTile(row, col) { return !!expanded.corridor[tileKey(row, col)]; }
  function isForestWallTile(row, col) { return !!expanded.forest[tileKey(row, col)]; }
  function isAdjacentToCorridor(row, col) {
    return isCorridorTile(row - 1, col) || isCorridorTile(row + 1, col) ||
      isCorridorTile(row, col - 1) || isCorridorTile(row, col + 1);
  }
  function decorOnCorridor(wx, wy, tileSize) {
    tileSize = tileSize || 64;
    return isCorridorTile(Math.floor(wy / tileSize), Math.floor(wx / tileSize));
  }

  RTS.TerraformZones = {
    cols: COLS,
    rows: ROWS,
    raw: RAW,
    expanded: expanded,
    forestWallMask: forestWallMask,
    applyToHeights: applyToHeights,
    isCorridorTile: isCorridorTile,
    isForestWallTile: isForestWallTile,
    isAdjacentToCorridor: isAdjacentToCorridor,
    decorOnCorridor: decorOnCorridor,
    corridorList: function () { return setToList(expanded.corridor); },
    forestList: function () { return setToList(expanded.forest); },
  };
})(typeof window !== 'undefined' ? (window.RTS = window.RTS || {}) : {});
`;

fs.writeFileSync(path.join(ROOT, 'src/sapphire-mapgen.js'), mapgen);
fs.writeFileSync(path.join(ROOT, 'src/terraform-zones.js'), terraform);
console.log('Synced sapphire-mapgen.js and terraform-zones.js from data/symmetric_zones.json');
