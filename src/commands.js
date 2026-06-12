/* ============================================================================
 * EXOFRONT — commands.js
 * Selection + issuing orders (move / attack / harvest / stop / build / train).
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  function dist(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
  RTS.dist = dist;

  // ---- Selection -----------------------------------------------------------
  RTS.select = function (s, id, additive) {
    if (!additive) { s.selectedIds = []; RTS.clearMacroGroups(s); }
    if (id && s.selectedIds.indexOf(id) < 0) s.selectedIds.push(id);
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
  };

  RTS.toggleSelect = function (s, id) {
    var i = s.selectedIds.indexOf(id);
    if (i >= 0) s.selectedIds.splice(i, 1); else s.selectedIds.push(id);
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
  };

  RTS.clearSelection = function (s) {
    s.selectedIds = [];
    s.attackMoveArmed = false;
    s.inputMode = 'select';
    s.ui.selectionFilter = 'all';
    RTS.clearMacroGroups(s);
    if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
    RTS.HUD.sync(s);
  };

  var MACRO_ROLE_ORDER = ['pawn', 'lancer', 'archer', 'monk', 'warrior'];

  RTS.clearMacroGroups = function (s) {
    s.ui.macroGroups = null;
    s.ui.macroRole = null;
    s.ui.selectionFilter = 'all';
  };

  function livingPlayerUnit(s, id) {
    var u = RTS.getById(s, id);
    return u && u.kind === 'unit' && u.team === RTS.TEAM.PLAYER && !u.dead ? u : null;
  }

  function pruneMacroGroups(s) {
    if (!s.ui.macroGroups) return;
    var roles = Object.keys(s.ui.macroGroups);
    roles.forEach(function (role) {
      s.ui.macroGroups[role] = s.ui.macroGroups[role].filter(function (id) {
        return !!livingPlayerUnit(s, id);
      });
      if (!s.ui.macroGroups[role].length) delete s.ui.macroGroups[role];
    });
    if (Object.keys(s.ui.macroGroups).length < 2) RTS.clearMacroGroups(s);
  }

  RTS.updateMacroGroups = function (s) {
    pruneMacroGroups(s);
    var units = RTS.selectedUnits(s);
    var map = {};
    units.forEach(function (u) {
      if (!map[u.role]) map[u.role] = [];
      map[u.role].push(u.id);
    });
    var roles = Object.keys(map);
    if (roles.length >= 2) {
      s.ui.macroGroups = map;
      s.ui.macroRole = null;
      s.ui.selectionFilter = 'all';
      return;
    }
    if (!units.length) {
      RTS.clearMacroGroups(s);
      return;
    }
    if (roles.length === 1 && s.ui.macroGroups) {
      s.ui.macroRole = roles[0];
      s.ui.selectionFilter = roles[0];
      return;
    }
    if (!s.ui.macroGroups) RTS.clearMacroGroups(s);
  };

  RTS.macroGroupRoles = function (s) {
    if (!s.ui.macroGroups) return [];
    return MACRO_ROLE_ORDER.filter(function (role) {
      return s.ui.macroGroups[role] && s.ui.macroGroups[role].length;
    });
  };

  RTS.selectMacroGroup = function (s, role) {
    if (!s.ui.macroGroups || !s.ui.macroGroups[role] || !s.ui.macroGroups[role].length) return false;
    s.ui.macroRole = role;
    s.ui.selectionFilter = role;
    if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
    return true;
  };

  RTS.selectMacroAll = function (s) {
    if (!s.ui.macroGroups) return false;
    s.ui.macroRole = null;
    s.ui.selectionFilter = 'all';
    if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
    return true;
  };

  RTS.selectAllUnits = function (s) {
    RTS.clearMacroGroups(s);
    s.selectedIds = s.entities.units
      .filter(function (u) { return u.team === RTS.TEAM.PLAYER && !u.dead; })
      .map(function (u) { return u.id; });
    if (!s.selectedIds.length) return false;
    if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
    return true;
  };

  RTS.selectBox = function (s, x1, y1, x2, y2, additive) {
    var minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    var minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    if (maxX - minX < 10 && maxY - minY < 10) return false;
    if (!additive) { s.selectedIds = []; RTS.clearMacroGroups(s); }
    var got = 0;
    s.entities.units.forEach(function (u) {
      if (u.dead || u.team !== RTS.TEAM.PLAYER) return;
      if (u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY) {
        if (s.selectedIds.indexOf(u.id) < 0) { s.selectedIds.push(u.id); got++; }
      }
    });
    if (got) RTS.log(s, got + ' selected', 'info');
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
    return got > 0;
  };

  RTS.selectAllArmy = function (s) {
    s.ui.macroRole = null;
    s.ui.selectionFilter = 'all';
    s.selectedIds = s.entities.units
      .filter(function (u) { return u.team === RTS.TEAM.PLAYER && !u.dead && u.role !== 'pawn'; })
      .map(function (u) { return u.id; });
    if (!s.selectedIds.length) {
      var w = s.entities.units.find(function (u) { return u.team === RTS.TEAM.PLAYER && !u.dead; });
      if (w) s.selectedIds = [w.id];
    }
    if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
    if (RTS.Audio) RTS.Audio.play('ready');
  };

  RTS.selectAllWorkers = function (s) {
    RTS.clearMacroGroups(s);
    s.selectedIds = s.entities.units
      .filter(function (u) { return u.team === RTS.TEAM.PLAYER && !u.dead && u.role === 'pawn'; })
      .map(function (u) { return u.id; });
    if (!s.selectedIds.length) {
      if (RTS.toast) RTS.toast(s, 'No Pawns');
      if (RTS.Audio) RTS.Audio.play('deny');
      return false;
    }
    if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
    return true;
  };

  RTS.nearestWorker = function (s, x, y) {
    var best = null, bd = Infinity;
    s.entities.units.forEach(function (u) {
      if (u.dead || u.team !== RTS.TEAM.PLAYER || u.role !== 'pawn') return;
      var d = dist(x, y, u.x, u.y);
      if (d < bd) { bd = d; best = u; }
    });
    return best;
  };

  RTS.selectedUnits = function (s) {
    return s.selectedIds.map(function (id) { return RTS.getById(s, id); })
      .filter(function (e) { return e && e.kind === 'unit' && e.team === RTS.TEAM.PLAYER && !e.dead; });
  };

  /** Bottom-bar subgroup filter — 'all' or a unit role. */
  RTS.selectionFilter = function (s) {
    return s.ui.selectionFilter || s.ui.macroRole || 'all';
  };

  /** Units that receive move/attack/stop commands (respects subgroup refinement). */
  RTS.activeSelectedUnits = function (s) {
    var units = RTS.selectedUnits(s);
    var filter = RTS.selectionFilter(s);
    if (filter === 'all' || !s.ui.macroGroups) return units;
    return units.filter(function (u) { return u.role === filter; });
  };

  RTS.activeCombatUnits = function (s) {
    return RTS.activeSelectedUnits(s).filter(function (u) { return u.role !== 'pawn'; });
  };

  RTS.activeWorkers = function (s) {
    return RTS.activeSelectedUnits(s).filter(function (u) { return u.role === 'pawn'; });
  };

  RTS.selectedEntities = function (s) {
    return s.selectedIds.map(function (id) { return RTS.getById(s, id); })
      .filter(function (e) { return e && !e.dead; });
  };

  RTS.selectedBuildings = function (s) {
    return s.selectedIds.map(function (id) { return RTS.getById(s, id); })
      .filter(function (e) { return e && e.kind === 'building' && e.team === RTS.TEAM.PLAYER && !e.dead; });
  };

  RTS.refreshMode = function (s) {
    var combat = RTS.activeCombatUnits(s);
    if (s.attackMoveArmed && combat.length) s.inputMode = 'attack-target';
    else if (RTS.selectedUnits(s).length) s.inputMode = 'select';
    else s.inputMode = 'select';
    RTS.updateMacroGroups(s);
  };

  RTS.isProductionBuilding = function (b) {
    var spec = RTS.Buildings[b.type];
    return !!(spec && spec.trains && spec.trains.length);
  };

  RTS.isDepositBuilding = function (b) {
    return !!b && !b.dead && b.built && (b.type === 'core' || b.type === 'outpost');
  };

  RTS.setRallyPoint = function (s, buildings, x, y) {
    var set = false;
    buildings.forEach(function (b) {
      if (!b.built || !RTS.isProductionBuilding(b)) return;
      b.rally = { x: x, y: y };
      set = true;
    });
    if (set) RTS.HUD.sync(s);
    return set;
  };

  RTS.nearestNodeForBuilding = function (s, b) {
    return RTS.nodeForDeposit(s, b);
  };

  RTS.inferLocalNodeForDeposit = function (s, b) {
    if (!b) return null;
    if (b.type === 'core') return RTS.findHomeNodeForCore(s, b);
    if (b.type !== 'outpost') return null;
    var spec = RTS.Buildings.outpost;
    var pad = Math.max(spec.w, spec.h) / 2 + 12;
    var best = null, bd = Infinity;
    s.entities.resources.forEach(function (n) {
      if (n.amount <= 0) return;
      var ringD = dist(b.x, b.y, n.x, n.y);
      if (ringD < n.r + pad || ringD > n.r + 210) return;
      if (ringD < bd) { bd = ringD; best = n; }
    });
    if (best) return best;
    return RTS.findHomeNodeForCore(s, b);
  };

  RTS.nodeForDeposit = function (s, b) {
    if (!b || !RTS.isDepositBuilding(b)) return null;
    if (b.primaryNodeId) {
      var linked = RTS.getById(s, b.primaryNodeId);
      if (linked && linked.kind === 'resource' && linked.amount > 0) return linked;
      if (linked) return null;
    }
    var inferred = RTS.inferLocalNodeForDeposit(s, b);
    if (inferred) {
      RTS.assignPrimaryNodeToDeposit(s, b, inferred);
      return inferred;
    }
    return null;
  };

  RTS.depositHasLiveNode = function (s, b) {
    return !!RTS.nodeForDeposit(s, b);
  };

  RTS.assignPrimaryNodeToDeposit = function (s, b, node) {
    if (!b || !node) return false;
    b.primaryNodeId = node.id;
    b._veinLowNotified = false;
    b._veinDepletedNotified = false;
    return true;
  };

  RTS.findHomeNodeForCore = function (s, b) {
    var R = RTS.Config.mineAmounts.startRadius;
    var best = null, bd = Infinity;
    s.entities.resources.forEach(function (n) {
      if (n.amount <= 0) return;
      var d = dist(b.x, b.y, n.x, n.y);
      if (d <= R && d < bd) { bd = d; best = n; }
    });
    if (best) return best;
    s.entities.resources.forEach(function (n) {
      if (n.amount <= 0) return;
      var d2 = dist(b.x, b.y, n.x, n.y);
      if (d2 < bd) { bd = d2; best = n; }
    });
    return best;
  };

  RTS.linkDepositHomeNodes = function (s) {
    s.entities.buildings.forEach(function (b) {
      if (b.dead || b.type !== 'core' || b.primaryNodeId) return;
      var node = RTS.findHomeNodeForCore(s, b);
      if (node) RTS.assignPrimaryNodeToDeposit(s, b, node);
    });
  };

  // ---- Normalized unit commands (legacy fields kept in sync) ---------------
  function applyUnitCommand(u, mode, payload) {
    payload = payload || {};
    u.commandMode = mode === 'assistBuild' ? 'build' : mode;
    u.commandTargetId = payload.targetId || null;
    u.commandTargetPos = payload.pos ? { x: payload.pos.x, y: payload.pos.y } : null;
    u.taskPayload = payload.task || null;
    if (payload.guardOrigin) u.guardOrigin = { x: payload.guardOrigin.x, y: payload.guardOrigin.y };

    u.moveTo = null;
    u.target = null;
    u.attackMove = false;
    u.harvest = null;
    u.buildTask = null;

    switch (mode) {
      case 'move':
        if (payload.pos) u.moveTo = { x: payload.pos.x, y: payload.pos.y };
        break;
      case 'attackMove':
        u.attackMove = true;
        if (payload.pos) u.moveTo = { x: payload.pos.x, y: payload.pos.y };
        break;
      case 'attackTarget':
        u.target = payload.targetId || null;
        break;
      case 'harvest':
        u.harvest = payload.harvest || null;
        break;
      case 'assistBuild':
        u.buildTask = payload.buildTask || null;
        if (payload.carryHarvest) u.harvest = payload.carryHarvest;
        break;
      case 'idle':
        break;
    }

    if (RTS.UnitAI) {
      if (mode === 'move' || mode === 'attackMove') {
        RTS.UnitAI.applyCommandFromOrder(u, mode === 'attackMove', payload.pos.x, payload.pos.y);
      } else if (mode === 'attackTarget') {
        RTS.UnitAI.applyAttack(u, payload.targetId);
      } else if (mode === 'idle') {
        RTS.UnitAI.applyStop(u);
      }
    }
  }
  RTS.applyUnitCommand = applyUnitCommand;

  // ---- Orders --------------------------------------------------------------
  RTS.orderMove = function (s, units, x, y, attackMove) {
    var n = units.length, idx = 0;
    var mode = attackMove ? 'attackMove' : 'move';
    units.forEach(function (u) {
      var off = spread(idx++, n);
      var tx = x + off.x, ty = y + off.y;
      applyUnitCommand(u, mode, { pos: { x: tx, y: ty }, guardOrigin: { x: u.x, y: u.y } });
      if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
    });
    if (attackMove) RTS.Audio.play('attack');
    else RTS.Audio.play('move');
  };

  RTS.orderAttack = function (s, units, targetId) {
    var target = RTS.getById(s, targetId);
    var attackable = RTS.canAttackBuilding
      ? RTS.canAttackBuilding(target)
      : RTS.buildingIsAttackable(target);
    if (target && target.kind === 'building' && !attackable) {
      return;
    }
    units.forEach(function (u) {
      applyUnitCommand(u, 'attackTarget', { targetId: targetId, guardOrigin: { x: u.x, y: u.y } });
      if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
    });
    RTS.Audio.play('attack');
  };

  RTS.orderStop = function (s, units) {
    units.forEach(function (u) {
      applyUnitCommand(u, 'idle');
      if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
      u.vx = 0; u.vy = 0;
    });
  };

  RTS.orderHarvest = function (s, worker, nodeId, opts) {
    opts = opts || {};
    if (worker.role !== 'pawn') return;
    var carry = worker.harvest && worker.harvest.carry > 0 ? worker.harvest.carry : 0;
    var depositId = carry > 0 && worker.harvest ? worker.harvest.depositId : null;
    var node = RTS.getById(s, nodeId);
    var slot = null;
    var phase = 'toNode';
    var targetNodeId = nodeId;

    if (carry > 0) {
      phase = 'toBase';
      targetNodeId = worker.harvest.nodeId || nodeId;
    } else if (node && RTS.Harvest && !opts.depositOwnerId) {
      if (RTS.Harvest.nodeAssignedWorkerCount(s, nodeId) >= RTS.Config.harvest.maxWorkersPerNode &&
          !RTS.Harvest.nodeHasOpenSlot(s, nodeId)) {
        var alt = RTS.Harvest.bestNodeForWorker(s, worker, worker.x, worker.y, { preferId: nodeId });
        if (alt) { node = alt; targetNodeId = alt.id; }
      }
      slot = RTS.Harvest.bestHarvestSlot(s, node, worker);
    } else if (node && RTS.Harvest) {
      slot = RTS.Harvest.bestHarvestSlot(s, node, worker);
    }

    applyUnitCommand(worker, 'harvest', {
      harvest: {
        nodeId: targetNodeId,
        phase: phase,
        carry: carry,
        slotIndex: slot,
        cycleT: 0,
        depositId: depositId,
        depositOwnerId: opts.depositOwnerId || null,
      },
    });
    if (phase === 'toBase' && !depositId) {
      var ownerDep = opts.depositOwnerId ? RTS.getById(s, opts.depositOwnerId) : null;
      if (ownerDep && RTS.isDepositBuilding && RTS.isDepositBuilding(ownerDep)) {
        worker.harvest.depositId = ownerDep.id;
      } else {
        var deps = RTS.deposits(s, worker.team);
        var bestDep = null, bd = Infinity;
        deps.forEach(function (b) {
          var d = dist(worker.x, worker.y, b.x, b.y);
          if (d < bd) { bd = d; bestDep = b; }
        });
        worker.harvest.depositId = bestDep ? bestDep.id : null;
      }
    }
    if (RTS.Pathfind) RTS.Pathfind.clearNav(worker);
  };

  function spread(i, n) {
    if (n <= 1) return { x: 0, y: 0 };
    var perRow = Math.ceil(Math.sqrt(n));
    var gap = 30;
    var col = i % perRow, row = Math.floor(i / perRow);
    return { x: (col - perRow / 2) * gap, y: (row - perRow / 2) * gap };
  }

  // ---- Economy helpers -----------------------------------------------------
  RTS.canAfford = function (s, team, cost) { return s.res[team].halcite >= cost; };
  RTS.hasSupply = function (s, team, n) {
    return s.res[team].supplyUsed + n <= s.res[team].supplyCap;
  };

  // ---- Training ------------------------------------------------------------
  RTS.train = function (s, building, role) {
    var team = building.team;
    var spec = RTS.Units[role];
    if (!building.built) { if (team === RTS.TEAM.PLAYER) RTS.toast(s, 'Building not finished'); return false; }
    if (!RTS.canAfford(s, team, spec.cost)) {
      if (team === RTS.TEAM.PLAYER) { RTS.toast(s, 'Not enough Halcite'); RTS.log(s, 'Not enough Halcite', 'warn'); RTS.Audio.play('deny'); }
      return false;
    }
    if (!RTS.hasSupply(s, team, spec.supply)) {
      if (team === RTS.TEAM.PLAYER) { RTS.toast(s, 'Supply cap reached — build a House'); RTS.log(s, 'Supply blocked', 'warn'); RTS.Audio.play('deny'); }
      return false;
    }
    s.res[team].halcite -= spec.cost;
    var trainTime = baseTrain(role);
    building.queue.push({ role: role, remaining: trainTime, total: trainTime });
    if (!building.train) building.train = building.queue[0];
    if (team === RTS.TEAM.PLAYER) {
      RTS.Audio.play('click');
      RTS.HUD.sync(s);
    }
    return true;
  };

  function baseTrain(role) {
    switch (role) {
      case 'pawn': return 7;
      case 'lancer': return 8;
      case 'archer': return 9;
      case 'monk': return 12;
      case 'warrior': return 16;
      default: return 10;
    }
  }
  RTS.baseTrain = baseTrain;

  function pawnCarryAmount(u) {
    return u.harvest && u.harvest.carry > 0 ? u.harvest.carry : 0;
  }

  RTS.resumeCarryAfterBuild = function (u, s) {
    if (!u.harvest || u.harvest.carry <= 0) return;
    u.harvest.phase = 'toBase';
    u.harvest.nodeId = null;
    u.harvest.depositId = null;
    if (RTS.Harvest && RTS.Harvest.assignReturnDeposit) {
      RTS.Harvest.assignReturnDeposit(s, u);
    } else {
      var deps = RTS.deposits(s, u.team);
      var best = null, bd = Infinity;
      deps.forEach(function (b) {
        var d = dist(u.x, u.y, b.x, b.y);
        if (d < bd) { bd = d; best = b; }
      });
      u.harvest.depositId = best ? best.id : null;
    }
  };

  RTS.redirectPawnToBuild = function (s, u, b) {
    if (!u || !b || u.dead || u.role !== 'pawn') return;
    s.entities.buildings.forEach(function (ob) {
      if (ob.builderId === u.id && ob.id !== b.id) ob.builderId = null;
    });
    var carry = pawnCarryAmount(u);
    applyUnitCommand(u, 'assistBuild', {
      buildTask: { buildingId: b.id },
      carryHarvest: carry > 0
        ? { nodeId: null, phase: 'toBase', carry: carry, depositId: null }
        : null,
    });
    u._workPhase = 0;
    u._builderOnSite = false;
    b.builderId = u.id;
    if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
  };

  // ---- Building placement --------------------------------------------------
  RTS.orderBuild = function (s, building, workers) {
    if (!building || building.dead || building.built || building.team !== RTS.TEAM.PLAYER) {
      return false;
    }
    workers = (workers || []).filter(function (u) {
      return u && !u.dead && u.role === 'pawn' && u.team === RTS.TEAM.PLAYER;
    });
    var w = null;
    if (workers.length) {
      workers.sort(function (a, c) {
        return dist(a.x, a.y, building.x, building.y) - dist(c.x, c.y, building.x, building.y);
      });
      w = workers[0];
      RTS.redirectPawnToBuild(s, w, building);
    } else {
      w = RTS.assignBuilder(s, building);
    }
    if (!w) {
      if (building.team === RTS.TEAM.PLAYER) {
        RTS.toast(s, 'No Pawn available to build');
        RTS.Audio.play('deny');
      }
      return false;
    }
    if (building.team === RTS.TEAM.PLAYER) {
      RTS.log(s, 'Pawn sent to build', 'good');
      RTS.Audio.play('move');
      RTS.HUD.sync(s);
    }
    return true;
  };

  RTS.assignBuilder = function (s, b, preferredWorker) {
    if (!b || b.dead || b.built) return null;
    var team = b.team;
    var workers = s.entities.units.filter(function (u) {
      return u.team === team && u.role === 'pawn' && !u.dead;
    });
    if (!workers.length) return null;
    var w = preferredWorker;
    if (!w || workers.indexOf(w) < 0) {
      workers.sort(function (a, c) {
        return dist(a.x, a.y, b.x, b.y) - dist(c.x, c.y, b.x, b.y);
      });
      w = workers[0];
    }
    RTS.redirectPawnToBuild(s, w, b);
    return w;
  };

  RTS.beginPlacement = function (s, type) {
    if (!RTS.canAfford(s, RTS.TEAM.PLAYER, RTS.Buildings[type].cost)) {
      RTS.toast(s, 'Not enough Halcite'); RTS.Audio.play('deny'); return;
    }
    if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
    s.ui.buildPanelOpen = false;
    s.pending.building = type;
    s.inputMode = 'place-building';
    var hint = type === 'outpost'
      ? 'Tap a glowing ring near Halcite to raise an Outpost'
      : type === 'turret'
        ? 'Tap open land to place a Tower'
        : 'Tap a highlighted spot to build ' + RTS.nameFor(s.playerFaction, type);
    RTS.toast(s, hint);
    RTS.HUD.sync(s);
  };

  RTS.cancelPlacement = function (s) {
    s.pending.building = null;
    s.inputMode = 'select';
    RTS.HUD.sync(s);
  };

  function nearResourceRing(s, x, y, hw, hh) {
    var pad = Math.max(hw, hh) + 12;
    for (var i = 0; i < s.entities.resources.length; i++) {
      var n = s.entities.resources[i];
      if (n.amount <= 500) continue;
      var d = RTS.dist(x, y, n.x, n.y);
      if (d >= n.r + pad && d <= n.r + 210) return n;
    }
    return null;
  }

  function nearFriendlyHQ(s, x, y, minDist) {
    return s.entities.buildings.some(function (b) {
      if (b.dead || b.team !== RTS.TEAM.PLAYER) return false;
      if (b.type !== 'core' && b.type !== 'outpost') return false;
      return RTS.dist(x, y, b.x, b.y) < minDist;
    });
  }

  function footprintOnLand(s, x, y, hw, hh) {
    var grid = s.map && s.map.terrainGrid;
    if (!grid || !RTS.Terrain) return true;
    var pts = [
      { x: x, y: y },
      { x: x - hw * 0.8, y: y - hh * 0.7 },
      { x: x + hw * 0.8, y: y - hh * 0.7 },
      { x: x - hw * 0.8, y: y + hh * 0.5 },
      { x: x + hw * 0.8, y: y + hh * 0.5 },
    ];
    for (var i = 0; i < pts.length; i++) {
      if (RTS.Terrain.isWater(grid, pts[i].x, pts[i].y)) return false;
    }
    return true;
  }

  function footprintClearOfDecor(s, x, y, hw, hh) {
    if (!s.map || !s.map.decor) return true;
    var pad = 6;
    var reach = Math.max(hw, hh) * 0.65 + pad;
    for (var i = 0; i < s.map.decor.length; i++) {
      var d = s.map.decor[i];
      if (d.kind === 'bush') continue;
      if (RTS.dist(x, y, d.x, d.y) < d.r + reach) return false;
    }
    return true;
  }

  RTS.canPlaceAt = function (s, type, x, y) {
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

    if (type === 'outpost') {
      if (!nearResourceRing(s, x, y, hw, hh)) return false;
      if (nearFriendlyHQ(s, x, y, 340)) return false;
      return true;
    }

    if (type === 'turret') {
      if (!footprintOnLand(s, x, y, hw, hh)) return false;
      if (!footprintClearOfDecor(s, x, y, hw, hh)) return false;
      return true;
    }

    var near = s.entities.buildings.some(function (b) {
      return b.team === RTS.TEAM.PLAYER && !b.dead && RTS.dist(x, y, b.x, b.y) < 360;
    });
    return near;
  };

  RTS.placeBuilding = function (s, type, x, y) {
    if (!RTS.canPlaceAt(s, type, x, y)) {
      var denyMsg = type === 'outpost'
        ? 'Build in the ring beside Halcite, away from other Castles'
        : type === 'turret'
          ? 'Tower needs open land — not water or trees'
          : 'Invalid location';
      RTS.toast(s, denyMsg);
      RTS.Audio.play('deny'); return false;
    }
    if (!RTS.canAfford(s, RTS.TEAM.PLAYER, RTS.Buildings[type].cost)) { RTS.toast(s, 'Not enough Halcite'); RTS.Audio.play('deny'); return false; }
    s.res.player.halcite -= RTS.Buildings[type].cost;
    var b = RTS.makeBuilding(s, type, RTS.TEAM.PLAYER, x, y, s.playerFaction, false);
    if (RTS.Pathfind) RTS.Pathfind.markDirty(s);
    if (type === 'outpost') {
      var ringNode = nearResourceRing(s, x, y, RTS.Buildings[type].w / 2, RTS.Buildings[type].h / 2);
      if (ringNode) {
        b.rally = { x: ringNode.x, y: ringNode.y };
        b.autoMine = true;
        RTS.assignPrimaryNodeToDeposit(s, b, ringNode);
      } else {
        b.rally = { x: x + 90, y: y };
      }
    }
    if (!RTS.assignBuilder(s, b)) {
      RTS.toast(s, 'No Pawn available to build');
    }
    RTS.log(s, RTS.nameFor(s.playerFaction, type) + ' under construction', 'good');
    if (type === 'outpost') RTS.log(s, 'Outpost raised — secure the Halcite', 'good');
    RTS.Audio.play('build');
    s.pending.building = null;
    s.inputMode = 'select';
    RTS.HUD.sync(s);
    return true;
  };

})(window.RTS = window.RTS || {});
