/* ============================================================================
 * Warcrest — systems.js
 * Focused runtime systems not owned by the input/render modules.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TEAM = RTS.TEAM;

  function tickHeroCooldowns(u, dt) {
    if (!u.isHero || !u.abilityCooldowns) return;
    var keys = Object.keys(u.abilityCooldowns);
    for (var k = 0; k < keys.length; k++) {
      if (u.abilityCooldowns[keys[k]] > 0) {
        u.abilityCooldowns[keys[k]] = Math.max(0, u.abilityCooldowns[keys[k]] - dt);
      }
    }
  }

  function baseForRespawn(s, team) {
    return s.entities.buildings.find(function (b) {
      return b.team === team && !b.dead && (b.type === 'core' || b.type === 'outpost');
    }) || s.entities.buildings.find(function (b) {
      return b.team === team && !b.dead;
    });
  }

  function beginHeroRespawn(s, u) {
    u.dead = true;
    u.hp = 0;
    u.target = null;
    u.moveTo = null;
    u.attackMove = false;
    u.respawnTimer = u.respawnTotal;
    u.corpse = 0;
    RTS.log(s, u.name + ' has fallen! Respawning in ' + u.respawnTotal + 's',
      u.team === TEAM.PLAYER ? 'bad' : 'good');
  }

  function finishHeroRespawn(s, u) {
    var base = baseForRespawn(s, u.team);
    u.x = base ? base.x : u.x;
    u.y = base ? base.y + 60 : u.y;
    u.vx = 0;
    u.vy = 0;
    u.hp = Math.round(u.maxHp * 0.5);
    u.dead = false;
    u.respawnTimer = null;
    u.spawnFlash = 0.45;
    u.guardOrigin = { x: u.x, y: u.y };
    if (RTS.UnitAI && RTS.UnitAI.applyStop) RTS.UnitAI.applyStop(u);
    RTS.log(s, u.name + ' has returned!',
      u.team === TEAM.PLAYER ? 'good' : 'bad');
    RTS.recalcSupply(s, u.team);
  }

  RTS.updateHeroLifecycle = function (s, dt) {
    if (!s || !s.entities || !s.entities.units) return;
    s.entities.units.forEach(function (u) {
      if (!u || !u.isHero) return;

      tickHeroCooldowns(u, dt);

      if (u.dead && u.respawnTimer == null && u.hp <= 0) {
        beginHeroRespawn(s, u);
        return;
      }

      if (!u.dead && u.hp <= 0) {
        beginHeroRespawn(s, u);
        return;
      }

      if (u.dead && u.respawnTimer != null) {
        u.respawnTimer -= dt;
        if (u.respawnTimer <= 0) finishHeroRespawn(s, u);
      }
    });
  };

})(window.RTS = window.RTS || {});