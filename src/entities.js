/* ============================================================================
 * EXOFRONT — entities.js
 * Factories for units, buildings, resource nodes, projectiles, effects.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  RTS.makeUnit = function (s, role, team, x, y, factionId) {
    var faction = factionId || (team === RTS.TEAM.PLAYER ? s.playerFaction : s.enemyFaction);
    // Effective spec = shared role base merged with this faction's overrides.
    var spec = (RTS.resolveUnitSpec && RTS.resolveUnitSpec(role, faction)) || RTS.Units[role];
    var id = RTS.nextId();
    var u = {
      id: id, kind: 'unit', role: role, team: team,
      faction: faction,
      x: x, y: y, vx: 0, vy: 0,
      hp: spec.hp, maxHp: spec.hp,
      speed: spec.speed, dmg: spec.dmg, range: spec.range, rof: spec.rof,
      ranged: !!spec.ranged, splash: spec.splash || 0, heal: spec.heal || 0,
      // racial passives: Iron Discipline (armor), Wild Grace (evade), Blood Vigor (regen)
      armor: spec.armor || 0, evade: spec.evade || 0, regen: spec.regen || 0,
      _lastCombatAt: -999,
      // abilities + caster mana + active buffs
      mana: spec.mana || 0, maxMana: spec.mana || 0, manaRegen: spec.manaRegen || 0,
      abilities: spec.abilities ? spec.abilities.slice() : [],
      traits: spec.traits ? spec.traits.slice() : [],   // passive combat traits
      tauntRadius: spec.tauntRadius || 0,
      autocast: {}, _abilityCd: {},
      buffs: [], buffDmgMul: 0, buffArmorAdd: 0,
      radius: RTS.SizeRef.pxRadius(role),
      cooldown: 0, target: null, moveTo: null, attackMove: false,
      harvest: null,            // {nodeId, phase, carry, slotIndex, cycleT, depositId, depositOwnerId}
      buildTask: null,          // {buildingId}
      buildQueue: [],           // further building ids after buildTask completes
      hitFlash: 0, muzzleFlash: 0, spawnFlash: 0.3, dead: false, corpse: 0,
      facing: 0,
      _idlePhase: (id * 1.618) % 6.2832,
    };
    s.entities.units.push(u);
    if (RTS.UnitAI) RTS.UnitAI.initUnitAIState(u);
    var rc = (RTS.Config.combat && RTS.Config.combat.roles && RTS.Config.combat.roles[role]) ||
      (RTS.Config.combat && RTS.Config.combat.roles && RTS.Config.combat.roles.default);
    if (rc) {
      u.acquireRange = u.range * (rc.acquireMul || 1.5);
      u.chaseRange = rc.chaseRange || 200;
    }
    u.guardOrigin = { x: x, y: y };
    u.commandMode = 'idle';
    RTS.recalcSupply(s, team);
    return u;
  };

  // Neutral creep — a hostile unit that guards a spot (e.g. an expansion mine).
  // WC3-style: aggros anyone who comes near, leashes back to its camp, and
  // grants hero XP when killed (the generic hostile-target logic handles combat).
  RTS.makeCreep = function (s, role, x, y, faction, camp) {
    var u = RTS.makeUnit(s, role, RTS.TEAM.NEUTRAL, x, y, faction || 'cinder');
    if (!u) return null;
    u.isCreep = true;
    u.commandMode = 'guard';
    u.guardOrigin = camp || { x: x, y: y };
    u.chaseRange = 240;                       // tight leash to the camp
    u.acquireRange = (u.range || 40) * 3.0;
    u.maxHp = Math.round(u.maxHp * 1.35); u.hp = u.maxHp;   // a real speed bump
    u.autoMine = false;
    return u;
  };

  RTS.makeHero = function (s, heroId, team, x, y, factionId) {
    var hero = RTS.getHero ? RTS.getHero(heroId) : null;
    if (!hero) return null;
    var id = RTS.nextId();
    var u = {
      id: id, kind: 'unit', role: hero.role || 'hero', heroId: heroId, team: team,
      faction: factionId || (team === RTS.TEAM.PLAYER ? s.playerFaction : s.enemyFaction),
      x: x, y: y, vx: 0, vy: 0,
      hp: hero.hp, maxHp: hero.hp,
      speed: hero.speed, dmg: hero.dmg, range: hero.range, rof: 0.75,
      ranged: !!hero.ranged, splash: 0, heal: 0,
      radius: RTS.SizeRef.pxRadius('hero'),
      cooldown: 0, target: null, moveTo: null, attackMove: false,
      harvest: null, buildTask: null,
      hitFlash: 0, muzzleFlash: 0, spawnFlash: 0.35, dead: false, corpse: 0,
      facing: 0,
      _idlePhase: (id * 1.618) % 6.2832,
      level: 1, xp: 0,            // hero leveling — XP from nearby kills, see hero-abilities
      uiPassiveTags: hero.passive && hero.passive.name ? [hero.passive.name] : [],
      _heroArmorStacks: 0,
      _heroArmorDecay: 0,
      isHero: true,
    };
    s.entities.units.push(u);
    if (RTS.UnitAI) RTS.UnitAI.initUnitAIState(u);
    var rc = (RTS.Config.combat && RTS.Config.combat.roles && RTS.Config.combat.roles.warrior) ||
      (RTS.Config.combat && RTS.Config.combat.roles && RTS.Config.combat.roles.default);
    if (rc) {
      u.acquireRange = u.range * (rc.acquireMul || 1.7);
      u.chaseRange = rc.chaseRange || 205;
    }
    u.guardOrigin = { x: x, y: y };
    u.commandMode = 'idle';
    // Equipment: snapshot base stats so item bonuses can be (re)applied cleanly.
    u.items = [];
    u._baseStats = {
      dmg: u.dmg, armor: u.armor || 0, maxHp: u.maxHp,
      speed: u.speed, range: u.range, regen: u.regen || 0, rof: u.rof,
    };
    return u;
  };

  RTS.makeBuilding = function (s, type, team, x, y, factionId, prebuilt) {
    var spec = RTS.Buildings[type];
    var b = {
      id: RTS.nextId(), kind: 'building', type: type, team: team,
      faction: factionId || (team === RTS.TEAM.PLAYER ? s.playerFaction : s.enemyFaction),
      x: x, y: y, w: spec.w, h: spec.h,
      hp: prebuilt ? spec.hp : Math.max(1, spec.hp * 0.08), maxHp: spec.hp,
      built: !!prebuilt, progress: prebuilt ? 1 : 0, buildTime: spec.build || 0.001,
      queue: [], train: null, rally: null, autoMine: false,
      primaryNodeId: null,
      builderId: null,
      cooldown: 0, target: null,
      level: 1,
      hitFlash: 0, dead: false, spawnFlash: 0.3,
    };
    s.entities.buildings.push(b);
    RTS.recalcSupply(s, team);
    return b;
  };

  RTS.makeResource = function (s, x, y, amount) {
    var node = {
      id: RTS.nextId(), kind: 'resource', x: x, y: y, r: RTS.SizeRef.resourceR(),
      amount: amount, max: amount,
    };
    s.entities.resources.push(node);
    return node;
  };

  RTS.makeProjectile = function (s, from, target, dmg, opts) {
    opts = opts || {};
    s.entities.projectiles.push({
      id: RTS.nextId(), x: from.x, y: from.y,
      targetId: target.id, team: from.team, dmg: dmg,
      speed: opts.speed || RTS.Config.projectileSpeed,
      splash: opts.splash || 0,
      color: opts.color || '#ffffff', life: 2.2,
      lastX: target.x, lastY: target.y,
      faction: opts.faction || from.faction,
      role: opts.role || from.role,
      heroId: opts.heroId || null,
      fromTurret: opts.fromTurret || false,
    });
  };

  RTS.addEffect = function (s, fx) {
    fx.id = RTS.nextId();
    s.entities.effects.push(fx);
    if (s.entities.effects.length > RTS.Config.maxEffects) {
      s.entities.effects.splice(0, s.entities.effects.length - RTS.Config.maxEffects);
    }
  };

  RTS.spawnHit = function (s, x, y, role, faction) {
    if (RTS.Config.reducedMotion) return;
    if (RTS.Particles && RTS.Particles.ready) {
      RTS.Particles.spawnImpact(s, x, y, role, faction);
      return;
    }
    RTS.addEffect(s, { kind: 'spark', x: x, y: y, life: 0.12, max: 0.12, color: '#ffe8c8' });
  };

  RTS.spawnDust = function (s, x, y, scale, large) {
    if (RTS.Config.reducedMotion) return;
    if (RTS.Particles && RTS.Particles.ready) {
      RTS.Particles.spawnDust(s, x, y, scale, large);
    }
  };

  RTS.spawnUnitDust = function (s, u) {
    if (RTS.Config.reducedMotion) return;
    if (RTS.Particles && RTS.Particles.ready) RTS.Particles.spawnUnitDust(s, u);
  };

  RTS.spawnBuildingDust = function (s, b) {
    if (RTS.Config.reducedMotion) return;
    if (RTS.Particles && RTS.Particles.ready) RTS.Particles.spawnBuildingDust(s, b);
  };

  RTS.spawnExplosion = function (s, x, y, size, color) {
    if (RTS.Config.reducedMotion) return;
    if (RTS.Particles && RTS.Particles.ready && RTS.Particles.spawnExplosion(s, x, y, size)) return;
    RTS.addEffect(s, { kind: 'boom', x: x, y: y, life: 0.42, max: 0.42,
                       color: color || '#ffcf6b', r: size || 18 });
  };

  RTS.spawnFloat = function (s, x, y, text, color) {
    RTS.addEffect(s, { kind: 'float', x: x, y: y, life: 0.9, max: 0.9,
                       color: color || '#ffe08a', text: text });
  };

})(window.RTS = window.RTS || {});
