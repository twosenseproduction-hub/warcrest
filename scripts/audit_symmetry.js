#!/usr/bin/env node
/**
 * Symmetry + topology audit for Sapphire Shores.
 *
 * 1. Every tile (row, col) with col < cols/2 must match mirror (row, cols-1-col)
 *    for height and forestWall (player color ignored).
 * 2. BFS blue castle → red castle over passable land (not water, not forestWall) — MUST reach.
 * 3. Same BFS with blue_land corridor removed — MUST NOT reach.
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
const HALF = 24;

function makeSandbox() {
  return {
    console: console,
    window: {
      innerWidth: 1280,
      matchMedia: function () { return { matches: false }; },
    },
    RTS: {},
  };
}

function loadRtsScript(rel, sandbox) {
  sandbox.window = sandbox.window || {};
  sandbox.window.RTS = sandbox.RTS;
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
  const key = (r, c) => r + ',' + c;

  function passable(row, col) {
    if (row < 0 || col < 0 || row >= rows || col >= cols) return false;
    if (extraBlocked[key(row, col)]) return false;
    const i = tileIdx(cols, col, row);
    if (heights[i] === WATER) return false;
    if (forestWall && forestWall[i]) return false;
    return heights[i] >= FLAT;
  }

  if (!passable(start.row, start.col)) {
    return { ok: false, reason: 'start blocked', visited: 0 };
  }
  if (!passable(goal.row, goal.col)) {
    return { ok: false, reason: 'goal blocked', visited: 0 };
  }

  const queue = [[start.row, start.col]];
  const seen = {};
  seen[key(start.row, start.col)] = true;
  let head = 0;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (head < queue.length) {
    const [r, c] = queue[head++];
    if (r === goal.row && c === goal.col) {
      return { ok: true, visited: Object.keys(seen).length };
    }
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      const nk = key(nr, nc);
      if (seen[nk]) continue;
      if (!passable(nr, nc)) continue;
      seen[nk] = true;
      queue.push([nr, nc]);
    }
  }

  return { ok: false, reason: 'no path', visited: Object.keys(seen).length };
}

function checkSymmetry(heights, forestWall, cols, rows) {
  const mismatches = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < HALF; col++) {
      const mc = cols - 1 - col;
      const li = tileIdx(cols, col, row);
      const ri = tileIdx(cols, mc, row);
      if (heights[li] !== heights[ri]) {
        mismatches.push({
          row, col, mirrorCol: mc,
          left: heights[li], right: heights[ri],
          field: 'height',
        });
      }
      const lfw = forestWall ? forestWall[li] : 0;
      const rfw = forestWall ? forestWall[ri] : 0;
      if (lfw !== rfw) {
        mismatches.push({
          row, col, mirrorCol: mc,
          left: lfw, right: rfw,
          field: 'forestWall',
        });
      }
    }
  }
  return mismatches;
}

function corridorBlockedMap(tz) {
  const blocked = {};
  for (const t of tz.corridorList()) blocked[t[0] + ',' + t[1]] = true;
  return blocked;
}

function main() {
  const sandbox = makeSandbox();
  sandbox.window.RTS = sandbox.RTS;
  const RTS = loadRtsScript('src/config.js', sandbox);
  loadRtsScript('src/size-ref.js', sandbox);
  loadRtsScript('src/terraform-zones.js', sandbox);
  loadRtsScript('src/sapphire-mapgen.js', sandbox);
  loadRtsScript('src/terrain.js', sandbox);

  const mg = RTS.SapphireMapgen;
  const tz = RTS.TerraformZones;
  if (!mg || !tz) {
    console.error('Missing SapphireMapgen or TerraformZones');
    process.exit(2);
  }

  const grid = RTS.Terrain.buildGrid(mg.world.w, mg.world.h, {
    theme: 'grass',
    tileset: 'color1',
    terrainMask: { cols: mg.cols, rows: mg.rows, heights: mg.heights },
    applyTerraform: true,
  });

  const start = worldToTile(mg.playerBase.x, mg.playerBase.y);
  const goal = worldToTile(mg.enemyBase.x, mg.enemyBase.y);

  console.log('=== Warcrest symmetry audit (Sapphire Shores) ===');
  console.log('Grid:', grid.cols + 'x' + grid.rows);
  console.log('Blue castle:', start.row + ',' + start.col, 'Red castle:', goal.row + ',' + goal.col);
  console.log('');

  let allPass = true;

  const mismatches = checkSymmetry(grid.heights, grid.forestWall, grid.cols, grid.rows);
  console.log('Test 1 — tile symmetry (col < 24 vs mirror):');
  if (mismatches.length === 0) {
    console.log('  PASS — all', HALF * grid.rows, 'left-half tiles match mirror');
  } else {
    allPass = false;
    console.log('  FAIL —', mismatches.length, 'mismatch(es):');
    mismatches.slice(0, 20).forEach(function (m) {
      console.log('   ', m.field, 'row', m.row, 'col', m.col, 'vs', m.mirrorCol, ':', m.left, '!=', m.right);
    });
    if (mismatches.length > 20) console.log('    ... and', mismatches.length - 20, 'more');
  }

  const t2 = bfsReachable(grid.heights, grid.forestWall, grid.cols, grid.rows, start, goal);
  console.log('');
  console.log('Test 2 — BFS with corridor (land, not forestWall):');
  if (t2.ok) {
    console.log('  PASS — reachable,', t2.visited, 'tiles visited');
  } else {
    allPass = false;
    console.log('  FAIL —', t2.reason, '(visited', t2.visited + ')');
  }

  const corridorBlock = corridorBlockedMap(tz);
  const t3 = bfsReachable(grid.heights, grid.forestWall, grid.cols, grid.rows, start, goal, corridorBlock);
  console.log('');
  console.log('Test 3 — BFS with corridor removed:');
  if (!t3.ok) {
    console.log('  PASS — not reachable (' + t3.reason + ')');
  } else {
    allPass = false;
    console.log('  FAIL — still reachable without corridor');
  }

  console.log('');
  console.log(allPass ? 'OVERALL: PASS' : 'OVERALL: FAIL');
  process.exit(allPass ? 0 : 1);
}

main();
