/* ============================================================================
 * EXOFRONT — systems.js
 * The simulation: movement, targeting, combat, harvesting, construction,
 * production, projectiles, effects, separation, and win/loss detection.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TEAM = RTS.TEAM;
  function dist(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }

  function depositZoneRadius(dep) {
    var reach = RTS.Config.harvest.depositReach;
    var base = Math.max(dep.w, dep.h);
    if (dep.type === 'core') return Math.max(reach, base * 1.65);
    if (dep.type === 'outpost') return Math.max(reach * 0.85, base * 1.5);
    return base * 1.4 + 40;
  }

  function depositRect(dep, s) {
    if (RTS.Assets && RTS.Assets.buildingCollisionRect) {
      return RTS.Assets.buildingCollisionRect(dep, s);
    }
    var hw = dep.w * 0.36, hh = dep.h * 0.28;
    return { l: dep.x - hw, r: dep.x + hw, t: dep.y - hh, b: dep.y + hh * 0.55 };
  }

  function pointNearRect(x, y, rect, pad) {
    return x >= rect.l - pad && x <= rect.r + pad &&
           y >= rect.t - pad && y <= rect.b + pad;
  }

  function depositApproachPoint(u, dep, s) {
    var zoneR = depositZoneRadius(dep);
    var rect = depositRect(dep, s);
    var ax = u.x - dep.x, ay = u.y - dep.y;
    var d = Math.sqrt(ax * ax + ay * ay) || 1;
    var ring = Math.max(zoneR * 0.58, Math.max(dep.w, dep.h) * 0.75);
    var tx = dep.x + (ax / d) * ring;
    var ty = dep.y + (ay / d) * ring;
    var margin = (u.radius || 10) + 14;
    if (pointNearRect(tx, ty, rect, margin)) {
      var cx = Math.max(rect.l, Math.min(tx, rect.r));
      var cy = Math.max(rect.t, Math.min(ty, rect.b));
      var dx = tx - cx, dy = ty - cy;
      var edgeD = Math.sqrt(dx * dx + dy * dy) || 0.01;
      tx = cx + (dx / edgeD) * (margin + 8);
      ty = cy + (dy / edgeD) * (margin + 8);
    }
    return { x: tx, y: ty };
  }

  function canDepositAt(u, dep, s) {
    var carrying = u.harvest && u.harvest.carry > 0;
    var zoneR = depositZoneRadius(dep);
    var dCenter = dist(u.x, u.y, dep.x, dep.y);
    if (dCenter <= zoneR) return true;
    var rect = depositRect(dep, s);
    var pad = carrying ? 96 : 64;
    if (pointNearRect(u.x, u.y, rect, pad)) return true;
    return carrying && dCenter <= zoneR * 1.18;
  }

  function depositInRange(s, u) {
    var deps = RTS.deposits(s, u.team);
    var best = null, bd = Infinity;
    deps.forEach(function (b) {
      if (!canDepositAt(u, b, s)) return;
      var d = dist(u.x, u.y, b.x, b.y);
      if (d < bd) { bd = d; best = b; }
    });
    return best;
  }

  function finishDeposit(s, u, node) {
    var amt = Math.floor(u.harvest.carry);
    if (amt > 0) {
      s.res[u.team].halcite += amt;
      if (u.team === TEAM.PLAYER) { s.stats.harvested += amt; RTS.spawnFloat(s, u.x, u.y - 18, '+' + amt); }
      if (RTS.Audio) RTS.Audio.play('coin');
    }
    u.harvest.carry = 0;
    u.harvest.depositId = null;
    u._depositStuckT = 0;
    u.vx = 0; u.vy = 0;
    u.harvest.phase = node && node.amount > 0 ? 'toNode' : 'findNode';
    if (u.harvest.phase === 'findNode') {
      var nn = nearestNode(s, u.x, u.y);
      if (nn) { u.harvest.nodeId = nn.id; u.harvest.phase = 'toNode'; }
      else u.harvest = null;
    }
    if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
  }

  function tryFinishDeposit(s, u, node) {
    var dep = depositInRange(s, u);
    if (dep) {
      finishDeposit(s, u, node);
      return true;
    }
    return false;
  }

  function assignDepositTarget(s, u) {
    var dep = nearestDeposit(s, u);
    u.harvest.depositId = dep ? dep.id : null;
  }

  RTS.update = function (s, dt) {
    s.timers.gameTime += dt;
    s.screenShake = Math.max(0, s.screenShake - dt * 12);
    s.screenFlash = Math.max(0, s.screenFlash - dt * 1.6);
    s.ui.baseAlarm = Math.max(0, s.ui.baseAlarm - dt);
    if (s.ui.toast) { s.ui.toast.t -= dt; if (s.ui.toast.t <= 0) s.ui.toast = null; }

    var i;
    for (i = 0; i < s.entities.units.length; i++) updateUnit(s, s.entities.units[i], dt);
    for (i = 0; i < s.entities.buildings.length; i++) updateBuilding(s, s.entities.buildings[i], dt);
    updateProjectiles(s, dt);
    updateEffects(s, dt);
    tickAutoMine(s, dt);
    RTS.AI.update(s, dt);

    // cull dead units after corpse fade
    s.entities.units = s.entities.units.filter(function (u) {
      if (!u.dead) return true;
      u.corpse -= dt;
      return u.corpse > 0;
    });
    s.entities.buildings = s.entities.buildings.filter(function (b) { return !b.dead; });
    s.entities.resources = s.entities.resources.filter(function (n) { return n.amount > 0.5; });

    RTS.recalcSupply(s, TEAM.PLAYER);
    checkEndGame(s);
  };

  // ---- Units ---------------------------------------------------------------
  function navMove(s, u, tx, ty, dt, stop, opts) {
    if (RTS.Pathfind) RTS.Pathfind.moveToward(s, u, tx, ty, dt, stop, opts);
    else moveToward(u, tx, ty, dt, stop);
  }

  function updateUnit(s, u, dt) {
    if (u.dead) return;
    u.cooldown = Math.max(0, u.cooldown - dt);
    u.hitFlash = Math.max(0, u.hitFlash - dt);
    u.muzzleFlash = Math.max(0, u.muzzleFlash - dt);
    u.spawnFlash = Math.max(0, u.spawnFlash - dt);

    // Worker behaviours take priority
    if (u.role === 'worker') {
      if (u.buildTask) { doBuildTask(s, u, dt); return; }
      if (u.harvest) { doHarvest(s, u, dt); return; }
    }

    // Healer support
    if (u.heal > 0) { doHeal(s, u, dt); }

    u.inAttackRange = false;

    // Resolve current explicit target
    var target = u.target ? RTS.getById(s, u.target) : null;
    if (target && (target.dead)) { u.target = null; target = null; }

    // Auto-acquire if attack-moving or idle-aggressive
    if (!target && u.role !== 'worker' && u.heal === 0) {
      if (u.attackMove || u.team === TEAM.ENEMY || !u.moveTo) {
        var foe = nearestEnemy(s, u.x, u.y, u.team, u.range * (u.attackMove ? 1.6 : 1.25));
        if (foe) { target = foe; u.target = foe.id; }
      }
    }

    if (target && u.attackMove) {
      var tr0 = target.radius || Math.max(target.w, target.h) / 2;
      if (dist(u.x, u.y, target.x, target.y) > u.range * 1.65 + tr0) {
        u.target = null;
        target = null;
      }
    }

    if (target) {
      var tr = target.radius || Math.max(target.w, target.h) / 2;
      var d = dist(u.x, u.y, target.x, target.y);
      if (d <= u.range + tr * 0.4) {
        u.inAttackRange = true;
        u.vx = 0; u.vy = 0;
        u.facing = Math.atan2(target.y - u.y, target.x - u.x);
        if (u.cooldown <= 0 && u.dmg > 0) {
          u.cooldown = u.rof;
          fire(s, u, target);
        }
      } else {
        navMove(s, u, target.x, target.y, dt, u.range * 0.8 + tr, { chasing: true });
      }
    } else if (u.moveTo) {
      navMove(s, u, u.moveTo.x, u.moveTo.y, dt, 6);
      if (dist(u.x, u.y, u.moveTo.x, u.moveTo.y) < 10) {
        u.moveTo = null;
        if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
      }
    } else {
      u.vx *= 0.8; u.vy *= 0.8;
    }

    finishUnitMove(s, u, dt);
  }

  function fire(s, u, target) {
    u.muzzleFlash = RTS.Config.muzzleFlash;
    if (u.ranged) {
      RTS.makeProjectile(s, u, target, u.dmg, {
        splash: u.splash,
        color: RTS.Factions[u.faction].accent,
        faction: u.faction,
        role: u.role,
      });
      RTS.Audio.play(u.role === 'siege' ? 'boom' : 'shot');
    } else {
      applyDamage(s, target, u.dmg, u);
      RTS.Audio.play('melee');
    }
  }

  function doHeal(s, u, dt) {
    // find most-hurt nearby ally
    var best = null, bestScore = 0;
    s.entities.units.forEach(function (a) {
      if (a.dead || a.team !== u.team || a === u) return;
      if (a.hp >= a.maxHp) return;
      var d = dist(u.x, u.y, a.x, a.y);
      if (d > u.range) return;
      var score = (1 - a.hp / a.maxHp);
      if (score > bestScore) { bestScore = score; best = a; }
    });
    if (best) {
      u.inAttackRange = true;
      u.facing = Math.atan2(best.y - u.y, best.x - u.x);
      if (u.cooldown <= 0) {
        u.cooldown = u.rof;
        best.hp = Math.min(best.maxHp, best.hp + u.heal);
        RTS.addEffect(s, { kind: 'heal', x: best.x, y: best.y, life: 0.3, max: 0.3, color: '#9bffd0' });
      }
    }
  }

  // ---- Harvesting ----------------------------------------------------------
  function doHarvest(s, u, dt) {
    var H = RTS.Config.harvest;
    var node = u.harvest.nodeId ? s.entities.resources.find(function (n) { return n.id === u.harvest.nodeId; }) : null;

    if (u.harvest.phase === 'toNode') {
      if (!node || node.amount <= 0) {
        // find another node
        node = nearestNode(s, u.x, u.y);
        if (!node) { u.harvest = null; return; }
        u.harvest.nodeId = node.id;
      }
      if (dist(u.x, u.y, node.x, node.y) <= node.r + H.reach * 0.4) {
        u.harvest.phase = 'mining';
        u.vx = 0; u.vy = 0;
        u._moveHold = 0;
        u._workPhase = 0;
        u.facing = Math.atan2(node.y - u.y, node.x - u.x);
      }
      else navMove(s, u, node.x, node.y, dt, node.r);
      finishUnitMove(s, u, dt, false);
      return;
    }

    if (u.harvest.phase === 'mining') {
      if (!node || node.amount <= 0) {
        u.harvest.phase = 'toBase';
        assignDepositTarget(s, u);
        return;
      }
      u.facing = Math.atan2(node.y - u.y, node.x - u.x);
      u._workPhase = (u._workPhase || 0) + dt;
      var mined = Math.min(H.rate * dt, node.amount, H.capacity - u.harvest.carry);
      node.amount -= mined; u.harvest.carry += mined;
      if (u.harvest.carry >= H.capacity - 0.01) {
        u.harvest.phase = 'toBase';
        assignDepositTarget(s, u);
      }
      return;
    }

    if (u.harvest.phase === 'toBase') {
      if (tryFinishDeposit(s, u, node)) return;

      var dep = u.harvest.depositId ? RTS.getById(s, u.harvest.depositId) : null;
      if (!dep || dep.dead || !builtDeposit(dep)) {
        assignDepositTarget(s, u);
        dep = u.harvest.depositId ? RTS.getById(s, u.harvest.depositId) : null;
      }
      if (!dep) {
        if (u.harvest.carry > 0) { u._depositStuckT = (u._depositStuckT || 0) + dt; }
        if (u.harvest.carry <= 0) u.harvest.phase = 'findNode';
        return;
      }

      if (u.harvest.carry > 0) {
        if (canDepositAt(u, dep, s)) {
          u._depositStuckT = (u._depositStuckT || 0) + dt;
          if (u._depositStuckT >= RTS.Config.harvest.depositStuckSec) {
            finishDeposit(s, u, node);
            return;
          }
        } else {
          u._depositStuckT = 0;
        }
      }

      var approach = depositApproachPoint(u, dep, s);
      navMove(s, u, approach.x, approach.y, dt, RTS.Config.harvest.depositStop, { skipBuildingId: dep.id });
      finishUnitMove(s, u, dt, false);
      tryFinishDeposit(s, u, node);
      return;
    }
  }

  function builtDeposit(b) {
    return b && !b.dead && b.built && RTS.Buildings[b.type].deposit;
  }

  function doBuildTask(s, u, dt) {
    var b = RTS.getById(s, u.buildTask.buildingId);
    if (!b || b.dead) { u.buildTask = null; u.moveTo = null; return; }
    if (b.built) { u.buildTask = null; u.moveTo = null; return; }
    var reach = Math.max(b.w, b.h) / 2 + 28;
    if (dist(u.x, u.y, b.x, b.y) > reach) {
      u._workPhase = 0;
      navMove(s, u, b.x, b.y, dt, reach - 6, { skipBuildingId: b.id });
      finishUnitMove(s, u, dt, false);
    } else {
      u.vx = 0; u.vy = 0;
      u._moveHold = 0;
      u.facing = Math.atan2(b.y - u.y, b.x - u.x);
      u._workPhase = (u._workPhase || 0) + dt;
    }
  }

  // ---- Buildings -----------------------------------------------------------
  function updateBuilding(s, b, dt) {
    if (b.dead) return;
    b.hitFlash = Math.max(0, b.hitFlash - dt);
    b.spawnFlash = Math.max(0, b.spawnFlash - dt);
    b.cooldown = Math.max(0, b.cooldown - dt);

    if (!b.built) {
      b.progress = Math.min(1, b.progress + dt / b.buildTime);
      b.hp = Math.max(b.hp, b.maxHp * (0.08 + 0.92 * b.progress));
      if (b.progress >= 1) {
        b.built = true; b.hp = b.maxHp; b.spawnFlash = 0.5;
        if (b.team === TEAM.PLAYER) {
          RTS.recalcSupply(s, TEAM.PLAYER);
          RTS.log(s, RTS.nameFor(b.faction, b.type) + ' online', 'good');
          RTS.Audio.play('ready');
          if (RTS.Pathfind) RTS.Pathfind.markDirty(s);
        }
      }
      return;
    }

    // Defensive structures fire
    var spec = RTS.Buildings[b.type];
    if (spec.defense) {
      var foe = nearestEnemy(s, b.x, b.y, b.team, spec.range);
      if (foe && b.cooldown <= 0) {
        b.cooldown = spec.rof;
        RTS.makeProjectile(s, b, foe, spec.dmg, {
          color: RTS.Factions[b.faction].accent,
          faction: b.faction,
          fromTurret: true,
        });
        RTS.Audio.play('shot');
      }
    }

    // Production queue
    if (b.queue.length) {
      var job = b.queue[0];
      b.train = job;
      job.remaining -= dt;
      if (job.remaining <= 0) {
        b.queue.shift();
        spawnTrained(s, b, job.role);
        b.train = b.queue[0] || null;
        if (b.team === TEAM.PLAYER) RTS.HUD.sync(s);
      }
    } else { b.train = null; }
  }

  function spawnTrained(s, b, role) {
    var ang = b.team === TEAM.PLAYER ? -0.4 : Math.PI - 0.4;
    var ox = Math.cos(ang) * (b.w / 2 + 26);
    var oy = Math.sin(ang) * (b.h / 2 + 26);
    var u = RTS.makeUnit(s, role, b.team, b.x + ox, b.y + oy, b.faction);
    u.spawnFlash = 0.4;
    if (role === 'worker' && b.autoMine) {
      var node = RTS.nearestNodeForBuilding(s, b);
      if (node) RTS.orderHarvest(s, u, node.id);
      else if (b.rally) u.moveTo = { x: b.rally.x, y: b.rally.y };
    } else if (b.rally) {
      u.moveTo = { x: b.rally.x, y: b.rally.y };
    }
    if (b.team === TEAM.PLAYER) {
      s.stats.unitsBuilt++;
      RTS.log(s, RTS.nameFor(b.faction, role) + ' ready', 'good');
      RTS.Audio.play('ready');
      RTS.recalcSupply(s, TEAM.PLAYER);
    }
    RTS.spawnExplosion(s, u.x, u.y, 10, RTS.Factions[b.faction].secondary);
  }

  // ---- Combat helpers ------------------------------------------------------
  function applyDamage(s, target, amount, attacker) {
    target.hp -= amount;
    target.hitFlash = RTS.Config.hitFlash;
    var ty = target.y - (target.radius || (target.h ? target.h * 0.3 : 10));
    RTS.spawnHit(s, target.x, ty, target.team);

    // base-under-attack alarm
    if (target.team === TEAM.PLAYER && target.kind === 'building') {
      s.ui.baseAlarm = 1.2;
    }

    if (target.hp <= 0 && !target.dead) {
      killEntity(s, target, attacker);
    }
  }
  RTS.applyDamage = applyDamage;

  function killEntity(s, e, attacker) {
    e.dead = true; e.hp = 0;
    if (e.kind === 'unit') {
      e.corpse = RTS.Config.corpseFade;
      RTS.spawnExplosion(s, e.x, e.y, e.radius + 6, RTS.Factions[e.faction].primary);
      if (attacker && attacker.team === TEAM.PLAYER) s.stats.kills++;
      if (e.team === TEAM.PLAYER) s.stats.unitsLost++;
      s.selectedIds = s.selectedIds.filter(function (id) { return id !== e.id; });
    } else {
      RTS.spawnExplosion(s, e.x, e.y, Math.max(e.w, e.h) * 0.5, '#ffce6b');
      s.screenShake = Math.max(s.screenShake, 5);
      if (e.team === TEAM.PLAYER) {
        s.ui.baseAlarm = 1.4; s.screenFlash = 0.4; s.flashColor = '#ff5555';
        RTS.log(s, RTS.nameFor(e.faction, e.type) + ' destroyed!', 'bad');
      } else {
        RTS.log(s, 'Enemy ' + RTS.nameFor(e.faction, e.type) + ' destroyed', 'good');
      }
      s.selectedIds = s.selectedIds.filter(function (id) { return id !== e.id; });
      if (RTS.Pathfind) RTS.Pathfind.markDirty(s);
      RTS.Audio.play('boom');
    }
  }

  function updateProjectiles(s, dt) {
    var live = [];
    for (var i = 0; i < s.entities.projectiles.length; i++) {
      var p = s.entities.projectiles[i];
      p.life -= dt;
      var t = RTS.getById(s, p.targetId);
      var tx = t && !t.dead ? t.x : p.lastX;
      var ty = t && !t.dead ? t.y : p.lastY;
      p.lastX = tx; p.lastY = ty;
      var dx = tx - p.x, dy = ty - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var step = p.speed * dt;
      if (d <= step || p.life <= 0) {
        // impact
        if (p.splash > 0) {
          splashDamage(s, tx, ty, p.splash, p.dmg, p.team);
          RTS.spawnExplosion(s, tx, ty, p.splash, '#ffb24d');
          s.screenShake = Math.max(s.screenShake, 3);
        } else if (t && !t.dead) {
          applyDamage(s, t, p.dmg, { team: p.team });
        }
        continue;
      }
      p.x += dx / d * step; p.y += dy / d * step;
      live.push(p);
    }
    s.entities.projectiles = live;
  }

  function splashDamage(s, x, y, radius, dmg, team) {
    function hit(arr) {
      arr.forEach(function (e) {
        if (e.dead || e.team === team || e.team === TEAM.NEUTRAL) return;
        var er = e.radius || Math.max(e.w, e.h) / 2;
        var d = dist(x, y, e.x, e.y);
        if (d <= radius + er) {
          var f = 1 - Math.min(1, d / (radius + er));
          applyDamage(s, e, dmg * (0.4 + 0.6 * f), { team: team });
        }
      });
    }
    hit(s.entities.units); hit(s.entities.buildings);
  }

  function updateEffects(s, dt) {
    s.entities.effects = s.entities.effects.filter(function (fx) {
      fx.life -= dt;
      if (fx.kind === 'ring' || fx.kind === 'boom') fx.r += 60 * dt;
      if (fx.kind === 'float') fx.y -= 22 * dt;
      return fx.life > 0;
    });
  }

  // ---- Shared spatial helpers ----------------------------------------------
  function moveToward(u, tx, ty, dt, stop) {
    var dx = tx - u.x, dy = ty - u.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d <= stop) { u.vx = 0; u.vy = 0; return; }
    u.vx = dx / d * u.speed; u.vy = dy / d * u.speed;
    u.facing = Math.atan2(dy, dx);
  }

  function pushCircleOutOfRect(u, rect, r) {
    if (u.x >= rect.l && u.x <= rect.r && u.y >= rect.t && u.y <= rect.b) {
      var dl = u.x - rect.l, dr = rect.r - u.x;
      var dTop = u.y - rect.t, dBot = rect.b - u.y;
      var min = Math.min(dl, dr, dTop, dBot);
      if (min === dl) u.x = rect.l - r - 0.5;
      else if (min === dr) u.x = rect.r + r + 0.5;
      else if (min === dTop) u.y = rect.t - r - 0.5;
      else u.y = rect.b + r + 0.5;
      return;
    }
    var cx = Math.max(rect.l, Math.min(u.x, rect.r));
    var cy = Math.max(rect.t, Math.min(u.y, rect.b));
    var dx = u.x - cx, dy = u.y - cy;
    var d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return;
    var d = Math.sqrt(d2) || 0.01;
    var pen = r - d;
    u.x += (dx / d) * pen;
    u.y += (dy / d) * pen;
  }

  function resolveBuildingCollisions(s, u) {
    if (!RTS.Assets || !RTS.Assets.buildingCollisionRect) return;
    var buildings = s.entities.buildings;
    var r = u.radius;
    var buildingTaskId = u.buildTask && u.buildTask.buildingId;
    var depositId = u.harvest && u.harvest.phase === 'toBase' && u.harvest.depositId;
    var pushX = 0, pushY = 0;
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (b.dead || !b.built) continue;
      if (buildingTaskId && b.id === buildingTaskId) continue;
      if (depositId && b.id === depositId) continue;
      if (u.harvest && u.harvest.phase === 'toBase' && u.harvest.carry > 0 &&
          RTS.Buildings[b.type].deposit && canDepositAt(u, b, s)) continue;
      var px = u.x, py = u.y;
      pushCircleOutOfRect(u, RTS.Assets.buildingCollisionRect(b, s), r);
      pushX += u.x - px;
      pushY += u.y - py;
    }
    if ((pushX || pushY) && (u.vx || u.vy)) {
      var plen = Math.sqrt(pushX * pushX + pushY * pushY) || 1;
      var nx = pushX / plen, ny = pushY / plen;
      var dot = u.vx * nx + u.vy * ny;
      if (dot > 0) {
        u.vx -= nx * dot;
        u.vy -= ny * dot;
      }
    }
  }

  function finishUnitMove(s, u, dt, withSeparation) {
    if (withSeparation !== false) separation(s, u, dt);
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    resolveBuildingCollisions(s, u);
    clampToWorld(u);
  }

  function separation(s, u, dt) {
    var push = RTS.Config.separation;
    var units = s.entities.units;
    for (var i = 0; i < units.length; i++) {
      var o = units[i];
      if (o === u || o.dead) continue;
      var dx = u.x - o.x, dy = u.y - o.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var minD = u.radius + o.radius + 2;
      if (d < minD && d > 0.01) {
        var f = (minD - d) / minD * push * dt;
        u.x += (dx / d) * f; u.y += (dy / d) * f;
      }
    }
  }

  function clampToWorld(u) {
    u.x = Math.max(u.radius, Math.min(RTS.Config.world.w - u.radius, u.x));
    u.y = Math.max(u.radius, Math.min(RTS.Config.world.h - u.radius, u.y));
  }

  function nearestEnemy(s, x, y, team, maxR) {
    var best = null, bd = maxR;
    var foeTeam = team === TEAM.PLAYER ? TEAM.ENEMY : TEAM.PLAYER;
    var u = s.entities.units;
    for (var i = 0; i < u.length; i++) {
      if (u[i].dead || u[i].team !== foeTeam) continue;
      var d = dist(x, y, u[i].x, u[i].y);
      if (d < bd) { bd = d; best = u[i]; }
    }
    var b = s.entities.buildings;
    for (var j = 0; j < b.length; j++) {
      if (b[j].dead || b[j].team !== foeTeam) continue;
      var db = dist(x, y, b[j].x, b[j].y);
      if (db < bd) { bd = db; best = b[j]; }
    }
    return best;
  }
  RTS.nearestEnemy = nearestEnemy;

  function nearestNode(s, x, y) {
    var best = null, bd = Infinity;
    s.entities.resources.forEach(function (n) {
      if (n.amount <= 0) return;
      var d = dist(x, y, n.x, n.y);
      if (d < bd) { bd = d; best = n; }
    });
    return best;
  }
  RTS.nearestNode = nearestNode;

  function tickAutoMine(s, dt) {
    if (!s.ui.autoMineTick) s.ui.autoMineTick = 0;
    s.ui.autoMineTick -= dt;
    if (s.ui.autoMineTick > 0) return;
    s.ui.autoMineTick = 1.5;
    s.entities.buildings.forEach(function (b) {
      if (b.dead || b.team !== TEAM.PLAYER || !b.autoMine || !b.built) return;
      if (b.type !== 'core' && b.type !== 'outpost') return;
      var node = RTS.nearestNodeForBuilding(s, b);
      if (!node) return;
      s.entities.units.forEach(function (u) {
        if (u.dead || u.team !== TEAM.PLAYER || u.role !== 'worker') return;
        if (u.harvest || u.buildTask || u.moveTo || u.target) return;
        if (dist(u.x, u.y, b.x, b.y) > 380) return;
        RTS.orderHarvest(s, u, node.id);
      });
    });
  }

  function nearestDeposit(s, u) {
    var deps = RTS.deposits(s, u.team);
    var best = null, bd = Infinity;
    deps.forEach(function (b) {
      var d = dist(u.x, u.y, b.x, b.y);
      if (d < bd) { bd = d; best = b; }
    });
    return best;
  }

  // ---- Win / loss ----------------------------------------------------------
  function checkEndGame(s) {
    if (s.scene !== 'playing') return;
    var playerAlive = s.entities.buildings.some(function (b) {
      return b.team === RTS.TEAM.PLAYER && !b.dead && (b.type === 'core' || b.type === 'outpost');
    });
    var enemyAlive = s.entities.buildings.some(function (b) {
      return b.team === RTS.TEAM.ENEMY && !b.dead && (b.type === 'core' || b.type === 'outpost');
    });
    if (!enemyAlive) { RTS.endMatch(s, 'won'); }
    else if (!playerAlive) { RTS.endMatch(s, 'lost'); }
  }

})(window.RTS = window.RTS || {});
