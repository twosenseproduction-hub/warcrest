/* ============================================================================
 * EXOFRONT — ai.js
 * Enemy faction brain. Harvests, produces a growing army, and launches waves
 * at the player. Not a genius — but it builds a real, escalating match.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;

  RTS.AI = {
    update: function (s, dt) {
      if (!s.ai) s.ai = { think: 0, harvestTick: 0, composition: 0 };
      var cfg = RTS.Config.ai;

      // Abstracted passive economy (keeps the AI funded without micromanaging)
      s.res.enemy.halcite += cfg.income * dt;

      // Keep enemy workers harvesting
      s.ai.harvestTick -= dt;
      if (s.ai.harvestTick <= 0) {
        s.ai.harvestTick = 1.5;
        assignWorkers(s);
      }

      // Production thinking
      s.ai.think -= dt;
      if (s.ai.think <= 0) {
        s.ai.think = 1.4;
        produce(s);
      }

      // Attack waves
      if (s.timers.gameTime >= s.timers.nextWave) {
        launchWave(s);
        s.timers.waveNumber++;
        s.timers.nextWave = s.timers.gameTime + cfg.waveInterval;
      }
    },
  };

  function enemyUnits(s, role) {
    return s.entities.units.filter(function (u) {
      return u.team === TEAM.ENEMY && !u.dead && (!role || u.role === role);
    });
  }
  function enemyBuilding(s, type) {
    return s.entities.buildings.find(function (b) {
      return b.team === TEAM.ENEMY && !b.dead && b.built && b.type === type;
    });
  }

  function assignWorkers(s) {
    enemyUnits(s, 'worker').forEach(function (w) {
      if (!w.harvest && !w.buildTask) {
        var node = RTS.nearestNode(s, w.x, w.y);
        if (node) w.harvest = { nodeId: node.id, phase: 'toNode', carry: 0 };
      }
    });
  }

  function produce(s) {
    var cfg = RTS.Config.ai;
    var core = RTS.enemyCore(s);
    if (!core) return;

    // maintain worker count
    if (enemyUnits(s, 'worker').length < cfg.workerCount && core.queue.length === 0) {
      RTS.train(s, core, 'worker');
    }

    var army = enemyUnits(s).filter(function (u) { return u.role !== 'worker'; }).length;
    var queued = 0;
    s.entities.buildings.forEach(function (b) {
      if (b.team === TEAM.ENEMY) queued += b.queue.length;
    });

    // target army grows over time
    var target = Math.min(cfg.maxArmy, 4 + Math.floor(s.timers.gameTime / 22));
    if (army + queued >= target) return;

    // Choose a unit by a rotating composition for variety
    var foundry = enemyBuilding(s, 'foundry');
    var forge = enemyBuilding(s, 'forge');
    var pick = s.ai.composition++ % 6;
    var role, bldg;
    if (pick === 0 || pick === 3) { role = 'light'; bldg = foundry; }
    else if (pick === 1) { role = 'scout'; bldg = foundry; }
    else if (pick === 4) { role = 'support'; bldg = foundry; }
    else if (pick === 2) { role = 'heavy'; bldg = forge; }
    else { role = 'siege'; bldg = forge; }

    if (!bldg) bldg = foundry || forge;
    if (bldg && bldg.queue.length < 2) RTS.train(s, bldg, role);
  }

  function launchWave(s) {
    var pcore = RTS.playerCore(s);
    if (!pcore) return;
    var army = enemyUnits(s).filter(function (u) { return u.role !== 'worker'; });

    // Only commit if there's a meaningful force; otherwise harass with what we have.
    var commit = army.filter(function (u) { return !u.attackMove; });
    if (!commit.length) return;

    // stage near player base then attack-move (auto-acquires on the way)
    var jitter = 60;
    commit.forEach(function (u) {
      u.attackMove = true;
      u.target = null;
      u.moveTo = {
        x: pcore.x + (Math.random() - 0.5) * jitter,
        y: pcore.y + (Math.random() - 0.5) * jitter,
      };
    });

    if (s.timers.waveNumber === 0) {
      RTS.log(s, 'Enemy scouts probing your front', 'warn');
    } else {
      RTS.log(s, 'Cinder assault wave inbound!', 'bad');
      RTS.toast(s, 'Wave incoming — defend the Castle');
    }
  }

})(window.RTS = window.RTS || {});
