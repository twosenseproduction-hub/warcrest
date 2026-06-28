/* ============================================================================
 * Warcrest — abilities.js
 * Active/autocast abilities for regular (non-hero) units. WC3-grounded.
 *
 * A unit's abilities come from its resolved spec (`spec.abilities = [id,...]`).
 * Each ability is registered here with its cost / cooldown / effect. Casters
 * carry a mana pool (spec.mana / spec.manaRegen); toggle & martial actives are
 * cooldown-only (manaCost 0). Buffs are tracked per-unit in `u.buffs` and folded
 * into combat via RTS.outgoingDamage / RTS.effectiveArmor.
 *
 * Vertical slice: aurex Priest — Inner Fire (autocast ally buff).
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  // ── registry ────────────────────────────────────────────────────────────
  RTS.Abilities = {
    inner_fire: {
      id: 'inner_fire', name: 'Inner Fire', role: 'monk', faction: 'aurex',
      icon: 'assets/units/abilities/inner_fire.png',
      manaCost: 25, cooldown: 1.0, autocastDefault: true,
      cast: 'ally', range: 200,
      buff: { id: 'inner_fire', dmgMul: 0.20, armorAdd: 0.15, duration: 18, color: '#ffd27a' },
      vfxColor: '#ffd27a',
      desc: 'Blesses an ally: +20% damage and +15% armor for 18s.',
    },

    // Hex Shaman (cinder) — buffs an ally's attack speed.
    bloodlust: {
      id: 'bloodlust', name: 'Bloodlust', role: 'monk', faction: 'cinder',
      icon: 'assets/units/abilities/bloodlust.png',
      manaCost: 25, cooldown: 1.0, autocastDefault: true, cast: 'ally', range: 200,
      buff: { id: 'bloodlust', rofMul: 0.40, duration: 15, color: '#ff5a3c' },
      vfxColor: '#ff5a3c',
      desc: 'Frenzies an ally: +40% attack speed for 15s.',
    },

    // Sapling Mystic (rimwalker) — heal-over-time on an ally.
    rejuvenation: {
      id: 'rejuvenation', name: 'Rejuvenation', role: 'monk', faction: 'rimwalker',
      icon: 'assets/units/abilities/rejuvenation.png',
      manaCost: 30, cooldown: 1.0, autocastDefault: true, cast: 'ally', range: 220,
      buff: { id: 'rejuvenation', healPerSec: 8, duration: 12, color: '#9bff8a' },
      vfxColor: '#9bff8a',
      desc: 'Wraps an ally in renewing growth: heals 8 hp/s for 12s.',
    },

    // Bark Archer (rimwalker) — self toggle: arrows burn for bonus damage.
    searing_arrows: {
      id: 'searing_arrows', name: 'Searing Arrows', role: 'archer', faction: 'rimwalker',
      icon: 'assets/units/abilities/searing_arrows.png',
      manaCost: 0, cooldown: 2.0, autocastDefault: true, cast: 'self', castWhen: 'inCombat',
      buff: { id: 'searing_arrows', dmgMul: 0.35, duration: 3, color: '#ff7a2a' },
      vfxColor: '#ff7a2a',
      desc: 'While fighting, arrows ignite — +35% damage.',
    },

    // Gnoll (cinder) — self toggle: berserk, more attack speed but takes more damage.
    berserk: {
      id: 'berserk', name: 'Berserk', role: 'archer', faction: 'cinder',
      icon: 'assets/units/abilities/berserk.png',
      manaCost: 0, cooldown: 2.0, autocastDefault: true, cast: 'self', castWhen: 'inCombat',
      buff: { id: 'berserk', rofMul: 0.50, dmgTakenMul: 0.35, duration: 3, color: '#ff3030' },
      vfxColor: '#ff3030',
      desc: 'While fighting, goes berserk: +50% attack speed, but takes +35% damage.',
    },

    // Spear Goblin (cinder) — target an enemy: nets it in place (rooted).
    ensnare: {
      id: 'ensnare', name: 'Ensnare', role: 'lancer', faction: 'cinder',
      icon: 'assets/units/abilities/ensnare.png',
      manaCost: 0, cooldown: 10, cast: 'enemy', range: 210,
      buff: { id: 'ensnare', rooted: true, duration: 5, color: '#caa15a' },
      vfxColor: '#caa15a',
      desc: 'Nets a target enemy — it cannot move for 5s.',
    },

    // Hex Shaman (cinder) — target an enemy: hexes it, cannot attack.
    hex: {
      id: 'hex', name: 'Hex', role: 'monk', faction: 'cinder',
      icon: 'assets/units/abilities/hex.png',
      manaCost: 35, cooldown: 14, cast: 'enemy', range: 190,
      buff: { id: 'hex', disabled: true, duration: 6, color: '#b05ad0' },
      vfxColor: '#b05ad0',
      desc: 'Hexes a target enemy — it cannot attack for 6s.',
    },
  };

  // abilities available to a unit (empty for heroes — they use the hero kit).
  RTS.abilityList = function (unit) {
    if (!unit || unit.isHero) return [];
    var ids = unit.abilities || [];
    return ids.map(function (id) { return RTS.Abilities[id]; }).filter(Boolean);
  };

  RTS.autocastOn = function (u, abId) {
    var ab = RTS.Abilities[abId];
    if (!u.autocast || u.autocast[abId] === undefined) return !!(ab && ab.autocastDefault);
    return !!u.autocast[abId];
  };

  // ── buffs ─────────────────────────────────────────────────────────────────
  function hasBuff(u, id) { return !!(u.buffs && u.buffs.some(function (b) { return b.id === id; })); }
  RTS.hasBuff = hasBuff;

  function recompute(u) {
    var dm = 0, aa = 0, rm = 0, dt = 0, hps = 0, rooted = false, disabled = false;
    (u.buffs || []).forEach(function (b) {
      dm += b.dmgMul || 0; aa += b.armorAdd || 0; rm += b.rofMul || 0;
      dt += b.dmgTakenMul || 0; hps += b.healPerSec || 0;
      if (b.rooted) rooted = true; if (b.disabled) disabled = true;
    });
    u.buffDmgMul = dm; u.buffArmorAdd = aa; u.buffRofMul = rm;
    u.buffDmgTakenMul = dt; u.buffHealPerSec = hps;
    u.buffRooted = rooted; u.buffDisabled = disabled;
  }
  RTS.recomputeBuffs = recompute;

  function applyBuff(s, target, buff) {
    target.buffs = target.buffs || [];
    var now = s.timers.gameTime || 0;
    var ex = target.buffs.find(function (b) { return b.id === buff.id; });
    if (ex) { ex.until = now + buff.duration; }
    else target.buffs.push({ id: buff.id, until: now + buff.duration,
      dmgMul: buff.dmgMul || 0, armorAdd: buff.armorAdd || 0, rofMul: buff.rofMul || 0,
      dmgTakenMul: buff.dmgTakenMul || 0, healPerSec: buff.healPerSec || 0,
      rooted: !!buff.rooted, disabled: !!buff.disabled, color: buff.color });
    recompute(target);
  }

  RTS.applyBuff = applyBuff;   // reused by hero-abilities (silence, root, etc.)

  // expire elapsed buffs; called once per unit per frame from systems.
  RTS.tickBuffs = function (s, u) {
    if (!u.buffs || !u.buffs.length) return;
    var now = s.timers.gameTime || 0, changed = false;
    for (var i = u.buffs.length - 1; i >= 0; i--) {
      if (u.buffs[i].until <= now) { u.buffs.splice(i, 1); changed = true; }
    }
    if (changed) recompute(u);
  };

  // combat hooks
  RTS.outgoingDamage = function (u, base) { return base * (1 + (u && u.buffDmgMul || 0)); };
  RTS.effectiveArmor = function (u) {
    return Math.min(0.85, (u && u.armor || 0) + (u && u.buffArmorAdd || 0));
  };
  // higher rofMul = faster attacks (smaller cooldown). dmgTakenMul amplifies incoming hits.
  RTS.effectiveRof = function (u) { return u.rof / (1 + (u && u.buffRofMul || 0)); };
  RTS.incomingMul = function (u) { return 1 + (u && u.buffDmgTakenMul || 0); };

  // ── casting ─────────────────────────────────────────────────────────────
  function findAllyTarget(s, u, ab) {
    var best = null, bestScore = -1;
    s.entities.units.forEach(function (a) {
      if (a.dead || a.team !== u.team || a === u) return;
      if (a.role === 'pawn' || a.heal > 0) return;        // bless fighters, not workers/healers
      if (hasBuff(a, ab.buff.id)) return;
      var d = Math.hypot(a.x - u.x, a.y - u.y);
      if (d > ab.range) return;
      var score = 1000 - d;                                // nearest eligible fighter
      if (score > bestScore) { bestScore = score; best = a; }
    });
    return best;
  }

  RTS.castAbility = function (s, u, abId, target) {
    var ab = RTS.Abilities[abId];
    if (!ab || u.dead) return false;
    var now = s.timers.gameTime || 0;
    u._abilityCd = u._abilityCd || {};
    if ((u._abilityCd[abId] || 0) > now) return false;
    if ((u.mana || 0) < ab.manaCost) return false;
    if (ab.cast === 'ally') { target = target || findAllyTarget(s, u, ab); if (!target) return false; }
    else if (ab.cast === 'self') { target = u; if (ab.buff && hasBuff(u, ab.buff.id)) return false; }
    else if (ab.cast === 'enemy') {
      if (!target || target.dead || target.team === u.team) return false;   // manual flow supplies the foe
      if (Math.hypot(target.x - u.x, target.y - u.y) > ab.range * 1.25) return false;
    }
    u.mana = Math.max(0, (u.mana || 0) - ab.manaCost);
    u._abilityCd[abId] = now + ab.cooldown;
    if (ab.buff && target) applyBuff(s, target, ab.buff);
    var fx = target || u;
    if (RTS.addEffect) RTS.addEffect(s, { kind: 'heal', x: fx.x, y: fx.y, life: 0.45, max: 0.45, color: ab.vfxColor || '#ffd27a' });
    if (RTS.spawnFloat) RTS.spawnFloat(s, fx.x, fx.y - (fx.radius || 12), ab.name, ab.vfxColor || '#ffd27a');
    return true;
  };

  // per-frame autocast for a caster (no-op unless an ability is ready + has a target).
  RTS.tickAutocast = function (s, u) {
    var ids = u.abilities;
    if (!ids || !ids.length) return;
    for (var i = 0; i < ids.length; i++) {
      var ab = RTS.Abilities[ids[i]];
      if (!ab || !RTS.autocastOn(u, ids[i])) continue;
      if (ab.castWhen === 'inCombat' && !u.target) continue;   // self combat-toggles only fire while fighting
      RTS.castAbility(s, u, ids[i]);
    }
  };

  RTS.toggleAutocast = function (s, uid, abId) {
    var u = RTS.getById ? RTS.getById(s, uid) : null;
    if (!u) return;
    u.autocast = u.autocast || {};
    u.autocast[abId] = !RTS.autocastOn(u, abId);
  };

  /* ── passive combat traits ─────────────────────────────────────────────────
   * Defined as constants in config; applied here in the damage pipeline:
   *   archer_focus  — consecutive hits on ONE target ramp damage (sniper stacks)
   *   building_bane — cavalry hit structures harder
   *   formationBonus (Iron Crown / aurex) — focus-firing 3+ units = +dmg
   *   monkAura — friendly monks nearby soak a share of incoming damage
   *   bloodFrenzy (Raider Horde / cinder) — a death enrages nearby kin (atk speed)
   * ------------------------------------------------------------------------- */
  function hasTrait(u, t) { return u && u.traits && u.traits.indexOf(t) >= 0; }
  RTS.hasTrait = hasTrait;
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

  // outgoing damage multiplier from the ATTACKER's offensive traits (mutates sniper stacks).
  RTS.traitOutgoingMul = function (s, u, target) {
    if (!u || u.kind !== 'unit' || !target) return 1;
    var C = RTS.Config, mul = 1;
    if (hasTrait(u, 'archer_focus') && C.archerFocus) {
      if (u.sniperTarget === target.id) u.sniperStacks = Math.min(C.archerFocus.maxStacks, (u.sniperStacks || 0) + 1);
      else { u.sniperTarget = target.id; u.sniperStacks = 0; }
      mul *= 1 + u.sniperStacks * C.archerFocus.dmgPerStack;
    } else if (u.sniperTarget) { u.sniperTarget = null; u.sniperStacks = 0; }
    if (hasTrait(u, 'building_bane') && target.kind === 'building') mul *= 1.6;
    // Iron Crown formation focus-fire (faction-wide passive)
    if (u.faction === 'aurex' && C.formationBonus && target.kind === 'unit') {
      var fb = C.formationBonus, r2 = fb.radius * fb.radius, cnt = 0, arr = s.entities.units;
      for (var i = 0; i < arr.length; i++) { var a = arr[i];
        if (a.dead || a.team !== u.team || a.target !== target.id) continue;
        if (dist2(a.x, a.y, target.x, target.y) <= r2) { cnt++; if (cnt >= fb.minUnits) break; } }
      if (cnt >= fb.minUnits) mul *= 1 + fb.dmgBonus;
    }
    return mul;
  };

  // incoming damage multiplier from the TARGET's defensive auras (monk aura).
  RTS.traitIncomingMul = function (s, target) {
    var C = RTS.Config;
    if (!C.monkAura || !target || target.kind !== 'unit') return 1;
    var ma = C.monkAura, r2 = ma.radius * ma.radius, cnt = 0, arr = s.entities.units;
    for (var i = 0; i < arr.length; i++) { var m = arr[i];
      if (m.dead || m.team !== target.team || m === target) continue;
      if (m.role !== 'monk' && !hasTrait(m, 'monk_aura')) continue;
      if (dist2(m.x, m.y, target.x, target.y) <= r2) { cnt++; if (cnt >= 3) break; } }
    return cnt ? (1 - Math.min(ma.maxReduction, cnt * ma.dmgReduction)) : 1;
  };

  // a unit's death enrages nearby kin (Raider Horde blood frenzy → faster attacks).
  RTS.onUnitDeathTraits = function (s, dead) {
    var C = RTS.Config;
    if (!C.bloodFrenzy || !dead || dead.kind !== 'unit' || dead.faction !== 'cinder') return;
    var bf = C.bloodFrenzy, r2 = bf.radius * bf.radius, arr = s.entities.units;
    for (var i = 0; i < arr.length; i++) { var a = arr[i];
      if (a.dead || a === dead || a.team !== dead.team || a.faction !== 'cinder') continue;
      if (dist2(a.x, a.y, dead.x, dead.y) <= r2) RTS.applyBuff(s, a, { id: 'bloodfrenzy', duration: bf.duration, rofMul: bf.atkSpeedBonus, color: '#ff5a3a' });
    }
  };

})(window.RTS = window.RTS || {});
