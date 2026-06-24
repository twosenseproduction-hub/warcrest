#!/usr/bin/env node
/**
 * validate-map.mjs — sanity-check a Warcrest .tmj before you ship it.
 *
 * Usage:  node tools/mapgen/validate-map.mjs <map.tmj>
 *
 * Checks (FAIL = the map is broken; WARN = probably bad design, still loads):
 *   • exactly one player + one enemy spawn                          (FAIL)
 *   • every spawn / gold node sits on land, not water               (FAIL)
 *   • enemy base is reachable on foot from the player base          (FAIL)
 *   • every gold node is reachable from the player base             (FAIL/WARN)
 *   • each base has a clear 4×3 land footprint (Town Hall fits)      (WARN)
 *   • rush distance + per-side gold balance                         (WARN/info)
 *
 * Exit code is non-zero if any FAIL fired, so it can gate a build.
 */
import fs from 'fs';

const WATER = -1, FLAT = 0, HIGH = 1;

function tileLayer(tmj, name) {
  const L = (tmj.layers || []).find((x) => x.type === 'tilelayer' && x.name === name);
  return L ? (L.data || []) : [];
}
function objLayer(tmj, name) {
  const L = (tmj.layers || []).find((x) => x.type === 'objectgroup' && x.name === name);
  return L ? (L.objects || []) : [];
}

function main() {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node tools/mapgen/validate-map.mjs <map.tmj>'); process.exit(2); }
  const tmj = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cols = tmj.width, rows = tmj.height, tile = tmj.tilewidth || 64;
  const ground = tileLayer(tmj, 'ground'), elevated = tileLayer(tmj, 'elevated');

  const heights = new Array(cols * rows).fill(WATER);
  for (let i = 0; i < cols * rows; i++) {
    if (elevated[i]) heights[i] = HIGH;
    else if (ground[i]) heights[i] = FLAT;
  }
  const land = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && heights[cx + cy * cols] >= FLAT;
  const toTile = (o) => ({ cx: Math.floor(o.x / tile), cy: Math.floor(o.y / tile) });

  const spawns = objLayer(tmj, 'spawns');
  const players = spawns.filter((s) => s.type === 'spawn_player');
  const enemies = spawns.filter((s) => s.type === 'spawn_enemy');
  const gold = spawns.filter((s) => s.type === 'gold_node');

  const fails = [], warns = [], info = [];

  // 1. spawn counts
  if (players.length !== 1) fails.push(`expected 1 player spawn, found ${players.length}`);
  if (enemies.length < 1) fails.push(`no enemy spawn found`);

  // 2. spawns/gold on land
  for (const s of spawns) {
    const { cx, cy } = toTile(s);
    if (!land(cx, cy)) fails.push(`${s.type} at tile (${cx},${cy}) is on water/out of bounds`);
  }

  // BFS over passable land from a tile
  const bfs = (start) => {
    const seen = new Uint8Array(cols * rows);
    if (!land(start.cx, start.cy)) return seen;
    const q = [start]; seen[start.cx + start.cy * cols] = 1;
    while (q.length) {
      const { cx, cy } = q.shift();
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = cx + dx, ny = cy + dy;
        if (land(nx, ny) && !seen[nx + ny * cols]) { seen[nx + ny * cols] = 1; q.push({ cx: nx, cy: ny }); }
      }
    }
    return seen;
  };

  let reach = null;
  if (players.length) {
    const p = toTile(players[0]);
    reach = bfs(p);
    const seenAt = (o) => { const { cx, cy } = toTile(o); return reach[cx + cy * cols]; };

    // 3. enemy reachable
    for (const e of enemies) {
      if (!seenAt(e)) fails.push(`enemy base at tile (${toTile(e).cx},${toTile(e).cy}) is NOT reachable on foot from the player base`);
    }
    // 4. gold reachable
    let unreachableGold = 0;
    for (const g of gold) if (!seenAt(g)) unreachableGold++;
    if (unreachableGold) warns.push(`${unreachableGold}/${gold.length} gold node(s) unreachable from the player base`);

    // rush distance (Manhattan tiles, player→nearest enemy)
    if (enemies.length) {
      const d = Math.min(...enemies.map((e) => Math.abs(toTile(e).cx - p.cx) + Math.abs(toTile(e).cy - p.cy)));
      info.push(`rush distance ≈ ${d} tiles (${Math.round(d * tile)}px)`);
      if (d < 14) warns.push(`bases are close (${d} tiles) — expect very fast rushes`);
    }
  }

  // 5. base footprint clearance (core is ~4×3 land tiles)
  for (const b of [...players, ...enemies]) {
    const { cx, cy } = toTile(b);
    let clear = true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 1; dx++) if (!land(cx + dx, cy + dy)) clear = false;
    if (!clear) warns.push(`${b.type} at (${cx},${cy}) lacks a clear 4×3 land footprint for the Town Hall`);
  }

  // 6. gold balance per side (left vs right of map centre)
  if (gold.length) {
    const mid = cols / 2;
    const left = gold.filter((g) => toTile(g).cx < mid).length;
    info.push(`gold split: ${left} left · ${gold.length - left} right of centre`);
  }

  // ── report ──
  const land0 = heights.filter((h) => h >= FLAT).length;
  console.log(`\n${file}`);
  console.log(`  ${cols}×${rows} tiles · land ${land0} (${Math.round(100 * land0 / (cols * rows))}%) · ${gold.length} gold · ${objLayer(tmj, 'forest').length} trees`);
  info.forEach((m) => console.log(`  · ${m}`));
  warns.forEach((m) => console.log(`  ⚠  ${m}`));
  fails.forEach((m) => console.log(`  ✗  ${m}`));

  if (fails.length) { console.log(`\n✗ FAIL — ${fails.length} blocking issue(s)\n`); process.exit(1); }
  console.log(`\n✓ PASS${warns.length ? ` (with ${warns.length} warning(s))` : ''}\n`);
}

main();
