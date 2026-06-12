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
    RTS.clearMacroGroups(s);
    if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
    RTS.HUD.sync(s);
  };

  var MACRO_ROLE_ORDER = ['pawn', 'lancer', 'archer', 'monk', 'warrior'];

  RTS.clearMacroGroups = function (s) {
    s.ui.macroGroups = null;
    s.ui.macroRole = null;
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
      return;
    }
    if (!units.length) {
      RTS.clearMacroGroups(s);
      return;
    }
    if (roles.length === 1 && s.ui.macroGroups) {
      s.ui.macroRole = roles[0];
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
    s.selectedIds = s.ui.macroGroups[role].slice();
    s.ui.macroRole = role;
    if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
    return true;
  };

  RTS.selectMacroAll = function (s) {
    if (!s.ui.macroGroups) return false;
    var ids = [];
    RTS.macroGroupRoles(s).forEach(function (role) {
      ids = ids.concat(s.ui.macroGroups[role]);
    });
    if (!ids.length) return false;
    s.selectedIds = ids;
    s.ui.macroRole = null;
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
    RTS.clearMacroGroups(s);
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
  RTS.selectedBuildings = function (s) {
    return s.selectedIds.map(function (id) { return RTS.getById(s, id); })
      .filter(function (e) { return e && e.kind === 'building' && e.team === RTS.TEAM.PLAYER && !e.dead; });
  };

  RTS.refreshMode = function (s) {
    var combat = RTS.selectedUnits(s).filter(function (u) { return u.role !== 'pawn'; });
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
    var ax = b.rally ? b.rally.x : b.x;
    var ay = b.rally ? b.rally.y : b.y;
    var best = null, bd = Infinity;
    s.entities.resources.forEach(function (n) {
      if (n.amount <= 300) return;
      var d = dist(ax, ay, n.x, n.y);
      if (d < bd) { bd = d; best = n; }
    });
    return best;
  };

  // ---- Orders --------------------------------------------------------------
  RTS.orderMove = function (s, units, x, y, attackMove) {
    var n = units.length, idx = 0;
    units.forEach(function (u) {
      var off = spread(idx++, n);
      u.moveTo = { x: x + off.x, y: y + off.y };
      u.target = null; u.attackMove = !!attackMove;
      u.harvest = null; u.buildTask = null;
      if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
    });
    if (attackMove) RTS.Audio.play('attack');
    else RTS.Audio.play('move');
  };

  RTS.orderAttack = function (s, units, targetId) {
    var target = RTS.getById(s, targetId);
    if (target && target.kind === 'building' && !RTS.buildingIsAttackable(target)) {
      return;
    }
    units.forEach(function (u) {
      u.target = targetId; u.moveTo = null; u.attackMove = false;
      u.harvest = null; u.buildTask = null;
      if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
    });
    RTS.Audio.play('attack');
  };

  RTS.orderStop = function (s, units) {
    units.forEach(function (u) {
      u.moveTo = null; u.target = null; u.attackMove = false;
      u.harvest = null; u.buildTask = null;
      if (RTS.Pathfind) RTS.Pathfind.clearNav(u); u.vx = 0; u.vy = 0;
    });
  };

  RTS.orderHarvest = function (s, worker, nodeId) {
    if (worker.role !== 'pawn') return;
    worker.harvest = { nodeId: nodeId, phase: 'toNode', carry: 0 };
    worker.moveTo = null; worker.target = null; worker.buildTask = null;
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
    var deps = RTS.deposits(s, u.team);
    var best = null, bd = Infinity;
    deps.forEach(function (b) {
      var d = dist(u.x, u.y, b.x, b.y);
      if (d < bd) { bd = d; best = b; }
    });
    u.harvest.depositId = best ? best.id : null;
  };

  RTS.redirectPawnToBuild = function (s, u, b) {
    if (!u || !b || u.dead || u.role !== 'pawn') return;
    s.entities.buildings.forEach(function (ob) {
      if (ob.builderId === u.id && ob.id !== b.id) ob.builderId = null;
    });
    var carry = pawnCarryAmount(u);
    u.target = null;
    u.moveTo = null;
    u.harvest = carry > 0
      ? { nodeId: null, phase: 'toBase', carry: carry, depositId: null }
      : null;
    u.buildTask = { buildingId: b.id };
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

    var near = s.entities.buildings.some(function (b) {
      return b.team === RTS.TEAM.PLAYER && !b.dead && RTS.dist(x, y, b.x, b.y) < 360;
    });
    return near;
  };

  RTS.placeBuilding = function (s, type, x, y) {
    if (!RTS.canPlaceAt(s, type, x, y)) {
      RTS.toast(s, type === 'outpost' ? 'Build in the ring beside Halcite, away from other Castles' : 'Invalid location');
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
