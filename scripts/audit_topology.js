#!/usr/bin/env node
/**
 * Topology audit for Sapphire Shores — designed single-corridor layout.
 *
 * Test 1: BFS player castle → enemy castle over passable land (not water, not forestWall) — MUST reach.
 * Test 2: Same BFS but blue_land corridor tiles removed from passable — MUST NOT reach.
 */
'use strict';

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TILE = 64;
const FLAT = 0;
const WATER = -1;

function makeSandbox() {
  const sandbox = {
    console: console,
    window: {
      innerWidth: 1280,
      matchMedia: function () { return { matches: false }; },
    },
  };
  sandbox.window.RTS = sandbox.RTS = {};
  return sandbox;
}

function loadRtsScript(rel, sandbox) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInNewContext(src, sandbox, { filename: rel });
  return sandbox.RTS;
}

function tileIdx(cols, col, row) { return col + row * cols; }

function worldToTile(x, y) {
  return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) };
}

function bfsReachable(heights, forestWall, cols, rows, start, goal, extraBlocked) {
  extraBlocked = extraBlocked || {};
  var key = function (r, c) { return r + ',' + c; };

  function passable(row, col) {
    if (row < 0 || col < 0 || row >= rows || col >= cols) return false;
    if (extraBlocked[key(row, col)]) return false;
    var i = tileIdx(cols, col, row);
    if (heights[i] === WATER) return false;
    if (forestWall && forestWall[i]) return false;
    return heights[i] >= FLAT;
  }

  if (!passable(start.row, start.col)) {
    return { ok: false, reason: 'start blocked', visited: 0, path: null };
  }
  if (!passable(goal.row, goal.col)) {
    return { ok: false, reason: 'goal blocked', visited: 0, path: null };
  }

  var queue = [[start.row, start.col]];
  var seen = {};
  seen[key(start.row, start.col)] = null;
  var head = 0;
  var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (head < queue.length) {
    var cur = queue[head++];
    var r = cur[0], c = cur[1];
    if (r === goal.row && c === goal.col) {
      var path = [];
      var k = key(r, c);
      while (k) {
        var parts = k.split(',');
        path.push([parseInt(parts[0], 10), parseInt(parts[1], 10)]);
        k = seen[k];
      }
      path.reverse();
      return { ok: true, visited: Object.keys(seen).length, path: path };
    }
    for (var d = 0; d < dirs.length; d++) {
      var nr = r + dirs[d][0], nc = c + dirs[d][1];
      var nk = key(nr, nc);
      if (seen[nk] !== undefined) continue;
      if (!passable(nr, nc)) continue;
      seen[nk] = key(r, c);
      queue.push([nr, nc]);
    }
  }

  return { ok: false, reason: 'no path', visited: Object.keys(seen).length, path: null };
}

function corridorBlockedMap(tz) {
  var blocked = {};
  var list = tz.corridorList();
  for (var i = 0; i < list.length; i++) {
    blocked[list[i][0] + ',' + list[i][1]] = true;
  }
  return blocked;
}

function main() {
  var sandbox = makeSandbox();
  var RTS = loadRtsScript('src/config.js', sandbox);
  loadRtsScript('src/size-ref.js', sandbox);
  loadRtsScript('src/terraform-zones.js', sandbox);
  loadRtsScript('src/sapphire-mapgen.js', sandbox);
  loadRtsScript('src/terrain.js', sandbox);

  var mg = RTS.SapphireMapgen;
  var tz = RTS.TerraformZones;
  if (!mg || !tz) {
    console.error('Missing SapphireMapgen or TerraformZones');
    process.exit(2);
  }

  var grid = RTS.Terrain.buildGrid(mg.world.w, mg.world.h, {
    theme: 'grass',
    tileset: 'color1',
    terrainMask: { cols: mg.cols, rows: mg.rows, heights: mg.heights },
    applyTerraform: true,
  });

  var start = worldToTile(mg.playerBase.x, mg.playerBase.y);
  var goal = worldToTile(mg.enemyBase.x, mg.enemyBase.y);

  console.log('=== Warcrest topology audit (Sapphire Shores) ===');
  console.log('Grid:', grid.cols + 'x' + grid.rows, 'tiles');
  console.log('Player castle tile:', start.row + ',' + start.col, '(world', mg.playerBase.x + ',' + mg.playerBase.y + ')');
  console.log('Enemy castle tile:', goal.row + ',' + goal.col, '(world', mg.enemyBase.x + ',' + mg.enemyBase.y + ')');
  console.log('Corridor tiles (expanded):', tz.corridorList().length);
  console.log('Forest wall tiles (expanded):', tz.forestList().length);
  console.log('Zones: symmetric_zones.json (pre-mirrored tile lists)');
  console.log('');

  var t1 = bfsReachable(grid.heights, grid.forestWall, grid.cols, grid.rows, start, goal);
  console.log('Test 1 — BFS with corridor (land, not forestWall):');
  if (t1.ok) {
    console.log('  PASS — reachable in', t1.path.length - 1, 'tile steps,', t1.visited, 'tiles visited');
  } else {
    console.log('  FAIL —', t1.reason, '(visited', t1.visited + ')');
    console.log('  Start passable:', grid.heights[tileIdx(grid.cols, start.col, start.row)] !== WATER);
    console.log('  Goal passable:', grid.heights[tileIdx(grid.cols, goal.col, goal.row)] !== WATER);
  }

  var corridorBlock = corridorBlockedMap(tz);
  var t2 = bfsReachable(grid.heights, grid.forestWall, grid.cols, grid.rows, start, goal, corridorBlock);
  console.log('');
  console.log('Test 2 — BFS with corridor tiles removed from passable:');
  if (!t2.ok) {
    console.log('  PASS — not reachable (' + t2.reason + ', visited ' + t2.visited + ')');
  } else {
    console.log('  FAIL — still reachable without corridor (' + (t2.path.length - 1) + ' steps)');
    console.log('  Alternate path sample:', t2.path.slice(0, 12).map(function (p) { return p[0] + ',' + p[1]; }).join(' → '));
  }

  console.log('');
  var allPass = t1.ok && !t2.ok;
  console.log(allPass ? 'OVERALL: PASS' : 'OVERALL: FAIL');
  process.exit(allPass ? 0 : 1);
}

main();
