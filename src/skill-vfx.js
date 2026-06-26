/* ============================================================================
 * Warcrest — skill-vfx.js
 * Plays the Puny Skills animation sheets (16px frames) as battlefield effects.
 * Spawned via RTS.SkillVFX.spawn(); drawn for effects of kind 'skillfx' from
 * render.js drawEffects. Frames advance off the effect's elapsed life.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var DIR = 'assets/skills/', AV = '20260626a', cache = {};

  // Sheet metadata: frame count + native fps + frame size (default 16x16).
  var SHEETS = {
    spike_vine:   { frames: 12, fps: 18, fw: 16, fh: 16 },
    sprout_heal:  { frames: 12, fps: 20, fw: 16, fh: 16 },
    leaf_fall:    { frames: 28, fps: 22, fw: 16, fh: 16 },
    levelup_aura: { frames: 5,  fps: 12, fw: 25, fh: 24 },
  };

  function img(sheet) {
    var c = cache[sheet];
    if (c === undefined) { c = new Image(); c.src = DIR + sheet + '.png?v=' + AV; cache[sheet] = c; }
    return (c && c.complete && c.naturalWidth) ? c : null;
  }

  RTS.SkillVFX = {
    // opts: { scale, life, hold, loop } — scale multiplies the 16px frame.
    spawn: function (s, sheet, x, y, opts) {
      opts = opts || {};
      var meta = SHEETS[sheet] || { frames: 1, fps: 12, fw: 16, fh: 16 };
      var life = opts.life != null ? opts.life : meta.frames / meta.fps;
      RTS.addEffect(s, {
        kind: 'skillfx', sheet: sheet, x: x, y: y,
        scale: opts.scale || 3, life: life, max: life,
        fps: meta.fps, frames: meta.frames, fw: meta.fw || 16, fh: meta.fh || 16,
        hold: !!opts.hold, loop: !!opts.loop,
      });
    },

    drawFx: function (ctx, fx) {
      var im = img(fx.sheet);
      if (!im) return;
      var fw = fx.fw || 16, fh = fx.fh || 16;
      var elapsed = fx.max - fx.life;
      var idx = Math.floor(elapsed * fx.fps);
      if (fx.loop) idx = idx % fx.frames;
      idx = Math.max(0, Math.min(fx.frames - 1, idx));
      var dw = fw * fx.scale, dh = fh * fx.scale;
      // Fade only in the final 0.5s so persistent effects stay solid.
      var a = fx.life < 0.5 ? Math.max(0, fx.life / 0.5) : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, idx * fw, 0, fw, fh,
        Math.round(fx.x - dw / 2), Math.round(fx.y - dh / 2), Math.round(dw), Math.round(dh));
      ctx.restore();
    },
  };
})(window.RTS = window.RTS || {});
