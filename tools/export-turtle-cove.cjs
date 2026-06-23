#!/usr/bin/env node
/**
 * export-turtle-cove.js — Turtle Rock–style island archipelago (.tmj)
 *
 * Usage:  node tools/export-turtle-cove.js
 * Output: assets/maps/turtle-cove.tmj
 */

'use strict';
const fs = require('fs');
const path = require('path');

const COLS = 48;
const ROWS = 30;
const TILE = 64;
const WATER = -1;
const FLAT = 0;
const HIGH = 1;

const GUIDE_TILE = [16, 12, 13, 9, 4, 8, 1, 5, 15, 11, 14, 10, 3, 7, 2, 6];
const TILESET_COLS = 9;

const CLIFF = {
  S: { col: 0, row: 4 },
  N: { col: 3, row: 4 },
  E: { col: 5, row: 4 },
  W: { col: 6, row: 4 },
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

function setLand(heights, cx, cy, h) {
  if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) heights[cx + cy * COLS] = h;
}

function fillEllipse(heights, cx, cy, rx, ry, h) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setLand(heights, x, y, h);
    }
  }
}

function fillRect(heights, x0, y0, x1, y1, h) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) setLand(heights, x, y, h);
  }
}

function buildHeights() {
  const heights = new Int8Array(COLS * ROWS);
  heights.fill(WATER);

  // Four corner bases (large islands)
  fillEllipse(heights, 9, 6, 7.2, 4.8, FLAT);
  fillEllipse(heights, 39, 6, 7.2, 4.8, FLAT);
  fillEllipse(heights, 9, 23, 6.5, 4.8, FLAT);
  fillEllipse(heights, 39, 23, 6.5, 4.8, FLAT);

  // Center altar + north/south shops + side merc camps
  fillEllipse(heights, 24, 15, 3.8, 3.2, FLAT);
  fillEllipse(heights, 24, 4, 3.2, 2.4, FLAT);
  fillEllipse(heights, 24, 25, 3.2, 2.4, FLAT);
  fillEllipse(heights, 5, 15, 2.6, 3.8, FLAT);
  fillEllipse(heights, 43, 15, 2.6, 3.8, FLAT);

  // Shallow bridges (cross + corner arms)
  fillRect(heights, 23, 9, 24, 20, FLAT);
  fillRect(heights, 12, 14, 35, 15, FLAT);
  fillRect(heights, 14, 6, 22, 7, FLAT);
  fillRect(heights, 26, 6, 34, 7, FLAT);
  fillRect(heights, 14, 22, 22, 23, FLAT);
  fillRect(heights, 26, 22, 34, 23, FLAT);

  // Slight high ground on corner islands (visual plateaus)
  fillEllipse(heights, 9, 6, 3.5, 2.5, HIGH);
  fillEllipse(heights, 39, 6, 3.5, 2.5, HIGH);
  fillEllipse(heights, 9, 23, 3, 2.2, HIGH);
  fillEllipse(heights, 39, 23, 3, 2.2, HIGH);

  return heights;
}

function symCol(cols, col) {
  return col < cols / 2 ? col : cols - 1 - col;
}

function shouldForest(cx, cy, heights) {
  const i = cx + cy * COLS;
  if (heights[i] !== FLAT) return false;

  // Keep bridges and spawns open
  if (cx >= 22 && cx <= 25 && cy >= 9 && cy <= 20) return false;
  if (cy >= 14 && cy <= 15 && cx >= 11 && cx <= 36) return false;

  const avoid = [
    [9, 6], [39, 6], [9, 23], [39, 23],
    [24, 15], [24, 4], [24, 25], [5, 15], [43, 15],
    [5, 4], [43, 4], [5, 25], [43, 25],
  ];
  for (let a = 0; a < avoid.length; a++) {
    const dx = cx - avoid[a][0];
    const dy = cy - avoid[a][1];
    if (dx * dx + dy * dy < 10) return false;
  }

  const h = ((cy * 7919 + symCol(COLS, cx) * 104729 + 5107) >>> 0) % 10000;
  return h < 4200;
}

function heightAt(heights, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return WATER;
  return heights[cx + cy * COLS];
}

function isLand(h) {
  return h >= FLAT;
}

