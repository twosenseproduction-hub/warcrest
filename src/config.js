/* ============================================================================
 * Verath — config.js
 * Central balance + tuning constants. Tweak values here to rebalance the game.
 * All game systems read from RTS.Config / RTS.Units / RTS.Buildings.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  // ---- Core balance knobs (edit these first) -------------------------------
  var isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  var isPhone  = typeof window !== 'undefined' && window.innerWidth < 520;

  RTS.Config = {
    isMobile: isMobile,
    isPhone:  isPhone,
    world: { w: 3072, h: 1920 },
    camera: {
      minZoom: 0.55, maxZoom: 2.0,
      default: isPhone ? 1.08 : (isMobile ? 1.02 : 0.92),
      panInertia: 0.86,
    },
    touch: {
      slopPx:        isMobile ? 42 : 18,
      dragPx:        isMobile ? 20 : 12,
      uiBlockMs:     420,
      longPressMs:   isMobile ? 400 : 460,
      doubleTapMs:   320,
      menuHoldMs:    280,
      twoFingerTapMs: 280,
    },

    // Economy
    startResources:  280,
    startSupplyCap:  12,
    supplyPerPylon:  8,
    livestock: {
      maxPerPasture:  3,
      supplyPerAnimal: 4,
      trainTime:      14,
      trainCost:      30,
    },
    maxSupplyCap:    80,
    passiveTrickle:  0.0,

    mineAmounts: {
      starting:    12500,
      expansion:   5000,
      startRadius: 300,
    },

    harvest: {
      rate:                 8,
      capacity:             6,
      reach:                42,
      depositReach:         165,
      depositStop:          22,
      depositApproachStop:  12,
      depositTriggerR:      38,
      depositStuckSec:      1.2,
      mineCycleSec:         0.45,
      slotCount:            6,
      slotReach:            14,
      idealWorkersPerNode:  2,
      maxWorkersPerNode:    4,
      lowNodePct:           0.25,
      minNodeAmount:        300,
    },

    // AI difficulty / pacing
    ai: {
      startResources:   280,
      income:           0,
      firstWaveAt:      70,
      waveInterval:     52,
      waveGrowth:       1.18,
      maxArmy:          26,
      pawnCount:        3,
      retaliate:        true,
      difficulty:       'normal',
      modeDebounce:     18,
      desiredWorkers:   3,
      rebuildPriority:  ['foundry', 'conduit', 'forge', 'core'],
      squads: {
        assaultMinStrength: 4,
        harassMinStrength:  2,
        defenseRadius:      420,
        rallyDist:          90,
        refreshInterval:    6,
        retreatHpRatio:     0.32,
      },
      difficultyMods: {
        easy:   { thinkMul: 1.55, assaultMin: 6, refreshMul: 1.4,  incomeBonus: 0    },
        normal: { thinkMul: 1.0,  assaultMin: 4, refreshMul: 1.0,  incomeBonus: 0    },
        hard:   { thinkMul: 0.82, assaultMin: 3, refreshMul: 0.75, incomeBonus: 0.08 },
        brutal: { thinkMul: 0.68, assaultMin: 3, refreshMul: 0.6,  incomeBonus: 0.15 },
      },
    },

    // Combat feel
    combat: {
      attentionIdle:        1.55,
      attentionAttackMove:  2.0,
      attentionChase:       2.1,
      meleeBuildingStandoff: 8,
      buildingAcquirePad:   12,
      roles: {
        lancer:  { acquireMul: 1.8, chaseRange: 205 },
        archer:  { acquireMul: 2.2, chaseRange: 240 },
        monk:    { acquireMul: 1.5, chaseRange: 165 },
        warrior: { acquireMul: 1.7, chaseRange: 190 },
        default: { acquireMul: 1.5, chaseRange: 200 },
      },
      pawn: {
        retaliate:          true,
        dangerRadius:       56,
        retaliateChase:     72,
        retaliateDuration:  2.4,
      },
      siege: {
        unfinishedBonus:   42,
        productionBonus:   30,
      },
    },

    // ---- Faction passive traits -------------------------------------------
    // Iron Crown — Formation Bonus
    // When 3+ Crown units are within formationRadius of the same target,
    // all attacking units deal +formationDmgBonus% damage to that target.
    formationBonus: {
      minUnits:   3,
      radius:     120,
      dmgBonus:   0.15,
    },

    // Raider Horde — Blood Frenzy
    // When a Horde unit dies, nearby Horde units gain +atkSpeedBonus for duration.
    bloodFrenzy: {
      radius:         180,
      atkSpeedBonus:  0.12,
      duration:       4,
    },

    // Troll — Trollblood regen
    // Regen only activates after trollRegenGraceSec since last hit received.
    trollblood: {
      regenPerSec:   12,
      graceSec:      2.0,
    },

    // Gnoll — poison on hit
    gnollPoison: {
      dmgPerSec:  3,
      duration:   4,
    },

    // Archer — stand-still bonus
    archerStill: {
      dmgBonus:      0.20,
      stillThreshold: 8,   // px/sec below which archer counts as "standing still"
    },

    // Monk — damage reduction aura
    monkAura: {
      radius:       130,
      dmgReduction: 0.10,
    },

    separation:           150,
    pawnSeparationMul:    0.28,
    unitCollisionGap:     4,
    pawnCollisionGap:     -6,
    unitOverlapIterations: 3,
    projectileSpeed:      520,
    hitFlash:             0.16,
    muzzleFlash:          0.09,
    corpseFade:           1.2,
    maxEffects:           60,

    matchSoftCapMin: 14,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  RTS.Resource    = { label: 'Ironstone' };
  RTS.resourceLabel = function () { return RTS.Resource.label; };

  RTS.TEAM = { PLAYER: 'player', ENEMY: 'enemy', NEUTRAL: 'neutral' };

  // =========================================================================
  // UNITS
  // Each unit entry carries its base stats plus a `traits` array describing
  // any passive behaviours the systems layer should activate.
  // =========================================================================
  RTS.Units = {

    // ---- Iron Crown units --------------------------------------------------

    pawn: {
      role: 'pawn', label: 'Pawn', glyph: 'circle', faction: 'aurex',
      hp: 55, speed: 100, dmg: 5, range: 22, rof: 1.0,
      cost: 40, supply: 1, build: 0, canHarvest: true, canBuild: true,
      traits: [],
      desc: 'Harvests Ironstone and raises structures.',
    },

    lancer: {
      role: 'lancer', label: 'Lancer', glyph: 'diamond', faction: 'aurex',
      hp: 60, speed: 178, dmg: 12, range: 48, rof: 0.55,
      cost: 50, supply: 1, build: 0,
      traits: ['formation_bonus', 'building_bane'],
      // building_bane: +25% damage vs buildings
      buildingDmgBonus: 0.25,
      desc: 'Fast melee skirmisher. Bonus damage vs buildings.',
    },

    archer: {
      role: 'archer', label: 'Archer', glyph: 'tri', faction: 'aurex',
      hp: 70, speed: 110, dmg: 11, range: 145, rof: 0.62,
      cost: 65, supply: 1, build: 0, ranged: true,
      traits: ['formation_bonus', 'archer_still'],
      desc: 'Ranged backbone. +20% damage when standing still.',
    },

    monk: {
      role: 'monk', label: 'Monk', glyph: 'cross', faction: 'aurex',
      hp: 85, speed: 105, dmg: 0, range: 115, rof: 0.7, heal: 12,
      cost: 95, supply: 2, build: 0, healer: true,
      traits: ['formation_bonus', 'monk_aura'],
      desc: 'Heals nearby allies. Reduces incoming damage to allies within range by 10%.',
    },

    warrior: {
      role: 'warrior', label: 'Warrior', glyph: 'hex', faction: 'aurex',
      hp: 260, speed: 58, dmg: 32, range: 48, rof: 0.85,
      cost: 130, supply: 3, build: 0,
      traits: ['formation_bonus', 'taunt'],
      // taunt: nearby enemies within tauntRadius prefer to target this unit
      tauntRadius: 90,
      desc: 'Armored frontline. Draws enemy attacks toward himself.',
    },

    // ---- Raider Horde units ------------------------------------------------

    gnome: {
      role: 'pawn', label: 'Gnome', glyph: 'circle', faction: 'cinder',
      hp: 45, speed: 115, dmg: 4, range: 22, rof: 1.0,
      cost: 30, supply: 1, build: 0, canHarvest: true, canBuild: true,
      traits: ['blood_frenzy'],
      desc: 'Harvests Ironstone and raises structures. Cheaper but squishier than a Pawn.',
    },

    spear_goblin: {
      role: 'lancer', label: 'Spear Goblin', glyph: 'diamond', faction: 'cinder',
      hp: 44, speed: 200, dmg: 10, range: 55, rof: 0.55,
      cost: 35, supply: 1, build: 0,
      traits: ['blood_frenzy'],
      desc: 'Fastest unit in Verath. Glass cannon — hits first, dies fast.',
    },

    gnoll: {
      role: 'archer', label: 'Gnoll', glyph: 'tri', faction: 'cinder',
      hp: 58, speed: 125, dmg: 13, range: 120, rof: 0.62,
      cost: 55, supply: 1, build: 0, ranged: true,
      traits: ['blood_frenzy', 'gnoll_poison'],
      desc: 'Ranged attacker. Each hit applies poison — 3 dmg/sec for 4s.',
    },

    hex_shaman: {
      role: 'monk', label: 'Hex Shaman', glyph: 'cross', faction: 'cinder',
      hp: 70, speed: 100, dmg: 6, range: 125, rof: 0.7,
      cost: 80, supply: 2, build: 0, ranged: true,
      traits: ['blood_frenzy', 'hex_slow'],
      // hex_slow: hits slow target by 15% for 2s
      hexSlowPct: 0.15,
      hexSlowDuration: 2.0,
      desc: 'Ranged attacker. Slows enemies on hit by 15% for 2s.',
    },

    troll: {
      role: 'warrior', label: 'Troll', glyph: 'hex', faction: 'cinder',
      hp: 210, speed: 68, dmg: 28, range: 50, rof: 0.85,
      cost: 105, supply: 3, build: 0,
      traits: ['blood_frenzy', 'trollblood'],
      desc: 'Regenerates 12hp/sec when not taking damage. Pull back to recover.',
    },

  };

  // ---- Buildings -----------------------------------------------------------
  RTS.Buildings = {
    core: {
      type: 'core', label: 'Citadel Keep', w: 256, h: 192,
      hp: 1600, cost: 0, build: 0, deposit: true,
      trains: ['pawn'], desc: 'Main base. Trains workers, banks Ironstone.',
    },
    outpost: {
      type: 'outpost', label: 'Forward Bastion', w: 128, h: 128,
      hp: 1400, cost: 320, build: 42, deposit: true, expansion: true,
      trains: ['pawn'],
      desc: 'Expansion base. Build beside an Ironstone field.',
    },
    conduit: {
      type: 'conduit', label: 'Sheep Pen', w: 192, h: 192,
      hp: 420, cost: 65, build: 10, isPasture: true,
      trains: ['_livestock'],
      desc: 'Raise livestock to increase supply cap.',
    },
    foundry: {
      type: 'foundry', label: 'Barracks', w: 192, h: 128,
      hp: 760, cost: 120, build: 18,
      trains: ['lancer', 'archer', 'monk'],
      desc: 'Produces Lancers, Archers, and Monks.',
    },
    forge: {
      type: 'forge', label: 'War Forge', w: 192, h: 192,
      hp: 980, cost: 175, build: 26,
      trains: ['warrior'],
      desc: 'Produces Warriors.',
    },
    turret: {
      type: 'turret', label: 'Arrow Tower', w: 64, h: 128,
      hp: 520, cost: 100, build: 14,
      defense: true, dmg: 20, range: 178, rof: 0.7, ranged: true,
      desc: 'Automated defense tower.',
    },
  };

  RTS.BuildMenu = ['conduit', 'foundry', 'forge', 'turret', 'outpost'];

  // ---- Factions ------------------------------------------------------------
  RTS.Factions = {
    aurex: {
      id: 'aurex',
      name: 'Iron Crown',
      tagline: 'Steel · Banners · Order',
      blurb: 'A disciplined medieval kingdom — armored knights, robed monks, and stone ' +
             'keeps under royal blue banners. Wins by holding ground and sustaining. ' +
             'Formation Bonus: 3+ Crown units attacking the same target deal +15% damage.',
      primary:    '#1565C0',
      secondary:  '#CFD8DC',
      dark:       '#0D47A1',
      accent:     '#FFD54F',
      shapeStyle: 'angular',
      passiveTrait: 'formation_bonus',
      units: ['pawn', 'lancer', 'archer', 'monk', 'warrior'],
      names: {
        core: 'Citadel Keep', conduit: 'Sheep Pen', foundry: 'Barracks',
        forge: 'War Forge', turret: 'Arrow Tower', outpost: 'Forward Bastion',
        pawn: 'Pawn', lancer: 'Lancer', archer: 'Archer',
        monk: 'Monk', warrior: 'Warrior',
      },
    },

    cinder: {
      id: 'cinder',
      name: 'Raider Horde',
      tagline: 'Bone · Fire · Chaos',
      blurb: 'A chaotic coalition of gnomes, goblins, gnolls, and trolls. ' +
             'Cheaper units, faster workers, and dirty tricks. ' +
             'Blood Frenzy: when a Horde unit dies, nearby allies gain +12% attack speed for 4s.',
      primary:    '#558B2F',
      secondary:  '#5D4037',
      dark:       '#33691E',
      accent:     '#F5F5DC',
      shapeStyle: 'angular',
      passiveTrait: 'blood_frenzy',
      units: ['gnome', 'spear_goblin', 'gnoll', 'hex_shaman', 'troll'],
      names: {
        core: 'Warren Maw', conduit: 'Pig Sty', foundry: 'War Pit',
        forge: 'Skull Forge', turret: 'Bone Spire', outpost: 'Raider Camp',
        pawn: 'Gnome', lancer: 'Spear Goblin', archer: 'Gnoll',
        monk: 'Hex Shaman', warrior: 'Troll',
      },
    },
  };

  RTS.nameFor = function (factionId, key) {
    var f = RTS.Factions[factionId];
    if (f && f.names[key]) return f.names[key];
    return (RTS.Units[key] && RTS.Units[key].label) ||
           (RTS.Buildings[key] && RTS.Buildings[key].label) || key;
  };

})(window.RTS = window.RTS || {});
