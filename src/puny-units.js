/* ============================================================================
 * Warcrest — puny-units.js
 * Draws units from the Puny Characters pack (8-directional, 29-frame sheets at
 * 32px). One sheet per faction+role in assets/units/puny/<faction>/<role>.png.
 * Hooked from art.js drawUnit ahead of the existing sprite system. Opt-in:
 * set RTS.PunyUnits.enabled = true to preview.
 *
 * Sheet layout (32px frames, 29 cols x 8 rows):
 *   rows = 8 facings   cols: idle 0-1 · walk 5-8 · sword 13-15 · bow 16-18
 *                            staff 19-21 · throw 22-24 · hurt/death 25-27
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var DIR = 'assets/units/puny/';
  var FW = 32, cache = {};
  var ROLES = { pawn: 1, warrior: 1, archer: 1, lancer: 1, monk: 1 };

  function imgFor(u) {
    if (!ROLES[u.role]) return null;          // heroes / livestock → default art
    var key = (u.faction || 'aurex') + '/' + u.role;
    var c = cache[key];
    if (c === undefined) { c = new Image(); c.src = DIR + key + '.png'; cache[key] = c; }
    return (c && c.complete && c.naturalWidth) ? c : null;
  }

  // facing angle (0=E, +y down) → sheet row. Sheet rows run [S,SW,W,NW,N,NE,E,SE].
  // sector index from angle: 0=E,1=SE,2=S,3=SW,4=W,5=NW,6=N,7=NE
  var SECTOR_TO_ROW = [6, 7, 0, 1, 2, 3, 4, 5];
  function rowForFacing(a) {
    var TWO = Math.PI * 2;
    var idx = Math.round((((a % TWO) + TWO) % TWO) / (Math.PI / 4)) % 8;
    return SECTOR_TO_ROW[idx];
  }

  function frame(u, t) {
    var moving = (u.vx * u.vx + u.vy * u.vy) > 6 || (u.moveTo && !u._builderOnSite);

    // Pawns never brandish weapons — their animation follows the harvest cycle.
    if (u.role === 'pawn') {
      var h = u.harvest;
      if (h && h.phase === 'mining') { var mn = [13, 14, 15]; return mn[Math.floor(t * 7) % mn.length]; }  // pickaxe swing
      if (h && h.carry > 0) { var c = [9, 10, 11, 12]; return c[Math.floor(t * 7) % c.length]; }            // hauling load
      if (moving) { var pw = [5, 6, 7, 8]; return pw[Math.floor(t * 7) % pw.length]; }
      var pi = [0, 1]; return pi[Math.floor(t * 2.2) % pi.length];
    }

    var attacking = u.muzzleFlash > 0 || (u.cooldown > 0 && u.target);
    if (attacking) {
      // per-role attack: caster staff, ranged bow, melee sword
      var atk = u.role === 'monk' ? [19, 20, 21] : (u.ranged ? [16, 17, 18] : [13, 14, 15]);
      return atk[Math.floor(t * 9) % atk.length];
    }
    if (moving) { var w = [5, 6, 7, 8]; return w[Math.floor(t * 7) % w.length]; }
    var idle = [0, 1]; return idle[Math.floor(t * 2.2) % idle.length];
  }

  RTS.PunyUnits = {
    enabled: true,       // Puny Characters are the default unit art
    scale: 2.4,          // 32px frame → ~77px on screen; tune to taste
    draw: function (ctx, u, f, s) {
      if (!this.enabled || u.isHero) return false;
      if (u.dead) return false;                 // let the default death effect play
      var im = imgFor(u);
      if (!im) return false;

      var r = u.radius || 12;
      var col = frame(u, s.timers.gameTime + (u._idlePhase || 0));
      var row = rowForFacing(u.facing || Math.PI / 2);
      var dw = FW * this.scale, dh = FW * this.scale;
      var dx = u.x - dw / 2;
      var dy = (u.y + r * 0.55) - dh;           // character's feet sit near u.y

      if (RTS.Art && RTS.Art.drawShadow) RTS.Art.drawShadow(ctx, u.x, u.y + r * 0.5, r * 0.85, 0.3);
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
