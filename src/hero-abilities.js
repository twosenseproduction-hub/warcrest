/* ============================================================================
 * Warcrest — hero-abilities.js
 * Active hero abilities (the inert hero.abilities[] from heroes.js, made real).
 * Triggered from the HUD I-row via RTS.triggerHeroAbility(s, uid, index).
 * Channelled casts (e.g. The Ashfall) tick via RTS.tickHeroChannel from
 * systems.updateUnit. Currently implements Aelindra's kit.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  function now(s) { return (s.timers && s.timers.gameTime) || 0; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function rand() { return Math.random(); }

  function float(s, x, y, text, color) {
    RTS.addEffect(s, { kind: 'float', x: x, y: y - 20, life: 0.9, max: 0.9, text: text, color: color });
  }
  function nova(s, x, y, maxR, color, life) {
    RTS.addEffect(s, { kind: 'nova', x: x, y: y, r: 8, maxR: maxR, life: life || 0.6, max: life || 0.6, color: color });
  }
  // richer 3D-rendered VFX primitives (see render3d syncEffects)
  function beam(s, x, y, x2, y2, color, w, life) {
    RTS.addEffect(s, { kind: 'beam', x: x, y: y, x2: x2, y2: y2, color: color, w: w || 12, hy: 16, life: life || 0.4, max: life || 0.4 });
  }
  function pillar(s, x, y, color, r, hgt, life) {
    RTS.addEffect(s, { kind: 'pillar', x: x, y: y, color: color, r: r || 22, hgt: hgt || 72, life: life || 0.75, max: life || 0.75 });
  }
  function burst(s, x, y, color, maxR, life) {
    RTS.addEffect(s, { kind: 'burst', x: x, y: y, color: color, maxR: maxR || 44, hy: 18, life: life || 0.42, max: life || 0.42 });
  }
  function scatter(s, sheet, cx, cy, radius, count, scale, life) {
    for (var i = 0; i < count; i++) {
      var ang = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * radius * 0.92;
      RTS.SkillVFX && RTS.SkillVFX.spawn(s, sheet, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.85,
        { scale: scale || 2.4, life: life });
    }
  }

  // Pick an enemy to target a single-target hero spell at: prefer the hero's
  // current attack target if it's a valid foe in range, else the nearest foe.
  function enemyTarget(s, u, range) {
    var cur = u.target ? RTS.getById(s, u.target) : null;
    if (cur && !cur.dead && cur.kind === 'unit' && cur.team !== u.team &&
        dist(cur.x, cur.y, u.x, u.y) <= range * 1.25) return cur;
    var best = null, bestD = range;
    (s.entities.units || []).forEach(function (e) {
      if (e.dead || e.team === u.team || e.team === RTS.TEAM.NEUTRAL || e.kind !== 'unit') return;
      var d = dist(e.x, e.y, u.x, u.y);
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
  }
  // Nearest friendly fighter (skips workers) that lacks the named buff.
  function allyTarget(s, u, range, buffId) {
    var best = null, bestD = range;
    (s.entities.units || []).forEach(function (a) {
      if (a.dead || a.team !== u.team || a === u || a.kind !== 'unit') return;
      if (a.role === 'pawn' || a.heal > 0) return;
      if (buffId && a.buffs && a.buffs.some(function (b) { return b.id === buffId; })) return;
      var d = dist(a.x, a.y, u.x, u.y);
      if (d < bestD) { bestD = d; best = a; }
    });
    return best;
  }
  function isWaterAt(s, x, y) {
    var grid = s.map && s.map.terrainGrid;
    return grid && RTS.Terrain ? RTS.Terrain.isWater(grid, x, y) : false;
  }
  function knockbackImmune(u) {
    if (!u || u.kind !== 'unit') return true;
    var h = u.heroId && RTS.getHero ? RTS.getHero(u.heroId) : null;
    return !!(h && h.passive && h.passive.knockbackImmune);
  }

  // ── ability implementations (keyed by ability id) ────────────────────────
  var ABIL = {
    // Heal allies + damage enemies in a radius, centred on the hero. Instant.
    verdant_pulse: function (s, u, ab) {
      var R = ab.radius || 300, heal = ab.healAmt || 45, dmg = ab.dmgAmt || 45;
      nova(s, u.x, u.y, R, '#8dff7a', 0.7);
      pillar(s, u.x, u.y, '#8dff7a', 24, 72, 0.7);
      scatter(s, 'sprout_heal', u.x, u.y, R, 7, 2.6);
      (s.entities.units || []).forEach(function (t) {
        if (t.dead || dist(t.x, t.y, u.x, u.y) > R) return;
        if (t.team === u.team) {
          if (t.hp < t.maxHp) {
            t.hp = Math.min(t.maxHp, t.hp + heal);
            RTS.SkillVFX && RTS.SkillVFX.spawn(s, 'sprout_heal', t.x, t.y - (t.radius || 12), { scale: 2.4 });
            float(s, t.x, t.y - (t.radius || 12), '+' + heal, '#8dff7a');
          }
        } else if (RTS.applyDamage) {
          RTS.applyDamage(s, t, dmg, u);
          float(s, t.x, t.y - (t.radius || 12), '-' + dmg, '#ff8a6a');
        }
      });
      return true;
    },

    // Channelled catastrophe: rains leaves for castTime, then AoE damage+silence.
    the_ashfall: function (s, u, ab) {
      u._channel = {
        abId: ab.id, x: u.x, y: u.y, radius: ab.radius || 240,
        dmg: ab.dmg || 300, silence: ab.silenceDuration || 5,
        endsAt: now(s) + (ab.castTime || 3), nextLeaf: 0,
      };
      RTS.toast && RTS.toast(s, 'Aelindra channels The Ashfall…');
      return true;
    },

    // A line of thorned roots that roots enemies trying to cross, for duration.
    thornwall: function (s, u, ab) {
      var len = ab.wallLength || 240, dur = ab.duration || 8;
      var ang = u.facing == null ? Math.PI / 2 : u.facing;
      var cx = u.x + Math.cos(ang) * 90, cy = u.y + Math.sin(ang) * 90;
      var px = -Math.sin(ang), py = Math.cos(ang);   // perpendicular to facing
      var segs = 7;
      for (var i = 0; i < segs; i++) {
        var t = (i / (segs - 1)) - 0.5;
        var ex = cx + px * t * len, ey = cy + py * t * len;
        RTS.SkillVFX && RTS.SkillVFX.spawn(s, 'spike_vine', ex, ey, { scale: 3.0, life: dur, hold: true });
      }
      s._thornwalls = s._thornwalls || [];
      s._thornwalls.push({ x: cx, y: cy, px: px, py: py, len: len, r: 26, endsAt: now(s) + dur, team: u.team });
      return true;
    },

    // ── Valdris the Ironwarden (aurex) ──────────────────────────────────────
    // Advance — Valdris charges forward, ploughing through everyone in his lane:
    // damage + knock enemies aside, then he ends the dash at the lane's end.
    advance: function (s, u, ab) {
      var px = ab.chargePx || 180, dmg = ab.dmg || 90, kb = ab.knockback || 80;
      var ang = u.facing == null ? 0 : u.facing;
      var tgt = u.target ? RTS.getById(s, u.target) : null;
      if (tgt && !tgt.dead) ang = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var sx = u.x, sy = u.y, ex = sx + dx * px, ey = sy + dy * px;
      // don't end the charge in deep water — shorten until the landing is dry
      for (var k = 1.0; k > 0.3; k -= 0.15) {
        if (!isWaterAt(s, sx + dx * px * k, sy + dy * px * k)) { ex = sx + dx * px * k; ey = sy + dy * px * k; break; }
      }
      var nx = -dy, ny = dx;   // lane normal
      (s.entities.units || []).forEach(function (e) {
        if (e.dead || e.team === u.team || e === u || e.kind !== 'unit') return;
        var rx = e.x - sx, ry = e.y - sy;
        var along = rx * dx + ry * dy;
        if (along < -20 || along > px + 30) return;
        var off = rx * nx + ry * ny;
        if (Math.abs(off) > 56) return;
        RTS.applyDamage && RTS.applyDamage(s, e, dmg, u);
        float(s, e.x, e.y - (e.radius || 12), '-' + dmg, '#ff8a6a');
        if (!e.dead && !knockbackImmune(e)) {
          var side = off >= 0 ? 1 : -1;
          var kx = e.x + nx * side * kb, ky = e.y + ny * side * kb;
          if (!isWaterAt(s, kx, ky)) { e.x = kx; e.y = ky; e._evx = 0; e._evy = 0; }
        }
      });
      beam(s, sx, sy, ex, ey, '#cfe0ff', 20, 0.45);   // charge streak
      u.x = ex; u.y = ey; u.facing = ang; u._evx = 0; u._evy = 0; u.moveTo = null; u.vx = 0; u.vy = 0;
      nova(s, sx, sy, 50, '#cfe0ff', 0.4);
      nova(s, ex, ey, 70, '#cfe0ff', 0.5);
      burst(s, ex, ey, '#dfe9ff', 34, 0.4);
      s.screenShake = Math.max(s.screenShake || 0, 5);
      return true;
    },

    // Iron Edict — plant the banner: every ally in radius is warded to survive
    // one lethal hit at 1hp for the duration (consumed on the hit that saves it).
    iron_edict: function (s, u, ab) {
      var R = ab.radius || 240, dur = ab.duration || 10, n = 0;
      nova(s, u.x, u.y, R, '#ffd98a', 0.8);
      pillar(s, u.x, u.y, '#ffd98a', 26, 84, 0.85);   // banner of light
      (s.entities.units || []).forEach(function (a) {
        if (a.dead || a.team !== u.team || dist(a.x, a.y, u.x, u.y) > R) return;
        if (RTS.applyBuff) RTS.applyBuff(s, a, { id: 'iron_edict_ward', wardLethal: true, duration: dur, color: '#ffd98a' });
        RTS.SkillVFX && RTS.SkillVFX.spawn(s, 'levelup_aura', a.x, a.y - (a.radius || 12), { scale: 2.0, life: 0.7 });
        n++;
      });
      RTS.toast && RTS.toast(s, 'Iron Edict — ' + n + ' protected');
      return true;
    },

    // The Last Wall — channel: immovable + invulnerable, burning nearby foes,
    // ending in a shockwave. Implemented as a channel branched in tickHeroChannel.
    the_last_wall: function (s, u, ab) {
      u._invuln = true;
      u._channel = {
        abId: ab.id, x: u.x, y: u.y,
        duration: ab.duration || 4, endsAt: now(s) + (ab.duration || 4),
        auraDps: ab.auraDmgPerSec || 25, auraR: ab.auraRadius || 80,
        shockDmg: ab.shockwaveDmg || 200, shockR: ab.shockwaveRadius || 120,
        nextTick: 0, nextRing: 0,
      };
      nova(s, u.x, u.y, ab.auraRadius || 80, '#cfe0ff', 0.6);
      RTS.toast && RTS.toast(s, 'Valdris holds The Last Wall');
      return true;
    },

    // ── Grollusk the Hex Shaman (cinder) ────────────────────────────────────
    // Hex — curse a foe: slowed and weakened for the duration.
    hex: function (s, u, ab) {
      var t = enemyTarget(s, u, 360);
      if (!t) { RTS.toast && RTS.toast(s, 'Hex — no target'); return false; }
      if (RTS.applyBuff) RTS.applyBuff(s, t, {
        id: 'grollusk_hex', moveMul: -(ab.slowPct || 0.40), dmgMul: -(ab.dmgReductionPct || 0.25),
        duration: ab.duration || 5, color: '#b05ad0',
      });
      nova(s, t.x, t.y, 44, '#b05ad0', 0.6);
      burst(s, t.x, t.y, '#b05ad0', 40, 0.42);
      scatter(s, 'leaf_fall', t.x, t.y, 30, 3, 2.0, 0.8);
      float(s, t.x, t.y - (t.radius || 12), 'hexed', '#d68fff');
      return true;
    },

    // Death Coil — bolt of spirit-fire: damages a foe and heals Grollusk.
    death_coil: function (s, u, ab) {
      var t = enemyTarget(s, u, 360);
      if (!t) { RTS.toast && RTS.toast(s, 'Death Coil — no target'); return false; }
      var dmg = ab.dmg || 120, heal = ab.selfHeal || 60;
      beam(s, u.x, u.y, t.x, t.y, '#4cff6b', 10, 0.4);   // spirit-fire bolt
      RTS.applyDamage && RTS.applyDamage(s, t, dmg, u);
      float(s, t.x, t.y - (t.radius || 12), '-' + dmg, '#6cff8a');
      nova(s, t.x, t.y, 50, '#4cff6b', 0.6);
      burst(s, t.x, t.y, '#4cff6b', 36, 0.4);
      if (u.hp < u.maxHp) { u.hp = Math.min(u.maxHp, u.hp + heal); float(s, u.x, u.y - (u.radius || 14), '+' + heal, '#6cff8a'); }
      RTS.SkillVFX && RTS.SkillVFX.spawn(s, 'sprout_heal', u.x, u.y - (u.radius || 14), { scale: 2.4 });
      return true;
    },

    // Ancestor's Fury — summon a pack of spirit warriors that fight for the
    // Horde for a while, then fade. They cost no supply and leave no corpse.
    ancestors_fury: function (s, u, ab) {
      var count = ab.spiritCount || 3, dur = ab.duration || 12;
      var cx = u.x, cy = u.y;
      var tgt = u.target ? RTS.getById(s, u.target) : null;
      if (tgt && !tgt.dead) { cx = (u.x + tgt.x) / 2; cy = (u.y + tgt.y) / 2; }
      var made = 0;
      for (var i = 0; i < count; i++) {
        var ang = (i / count) * Math.PI * 2, rr = 28;
        var sx = cx + Math.cos(ang) * rr, sy = cy + Math.sin(ang) * rr;
        if (isWaterAt(s, sx, sy)) { sx = u.x; sy = u.y; }
        var sp = RTS.makeUnit && RTS.makeUnit(s, 'warrior', u.team, sx, sy, 'cinder');
        if (!sp) continue;
        sp.isSummon = true; sp._expireAt = now(s) + dur;
        sp.maxHp = ab.spiritHp || 80; sp.hp = sp.maxHp;
        sp.dmg = ab.spiritDmg || 18; sp.speed = ab.spiritSpeed || 120;
        sp.ranged = false; sp.spawnFlash = 0.5; sp.tintGhost = '#6cff8a';
        sp.attackMove = true; sp.commandMode = 'attackMove';
        if (tgt && !tgt.dead) { sp.moveTo = { x: tgt.x, y: tgt.y }; }
        RTS.SkillVFX && RTS.SkillVFX.spawn(s, 'levelup_aura', sx, sy - 12, { scale: 2.4, life: 0.8 });
        pillar(s, sx, sy, '#6cff8a', 15, 56, 0.7);   // a spirit rises
        made++;
      }
      if (!made) return false;
      nova(s, cx, cy, 80, '#6cff8a', 0.7);
      if (RTS.recalcSupply) { RTS.recalcSupply(s, u.team); }
      RTS.toast && RTS.toast(s, "Ancestor's Fury — " + made + ' spirits rise');
      return true;
    },

    // ── Seraphine the Channeler (aurex) ─────────────────────────────────────
    // Attunement — bless an ally with attack-speed and move-speed for a while.
    attunement: function (s, u, ab) {
      var t = allyTarget(s, u, 280, 'attunement');
      if (!t) { RTS.toast && RTS.toast(s, 'Attunement — no ally'); return false; }
      RTS.applyBuff && RTS.applyBuff(s, t, {
        id: 'attunement', rofMul: ab.atkSpeedBonus || 0.40, moveMul: ab.moveSpeedBonus || 0.25,
        duration: ab.duration || 7, color: '#cfe6ff',
      });
      nova(s, t.x, t.y, 40, '#cfe6ff', 0.6);
      pillar(s, t.x, t.y, '#cfe6ff', 18, 62, 0.7);
      RTS.SkillVFX && RTS.SkillVFX.spawn(s, 'levelup_aura', t.x, t.y - (t.radius || 12), { scale: 2.2, life: 0.8 });
      float(s, t.x, t.y - (t.radius || 12), 'attuned', '#cfe6ff');
      return true;
    },

    // Shatter — burst of broken resonance: enemies in radius silenced + damaged.
    shatter: function (s, u, ab) {
      var R = ab.radius || 180, dmg = ab.dmg || 80, sil = ab.silenceDuration || 3.5;
      nova(s, u.x, u.y, R, '#bcdcff', 0.7);
      burst(s, u.x, u.y, '#bcdcff', R * 0.7, 0.5);
      scatter(s, 'leaf_fall', u.x, u.y, R, 6, 2.2, 0.8);
      (s.entities.units || []).forEach(function (e) {
        if (e.dead || e.team === u.team || e.kind !== 'unit' || dist(e.x, e.y, u.x, u.y) > R) return;
        RTS.applyDamage && RTS.applyDamage(s, e, dmg, u);
        RTS.applyBuff && RTS.applyBuff(s, e, { id: 'shatter_silence', disabled: true, duration: sil, color: '#bcdcff' });
        float(s, e.x, e.y - (e.radius || 12), '-' + dmg, '#ff8a6a');
      });
      return true;
    },

    // Verdant Surge — map-wide blessing: every ally gains damage + regen.
    verdant_surge: function (s, u, ab) {
      var n = 0;
      nova(s, u.x, u.y, 240, '#9bff8a', 0.9);
      pillar(s, u.x, u.y, '#9bff8a', 28, 90, 0.95);
      (s.entities.units || []).forEach(function (a) {
        if (a.dead || a.team !== u.team || a.kind !== 'unit') return;
        RTS.applyBuff && RTS.applyBuff(s, a, {
          id: 'verdant_surge', dmgMul: ab.dmgBonus || 0.20, healPerSec: ab.regenPerSec || 4,
          duration: ab.duration || 8, color: '#9bff8a',
        });
        n++;
      });
      RTS.toast && RTS.toast(s, 'Verdant Surge — ' + n + ' allies empowered');
      return true;
    },

    // ── Skrix the Saboteur (cinder) ─────────────────────────────────────────
    // Scatter Charge — a fan of timed bombs in front of Skrix that detonate
    // after a short fuse, forcing the enemy line to break apart.
    scatter_charge: function (s, u, ab) {
      var count = ab.bombCount || 4, dmg = ab.dmgPerBomb || 55, fuse = ab.fuseDelay || 0.8;
      var spread = (ab.spreadAngle || 60) * Math.PI / 180;
      var ang = u.facing == null ? 0 : u.facing;
      var tgt = u.target ? RTS.getById(s, u.target) : null;
      if (tgt && !tgt.dead) ang = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      s._timedBlasts = s._timedBlasts || [];
      for (var i = 0; i < count; i++) {
        var f = count > 1 ? (i / (count - 1)) - 0.5 : 0;
        var a = ang + f * spread, rr = 90 + (i % 2) * 50;
        var bx = u.x + Math.cos(a) * rr, by = u.y + Math.sin(a) * rr;
        s._timedBlasts.push({ x: bx, y: by, at: now(s) + fuse, dmg: dmg, radius: 48, team: u.team });
        nova(s, bx, by, 14, '#ffb24d', fuse);
      }
      RTS.Audio && RTS.Audio.play && RTS.Audio.play('shot');
      return true;
    },

    // Unravel — turn a non-hero enemy to the Horde's side for a few seconds.
    unravel: function (s, u, ab) {
      var t = enemyTarget(s, u, 320);
      if (!t) { RTS.toast && RTS.toast(s, 'Unravel — no target'); return false; }
      if (t.isHero) { RTS.toast && RTS.toast(s, 'Unravel — heroes resist'); return false; }
      t._origTeam = t.team; t.team = u.team;
      t._charmUntil = now(s) + (ab.duration || 4);
      t.target = null; t.moveTo = null; t.commandMode = 'attackMove'; t.attackMove = true;
      nova(s, t.x, t.y, 46, '#ff7a2a', 0.7);
      pillar(s, t.x, t.y, '#ff9a3c', 18, 62, 0.7);
      RTS.SkillVFX && RTS.SkillVFX.spawn(s, 'levelup_aura', t.x, t.y - (t.radius || 12), { scale: 2.4, life: 0.8 });
      float(s, t.x, t.y - (t.radius || 12), 'turned', '#ffae6a');
      return true;
    },

    // Bedlam — sow confusion: enemies in radius are scattered and cannot fight.
    bedlam: function (s, u, ab) {
      var R = ab.radius || 280, dur = ab.duration || 6, n = 0;
      nova(s, u.x, u.y, R, '#ff5a3c', 0.8);
      burst(s, u.x, u.y, '#ff5a3c', R * 0.6, 0.55);
      (s.entities.units || []).forEach(function (e) {
        if (e.dead || e.team === u.team || e.kind !== 'unit' || dist(e.x, e.y, u.x, u.y) > R) return;
        RTS.applyBuff && RTS.applyBuff(s, e, { id: 'bedlam', disabled: true, moveMul: -0.6, duration: dur, color: '#ff5a3c' });
        e.target = null;
        var a = rand() * Math.PI * 2, rr = 50 + rand() * 70;
        var sx = e.x + Math.cos(a) * rr, sy = e.y + Math.sin(a) * rr;
        if (!isWaterAt(s, sx, sy)) { e.moveTo = { x: sx, y: sy }; e.commandMode = 'move'; e.attackMove = false; }
        nova(s, e.x, e.y, 16, '#ff5a3c', 0.4);
        n++;
      });
      RTS.toast && RTS.toast(s, 'Bedlam — ' + n + ' enemies reel');
      return true;
    },

    // ── Thoryn the Bladedrifter (rimwalker) ─────────────────────────────────
    // Thorn Cut — three rapid slashes; the last opens a bleeding wound (DoT).
    thorn_cut: function (s, u, ab) {
      var t = enemyTarget(s, u, 200);
      if (!t) { RTS.toast && RTS.toast(s, 'Thorn Cut — no target'); return false; }
      var per = ab.dmgPerStrike || 38, strikes = ab.strikes || 3, total = per * strikes;
      beam(s, u.x, u.y, t.x, t.y, '#d6f5a8', 9, 0.32);   // slash arc
      RTS.applyDamage && RTS.applyDamage(s, t, total, u);
      float(s, t.x, t.y - (t.radius || 12), '-' + total, '#ff8a6a');
      nova(s, t.x, t.y, 38, '#bfe86a', 0.5);
      scatter(s, 'spike_vine', t.x, t.y, 20, 3, 1.8, 0.6);
      if (!t.dead) {
        s._dots = s._dots || [];
        s._dots.push({ targetId: t.id, dps: ab.bleedDmgPerSec || 12, until: now(s) + (ab.bleedDuration || 4),
          team: u.team, attackerId: u.id, next: now(s) + 0.5 });
      }
      return true;
    },

    // Vanishing Step — blink behind the target; the next strike lands empowered.
    vanishing_step: function (s, u, ab) {
      var t = enemyTarget(s, u, 420);
      if (!t) { RTS.toast && RTS.toast(s, 'Vanishing Step — no target'); return false; }
      var dx = t.x - u.x, dy = t.y - u.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / d, uy = dy / d;
      var reach = Math.min(ab.blinkPx || 200, d + 40);
      var bx = u.x + ux * reach, by = u.y + uy * reach;
      if (isWaterAt(s, bx, by)) { bx = t.x - ux * 30; by = t.y - uy * 30; }
      nova(s, u.x, u.y, 36, '#bfe86a', 0.4);
      burst(s, u.x, u.y, '#bfe86a', 30, 0.3);            // vanish puff
      u.x = bx; u.y = by; u._evx = 0; u._evy = 0; u.vx = 0; u.vy = 0;
      burst(s, bx, by, '#d6f5a8', 38, 0.4);              // reappear flash
      u.facing = Math.atan2(t.y - by, t.x - bx);
      u._empowerUntil = now(s) + (ab.bonusWindow || 3);
      u._empowerMul = ab.bonusDmgPct || 0.80;
      nova(s, bx, by, 44, '#bfe86a', 0.5);
      RTS.SkillVFX && RTS.SkillVFX.spawn(s, 'spike_vine', bx, by, { scale: 2.4, life: 0.7 });
      return true;
    },

    // Ashfall Draw — a held draw, then one long cut across a line, damaging and
    // slowing everyone caught. Channelled (see tickHeroChannel branch below).
    ashfall_draw: function (s, u, ab) {
      var ang = u.facing == null ? 0 : u.facing;
      var tgt = u.target ? RTS.getById(s, u.target) : null;
      if (tgt && !tgt.dead) ang = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      u._channel = {
        abId: ab.id, x: u.x, y: u.y, ang: ang,
        len: ab.linePx || 260, dmg: ab.dmg || 280,
        slow: ab.slowPct || 0.50, slowDur: ab.slowDuration || 2.5,
        endsAt: now(s) + (ab.castTime || 1.5), nextSpark: 0,
      };
      RTS.toast && RTS.toast(s, 'Thoryn draws the Ashfall…');
      return true;
    },
  };

  RTS.triggerHeroAbility = function (s, uid, index) {
    var u = RTS.getById(s, uid);
    if (!u || u.dead || !u.heroId || !RTS.getHero) return false;
    var hero = RTS.getHero(u.heroId);
    if (!hero || !hero.abilities) return false;
    index = index || 0;
    var ab = hero.abilities[index];
    if (!ab) return false;
    if (ab.unlockLevel && (u.level || 1) < ab.unlockLevel) {
      RTS.toast && RTS.toast(s, ab.name + ' unlocks at level ' + ab.unlockLevel);
      return false;
    }
    var t = now(s);
    u._abilityCd = u._abilityCd || {};
    if ((u._abilityCd[ab.id] || 0) > t) { RTS.toast && RTS.toast(s, ab.name + ' on cooldown'); return false; }
    if (u._channel) return false;                      // already casting
    var fn = ABIL[ab.id];
    if (!fn) { RTS.toast && RTS.toast(s, ab.name + ' not implemented yet'); return false; }
    if (fn(s, u, ab) === false) return false;
    u._abilityCd[ab.id] = t + (ab.cooldown || 10);
    if (RTS.chaosTaxPenalty) u._abilityCd[ab.id] += RTS.chaosTaxPenalty(s, u);   // Skrix taxes nearby casts
    return true;
  };

  // Channel tick — returns true while the hero is busy channelling (skips AI).
  RTS.tickHeroChannel = function (s, u, dt) {
    var c = u._channel;
    if (!c) return false;
    u.vx = 0; u.vy = 0; u.moveTo = null; u._evx = 0; u._evy = 0;
    var t = now(s);

    // Valdris — The Last Wall: hold position, burn nearby foes, end in a shockwave.
    if (c.abId === 'the_last_wall') {
      u.x = c.x; u.y = c.y;   // immovable
      if (t >= c.nextRing) { c.nextRing = t + 0.5; nova(s, c.x, c.y, c.auraR, '#9fc0ff', 0.5); pillar(s, c.x, c.y, '#9fc0ff', 24, 86, 0.55); }
      if (t >= c.nextTick) {
        c.nextTick = t + 0.5;   // apply the per-second aura in half-second chunks
        (s.entities.units || []).forEach(function (e) {
          if (e.dead || e.team === u.team || e.kind !== 'unit' || dist(e.x, e.y, c.x, c.y) > c.auraR) return;
          if (RTS.applyDamage) RTS.applyDamage(s, e, c.auraDps * 0.5, u);
        });
      }
      if (t >= c.endsAt) {
        u._invuln = false;
        nova(s, c.x, c.y, c.shockR, '#dfe9ff', 0.7);
        burst(s, c.x, c.y, '#dfe9ff', c.shockR, 0.6);   // shockwave
        s.screenShake = Math.max(s.screenShake || 0, 8);
        (s.entities.units || []).forEach(function (e) {
          if (e.dead || e.team === u.team || e.kind !== 'unit' || dist(e.x, e.y, c.x, c.y) > c.shockR) return;
          if (RTS.applyDamage) RTS.applyDamage(s, e, c.shockDmg, u);
          float(s, e.x, e.y - (e.radius || 12), '-' + c.shockDmg, '#ff8a6a');
          if (!knockbackImmune(e)) {
            var a = Math.atan2(e.y - c.y, e.x - c.x);
            var kx = e.x + Math.cos(a) * 60, ky = e.y + Math.sin(a) * 60;
            if (!isWaterAt(s, kx, ky)) { e.x = kx; e.y = ky; e._evx = 0; e._evy = 0; }
          }
        });
        u._channel = null;
      }
      return true;
    }

    // Thoryn — Ashfall Draw: hold the draw, then one line-cut that damages + slows.
    if (c.abId === 'ashfall_draw') {
      var dx = Math.cos(c.ang), dy = Math.sin(c.ang), nx = -dy, ny = dx;
      if (t >= c.nextSpark) {
        c.nextSpark = t + 0.1;
        var fr = (rand()) * c.len;
        RTS.SkillVFX && RTS.SkillVFX.spawn(s, 'leaf_fall', c.x + dx * fr, c.y + dy * fr, { scale: 1.4, life: 0.4 });
      }
      if (t >= c.endsAt) {
        for (var q = 0; q <= 10; q++) RTS.SkillVFX && RTS.SkillVFX.spawn(s, 'spike_vine', c.x + dx * (c.len * q / 10), c.y + dy * (c.len * q / 10), { scale: 2.2, life: 0.6 });
        beam(s, c.x, c.y, c.x + dx * c.len, c.y + dy * c.len, '#d6f5a8', 22, 0.5);   // the long cut
        s.screenShake = Math.max(s.screenShake || 0, 6);
        (s.entities.units || []).forEach(function (e) {
          if (e.dead || e.team === u.team || e.kind !== 'unit') return;
          var rx = e.x - c.x, ry = e.y - c.y;
          var along = rx * dx + ry * dy;
          if (along < -20 || along > c.len + 20) return;
          if (Math.abs(rx * nx + ry * ny) > 50) return;
          RTS.applyDamage && RTS.applyDamage(s, e, c.dmg, u);
          RTS.applyBuff && RTS.applyBuff(s, e, { id: 'ashfall_slow', moveMul: -c.slow, duration: c.slowDur, color: '#bfe86a' });
          float(s, e.x, e.y - (e.radius || 12), '-' + c.dmg, '#ff8a6a');
        });
        u._channel = null;
      }
      return true;
    }

    // Aelindra — The Ashfall: rain leaves, then AoE damage + silence.
    if (t >= c.nextLeaf) {
      c.nextLeaf = t + 0.13;
      scatter(s, 'leaf_fall', c.x, c.y, c.radius, 2, 2.4, 0.9);
    }
    if (t >= c.endsAt) {
      nova(s, c.x, c.y, c.radius, '#c7e85a', 0.8);
      pillar(s, c.x, c.y, '#c7e85a', 32, 96, 0.85);
      burst(s, c.x, c.y, '#c7e85a', c.radius, 0.6);
      scatter(s, 'leaf_fall', c.x, c.y, c.radius, 10, 2.8, 1.0);
      (s.entities.units || []).forEach(function (e) {
        if (e.dead || e.team === u.team || dist(e.x, e.y, c.x, c.y) > c.radius) return;
        if (RTS.applyDamage) RTS.applyDamage(s, e, c.dmg, u);
        if (RTS.applyBuff) RTS.applyBuff(s, e, { id: 'ashfall_silence', disabled: true, duration: c.silence, color: '#c7e85a' });
        float(s, e.x, e.y - (e.radius || 12), '-' + c.dmg, '#ff8a6a');
      });
      u._channel = null;
    }
    return true;
  };

  // ── hero leveling ────────────────────────────────────────────────────────
  var MAX_LEVEL = 5;
  function xpToNext(level) { return 100 + (level - 1) * 120; }

  // Award XP to allied heroes near a killed enemy; the level-up aura plays on ding.
  RTS.awardHeroXp = function (s, attacker, victim) {
    if (!victim || victim.kind !== 'unit') return;
    var gain = victim.isHero ? 200 : Math.round(Math.min(120, Math.max(20, (victim.maxHp || 60) / 3)));
    var heroes = (s.entities.units || []).filter(function (h) {
      return h.isHero && !h.dead && h.team !== victim.team && (h.level || 1) < MAX_LEVEL
        && dist(h.x, h.y, victim.x, victim.y) <= 700;
    });
    heroes.forEach(function (h) {
      h.xp = (h.xp || 0) + gain;
      while ((h.level || 1) < MAX_LEVEL && h.xp >= xpToNext(h.level || 1)) {
        h.xp -= xpToNext(h.level || 1);
        RTS.heroLevelUp(s, h);
      }
    });
  };

  // UI helper — a hero's level/XP snapshot for the hero banner.
  RTS.heroProgress = function (h) {
    var lvl = (h && h.level) || 1;
    if (lvl >= MAX_LEVEL) return { level: lvl, max: MAX_LEVEL, atMax: true, pct: 1, xp: 0, next: 0 };
    var need = xpToNext(lvl);
    return { level: lvl, max: MAX_LEVEL, atMax: false, pct: Math.max(0, Math.min(1, ((h && h.xp) || 0) / need)), xp: (h && h.xp) || 0, next: need };
  };

  RTS.heroLevelUp = function (s, h) {
    h.level = (h.level || 1) + 1;
    // Bump the base snapshot so equipped-item recompute keeps the level gains.
    if (h._baseStats) {
      h._baseStats.maxHp += 40; h._baseStats.dmg += 2;
      h.hp = Math.min((h._baseStats.maxHp), h.hp + 40);
      if (RTS.applyHeroItems) RTS.applyHeroItems(h);
    } else {
      h.maxHp += 40; h.hp = Math.min(h.maxHp, h.hp + 40); h.dmg += 2;
    }
    // rising aura burst — stack two for fullness
    if (RTS.SkillVFX) {
      RTS.SkillVFX.spawn(s, 'levelup_aura', h.x, h.y - (h.radius || 16), { scale: 3.2, life: 0.9 });
      RTS.SkillVFX.spawn(s, 'levelup_aura', h.x, h.y - (h.radius || 16) - 18, { scale: 2.4, life: 1.05 });
    }
    nova(s, h.x, h.y, 70, '#e6a6ff', 0.5);
    var nm = (RTS.getHero && RTS.getHero(h.heroId) || {}).shortName || 'Hero';
    RTS.toast && RTS.toast(s, nm + ' reached level ' + h.level + '!');
    RTS.log && RTS.log(s, nm + ' is now level ' + h.level, 'good');
  };

  // ── attacker-side hero passives, run once per landed attack from fire() ────
  RTS.heroOnHit = function (s, u, target) {
    if (!u || u.kind !== 'unit' || !target) return;
    // Thoryn — Spine's Edge: consecutive hits on ONE target ramp attack speed.
    if (u.heroId === 'thoryn') {
      var hero = RTS.getHero && RTS.getHero('thoryn'), p = hero && hero.passive;
      if (p) {
        if (u._spineTarget === target.id) u._spineStacks = Math.min(p.maxStacks || 3, (u._spineStacks || 0) + 1);
        else { u._spineTarget = target.id; u._spineStacks = 1; }
        u.buffs = (u.buffs || []).filter(function (b) { return b.id !== 'spine_edge'; });
        RTS.applyBuff(s, u, { id: 'spine_edge', rofMul: u._spineStacks * (p.stackAtkSpeed || 0.12),
          duration: p.decaySec || 2, color: '#bfe86a' });
      }
    }
    // Seraphine — Resonance Field: any allied hit near her also slows the target.
    if (target.kind === 'unit' && target.team !== u.team) {
      var hero2 = RTS.getHero && RTS.getHero('seraphine'), p2 = hero2 && hero2.passive;
      if (p2) {
        var ser = (s.entities.units || []).find(function (h) {
          return !h.dead && h.heroId === 'seraphine' && h.team === u.team && dist(h.x, h.y, u.x, u.y) <= (p2.radius || 160);
        });
        if (ser) RTS.applyBuff(s, target, { id: 'resonance_slow', moveMul: -(p2.slowPct || 0.20),
          duration: p2.slowDuration || 1.0, color: '#aef0ff' });
      }
    }
  };

  // Skrix — Chaos Tax: a cast made within range of an enemy Skrix costs extra cd.
  RTS.chaosTaxPenalty = function (s, caster) {
    if (!caster || caster.heroId === 'skrix') return 0;
    var hero = RTS.getHero && RTS.getHero('skrix'), p = hero && hero.passive;
    if (!p) return 0;
    var r = p.radius || 320, pen = 0;
    (s.entities.units || []).forEach(function (k) {
      if (k.dead || k.heroId !== 'skrix' || k.team === caster.team) return;
      if (dist(k.x, k.y, caster.x, caster.y) <= r) {
        pen = p.cooldownPenalty || 2;
        float(s, caster.x, caster.y - (caster.radius || 14), '+' + pen + 's', '#ffd27a');
      }
    });
    return pen;
  };

  // Scatter Charge fuses — detonate timed ground blasts when their fuse elapses.
  RTS.tickTimedBlasts = function (s, dt) {
    var list = s._timedBlasts;
    if (!list || !list.length) return;
    var t = now(s);
    for (var i = list.length - 1; i >= 0; i--) {
      var b = list[i];
      if (t < b.at) continue;
      list.splice(i, 1);
      RTS.spawnExplosion && RTS.spawnExplosion(s, b.x, b.y, b.radius, '#ffb24d');
      burst(s, b.x, b.y, '#ffb24d', b.radius + 8, 0.4);
      s.screenShake = Math.max(s.screenShake || 0, 3);
      (s.entities.units || []).forEach(function (e) {
        if (e.dead || e.team === b.team || e.team === RTS.TEAM.NEUTRAL || e.kind !== 'unit') return;
        var d = dist(e.x, e.y, b.x, b.y);
        if (d > b.radius + (e.radius || 12)) return;
        RTS.applyDamage && RTS.applyDamage(s, e, b.dmg * (0.5 + 0.5 * (1 - d / (b.radius + 12))), { team: b.team });
      });
    }
  };

  // Bleed / damage-over-time effects (e.g. Thorn Cut), applied in half-second ticks.
  RTS.tickDots = function (s, dt) {
    var list = s._dots;
    if (!list || !list.length) return;
    var t = now(s);
    for (var i = list.length - 1; i >= 0; i--) {
      var d = list[i];
      var tgt = RTS.getById(s, d.targetId);
      if (!tgt || tgt.dead || t >= d.until) { list.splice(i, 1); continue; }
      if (t >= d.next) {
        d.next = t + 0.5;
        var atk = RTS.getById(s, d.attackerId) || { team: d.team };
        RTS.applyDamage && RTS.applyDamage(s, tgt, d.dps * 0.5, atk);
      }
    }
  };

  // Unravel — revert charmed units to their original side when the spell lapses.
  RTS.tickCharms = function (s, dt) {
    var t = now(s);
    (s.entities.units || []).forEach(function (u) {
      if (u._charmUntil == null || u.dead) return;
      if (t >= u._charmUntil) {
        u.team = u._origTeam; u._charmUntil = null; u._origTeam = null;
        u.target = null; u.moveTo = null; u.commandMode = 'idle'; u.attackMove = false;
        nova(s, u.x, u.y, 40, '#caa15a', 0.5);
      }
    });
  };

  // Thornwall upkeep — root enemies caught in any active wall band; cull expired.
  RTS.tickThornwalls = function (s, dt) {
    var walls = s._thornwalls;
    if (!walls || !walls.length) return;
    var t = now(s);
    for (var w = walls.length - 1; w >= 0; w--) {
      var wall = walls[w];
      if (t >= wall.endsAt) { walls.splice(w, 1); continue; }
      (s.entities.units || []).forEach(function (e) {
        if (e.dead || e.team === wall.team) return;
        // distance from the wall's centre line (point-to-segment along perpendicular axis)
        var rx = e.x - wall.x, ry = e.y - wall.y;
        var along = rx * wall.px + ry * wall.py;            // position along the wall
        if (Math.abs(along) > wall.len / 2 + 16) return;
        var perp = Math.abs(rx * -wall.py + ry * wall.px);  // distance off the band
        if (perp > wall.r) return;
        if (RTS.applyBuff) RTS.applyBuff(s, e, { id: 'thornwall_root', rooted: true, duration: 0.4, color: '#8db84a' });
      });
    }
  };
})(window.RTS = window.RTS || {});
