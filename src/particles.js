/* ============================================================================
 * EXOFRONT — particles.js
 * Tiny Swords Particle FX — dust, fire loops, explosions, water splash.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var EFFECTS_BASE = 'assets/effects/';

  var SHEETS = {
    dust1:        { rel: 'Particle FX/Dust_01.png',      frameW: 64,  frames: 8,  fps: 14, loop: false },
    dust2:        { rel: 'Particle FX/Dust_02.png',      frameW: 64,  frames: 10, fps: 14, loop: false },
    fire1:        { rel: 'Particle FX/Fire_01.png',      frameW: 64,  frames: 8,  fps: 10, loop: true },
    fire2:        { rel: 'Particle FX/Fire_02.png',      frameW: 64,  frames: 10, fps: 10, loop: true },
    fire3:        { rel: 'Particle FX/Fire_03.png',      frameW: 64,  frames: 12, fps: 10, loop: true },
    explosion1:   { rel: 'Particle FX/Explosion_01.png', frameW: 192, frames: 8,  fps: 18, loop: false },
    explosion2:   { rel: 'Particle FX/Explosion_02.png', frameW: 192, frames: 10, fps: 18, loop: false },
    splash:       { rel: 'Particle FX/Water Splash.png', frameW: 192, frames: 9,  fps: 20, loop: false },
    splatterRed:  { rel: 'Super Pixel Effects Mini Pack 1/spritesheet/fx1_splatter_small_red/spritesheet.png',      base: EFFECTS_BASE, frameW: 32,  frames: 6,  fps: 18, loop: false },
    burstOrange:  { rel: 'Super Pixel Effects Mini Pack 1/spritesheet/fx1_explosion_small_orange/spritesheet.png',  base: EFFECTS_BASE, frameW: 32,  frames: 11, fps: 18, loop: false },
    burstViolet:  { rel: 'Super Pixel Effects Mini Pack 1/spritesheet/fx2_electric_burst_large_violet/spritesheet.png', base: EFFECTS_BASE, frameW: 72, frames: 16, fps: 20, loop: false },
    hexExplosion: { rel: 'Hex Shaman_Explosion.png',     base: EFFECTS_BASE, frameW: 128, frames: 9,  fps: 18, loop: false },
    healEffect:   { rel: 'Heal_Effect.png',              base: EFFECTS_BASE, frameW: 192, frames: 11, fps: 18, loop: false },
  };

  var FIRE_KEYS = ['fire1', 'fire2', 'fire3'];
  var ready = false;
  var firesByBuilding = {};

  /** Hero ability VFX — separate from Tiny Swords particle sheets. */
  var HERO_VFX = {
    root_lash: {
      file: 'RootLash_VFX.png',
      base: 'assets/heroes/rimwalker/aelindra/',
      frameW: 256,
      frames: 6,
      fps: 18,
      loop: false,
      foot: true,
      footFrac: 0.703,  // content ground-line is at y≈180/256 of frame; aligns roots to target feet
      scale: 1.45,
    },
  };
  var HERO_VFX_CACHE_V = '20260620o';
  var heroVfxImgs = {};
  var heroVfxReady = false;

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

  function heroVfxDuration(key) {
    var hv = HERO_VFX[key];
    return hv ? hv.frames / hv.fps : 0;
  }

  function addHeroVfx(s, key, x, y, opts) {
    var hv = HERO_VFX[key];
    if (!hv || !heroVfxImgs[key]) return null;
    var rm = RTS.Config.reducedMotion;
    var life = opts && opts.life != null ? opts.life : heroVfxDuration(key);
    if (rm) life = Math.min(life, 0.12);
    var fx = {
      kind: 'pfx',
      heroVfx: key,
      x: x,
      y: y,
      life: life,
      max: life,
      scale: (opts && opts.scale != null) ? opts.scale : (hv.scale || 1),
      loop: false,
      alpha: opts && opts.alpha != null ? opts.alpha : 1,
    };
    RTS.addEffect(s, fx);
    return fx;
  }

  function heroVfxFrameIndex(fx) {
    var hv = HERO_VFX[fx.heroVfx];
    if (!hv) return 0;
    if (RTS.Config.reducedMotion) return 0;
    var elapsed = fx.max - fx.life;
    var fi = Math.floor(elapsed * hv.fps);
    return Math.min(hv.frames - 1, Math.max(0, fi));
  }

  function drawHeroVfxSheet(ctx, key, fi, x, y, scale, alpha) {
    var hv = HERO_VFX[key];
    var img = heroVfxImgs[key];
    if (!hv || !img) return;
    var fw = hv.frameW;
    var fh = img.height;
    var sx = fi * fw;
    if (sx + fw > img.width) return;
    var drawW = Math.round(fw * scale);
    var drawH = Math.round(fh * scale);
    var dx = Math.round(x - drawW / 2);
    var footFrac = hv.footFrac != null ? hv.footFrac : 1.0;
    var dy = hv.foot ? Math.round(y - footFrac * drawH) : Math.round(y - drawH / 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, 0, fw, fh, dx, dy, drawW, drawH);
    ctx.restore();
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
    if (fx.heroVfx) return heroVfxFrameIndex(fx);
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
    var img = RTS.Assets.img(sh.rel, sh.base);
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
      var heroKeys = Object.keys(HERO_VFX);
      var loads = keys.map(function (k) {
        var sh = SHEETS[k];
        return RTS.Assets.loadImg(sh.rel, sh.base);
      });
      heroKeys.forEach(function (k) {
        var hv = HERO_VFX[k];
        loads.push(
          RTS.Assets.loadImg(hv.file, hv.base, HERO_VFX_CACHE_V).then(function (img) {
            heroVfxImgs[k] = img;
          })
        );
      });
      Promise.all(loads)
        .then(function () {
          ready = true;
          heroVfxReady = heroKeys.every(function (k) { return !!heroVfxImgs[k]; });
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

    /** Single dust puff sized to a world-space diameter (e.g. unit footprint). */
    spawnDustSized: function (s, x, y, diameterPx) {
      if (!ready || RTS.Config.reducedMotion) return;
      diameterPx = Math.max(12, diameterPx || 32);
      var scale = Math.max(0.38, Math.min(1.35, diameterPx / 68));
      var key = ((x * 3 + y * 5) | 0) % 2 ? 'dust2' : 'dust1';
      addPfx(s, { sheet: key, x: x, y: y, scale: scale });
    },

    spawnUnitDust: function (s, u) {
      if (!u) return;
      var footY = u.y + u.radius * 0.35;
      var diam = u.radius * 2 * (RTS.SizeRef ? RTS.SizeRef.UNIT_VISUAL_SCALE : 1.35);
      if (RTS.Sprites && RTS.Sprites.unitVisualBounds) {
        var vb = RTS.Sprites.unitVisualBounds(u, s);
        if (vb) {
          footY = vb.footY + 2;
          diam = vb.groundRx * 2.05;
        }
      }
      this.spawnDustSized(s, u.x, footY, diam);
    },

    spawnBuildingDust: function (s, b) {
      if (!b) return;
      var footY = b.y + b.h * 0.4;
      var diam = b.w * 0.55;
      if (RTS.Assets && RTS.Assets.buildingVisualBounds) {
        var vb = RTS.Assets.buildingVisualBounds(b, s);
        if (vb) {
          footY = vb.footY + 4;
          diam = vb.drawW * 0.52;
        }
      }
      this.spawnDustSized(s, b.x, footY, diam);
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

    /** Small impact VFX at projectile / melee hit — faction/role aware. */
    spawnImpact: function (s, x, y, role, faction) {
      if (!ready || RTS.Config.reducedMotion) return;
      if (role === 'monk' && faction === 'rimwalker') {
        addPfx(s, { sheet: 'hexExplosion', x: x, y: y, scale: 0.35, alpha: 0.88 });
        return;
      }
      if (role === 'monk') {
        addPfx(s, { sheet: 'burstViolet', x: x, y: y, scale: 0.35, alpha: 0.88 });
        return;
      }
      if (role === 'warrior' || role === 'lancer') {
        var dkey = ((x * 3 + y * 5) | 0) % 2 ? 'dust2' : 'dust1';
        addPfx(s, { sheet: dkey, x: x, y: y, scale: 0.34, alpha: 0.72 });
        addPfx(s, { sheet: 'splatterRed', x: x, y: y + 2, scale: 0.45, alpha: 0.9 });
        return;
      }
      var key = ((x * 3 + y * 5) | 0) % 2 ? 'dust2' : 'dust1';
      addPfx(s, { sheet: key, x: x, y: y, scale: 0.34, alpha: 0.72 });
    },

    /** Death burst sized and styled to the dying unit's faction. */
    spawnUnitDeath: function (s, x, y, faction) {
      if (!ready || RTS.Config.reducedMotion) return;
      if (faction === 'rimwalker') {
        addPfx(s, { sheet: 'hexExplosion', x: x, y: y, scale: 0.9 });
      } else if (faction === 'cinder') {
        addPfx(s, { sheet: 'splatterRed',  x: x, y: y,     scale: 0.8 });
        addPfx(s, { sheet: 'burstOrange',  x: x, y: y - 4, scale: 0.7, alpha: 0.85 });
      } else {
        addPfx(s, { sheet: 'burstOrange',  x: x, y: y, scale: 0.9 });
      }
    },

    /** Hero ability VFX (e.g. Root Lash at target feet). */
    spawnHeroVfx: function (s, key, x, y, scale) {
      if (!heroVfxReady || RTS.Config.reducedMotion) return null;
      return addHeroVfx(s, key, x, y, { scale: scale });
    },

    spawnRootLash: function (s, x, y, scale) {
      return this.spawnHeroVfx(s, 'root_lash', x, y, scale);
    },

    targetFootY: function (target, s) {
      if (!target) return 0;
      if (target.role && RTS.Sprites && RTS.Sprites.unitFootY) {
        return RTS.Sprites.unitFootY(target, s);
      }
      if (target.type && RTS.Assets && RTS.Assets.buildingVisualBounds) {
        var vb = RTS.Assets.buildingVisualBounds(target, s);
        if (vb && vb.footY != null) return vb.footY;
      }
      var r = target.radius || Math.max(target.w || 0, target.h || 0) / 2;
      return target.y + r * 0.35;
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
        var alpha = (fx.alpha != null ? fx.alpha : 1) * a;
        if (fx.heroVfx) {
          drawHeroVfxSheet(ctx, fx.heroVfx, fi, fx.x, fx.y, fx.scale, alpha);
          return;
        }
        drawSheet(ctx, fx.sheet, fi, fx.x, fx.y, fx.scale, alpha);
      });
    },
  };

})(window.RTS = window.RTS || {});
