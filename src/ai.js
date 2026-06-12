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

      // Keep enemy pawns harvesting
      s.ai.harvestTick -= dt;
      if (s.ai.harvestTick <= 0) {
        s.ai.harvestTick = 1.5;
        assignWorkers(s);
      }

      // Production thinking
      s.ai.think -= dt;
      if (s.ai.think <= 0) {
        s.ai.think = 1.4;
        buildStructures(s);
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
  function enemyBuildingAny(s, type) {
    return s.entities.buildings.find(function (b) {
      return b.team === TEAM.ENEMY && !b.dead && b.type === type;
    });
  }

  function enemyOutposts(s) {
    return s.entities.buildings.filter(function (b) {
      return b.team === TEAM.ENEMY && !b.dead && b.type === 'outpost';
    });
  }

  function teamDeposits(s, team) {
    return s.entities.buildings.filter(function (b) {
      return b.team === team && !b.dead && b.built &&
        (b.type === 'core' || b.type === 'outpost') &&
        RTS.Buildings[b.type].deposit;
    });
  }

  function nearestDepositTo(s, x, y, team) {
    var best = null, bd = Infinity;
    teamDeposits(s, team).forEach(function (b) {
      var d = RTS.dist(x, y, b.x, b.y);
      if (d < bd) { bd = d; best = b; }
    });
    return best;
  }

  function nearestNodeForDeposit(s, dep) {
    var ax = dep.rally ? dep.rally.x : dep.x;
    var ay = dep.rally ? dep.rally.y : dep.y;
    var best = null, bd = Infinity;
    s.entities.resources.forEach(function (n) {
      if (n.amount <= 0) return;
      var d = RTS.dist(ax, ay, n.x, n.y);
      if (d < bd) { bd = d; best = n; }
    });
    return best;
  }

  function homeGoldNode(s, core) {
    var best = null, bd = Infinity;
    s.entities.resources.forEach(function (n) {
      var d = RTS.dist(core.x, core.y, n.x, n.y);
      if (d < bd) { bd = d; best = n; }
    });
    return best;
  }

  function homeGoldDepleted(s, core) {
    var home = homeGoldNode(s, core);
    return !home || home.amount < 500;
  }

  function nodeServedByDeposit(s, team, node) {
    var serveR = RTS.Config.harvest.depositReach + (node.r || 0) + 60;
    return teamDeposits(s, team).some(function (b) {
      return RTS.dist(b.x, b.y, node.x, node.y) < serveR;
    });
  }

  function findExpansionNode(s, team) {
    var core = RTS.enemyCore(s);
    if (!core) return null;
    var pcore = RTS.playerCore(s);
    var best = null, bestScore = -Infinity;
    s.entities.resources.forEach(function (n) {
      if (n.amount < 800) return;
      if (nodeServedByDeposit(s, team, n)) return;
      var dCore = RTS.dist(core.x, core.y, n.x, n.y);
      var dPlayer = pcore ? RTS.dist(pcore.x, pcore.y, n.x, n.y) : 0;
      var score = n.amount - dCore * 0.25 - dPlayer * 0.08;
      if (score > bestScore) { bestScore = score; best = n; }
    });
    return best;
  }

  function aiCanPlaceOutpost(s, x, y, node, team) {
    team = team || TEAM.ENEMY;
    var spec = RTS.Buildings.outpost;
    var hw = spec.w / 2, hh = spec.h / 2;
    var W = RTS.Config.world.w, H = RTS.Config.world.h;
    if (x - hw < 20 || x + hw > W - 20 || y - hh < 20 || y + hh > H - 20) return false;

    var ok = true;
    s.entities.buildings.forEach(function (b) {
      if (b.dead) return;
      var ox = Math.abs(b.x - x), oy = Math.abs(b.y - y);
      if (ox < (b.w / 2 + hw + 14) && oy < (b.h / 2 + hh + 14)) ok = false;
    });
    if (!ok) return false;

    for (var j = 0; j < s.entities.resources.length; j++) {
      var res = s.entities.resources[j];
      if (RTS.dist(x, y, res.x, res.y) < res.r + Math.max(hw, hh) + 10) return false;
    }

    var pad = Math.max(hw, hh) + 12;
    var ringD = RTS.dist(x, y, node.x, node.y);
    if (ringD < node.r + pad || ringD > node.r + 210) return false;

    return !s.entities.buildings.some(function (b) {
      if (b.dead || b.team !== team) return false;
      if (b.type !== 'core' && b.type !== 'outpost') return false;
      return RTS.dist(x, y, b.x, b.y) < 340;
    });
  }

  function aiPlaceOutpost(s, x, y, node) {
    if (!aiCanPlaceOutpost(s, x, y, node, TEAM.ENEMY)) return false;
    var cost = RTS.Buildings.outpost.cost;
    if (!RTS.canAfford(s, TEAM.ENEMY, cost)) return false;
    s.res.enemy.halcite -= cost;
    var b = RTS.makeBuilding(s, 'outpost', TEAM.ENEMY, x, y, s.enemyFaction, false);
    b.rally = { x: node.x, y: node.y };
    b.autoMine = true;
    if (RTS.Pathfind) RTS.Pathfind.markDirty(s);
    RTS.assignBuilder(s, b);
    return true;
  }

  function tryAiBuildOutpost(s, node) {
    if (!node) return false;
    var spec = RTS.Buildings.outpost;
    var hw = spec.w / 2, hh = spec.h / 2;
    var pad = Math.max(hw, hh) + 12;
    for (var ring = 0; ring < 4; ring++) {
      var ringDist = node.r + pad + ring * 36;
      if (ringDist > node.r + 210) break;
      for (var a = 0; a < 16; a++) {
        var ang = (a / 16) * Math.PI * 2;
        var x = node.x + Math.cos(ang) * ringDist;
        var y = node.y + Math.sin(ang) * ringDist;
        if (aiPlaceOutpost(s, x, y, node)) {
          RTS.log(s, 'Enemy raising an Outpost at a new Halcite field', 'warn');
          return true;
        }
      }
    }
    return false;
  }

  function aiCanPlace(s, type, x, y) {
    var spec = RTS.Buildings[type];
    var hw = spec.w / 2, hh = spec.h / 2;
    var W = RTS.Config.world.w, H = RTS.Config.world.h;
    if (x - hw < 20 || x + hw > W - 20 || y - hh < 20 || y + hh > H - 20) return false;

    var ok = true;
    s.entities.buildings.forEach(function (b) {
      if (b.dead) return;
      var ox = Math.abs(b.x - x), oy = Math.abs(b.y - y);
      if (ox < (b.w / 2 + hw + 14) && oy < (b.h / 2 + hh + 14)) ok = false;
    });
    if (!ok) return false;

    for (var j = 0; j < s.entities.resources.length; j++) {
      var node = s.entities.resources[j];
      if (RTS.dist(x, y, node.x, node.y) < node.r + Math.max(hw, hh) + 10) return false;
    }

    var core = RTS.enemyCore(s);
    if (!core || RTS.dist(x, y, core.x, core.y) > 360) return false;
    return true;
  }

  function aiPlaceBuilding(s, type, x, y) {
    if (!aiCanPlace(s, type, x, y)) return false;
    var cost = RTS.Buildings[type].cost;
    if (!RTS.canAfford(s, TEAM.ENEMY, cost)) return false;
    s.res.enemy.halcite -= cost;
    var b = RTS.makeBuilding(s, type, TEAM.ENEMY, x, y, s.enemyFaction, false);
    if (RTS.Pathfind) RTS.Pathfind.markDirty(s);
    RTS.assignBuilder(s, b);
    return true;
  }

  function tryAiBuild(s, type) {
    if (enemyBuildingAny(s, type)) return false;
    var core = RTS.enemyCore(s);
    if (!core) return false;
    var pcore = RTS.playerCore(s);
    var toward = pcore
      ? Math.atan2(pcore.y - core.y, pcore.x - core.x)
      : Math.PI;
    var perp = toward + Math.PI / 2;
    var dist = 115;
    var offsets = [
      { x: Math.cos(perp) * dist, y: Math.sin(perp) * dist + 40 },
      { x: -Math.cos(perp) * dist, y: Math.sin(perp) * dist + 40 },
      { x: Math.cos(toward + Math.PI) * dist * 0.85, y: Math.sin(toward + Math.PI) * dist * 0.85 + 50 },
      { x: Math.cos(perp) * dist * 0.7, y: -Math.sin(perp) * dist * 0.7 + 70 },
      { x: -Math.cos(perp) * dist * 0.7, y: -Math.sin(perp) * dist * 0.7 + 70 },
    ];
    for (var i = 0; i < offsets.length; i++) {
      var ox = offsets[i];
      if (aiPlaceBuilding(s, type, core.x + ox.x, core.y + ox.y)) return true;
    }
    return false;
  }

  function buildStructures(s) {
    var workers = enemyUnits(s, 'pawn').length;
    var core = RTS.enemyCore(s);
    if (!core) return;

    if (!enemyBuildingAny(s, 'conduit') && workers >= 2 &&
        s.res.enemy.supplyUsed + 1 > s.res.enemy.supplyCap - 2 &&
        RTS.canAfford(s, TEAM.ENEMY, RTS.Buildings.conduit.cost)) {
      tryAiBuild(s, 'conduit');
    }

    if (!enemyBuildingAny(s, 'foundry') && workers >= 2 &&
        RTS.canAfford(s, TEAM.ENEMY, RTS.Buildings.foundry.cost)) {
      tryAiBuild(s, 'foundry');
    }

    if (enemyBuilding(s, 'foundry') && !enemyBuildingAny(s, 'forge') &&
        s.timers.gameTime > 45 &&
        RTS.canAfford(s, TEAM.ENEMY, RTS.Buildings.forge.cost)) {
      tryAiBuild(s, 'forge');
    }

    // Expand to a fresh gold field when the home pile runs low
    if (homeGoldDepleted(s, core) &&
        enemyOutposts(s).length < 2 &&
        !enemyBuildingAny(s, 'outpost') &&
        workers >= 2 &&
        s.timers.gameTime > 30 &&
        RTS.canAfford(s, TEAM.ENEMY, RTS.Buildings.outpost.cost)) {
      var expandNode = findExpansionNode(s, TEAM.ENEMY);
      if (expandNode) tryAiBuildOutpost(s, expandNode);
    }
  }

  // Pawns with buildTask / builderId must hammer on site until the shell is built.
  function assignWorkers(s) {
    enemyUnits(s, 'pawn').forEach(function (w) {
      if (w.harvest || w.moveTo || w.target) return;
      if (RTS.isConstructionWorker && RTS.isConstructionWorker(s, w)) return;
      var dep = nearestDepositTo(s, w.x, w.y, TEAM.ENEMY);
      if (!dep) return;
      var node = nearestNodeForDeposit(s, dep);
      if (node) w.harvest = { nodeId: node.id, phase: 'toNode', carry: 0 };
    });
  }

  function produce(s) {
    var cfg = RTS.Config.ai;
    var core = RTS.enemyCore(s);
    if (!core) return;

    // maintain pawn count
    if (enemyUnits(s, 'pawn').length < cfg.pawnCount && core.queue.length === 0) {
      RTS.train(s, core, 'pawn');
    }

    var army = enemyUnits(s).filter(function (u) { return u.role !== 'pawn'; }).length;
    var queued = 0;
    s.entities.buildings.forEach(function (b) {
      if (b.team === TEAM.ENEMY) queued += b.queue.length;
    });

    // target army grows over time
    var target = Math.min(cfg.maxArmy, 4 + Math.floor(s.timers.gameTime / 22));
    if (army + queued >= target) return;

    // Lancer-first army: Barracks line, Warriors from Archery after midgame
    var foundry = enemyBuilding(s, 'foundry');
    var forge = enemyBuilding(s, 'forge');
    var pick = s.ai.composition++ % 8;
    var role, bldg;
    if (forge && s.timers.gameTime > 50 && pick === 7) {
      role = 'warrior';
      bldg = forge;
    } else if (foundry) {
      bldg = foundry;
      if (pick < 4) role = 'lancer';
      else if (pick < 6) role = 'archer';
      else role = 'monk';
    } else {
      return;
    }

    if (bldg && bldg.queue.length < 2) RTS.train(s, bldg, role);
  }

  function launchWave(s) {
    var pcore = RTS.playerCore(s);
    if (!pcore) return;
    var army = enemyUnits(s).filter(function (u) { return u.role !== 'pawn'; });

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
