/* ============================================================================
 * Verath — nightmode.js
 * Optional day/night survival cycle (RTS.Night).
 *
 * When RTS.Config.nightMode is on, RTS.Night.update() (called each sim tick from
 * RTS.update) advances a day → night → day cycle. At nightfall the field darkens
 * and escalating waves of RISEN DEAD crawl in from the dark and march on the
 * player's core. The risen are TEAM.NEUTRAL, so they aggro — and are aggroed by
 * — BOTH factions (mirroring The Scouring's "both sides defend at night"), but
 * they home on the player core so surviving the night is the player's problem.
 *
 * Everything is data-driven from RTS.Config.night. Toggling nightMode off (or
 * losing/winning) clears the darkness and stops spawns on the next tick.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TEAM = RTS.TEAM;

  // --- DOM visuals (renderer-agnostic: works over 2D, Phaser, or 3D) --------
  var overlayEl = null, indicatorEl = null;

  function ensureDom() {
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = 'night-overlay';
      // z-index 8: above the world canvases (#game ~0, #game3d 5) but below the
      // HUD (#hud 20) so the field darkens while the controls stay bright.
      overlayEl.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:8;opacity:0;' +
        'background:radial-gradient(120% 120% at 50% 38%, rgba(20,28,58,0.55) 0%, rgba(8,10,26,0.92) 100%);' +
        'transition:opacity 0.4s linear;';
      document.body.appendChild(overlayEl);
    }
    if (!indicatorEl) {
      indicatorEl = document.createElement('div');
      indicatorEl.id = 'night-indicator';
      indicatorEl.style.cssText =
        'position:fixed;top:calc(env(safe-area-inset-top,0px) + 46px);left:50%;transform:translateX(-50%);' +
        'z-index:19;pointer-events:none;font-family:Fredoka,sans-serif;font-weight:600;font-size:13px;' +
        'padding:3px 12px;border-radius:999px;letter-spacing:0.03em;white-space:nowrap;' +
        'background:rgba(12,16,34,0.62);color:#dfe7ff;border:1px solid rgba(150,170,255,0.28);' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.35);display:none;';
      document.body.appendChild(indicatorEl);
    }
  }

  function fmt(t) {
    t = Math.max(0, Math.ceil(t));
    var m = Math.floor(t / 60), sec = t % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function applyVisuals(s, n) {
    ensureDom();
    var cfg = RTS.Config.night;
    var r3dOn = RTS.Config.render3d && RTS.Render3D &&
      RTS.Render3D.isEnabled && RTS.Render3D.isEnabled();
    // The 3D scene darkens its own lighting via setNight, so the DOM overlay
    // only needs to add a light wash on top of it; in 2D it carries the whole look.
    var peak = r3dOn ? cfg.peakDark * 0.45 : cfg.peakDark;
    overlayEl.style.opacity = (n.factor * peak).toFixed(3);
    if (r3dOn && RTS.Render3D.setNight) RTS.Render3D.setNight(n.factor > 0.45);

    if (n.phase === 'night') {
      indicatorEl.style.display = 'block';
      indicatorEl.style.color = '#ffd0d0';
      indicatorEl.style.borderColor = 'rgba(255,120,120,0.4)';
      indicatorEl.textContent = '🌙 Night ' + n.number + ' — survive ' +
        fmt(cfg.nightLen - n.t);
    } else if (n.factor > 0.02) {
      // dusk shoulder — still show a hint
      indicatorEl.style.display = 'block';
      indicatorEl.style.color = '#dfe7ff';
      indicatorEl.style.borderColor = 'rgba(150,170,255,0.28)';
      indicatorEl.textContent = '🌆 Nightfall approaches…';
    } else {
      indicatorEl.style.display = 'block';
      indicatorEl.style.color = '#dfe7ff';
      indicatorEl.style.borderColor = 'rgba(150,170,255,0.28)';
      var dayTarget = (n.number === 0) ? cfg.firstNightAt : cfg.dayLen;
      indicatorEl.textContent = '☀ Day ' + (n.number + 1) + ' — nightfall in ' +
        fmt(dayTarget - n.t);
    }
  }

  function hideVisuals() {
    if (overlayEl) overlayEl.style.opacity = '0';
    if (indicatorEl) indicatorEl.style.display = 'none';
    if (RTS.Config.render3d && RTS.Render3D && RTS.Render3D.setNight &&
        RTS.Render3D.isEnabled && RTS.Render3D.isEnabled()) {
      RTS.Render3D.setNight(false);
    }
  }

  // --- Darkness factor from the current phase + transition ramps ------------
  function calcFactor(n, cfg) {
    if (n.phase === 'night') {
      var left = cfg.nightLen - n.t;
      if (left < cfg.dawnLen) return Math.max(0, left / cfg.dawnLen);   // dawn fade-out
      return 1;
    }
    var dayTarget = (n.number === 0) ? cfg.firstNightAt : cfg.dayLen;
    var dleft = dayTarget - n.t;
    if (dleft < cfg.duskLen) return Math.min(1, 1 - dleft / cfg.duskLen); // dusk build-up
    return 0;
  }

  // --- Spawning the risen ---------------------------------------------------
  function waveCount(cfg, number) {
    return cfg.baseCount + cfg.countPerNight * Math.max(0, number - 1);
  }

  function landPoint(s, cx, cy, radius) {
    var W = (RTS.Config.world && RTS.Config.world.w) || 3072;
    var H = (RTS.Config.world && RTS.Config.world.h) || 1920;
    var grid = s.map && s.map.terrainGrid;
    var wet = RTS.Terrain && RTS.Terrain.isWater;
    for (var a = 0; a < 8; a++) {
      var ang = Math.random() * Math.PI * 2;
      var r = radius * (0.85 + Math.random() * 0.3);
      var x = Math.max(48, Math.min(W - 48, cx + Math.cos(ang) * r));
      var y = Math.max(48, Math.min(H - 48, cy + Math.sin(ang) * r));
      if (!wet || !wet(grid, x, y)) return { x: x, y: y };
    }
    // fallback: pull toward core (always reachable land near the base)
    return { x: cx + (Math.random() - 0.5) * 120, y: cy - radius * 0.4 };
  }

  function spawnRisen(s, role, core, cfg) {
    if (!RTS.makeUnit) return null;
    var p = landPoint(s, core.x, core.y, cfg.spawnRadius);
    var u = RTS.makeUnit(s, role, TEAM.NEUTRAL, p.x, p.y, cfg.faction);
    if (!u) return null;
    u.isRisen = true;
    u.maxHp = Math.round(u.maxHp * cfg.hpMul);
    u.hp = u.maxHp;
    // relentless marchers: don't leash, keep hunting the core
    u.chaseRange = 99999;
    u.acquireRange = (u.range || 40) * 4;
    if (RTS.applyUnitCommand) {
      RTS.applyUnitCommand(u, 'attackMove', {
        pos: { x: core.x, y: core.y },
        guardOrigin: { x: p.x, y: p.y },
      });
    } else {
      u.commandMode = 'attackMove';
      u.attackMove = true;
      u.moveTo = { x: core.x, y: core.y };
    }
    if (RTS.addEffect) {
      RTS.addEffect(s, { kind: 'nova', x: p.x, y: p.y, r: 4, maxR: 40,
        life: 0.5, max: 0.5, color: '#7d5cff' });
    }
    return u;
  }

  function spawnBatch(s, count, cfg) {
    var core = RTS.playerCore && RTS.playerCore(s);
    if (!core) return;
    for (var i = 0; i < count; i++) {
      var role = (Math.random() < cfg.archerFrac) ? 'archer' : 'warrior';
      spawnRisen(s, role, core, cfg);
    }
  }

  // --- Phase transitions ----------------------------------------------------
  function beginNight(s, n, cfg) {
    n.phase = 'night';
    n.t = 0;
    n.number += 1;
    n.waveCount = waveCount(cfg, n.number);
    n.spawnCd = cfg.spawnInterval;
    spawnBatch(s, n.waveCount, cfg);
    if (RTS.log) RTS.log(s, 'Night ' + n.number + ' falls — the risen march on your ' +
      (RTS.nameFor ? RTS.nameFor(s.playerFaction, 'core') : 'keep'), 'bad');
    if (RTS.toast) RTS.toast(s, '🌙 Night ' + n.number + ' — hold until dawn!');
    s.ui.baseAlarm = Math.max(s.ui.baseAlarm || 0, 2.2);
    if (RTS.Audio && RTS.Audio.play) RTS.Audio.play('attack');
  }

  function beginDay(s, n) {
    n.phase = 'day';
    n.t = 0;
    crumbleRisen(s);   // the light undoes them — no leftover undead harassing by day
    if (RTS.log) RTS.log(s, 'Dawn breaks — you survived night ' + n.number, 'good');
    if (RTS.toast) RTS.toast(s, '☀ Dawn — night ' + n.number + ' survived');
  }

  // At dawn any surviving risen crumble to dust (a poof, not a combat death, so
  // it doesn't feed kill stats or aggro). The sim's own corpse cull removes them.
  function crumbleRisen(s) {
    var us = s.entities && s.entities.units;
    if (!us) return;
    for (var i = 0; i < us.length; i++) {
      var u = us[i];
      if (u.dead || !u.isRisen) continue;
      u.dead = true; u.hp = 0; u.corpse = 0.5;
      if (RTS.addEffect) {
        RTS.addEffect(s, { kind: 'nova', x: u.x, y: u.y, r: 5, maxR: 38,
          life: 0.5, max: 0.5, color: '#8a7bd8' });
      }
    }
  }

  // --- Public API -----------------------------------------------------------
  RTS.Night = {
    // Called every sim tick from RTS.update.
    update: function (s, dt) {
      if (!s) return;
      var cfg = RTS.Config.night;
      var n = s.night || (s.night = { phase: 'day', t: 0, factor: 0, number: 0, spawnCd: 0, waveCount: 0 });

      if (!RTS.Config.nightMode) {
        if (n.factor !== 0 || n.phase !== 'day') this.reset(s);
        return;
      }

      n.t += dt;

      if (n.phase === 'day') {
        var dayTarget = (n.number === 0) ? cfg.firstNightAt : cfg.dayLen;
        if (n.t >= dayTarget) beginNight(s, n, cfg);
      } else {
        if (n.t >= cfg.nightLen) {
          beginDay(s, n);
        } else {
          n.spawnCd -= dt;
          if (n.spawnCd <= 0) {
            // reinforcements keep pressure up through the night (skip during the
            // dawn shoulder so the last seconds are a breather to mop up).
            if (cfg.nightLen - n.t > cfg.dawnLen) {
              spawnBatch(s, Math.max(1, Math.ceil(n.waveCount * cfg.reinforceFrac)), cfg);
            }
            n.spawnCd = cfg.spawnInterval;
          }
        }
      }

      n.factor = calcFactor(n, cfg);
      applyVisuals(s, n);
    },

    // Clear darkness + reset the cycle (toggle off, or new match).
    reset: function (s) {
      if (s && s.night) {
        s.night.phase = 'day';
        s.night.t = 0;
        s.night.factor = 0;
        s.night.number = 0;
        s.night.spawnCd = 0;
        s.night.waveCount = 0;
      }
      hideVisuals();
    },

    isNight: function (s) {
      return !!(RTS.Config.nightMode && s && s.night && s.night.phase === 'night');
    },
  };

})(window.RTS = window.RTS || {});
