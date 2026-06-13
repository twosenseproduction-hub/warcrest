/* ============================================================================
 * EXOFRONT — unit-ai.js
 * Per-unit command state, WC3-style acquisition/chase/return, target scoring,
 * and worker retaliation. Keeps combat logic explainable and config-driven.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TEAM = RTS.TEAM;

  function dist(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function roleCfg(u) {
    var combat = RTS.Config.combat || {};
    var roles = combat.roles || {};
    return roles[u.role] || roles.default || {};
  }

  function initUnitAIState(u) {
    if (u._aiInit) return;
    u._aiInit = true;
    var rc = roleCfg(u);
    u.acquireRange = u.acquireRange || (u.range * (rc.acquireMul || 1.5));
    u.chaseRange = u.chaseRange || (rc.chaseRange || 200);
    if (!u.guardOrigin) u.guardOrigin = { x: u.x, y: u.y };
    if (!u.commandMode) u.commandMode = 'idle';
  }

  function syncLegacyCommand(u) {
    if (u.attackMove) {
      u.commandMode = 'attackMove';
      if (u.moveTo) u.commandTargetPos = { x: u.moveTo.x, y: u.moveTo.y };
    } else if (u.moveTo) {
      u.commandMode = 'move';
      u.commandTargetPos = { x: u.moveTo.x, y: u.moveTo.y };
    } else if (u.target && u.commandMode !== 'retaliate') {
      u.commandMode = 'attack';
    } else if (u.harvest) {
      u.commandMode = 'harvest';
    } else if (u.buildTask) {
      u.commandMode = 'build';
    } else if (!u.target && !u.moveTo && !u.attackMove && u.commandMode === 'attackMove') {
      u.commandMode = 'idle';
    }
    if (!u.guardOrigin) u.guardOrigin = { x: u.x, y: u.y };
  }

  function setCommand(u, mode, opts) {
    opts = opts || {};
    u.commandMode = mode;
    u.commandTargetPos = opts.pos ? { x: opts.pos.x, y: opts.pos.y } : null;
    u.guardOrigin = opts.guardOrigin
      ? { x: opts.guardOrigin.x, y: opts.guardOrigin.y }
      : { x: u.x, y: u.y };
    u.resumeMode = opts.resumeMode || null;
    u.resumeTargetPos = opts.resumePos ? { x: opts.resumePos.x, y: opts.resumePos.y } : null;

    u.attackMove = mode === 'attackMove';
    u.moveTo = (mode === 'move' || mode === 'attackMove') && u.commandTargetPos
      ? { x: u.commandTargetPos.x, y: u.commandTargetPos.y }
      : null;
    if (mode === 'hold' || mode === 'guard') {
      u.moveTo = null;
      u.attackMove = false;
    }
    if (mode === 'idle' || mode === 'hold') {
      u.target = null;
      u.attackMove = false;
      u.moveTo = null;
    }
  }

  function canAttackBuilding(b) {
    return RTS.buildingIsAttackable(b);
  }

  function targetValid(target) {
    return RTS.canBeAttacked(target);
  }

  function acquireRadius(u) {
    var rc = roleCfg(u);
    var combat = RTS.Config.combat || {};
    if (u.commandMode === 'attackMove') {
      return u.range * (combat.attentionAttackMove || 2.0);
    }
    if (u.commandMode === 'guard' || u.commandMode === 'hold') {
      return u.acquireRange || u.range * (rc.acquireMul || 1.5);
    }
    if (u.team === TEAM.ENEMY && u.role !== 'pawn') {
      return u.acquireRange || u.range * (rc.acquireMul || 1.8);
    }
    return u.range * (combat.attentionIdle || 1.55);
  }

  function unitCanAutoAcquire(s, u) {
    if (u.heal > 0 || u.role === 'monk') return false;
    if (u.commandMode === 'attackMove') return true;
    if (u.commandMode === 'guard' || u.commandMode === 'hold') return true;
    if (u.commandMode === 'retaliate') return true;
    if (u.team === TEAM.ENEMY && u.role !== 'pawn') return true;
    if (u.commandMode === 'move') return false;
    if (u.commandMode === 'harvest' || u.commandMode === 'build') return false;
    if (!u.moveTo && u.commandMode === 'idle') return true;
    return false;
  }

  function shouldDropTargetForChase(s, u, target) {
    if (!target || !u.guardOrigin) return false;
    var origin = u.guardOrigin;
    var pull = dist(origin.x, origin.y, target.x, target.y);
    var chase = u.chaseRange || roleCfg(u).chaseRange || 200;
    if (u.commandMode === 'attackMove' && u.commandTargetPos) {
      var combat = RTS.Config.combat || {};
      var tr = target.radius || Math.max(target.w || 0, target.h || 0) / 2;
      var chaseMul = combat.attentionChase || 2.1;
      if (dist(u.x, u.y, target.x, target.y) > u.range * chaseMul + tr) return true;
      return false;
    }
    if (u.commandMode === 'retaliate') {
      var pawnCfg = (RTS.Config.combat && RTS.Config.combat.pawn) || {};
      return pull > (pawnCfg.retaliateChase || 72);
    }
    if (u.commandMode === 'guard' || u.commandMode === 'hold') {
      return dist(u.x, u.y, origin.x, origin.y) > chase;
    }
    if (u.team === TEAM.ENEMY) {
      return pull > chase * 1.35;
    }
    return false;
  }

  function scoreTarget(s, u, candidate, origin) {
    var score = 0;
    var d = dist(u.x, u.y, candidate.x, candidate.y);
    score -= d * 0.04;

    if (candidate.kind === 'unit') {
      if (candidate.target === u.id || candidate.lastThreatId === u.id) score += 80;
      if (candidate.hp < candidate.maxHp * 0.35) score += 28;
      if (candidate.role === 'archer' || candidate.role === 'monk') score += 18;
    }

    if (candidate.kind === 'building') {
      if (!candidate.built) score += 42;
      var spec = RTS.Buildings[candidate.type];
      if (spec && spec.trains && spec.trains.length) score += 30;
      if (candidate.type === 'conduit') score += 14;
      if (candidate.type === 'core') score += 8;
    }

    if (origin) {
      var pull = dist(origin.x, origin.y, candidate.x, candidate.y);
      var chase = u.chaseRange || 200;
      if (pull > chase * 0.85) score -= (pull - chase) * 0.12;
    }

    if (u.commandMode === 'attackMove' && u.commandTargetPos) {
      var pathPull = dist(u.commandTargetPos.x, u.commandTargetPos.y, candidate.x, candidate.y);
      if (pathPull > 280) score -= pathPull * 0.06;
    }

    return score;
  }

  function collectEnemies(s, u, maxR) {
    var foeTeam = u.team === TEAM.PLAYER ? TEAM.ENEMY : TEAM.PLAYER;
    var list = [];
    var i;
    for (i = 0; i < s.entities.units.length; i++) {
      var eu = s.entities.units[i];
      if (!RTS.canBeAttacked(eu) || eu.team !== foeTeam) continue;
      var du = dist(u.x, u.y, eu.x, eu.y);
      if (du <= maxR) list.push(eu);
    }
    for (i = 0; i < s.entities.buildings.length; i++) {
      var b = s.entities.buildings[i];
      if (b.dead || b.team !== foeTeam) continue;
      if (!canAttackBuilding(b)) continue;
      var db = dist(u.x, u.y, b.x, b.y);
      if (db <= maxR) list.push(b);
    }
    return list;
  }

  function bestEnemyTarget(s, u) {
    var maxR = acquireRadius(u);
    var candidates = collectEnemies(s, u, maxR);
    if (!candidates.length) return null;
    var origin = u.guardOrigin || { x: u.x, y: u.y };
    var best = null, bestScore = -Infinity;
    candidates.forEach(function (c) {
      var sc = scoreTarget(s, u, c, origin);
      if (sc > bestScore) { bestScore = sc; best = c; }
    });
    return best;
  }

  function resumeUnitCommand(s, u) {
    u.target = null;
    if (u.commandMode === 'attackMove' && u.commandTargetPos) {
      u.moveTo = { x: u.commandTargetPos.x, y: u.commandTargetPos.y };
      u.attackMove = true;
      return;
    }
    if (u.commandMode === 'guard' || u.commandMode === 'hold') {
      if (u.guardOrigin) {
        u.moveTo = { x: u.guardOrigin.x, y: u.guardOrigin.y };
      }
      return;
    }
    if (u.commandMode === 'retaliate') {
      if (u.resumeMode === 'harvest' && u._savedHarvest) {
        u.harvest = u._savedHarvest;
        u.commandMode = 'harvest';
        u._savedHarvest = null;
      } else if (u.resumeMode === 'build' && u._savedBuildTask) {
        u.buildTask = u._savedBuildTask;
        u.commandMode = 'build';
        u._savedBuildTask = null;
      } else {
        u.commandMode = u.resumeMode || 'idle';
      }
      u.target = null;
      return;
    }
    if (u.resumeMode === 'move' && u.resumeTargetPos) {
      u.commandMode = 'move';
      u.moveTo = { x: u.resumeTargetPos.x, y: u.resumeTargetPos.y };
    }
  }

  function enterRetaliateMode(s, u, attacker) {
    if (u.role !== 'pawn') return;
    var pawnCfg = (RTS.Config.combat && RTS.Config.combat.pawn) || {};
    if (pawnCfg.retaliate === false) return;
    if (u.commandMode === 'retaliate') {
      u.lastThreatId = attacker.id;
      u._retaliateT = pawnCfg.retaliateDuration || 2.5;
      return;
    }
    u._savedHarvest = u.harvest ? {
      nodeId: u.harvest.nodeId,
      phase: u.harvest.phase,
      carry: u.harvest.carry,
      depositId: u.harvest.depositId,
      depositOwnerId: u.harvest.depositOwnerId,
      slotIndex: u.harvest.slotIndex,
      cycleT: u.harvest.cycleT || 0,
    } : null;
    u._savedBuildTask = u.buildTask ? { buildingId: u.buildTask.buildingId } : null;
    u.resumeMode = u.buildTask ? 'build' : (u.harvest ? 'harvest' : 'idle');
    u.harvest = null;
    u.buildTask = null;
    u.moveTo = null;
    u.commandMode = 'retaliate';
    u.guardOrigin = { x: u.x, y: u.y };
    u.lastThreatId = attacker.id;
    u.target = attacker.id;
    u._retaliateT = pawnCfg.retaliateDuration || 2.5;
    if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
  }

  function tickRetaliate(s, u, dt) {
    u._retaliateT = (u._retaliateT || 0) - dt;
    var threat = u.lastThreatId ? RTS.getById(s, u.lastThreatId) : null;
    if (!threat || threat.dead) {
      resumeUnitCommand(s, u);
      return true;
    }
    var dangerR = ((RTS.Config.combat && RTS.Config.combat.pawn) || {}).dangerRadius || 56;
    if (dist(u.x, u.y, threat.x, threat.y) > dangerR && u._retaliateT <= 0) {
      resumeUnitCommand(s, u);
      return true;
    }
    return false;
  }

  RTS.UnitAI = {
    initUnitAIState: initUnitAIState,
    syncLegacyCommand: syncLegacyCommand,
    setCommand: setCommand,
    canAttackBuilding: canAttackBuilding,
    targetValid: targetValid,
    unitCanAutoAcquire: unitCanAutoAcquire,
    acquireRadius: acquireRadius,
    shouldDropTargetForChase: shouldDropTargetForChase,
    scoreTarget: scoreTarget,
    bestEnemyTarget: bestEnemyTarget,
    resumeUnitCommand: resumeUnitCommand,
    enterRetaliateMode: enterRetaliateMode,

    applyCommandFromOrder: function (u, attackMove, x, y) {
      initUnitAIState(u);
      if (attackMove) {
        setCommand(u, 'attackMove', { pos: { x: x, y: y }, guardOrigin: { x: u.x, y: u.y } });
      } else {
        setCommand(u, 'move', { pos: { x: x, y: y }, guardOrigin: { x: u.x, y: u.y } });
      }
    },

    applyStop: function (u) {
      initUnitAIState(u);
      setCommand(u, 'idle');
    },

    applyAttack: function (u, targetId) {
      initUnitAIState(u);
      u.commandMode = 'attack';
      u.target = targetId;
      u.attackMove = false;
      u.moveTo = null;
    },

    onDamaged: function (s, u, attacker) {
      if (!attacker || attacker.dead || attacker.team === u.team) return;
      initUnitAIState(u);
      u.lastThreatId = attacker.id;
      if (u.role === 'pawn' && (u.harvest || u.buildTask)) {
        enterRetaliateMode(s, u, attacker);
      } else if (u.team === TEAM.ENEMY && !u.target && u.role !== 'pawn') {
        u.target = attacker.id;
      }
    },

    resolveCombatTarget: function (s, u) {
      initUnitAIState(u);
      syncLegacyCommand(u);

      var target = u.target ? RTS.getById(s, u.target) : null;
      if (target && !targetValid(target)) {
        u.target = null;
        target = null;
      }

      if (target && shouldDropTargetForChase(s, u, target)) {
        u.target = null;
        target = null;
        resumeUnitCommand(s, u);
      }

      if (!target && unitCanAutoAcquire(s, u)) {
        var foe = bestEnemyTarget(s, u);
        if (foe) {
          u.target = foe.id;
          target = foe;
        }
      }

      return target;
    },

    pawnRetaliateActive: function (u) {
      return u.role === 'pawn' && u.commandMode === 'retaliate';
    },

    tickPawnRetaliate: tickRetaliate,
  };

  RTS.canAttackBuilding = canAttackBuilding;

})(window.RTS = window.RTS || {});
