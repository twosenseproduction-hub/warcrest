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
      initAiState(s);
      var cfg = RTS.Config.ai;
      var diff = difficultyMod(cfg);

      s.res.enemy.halcite += (cfg.income + diff.incomeBonus) * dt;

      s.ai.harvestTick -= dt;
      if (s.ai.harvestTick <= 0) {
        s.ai.harvestTick = 1.5;
        assignWorkers(s);
      }

      s.ai.think -= dt;
      if (s.ai.think <= 0) {
        s.ai.think = 1.4 * diff.thinkMul;
        updateStrategyMode(s);
        updateBuildPriorities(s);
        updateRebuildQueue(s);
        updateProduction(s);
      }

      s.ai.squadTick -= dt;
      if (s.ai.squadTick <= 0) {
        s.ai.squadTick = (cfg.squads.refreshInterval || 6) * diff.refreshMul;
        updateDefenseSquads(s);
        refreshSquads(s);
        musterArmy(s);         // gather a real army, then commit it as one push
      }

      if (s.timers.gameTime >= s.timers.nextWave) {
        launchAssaultWave(s);
        s.timers.waveNumber++;
        s.timers.nextWave = s.timers.gameTime + cfg.waveInterval;
      }

      updateEnemyHero(s, dt);   // summon + pilot the enemy champion
    },
  };

  // ---- Enemy champion: summon, pilot like a MOBA hero, and revive on death. --
  function livingEnemyHeroes(s) {
    return enemyUnits(s).filter(function (u) { return u.heroId; });
  }

  function updateEnemyHero(s, dt) {
    var cfg = RTS.Config.ai;
    if (cfg.spawnHero === false || !RTS.makeHero || !RTS.getHeroesForFaction) return;

    var heroes = livingEnemyHeroes(s);
    if (heroes.length) {
      s.ai._heroDeadAt = null;
      heroes.forEach(function (h) {
        s.ai._heroLevel = h.level || 1; s.ai._heroXp = h.xp || 0;     // remember for revive
        pilotHero(s, h);
      });
      return;
    }

    var core = enemyCastle(s); if (!core) return;
    if (!s.ai._heroSpawned) {
      var heroAt = cfg.heroAt != null ? cfg.heroAt : 80;
      if (s.timers.gameTime < heroAt || !enemyBuilding(s, 'foundry')) return;
      summonChampion(s, core, false);
    } else {
      // fallen — revive at home after a delay, keeping its level (Wild Rift style)
      if (s.ai._heroDeadAt == null) s.ai._heroDeadAt = s.timers.gameTime;
      var delay = cfg.heroRespawnDelay != null ? cfg.heroRespawnDelay : 42;
      if (s.timers.gameTime >= s.ai._heroDeadAt + delay) summonChampion(s, core, true);
    }
  }

  function summonChampion(s, core, revive) {
    var roster = RTS.getHeroesForFaction(s.enemyFaction);
    if (!roster.length) return;
    var def = (s.ai._heroId && RTS.getHero && RTS.getHero(s.ai._heroId)) || roster[0];
    var h = RTS.makeHero(s, def.id, TEAM.ENEMY, core.x + 44, core.y + 44, s.enemyFaction);
    if (!h) return;
    s.ai._heroSpawned = true; s.ai._heroId = def.id; s.ai._heroDeadAt = null;
    var lvl = revive ? (s.ai._heroLevel || 1) : 1;
    if (lvl > 1) {                                       // restore earned power on revive
      var dl = lvl - 1;
      h.level = lvl; h.xp = s.ai._heroXp || 0;
      h.maxHp += 40 * dl; h.hp = h.maxHp; h.dmg += 2 * dl;
      if (h._baseStats) { h._baseStats.maxHp += 40 * dl; h._baseStats.dmg += 2 * dl;
        if (RTS.applyHeroItems) RTS.applyHeroItems(h); }
    }
    RTS.log(s, RTS.Factions[s.enemyFaction].name + ' champion ' + (def.shortName || def.name) +
      (revive ? ' returns to the field' : ' takes the field'), 'bad');
  }

  // Pilot one champion: focus-fire the juiciest target, retreat/kite when hurt.
  function pilotHero(s, h) {
    if (h.dead || h._channel) return;
    var cfg = RTS.Config.ai;
    var core = enemyCastle(s);
    var hpRatio = h.hp / Math.max(1, h.maxHp);
    var retreatHp = cfg.heroRetreatHp != null ? cfg.heroRetreatHp : 0.3;
    if (hpRatio < retreatHp) h._retreating = true;
    else if (hpRatio > 0.55) h._retreating = false;

    // best target: enemy hero first, then the weakest nearby foe, nearer = better
    var best = null, bestScore = -Infinity, foes = 0, arr = s.entities.units;
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      if (e.dead || e.kind !== 'unit' || e.team === h.team || e.team === TEAM.NEUTRAL) continue;
      var d = RTS.dist(e.x, e.y, h.x, h.y);
      if (d > 360) continue;
      foes++;
      var score = (e.isHero ? 400 : 0) + (1 - e.hp / Math.max(1, e.maxHp)) * 220 - d * 0.4;
      if (score > bestScore) { bestScore = score; best = e; }
    }

    if (h._retreating && core) {
      // disengage toward home; a ranged champion keeps loosing while it kites
      if (RTS.UnitAI) RTS.UnitAI.setCommand(h, 'move', { pos: { x: core.x, y: core.y } });
      else { h.attackMove = false; h.commandMode = 'move'; h.moveTo = { x: core.x, y: core.y }; }
      h.target = (h.ranged && best) ? best.id : null;
      aiHeroCast(s, h, foes, true);                      // a survival/escape pop is still welcome
      return;
    }
    if (best) h.target = best.id;                        // focus-fire the priority target
    if (foes) aiHeroCast(s, h, foes, false);
  }

  // Spend one ability per cadence: highest unlocked + ready, ultimate held for a
  // cluster. Targeted spells follow h.target set by pilotHero (focus-fire).
  function aiHeroCast(s, h, foes, retreating) {
    if (h._channel) return;
    var now = s.timers.gameTime;
    if ((h._aiCastCd || 0) > now) return;
    var hero = RTS.getHero && RTS.getHero(h.heroId);
    if (!hero || !hero.abilities || !foes) return;
    for (var k = hero.abilities.length - 1; k >= 0; k--) {
      var ab = hero.abilities[k];
      if (ab.unlockLevel && (h.level || 1) < ab.unlockLevel) continue;
      if (h._abilityCd && (h._abilityCd[ab.id] || 0) > now) continue;
      if (k === 2 && foes < 2 && !retreating) continue;  // save the ultimate for 2+ targets
      if (RTS.triggerHeroAbility && RTS.triggerHeroAbility(s, h.id, k)) {
        h._aiCastCd = now + (retreating ? 3.2 : 2.0);
        return;
      }
    }
  }

  function initAiState(s) {
    if (!s.ai) {
      s.ai = {
        think: 0,
        harvestTick: 0,
        composition: 0,
        mode: 'boom',
        squads: [],
        rebuildQueue: [],
        lastModeChange: 0,
        threatLevel: 0,
        squadTick: 0,
        nextSquadId: 1,
      };
    }
  }

  function difficultyMod(cfg) {
    var key = cfg.difficulty || 'normal';
    return (cfg.difficultyMods && cfg.difficultyMods[key]) || cfg.difficultyMods.normal;
  }

  function combatPower(units) {
    var p = 0;
    units.forEach(function (u) {
      if (u.role === 'pawn') return;
      p += u.role === 'warrior' ? 3 : (u.role === 'monk' ? 1.5 : 1);
    });
    return p;
  }

  // ---- Composition (react to what the PLAYER is fielding) -------------------
  function playerArmyUnits(s) {
    return s.entities.units.filter(function (u) {
      return u.team === TEAM.PLAYER && !u.dead && u.role !== 'pawn';
    });
  }
  function categoryOf(role) {
    if (role === 'warrior' || role === 'lancer') return 'frontline';
    if (role === 'archer' || role === 'siege') return 'ranged';
    if (role === 'monk') return 'caster';
    return 'frontline';
  }
  function compCounts(units) {
    var c = { frontline: 0, ranged: 0, caster: 0, total: 0 };
    units.forEach(function (u) { c[categoryOf(u.role)]++; c.total++; });
    return c;
  }
  function currentArmyRatio(s) {
    var army = enemyUnits(s).filter(function (u) { return u.role !== 'pawn'; });
    return combatPower(army) / Math.max(1, combatPower(playerArmyUnits(s)));
  }

  // Choose the next fighting unit to train: fill the most-deficient slot of our
  // target composition, counter-biased against the player's mix. Returns
  // { role, bldg } respecting tech (caster/lancer need a Keep + War Forge).
  function chooseArmyRole(s) {
    var cfg = RTS.Config.ai;
    var comp = cfg.comp || { frontline: 0.5, ranged: 0.34, caster: 0.16 };
    var own = compCounts(enemyUnits(s).filter(function (u) { return u.role !== 'pawn'; }));
    var foe = compCounts(playerArmyUnits(s));
    var want = { frontline: comp.frontline, ranged: comp.ranged, caster: comp.caster };

    // Counter the player: kite a melee-heavy army with ranged; close on a
    // ranged-heavy army with (armored) frontline.
    if (foe.total >= 3) {
      var fFront = foe.frontline / foe.total, fRanged = foe.ranged / foe.total;
      if (fFront > 0.55) { want.ranged += 0.12; want.caster += 0.04; want.frontline -= 0.16; }
      else if (fRanged > 0.50) { want.frontline += 0.16; want.ranged -= 0.10; want.caster -= 0.06; }
    }

    var foundry = enemyBuilding(s, 'foundry');
    var forge = enemyBuilding(s, 'forge');
    var tier2 = RTS.Config.teamTier ? RTS.Config.teamTier(s, TEAM.ENEMY) >= 2 : false;
    var canElite = !!(forge && !forge.upgrading && tier2);   // lancer + monk gate
    if (!canElite) {                                          // fold caster share into what we can build
      want.frontline += want.caster * 0.6; want.ranged += want.caster * 0.4; want.caster = 0;
    }

    function share(k) { return own.total ? own[k] / own.total : 0; }
    var cats = canElite ? ['frontline', 'ranged', 'caster'] : ['frontline', 'ranged'];
    var pick = 'frontline', bestDef = -Infinity;
    cats.forEach(function (k) { var def = want[k] - share(k); if (def > bestDef) { bestDef = def; pick = k; } });

    if (pick === 'caster') return { role: 'monk', bldg: forge };
    if (pick === 'ranged') return { role: 'archer', bldg: foundry };
    // frontline: mix a minority of elite Knights in once the Forge is up
    if (canElite) {
      var lancers = enemyUnits(s, 'lancer').length, warriors = enemyUnits(s, 'warrior').length;
      if (lancers < warriors * 0.5) return { role: 'lancer', bldg: forge };
    }
    return { role: 'warrior', bldg: foundry };
  }

  // ---- Muster & coordinated push ------------------------------------------
  function isDefender(s, u) {
    if (!u.squadId) return false;
    var sq = s.ai.squads.find(function (q) { return q.id === u.squadId; });
    return !!(sq && sq.type === 'defense');
  }
  function activeAssault(s) {
    return s.ai.squads.find(function (sq) { return sq.type === 'assault' && sq.mode !== 'retreat'; });
  }
  // Non-pawn units not already committed to a live assault.
  function freeArmy(s) {
    var committed = {};
    s.ai.squads.forEach(function (sq) {
      if (sq.type === 'assault' && sq.mode !== 'retreat') {
        sq.unitIds.forEach(function (id) { committed[id] = 1; });
      }
    });
    return enemyUnits(s).filter(function (u) { return u.role !== 'pawn' && !committed[u.id]; });
  }
  function homeThreatened(s) {
    var core = enemyCastle(s);
    if (!core) return false;
    var r = (RTS.Config.ai.squads && RTS.Config.ai.squads.defenseRadius) || 420;
    return s.entities.units.some(function (u) {
      return u.team === TEAM.PLAYER && !u.dead && RTS.dist(u.x, u.y, core.x, core.y) < r;
    });
  }
  function stagingPoint(s, core, pcore) {
    if (!pcore) return { x: core.x, y: core.y };
    var p = RTS.Config.ai.push || {};
    var ang = Math.atan2(pcore.y - core.y, pcore.x - core.x);
    var d = p.stagingDist || 300;
    var W = RTS.Config.world.w, H = RTS.Config.world.h;
    var x = Math.max(60, Math.min(W - 60, core.x + Math.cos(ang) * d));
    var y = Math.max(60, Math.min(H - 60, core.y + Math.sin(ang) * d));
    if (RTS.Terrain && RTS.Terrain.isWater && s.map &&
        RTS.Terrain.isWater(s.map.terrainGrid, x, y)) { x = core.x; y = core.y; }
    return { x: x, y: y };
  }
  function pushThreshold(s, armyRatio) {
    var p = RTS.Config.ai.push || {};
    var bar = Math.min(p.max || 34, (p.base || 9) + (p.growthPerMin || 5) * (s.timers.gameTime / 60));
    if (armyRatio > 1.6) bar *= (p.advantageMul || 0.6);       // press the advantage
    else if (armyRatio < 0.9) bar *= (p.behindMul || 1.6);      // behind → keep building
    return bar;
  }
  function commitAssault(s, units, why) {
    var pcore = RTS.playerCore(s);
    if (!pcore || !units.length) return false;
    var sq = makeSquad(s, 'assault', units.map(function (u) { return u.id; }),
      { x: pcore.x, y: pcore.y }, { minStrength: 1, mode: 'march' });
    s.ai.squads.push(sq);
    assignSquadOrders(s, sq);
    if (why === 'wave') {
      if (s.timers.waveNumber === 0) {
        RTS.log(s, RTS.Factions[s.enemyFaction].name + ' scouts prowling the Reach', 'warn');
      } else {
        RTS.log(s, RTS.Factions[s.enemyFaction].name + ' assault wave inbound!', 'bad');
        RTS.toast(s, 'Wave incoming — defend your ' + RTS.nameFor(s.playerFaction, 'core'));
      }
    } else {
      RTS.log(s, RTS.Factions[s.enemyFaction].name + ' masses for an assault on your ' +
        RTS.nameFor(s.playerFaction, 'core'), 'bad');
      RTS.toast(s, 'A war-host marches on your ' + RTS.nameFor(s.playerFaction, 'core'));
    }
    return true;
  }
  // Gather loose units at a forward staging point; push as ONE force at mass.
  function musterArmy(s) {
    var core = enemyCastle(s), pcore = RTS.playerCore(s);
    if (!core || !pcore) return;
    // Don't march out while home is under attack — defend first. Checked
    // directly (not via the debounced mode label) so recall can't thrash.
    if (s.ai.mode === 'hold' || homeThreatened(s)) return;
    var free = freeArmy(s).filter(function (u) { return !isDefender(s, u); });
    if (!free.length) return;

    var stage = stagingPoint(s, core, pcore);
    free.forEach(function (u) {
      if (u.squadId) return;
      u.guardOrigin = stage;
      if (RTS.dist(u.x, u.y, stage.x, stage.y) > 70) {
        if (RTS.UnitAI) RTS.UnitAI.applyCommandFromOrder(u, true, stage.x, stage.y);
        u.attackMove = true; u.moveTo = { x: stage.x, y: stage.y };
      }
    });

    var bar = pushThreshold(s, currentArmyRatio(s));
    if ((s.ai.mode === 'desperation' || combatPower(free) >= bar) && !activeAssault(s)) {
      commitAssault(s, free, 'muster');
    }
  }

  function updateStrategyMode(s) {
    var cfg = RTS.Config.ai;
    var now = s.timers.gameTime;
    if (now - s.ai.lastModeChange < cfg.modeDebounce) return;

    var core = enemyCastle(s);
    var pcore = RTS.playerCore(s);
    if (!core) return;

    var army = enemyUnits(s).filter(function (u) { return u.role !== 'pawn'; });
    var playerArmy = s.entities.units.filter(function (u) {
      return u.team === TEAM.PLAYER && !u.dead && u.role !== 'pawn';
    });
    var armyRatio = combatPower(army) / Math.max(1, combatPower(playerArmy));
    var homeLow = homeGoldDepleted(s, core);
    var playerNear = pcore && s.entities.units.some(function (u) {
      return u.team === TEAM.PLAYER && !u.dead &&
        RTS.dist(u.x, u.y, core.x, core.y) < (cfg.squads.defenseRadius || 420);
    });

    var next = s.ai.mode;
    if (!castleAlive(s, TEAM.ENEMY)) return;
    if (playerNear) next = 'hold';
    else if (armyRatio < 0.45) next = 'desperation';
    else if (homeLow && enemyOutposts(s).length < 2) next = 'expand';
    else if (armyRatio > 1.1 && now > cfg.firstWaveAt + 20) next = 'assault';
    else if (now > cfg.firstWaveAt && armyRatio > 0.7) next = 'harass';
    else if (now < cfg.firstWaveAt + 10) next = 'boom';
    else next = 'hold';

    if (next !== s.ai.mode) {
      s.ai.mode = next;
      s.ai.lastModeChange = now;
    }
  }

  function castleAlive(s, team) {
    return s.entities.buildings.some(function (b) {
      return b.team === team && !b.dead && b.type === 'core';
    });
  }

  function updateRebuildQueue(s) {
    if (s.ai.mode !== 'hold' && s.ai.mode !== 'desperation') return;
    var cfg = RTS.Config.ai;
    var pri = cfg.rebuildPriority || [];
    pri.forEach(function (type) {
      if (type === 'core') return;
      if (!enemyBuildingAny(s, type) && s.ai.rebuildQueue.indexOf(type) < 0) {
        s.ai.rebuildQueue.push(type);
      }
    });
    if (s.ai.rebuildQueue.length) {
      var type = s.ai.rebuildQueue[0];
      if (tryAiBuild(s, type)) s.ai.rebuildQueue.shift();
    }
  }

  function makeSquad(s, type, unitIds, targetPos, opts) {
    opts = opts || {};
    var cfg = RTS.Config.ai.squads || {};
    return {
      id: 'sq' + (s.ai.nextSquadId++),
      type: type,
      unitIds: unitIds.slice(),
      targetPos: { x: targetPos.x, y: targetPos.y },
      minStrength: opts.minStrength || cfg.assaultMinStrength || 4,
      mode: opts.mode || 'rally',
      retreatThreshold: cfg.retreatHpRatio || 0.32,
      refreshAt: s.timers.gameTime + 4,
    };
  }

  function assignSquadOrders(s, squad) {
    var cfg = RTS.Config.ai.squads || {};
    var units = squad.unitIds.map(function (id) { return RTS.getById(s, id); })
      .filter(function (u) { return u && !u.dead && u.role !== 'pawn'; });
    if (!units.length) return;

    var tx = squad.targetPos.x, ty = squad.targetPos.y;
    var jitter = cfg.rallyDist || 90;
    units.forEach(function (u, i) {
      var ang = (i / Math.max(1, units.length)) * Math.PI * 2;
      var dest = {
        x: tx + Math.cos(ang) * (jitter * 0.35),
        y: ty + Math.sin(ang) * (jitter * 0.35),
      };
      u.attackMove = true;
      u.target = null;
      u.moveTo = dest;
      u.squadId = squad.id;
      if (RTS.UnitAI) {
        RTS.UnitAI.applyCommandFromOrder(u, true, dest.x, dest.y);
      }
      if (RTS.Pathfind) RTS.Pathfind.clearNav(u);
    });
    // Preserve an explicit 'retreat' (set by recall / low-HP fallback) — otherwise
    // this call would clobber it back to 'march' and the squad would never
    // register as retreating (a long-standing bug that also broke home defense).
    squad.mode = squad.mode === 'retreat' ? 'retreat'
      : (squad.type === 'assault' ? 'march' : 'fight');
  }

  function refreshSquads(s) {
    var cfg = RTS.Config.ai;

    s.ai.squads = s.ai.squads.filter(function (sq) {
      var alive = sq.unitIds.filter(function (id) {
        var u = RTS.getById(s, id);
        return u && !u.dead;
      });
      sq.unitIds = alive;
      return alive.length > 0;
    });

    s.ai.squads.forEach(function (sq) {
      if (s.timers.gameTime < sq.refreshAt) return;
      sq.refreshAt = s.timers.gameTime + (cfg.squads.refreshInterval || 6);

      var units = sq.unitIds.map(function (id) { return RTS.getById(s, id); })
        .filter(function (u) { return u && !u.dead; });
      if (!units.length) return;

      var avgHp = 0;
      units.forEach(function (u) { avgHp += u.hp / u.maxHp; });
      avgHp /= units.length;

      if (avgHp < sq.retreatThreshold && sq.type === 'assault') {
        var core = enemyCastle(s);
        if (core) {
          sq.targetPos = { x: core.x, y: core.y };
          sq.mode = 'retreat';
          assignSquadOrders(s, sq);
        }
        return;
      }

      // A retreating assault that has made it home / healed up disbands, so its
      // survivors flow back into the muster pool for the next coordinated push.
      if (sq.type === 'assault' && sq.mode === 'retreat') {
        var home = enemyCastle(s);
        var allHome = home && units.every(function (u) {
          return RTS.dist(u.x, u.y, home.x, home.y) < 260;
        });
        if (avgHp > 0.7 || allHome) {
          units.forEach(function (u) { u.squadId = null; });
          sq._disband = true;
        }
        return;
      }

      var stalled = units.every(function (u) {
        return !u.target && u.moveTo &&
          RTS.dist(u.x, u.y, u.moveTo.x, u.moveTo.y) < 24;
      });
      if (stalled || sq.mode === 'march' || sq.mode === 'reform') {
        assignSquadOrders(s, sq);
      }
    });

    // Drop disbanded squads (their survivors re-muster via musterArmy).
    s.ai.squads = s.ai.squads.filter(function (sq) { return !sq._disband; });
  }

  function updateDefenseSquads(s) {
    var cfg = RTS.Config.ai.squads || {};
    var core = enemyCastle(s);
    if (!core) return;

    var threats = s.entities.units.filter(function (u) {
      return u.team === TEAM.PLAYER && !u.dead &&
        RTS.dist(u.x, u.y, core.x, core.y) < (cfg.defenseRadius || 420);
    });
    if (!threats.length) return;

    // Home is under attack — recall the field army to defend (a real player
    // doesn't keep marching on your base while their own is burning).
    var away = s.ai.squads.find(function (sq) { return sq.type === 'assault' && sq.mode !== 'retreat'; });
    if (away) {
      away.mode = 'retreat';
      away.targetPos = { x: core.x, y: core.y };
      assignSquadOrders(s, away);
    }

    var defenders = enemyUnits(s).filter(function (u) {
      return u.role !== 'pawn' &&
        RTS.dist(u.x, u.y, core.x, core.y) < cfg.defenseRadius * 1.1;
    });
    if (!defenders.length) return;

    var existing = s.ai.squads.find(function (sq) { return sq.type === 'defense'; });
    if (!existing) {
      existing = makeSquad(s, 'defense',
        defenders.map(function (u) { return u.id; }),
        { x: core.x, y: core.y },
        { minStrength: 2, mode: 'fight' });
      s.ai.squads.push(existing);
    }
    existing.unitIds = defenders.map(function (u) { return u.id; });
    defenders.forEach(function (u) {
      u.squadId = existing.id;
      u.attackMove = false;
      u.commandMode = 'guard';
      u.guardOrigin = { x: core.x, y: core.y };
      if (RTS.UnitAI) {
        RTS.UnitAI.setCommand(u, 'guard', { guardOrigin: { x: core.x, y: core.y } });
      }
    });
  }

  // Timed wave: a guaranteed cadence of pressure. Commits whatever isn't
  // already attacking (muster usually beats it to the punch once the AI has
  // mass; this keeps a floor of aggression if it's turtling).
  function launchAssaultWave(s) {
    var pcore = RTS.playerCore(s);
    if (!pcore) return;
    var cfg = RTS.Config.ai;
    var diff = difficultyMod(cfg);
    var minForce = diff.assaultMin || cfg.squads.assaultMinStrength || 4;

    var free = freeArmy(s).filter(function (u) { return !isDefender(s, u); });
    if (combatPower(free) < minForce && s.ai.mode !== 'desperation') return;
    commitAssault(s, free, 'wave');
  }

  function updateBuildPriorities(s) {
    buildStructures(s);
  }

  function updateProduction(s) {
    produce(s);
  }

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
    if (RTS.Harvest) {
      var probe = { id: '__ai__', x: ax, y: ay, role: 'pawn', harvest: null };
      return RTS.Harvest.bestNodeForWorker(s, probe, ax, ay);
    }
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
    if (core && core.type === 'core') {
      var linked = RTS.nodeForDeposit(s, core);
      if (linked) return linked.amount < 500;
      if (core.primaryNodeId) {
        var dead = RTS.getById(s, core.primaryNodeId);
        return !dead || dead.amount < 500;
      }
    }
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
    var core = enemyCastle(s);
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
    RTS.markBuildingFootprint(s, b, true);
    b.rally = { x: node.x, y: node.y };
    b.autoMine = true;
    RTS.assignPrimaryNodeToDeposit(s, b, node);
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
          RTS.log(s, 'Enemy raising a ' + RTS.nameFor(s.enemyFaction, 'outpost') +
            ' at a new Ironstone field', 'warn');
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

    var core = enemyCastle(s);
    if (!core || RTS.dist(x, y, core.x, core.y) > 360) return false;
    return true;
  }

  function aiPlaceBuilding(s, type, x, y) {
    if (!aiCanPlace(s, type, x, y)) return false;
    var cost = RTS.Buildings[type].cost;
    if (!RTS.canAfford(s, TEAM.ENEMY, cost)) return false;
    s.res.enemy.halcite -= cost;
    var b = RTS.makeBuilding(s, type, TEAM.ENEMY, x, y, s.enemyFaction, false);
    RTS.markBuildingFootprint(s, b, true);
    if (RTS.Pathfind) RTS.Pathfind.markDirty(s);
    RTS.assignBuilder(s, b);
    return true;
  }

  function minBuildRing(core, spec) {
    var chw = core.w / 2, chh = core.h / 2;
    var hw = spec.w / 2, hh = spec.h / 2;
    return Math.max(chw + hw + 18, chh + hh + 18);
  }

  function tryAiBuild(s, type) {
    if (enemyBuildingAny(s, type)) return false;
    var core = enemyCastle(s);
    if (!core) return false;
    var spec = RTS.Buildings[type];
    var minRing = minBuildRing(core, spec);
    var maxRing = 340;
    var pcore = RTS.playerCore(s);
    var toward = pcore
      ? Math.atan2(pcore.y - core.y, pcore.x - core.x)
      : Math.PI;

    for (var ring = minRing; ring <= maxRing; ring += 28) {
      var steps = Math.max(12, Math.ceil(ring / 14));
      var best = null, bestScore = -Infinity;
      for (var a = 0; a < steps; a++) {
        var ang = (a / steps) * Math.PI * 2;
        var x = core.x + Math.cos(ang) * ring;
        var y = core.y + Math.sin(ang) * ring;
        if (!aiCanPlace(s, type, x, y)) continue;
        var towardBias = Math.cos(ang - toward);
        var score = towardBias * 40 - Math.abs(ang) * 0.01;
        if (score > bestScore) { bestScore = score; best = { x: x, y: y }; }
      }
      if (best && aiPlaceBuilding(s, type, best.x, best.y)) return true;
    }
    return false;
  }

  function buildStructures(s) {
    var workers = enemyUnits(s, 'pawn').length;
    var core = enemyCastle(s);
    if (!core) return;

    if (!enemyBuildingAny(s, 'conduit') && workers >= 2 &&
        s.res.enemy.supplyUsed + 1 > s.res.enemy.supplyCap - 2 &&
        RTS.canAfford(s, TEAM.ENEMY, RTS.Buildings.conduit.cost)) {
      tryAiBuild(s, 'conduit');
    }

    if (!enemyBuildingAny(s, 'foundry') && workers >= 1 &&
        RTS.canAfford(s, TEAM.ENEMY, RTS.Buildings.foundry.cost)) {
      tryAiBuild(s, 'foundry');
    }

    // Tech up to a Keep (tier 2) so elite units (Knight/Priest) unlock.
    if (enemyBuilding(s, 'foundry') && core.type === 'core' &&
        (core.level || 1) < 2 && !core.upgrading &&
        s.timers.gameTime > 60 &&
        RTS.Config.upgradeCost &&
        RTS.canAfford(s, TEAM.ENEMY, RTS.Config.upgradeCost(core))) {
      RTS.upgradeBuilding(s, core.id);
    }

    // War Forge — worth building once we have (or are getting) a Keep.
    if (enemyBuilding(s, 'foundry') && !enemyBuildingAny(s, 'forge') &&
        ((core.level || 1) >= 2 || core.upgrading) &&
        s.timers.gameTime > 60 &&
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
      var node = RTS.nodeForDeposit(s, dep);
      if (node) RTS.orderHarvest(s, w, node.id, { depositOwnerId: dep.id });
    });
  }

  function enemyCastle(s) {
    return s.entities.buildings.find(function (b) {
      return b.team === TEAM.ENEMY && !b.dead && b.type === 'core';
    });
  }

  function trainFrom(s, bldg, role) {
    if (!bldg || bldg.upgrading || bldg.queue.length >= 2) return false;
    return !!RTS.train(s, bldg, role);
  }

  function produce(s) {
    var cfg = RTS.Config.ai;
    var core = enemyCastle(s);
    if (!core) return;

    // --- Economy: saturate mining — scale workers with the number of bases ---
    var eco = cfg.economy || {};
    var deposits = teamDeposits(s, TEAM.ENEMY).length || 1;
    var workerTarget = Math.min(eco.maxWorkers || 14, (eco.workersPerBase || 5) * deposits);
    workerTarget = Math.max(workerTarget, cfg.desiredWorkers || 3);
    var workers = enemyUnits(s, 'pawn').length;
    var pawnCost = RTS.Config.unitCost ? RTS.Config.unitCost('pawn', s.enemyFaction) : 45;
    if (workers < workerTarget && core.queue.length === 0 &&
        RTS.canAfford(s, TEAM.ENEMY, pawnCost)) {
      RTS.train(s, core, 'pawn');
    }

    // --- How big an army to aim for right now -------------------------------
    var army = enemyUnits(s).filter(function (u) { return u.role !== 'pawn'; }).length;
    var queued = 0;
    s.entities.buildings.forEach(function (b) {
      if (b.team === TEAM.ENEMY) queued += b.queue.length;
    });

    var target = Math.min(cfg.maxArmy, 4 + Math.floor(s.timers.gameTime / 22));
    if (s.ai.mode === 'assault' || s.ai.mode === 'desperation') target = Math.min(cfg.maxArmy, target + 4);
    if (s.ai.mode === 'boom') target = Math.max(4, target - 2);
    if (army + queued >= target) return;

    // --- Composition: counter the player, keep both production lines busy ----
    var choice = chooseArmyRole(s);
    if (!trainFrom(s, choice.bldg, choice.role)) {
      // chosen line unavailable/busy → fall back to basic infantry / ranged.
      var foundry = enemyBuilding(s, 'foundry');
      trainFrom(s, foundry, choice.role === 'archer' ? 'archer' : 'warrior');
    }
  }

})(window.RTS = window.RTS || {});
