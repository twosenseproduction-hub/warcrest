#!/usr/bin/env node
/**
 * ascii-map.mjs — compile a human-readable ASCII `.map` file into a Tiled
 * `.tmj` the game can load (autotiled terrain, forest + spawn object layers).
 *
 * Usage:
 *   node tools/mapgen/ascii-map.mjs <input.map> [output.tmj]
 *
 * If output is omitted it writes assets/maps/<name-slug>.tmj.
 *
 * ── .map file format ─────────────────────────────────────────────────────────
 *   Header lines (key: value), then a `map:` line, then the grid until EOF.
 *
 *     name: Twin Fords
 *     tile: 64
 *     mirror: horizontal      # none | horizontal  (mirror left half → right)
 *     gold_amount: 2800       # default amount for every $ node
 *     map:
 *     ~~~~~~....
 *     ~..T..^^..
 *     ~.P.....$.
 *     ...
 *
 *   Tile glyphs (one char per tile, every row the same width):
 *     ~  water (impassable)        .  grass (flat, walkable)
 *     ^  highland (high ground)    T  forest (grass + tree, blocks build)
 *     P  player start (on grass)   E  enemy start (on grass)
 *     $  gold node (on grass)      o  neutral/creep marker (on grass)
 *
 *   mirror: horizontal — author ONLY the left half; the tool reflects terrain
 *   and forests, mirrors each $/o, and turns every P into a matching E on the
 *   right (and vice-versa). Full width becomes 2 × authored width.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const WATER = -1, FLAT = 0, HIGH = 1;
const TILESET_COLS = 9;

// 4-neighbour bitmask (N=1,E=2,S=4,W=8) → tile number 1-16  (from export-map.js)
const GUIDE_TILE = [16, 12, 13, 9, 4, 8, 1, 5, 15, 11, 14, 10, 3, 7, 2, 6];
const CLIFF = {
  S:  { col: 0, row: 4 }, N:  { col: 3, row: 4 },
  E:  { col: 5, row: 4 }, W:  { col: 6, row: 4 },
  SE: { col: 7, row: 4 }, SW: { col: 8, row: 4 },
};

// ── Parse ─────────────────────────────────────────────────────────────────────
function parseMapFile(text) {
  const lines = text.split(/\r?\n/);
  const header = { name: 'Untitled', tile: 64, mirror: 'none', gold_amount: 2800 };
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*map:\s*$/.test(line)) { i++; break; }
    if (/^\s*(#|$)/.test(line)) continue;            // comment / blank
    const m = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.+?)\s*$/);
    if (m) {
      const key = m[1].toLowerCase();
      if (key === 'tile' || key === 'gold_amount') header[key] = parseInt(m[2], 10);
      else header[key] = m[2];
    }
  }

  // Remaining non-empty lines (strip trailing comments / blank tail) = grid.
  let grid = [];
  for (; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*#/.test(raw)) continue;
    if (raw.length === 0 && grid.length === 0) continue; // skip leading blanks
    if (raw.trim().length === 0) continue;               // ignore blank rows
    grid.push(raw.replace(/\s+$/, ''));                  // keep leading spaces? no
  }
  if (!grid.length) throw new Error('No map grid found (expected rows after a "map:" line).');

  const width = Math.max(...grid.map((r) => r.length));
  // Right-pad short rows with water so ragged input still parses (with a warning).
  let ragged = false;
  grid = grid.map((r) => {
    if (r.length !== width) ragged = true;
    return r.padEnd(width, '~');
  });
  if (ragged) console.warn('⚠  rows had unequal length — short rows padded with water (~).');

  return { header, grid };
}

const GLYPH = {
  '~': { h: WATER, forest: 0 },
  '.': { h: FLAT,  forest: 0 },
  '^': { h: HIGH,  forest: 0 },
  '/': { h: FLAT,  forest: 0, ramp: 1 },   // ramp: passable break in a cliff wall
  ':': { h: FLAT,  forest: 0, shallow: 1 },// wadeable shallow-water ford (walkable, rendered as water)
  'T': { h: FLAT,  forest: 1 },
  'P': { h: FLAT,  forest: 0, spawn: 'spawn_player' },
  'E': { h: FLAT,  forest: 0, spawn: 'spawn_enemy' },
  '$': { h: FLAT,  forest: 0, spawn: 'gold_node' },
  'o': { h: FLAT,  forest: 0, spawn: 'neutral' },
};

// Build heights / forest / spawn lists from the parsed grid.
function buildTerrain(header, grid) {
  const tile = header.tile;
  const mirror = (header.mirror || 'none').toLowerCase();
  const authoredW = grid[0].length;
  const rows = grid.length;
  const cols = mirror === 'horizontal' ? authoredW * 2 : authoredW;

  const heights = new Int8Array(cols * rows).fill(WATER);
  const forest = new Uint8Array(cols * rows);
  const ramp = new Uint8Array(cols * rows);
  const shallow = new Uint8Array(cols * rows);
  const spawns = []; // {type, cx, cy, amount?}

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < authoredW; c++) {
      const ch = grid[r][c];
      const g = GLYPH[ch];
      if (!g) throw new Error(`Unknown glyph '${ch}' at row ${r + 1}, col ${c + 1}.`);
      const place = (cx) => {
        heights[cx + r * cols] = g.h;
        if (g.forest) forest[cx + r * cols] = 1;
        if (g.ramp) ramp[cx + r * cols] = 1;
        if (g.shallow) shallow[cx + r * cols] = 1;
      };
      place(c);
      const mc = cols - 1 - c;
      if (mirror === 'horizontal') place(mc);

      if (g.spawn) {
        const addSpawn = (cx, type) => {
          const s = { type, cx, cy: r };
          if (type === 'gold_node') s.amount = header.gold_amount;
          spawns.push(s);
        };
        addSpawn(c, g.spawn);
        if (mirror === 'horizontal') {
          // Mirror POIs to the far side; player↔enemy swap so the match stays fair.
          const swap = g.spawn === 'spawn_player' ? 'spawn_enemy'
            : g.spawn === 'spawn_enemy' ? 'spawn_player' : g.spawn;
          addSpawn(mc, swap);
        }
      }
    }
  }

  // Spawn / gold tiles authored INSIDE a plateau inherit HIGH ground, so a base
  // sits cleanly on the plateau instead of in a flat notch ringed by cliffs.
  const at = (cx, cy) => (cx < 0 || cy < 0 || cx >= cols || cy >= rows ? WATER : heights[cx + cy * cols]);
  spawns.forEach((s) => {
    const i = s.cx + s.cy * cols;
    let high = 0;
    if (at(s.cx, s.cy - 1) === HIGH) high++;
    if (at(s.cx, s.cy + 1) === HIGH) high++;
    if (at(s.cx - 1, s.cy) === HIGH) high++;
    if (at(s.cx + 1, s.cy) === HIGH) high++;
    if (high >= 3) heights[i] = HIGH;
  });

  return { tile, cols, rows, heights, forest, ramp, shallow, spawns };
}

// ── Autotile (ported from tools/export-map.js) ────────────────────────────────
function gid(col, row) { return 1 + row * TILESET_COLS + col; }
function autotileGid(bit, blockCol, blockRow) {
  const tileNum = GUIDE_TILE[bit] || 5;
  const idx = tileNum - 1;
  return gid(blockCol + (idx % 4), blockRow + (idx >> 2));
}

function emitTmj(t) {
  const { tile, cols, rows, heights, forest, ramp, shallow, spawns } = t;
  const at = (cx, cy) => (cx < 0 || cy < 0 || cx >= cols || cy >= rows ? WATER : heights[cx + cy * cols]);
  const isLand = (h) => h >= FLAT;
  const flatBit = (cx, cy) => (isLand(at(cx, cy - 1)) ? 1 : 0) | (isLand(at(cx + 1, cy)) ? 2 : 0) |
                              (isLand(at(cx, cy + 1)) ? 4 : 0) | (isLand(at(cx - 1, cy)) ? 8 : 0);
  const highBit = (cx, cy) => (at(cx, cy - 1) === HIGH ? 1 : 0) | (at(cx + 1, cy) === HIGH ? 2 : 0) |
                              (at(cx, cy + 1) === HIGH ? 4 : 0) | (at(cx - 1, cy) === HIGH ? 8 : 0);

  const groundData = new Array(cols * rows).fill(0);
  const highData = new Array(cols * rows).fill(0);
  const cliffData = new Array(cols * rows).fill(0);
  const forestObjs = [];
  const rampObjs = [];
  const shallowObjs = [];

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const idx = cx + cy * cols;
      const h = heights[idx];
      if (h === FLAT) {
        groundData[idx] = autotileGid(flatBit(cx, cy), 0, 0);
      } else if (h === HIGH) {
        groundData[idx] = autotileGid(flatBit(cx, cy), 0, 0); // grass underneath
        highData[idx] = autotileGid(highBit(cx, cy), 5, 0);
        const ss = at(cx, cy + 1), n = at(cx, cy - 1), e = at(cx + 1, cy), w = at(cx - 1, cy);
        const ne = at(cx + 1, cy - 1), nw = at(cx - 1, cy - 1), se = at(cx + 1, cy + 1), sw = at(cx - 1, cy + 1);
        let cell = CLIFF.N;
        if (ss < HIGH) cell = ss === WATER ? CLIFF.SW : CLIFF.S;
        else if (n < HIGH) cell = CLIFF.N;
        else if (e < HIGH && ne < HIGH && se < HIGH) cell = e === WATER ? CLIFF.SE : CLIFF.E;
        else if (w < HIGH && nw < HIGH && sw < HIGH) cell = w === WATER ? CLIFF.SW : CLIFF.W;
        else cell = null;
        if (cell) cliffData[idx] = gid(cell.col, cell.row);
      }
      if (forest[idx]) {
        forestObjs.push({ id: forestObjs.length + 1, name: 'tree', type: 'tree', visible: true,
          x: cx * tile, y: cy * tile, width: tile, height: tile, properties: [] });
      }
      if (ramp && ramp[idx]) {
        rampObjs.push({ id: 9000 + rampObjs.length + 1, name: 'ramp', type: 'ramp', visible: true,
          x: cx * tile, y: cy * tile, width: tile, height: tile, properties: [] });
      }
      if (shallow && shallow[idx]) {
        shallowObjs.push({ id: 8000 + shallowObjs.length + 1, name: 'shallow', type: 'shallow', visible: true,
          x: cx * tile, y: cy * tile, width: tile, height: tile, properties: [] });
      }
    }
  }

  // Spawn / gold objects — x/y are world CENTRES (parseMapTMJ reads them as such).
  let oid = 2001;
  const spawnObjs = spawns.map((s) => {
    const obj = {
      id: oid++,
      name: s.type === 'spawn_player' ? 'player_base'
        : s.type === 'spawn_enemy' ? 'enemy_base'
        : s.type === 'gold_node' ? 'gold' : 'neutral',
      type: s.type,
      x: s.cx * tile + tile / 2,
      y: s.cy * tile + tile / 2,
      width: tile, height: tile, visible: true,
      properties: s.amount != null ? [{ name: 'amount', type: 'int', value: s.amount }] : [],
    };
    return obj;
  });

  const layer = (id, name, data) => ({ id, name, type: 'tilelayer', visible: true, opacity: 1,
    x: 0, y: 0, width: cols, height: rows, data });

  return {
    version: '1.6', tiledversion: '1.10.2', type: 'map', orientation: 'orthogonal',
    renderorder: 'right-down', width: cols, height: rows, tilewidth: tile, tileheight: tile,
    infinite: false, backgroundcolor: '#1a2a4a', nextlayerid: 10, nextobjectid: oid + 1000,
    tilesets: [{ firstgid: 1, name: 'terrain-grass', tilewidth: tile, tileheight: tile,
      spacing: 0, margin: 0, columns: TILESET_COLS, tilecount: TILESET_COLS * 6,
      image: '../tiny-swords/Terrain/Tileset/Tilemap_color1.png',
      imagewidth: TILESET_COLS * tile, imageheight: 6 * tile }],
    layers: [
      layer(1, 'ground', groundData),
      layer(2, 'elevated', highData),
      layer(3, 'cliffs', cliffData),
      { id: 4, name: 'forest', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: forestObjs },
      { id: 5, name: 'spawns', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: spawnObjs },
      { id: 6, name: 'ramps', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: rampObjs },
      { id: 7, name: 'shallows', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: shallowObjs },
    ],
  };
}

function slug(name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// ── CLI ─────────────────────────────────────────────────────────────────────
function main() {
  const [, , inFile, outArg] = process.argv;
  if (!inFile) {
    console.error('Usage: node tools/mapgen/ascii-map.mjs <input.map> [output.tmj]');
    process.exit(2);
  }
  const text = fs.readFileSync(inFile, 'utf8');
  const { header, grid } = parseMapFile(text);
  const terrain = buildTerrain(header, grid);
  const tmj = emitTmj(terrain);

  const outFile = outArg || path.join(ROOT, 'assets/maps', `${slug(header.name)}.tmj`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(tmj, null, 2));

  const counts = { water: 0, grass: 0, high: 0 };
  terrain.heights.forEach((h) => { counts[h === WATER ? 'water' : h === HIGH ? 'high' : 'grass']++; });
  const players = terrain.spawns.filter((s) => s.type === 'spawn_player').length;
  const enemies = terrain.spawns.filter((s) => s.type === 'spawn_enemy').length;
  const gold = terrain.spawns.filter((s) => s.type === 'gold_node').length;

  console.log(`✓  ${path.relative(ROOT, outFile)}  (${terrain.cols}×${terrain.rows} tiles, mirror=${header.mirror})`);
  console.log(`   land ${counts.grass} · high ${counts.high} · water ${counts.water} · forest ${terrain.forest.reduce((a, b) => a + b, 0)}`);
  console.log(`   spawns: ${players} player · ${enemies} enemy · ${gold} gold`);
  console.log(`\n   render:   python3 tools/mapgen/render-map.py ${path.relative(ROOT, outFile)}`);
  console.log(`   validate: node tools/mapgen/validate-map.mjs ${path.relative(ROOT, outFile)}`);
}

main();
