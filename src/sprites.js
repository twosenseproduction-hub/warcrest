/* ============================================================================
 * EXOFRONT — sprites.js
 * Tiny Swords kingdom humans — Blue vs Red. Combat uses one-shot attack clips.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var FACTIONS = ['aurex', 'cinder'];
  var ROLES = ['pawn', 'lancer', 'archer', 'monk', 'warrior'];

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
  };

  /* -----------------------------------------------------------------------
   * Iron Crown — 36×36 per-frame custom unit art in assets/units/iron_crown/
   * Actual clip frame counts measured from PNG dimensions (width ÷ height).
   * idle(10) walk(10) run(5) attack(8) cast(10) death(8)
   * ----------------------------------------------------------------------- */
  function icClips(key) {
    /* key = e.g. 'mage_l1' */
    return {
      idle:       { file: key + '_idle.png',   count: 10, speed: 2.2 },
      walk:       { file: key + '_walk.png',   count: 10, speed: 9 },
      guard:      { file: key + '_idle.png',   count: 10, speed: 2.0 },
      walk_carry: { file: key + '_run.png',    count: 5,  speed: 9 },
      attack:     { file: key + '_attack.png', count: 8,  fps: 12, impactFrame: 3 },
      attack2:    { file: key + '_cast.png',   count: 10, fps: 12, releaseFrame: 5 },
      death:      { file: key + '_death.png',  count: 8,  speed: 7 },
    };
  }
  function icPawnClips(key) {
    return {
      idle:        { file: key + '_idle.png',   count: 10, speed: 2.2 },
      walk:        { file: key + '_run.png',    count: 5,  speed: 9 },   /* no _walk.png strip — reuse run */
      walk_carry:  { file: key + '_run.png',    count: 5,  speed: 9 },
      work:        { file: key + '_attack.png', count: 8,  speed: 10 },
      idle_hammer: { file: key + '_idle.png',   count: 10, speed: 2.2 },
      walk_hammer: { file: key + '_run.png',    count: 5,  speed: 9 },
      work_hammer: { file: key + '_attack.png', count: 8,  speed: 10 },
      death:       { file: key + '_death.png',  count: 8,  speed: 7 },
    };
  }

  var IC_FRAME_H = 36;
  var IC_SCALE   = 3.5;   /* 36px frame rendered at ~100px — matches Tiny Swords visual size */

  /* New 64×64px strips — swordman / archer / sword_horse / blade / rider / wizard */
  function u64Clips(hasRun, hasDeath) {
    return {
      idle:       { file: 'idle.png',                          count: 6, speed: 2.2 },
      walk:       { file: 'walk.png',                          count: 6, speed: 9 },
      guard:      { file: 'idle.png',                          count: 6, speed: 2.0 },
      walk_carry: { file: hasRun ? 'run.png' : 'walk.png',    count: 6, speed: 9 },
      attack:     { file: 'attack.png', count: 6, fps: 12, impactFrame: 3 },
      attack2:    { file: 'attack.png', count: 6, fps: 12, impactFrame: 3 },
      death:      { file: hasDeath ? 'death.png' : 'walk.png', count: 6, speed: 7 },
    };
  }
  var IC64_FRAME_H = 64;
  var IC64_SCALE   = 2.0;

  var IRON_CROWN_ROLE_DEF = {
    pawn:    { folder: 'units/iron_crown',              frameH: IC_FRAME_H,   scale: IC_SCALE,          clips: icPawnClips('worker') },
    warrior: { folder: 'units/iron_crown/swordman',     frameH: IC64_FRAME_H, scale: IC64_SCALE,         clips: u64Clips(false, true) },
    archer:  { folder: 'units/iron_crown/archer',       frameH: IC64_FRAME_H, scale: IC64_SCALE,         clips: u64Clips(true,  false) },
    lancer:  { folder: 'units/iron_crown/sword_horse',  frameH: IC64_FRAME_H, scale: IC64_SCALE * 1.12,  clips: u64Clips(false, true) },
    monk:    { folder: 'units/iron_crown/Mage',         frameH: IC_FRAME_H,   scale: IC_SCALE,           clips: icClips('mage_l1') },
  };

  /* -----------------------------------------------------------------------
   * Rimwalker combat units — 36×36 per-frame art in assets/units/rimwalker_combat/
   * Same animation layout as Iron Crown.
   * ----------------------------------------------------------------------- */
  function rwClips(key) {
    return {
      idle:       { file: key + '_idle.png',   count: 6,  speed: 2.2 },
      walk:       { file: key + '_walk.png',   count: 6,  speed: 9 },
      guard:      { file: key + '_idle.png',   count: 6,  speed: 2.0 },
      walk_carry: { file: key + '_run.png',    count: 5,  speed: 9 },
      attack:     { file: key + '_attack.png', count: 8,  fps: 12, impactFrame: 3 },
      attack2:    { file: key + '_cast.png',   count: 10, fps: 12, releaseFrame: 5 },
      death:      { file: key + '_death.png',  count: 8,  speed: 7 },
    };
  }

  var RW_FRAME_H = 36;
  var RW_SCALE   = 3.5;

  /* Rider has a separate glaive-effect overlay strip (row 4 of source sheet,
   * saved as glaive_effect.png).  No dedicated death strip — falls back to walk. */
  function riderClips() {
    return {
      idle:          { file: 'idle.png',          count: 6, speed: 2.2 },
      walk:          { file: 'walk.png',           count: 6, speed: 9 },
      guard:         { file: 'idle.png',           count: 6, speed: 2.0 },
      walk_carry:    { file: 'run.png',            count: 6, speed: 9 },
      attack:        { file: 'attack.png',         count: 6, fps: 12, impactFrame: 3 },
      attack2:       { file: 'attack.png',         count: 6, fps: 12, impactFrame: 3 },
      glaive_effect: { file: 'glaive_effect.png',  count: 6, fps: 12 },
      death:         { file: 'walk.png',           count: 6, speed: 7 },
    };
  }

  var RIMWALKER_COMBAT_ROLE_DEF = {
    warrior: { folder: 'units/rimwalker/blade',   frameH: IC64_FRAME_H, scale: IC64_SCALE,        clips: u64Clips(false, true) },
    archer:  { folder: 'units/rimwalker/archer',  frameH: IC64_FRAME_H, scale: IC64_SCALE,        clips: u64Clips(true,  false) },
    lancer:  { folder: 'units/rimwalker/rider',   frameH: IC64_FRAME_H, scale: IC64_SCALE * 1.12, clips: riderClips() },
    monk:    { folder: 'units/rimwalker/wizard',  frameH: IC64_FRAME_H, scale: IC64_SCALE,        clips: u64Clips(true,  true) },
  };

  /* Cinder horde — tiny-swords-enemy pack (no faction color folders). */
  /* Rimwalker faction — custom Pixel Crawler art in assets/units/ */
  var RIMWALKER_ROLE_DEF = {
    pawn: {
      folder: 'units/elf_worker', frameH: 64, scale: 1.5,
      clips: {
        idle:        { file: 'Idle-Sheet.png', count: 4, speed: 2.2 },
        walk:        { file: 'Run-Sheet.png',  count: 6, speed: 9 },
        walk_carry:  { file: 'Run-Sheet.png',  count: 6, speed: 9 },
        work:        { file: 'Hit-Sheet.png',  count: 4, speed: 10 },
        idle_hammer: { file: 'Idle-Sheet.png', count: 4, speed: 2.2 },
        walk_hammer: { file: 'Run-Sheet.png',  count: 6, speed: 9 },
        work_hammer: { file: 'Hit-Sheet.png',  count: 4, speed: 10 },
        death:       { file: 'Death-Sheet.png', count: 6, speed: 8 },
      },
    },
  };

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

  /* Custom heroes — Pixel Labs / bespoke art under assets/heroes/<faction>/ */
  function heroBase(heroId) {
    var def = HERO_DEF[heroId];
    if (!def) return 'assets/heroes/aurex/';
    return 'assets/heroes/' + (def.faction || 'aurex') + '/';
  }

  var HERO_DEF = {
    valdris: {
      faction: 'aurex',
      folder: 'valdris',
      frameH: 256,
      scale: 1.05,
      clips: {
        idle: { file: 'Valdris_Idle.png', count: 8, speed: 4 },
        walk: { file: 'Valdris_Run.png', count: 8, speed: 10 },
        guard: { file: 'Valdris_Idle.png', count: 8, speed: 2.5 },
        attack: { file: 'Valdris_Attack.png', count: 4, fps: 12, impactFrame: 2 },
      },
    },
    aelindra: {
      faction: 'rimwalker',
      folder: 'aelindra',
      frameH: 256,
      scale: 0.68,   // art fills ~88% of the 256px frame vs Valdris's 58% — scaled down to match hero visual size
      attackTopShift: 30 / 256,  // idle art has ~30px transparent headroom; attack fills full frame — shift down to match
      clips: {
        idle:  { file: 'Aelindra_Idle.png', count: 19, speed: 12 },
        walk: { file: 'Aelindra_Run_South.png', count: 8, speed: 16 },
        guard: { file: 'Aelindra_Idle.png', count: 19, speed: 7.5 },
        attack: { file: 'Aelindra_Attack.png', count: 8, fps: 14, impactFrame: 4, vfx: 'root_lash' },
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
    if (factionId === 'cinder') return ENEMY_ROLE_DEF[role];
    if (factionId === 'rimwalker') {
      return RIMWALKER_COMBAT_ROLE_DEF[role] || RIMWALKER_ROLE_DEF[role] || ROLE_DEF[role];
    }
    if (factionId === 'aurex') return IRON_CROWN_ROLE_DEF[role] || ROLE_DEF[role];
    return ROLE_DEF[role];
  }

  function assetBase(factionId) {
    if (factionId === 'cinder') return RTS.Assets.ENEMY_BASE;
    /* aurex and rimwalker use custom art — paths relative to site root */
    return '';
  }

  function unitPath(factionId, role, file) {
    var def = roleDef(factionId, role);
    if (!def) return '';
    if (factionId === 'cinder') {
      return def.folder + '/' + file;
    }
    if (def.folder) {
      return 'assets/' + def.folder + '/' + file;
    }
    /* Legacy Tiny Swords path fallback */
    var color = RTS.Assets.factionColor(factionId);
    return 'Units/' + color + ' Units/' + def.unit + '/' + file;
  }

  function loadRoleSheet(factionId, role) {
    var def = roleDef(factionId, role);
    if (!def) return Promise.resolve(null);
    var base = assetBase(factionId);
    var clipKeys = Object.keys(def.clips);
    var promises = clipKeys.map(function (ck) {
      var clip = def.clips[ck];
      return RTS.Assets.loadImg(unitPath(factionId, role, clip.file), base).then(function (img) {
        return { key: ck, img: img, meta: clip };
      }).catch(function (err) {
        console.warn('sprite clip missing:', factionId + '/' + role + '/' + clip.file,
          err && err.message ? err.message : err);
        return null;
      });
    });
    return Promise.all(promises).then(function (parts) {
      parts = parts.filter(function (p) { return p && p.img; });
      if (!parts.length) {
        console.warn('sprite sheet skipped (no clips loaded):', factionId, role);
        return null;
      }
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
      sheets[factionId + '_' + role] = entry;
      return entry;
    });
  }

  function heroWalkDir(facing) {
    var c = Math.cos(facing);
    var s = Math.sin(facing);
    if (Math.abs(c) >= Math.abs(s)) return c >= 0 ? 'east' : 'west';
    return s >= 0 ? 'south' : 'north';
  }

  /* Bump when hero strip PNGs change — busts browser image cache on reload. */
  var HERO_ASSET_V = '20260620z';

  /** Detect frame count from strip geometry (w÷h when cells are square). */
  function heroStripFrameCount(img, configured) {
    var w = img.width;
    var h = img.height;
    if (h <= 0) return configured || 1;
    if (w % h === 0) {
      var detected = w / h;
      if (configured && detected !== configured) {
        console.warn('hero strip frame count: configured ' + configured +
          ', detected ' + detected + ' (' + w + '×' + h + ') — using detected');
      }
      return detected;
    }
    if (w % 256 === 0) return w / 256;
    return configured || 1;
  }

  /** Copy hero strip to canvas; frame detection only — no pixel keying, no per-frame crops. */
  function prepareHeroStrip(img, count) {
    count = heroStripFrameCount(img, count);
    var fw = Math.round(img.width / count);
    var fh = img.height;
    var c = document.createElement('canvas');
    c.width = img.width;
    c.height = fh;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    return { canvas: c, crop: null, frameCrops: [], frameW: fw, count: count };
  }

  function loadHeroSheet(heroId) {
    var def = HERO_DEF[heroId];
    if (!def) return Promise.resolve(null);
    var base = heroBase(heroId) + def.folder + '/';
    var clipKeys = Object.keys(def.clips);
    var promises = [];
    clipKeys.forEach(function (ck) {
      var clip = def.clips[ck];
      if (clip.directions) {
        Object.keys(clip.directions).forEach(function (dir) {
          var file = clip.directions[dir];
          promises.push(
            RTS.Assets.loadImg(file, base, HERO_ASSET_V).then(function (img) {
              var prep = prepareHeroStrip(img, clip.count);
              return {
                key: ck + '_' + dir,
                img: prep.canvas,
                meta: clip,
                crop: prep.crop,
                frameCrops: prep.frameCrops,
                frameW: prep.frameW,
                count: prep.count,
              };
            }).catch(function (err) {
              console.warn('hero clip missing: ' + heroId + '/' + file, err.message || err);
              return null;
            })
          );
        });
        return;
      }
      promises.push(
        RTS.Assets.loadImg(clip.file, base, HERO_ASSET_V).then(function (img) {
          var prep = prepareHeroStrip(img, clip.count);
          return {
            key: ck,
            img: prep.canvas,
            meta: clip,
            crop: prep.crop,
            frameCrops: prep.frameCrops,
            frameW: prep.frameW,
            count: prep.count,
          };
        }).catch(function (err) {
          console.warn('hero clip missing: ' + heroId + '/' + clip.file, err.message || err);
          return null;
        })
      );
    });
    return Promise.all(promises).then(function (parts) {
      parts = parts.filter(function (p) { return p && p.img; });
      if (!parts.length) {
        console.warn('hero sprites skipped (no clips loaded): ' + heroId);
        return null;
      }
      var entry = {
        frameH: def.frameH,
        frameW: def.frameH,
        scale: def.scale,
        attackTopShift: def.attackTopShift || 0,
        clips: {},
        heroId: heroId,
      };
      parts.forEach(function (p) {
        var fw = p.frameW || Math.round(p.img.width / p.meta.count);
        var crop = p.crop;
        var fc = p.frameCrops;
        entry.clips[p.key] = {
          img: p.img,
          count: p.count || p.meta.count,
          speed: p.meta.speed,
          fps: p.meta.fps,
          releaseFrame: p.meta.releaseFrame,
          impactFrame: p.meta.impactFrame,
          frameW: fw,
          frameCrops: fc,
          cropX: crop ? crop.x : 0,
          cropY: crop ? crop.y : 0,
          cropW: crop ? crop.w : fw,
          cropH: crop ? crop.h : entry.frameH,
        };
        entry.frameW = fw;
      });
      entry.idleMissing = !entry.clips.idle;
      sheets['hero_' + heroId] = entry;
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

  function isAttackClipKey(key) {
    return key === 'attack' || key === 'attack2' ||
      key.indexOf('attack_') === 0;
  }

  function resolveAttackKey(u, sheet) {
    if (u.role === 'lancer') {
      if (sheet.clips.attack_r) return lancerAttackKey(u.facing);
      return 'attack';
    }
      if (u.role === 'warrior' || u.role === 'hero') {
        if (sheet.clips.attack2 && u._attackVariant === 2) return 'attack2';
        return 'attack';
      }
    return 'attack';
  }

  function getClip(sheet, key) {
    if (key && key.indexOf('walk_') === 0 && !sheet.clips[key]) {
      return sheet.clips.walk_south || sheet.clips.walk || sheet.clips.idle;
    }
    if (sheet.clips[key]) return sheet.clips[key];
    /* Never fall back to attack for idle / guard / walk — missing idle looked like stuck attack. */
    if (key === 'idle' || key === 'idle_hammer' || key === 'guard') {
      return sheet.clips.walk_south || sheet.clips.walk || sheet.clips.idle || null;
    }
    if (isAttackClipKey(key)) return sheet.clips[key] || sheet.clips.attack || null;
    return sheet.clips.idle || sheet.clips.walk_south || sheet.clips.walk || null;
  }

  function drawSpriteFrame(ctx, clip, sheet, fi, u, drawW, drawH, drawY, flip) {
    var fw = clip.frameW || sheet.frameW;
    var fh = sheet.frameH;
    var fc = clip.frameCrops && clip.frameCrops[fi] ? clip.frameCrops[fi] : null;
    var cropX = fc ? fc.x : (clip.cropX || 0);
    var cropY = fc ? fc.y : (clip.cropY || 0);
    var cropW = fc ? fc.w : (clip.cropW || fw);
    var cropH = fc ? fc.h : (clip.cropH || fh);
    var sx = fi * fw + cropX;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip < 0) {
      ctx.translate(u.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-u.x, 0);
    }
    var dx = Math.round(u.x - drawW / 2);
    var dy = Math.round(drawY);
    var dw = Math.round(drawW);
    var dh = Math.round(drawH);
    ctx.drawImage(clip.img, sx, cropY, cropW, cropH, dx, dy, dw, dh);
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
      function safeLoad(p, label) {
        return p.catch(function (err) {
          console.warn('sprite load failed (' + label + '):', err && err.message ? err.message : err);
          return null;
        });
      }
      var jobs = [];
      FACTIONS.forEach(function (fid) {
        ROLES.forEach(function (role) { jobs.push(safeLoad(loadRoleSheet(fid, role), fid + '/' + role)); });
      });
      // Rimwalker pawn still uses Pixel Crawler elf worker art
      jobs.push(safeLoad(loadRoleSheet('rimwalker', 'pawn'), 'rimwalker/pawn'));
      // Rimwalker combat units
      ['warrior', 'archer', 'lancer', 'monk'].forEach(function (role) {
        jobs.push(safeLoad(loadRoleSheet('rimwalker', role), 'rimwalker/' + role));
      });
      Object.keys(HERO_DEF).forEach(function (hid) { jobs.push(safeLoad(loadHeroSheet(hid), 'hero/' + hid)); });
      Promise.all(jobs).then(function () {
        self.ready = Object.keys(sheets).length > 0;
        if (cb) cb();
      }).catch(function (err) {
        console.error('EXOFRONT unit sprites failed', err);
        self.ready = false;
        if (cb) cb(err);
      });
    },

    sheetKey: function (u) {
      if (u.heroId) return 'hero_' + u.heroId;
      return u.faction + '_' + u.role;
    },

    attackActive: function (u) {
      return u.attackClip && u.attackAnimT != null &&
        u.attackAnimT < (u.attackAnimLen || 0);
    },

    startAttack: function (u, target) {
      var sheet = sheets[this.sheetKey(u)];
      if (!sheet) return;
      if (u.role === 'warrior' || u.role === 'hero') {
        u._attackVariant = (u._attackVariant === 1) ? 2 : 1;
      }
      var key = resolveAttackKey(u, sheet);
      var clip = getClip(sheet, key);
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
      var clip = getClip(sheet, u.attackClip);
      if (!clip) return -1;
      return Math.min(clip.count - 1, Math.floor(u.attackAnimT * clipFps(clip)));
    },

    atReleaseFrame: function (u) {
      var sheet = sheets[this.sheetKey(u)];
      if (!sheet || !this.attackActive(u)) return false;
      var clip = getClip(sheet, u.attackClip);
      if (!clip) return false;
      var rf = clip.releaseFrame != null ? clip.releaseFrame : clip.count - 1;
      return this.currentAttackFrame(u) >= rf;
    },

    atImpactFrame: function (u) {
      var sheet = sheets[this.sheetKey(u)];
      if (!sheet || !this.attackActive(u)) return false;
      var clip = getClip(sheet, u.attackClip);
      if (!clip) return false;
      var frame = clip.impactFrame != null ? clip.impactFrame : Math.floor(clip.count * 0.5);
      return this.currentAttackFrame(u) >= frame;
    },

    heroAttackVfx: function (heroId) {
      var def = HERO_DEF[heroId];
      var clip = def && def.clips && def.clips.attack;
      return clip && clip.vfx ? clip.vfx : null;
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
      if (u.role === 'hero' && u.inAttackRange && !walking) return 'guard';
      if (walking) {
        if (u.role === 'hero') {
          var sheet = sheets[this.sheetKey(u)];
          if (sheet && sheet.clips.walk_south) {
            return 'walk_' + heroWalkDir(u.facing);
          }
        }
        return 'walk';
      }
      return 'idle';
    },

    frameIndex: function (u, clip, animName, sheet) {
      if (isAttackClipKey(animName) && u.attackAnimT != null) {
        return Math.min(clip.count - 1, Math.floor(u.attackAnimT * clipFps(clip)));
      }
      if (animName === 'work' || animName === 'work_hammer') {
        return Math.floor((u._workPhase || 0) * clip.speed) % clip.count;
      }
      if (animName === 'idle' || animName === 'idle_hammer') {
        if (sheet && sheet.idleMissing && clip === sheet.clips.walk_south) return 0;
        var idleFps = clip.speed || clip.fps || 4;
        return Math.floor((u._idlePhase || 0) * idleFps) % clip.count;
      }
      if (animName === 'guard') {
        if (sheet && sheet.idleMissing && clip === sheet.clips.walk_south) return 0;
        var guardFps = clip.speed || clip.fps || 4;
        return Math.floor((u._idlePhase || 0) * guardFps) % clip.count;
      }
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
      var clip = sheet.clips.idle || sheet.clips.walk || sheet.clips.walk_south;
      var fw = clip ? (clip.frameW || sheet.frameW) : sheet.frameW;
      var fh = sheet.frameH;
      var cw = clip && clip.cropW ? clip.cropW : fw;
      var ch = clip && clip.cropH ? clip.cropH : fh;
      var drawW = (cw / ch) * drawH;
      var footLine = clip && clip.cropH
        ? (clip.cropY + clip.cropH) / fh
        : (RTS.SizeRef && RTS.SizeRef.unitFootRatio
          ? RTS.SizeRef.unitFootRatio(u.role, fh)
          : (fh >= 300 ? 0.91 : 0.94));
      var drawY = footY - drawH * footLine;
      var soleY = footY;
      var insetX = 0.18;
      var insetTop = 0.08;
      var insetBot = 0.05;
      return {
        x: u.x, footY: footY, soleY: soleY, footRatio: footLine,
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

    drawGlaiveEffect: function (ctx, rider, s) {
      if (!this.attackActive(rider)) return;
      var sheet = sheets[this.sheetKey(rider)];
      if (!sheet || !sheet.clips.glaive_effect) return;
      var clip = sheet.clips.glaive_effect;
      var fi = this.currentAttackFrame(rider);
      if (fi < 0) return;
      var r = unitDrawRadius(rider);
      var footY = this.unitFootY(rider, s);
      var drawH = unitDrawHeight(r, rider, sheet);
      var fw = clip.frameW || sheet.frameW;
      var drawW = (fw / sheet.frameH) * drawH;
      var footRatio = RTS.SizeRef && RTS.SizeRef.unitFootRatio
        ? RTS.SizeRef.unitFootRatio(rider.role, sheet.frameH)
        : 0.94;
      var drawY = footY - drawH * footRatio;
      var sx = fi * fw;
      var flip = Math.cos(rider.facing) < -0.12 ? -1 : 1;
      ctx.save();
      ctx.globalAlpha = 0.92;
      if (flip < 0) {
        ctx.translate(rider.x, 0);
        ctx.scale(-1, 1);
        ctx.translate(-rider.x, 0);
      }
      ctx.drawImage(clip.img, sx, 0, fw, sheet.frameH,
        rider.x - drawW / 2, drawY, drawW, drawH);
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
        var corpseClip = sheet.clips.idle || sheet.clips.walk || sheet.clips.walk_south;
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
        var walkRate = u.role === 'hero' ? 0.036 : 0.022;
        u._walkPhase = (u._walkPhase || 0) + dist * walkRate;
        u._moveHold = 4;
        u._idlePhase = u._idlePhase || 0; // don't reset idle phase
      } else if (u._moveHold > 0) {
        u._moveHold--;
      }
      // When paused (onboarding overlay), sim dt is frozen — tick idle here so
      // standing units still breathe. During play, updateUnit advances _idlePhase.
      if (s && s.scene !== 'playing') {
        u._idlePhase = ((u._idlePhase || 0) + (1 / 60));
      }
      u._ax = u.x;
      u._ay = u.y;

      if (!u.buildTask) u._builderOnSite = false;

      var mining = u.role === 'pawn' && u.harvest && u.harvest.phase === 'mining';
      var onBuildSite = u.role === 'pawn' && u.buildTask && u._builderOnSite;
      var walking = !mining && !onBuildSite && !this.attackActive(u) && u._moveHold > 0;

      var animName = this.pickAnim(u, walking);
      var clip = getClip(sheet, animName);
      if (!clip || !clip.img) return;

      // Idle/guard/walk cycles stay alive under reduced-motion; rm only trims bob FX elsewhere.
      var freezeFrame = rm && isAttackClipKey(animName);
      var fi = freezeFrame ? 0 : this.frameIndex(u, clip, animName, sheet);
      var flip = animName.indexOf('walk_') === 0 ? 1 : (Math.cos(u.facing) < -0.12 ? -1 : 1);
      var vb = this.unitVisualBounds(u, s);
      if (!vb) return;

      // Attack frames fill the full sprite height (no top headroom), while idle/walk frames
      // have ~30/256 transparent padding at the top. Shift attack down to keep visual height
      // consistent so the character doesn't appear to jump taller during attacks.
      var drawY = vb.drawY;
      if (u.role === 'hero' && isAttackClipKey(animName) && sheet.attackTopShift) {
        drawY += sheet.attackTopShift * vb.drawH;
      }

      drawSpriteFrame(ctx, clip, sheet, fi, u, vb.drawW, vb.drawH, drawY, flip);

      if (u.role === 'monk' && this.attackActive(u) && u.attackTargetId) {
        var ally = RTS.getById(s, u.attackTargetId);
        this.drawHealEffect(ctx, u, ally, s);
      }

      if (u.role === 'lancer' && this.attackActive(u)) {
        this.drawGlaiveEffect(ctx, u, s);
      }

      Art.drawUnitOverlays(ctx, u, f, s, r, Art.minionPalette(f, u.team), vb, true);
    },
  };

})(window.RTS = window.RTS || {});
