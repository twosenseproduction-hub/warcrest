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
  var firesByBuilding = {};

  // Scatter slots on roof/walls — ux/uy are fractions of sprite width/height from top-left.
  var FIRE_SLOTS = [
    { ux: -0.26, uy: 0.10 },
    { ux:  0.26, uy: 0.10 },
    { ux:  0.00, uy: 0.04 },
    { ux: -0.34, uy: 0.26 },
    { ux:  0.34, uy: 0.26 },
    { ux: -0.12, uy: 0.18 },
    { ux:  0.14, uy: 0.22 },
  ];

  function sheetDuration(key) {
    var sh = SHEETS[key];
    return sh.frames / sh.fps;
  }

  function pickFireKey(seed) {
    var n = 0;
    var str = String(seed);
    for (var i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) | 0;
    return FIRE_KEYS[((n % FIRE_KEYS.length) + FIRE_KEYS.length) % FIRE_KEYS.length];
  }

  function fireCountForHp(ratio) {
    if (ratio >= 0.75) return 0;
    if (ratio >= 0.55) return 1;
    if (ratio >= 0.40) return 2;
    if (ratio >= 0.25) return 3;
    if (ratio >= 0.12) return 4;
    return 5;
  }

  function buildingFireLayout(b, s) {
    var vb = RTS.Assets && RTS.Assets.buildingVisualBounds
      ? RTS.Assets.buildingVisualBounds(b, s) : null;
    var drawW = vb ? vb.drawW : b.w;
    var drawH = vb ? vb.drawH : b.h;
    var topY = vb ? vb.drawY : (b.y - b.h / 2);
    var baseScale = Math.max(drawW, drawH) / 125;
    return FIRE_SLOTS.map(function (slot, i) {
      return {
        offsetX: slot.ux * drawW,
        offsetY: (topY + slot.uy * drawH) - b.y,
        scale: baseScale * (0.38 + (i % 3) * 0.07),
        sheet: pickFireKey((b.id || 0) + ':' + i),
      };
    });
  }

  function clearBuildingFires(s, buildingId) {
    var existing = firesByBuilding[buildingId];
    if (!existing) return;
    delete firesByBuilding[buildingId];
    existing.forEach(function (entry) {
      s.entities.effects.forEach(function (fx) {
        if (fx.id === entry.fxId) fx.life = 0;
      });
    });
  }

  function syncBuildingFires(s, b) {
    if (!ready || RTS.Config.reducedMotion) return;
    if (!b || b.dead || !b.built) {
      clearBuildingFires(s, b && b.id);
      return;
    }
    var want = fireCountForHp(b.hp / b.maxHp);
    var existing = firesByBuilding[b.id] || [];
    var layout = buildingFireLayout(b, s);

    while (existing.length > want) {
      var rem = existing.pop();
      s.entities.effects.forEach(function (fx) {
        if (fx.id === rem.fxId) fx.life = 0;
      });
    }

    while (existing.length < want) {
      var slotIdx = existing.length;
      var slot = layout[slotIdx % layout.length];
      var fx = addPfx(s, {
        sheet: slot.sheet,
        x: b.x + slot.offsetX,
        y: b.y + slot.offsetY,
        scale: slot.scale,
        loop: true,
        buildingId: b.id,
        offsetX: slot.offsetX,
        offsetY: slot.offsetY,
      });
      if (fx) existing.push({ fxId: fx.id, slot: slotIdx });
    }

    firesByBuilding[b.id] = existing;
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

    syncBuildingFires: syncBuildingFires,
    clearBuildingFires: clearBuildingFires,

    ensureFireLoop: function (s, buildingId) {
      var b = RTS.getById(s, buildingId);
      if (b) syncBuildingFires(s, b);
    },

    clearFireLoop: function (s, buildingId) {
      clearBuildingFires(s, buildingId);
    },

    spawnExplosion: function (s, x, y, size) {
      if (!ready) return false;
      size = size || 18;
      var scale = Math.max(0.55, size / 20);
      var large = size >= 24;
      addPfx(s, { sheet: 'explosion1', x: x, y: y, scale: scale });
      if (large) {
        addPfx(s, {
          sheet: 'explosion2',
          x: x,
          y: y - 6,
          scale: scale * 1.2,
          alpha: 0.95,
        });
      }
      if (size >= 40 && !RTS.Config.reducedMotion) {
        var dkey = ((x * 3 + y * 5) | 0) % 2 ? 'dust2' : 'dust1';
        addPfx(s, { sheet: dkey, x: x, y: y + 4, scale: 1.45 });
        addPfx(s, { sheet: dkey === 'dust1' ? 'dust2' : 'dust1', x: x + 8, y: y, scale: 1.75, alpha: 0.85 });
      }
      return true;
    },

    tick: function (s, dt) {
      if (!ready) return;
      Object.keys(firesByBuilding).forEach(function (bid) {
        var b = RTS.getById(s, bid);
        if (!b || b.dead) clearBuildingFires(s, bid);
      });

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
