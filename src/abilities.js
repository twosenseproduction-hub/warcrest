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
    var dm = 0, aa = 0;
    (u.buffs || []).forEach(function (b) { dm += b.dmgMul || 0; aa += b.armorAdd || 0; });
    u.buffDmgMul = dm; u.buffArmorAdd = aa;
  }
  RTS.recomputeBuffs = recompute;

  function applyBuff(s, target, buff) {
    target.buffs = target.buffs || [];
    var now = s.timers.gameTime || 0;
    var ex = target.buffs.find(function (b) { return b.id === buff.id; });
    if (ex) { ex.until = now + buff.duration; }
    else target.buffs.push({ id: buff.id, until: now + buff.duration,
      dmgMul: buff.dmgMul || 0, armorAdd: buff.armorAdd || 0, color: buff.color });
    recompute(target);
  }

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
      if (RTS.autocastOn(u, ids[i])) RTS.castAbility(s, u, ids[i]);
    }
  };

  RTS.toggleAutocast = function (s, uid, abId) {
    var u = RTS.getById ? RTS.getById(s, uid) : null;
    if (!u) return;
    u.autocast = u.autocast || {};
    u.autocast[abId] = !RTS.autocastOn(u, abId);
  };

})(window.RTS = window.RTS || {});
