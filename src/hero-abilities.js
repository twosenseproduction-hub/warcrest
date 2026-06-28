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
      u.x = ex; u.y = ey; u.facing = ang; u._evx = 0; u._evy = 0; u.moveTo = null; u.vx = 0; u.vy = 0;
      nova(s, sx, sy, 50, '#cfe0ff', 0.4);
      nova(s, ex, ey, 70, '#cfe0ff', 0.5);
      s.screenShake = Math.max(s.screenShake || 0, 5);
      return true;
    },

    // Iron Edict — plant the banner: every ally in radius is warded to survive
    // one lethal hit at 1hp for the duration (consumed on the hit that saves it).
    iron_edict: function (s, u, ab) {
      var R = ab.radius || 240, dur = ab.duration || 10, n = 0;
      nova(s, u.x, u.y, R, '#ffd98a', 0.8);
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
      scatter(s, 'leaf_fall', t.x, t.y, 30, 3, 2.0, 0.8);
      float(s, t.x, t.y - (t.radius || 12), 'hexed', '#d68fff');
      return true;
    },

    // Death Coil — bolt of spirit-fire: damages a foe and heals Grollusk.
    death_coil: function (s, u, ab) {
      var t = enemyTarget(s, u, 360);
      if (!t) { RTS.toast && RTS.toast(s, 'Death Coil — no target'); return false; }
      var dmg = ab.dmg || 120, heal = ab.selfHeal || 60;
      RTS.applyDamage && RTS.applyDamage(s, t, dmg, u);
      float(s, t.x, t.y - (t.radius || 12), '-' + dmg, '#6cff8a');
      nova(s, t.x, t.y, 50, '#4cff6b', 0.6);
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
        made++;
      }
      if (!made) return false;
      nova(s, cx, cy, 80, '#6cff8a', 0.7);
      if (RTS.recalcSupply) { RTS.recalcSupply(s, u.team); }
      RTS.toast && RTS.toast(s, "Ancestor's Fury — " + made + ' spirits rise');
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
      if (t >= c.nextRing) { c.nextRing = t + 0.5; nova(s, c.x, c.y, c.auraR, '#9fc0ff', 0.5); }
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

    // Aelindra — The Ashfall: rain leaves, then AoE damage + silence.
    if (t >= c.nextLeaf) {
      c.nextLeaf = t + 0.13;
      scatter(s, 'leaf_fall', c.x, c.y, c.radius, 2, 2.4, 0.9);
    }
    if (t >= c.endsAt) {
      nova(s, c.x, c.y, c.radius, '#c7e85a', 0.8);
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
