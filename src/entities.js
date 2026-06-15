/* ============================================================================
 * EXOFRONT — entities.js
 * Factories for units, buildings, resource nodes, projectiles, effects.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  function addTrait(list, trait) {
    if (list.indexOf(trait) < 0) list.push(trait);
  }

  function removeTrait(list, trait) {
    var idx = list.indexOf(trait);
    if (idx >= 0) list.splice(idx, 1);
  }

  function traitsFor(role, factionId, spec) {
    var traits = (spec.traits || []).slice();
    if (factionId === 'aurex') {
      addTrait(traits, 'formation_bonus');
      removeTrait(traits, 'blood_frenzy');
      removeTrait(traits, 'gnoll_poison');
      removeTrait(traits, 'trollblood');
    } else if (factionId === 'cinder') {
      addTrait(traits, 'blood_frenzy');
      removeTrait(traits, 'formation_bonus');
      removeTrait(traits, 'archer_still');
      removeTrait(traits, 'monk_aura');
      removeTrait(traits, 'taunt');
      if (role === 'archer') addTrait(traits, 'gnoll_poison');
      if (role === 'warrior') addTrait(traits, 'trollblood');
    }
    return traits;
  }

  RTS.makeUnit = function (s, role, team, x, y, factionId) {
    var spec = RTS.Units[role];
    var fid = factionId || (team === RTS.TEAM.PLAYER ? s.playerFaction : s.enemyFaction);
    var id = RTS.nextId();
    var u = {
      id: id, kind: 'unit', role: role, team: team,
      faction: fid,
      x: x, y: y, vx: 0, vy: 0,
      hp: spec.hp, maxHp: spec.hp,
      speed: spec.speed, dmg: spec.dmg, range: spec.range, rof: spec.rof,
      traits: traitsFor(role, fid, spec),
      tauntRadius: fid === 'aurex' ? spec.tauntRadius : null,
      ranged: !!spec.ranged, splash: spec.splash || 0, heal: spec.heal || 0,
      radius: RTS.SizeRef.pxRadius(role),
      cooldown: 0, target: null, moveTo: null, attackMove: false,
      harvest: null,            // {nodeId, phase, carry, slotIndex, cycleT, depositId, depositOwnerId}
      buildTask: null,          // {buildingId}
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

  RTS.makeBuilding = function (s, type, team, x, y, factionId, prebuilt) {
    var spec = RTS.Buildings[type];
    var b = {
      id: RTS.nextId(), kind: 'building', type: type, team: team,
      faction: factionId || (team === RTS.TEAM.PLAYER ? s.playerFaction : s.enemyFaction),
      x: x, y: y, w: spec.w, h: spec.h,
      hp: prebuilt ? spec.hp : Math.max(1, spec.hp * 0.08), maxHp: spec.hp,
      built: !!prebuilt, progress: prebuilt ? 1 : 0, buildTime: spec.build || 0.001,
      queue: [], train: null, rally: null, autoMine: false,
      primaryNodeId: null,     // linked home/expansion vein for auto-mine
      builderId: null,
      cooldown: 0, target: null,
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
      attackerId: opts.attackerId || from.id || null,
      faction: opts.faction || from.faction,
      role: opts.role || from.role,
      traits: (opts.traits || from.traits || []).slice ? (opts.traits || from.traits || []).slice() : [],
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

  RTS.spawnHit = function (s, x, y) {
    if (RTS.Config.reducedMotion) return;
    if (RTS.Particles && RTS.Particles.ready) {
      RTS.Particles.spawnImpact(s, x, y);
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
