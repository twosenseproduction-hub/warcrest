/* ============================================================================
 * Warcrest — hero-sprites.js
 * Renders heroes from Tiny-RPG-style side-view animation strips (100px frames),
 * mirrored left/right by facing. One strip per animation in
 * assets/heroes/<faction>/<id>/tiny/<anim>.png. Hooked from art.js drawUnit
 * ahead of the unit renderers. Heroes face left/right only (side-view source).
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var DIR = 'assets/heroes/', FW = 100, cache = {};

  // Per-hero config: art path + frame counts/fps per animation.
  var DEFS = {
    aelindra: {
      path: 'rimwalker/aelindra/tiny/', scale: 2.1, footRatio: 0.80,
      anims: {
        idle:   { n: 6, fps: 6 },
        walk:   { n: 8, fps: 11 },
        attack: { n: 6, fps: 12 },
        hurt:   { n: 4, fps: 10 },
        death:  { n: 4, fps: 8 },
      },
    },
  };

  function imgFor(def, anim) {
    var key = def.path + anim;
    var c = cache[key];
    if (c === undefined) { c = new Image(); c.src = DIR + def.path + anim + '.png'; cache[key] = c; }
    return (c && c.complete && c.naturalWidth) ? c : null;
  }

  function animFor(u, def) {
    if (u.muzzleFlash > 0 || (u.cooldown > 0 && u.target)) return def.anims.attack ? 'attack' : 'idle';
    var moving = (u.vx * u.vx + u.vy * u.vy) > 6 || (u.moveTo && !u._builderOnSite);
    if (moving && def.anims.walk) return 'walk';
    return 'idle';
  }

  RTS.HeroSprites = {
    enabled: true,
    draw: function (ctx, u, f, s) {
      if (!this.enabled || !u.isHero || u.dead) return false;
      var def = DEFS[u.heroId];
      if (!def) return false;
      var anim = animFor(u, def);
      var im = imgFor(def, anim);
      if (!im) { anim = 'idle'; im = imgFor(def, 'idle'); if (!im) return false; }

      var spec = def.anims[anim] || def.anims.idle;
      var t = s.timers.gameTime + (u._idlePhase || 0);
      var col = Math.floor(t * spec.fps) % spec.n;
      var faceLeft = Math.cos(u.facing || 0) < -0.01;

      var r = u.radius || 16;
      var dw = FW * def.scale, dh = FW * def.scale;
      var dx = u.x - dw / 2;
      var dy = u.y - dh * def.footRatio;   // feet sit near u.y

      if (RTS.Art && RTS.Art.drawShadow) RTS.Art.drawShadow(ctx, u.x, u.y + r * 0.4, r * 0.9, 0.3);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (u.spawnFlash > 0) ctx.globalAlpha = 0.6 + 0.4 * (1 - u.spawnFlash / 0.35);
      if (faceLeft) {
        ctx.translate(Math.round(dx + dw), Math.round(dy));
        ctx.scale(-1, 1);
        ctx.drawImage(im, col * FW, 0, FW, FW, 0, 0, Math.round(dw), Math.round(dh));
      } else {
        ctx.drawImage(im, col * FW, 0, FW, FW, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
      }
      ctx.restore();

      if (RTS.Art && RTS.Art.drawUnitOverlays) RTS.Art.drawUnitOverlays(ctx, u, f, s, r);
      return true;
    },
  };
})(window.RTS = window.RTS || {});
