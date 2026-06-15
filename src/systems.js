/* ============================================================================
 * EXOFRONT — systems.js
 * The simulation: movement, targeting, combat, harvesting, construction,
 * production, projectiles, effects, separation, and win/loss detection.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TEAM = RTS.TEAM;
  function dist(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }

  function cfg(name, defaults) {
    return RTS.Config[name] || defaults;
  }

  function now(s) {
    return s.timers.gameTime || 0;
  }

  function attackCooldown(s, u) {
    var cd = u.rof;
    if (RTS.hasTrait && RTS.hasTrait(u, 'blood_frenzy')) {
      var frenzy = cfg('bloodFrenzy', { atkSpeedBonus: 0.12 });
      if (u.bloodFrenzyUntil && u.bloodFrenzyUntil > now(s)) {
        cd = cd / (1 + (frenzy.atkSpeedBonus || 0));
      }
    }
    return cd;
  }

  function trackUnitSpeed(u, dt) {
    if (u._lastTraitX == null || u._lastTraitY == null || dt <= 0) {
      u.currentSpeed = 0;
    } else {
      u.currentSpeed = dist(u._lastTraitX, u._lastTraitY, u.x, u.y) / dt;
    }
    u._lastTraitX = u.x;
    u._lastTraitY = u.y;
  }

  function modifiedOutgoingDamage(s, u, target, amount) {
    var dmg = amount;
    if (RTS.hasTrait && RTS.hasTrait(u, 'formation_bonus')) {
      var formation = cfg('formationBonus', { minUnits: 3, radius: 120, dmgBonus: 0.15 });
      var needed = Math.max(0, (formation.minUnits || 3) - 1);
      var count = 0;
      s.entities.units.forEach(function (ally) {
        if (ally === u || ally.dead || ally.team !== u.team || ally.faction !== u.faction) return;
        if (!RTS.hasTrait(ally, 'formation_bonus')) return;
        if (ally.target !== target.id) return;
        if (dist(u.x, u.y, ally.x, ally.y) <= (formation.radius || 120)) count++;
      });
      if (count >= needed) dmg *= 1 + (formation.dmgBonus || 0);
    }

    if (RTS.hasTrait && RTS.hasTrait(u, 'archer_focus')) {
      var focus = cfg('archerFocus', { dmgPerStack: 0.08, maxStacks: 5 });
      if (u.sniperTarget === target) {
        u.sniperStacks = Math.min(focus.maxStacks || 5, (u.sniperStacks || 0) + 1);
      } else {
        u.sniperTarget = target;
        u.sniperStacks = 1;
      }
      dmg *= 1 + (focus.dmgPerStack || 0) * (u.sniperStacks || 0);
    }

    return dmg;
  }

  function applyPoisonOnHit(s, attacker, target) {
    if (!attacker || !target || !RTS.hasTrait || !RTS.hasTrait(attacker, 'gnoll_poison')) return;
    var poison = cfg('gnollPoison', { dmgPerSec: 3, duration: 4 });
    target.poisonUntil = now(s) + (poison.duration || 4);
    target.poisonDmgPerSec = poison.dmgPerSec || 3;
  }

  function tickPoison(s, e, dt) {
    if (!e.poisonUntil || e.poisonUntil <= now(s) || e.dead) return;
    var amount = (e.poisonDmgPerSec || 0) * dt;
    if (amount <= 0) return;
    e.hp -= amount;
    if (e.kind === 'unit') e.lastHitTime = now(s);
    if (e.hp <= 0 && !e.dead) killEntity(s, e, null);
  }

  function tickTrollblood(s, u, dt) {
    if (!RTS.hasTrait || !RTS.hasTrait(u, 'trollblood')) return;
    var tb = cfg('trollblood', { regenPerSec: 12, graceSec: 2.0 });
    var lastHit = u.lastHitTime || 0;
    if (now(s) - lastHit < (tb.graceSec || 2.0)) return;
    if (u.hp >= u.maxHp) return;
    u.hp = Math.min(u.maxHp, u.hp + (tb.regenPerSec || 12) * dt);
  }

  function tickPassiveEffects(s, e, dt) {
    tickPoison(s, e, dt);
    if (e.kind === 'unit' && !e.dead) tickTrollblood(s, e, dt);
  }

  function monkAuraReduction(s, target) {
    if (!target || target.kind !== 'unit' || target.team !== TEAM.PLAYER) return 0;
    var aura = cfg('monkAura', { radius: 130, dmgReduction: 0.10 });
    var reduction = 0;
    s.entities.units.forEach(function (u) {
      if (u.dead || u.team !== target.team || !RTS.hasTrait || !RTS.hasTrait(u, 'monk_aura')) return;
      if (dist(u.x, u.y, target.x, target.y) <= (aura.radius || 130)) {
        reduction += aura.dmgReduction || 0;
      }
    });
    return Math.min(0.25, reduction);
  }

  function applyBloodFrenzy(s, deadUnit) {
    if (!deadUnit || deadUnit.kind !== 'unit' || !RTS.hasTrait || !RTS.hasTrait(deadUnit, 'blood_frenzy')) return;
    var frenzy = cfg('bloodFrenzy', { radius: 180, duration: 4 });
    s.entities.units.forEach(function (u) {
      if (u.dead || u.team !== deadUnit.team || !RTS.hasTrait(u, 'blood_frenzy')) return;
      if (dist(deadUnit.x, deadUnit.y, u.x, u.y) <= (frenzy.radius || 180)) {
        u.bloodFrenzyUntil = Math.max(u.bloodFrenzyUntil || 0, now(s) + (frenzy.duration || 4));
      }
    });
  }

  function depositRect(dep, s) {
    if (RTS.Assets && RTS.Assets.buildingCollisionRect) {
      return RTS.Assets.buildingCollisionRect(dep, s);
    }
    var hw = dep.w * 0.36, hh = dep.h * 0.28;
    return { l: dep.x - hw, r: dep.x + hw, t: dep.y - hh, b: dep.y + hh * 0.55 };
  }

  /** Distance from unit to nearest edge of the deposit building base rect (0 if inside). */
  function depositEdgeDist(u, dep, s) {
    var rect = depositRect(dep, s);
    var cx = Math.max(rect.l, Math.min(u.x, rect.r));
    var cy = Math.max(rect.t, Math.min(u.y, rect.b));
    var dx = u.x - cx, dy = u.y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function depositTriggerRadius() {
    return RTS.Config.harvest.depositTriggerR != null
      ? RTS.Config.harvest.depositTriggerR : 38;
  }

  function depositApproachStop() {
    var H = RTS.Config.harvest;
    var triggerR = depositTriggerRadius();
    var configured = H.depositApproachStop != null ? H.depositApproachStop : 12;
    return Math.min(configured, Math.max(8, triggerR * 0.4));
  }

  function depositApproachPoint(u, dep, s) {
    var rect = depositRect(dep, s);
    var triggerR = depositTriggerRadius();
    var stop = depositApproachStop();
    /* Target must land inside triggerR after nav stop: standoff + stop <= triggerR */
    var standoff = Math.max(4, triggerR - stop - 4);
    var entranceX = (rect.l + rect.r) * 0.5;
    var entranceY = rect.b;
    var cx = Math.max(rect.l, Math.min(u.x, rect.r));
    var cy = Math.max(rect.t, Math.min(u.y, rect.b));
    var dx = u.x - cx, dy = u.y - cy;
    var edgeD = Math.sqrt(dx * dx + dy * dy);
    if (edgeD < 0.5) {
      var ax = u.x - entranceX, ay = u.y - entranceY;
      var ad = Math.sqrt(ax * ax + ay * ay) || 1;
      return {
        x: entranceX + (ax / ad) * standoff,
        y: entranceY + standoff * 0.35,
      };
    }
    return {
      x: cx + (dx / edgeD) * standoff,
      y: cy + (dy / edgeD) * standoff,
    };
  }

  function canDepositAt(u, dep, s) {
    if (!u.harvest || u.harvest.carry <= 0) return false;
    return depositEdgeDist(u, dep, s) <= depositTriggerRadius();
  }

  function depositInRange(s, u) {
    var dep = resolveReturnDeposit(s, u);
    if (dep && canDepositAt(u, dep, s)) return dep;
    return null;
  }

  function resumeLinkedHarvest(s, u) {
    if (!u.harvest) return false;
    if (u.harvest.depositOwnerId) {
      var dep = RTS.getById(s, u.harvest.depositOwnerId);
      var linked = dep ? RTS.nodeForDeposit(s, dep) : null;
      if (linked) {
        assignHarvestNode(s, u, linked);
        return true;
      }
      u.harvest = null;
      return false;
    }
    if (u.harvest.nodeId) {
      var manual = RTS.getById(s, u.harvest.nodeId);
      if (manual && manual.amount > 0) {
        assignHarvestNode(s, u, manual);
        return true;
      }
    }
    u.harvest = null;
    return false;
  }

  function finishDeposit(s, u, node) {
    var dep = resolveReturnDeposit(s, u);
    var amt = Math.floor(u.harvest.carry);
    if (amt > 0) {
      s.res[u.team].halcite += amt;
      if (u.team === TEAM.PLAYER) {
        var fx = u.x, fy = u.y - 18;
        if (dep) {
          var rect = depositRect(dep, s);
          fx = (rect.l + rect.r) * 0.5;
          fy = rect.b - 6;
        }
        s.stats.harvested += amt;
        RTS.spawnFloat(s, fx, fy, '+' + amt);
      }
      if (RTS.Audio) RTS.Audio.play('coin');
    }
    u.harvest.carry = 0;
    u.harvest.depositId = null;
    u._depositStuckT = 0;
    u.vx = 0; u.vy = 0;
    if (node && node.amount > 0 && u.harvest.nodeId === node.id) {
      u.harvest.phase = 'toNode';
      u.harvest.slotIndex = bestHarvestSlot(s, node, u);
    } else if (!resumeLinkedHarvest(s, u)) {
      u.harvest = null;
    }
    if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
  }

  function isReturnDeposit(b) {
    return !!(b && !b.dead && RTS.isDepositBuilding && RTS.isDepositBuilding(b));
  }

  function resolveReturnDeposit(s, u) {
    var h = u.harvest;
    if (!h) return null;
    if (h.depositOwnerId) {
      var owner = RTS.getById(s, h.depositOwnerId);
      if (isReturnDeposit(owner)) return owner;
    }
    if (h.depositId) {
      var current = RTS.getById(s, h.depositId);
      if (isReturnDeposit(current)) return current;
    }
    return nearestDeposit(s, u);
  }

  function assignDepositTarget(s, u) {
    var dep = resolveReturnDeposit(s, u);
    u.harvest.depositId = dep ? dep.id : null;
  }

  function tryFinishDeposit(s, u, node) {
    var dep = resolveReturnDeposit(s, u);
    if (!dep) return false;
    u.harvest.depositId = dep.id;
    if (canDepositAt(u, dep, s)) {
      finishDeposit(s, u, node);
      return true;
    }
    return false;
  }

  RTS.update = function (s, dt) {
    s.timers.gameTime += dt;
    s.screenShake = Math.max(0, s.screenShake - dt * 12);
    s.screenFlash = Math.max(0, s.screenFlash - dt * 1.6);
    s.ui.baseAlarm = Math.max(0, s.ui.baseAlarm - dt);
    if (s.ui.toast) { s.ui.toast.t -= dt; if (s.ui.toast.t <= 0) s.ui.toast = null; }

    var i;
    for (i = 0; i < s.entities.units.length; i++) updateUnit(s, s.entities.units[i], dt);
    resolveAllUnitOverlaps(s);
    for (i = 0; i < s.entities.units.length; i++) {
      if (!s.entities.units[i].dead) clampUnitTerrain(s, s.entities.units[i]);
    }
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
    RTS.recalcSupply(s, TEAM.ENEMY);
    checkEndGame(s);
  };

  // ---- Units ---------------------------------------------------------------
  function navMove(s, u, tx, ty, dt, stop, opts) {
    if (RTS.Pathfind) RTS.Pathfind.moveToward(s, u, tx, ty, dt, stop, opts);
    else moveToward(s, u, tx, ty, dt, stop);
  }

  function updateUnit(s, u, dt) {
    if (u.dead) return;
    tickPassiveEffects(s, u, dt);
    if (u.dead) return;
    trackUnitSpeed(u, dt);
    u.cooldown = Math.max(0, u.cooldown - dt);
    u.muzzleFlash = Math.max(0, u.muzzleFlash - dt);
    u.spawnFlash = Math.max(0, u.spawnFlash - dt);
    if (RTS.Sprites && RTS.Sprites.ready) {
      RTS.Sprites.tickAttack(u, dt);
      tryCombatRelease(s, u);
    }

    if (RTS.UnitAI) RTS.UnitAI.initUnitAIState(u);

    // Pawn retaliation (brief self-defense, then resume work)
    if (RTS.UnitAI && RTS.UnitAI.pawnRetaliateActive(u)) {
      if (RTS.UnitAI.tickPawnRetaliate(s, u, dt)) {
        // resumed work below on next frame
      } else {
        u.inAttackRange = false;
        var rt = u.target ? RTS.getById(s, u.target) : null;
        if (rt && RTS.UnitAI.targetValid(rt)) {
          var ratk = combatApproach(s, u, rt);
          if (ratk.inRange) {
            u.inAttackRange = true;
            u.vx = 0; u.vy = 0;
            u.facing = Math.atan2(ratk.aimY - u.y, ratk.aimX - u.x);
            if (u.cooldown <= 0 && u.dmg > 0) {
              u.cooldown = attackCooldown(s, u);
              fire(s, u, rt);
            }
          } else {
            navMove(s, u, ratk.tx, ratk.ty, dt, ratk.stop, { chasing: true });
          }
          finishUnitMove(s, u, dt);
        }
        return;
      }
    }

    // Worker behaviours take priority
    if (u.role === 'pawn') {
      if (u.buildTask) { doBuildTask(s, u, dt); return; }
      if (u.harvest) { doHarvest(s, u, dt); return; }
    }

    // Healer support
    if (u.heal > 0) { doHeal(s, u, dt); }

    u.inAttackRange = false;

    var target = RTS.UnitAI
      ? RTS.UnitAI.resolveCombatTarget(s, u)
      : resolveLegacyTarget(s, u);

    if (target) {
      var atk = combatApproach(s, u, target);
      if (atk.inRange) {
        u.inAttackRange = true;
        u.vx = 0; u.vy = 0;
        u.facing = Math.atan2(atk.aimY - u.y, atk.aimX - u.x);
        if (u.cooldown <= 0 && u.dmg > 0) {
          u.cooldown = attackCooldown(s, u);
          fire(s, u, target);
        }
      } else {
        navMove(s, u, atk.tx, atk.ty, dt, atk.stop, { chasing: true });
      }
    } else if (u.moveTo) {
      navMove(s, u, u.moveTo.x, u.moveTo.y, dt, 6);
      if (dist(u.x, u.y, u.moveTo.x, u.moveTo.y) < 10) {
        u.moveTo = null;
        if (RTS.UnitAI && u.commandMode === 'attackMove' && u.commandTargetPos) {
          u.moveTo = { x: u.commandTargetPos.x, y: u.commandTargetPos.y };
        } else if (u.commandMode === 'move') {
          u.commandMode = 'idle';
          u.attackMove = false;
        }
        if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
      }
    } else {
      u.vx *= 0.8; u.vy *= 0.8;
    }

    finishUnitMove(s, u, dt);
  }

  function resolveLegacyTarget(s, u) {
    var target = u.target ? RTS.getById(s, u.target) : null;
    if (target && !RTS.canBeAttacked(target)) { u.target = null; target = null; }
    if (!target && u.role !== 'pawn' && u.heal === 0) {
      if (u.attackMove || u.team === TEAM.ENEMY || !u.moveTo) {
        var combat = RTS.Config.combat || {};
        var attentionMul = u.attackMove
          ? (combat.attentionAttackMove || 2.0)
          : (combat.attentionIdle || 1.55);
        var foe = nearestEnemy(s, u.x, u.y, u.team, u.range * attentionMul, u.radius);
        if (foe) { target = foe; u.target = foe.id; }
      }
    }
    if (target && u.attackMove) {
      var tr0 = target.radius || Math.max(target.w, target.h) / 2;
      var chaseMul = (RTS.Config.combat && RTS.Config.combat.attentionChase) || 2.1;
      if (dist(u.x, u.y, target.x, target.y) > u.range * chaseMul + tr0) {
        u.target = null;
        target = null;
      }
    }
    return target;
  }

  function fire(s, u, target) {
    var dmg = modifiedOutgoingDamage(s, u, target, u.dmg);
    if (RTS.Sprites && RTS.Sprites.ready) {
      RTS.Sprites.startAttack(u, target);
      if (u.ranged) {
        u._pendingShot = {
          targetId: target.id,
          attackerId: u.id,
          dmg: dmg,
          splash: u.splash,
          faction: u.faction,
          role: u.role,
          traits: (u.traits || []).slice(),
          released: false,
        };
      } else {
        u._pendingMelee = { targetId: target.id, attackerId: u.id, dmg: dmg, released: false };
      }
      RTS.Audio.play(u.ranged ? 'shot' : 'melee');
      return;
    }
    u.muzzleFlash = RTS.Config.muzzleFlash;
    if (u.ranged) {
      RTS.makeProjectile(s, u, target, dmg, {
        splash: u.splash,
        color: RTS.Factions[u.faction].accent,
        faction: u.faction,
        role: u.role,
        attackerId: u.id,
        traits: (u.traits || []).slice(),
      });
      RTS.Audio.play(u.ranged ? 'shot' : 'melee');
    } else {
      applyDamage(s, target, dmg, u);
      applyPoisonOnHit(s, u, target);
      RTS.Audio.play('melee');
    }
  }

  function tryCombatRelease(s, u) {
    if (u._pendingShot && !u._pendingShot.released && RTS.Sprites.atReleaseFrame(u)) {
      var ps = u._pendingShot;
      var t = RTS.getById(s, ps.targetId);
      if (t && !t.dead) {
        var shooter = ps.attackerId ? RTS.getById(s, ps.attackerId) : u;
        RTS.makeProjectile(s, u, t, ps.dmg, {
          splash: ps.splash,
          color: RTS.Factions[ps.faction].accent,
          faction: ps.faction,
          role: ps.role,
          attackerId: shooter ? shooter.id : ps.attackerId,
          traits: shooter && shooter.traits ? shooter.traits.slice() : (ps.traits || []).slice(),
        });
      }
      u._pendingShot.released = true;
      if (u._pendingShot.released) u._pendingShot = null;
    }
    if (u._pendingMelee && !u._pendingMelee.released && RTS.Sprites.atImpactFrame(u)) {
      var pm = u._pendingMelee;
      var mt = RTS.getById(s, pm.targetId);
      if (mt && !mt.dead) {
        var attacker = pm.attackerId ? RTS.getById(s, pm.attackerId) : u;
        applyDamage(s, mt, pm.dmg, attacker || u);
        applyPoisonOnHit(s, attacker || u, mt);
      }
      u._pendingMelee.released = true;
      if (u._pendingMelee.released) u._pendingMelee = null;
    }
    if (u._pendingHeal && !u._pendingHeal.released && RTS.Sprites.atReleaseFrame(u)) {
      var ph = u._pendingHeal;
      var ally = RTS.getById(s, ph.targetId);
      if (ally && !ally.dead) {
        ally.hp = Math.min(ally.maxHp, ally.hp + ph.amount);
      }
      u._pendingHeal.released = true;
      if (u._pendingHeal.released) u._pendingHeal = null;
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
        u.cooldown = attackCooldown(s, u);
        if (RTS.Sprites && RTS.Sprites.ready) {
          RTS.Sprites.startAttack(u, best);
          u._pendingHeal = { targetId: best.id, amount: u.heal, released: false };
        } else {
          best.hp = Math.min(best.maxHp, best.hp + u.heal);
          RTS.addEffect(s, { kind: 'heal', x: best.x, y: best.y, life: 0.3, max: 0.3, color: '#9bffd0' });
        }
      }
    }
  }

  // ---- Harvesting ----------------------------------------------------------
  function mineChunkSize() {
    var H = RTS.Config.harvest;
    return H.rate * H.mineCycleSec;
  }

  function resourcePct(node) {
    if (!node || !node.max) return 0;
    return Math.max(0, Math.min(1, node.amount / node.max));
  }

  function resourceIsLow(node) {
    return resourcePct(node) < RTS.Config.harvest.lowNodePct;
  }

  function resourceSlots(node) {
    return RTS.Config.harvest.slotCount || 6;
  }

  function slotWorldPos(node, slotIndex) {
    var count = resourceSlots(node);
    var idx = ((slotIndex % count) + count) % count;
    var angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
    var ring = node.r + RTS.Config.harvest.reach * 0.35;
    return { x: node.x + Math.cos(angle) * ring, y: node.y + Math.sin(angle) * ring };
  }

  function workerAssignedSlot(worker) {
    return worker.harvest && worker.harvest.slotIndex != null ? worker.harvest.slotIndex : -1;
  }

  function slotOccupiedBy(s, nodeId, slotIndex, exceptWorkerId) {
    for (var i = 0; i < s.entities.units.length; i++) {
      var u = s.entities.units[i];
      if (u.dead || u.id === exceptWorkerId || u.role !== 'pawn' || !u.harvest) continue;
      if (u.harvest.nodeId !== nodeId || u.harvest.slotIndex !== slotIndex) continue;
      var ph = u.harvest.phase;
      if (ph === 'toNode' || ph === 'alignSlot' || ph === 'mining') return true;
    }
    return false;
  }

  function bestHarvestSlot(s, node, worker) {
    var count = resourceSlots(node);
    var best = 0, bestScore = Infinity;
    for (var i = 0; i < count; i++) {
      var score = slotOccupiedBy(s, node.id, i, worker.id) ? 10000 : 0;
      var pos = slotWorldPos(node, i);
      score += dist(worker.x, worker.y, pos.x, pos.y);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  function nodeAssignedWorkerCount(s, nodeId) {
    var count = 0;
    s.entities.units.forEach(function (u) {
      if (u.dead || u.role !== 'pawn' || !u.harvest || u.harvest.nodeId !== nodeId) return;
      var ph = u.harvest.phase;
      if (ph === 'toNode' || ph === 'alignSlot' || ph === 'mining') count++;
    });
    return count;
  }

  function nodeHasOpenSlot(s, nodeId) {
    var node = s.entities.resources.find(function (n) { return n.id === nodeId; });
    if (!node) return false;
    var count = resourceSlots(node);
    for (var i = 0; i < count; i++) {
      if (!slotOccupiedBy(s, nodeId, i, null)) return true;
    }
    return false;
  }

  function scoreNodeForWorker(s, worker, node, ox, oy) {
    var H = RTS.Config.harvest;
    if (!node || node.amount <= 0) return -Infinity;
    var assigned = nodeAssignedWorkerCount(s, node.id);
    if (assigned >= H.maxWorkersPerNode) return -Infinity;
    if (worker && worker.harvest && worker.harvest.nodeId === node.id) assigned = Math.max(0, assigned - 1);

    var d = dist(ox, oy, node.x, node.y);
    var score = -d * 0.04;
    score += resourcePct(node) * 120;
    score -= assigned * 35;
    if (assigned > H.idealWorkersPerNode) score -= (assigned - H.idealWorkersPerNode) * 28;
    if (resourceIsLow(node)) score -= 55;
    if (node.amount < H.minNodeAmount) score -= 40;
    if (!nodeHasOpenSlot(s, node.id) && assigned >= H.maxWorkersPerNode - 1) score -= 25;
    return score;
  }

  function bestNodeForWorker(s, worker, ox, oy, opts) {
    opts = opts || {};
    var best = null, bestScore = -Infinity;
    s.entities.resources.forEach(function (n) {
      if (n.amount <= 0) return;
      if (opts.minAmount && n.amount < opts.minAmount) return;
      var score = scoreNodeForWorker(s, worker, n, ox, oy);
      if (opts.preferId && n.id === opts.preferId) score += 8;
      if (score > bestScore) { bestScore = score; best = n; }
    });
    return best;
  }

  function releaseHarvestSlot(u) {
    if (u.harvest) u.harvest.slotIndex = null;
  }

  function assignHarvestNode(s, u, node) {
    if (!node) return false;
    u.harvest.nodeId = node.id;
    u.harvest.slotIndex = bestHarvestSlot(s, node, u);
    u.harvest.phase = 'toNode';
    u.harvest.cycleT = 0;
    if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
    return true;
  }

  function getHarvestNode(s, u) {
    return u.harvest.nodeId
      ? s.entities.resources.find(function (n) { return n.id === u.harvest.nodeId; })
      : null;
  }

  function slotTarget(s, u, node) {
    var idx = workerAssignedSlot(u);
    if (idx < 0) {
      idx = bestHarvestSlot(s, node, u);
      u.harvest.slotIndex = idx;
    }
    return slotWorldPos(node, idx);
  }

  function atHarvestSlot(u, node) {
    var pos = slotWorldPos(node, workerAssignedSlot(u));
    return dist(u.x, u.y, pos.x, pos.y) <= RTS.Config.harvest.slotReach + (u.radius || 8);
  }

  function completeMineCycle(s, u, node) {
    var H = RTS.Config.harvest;
    var chunk = Math.min(mineChunkSize(), node.amount, H.capacity - u.harvest.carry);
    if (chunk <= 0) return false;
    node.amount -= chunk;
    u.harvest.carry += chunk;
    if (u.team === TEAM.PLAYER) {
      RTS.addEffect(s, {
        kind: 'spark', x: node.x, y: node.y - node.r * 0.2,
        life: 0.18, max: 0.18, color: '#ffe082', r: 6,
      });
    }
    return true;
  }

  function beginReturnTrip(s, u) {
    u.harvest.phase = 'toBase';
    releaseHarvestSlot(u);
    assignDepositTarget(s, u);
    u.harvest.cycleT = 0;
    if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
  }

  function doHarvest(s, u, dt) {
    var H = RTS.Config.harvest;
    var node = getHarvestNode(s, u);

    if (u.harvest.phase === 'findNode') {
      if (!resumeLinkedHarvest(s, u)) return;
      node = getHarvestNode(s, u);
    }

    if (u.harvest.phase === 'toNode') {
      if (!node || node.amount <= 0) {
        releaseHarvestSlot(u);
        if (!resumeLinkedHarvest(s, u)) return;
        node = getHarvestNode(s, u);
      }
      var target = slotTarget(s, u, node);
      if (atHarvestSlot(u, node)) {
        u.harvest.phase = 'mining';
        u.vx = 0; u.vy = 0;
        u._moveHold = 0;
        u._workPhase = 0;
        u.harvest.cycleT = 0;
        u.facing = Math.atan2(node.y - u.y, node.x - u.x);
      } else {
        navMove(s, u, target.x, target.y, dt, H.slotReach, { skipResourceId: node.id });
      }
      finishUnitMove(s, u, dt, false);
      return;
    }

    if (u.harvest.phase === 'mining') {
      if (!node || node.amount <= 0) {
        if (u.harvest.carry > 0) beginReturnTrip(s, u);
        else {
          releaseHarvestSlot(u);
          if (!resumeLinkedHarvest(s, u)) u.harvest = null;
        }
        return;
      }
      u.facing = Math.atan2(node.y - u.y, node.x - u.x);
      u._workPhase = (u._workPhase || 0) + dt;
      u.harvest.cycleT = (u.harvest.cycleT || 0) + dt;
      if (u.harvest.cycleT >= H.mineCycleSec) {
        u.harvest.cycleT -= H.mineCycleSec;
        completeMineCycle(s, u, node);
      }
      if (u.harvest.carry >= H.capacity - 0.01) beginReturnTrip(s, u);
      return;
    }

    if (u.harvest.phase === 'toBase') {
      if (tryFinishDeposit(s, u, node)) return;

      var dep = resolveReturnDeposit(s, u);
      if (!dep) {
        if (u.harvest.carry > 0) { u._depositStuckT = (u._depositStuckT || 0) + dt; }
        else if (!resumeLinkedHarvest(s, u)) u.harvest = null;
        return;
      }
      u.harvest.depositId = dep.id;

      if (u.harvest.carry > 0) {
        if (canDepositAt(u, dep, s)) {
          u._depositStuckT = (u._depositStuckT || 0) + dt;
          if (u._depositStuckT >= H.depositStuckSec && depositEdgeDist(u, dep, s) <= depositTriggerRadius()) {
            finishDeposit(s, u, node);
            return;
          }
        } else {
          u._depositStuckT = 0;
        }
      }

      var approach = depositApproachPoint(u, dep, s);
      navMove(s, u, approach.x, approach.y, dt, depositApproachStop(), { skipBuildingId: dep.id });
      finishUnitMove(s, u, dt, false);
      tryFinishDeposit(s, u, node);
      return;
    }
  }

  function builderReach(b) {
    return Math.max(b.w, b.h) / 2 + 28;
  }

  function builderOnSite(u, b) {
    return dist(u.x, u.y, b.x, b.y) <= builderReach(b);
  }

  // True while a pawn must stay on an incomplete build site (buildTask or builderId link).
  function isConstructionWorker(s, u, exceptBuildingId) {
    if (!u || u.dead || u.role !== 'pawn') return false;
    if (u.buildTask) {
      var tb = RTS.getById(s, u.buildTask.buildingId);
      if (!tb || tb.dead || tb.built) return false;
      if (exceptBuildingId && u.buildTask.buildingId === exceptBuildingId) return false;
      return true;
    }
    for (var i = 0; i < s.entities.buildings.length; i++) {
      var b = s.entities.buildings[i];
      if (!b.dead && !b.built && b.builderId === u.id) {
        if (exceptBuildingId && b.id === exceptBuildingId) continue;
        return true;
      }
    }
    return false;
  }
  RTS.isConstructionWorker = isConstructionWorker;

  function syncBuilderLink(s, b) {
    if (!b || b.built || !b.builderId) return;
    var builder = RTS.getById(s, b.builderId);
    if (!builder || builder.dead) {
      b.builderId = null;
      return;
    }
    if (builder.buildTask && builder.buildTask.buildingId === b.id) return;
    // Re-bind buildTask when the assigned pawn was pulled off without a new order.
    if (!builder.harvest && !builder.moveTo && !builder.target) {
      builder.buildTask = { buildingId: b.id };
      builder._workPhase = builder._workPhase || 0;
      if (RTS.Pathfind) RTS.Pathfind.clearNav(builder);
      return;
    }
    b.builderId = null;
  }

  function doBuildTask(s, u, dt) {
    var b = RTS.getById(s, u.buildTask.buildingId);
    if (!b || b.dead) { u.buildTask = null; u.moveTo = null; return; }
    if (b.built) {
      u.buildTask = null;
      u.moveTo = null;
      b.builderId = null;
      if (RTS.resumeCarryAfterBuild) RTS.resumeCarryAfterBuild(u, s);
      return;
    }
    if (b.builderId && b.builderId !== u.id) { u.buildTask = null; return; }
    b.builderId = u.id;
    var reach = builderReach(b);
    if (!builderOnSite(u, b)) {
      u._builderOnSite = false;
      u._workPhase = 0;
      navMove(s, u, b.x, b.y, dt, reach - 6, { skipBuildingId: b.id });
      finishUnitMove(s, u, dt, false);
    } else {
      u._builderOnSite = true;
      u.vx = 0; u.vy = 0;
      u._moveHold = 0;
      u.facing = Math.atan2(b.y - u.y, b.x - u.x);
      u._workPhase = (u._workPhase || 0) + dt;
      if (b.buildTime > 0) {
        b.progress = Math.min(1, b.progress + dt / b.buildTime);
        b.hp = Math.max(b.hp, b.maxHp * (0.08 + 0.92 * b.progress));
      }
    }
  }

  // ---- Buildings -----------------------------------------------------------
  function updateBuilding(s, b, dt) {
    if (b.dead) return;
    tickPassiveEffects(s, b, dt);
    if (b.dead) return;
    b.spawnFlash = Math.max(0, b.spawnFlash - dt);
    b.cooldown = Math.max(0, b.cooldown - dt);

    if (RTS.Particles && RTS.Particles.ready && b.built) {
      RTS.Particles.syncBuildingFires(s, b);
    }

    if (!b.built) {
      syncBuilderLink(s, b);
      if (!b.builderId && RTS.assignBuilder) RTS.assignBuilder(s, b);
      b.hp = Math.max(b.hp, b.maxHp * (0.08 + 0.92 * b.progress));
      if (b.progress >= 1) {
        b.built = true; b.hp = b.maxHp; b.spawnFlash = 0.5;
        if (RTS.Buildings[b.type] && RTS.Buildings[b.type].isPasture) {
          if (!b.livestock) b.livestock = [];
        }
        b.builderId = null;
        RTS.markBuildingFootprint(s, b, true);
        RTS.spawnBuildingDust(s, b);
        RTS.recalcSupply(s, b.team);
        if (b.team === TEAM.PLAYER) {
          RTS.log(s, RTS.nameFor(b.faction, b.type) + ' online', 'good');
          RTS.Audio.play('ready');
          if (RTS.Pathfind) RTS.Pathfind.markDirty(s);
        } else if (RTS.Pathfind) {
          RTS.Pathfind.markDirty(s);
        }
        s.entities.units.forEach(function (u) {
          if (u.buildTask && u.buildTask.buildingId === b.id) {
            u.buildTask = null;
            u.moveTo = null;
            if (RTS.resumeCarryAfterBuild) RTS.resumeCarryAfterBuild(u, s);
          }
        });
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
        if (job.role === '_livestock') {
          spawnLivestock(s, b);
        } else {
          spawnTrained(s, b, job.role);
        }
        b.train = b.queue[0] || null;
        if (b.team === TEAM.PLAYER) RTS.HUD.sync(s);
      }
    } else { b.train = null; }

    if (RTS.Buildings[b.type] && RTS.Buildings[b.type].isPasture && b.livestock) {
      updateLivestock(s, b, dt);
    }
  }

  /* ---- Livestock system -------------------------------------------------- */
  function livestockSpecies(b) {
    return (b.faction === 'cinder') ? 'pig' : 'sheep';
  }

  var PASTURE_PEN_UV = { u0: 0.13, u1: 0.58, v0: 0.45, v1: 0.97 };

  function pasturePenRect(b, s) {
    var vb = RTS.Assets && RTS.Assets.buildingVisualBounds
      ? RTS.Assets.buildingVisualBounds(b, s) : null;
    if (vb) {
      var uv = PASTURE_PEN_UV;
      var uMid = (uv.u0 + uv.u1) * 0.5;
      var vMid = (uv.v0 + uv.v1) * 0.5;
      var cx = vb.x - vb.drawW * 0.5 + uMid * vb.drawW;
      var cy = vb.drawY + vMid * vb.drawH;
      var hw = (uv.u1 - uv.u0) * vb.drawW * 0.5 * 0.84;
      var hh = (uv.v1 - uv.v0) * vb.drawH * 0.5 * 0.84;
      return { cx: cx, cy: cy, hw: hw, hh: hh };
    }
    return {
      cx: b.x - b.w * 0.14,
      cy: b.y + b.h * 0.04,
      hw: b.w * 0.16 * 0.84,
      hh: b.h * 0.13 * 0.84,
    };
  }

  function livestockFootRadius(species) {
    var sc = species === 'pig' ? 0.36 : 0.42;
    var fw = species === 'pig' ? 192 : 128;
    return fw * sc * 0.28;
  }

  function clampLivestockToPen(a, pen) {
    var rx = livestockFootRadius(a.species);
    var ry = rx * 0.72;
    a.x = Math.max(pen.cx - pen.hw + rx, Math.min(pen.cx + pen.hw - rx, a.x));
    a.y = Math.max(pen.cy - pen.hh + ry, Math.min(pen.cy + pen.hh - ry, a.y));
  }

  function spawnLivestock(s, b) {
    if (!b.livestock) b.livestock = [];
    var lc = RTS.Config.livestock;
    var liveCount = b.livestock.filter(function (a) { return !a.dead; }).length;
    if (liveCount >= lc.maxPerPasture) return;
    var species = livestockSpecies(b);
    var pen = pasturePenRect(b, s);
    var rx = livestockFootRadius(species);
    var idleClip = RTS.Livestock ? RTS.Livestock.clip(species, 'idle') : null;
    var idleFrames = idleClip ? idleClip.frames : 4;
    var animal = {
      id: RTS.nextId(),
      kind: 'livestock',
      species: species,
      buildingId: b.id,
      x: pen.cx + (Math.random() - 0.5) * Math.max(6, (pen.hw - rx) * 1.6),
      y: pen.cy + (Math.random() - 0.5) * Math.max(6, (pen.hh - rx * 0.72) * 1.6),
      dead: false,
      animClip: 'idle',
      animFrame: Math.random() * idleFrames | 0,
      animTimer: Math.random() * 0.5,
      wanderTimer: 1 + Math.random() * 2,
      wanderVx: 0,
      wanderVy: 0,
      facing: Math.random() < 0.5 ? 1 : -1,
    };
    b.livestock.push(animal);
    clampLivestockToPen(animal, pen);
    RTS.recalcSupply(s, b.team);
    if (b.team === TEAM.PLAYER) {
      var name = species === 'pig' ? 'Pig' : 'Sheep';
      RTS.log(s, name + ' joined the pen', 'good');
      RTS.Audio.play('ready');
    }
  }

  var LIVESTOCK_SPEED = 28;
  var WANDER_IDLE_RANGE  = [1.2, 3.0];
  var WANDER_MOVE_RANGE  = [0.6, 1.4];

  function updateLivestock(s, b, dt) {
    if (!b.livestock) return;
    var pen = pasturePenRect(b, s);

    b.livestock.forEach(function (a) {
      if (a.dead) return;

      a.wanderTimer -= dt;
      if (a.wanderTimer <= 0) {
        if (a.animClip === 'walk') {
          a.animClip = 'idle';
          a.animFrame = 0;
          a.animTimer = 0;
          a.wanderVx = 0;
          a.wanderVy = 0;
          a.wanderTimer = WANDER_IDLE_RANGE[0] +
            Math.random() * (WANDER_IDLE_RANGE[1] - WANDER_IDLE_RANGE[0]);
        } else {
          var ang = Math.random() * Math.PI * 2;
          a.wanderVx = Math.cos(ang) * LIVESTOCK_SPEED;
          a.wanderVy = Math.sin(ang) * LIVESTOCK_SPEED * 0.55;
          a.facing   = a.wanderVx >= 0 ? 1 : -1;
          a.animClip = 'walk';
          a.animFrame = 0;
          a.animTimer = 0;
          a.wanderTimer = WANDER_MOVE_RANGE[0] +
            Math.random() * (WANDER_MOVE_RANGE[1] - WANDER_MOVE_RANGE[0]);
        }
      }

      if (a.animClip === 'walk') {
        a.x += a.wanderVx * dt;
        a.y += a.wanderVy * dt;
      }
      clampLivestockToPen(a, pen);

      var clipData = RTS.Livestock ? RTS.Livestock.clip(a.species, a.animClip) : null;
      var fps = (a.animClip === 'walk') ? 10 : 5;
      a.animTimer += dt;
      if (a.animTimer >= 1 / fps) {
        a.animTimer -= 1 / fps;
        var frameCount = clipData ? clipData.frames : 4;
        a.animFrame = (a.animFrame + 1) % frameCount;
      }
    });
  }

  RTS.canQueueLivestock = function (s, b) {
    if (!b || !b.built) return false;
    var lc = RTS.Config.livestock;
    if (!lc) return false;
    var liveCount = (b.livestock || []).filter(function (a) { return !a.dead; }).length;
    var queued    = (b.queue    || []).filter(function (j) { return j.role === '_livestock'; }).length;
    return (liveCount + queued) < lc.maxPerPasture;
  };

  RTS.pasturePenRect = pasturePenRect;
  RTS.livestockSpecies = function (b) {
    return (b.faction === 'cinder') ? 'pig' : 'sheep';
  };

  function spawnTrained(s, b, role) {
    var ang = b.team === TEAM.PLAYER ? -0.4 : Math.PI - 0.4;
    var ox = Math.cos(ang) * (b.w / 2 + 26);
    var oy = Math.sin(ang) * (b.h / 2 + 26);
    var u = RTS.makeUnit(s, role, b.team, b.x + ox, b.y + oy, b.faction);
    u.spawnFlash = 0.4;
    if (role === 'pawn' && b.autoMine) {
      var node = RTS.nodeForDeposit(s, b);
      if (node) RTS.orderHarvest(s, u, node.id, { depositOwnerId: b.id });
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
    RTS.spawnUnitDust(s, u);
  }

  // ---- Combat helpers ------------------------------------------------------
  function impactPoint(target, attacker, impact) {
    if (impact && impact.x != null && impact.y != null) {
      return { x: impact.x, y: impact.y };
    }
    if (attacker && attacker.x != null && attacker.y != null) {
      var dx = target.x - attacker.x;
      var dy = target.y - attacker.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var er = target.radius || (target.w ? Math.max(target.w, target.h) * 0.22 : 10);
      return {
        x: target.x - (dx / d) * er * 0.55,
        y: target.y - (dy / d) * er * 0.35,
      };
    }
    return {
      x: target.x,
      y: target.y - (target.radius || (target.h ? target.h * 0.28 : 10)),
    };
  }

  function applyDamage(s, target, amount, attacker, impact) {
    var reduction = monkAuraReduction(s, target);
    if (reduction > 0) amount *= (1 - reduction);
    if (target.kind === 'unit') target.lastHitTime = now(s);
    target.hp -= amount;
    var pt = impactPoint(target, attacker, impact);
    RTS.spawnHit(s, pt.x, pt.y);

    if (target.kind === 'unit' && attacker && RTS.UnitAI) {
      RTS.UnitAI.onDamaged(s, target, attacker);
    }

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
      applyBloodFrenzy(s, e);
      e.corpse = RTS.Config.corpseFade;
      if (RTS.Particles && RTS.Particles.ready) {
        RTS.Particles.spawnDust(s, e.x, e.y + 2, 1.15, true);
      } else if (!(RTS.Sprites && RTS.Sprites.ready)) {
        RTS.spawnExplosion(s, e.x, e.y, e.radius + 6, RTS.Factions[e.faction].primary);
      }
      if (attacker && attacker.team === TEAM.PLAYER) s.stats.kills++;
      if (e.team === TEAM.PLAYER) s.stats.unitsLost++;
      s.selectedIds = s.selectedIds.filter(function (id) { return id !== e.id; });
    } else {
      if (e.livestock) {
        e.livestock.forEach(function (a) { a.dead = true; });
        RTS.recalcSupply(s, e.team);
      }
      if (RTS.Particles) RTS.Particles.clearBuildingFires(s, e.id);
      var boomY = e.y - e.h * 0.22;
      var boomSize = Math.max(e.w, e.h) * 0.75;
      RTS.spawnExplosion(s, e.x, boomY, boomSize, '#ffce6b');
      s.screenShake = Math.max(s.screenShake, 7);
      if (e.team === TEAM.PLAYER) {
        s.ui.baseAlarm = 1.4; s.screenFlash = 0.4; s.flashColor = '#ff5555';
        RTS.log(s, RTS.nameFor(e.faction, e.type) + ' destroyed!', 'bad');
      } else {
        RTS.log(s, 'Enemy ' + RTS.nameFor(e.faction, e.type) + ' destroyed', 'good');
      }
      s.selectedIds = s.selectedIds.filter(function (id) { return id !== e.id; });
      RTS.markBuildingFootprint(s, e, false);
      if (RTS.Pathfind) RTS.Pathfind.markDirty(s);
      RTS.Audio.play('boom');
      if (e.type === 'core') checkEndGame(s);
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
          var attacker = p.attackerId ? RTS.getById(s, p.attackerId) : null;
          var source = attacker || { id: p.attackerId, team: p.team, role: p.role, faction: p.faction, traits: p.traits };
          applyDamage(s, t, p.dmg, source, { x: p.x, y: p.y });
          applyPoisonOnHit(s, source, t);
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
        if (!RTS.canBeAttacked(e) || e.team === team || e.team === TEAM.NEUTRAL) return;
        var er = e.radius || Math.max(e.w, e.h) / 2;
        var d = dist(x, y, e.x, e.y);
        if (d <= radius + er) {
          var f = 1 - Math.min(1, d / (radius + er));
          applyDamage(s, e, dmg * (0.4 + 0.6 * f), { team: team }, { x: x, y: y });
        }
      });
    }
    hit(s.entities.units); hit(s.entities.buildings);
  }

  function updateEffects(s, dt) {
    if (RTS.Particles) RTS.Particles.tick(s, dt);
    s.entities.effects = s.entities.effects.filter(function (fx) {
      fx.life -= dt;
      if (fx.kind === 'ring' || fx.kind === 'boom') fx.r += 60 * dt;
      if (fx.kind === 'float') fx.y -= 22 * dt;
      return fx.life > 0;
    });
  }

  // ---- Shared spatial helpers ----------------------------------------------
  function moveToward(s, u, tx, ty, dt, stop) {
    var dx = tx - u.x, dy = ty - u.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d <= stop) { u.vx = 0; u.vy = 0; return; }
    var vx = dx / d * u.speed, vy = dy / d * u.speed;
    var grid = s && s.map && s.map.terrainGrid;
    if (grid && RTS.Terrain) {
      var nx = u.x + vx * dt, ny = u.y + vy * dt;
      if (RTS.Terrain.isWater(grid, nx, ny)) { u.vx = 0; u.vy = 0; return; }
    }
    u.vx = vx; u.vy = vy;
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
      if (u.target === b.id && !u.ranged && u.inAttackRange) continue;
      if (u.harvest && u.harvest.phase === 'toBase' && u.harvest.carry > 0 &&
          RTS.isDepositBuilding && RTS.isDepositBuilding(b) && canDepositAt(u, b, s)) continue;
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

  function unitMinDist(u, o) {
    if (u.role === 'pawn' && o.role === 'pawn') {
      return (u.radius + o.radius) * 0.52 + (RTS.Config.pawnCollisionGap || 0);
    }
    return u.radius + o.radius + RTS.Config.unitCollisionGap;
  }

  function separateUnitPair(u, o) {
    var dx = u.x - o.x, dy = u.y - o.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var minD = unitMinDist(u, o);
    if (d >= minD) return;
    var nx, ny;
    if (d < 0.01) {
      var seed = (u.id * 73856093) ^ (o.id * 19349663);
      var angle = ((seed & 0x7FFFFFFF) / 0x7FFFFFFF) * Math.PI * 2;
      nx = Math.cos(angle);
      ny = Math.sin(angle);
    } else {
      nx = dx / d;
      ny = dy / d;
    }
    var pen = minD - d;
    u.x += nx * pen * 0.5;
    u.y += ny * pen * 0.5;
    o.x -= nx * pen * 0.5;
    o.y -= ny * pen * 0.5;
  }

  function resolveAllUnitOverlaps(s) {
    var units = s.entities.units;
    var iterations = RTS.Config.unitOverlapIterations;
    for (var pass = 0; pass < iterations; pass++) {
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (u.dead) continue;
        for (var j = i + 1; j < units.length; j++) {
          var o = units[j];
          if (o.dead) continue;
          separateUnitPair(u, o);
        }
      }
    }
  }

  function softSeparation(s, u, dt) {
    var push = RTS.Config.separation;
    if (u.role === 'pawn') push *= RTS.Config.pawnSeparationMul || 0.28;
    var units = s.entities.units;
    for (var i = 0; i < units.length; i++) {
      var o = units[i];
      if (o === u || o.dead) continue;
      var dx = u.x - o.x, dy = u.y - o.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var minD = unitMinDist(u, o);
      if (d < minD && d > 0.01) {
        var f = (minD - d) / minD * push * dt;
        u.x += (dx / d) * f; u.y += (dy / d) * f;
      }
    }
  }

  function finishUnitMove(s, u, dt, withSeparation) {
    var grid = s.map && s.map.terrainGrid;
    var wasWater = grid && RTS.Terrain ? RTS.Terrain.isWater(grid, u.x, u.y) : false;

    u.x += u.vx * dt;
    u.y += u.vy * dt;

    if (RTS.Particles && RTS.Particles.ready && grid && RTS.Terrain) {
      var nowWater = RTS.Terrain.isWater(grid, u.x, u.y);
      if (nowWater && !wasWater) RTS.Particles.spawnWaterSplash(s, u.x, u.y);
    }

    if (withSeparation !== false) softSeparation(s, u, dt);
    resolveBuildingCollisions(s, u);
    clampUnitTerrain(s, u);
  }

  function buildingCollisionRect(s, b) {
    if (RTS.Assets && RTS.Assets.buildingCollisionRect) {
      return RTS.Assets.buildingCollisionRect(b, s);
    }
    var hw = b.w * 0.36, hh = b.h * 0.28;
    return { l: b.x - hw, r: b.x + hw, t: b.y - hh, b: b.y + hh * 0.55 };
  }

  function distToBuildingEdge(s, ux, uy, building) {
    var rect = buildingCollisionRect(s, building);
    var cx = Math.max(rect.l, Math.min(ux, rect.r));
    var cy = Math.max(rect.t, Math.min(uy, rect.b));
    var dx = ux - cx, dy = uy - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Edge-aware distance for combat acquisition (buildings use collision rect, units use radii). */
  function combatTargetDist(s, ux, uy, target, uRadius) {
    if (!target) return Infinity;
    if (target.kind === 'building') {
      return distToBuildingEdge(s, ux, uy, target);
    }
    var tr = target.radius || 0;
    var ur = uRadius || 0;
    return Math.max(0, dist(ux, uy, target.x, target.y) - tr - ur);
  }
  RTS.combatTargetDist = combatTargetDist;
  RTS.distToBuildingEdge = distToBuildingEdge;

  function buildingApproachPoint(s, u, building) {
    var rect = buildingCollisionRect(s, building);
    var cx = Math.max(rect.l, Math.min(u.x, rect.r));
    var cy = Math.max(rect.t, Math.min(u.y, rect.b));
    var dx = u.x - cx, dy = u.y - cy;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var standoff = (RTS.Config.combat && RTS.Config.combat.meleeBuildingStandoff) || 8;
    var reach = (u.radius || 10) + standoff;
    if (d < 0.01) {
      var ang = Math.atan2(building.y - u.y, building.x - u.x);
      return { x: building.x + Math.cos(ang) * reach, y: building.y + Math.sin(ang) * reach };
    }
    return { x: cx + (dx / d) * reach, y: cy + (dy / d) * reach };
  }

  function combatApproach(s, u, target) {
    var tr = target.radius || Math.max(target.w || 0, target.h || 0) / 2;
    var d = dist(u.x, u.y, target.x, target.y);
    if (target.kind === 'building' && !u.ranged) {
      var standoff = (RTS.Config.combat && RTS.Config.combat.meleeBuildingStandoff) || 8;
      var edgeDist = distToBuildingEdge(s, u.x, u.y, target);
      var approach = buildingApproachPoint(s, u, target);
      return {
        inRange: edgeDist <= u.range + standoff * 0.5,
        stop: (u.radius || 10) + standoff,
        tx: approach.x,
        ty: approach.y,
        aimX: target.x,
        aimY: target.y,
      };
    }
    return {
      inRange: d <= u.range + tr * 0.4,
      stop: u.range * 0.8 + tr,
      tx: target.x,
      ty: target.y,
      aimX: target.x,
      aimY: target.y,
    };
  }

  function resolveWaterCollision(s, u) {
    var grid = s.map && s.map.terrainGrid;
    if (!grid || !RTS.Terrain) return;
    if (!RTS.Terrain.isWater(grid, u.x, u.y)) {
      u._lastLandX = u.x;
      u._lastLandY = u.y;
      return;
    }
    var best = null, bestD2 = Infinity;
    var samples = 24, ring, i, ang, nx, ny, d2, step;
    for (ring = 1; ring <= 6; ring++) {
      step = (u.radius || 10) + ring * 10;
      for (i = 0; i < samples; i++) {
        ang = (i / samples) * Math.PI * 2;
        nx = u.x + Math.cos(ang) * step;
        ny = u.y + Math.sin(ang) * step;
        if (RTS.Terrain.isWater(grid, nx, ny)) continue;
        d2 = step * step;
        if (d2 < bestD2) { bestD2 = d2; best = { x: nx, y: ny }; }
      }
      if (best) break;
    }
    if (best) {
      u.x = best.x;
      u.y = best.y;
    } else if (u._lastLandX != null) {
      u.x = u._lastLandX;
      u.y = u._lastLandY;
    }
    u.vx = 0;
    u.vy = 0;
  }

  function clampToWorld(u) {
    u.x = Math.max(u.radius, Math.min(RTS.Config.world.w - u.radius, u.x));
    u.y = Math.max(u.radius, Math.min(RTS.Config.world.h - u.radius, u.y));
  }

  function clampUnitTerrain(s, u) {
    resolveWaterCollision(s, u);
    clampToWorld(u);
  }

  function nearestEnemy(s, x, y, team, maxR, uRadius) {
    var best = null, bd = maxR;
    var foeTeam = team === TEAM.PLAYER ? TEAM.ENEMY : TEAM.PLAYER;
    var pad = (RTS.Config.combat && RTS.Config.combat.buildingAcquirePad) || 12;
    var u = s.entities.units;
    for (var i = 0; i < u.length; i++) {
      if (!RTS.canBeAttacked(u[i]) || u[i].team !== foeTeam) continue;
      var d = combatTargetDist(s, x, y, u[i], uRadius);
      if (d < bd) { bd = d; best = u[i]; }
    }
    var b = s.entities.buildings;
    for (var j = 0; j < b.length; j++) {
      if (!RTS.canBeAttacked(b[j]) || b[j].team !== foeTeam) continue;
      var db = combatTargetDist(s, x, y, b[j], uRadius);
      if (db <= maxR + pad && db < bd) { bd = db; best = b[j]; }
    }
    return best;
  }
  RTS.nearestEnemy = nearestEnemy;

  function nearestNode(s, x, y) {
    var probe = { id: '__probe__', x: x, y: y, role: 'pawn', harvest: null };
    return bestNodeForWorker(s, probe, x, y);
  }
  RTS.nearestNode = nearestNode;

  RTS.Harvest = {
    resourcePct: resourcePct,
    resourceIsLow: resourceIsLow,
    resourceSlots: resourceSlots,
    slotWorldPos: slotWorldPos,
    workerAssignedSlot: workerAssignedSlot,
    bestHarvestSlot: bestHarvestSlot,
    nodeAssignedWorkerCount: nodeAssignedWorkerCount,
    nodeHasOpenSlot: nodeHasOpenSlot,
    bestNodeForWorker: bestNodeForWorker,
    scoreNodeForWorker: scoreNodeForWorker,
    mineChunkSize: mineChunkSize,
    assignReturnDeposit: assignDepositTarget,
    resolveReturnDeposit: resolveReturnDeposit,
  };

  function depositVeinFeedback(s, b) {
    if (!b.built || !RTS.isDepositBuilding(b)) return;
    if (b.team !== TEAM.PLAYER) return;
    var node = b.primaryNodeId ? RTS.getById(s, b.primaryNodeId) : null;
    var label = b.type === 'core' ? 'Home vein' : 'Outpost vein';
    if (!node || node.amount <= 0) {
      if (!b._veinDepletedNotified) {
        b._veinDepletedNotified = true;
        RTS.log(s, label + ' depleted — scout and expand', 'warn');
        RTS.toast(s, label + ' depleted');
      }
      return;
    }
    if (RTS.Harvest && RTS.Harvest.resourceIsLow(node) && !b._veinLowNotified) {
      b._veinLowNotified = true;
      RTS.log(s, label + ' running low', 'info');
    }
  }

  function tickAutoMine(s, dt) {
    if (!s.ui.autoMineTick) s.ui.autoMineTick = 0;
    s.ui.autoMineTick -= dt;
    if (s.ui.autoMineTick > 0) return;
    s.ui.autoMineTick = 1.5;
    s.entities.buildings.forEach(function (b) {
      if (b.dead || !b.autoMine || !b.built) return;
      if (b.type !== 'core' && b.type !== 'outpost') return;
      depositVeinFeedback(s, b);
      var node = RTS.nodeForDeposit(s, b);
      if (!node) return;
      s.entities.units.forEach(function (u) {
        if (u.dead || u.team !== b.team || u.role !== 'pawn') return;
        if (u.harvest || u.moveTo || u.target) return;
        if (isConstructionWorker(s, u)) return;
        if (dist(u.x, u.y, b.x, b.y) > 380) return;
        if (RTS.Harvest && RTS.Harvest.nodeAssignedWorkerCount(s, node.id) >= RTS.Config.harvest.maxWorkersPerNode &&
            !RTS.Harvest.nodeHasOpenSlot(s, node.id)) return;
        RTS.orderHarvest(s, u, node.id, { depositOwnerId: b.id });
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

  // ---- Win / loss (Castle / core only — outposts do not decide the match) --
  function castleAlive(s, team) {
    return s.entities.buildings.some(function (b) {
      return b.team === team && !b.dead && b.type === 'core';
    });
  }

  function checkEndGame(s) {
    if (s.scene !== 'playing') return;
    var playerCastle = castleAlive(s, RTS.TEAM.PLAYER);
    var enemyCastle = castleAlive(s, RTS.TEAM.ENEMY);
    if (!enemyCastle) RTS.endMatch(s, 'won');
    else if (!playerCastle) RTS.endMatch(s, 'lost');
  }

  RTS.tauntEffectiveDistance = function (attacker, candidate, actualDistance) {
    if (!attacker || !candidate || candidate.dead || candidate.kind !== 'unit') return actualDistance;
    if (attacker.team !== TEAM.ENEMY) return actualDistance;
    if (!RTS.hasTrait(candidate, 'taunt')) return actualDistance;
    var radius = candidate.tauntRadius ||
      (RTS.Units[candidate.role] && RTS.Units[candidate.role].tauntRadius) || 90;
    return dist(attacker.x, attacker.y, candidate.x, candidate.y) <= radius ? 0 : actualDistance;
  };

  RTS.hasTrait = function(unit, trait) {
    return unit.traits && unit.traits.indexOf(trait) !== -1;
  };

})(window.RTS = window.RTS || {});
