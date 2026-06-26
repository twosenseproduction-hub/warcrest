/* ============================================================================
 * Warcrest — puny-units.js
 * Draws units from the Puny Characters pack (8-directional, 29-frame sheets at
 * 32px). One sheet per faction+role in assets/units/puny/<faction>/<role>.png.
 * Hooked from art.js drawUnit ahead of the existing sprite system. Opt-in:
 * set RTS.PunyUnits.enabled = true to preview.
 *
 * Sheet layout (32px frames, 29 cols x 8 rows), rows = 8 facings.
 * Animation columns (verified against the user's instruction sheet):
 *   0-1  idle        2-4   walk          5-8   attack (sword / melee)
 *   9-12 shoot arrow 13-15 magic (wand)  16-18 throw object
 *   19-21 hurt       22-24 death
 *
 * Each role plays ONLY its own weapon action:
 *   warrior/lancer (melee) → sword 5-8   archer → bow 9-12   monk → wand 13-15
 *   pawn → wand 13-15 for the mine/build tool only (no combat).
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var DIR = 'assets/units/puny/';
  var AV = '20260626e';           // asset version — bump when a sheet changes to bust /assets cache
  var FW = 32, cache = {};
  var ROLES = { pawn: 1, warrior: 1, archer: 1, lancer: 1, monk: 1 };

  function imgFor(u) {
    if (!ROLES[u.role]) return null;          // heroes / livestock → default art
    var key = (u.faction || 'aurex') + '/' + u.role;
    var c = cache[key];
    if (c === undefined) { c = new Image(); c.src = DIR + key + '.png?v=' + AV; cache[key] = c; }
    return (c && c.complete && c.naturalWidth) ? c : null;
  }

  // facing angle (0=E, +y down) → sheet row. Verified from the bow frame:
  // sheet rows run [S, SE, E, NE, N, NW, W, SW] (row0..row7).
  // sector index from angle: 0=E,1=SE,2=S,3=SW,4=W,5=NW,6=N,7=NE
  //   E→row2  SE→row1  S→row0  SW→row7  W→row6  NW→row5  N→row4  NE→row3
  var SECTOR_TO_ROW = [2, 1, 0, 7, 6, 5, 4, 3];
  // Quantise facing to one of 8 sectors, with a deadzone so a unit whose heading
  // wiggles right at a sector boundary doesn't flip its sprite row every frame
  // (that flicker read as "glitchy"). Keep the current sector until the heading
  // moves clearly (>~30°) into the next one.
  function sectorForFacing(u, a) {
    var TWO = Math.PI * 2, SEC = Math.PI / 4;
    var norm = (((a % TWO) + TWO) % TWO);
    var idx = Math.round(norm / SEC) % 8;
    var prev = u._faceIdx;
    if (prev != null && prev !== idx) {
      // distance (in radians) from heading to the centre of the previous sector
      var d = Math.abs(norm - prev * SEC);
      if (d > Math.PI) d = TWO - d;
      if (d < SEC * 0.72) idx = prev;   // still within the deadzone — hold steady
    }
    u._faceIdx = idx;
    return SECTOR_TO_ROW[idx];
  }

  // Per-role attack/action columns. Each unit only ever plays its own weapon:
  //   warrior + lancer swing the sword, archer looses an arrow, monk casts.
  function attackCols(role) {
    if (role === 'archer') return [9, 10, 11, 12];   // shoot arrow
    if (role === 'monk') return [13, 14, 15];         // magic / wand
    return [5, 6, 7, 8];                              // sword / melee (warrior, lancer)
  }

  function pick(seq, t, rate) { return seq[Math.floor(t * rate) % seq.length]; }

  function frame(u, t, attacking) {
    var moving = (u.vx * u.vx + u.vy * u.vy) > 6 || (u.moveTo && !u._builderOnSite);

    // Pawns never fight — they carry only the recolored work tool (wand frames).
    if (u.role === 'pawn') {
      var h = u.harvest;
      if (u.buildTask && u._builderOnSite) return pick([13, 14, 15], t, 7);  // building
      if (h && h.phase === 'mining') return pick([13, 14, 15], t, 7);         // mining
      if (h && h.carry > 0) return pick([2, 3, 4], t, 7);                     // hauling (walk)
      if (moving) return pick([2, 3, 4], t, 7);
      return pick([0, 1], t, 2.2);
    }

    // Combat units: attack only when in range and not moving; otherwise walk/idle.
    if (!moving && attacking) return pick(attackCols(u.role), t, 9);
    if (moving) return pick([2, 3, 4], t, 7);
    return pick([0, 1], t, 2.2);
  }

  // Class tint for the foot ring — quick visual read of role on the battlefield.
  var ROLE_RING = {
    pawn: '#cdb892', warrior: '#e5533d', lancer: '#ff9a3c',
    archer: '#46c98a', monk: '#8a7bff',
  };

  RTS.PunyUnits = {
    enabled: true,       // Puny Characters are the default unit art
    scale: 3.8,          // 32px frame → ~122px on screen
    draw: function (ctx, u, f, s) {
      if (!this.enabled || u.isHero) return false;
      if (u.dead) return false;                 // let the default death effect play
      var im = imgFor(u);
      if (!im) return false;

      var r = u.radius || 12;
      // Hold the attack pose briefly after leaving range so a unit hovering at
      // the edge of its reach doesn't pop between swing and idle every frame.
      var now = s.timers.gameTime;
      if (u.inAttackRange) u._inRangeAt = now;
      var attacking = (now - (u._inRangeAt == null ? -999 : u._inRangeAt)) < 0.22;
      var col = frame(u, now + (u._idlePhase || 0), attacking);
      var row = sectorForFacing(u, (u.facing == null ? Math.PI / 2 : u.facing));
      var dw = FW * this.scale, dh = FW * this.scale;
      var dx = u.x - dw / 2;
      var dy = (u.y + r * 0.55) - dh;           // character's feet sit near u.y

      if (RTS.Art && RTS.Art.drawShadow) RTS.Art.drawShadow(ctx, u.x, u.y + r * 0.5, r * 0.85, 0.3);
      // Class-colour foot ring — quick read of role at a glance.
      var ring = ROLE_RING[u.role];
      if (ring) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = ring;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(u.x, u.y + r * 0.5, r * 0.95, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (u.spawnFlash > 0) ctx.globalAlpha = 0.6 + 0.4 * (1 - u.spawnFlash / 0.3);
      ctx.drawImage(im, col * FW, row * FW, FW, FW,
        Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
      ctx.restore();

      if (RTS.Art && RTS.Art.drawUnitOverlays) RTS.Art.drawUnitOverlays(ctx, u, f, s, r);
      return true;
    },
  };
})(window.RTS = window.RTS || {});
