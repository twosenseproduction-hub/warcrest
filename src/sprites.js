/* ============================================================================
 * EXOFRONT — sprites.js
 * Tiny Swords kingdom humans — Blue vs Red. Combat uses one-shot attack clips.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var FACTIONS = ['aurex', 'cinder'];
  var ROLES = ['pawn', 'lancer', 'archer', 'monk', 'warrior', 'valdris'];

  var ROLE_DEF = {
    pawn: {
      unit: 'Pawn', frameH: 192, scale: 1,
      clips: {
        idle: { file: 'Pawn_Idle Pickaxe.png', count: 8, speed: 2.2 },
        walk: { file: 'Pawn_Run Pickaxe.png', count: 6, speed: 9 },
        walk_carry: { file: 'Pawn_Run Gold.png', count: 6, speed: 9 },
        work: { file: 'Pawn_Interact Pickaxe.png', count: 6, speed: 10 },
        idle_hammer: { file: 'Pawn_Idle Hammer.png', count: 8, speed: 2.2 },
        walk_hammer: { file: 'Pawn_Run Hammer.png', count: 6, speed: 9 },
        work_hammer: { file: 'Pawn_Interact Hammer.png', count: 3, speed: 10 },
      },
    },
    lancer: {
      unit: 'Lancer', frameH: 320, scale: 1,
      clips: {
        idle: { file: 'Lancer_Idle.png', count: 12, speed: 2.2 },
        walk: { file: 'Lancer_Run.png', count: 6, speed: 10 },
        attack_r: { file: 'Lancer_Right_Attack.png', count: 3, fps: 14, impactFrame: 1 },
        attack_ur: { file: 'Lancer_UpRight_Attack.png', count: 3, fps: 14, impactFrame: 1 },
        attack_u: { file: 'Lancer_Up_Attack.png', count: 3, fps: 14, impactFrame: 1 },
        attack_dr: { file: 'Lancer_DownRight_Attack.png', count: 3, fps: 14, impactFrame: 1 },
        attack_d: { file: 'Lancer_Down_Attack.png', count: 3, fps: 14, impactFrame: 1 },
      },
    },
    archer: {
      unit: 'Archer', frameH: 192, scale: 1.0,
      clips: {
        idle: { file: 'Archer_Idle.png', count: 6, speed: 2.2 },
        walk: { file: 'Archer_Run.png', count: 4, speed: 9 },
        attack: { file: 'Archer_Shoot.png', count: 8, fps: 14, releaseFrame: 5 },
      },
    },
    monk: {
      unit: 'Monk', frameH: 192, scale: 1.0,
      clips: {
        idle: { file: 'Idle.png', count: 6, speed: 2.2 },
        walk: { file: 'Run.png', count: 4, speed: 9 },
        attack: { file: 'Heal.png', count: 11, fps: 10, releaseFrame: 5 },
        heal_effect: { file: 'Heal_Effect.png', count: 11, fps: 10 },
      },
    },
    warrior: {
      unit: 'Warrior', frameH: 192, scale: 1,
      clips: {
        idle: { file: 'Warrior_Idle.png', count: 8, speed: 2.0 },
        walk: { file: 'Warrior_Run.png', count: 6, speed: 8 },
        guard: { file: 'Warrior_Guard.png', count: 6, speed: 2.0 },
        attack: { file: 'Warrior_Attack1.png', count: 4, fps: 12, impactFrame: 2 },
        attack2: { file: 'Warrior_Attack2.png', count: 4, fps: 12, impactFrame: 2 },
      },
    },
    valdris: {
      frameH: 256, scale: 1.04, base: '', directional: true,
      clips: {
        idle_d: { file: 'assets/heroes/valdris/Valdris_Down_Idle.png', count: 9, speed: 6 },
        idle_r: { file: 'assets/heroes/valdris/Valdris_Right_Idle.png', count: 9, speed: 6 },
        idle_u: { file: 'assets/heroes/valdris/Valdris_Up_Idle.png', count: 9, speed: 6 },
        idle_l: { file: 'assets/heroes/valdris/Valdris_Left_Idle.png', count: 9, speed: 6 },
        walk_d: { file: 'assets/heroes/valdris/Valdris_Down_Walk.png', count: 9, speed: 8 },
        walk_r: { file: 'assets/heroes/valdris/Valdris_Right_Walk.png', count: 9, speed: 8 },
        walk_u: { file: 'assets/heroes/valdris/Valdris_Up_Walk.png', count: 9, speed: 8 },
        walk_l: { file: 'assets/heroes/valdris/Valdris_Left_Walk.png', count: 9, speed: 8 },
        attack_d: { file: 'assets/heroes/valdris/Valdris_Down_Attack.png', count: 7, fps: 12, impactFrame: 3 },
        attack_r: { file: 'assets/heroes/valdris/Valdris_Right_Attack.png', count: 7, fps: 12, impactFrame: 3 },
        attack_u: { file: 'assets/heroes/valdris/Valdris_Up_Attack.png', count: 7, fps: 12, impactFrame: 3 },
        attack_l: { file: 'assets/heroes/valdris/Valdris_Left_Attack.png', count: 7, fps: 12, impactFrame: 3 },
      },
    },
  };

  /* Cinder horde — tiny-swords-enemy pack (no faction color folders). */
  var ENEMY_ROLE_DEF = {
    pawn: {
      folder: 'Enemies/Gnome', frameH: 192, scale: 1,
      clips: {
        idle: { file: 'Gnome_Idle.png', count: 8, speed: 2.2 },
        walk: { file: 'Gnome_Run.png', count: 6, speed: 9 },
        walk_carry: { file: 'Gnome_Run.png', count: 6, speed: 9 },
        work: { file: 'Gnome_Attack.png', count: 7, speed: 10 },
        idle_hammer: { file: 'Gnome_Idle.png', count: 8, speed: 2.2 },
        walk_hammer: { file: 'Gnome_Run.png', count: 6, speed: 9 },
        work_hammer: { file: 'Gnome_Attack.png', count: 7, speed: 10 },
      },
    },
    lancer: {
      folder: 'Enemies/Goblin Raiders/Spear Goblin', frameH: 256, scale: 1,
      clips: {
        idle: { file: 'Spear Goblin_Idle.png', count: 8, speed: 2.2 },
        walk: { file: 'Spear Goblin_Run.png', count: 6, speed: 10 },
        attack: { file: 'Spear Goblin_Attack Strong.png', count: 8, fps: 14, impactFrame: 3 },
      },
    },
    archer: {
      folder: 'Enemies/Gnoll', frameH: 192, scale: 1,
      clips: {
        idle: { file: 'Gnoll_Idle.png', count: 6, speed: 2.2 },
        walk: { file: 'Gnoll_Walk.png', count: 8, speed: 9 },
        attack: { file: 'Gnoll_Throw.png', count: 8, fps: 14, releaseFrame: 4 },
      },
    },
    monk: {
      folder: 'Enemies/Goblin Raiders/Hex Shaman', frameH: 192, scale: 1,
      clips: {
        idle: { file: 'Hex Shaman_Idle.png', count: 8, speed: 2.2 },
        walk: { file: 'Hex Shaman_Run.png', count: 4, speed: 9 },
        attack: { file: 'Hex Shaman_Attack.png', count: 10, fps: 10, releaseFrame: 5 },
        heal_effect: { file: 'Hex Shaman_Explosion Spell.png', count: 10, fps: 10 },
      },
    },
    warrior: {
      folder: 'Enemies/Troll', frameH: 384, scale: 0.72,
      clips: {
        idle: { file: 'Troll_Idle.png', count: 12, speed: 2.0 },
        walk: { file: 'Troll_Walk.png', count: 10, speed: 7 },
        guard: { file: 'Troll_Idle.png', count: 12, speed: 2.0 },
        attack: { file: 'Troll_Attack.png', count: 6, fps: 10, impactFrame: 2 },
      },
    },
  };

  var sheets = {};

  function phaseOf(id) {
    var h = typeof id === 'number' ? ((id * 2654435761) >>> 0) : 0;
    return (h % 997) / 997 * 6.2832;
  }

  function clipFps(clip) {
    return clip.fps || clip.speed || 10;
  }

  function clipDuration(clip) {
    return clip.count / clipFps(clip);
  }

  function roleDef(factionId, role) {
    return factionId === 'cinder' ? ENEMY_ROLE_DEF[role] : ROLE_DEF[role];
  }

  function assetBase(factionId) {
    return factionId === 'cinder' ? RTS.Assets.ENEMY_BASE : RTS.Assets.KINGDOM_BASE;
  }

  function unitPath(factionId, role, file) {
    var def = roleDef(factionId, role);
    if (!def) return '';
    if (def.base === '') return file;
    if (factionId === 'cinder') {
      return def.folder + '/' + file;
    }
    var color = RTS.Assets.factionColor(factionId);
    return 'Units/' + color + ' Units/' + def.unit + '/' + file;
  }

  function loadRoleSheet(factionId, role) {
    var def = roleDef(factionId, role);
    if (!def) return Promise.resolve(null);
    var base = def.base != null ? def.base : assetBase(factionId);
    var clipKeys = Object.keys(def.clips);
    var promises = clipKeys.map(function (ck) {
      var clip = def.clips[ck];
      return RTS.Assets.loadImg(unitPath(factionId, role, clip.file), base).then(function (img) {
        return { key: ck, img: img, meta: clip };
      });
    });
    return Promise.all(promises).then(function (parts) {
      var entry = {
        frameH: def.frameH,
        frameW: def.frameH,
        scale: def.scale,
        clips: {},
      };
      parts.forEach(function (p) {
        var fw = Math.round(p.img.width / p.meta.count);
        entry.clips[p.key] = {
          img: p.img,
          count: p.meta.count,
          speed: p.meta.speed,
          fps: p.meta.fps,
          releaseFrame: p.meta.releaseFrame,
          impactFrame: p.meta.impactFrame,
          frameW: fw,
        };
        entry.frameW = fw;
      });
      entry.directional = !!def.directional;
      sheets[factionId + '_' + role] = entry;
      return entry;
    });
  }

  function sizeRef() { return RTS.SizeRef; }

  function unitDrawRadius(u) {
    var sr = sizeRef();
    return sr.pxRadius(u.role) * sr.UNIT_VISUAL_SCALE *
      (1 + (u.spawnFlash || 0) * 0.28);
  }

  function unitVisualMul(u, sheet) {
    if (u.role === 'lancer' && sheet && sheet.frameH >= 300) {
      return sizeRef().LANCER_VISUAL_MUL;
    }
    return 1;
  }

  function unitDrawHeight(r, u, sheet) {
    var mul = unitVisualMul(u, sheet) * ((sheet && sheet.scale) || 1);
    return sizeRef().pxHeight(u.role, mul);
  }

  function mirroredAngle(facing) {
    if (Math.cos(facing) < -0.12) return Math.PI - facing;
    return facing;
  }

  function lancerAttackKey(facing) {
    var deg = mirroredAngle(facing) * 180 / Math.PI;
    if (deg >= -22.5 && deg < 22.5) return 'attack_r';
    if (deg >= 22.5 && deg < 67.5) return 'attack_dr';
    if (deg >= 67.5) return 'attack_d';
    if (deg >= -67.5 && deg < -22.5) return 'attack_ur';
    return 'attack_u';
  }

  function cardinalSuffix(facing) {
    var ax = Math.cos(facing);
    var ay = Math.sin(facing);
    if (Math.abs(ax) >= Math.abs(ay)) return ax < 0 ? 'l' : 'r';
    return ay < 0 ? 'u' : 'd';
  }

  function directionalKey(sheet, baseKey, facing) {
    if (!sheet || !sheet.directional) return baseKey;
    var key = baseKey + '_' + cardinalSuffix(facing);
    return sheet.clips[key] ? key : baseKey;
  }

  function isAttackClipKey(key) {
    return key === 'attack' || key === 'attack2' ||
      key.indexOf('attack_') === 0;
  }

  function resolveAttackKey(u, sheet) {
    if (sheet.directional) return directionalKey(sheet, 'attack', u.facing);
    if (u.role === 'lancer') {
      if (sheet.clips.attack_r) return lancerAttackKey(u.facing);
      return 'attack';
    }
    if (u.role === 'warrior') {
      if (sheet.clips.attack2 && u._attackVariant === 2) return 'attack2';
      return 'attack';
    }
    return 'attack';
  }

  function getClip(sheet, key, facing) {
    if (facing != null) key = directionalKey(sheet, key, facing);
    return sheet.clips[key] || sheet.clips.attack || sheet.clips.idle ||
      sheet.clips.idle_d || sheet.clips.walk || sheet.clips.walk_d;
  }

  function defaultVisualClip(sheet) {
    return sheet.clips.idle || sheet.clips.idle_d ||
      sheet.clips.walk || sheet.clips.walk_d;
  }

  function drawSpriteFrame(ctx, clip, sheet, fi, u, drawW, drawH, drawY, flip) {
    var fw = clip.frameW || sheet.frameW;
    var fh = sheet.frameH;
    var sx = fi * fw;
    ctx.save();
    if (flip < 0) {
      ctx.translate(u.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-u.x, 0);
    }
    ctx.drawImage(clip.img, sx, 0, fw, fh, u.x - drawW / 2, drawY, drawW, drawH);
    ctx.restore();
  }

  RTS.Sprites = {
    ready: false,
    sheets: sheets,
    roles: ROLE_DEF,
    enemyRoles: ENEMY_ROLE_DEF,

    load: function (cb) {
      var self = this;
      if (!RTS.Assets || !RTS.Assets.ready) {
        if (cb) cb(new Error('assets not ready'));
        return;
      }
      var jobs = [];
      FACTIONS.forEach(function (fid) {
        ROLES.forEach(function (role) { jobs.push(loadRoleSheet(fid, role)); });
      });
      Promise.all(jobs).then(function () {
        self.ready = Object.keys(sheets).length > 0;
        if (cb) cb();
      }).catch(function (err) {
        console.error('EXOFRONT unit sprites failed', err);
        self.ready = false;
        if (cb) cb(err);
      });
    },

    sheetKey: function (u) { return u.faction + '_' + u.role; },

    attackActive: function (u) {
      return u.attackClip && u.attackAnimT != null &&
        u.attackAnimT < (u.attackAnimLen || 0);
    },

    startAttack: function (u, target) {
      var sheet = sheets[this.sheetKey(u)];
      if (!sheet) return;
      if (u.role === 'warrior') {
        u._attackVariant = (u._attackVariant === 1) ? 2 : 1;
      }
      var key = resolveAttackKey(u, sheet);
      var clip = getClip(sheet, key, u.facing);
      if (!clip) return;
      u.attackClip = key;
      u.attackAnimT = 0;
      u.attackAnimLen = clipDuration(clip);
      u.attackTargetId = target ? target.id : null;
    },

    tickAttack: function (u, dt) {
      if (u.attackAnimT == null) return;
      u.attackAnimT += dt;
      if (u.attackAnimT >= (u.attackAnimLen || 0)) {
        u.attackClip = null;
        u.attackAnimT = null;
        u.attackAnimLen = null;
        u.attackTargetId = null;
        u._pendingShot = null;
        u._pendingMelee = null;
        u._pendingHeal = null;
      }
    },

    currentAttackFrame: function (u) {
      if (!this.attackActive(u)) return -1;
      var sheet = sheets[this.sheetKey(u)];
      if (!sheet) return -1;
      var clip = getClip(sheet, u.attackClip, u.facing);
      if (!clip) return -1;
      return Math.min(clip.count - 1, Math.floor(u.attackAnimT * clipFps(clip)));
    },

    atReleaseFrame: function (u) {
      var sheet = sheets[this.sheetKey(u)];
      if (!sheet || !this.attackActive(u)) return false;
      var clip = getClip(sheet, u.attackClip, u.facing);
      if (!clip) return false;
      var rf = clip.releaseFrame != null ? clip.releaseFrame : clip.count - 1;
      return this.currentAttackFrame(u) >= rf;
    },

    atImpactFrame: function (u) {
      var sheet = sheets[this.sheetKey(u)];
      if (!sheet || !this.attackActive(u)) return false;
      var clip = getClip(sheet, u.attackClip, u.facing);
      if (!clip) return false;
      var frame = clip.impactFrame != null ? clip.impactFrame : Math.floor(clip.count * 0.5);
      return this.currentAttackFrame(u) >= frame;
    },

    pickAnim: function (u, walking) {
      if (u.role === 'pawn' && u.buildTask) {
        if (u._builderOnSite) return 'work_hammer';
        return walking ? 'walk_hammer' : 'idle_hammer';
      }
      if (u.role === 'pawn' && u.harvest) {
        if (u.harvest.phase === 'mining') return 'work';
        if (u.harvest.carry > 0 && walking) return 'walk_carry';
      }
      if (this.attackActive(u)) return u.attackClip;
      if (u.role === 'warrior' && u.inAttackRange && !walking) return 'guard';
      if (walking) return 'walk';
      return 'idle';
    },

    frameIndex: function (u, clip, animName) {
      if (isAttackClipKey(animName) && u.attackAnimT != null) {
        return Math.min(clip.count - 1, Math.floor(u.attackAnimT * clipFps(clip)));
      }
      if (animName === 'work' || animName === 'work_hammer') {
        return Math.floor((u._workPhase || 0) * clip.speed) % clip.count;
      }
      // Idle clips — use dedicated idle phase ticked every draw call
      if (animName === 'idle' || animName === 'idle_hammer') {
        var idleFps = clip.speed || clip.fps || 4;
        return Math.floor((u._idlePhase || 0) * idleFps) % clip.count;
      }
      // Guard uses idle phase too (warrior standing in attack range)
      if (animName === 'guard') {
        var guardFps = clip.speed || clip.fps || 4;
        return Math.floor((u._idlePhase || 0) * guardFps) % clip.count;
      }
      // Walk clips
      return Math.floor((u._walkPhase || 0) * clip.speed) % clip.count;
    },

    unitFootY: function (u, s) {
      var grid = s && s.map && s.map.terrainGrid;
      return grid && RTS.Terrain ? RTS.Terrain.groundY(grid, u.x, u.y) : u.y + 10;
    },

    unitVisualBounds: function (u, s) {
      var sheet = sheets[this.sheetKey(u)];
      if (!sheet) return null;
      var r = unitDrawRadius(u);
      var footY = this.unitFootY(u, s);
      var drawH = unitDrawHeight(r, u, sheet);
      var clip = defaultVisualClip(sheet);
      var fw = clip ? (clip.frameW || sheet.frameW) : sheet.frameW;
      var fh = sheet.frameH;
      var drawW = (fw / fh) * drawH;
      var footRatio = RTS.SizeRef && RTS.SizeRef.unitFootRatio
        ? RTS.SizeRef.unitFootRatio(u.role, fh)
        : (fh >= 300 ? 0.91 : 0.94);
      var drawY = footY - drawH * footRatio;
      var soleY = drawY + drawH * footRatio;
      var insetX = 0.18;
      var insetTop = 0.08;
      var insetBot = 0.05;
      return {
        x: u.x, footY: footY, soleY: soleY, footRatio: footRatio,
        drawW: drawW, drawH: drawH, drawY: drawY,
        groundRx: Math.max(r * 0.95, drawW * 0.24),
        groundRy: Math.max(r * 0.36, 8),
        bodyCy: drawY + drawH * 0.55,
        tight: {
          x: u.x - drawW / 2 + drawW * insetX,
          y: drawY + drawH * insetTop,
          w: drawW * (1 - insetX * 2),
          h: drawH * (1 - insetTop - insetBot),
        },
      };
    },

    drawHealEffect: function (ctx, monk, target, s) {
      if (!this.attackActive(monk) || monk.role !== 'monk' || !target) return;
      var sheet = sheets[this.sheetKey(monk)];
      if (!sheet || !sheet.clips.heal_effect) return;
      var clip = sheet.clips.heal_effect;
      var fi = this.currentAttackFrame(monk);
      if (fi < 0) return;
      var r = unitDrawRadius(target);
      var footY = this.unitFootY(target, s);
      var drawH = unitDrawHeight(r, target, sheet);
      var fw = clip.frameW || sheet.frameW;
      var drawW = (fw / sheet.frameH) * drawH;
      var footRatio = RTS.SizeRef && RTS.SizeRef.unitFootRatio
        ? RTS.SizeRef.unitFootRatio(target.role, sheet.frameH)
        : 0.94;
      var drawY = footY - drawH * footRatio;
      var sx = fi * fw;
      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.drawImage(clip.img, sx, 0, fw, sheet.frameH,
        target.x - drawW / 2, drawY, drawW, drawH);
      ctx.restore();
    },

    drawUnit: function (ctx, u, f, s) {
      var Art = RTS.Art;
      var sheet = sheets[this.sheetKey(u)];

      if (u.dead) {
        if (!sheet) { Art.deathBurst(ctx, u, f); return; }
        var max = RTS.Config.corpseFade || 1.2;
        var k = Math.max(0, u.corpse) / max;
        if (k >= 1) return;
        var a = 1 - k;
        var corpseClip = defaultVisualClip(sheet);
        if (!corpseClip) return;
        var r = unitDrawRadius(u) * (1 - k * 0.15);
        var vb = this.unitVisualBounds(u, s);
        if (!vb) return;
        ctx.save();
        ctx.globalAlpha = a;
        var fw = corpseClip.frameW || sheet.frameW;
        var fh = sheet.frameH;
        var flip = Math.cos(u.facing) < -0.12 ? -1 : 1;
        drawSpriteFrame(ctx, corpseClip, sheet, 0, u, vb.drawW, vb.drawH, vb.drawY + k * 8, flip);
        ctx.restore();
        return;
      }

      if (!sheet) return;

      var rm = RTS.Config.reducedMotion;
      var r = unitDrawRadius(u);

      var dx = u.x - (u._ax != null ? u._ax : u.x);
      var dy = u.y - (u._ay != null ? u._ay : u.y);
      var dist = Math.hypot(dx, dy);
      if (dist > 0.8) {
        u._walkPhase = (u._walkPhase || 0) + dist * 0.022;
        u._moveHold = 4;
        u._idlePhase = u._idlePhase || 0; // don't reset idle phase
      } else if (u._moveHold > 0) {
        u._moveHold--;
      }
      // Always tick idle phase with real elapsed time.
      // dt is not directly available here, so derive it from a stable 60fps assumption.
      // The game runs requestAnimationFrame — use a fixed 1/60 tick per draw call.
      u._idlePhase = ((u._idlePhase || 0) + (1 / 60));
      u._ax = u.x;
      u._ay = u.y;

      if (!u.buildTask) u._builderOnSite = false;

      var mining = u.role === 'pawn' && u.harvest && u.harvest.phase === 'mining';
      var onBuildSite = u.role === 'pawn' && u.buildTask && u._builderOnSite;
      var walking = !mining && !onBuildSite && !this.attackActive(u) && u._moveHold > 0;

      var animName = this.pickAnim(u, walking);
      var clip = getClip(sheet, animName, u.facing);
      if (!clip || !clip.img) return;

      var fi = rm ? 0 : this.frameIndex(u, clip, animName);
      var flip = sheet.directional ? 1 : (Math.cos(u.facing) < -0.12 ? -1 : 1);
      var vb = this.unitVisualBounds(u, s);
      if (!vb) return;

      drawSpriteFrame(ctx, clip, sheet, fi, u, vb.drawW, vb.drawH, vb.drawY, flip);

      if (u.role === 'monk' && this.attackActive(u) && u.attackTargetId) {
        var ally = RTS.getById(s, u.attackTargetId);
        this.drawHealEffect(ctx, u, ally, s);
      }

      Art.drawUnitOverlays(ctx, u, f, s, r, Art.minionPalette(f, u.team), vb, true);
    },
  };

})(window.RTS = window.RTS || {});
