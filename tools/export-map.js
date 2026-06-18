#!/usr/bin/env node
/**
 * export-map.js — generate sapphire-shores.tmj (Tiled 1.6 JSON) from map data.
 *
 * Usage:  node tools/export-map.js
 * Output: assets/maps/sapphire-shores.tmj
 *         assets/maps/terrain-grass.tsj  (tileset JSON)
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ── Map constants ────────────────────────────────────────────────────────────
const COLS      = 48;
const ROWS      = 30;
const LEFT_COLS = 24;
const TILE      = 64;
const WATER     = -1;
const FLAT      = 0;
const HIGH      = 1;

// ── Left-half terrain data (verbatim from sapphire-mapgen.js) ────────────────
const LEFT_HEIGHTS = new Int8Array([
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
  -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
]);

const LEFT_FOREST = new Uint8Array([
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
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
]);

// ── Autotile ─────────────────────────────────────────────────────────────────
// 4-neighbor bitmask (N=1,E=2,S=4,W=8) → tile number 1-16
const GUIDE_TILE = [16,12,13,9, 4,8,1,5, 15,11,14,10, 3,7,2,6];
const TILESET_COLS = 9; // Tilemap_color1.png = 576px wide ÷ 64px

const CLIFF = {
  S:  { col: 0, row: 4 },
  N:  { col: 3, row: 4 },
  E:  { col: 5, row: 4 },
  W:  { col: 6, row: 4 },
  SE: { col: 7, row: 4 },
  SW: { col: 8, row: 4 },
};

function gid(col, row) {
  return 1 + row * TILESET_COLS + col;
}

function autotileGid(bit, blockCol, blockRow) {
  const tileNum = GUIDE_TILE[bit] || 5;
  const i = tileNum - 1;
  return gid(blockCol + (i % 4), blockRow + (i >> 2));
}

// ── Mirror left half to full grid ────────────────────────────────────────────
function mirrorGrid(left, typed) {
  const out = new typed(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < LEFT_COLS; c++) {
      const v = left[c + r * LEFT_COLS];
      out[c + r * COLS] = v;
      out[(COLS - 1 - c) + r * COLS] = v;
    }
  }
  return out;
}

const heights = mirrorGrid(LEFT_HEIGHTS, Int8Array);
const forest  = mirrorGrid(LEFT_FOREST,  Uint8Array);

// ── Helpers ───────────────────────────────────────────────────────────────────
function heightAt(cx, cy) {
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return WATER;
  return heights[cx + cy * COLS];
}

function isLand(h) { return h >= FLAT; }

function flatBitmask(cx, cy) {
  let b = 0;
  if (isLand(heightAt(cx, cy - 1))) b |= 1;
  if (isLand(heightAt(cx + 1, cy))) b |= 2;
  if (isLand(heightAt(cx, cy + 1))) b |= 4;
  if (isLand(heightAt(cx - 1, cy))) b |= 8;
  return b;
}

function highBitmask(cx, cy) {
  let b = 0;
  if (heightAt(cx, cy - 1) === HIGH) b |= 1;
  if (heightAt(cx + 1, cy) === HIGH) b |= 2;
  if (heightAt(cx, cy + 1) === HIGH) b |= 4;
  if (heightAt(cx - 1, cy) === HIGH) b |= 8;
  return b;
}

// ── Build layer data arrays ───────────────────────────────────────────────────
const groundData = new Array(COLS * ROWS).fill(0);
const highData   = new Array(COLS * ROWS).fill(0);
const cliffData  = new Array(COLS * ROWS).fill(0);
const forestObjs = [];

for (let cy = 0; cy < ROWS; cy++) {
  for (let cx = 0; cx < COLS; cx++) {
    const i = cx + cy * COLS;
    const h = heights[i];

    if (h === FLAT) {
      groundData[i] = autotileGid(flatBitmask(cx, cy), 0, 0);
    } else if (h === HIGH) {
      highData[i] = autotileGid(highBitmask(cx, cy), 5, 0);

      // Primary cliff: pick one direction to overlay (S > W > E > N)
      const ss = heightAt(cx, cy + 1);
      const n  = heightAt(cx, cy - 1);
      const e  = heightAt(cx + 1, cy);
      const w  = heightAt(cx - 1, cy);
      const ne = heightAt(cx + 1, cy - 1);
      const nw = heightAt(cx - 1, cy - 1);
      const se = heightAt(cx + 1, cy + 1);
      const sw = heightAt(cx - 1, cy + 1);

      let cliffCell = CLIFF.N; // default
      if (ss < HIGH)                        cliffCell = (ss === WATER) ? CLIFF.SW : CLIFF.S;
      else if (n < HIGH)                    cliffCell = CLIFF.N;
      else if (e < HIGH && ne < HIGH && se < HIGH) cliffCell = (e === WATER) ? CLIFF.SE : CLIFF.E;
      else if (w < HIGH && nw < HIGH && sw < HIGH) cliffCell = (w === WATER) ? CLIFF.SW : CLIFF.W;
      else cliffCell = null;

      if (cliffCell) cliffData[i] = gid(cliffCell.col, cliffCell.row);
    }

    // Forest objects layer
    if (forest[i]) {
      forestObjs.push({
        id: forestObjs.length + 1,
        name: 'tree',
        type: 'tree',
        visible: true,
        x: cx * TILE,
        y: cy * TILE,
        width: TILE,
        height: TILE,
        properties: [],
      });
    }
  }
}

// ── Point-of-interest objects (from sapphire-mapgen) ─────────────────────────
const poiObjs = [
  { id: 2001, name: 'player_base', type: 'spawn_player', x: 544,  y: 330, width: 128, height: 128, visible: true, properties: [] },
  { id: 2002, name: 'enemy_base',  type: 'spawn_enemy',  x: 2527, y: 330, width: 128, height: 128, visible: true, properties: [] },
  { id: 2003, name: 'gold_1', type: 'gold_node', x: 395,  y: 153,  width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 2800 }] },
  { id: 2004, name: 'gold_2', type: 'gold_node', x: 523,  y: 1298, width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 2600 }] },
  { id: 2005, name: 'gold_3', type: 'gold_node', x: 1487, y: 1266, width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 3200 }] },
  { id: 2006, name: 'gold_4', type: 'gold_node', x: 2676, y: 153,  width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 2800 }] },
  { id: 2007, name: 'gold_5', type: 'gold_node', x: 2548, y: 1298, width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 2600 }] },
  { id: 2008, name: 'gold_6', type: 'gold_node', x: 1584, y: 1266, width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 3200 }] },
];

// ── Build Tiled JSON ──────────────────────────────────────────────────────────
const tmap = {
  version: '1.6',
  tiledversion: '1.10.2',
  type: 'map',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  width: COLS,
  height: ROWS,
  tilewidth: TILE,
  tileheight: TILE,
  infinite: false,
  backgroundcolor: '#1a2a4a',
  nextlayerid: 10,
  nextobjectid: 3000,
  tilesets: [
    {
      firstgid: 1,
      name: 'terrain-grass',
      tilewidth: TILE,
      tileheight: TILE,
      spacing: 0,
      margin: 0,
      columns: TILESET_COLS,
      tilecount: TILESET_COLS * 6,
      image: '../tiny-swords/Terrain/Tileset/Tilemap_color1.png',
      imagewidth: TILESET_COLS * TILE,
      imageheight: 6 * TILE,
    },
  ],
  layers: [
    {
      id: 1,
      name: 'ground',
      type: 'tilelayer',
      visible: true,
      opacity: 1,
      x: 0, y: 0,
      width: COLS,
      height: ROWS,
      data: groundData,
    },
    {
      id: 2,
      name: 'elevated',
      type: 'tilelayer',
      visible: true,
      opacity: 1,
      x: 0, y: 0,
      width: COLS,
      height: ROWS,
      data: highData,
    },
    {
      id: 3,
      name: 'cliffs',
      type: 'tilelayer',
      visible: true,
      opacity: 1,
      x: 0, y: 0,
      width: COLS,
      height: ROWS,
      data: cliffData,
    },
    {
      id: 4,
      name: 'forest',
      type: 'objectgroup',
      visible: true,
      opacity: 1,
      x: 0, y: 0,
      objects: forestObjs,
    },
    {
      id: 5,
      name: 'spawns',
      type: 'objectgroup',
      visible: true,
      opacity: 1,
      x: 0, y: 0,
      objects: poiObjs,
    },
  ],
};

// ── Tileset JSON (external .tsj file referenced by the map) ──────────────────
const tsj = {
  version: '1.6',
  tiledversion: '1.10.2',
  type: 'tileset',
  name: 'terrain-grass',
  tilewidth: TILE,
  tileheight: TILE,
  spacing: 0,
  margin: 0,
  columns: TILESET_COLS,
  tilecount: TILESET_COLS * 6,
  image: '../tiny-swords/Terrain/Tileset/Tilemap_color1.png',
  imagewidth: TILESET_COLS * TILE,
  imageheight: 6 * TILE,
};

// ── Write output ─────────────────────────────────────────────────────────────
const outDir = path.resolve(__dirname, '../assets/maps');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'sapphire-shores.tmj'), JSON.stringify(tmap, null, 2));
fs.writeFileSync(path.join(outDir, 'terrain-grass.tsj'),   JSON.stringify(tsj,  null, 2));

console.log(`✓  assets/maps/sapphire-shores.tmj  (${COLS}×${ROWS} tiles)`);
console.log(`✓  assets/maps/terrain-grass.tsj`);
console.log(`\nOpen assets/maps/sapphire-shores.tmj in Tiled to sculpt the terrain.`);