function flatBitmask(heights, cx, cy) {
  let b = 0;
  if (isLand(heightAt(heights, cx, cy - 1))) b |= 1;
  if (isLand(heightAt(heights, cx + 1, cy))) b |= 2;
  if (isLand(heightAt(heights, cx, cy + 1))) b |= 4;
  if (isLand(heightAt(heights, cx - 1, cy))) b |= 8;
  return b;
}

function highBitmask(heights, cx, cy) {
  let b = 0;
  if (heightAt(heights, cx, cy - 1) === HIGH) b |= 1;
  if (heightAt(heights, cx + 1, cy) === HIGH) b |= 2;
  if (heightAt(heights, cx, cy + 1) === HIGH) b |= 4;
  if (heightAt(heights, cx - 1, cy) === HIGH) b |= 8;
  return b;
}

const heights = buildHeights();
const forest = new Uint8Array(COLS * ROWS);

const groundData = new Array(COLS * ROWS).fill(0);
const highData = new Array(COLS * ROWS).fill(0);
const cliffData = new Array(COLS * ROWS).fill(0);
const forestObjs = [];

for (let cy = 0; cy < ROWS; cy++) {
  for (let cx = 0; cx < COLS; cx++) {
    const i = cx + cy * COLS;
    const h = heights[i];

    if (shouldForest(cx, cy, heights)) forest[i] = 1;

    if (h === FLAT) {
      groundData[i] = autotileGid(flatBitmask(heights, cx, cy), 0, 0);
    } else if (h === HIGH) {
      highData[i] = autotileGid(highBitmask(heights, cx, cy), 5, 0);

      const ss = heightAt(heights, cx, cy + 1);
      const n = heightAt(heights, cx, cy - 1);
      const e = heightAt(heights, cx + 1, cy);
      const w = heightAt(heights, cx - 1, cy);
      const ne = heightAt(heights, cx + 1, cy - 1);
      const nw = heightAt(heights, cx - 1, cy - 1);
      const se = heightAt(heights, cx + 1, cy + 1);
      const sw = heightAt(heights, cx - 1, cy + 1);

      let cliffCell = CLIFF.N;
      if (ss < HIGH) cliffCell = ss === WATER ? CLIFF.SW : CLIFF.S;
      else if (n < HIGH) cliffCell = CLIFF.N;
      else if (e < HIGH && ne < HIGH && se < HIGH) cliffCell = e === WATER ? CLIFF.SE : CLIFF.E;
      else if (w < HIGH && nw < HIGH && sw < HIGH) cliffCell = w === WATER ? CLIFF.SW : CLIFF.W;
      else cliffCell = null;

      if (cliffCell) cliffData[i] = gid(cliffCell.col, cliffCell.row);
    }

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

const poiObjs = [
  { id: 2001, name: 'player_base', type: 'spawn_player', x: 608, y: 416, width: 128, height: 128, visible: true, properties: [] },
  { id: 2002, name: 'enemy_base', type: 'spawn_enemy', x: 2496, y: 416, width: 128, height: 128, visible: true, properties: [] },
  { id: 2003, name: 'gold_tl', type: 'gold_node', x: 352, y: 288, width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 3000 }] },
  { id: 2004, name: 'gold_tr', type: 'gold_node', x: 2720, y: 288, width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 3000 }] },
  { id: 2005, name: 'gold_bl', type: 'gold_node', x: 352, y: 1632, width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 2800 }] },
  { id: 2006, name: 'gold_br', type: 'gold_node', x: 2720, y: 1632, width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 2800 }] },
  { id: 2007, name: 'gold_center', type: 'gold_node', x: 1536, y: 960, width: 64, height: 64, visible: true,
    properties: [{ name: 'amount', type: 'int', value: 3500 }] },
];

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
    { id: 1, name: 'ground', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: COLS, height: ROWS, data: groundData },
    { id: 2, name: 'elevated', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: COLS, height: ROWS, data: highData },
    { id: 3, name: 'cliffs', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: COLS, height: ROWS, data: cliffData },
    { id: 4, name: 'forest', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: forestObjs },
    { id: 5, name: 'spawns', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: poiObjs },
  ],
};

const outDir = path.resolve(__dirname, '../assets/maps');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'turtle-cove.tmj'), JSON.stringify(tmap, null, 2));

console.log('✓  assets/maps/turtle-cove.tmj  (' + COLS + '×' + ROWS + ' tiles, ' + forestObjs.length + ' trees)');
