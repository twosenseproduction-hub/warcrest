/* ============================================================================
 * EXOFRONT — entities.js
 * Factories for units, buildings, resource nodes, projectiles, effects.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  RTS.makeUnit = function (s, role, team, x, y, factionId) {
    var spec = RTS.Units[role];
    var u = {
      id: RTS.nextId(), kind: 'unit', role: role, team: team,
      faction: factionId || (team === RTS.TEAM.PLAYER ? s.playerFaction : s.enemyFaction),
      x: x, y: y, vx: 0, vy: 0,
      hp: spec.hp, maxHp: spec.hp,
      speed: spec.speed, dmg: spec.dmg, range: spec.range, rof: spec.rof,
      ranged: !!spec.ranged, splash: spec.splash || 0, heal: spec.heal || 0,
      radius: RTS.SizeRef.pxRadius(RTS.SizeRef.unitLol(role)),
      cooldown: 0, target: null, moveTo: null, attackMove: false,
      harvest: null,            // {nodeId, phase, carry}
      buildTask: null,          // {buildingId}
      hitFlash: 0, muzzleFlash: 0, spawnFlash: 0.3, dead: false, corpse: 0,
      facing: 0,
    };
    s.entities.units.push(u);
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
      faction: opts.faction || from.faction,
      role: opts.role || from.role,
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

  RTS.spawnHit = function (s, x, y, team) {
    if (RTS.Config.reducedMotion) return;
    var c = team === RTS.TEAM.ENEMY ? '#ffd1a8' : '#bdfff2';
    RTS.addEffect(s, { kind: 'spark', x: x, y: y, life: 0.16, max: 0.16, color: c });
    RTS.addEffect(s, { kind: 'ring', x: x, y: y, life: 0.22, max: 0.22, color: c, r: 4 });
  };

  RTS.spawnExplosion = function (s, x, y, size, color) {
    if (RTS.Config.reducedMotion) return;
    RTS.addEffect(s, { kind: 'boom', x: x, y: y, life: 0.42, max: 0.42,
                       color: color || '#ffcf6b', r: size || 18 });
  };

  RTS.spawnFloat = function (s, x, y, text, color) {
    RTS.addEffect(s, { kind: 'float', x: x, y: y, life: 0.9, max: 0.9,
                       color: color || '#ffe08a', text: text });
  };

})(window.RTS = window.RTS || {});
