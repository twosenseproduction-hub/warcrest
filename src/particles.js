/* ============================================================================
 * EXOFRONT — particles.js
 * Tiny Swords Particle FX — dust, fire loops, explosions, water splash.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var SHEETS = {
    dust1:      { rel: 'Particle FX/Dust_01.png',      frameW: 64,  frames: 8,  fps: 14, loop: false },
    dust2:      { rel: 'Particle FX/Dust_02.png',      frameW: 64,  frames: 10, fps: 14, loop: false },
    fire1:      { rel: 'Particle FX/Fire_01.png',      frameW: 64,  frames: 8,  fps: 10, loop: true },
    fire2:      { rel: 'Particle FX/Fire_02.png',      frameW: 64,  frames: 10, fps: 10, loop: true },
    fire3:      { rel: 'Particle FX/Fire_03.png',      frameW: 64,  frames: 12, fps: 10, loop: true },
    explosion1: { rel: 'Particle FX/Explosion_01.png', frameW: 192, frames: 8,  fps: 18, loop: false },
    explosion2: { rel: 'Particle FX/Explosion_02.png', frameW: 192, frames: 10, fps: 18, loop: false },
    splash:     { rel: 'Particle FX/Water Splash.png', frameW: 192, frames: 9,  fps: 20, loop: false },
  };

  var FIRE_KEYS = ['fire1', 'fire2', 'fire3'];
  var ready = false;
  var fireByBuilding = {};

  function sheetDuration(key) {
    var sh = SHEETS[key];
    return sh.frames / sh.fps;
  }

  function pickFireKey(buildingId) {
    var n = 0;
    var str = String(buildingId);
    for (var i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) | 0;
    return FIRE_KEYS[((n % FIRE_KEYS.length) + FIRE_KEYS.length) % FIRE_KEYS.length];
  }

  function addPfx(s, opts) {
    var sh = SHEETS[opts.sheet];
    if (!sh) return null;
    var rm = RTS.Config.reducedMotion;
    var life = opts.life != null ? opts.life : (sh.loop ? 9999 : sheetDuration(opts.sheet));
    if (rm && !sh.loop) life = Math.min(life, 0.12);
    var fx = {
      kind: 'pfx',
      sheet: opts.sheet,
      x: opts.x,
      y: opts.y,
      life: life,
      max: life,
      scale: opts.scale || 1,
      loop: !!opts.loop || !!sh.loop,
      buildingId: opts.buildingId || null,
      offsetX: opts.offsetX || 0,
      offsetY: opts.offsetY || 0,
      alpha: opts.alpha != null ? opts.alpha : 1,
      frame: rm ? 0 : null,
    };
    RTS.addEffect(s, fx);
    return fx;
  }

  function syncFirePosition(s, fx) {
    if (!fx.buildingId) return;
    var b = RTS.getById(s, fx.buildingId);
    if (!b || b.dead) {
      fx.life = 0;
      return;
    }
    fx.x = b.x + fx.offsetX;
    fx.y = b.y + fx.offsetY;
  }

  function frameIndex(fx) {
    var sh = SHEETS[fx.sheet];
    if (!sh) return 0;
    if (RTS.Config.reducedMotion) return 0;
    var elapsed = fx.max - fx.life;
    var fi = Math.floor(elapsed * sh.fps);
    if (fx.loop) return fi % sh.frames;
    return Math.min(sh.frames - 1, Math.max(0, fi));
  }

  function drawSheet(ctx, key, fi, x, y, scale, alpha) {
    var sh = SHEETS[key];
    var img = RTS.Assets.img(sh.rel);
    if (!img) return;
    var fw = sh.frameW;
    var fh = img.height;
    var sx = fi * fw;
    if (sx + fw > img.width) return;
    var drawW = fw * scale;
    var drawH = fh * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, 0, fw, fh, x - drawW / 2, y - drawH / 2, drawW, drawH);
    ctx.restore();
  }

  RTS.Particles = {
    ready: false,

    load: function (cb) {
      var keys = Object.keys(SHEETS);
      Promise.all(keys.map(function (k) { return RTS.Assets.loadImg(SHEETS[k].rel); }))
        .then(function () {
          ready = true;
          RTS.Particles.ready = true;
          if (cb) cb();
        })
        .catch(function (err) {
          console.error('EXOFRONT particle FX load failed', err);
          RTS.Particles.ready = false;
          if (cb) cb(err);
        });
    },

    spawnDust: function (s, x, y, scale, large) {
      if (!ready || RTS.Config.reducedMotion) return;
      scale = scale || 1;
      var key = ((x * 3 + y * 5) | 0) % 2 ? 'dust2' : 'dust1';
      addPfx(s, { sheet: key, x: x, y: y, scale: scale * 1.1 });
      if (large) {
        var other = key === 'dust1' ? 'dust2' : 'dust1';
        addPfx(s, {
          sheet: other,
          x: x + 6,
          y: y - 4,
          scale: scale * 1.35,
          alpha: 0.85,
        });
      }
    },

    spawnWaterSplash: function (s, x, y) {
      if (!ready) return;
      addPfx(s, { sheet: 'splash', x: x, y: y, scale: 1.15 });
    },

    ensureFireLoop: function (s, buildingId) {
      if (!ready || RTS.Config.reducedMotion) return;
      if (fireByBuilding[buildingId]) return;
      var b = RTS.getById(s, buildingId);
      if (!b || b.dead) return;
      var key = pickFireKey(buildingId);
      var fx = addPfx(s, {
        sheet: key,
        x: b.x,
        y: b.y - b.h * 0.12,
        scale: Math.max(b.w, b.h) / 110,
        loop: true,
        buildingId: buildingId,
        offsetY: -b.h * 0.12,
      });
      if (fx) fireByBuilding[buildingId] = fx.id;
    },

    clearFireLoop: function (s, buildingId) {
      var id = fireByBuilding[buildingId];
      if (!id) return;
      delete fireByBuilding[buildingId];
      s.entities.effects.forEach(function (fx) {
        if (fx.id === id) fx.life = 0;
      });
    },

    spawnExplosion: function (s, x, y, size) {
      if (!ready) return false;
      size = size || 18;
      var scale = Math.max(0.55, size / 22);
      var large = size >= 28;
      addPfx(s, { sheet: 'explosion1', x: x, y: y, scale: scale });
      if (large) {
        addPfx(s, {
          sheet: 'explosion2',
          x: x,
          y: y - 4,
          scale: scale * 1.15,
          alpha: 0.92,
        });
      }
      return true;
    },

    tick: function (s, dt) {
      if (!ready) return;
      var deadBuildings = [];
      Object.keys(fireByBuilding).forEach(function (bid) {
        var b = RTS.getById(s, bid);
        if (!b || b.dead) deadBuildings.push(bid);
      });
      deadBuildings.forEach(function (bid) { delete fireByBuilding[bid]; });

      s.entities.effects.forEach(function (fx) {
        if (fx.kind !== 'pfx') return;
        if (fx.buildingId) syncFirePosition(s, fx);
      });
    },

    draw: function (s, ctx) {
      if (!ready) return;
      s.entities.effects.forEach(function (fx) {
        if (fx.kind !== 'pfx') return;
        var a = fx.life > 9000 ? 1 : Math.max(0, fx.life / fx.max);
        var fi = frameIndex(fx);
        drawSheet(ctx, fx.sheet, fi, fx.x, fx.y, fx.scale, (fx.alpha != null ? fx.alpha : 1) * a);
      });
    },
  };

})(window.RTS = window.RTS || {});
