/* ============================================================================
 * EXOFRONT — config.js
 * Central balance + tuning constants. Tweak values here to rebalance the game.
 * All game systems read from RTS.Config / RTS.Units / RTS.Buildings.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  // ---- Core balance knobs (edit these first) -------------------------------
  var isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  var isPhone = typeof window !== 'undefined' && window.innerWidth < 520;

  RTS.Config = {
    isMobile: isMobile,
    isPhone: isPhone,
    world: { w: 3072, h: 1920 },
    camera: {
      minZoom: 0.55, maxZoom: 2.0,
      default: isPhone ? 1.08 : (isMobile ? 1.02 : 0.92),
      panInertia: 0.86,
    },
    touch: {
      slopPx: isMobile ? 42 : 18,
      dragPx: isMobile ? 20 : 12,
      uiBlockMs: 420,
      longPressMs: isMobile ? 400 : 460,
      doubleTapMs: 320,
      menuHoldMs: 280,
      twoFingerTapMs: 280,
    },

    // Economy
    startResources: 280,        // starting Halcite — slightly higher for slower harvest pace
    startSupplyCap: 12,         // supply provided by the Core
    supplyPerPylon: 8,          // supply added per Conduit
    maxSupplyCap: 80,
    passiveTrickle: 0.0,        // passive income/sec (0 = pure harvesting)

    mineAmounts: {
      starting: 12500,          // home gold beside each Castle
      expansion: 5000,            // all other map nodes
      startRadius: 300,           // px from base to count as starting gold
    },

    harvest: {
      rate: 8,                  // ore/sec equivalent income (used to derive mine chunk size)
      capacity: 6,              // ore per trip — bank after every 6, then return to mine
      reach: 42,                // distance to begin mining / slot ring offset
      depositReach: 165,        // max range to pick/keep a deposit building target (not bank radius)
      depositStop: 22,          // default nav stop for other contexts
      depositApproachStop: 12,  // how close pawn walks to the deposit approach point
      depositTriggerR: 38,      // bank ore only when this close to building edge (~1 tile)
      depositStuckSec: 1.2,     // force-bank if carrying, in trigger zone, and not moving
      mineCycleSec: 0.45,       // readable work-swing duration at the node
      slotCount: 6,             // approach positions around each node perimeter
      slotReach: 14,            // how close worker must get to its slot before mining
      idealWorkersPerNode: 2,   // preferred workers per active node
      maxWorkersPerNode: 4,     // hard cap for assignment scoring
      lowNodePct: 0.25,         // below this remaining %, nodes are deprioritized
      minNodeAmount: 300,       // ignore nearly-empty nodes for auto-mine / expansion picks
    },

    // AI difficulty / pacing
    ai: {
      startResources: 280,        // match player — equal start
      income: 0,                  // no passive cheat; mine like the player
      firstWaveAt: 70,          // seconds before first real attack wave
      waveInterval: 52,         // seconds between waves
      waveGrowth: 1.18,         // wave size multiplier each wave
      maxArmy: 26,              // soft cap on simultaneous enemy combat units
      pawnCount: 3,               // match typical player open
      retaliate: true,
      difficulty: 'normal',     // easy | normal | hard | brutal
      modeDebounce: 18,         // seconds between strategy mode switches
      desiredWorkers: 3,
      rebuildPriority: ['foundry', 'conduit', 'forge', 'core'],
      squads: {
        assaultMinStrength: 4,
        harassMinStrength: 2,
        defenseRadius: 420,
        rallyDist: 90,
        refreshInterval: 6,
        retreatHpRatio: 0.32,
      },
      difficultyMods: {
        easy:   { thinkMul: 1.55, assaultMin: 6, refreshMul: 1.4, incomeBonus: 0 },
        normal: { thinkMul: 1.0,  assaultMin: 4, refreshMul: 1.0, incomeBonus: 0 },
        hard:   { thinkMul: 0.82, assaultMin: 3, refreshMul: 0.75, incomeBonus: 0.08 },
        brutal: { thinkMul: 0.68, assaultMin: 3, refreshMul: 0.6,  incomeBonus: 0.15 },
      },
    },

    // Combat feel — acquisition/chase/return (WC3-inspired)
    combat: {
      attentionIdle: 1.55,        // fallback mul when role acquireMul missing
      attentionAttackMove: 2.0,
      attentionChase: 2.1,
      meleeBuildingStandoff: 8,
      buildingAcquirePad: 12,     // extra acquire slack beyond edge for large buildings
      roles: {
        lancer:  { acquireMul: 1.8, chaseRange: 205 },
        archer:  { acquireMul: 2.2, chaseRange: 240 },
        monk:    { acquireMul: 1.5, chaseRange: 165 },
        warrior: { acquireMul: 1.7, chaseRange: 190 },
        default: { acquireMul: 1.5, chaseRange: 200 },
      },
      pawn: {
        retaliate: true,
        dangerRadius: 56,
        retaliateChase: 72,
        retaliateDuration: 2.4,
      },
      siege: {
        unfinishedBonus: 42,
        productionBonus: 30,
      },
    },
    separation: 150,            // unit push-apart strength
    pawnSeparationMul: 0.28,    // workers — allow slight overlap at mines / base
    unitCollisionGap: 4,        // minimum px gap between unit hitboxes
    pawnCollisionGap: -6,       // negative = pawns may overlap slightly
    unitOverlapIterations: 3,   // overlap solver passes per frame
    projectileSpeed: 520,
    hitFlash: 0.16,
    muzzleFlash: 0.09,
    corpseFade: 1.2,
    maxEffects: 60,

    // Match
    matchSoftCapMin: 14,        // event log nudge if running long

    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  // ---- Teams ---------------------------------------------------------------
  RTS.TEAM = { PLAYER: 'player', ENEMY: 'enemy', NEUTRAL: 'neutral' };

  // ---- Units (keys match Tiny Swords: Pawn, Lancer, Archer, Monk, Warrior) --
  // costs in Halcite, times in seconds, ranges/speeds in world units.
  RTS.Units = {
    pawn: {
      role: 'pawn', label: 'Pawn', glyph: 'circle',
      hp: 55, speed: 100, dmg: 5, range: 22, rof: 1.0,
      cost: 40, supply: 1, build: 0, canHarvest: true, canBuild: true,
      desc: 'Harvests Halcite and raises structures.',
    },
    lancer: {
      role: 'lancer', label: 'Lancer', glyph: 'diamond',
      hp: 52, speed: 178, dmg: 9, range: 78, rof: 0.55,
      cost: 45, supply: 1, build: 0,
      desc: 'Fast skirmisher — your opening army unit.',
    },
    archer: {
      role: 'archer', label: 'Archer', glyph: 'tri',
      hp: 64, speed: 118, dmg: 10, range: 132, rof: 0.62,
      cost: 60, supply: 1, build: 0, ranged: true,
      desc: 'Ranged backbone once Lancers hold the line.',
    },
    monk: {
      role: 'monk', label: 'Monk', glyph: 'cross',
      hp: 80, speed: 108, dmg: 0, range: 110, rof: 0.7, heal: 12,
      cost: 90, supply: 2, build: 0, healer: true,
      desc: 'Heals nearby allies. Keep behind the front.',
    },
    warrior: {
      role: 'warrior', label: 'Warrior', glyph: 'hex',
      hp: 230, speed: 62, dmg: 30, range: 46, rof: 0.85,
      cost: 120, supply: 3, build: 0,
      desc: 'Armored frontline — train from Archery once Barracks is up.',
    },
  };

  // ---- Buildings -----------------------------------------------------------
  RTS.Buildings = {
    core: {
      type: 'core', label: 'Castle', w: 256, h: 192,
      hp: 1600, cost: 0, build: 0, deposit: true,
      trains: ['pawn'], desc: 'Main base. Trains Pawns, banks Halcite, toggles auto-mine.',
    },
    outpost: {
      type: 'outpost', label: 'Outpost', w: 128, h: 128,
      hp: 1400, cost: 320, build: 42, deposit: true, expansion: true,
      trains: ['pawn'],
      desc: 'Expansion base — build next to a Halcite field. Trains Pawns and banks ore.',
    },
    conduit: {
      type: 'conduit', label: 'House', w: 128, h: 128,
      hp: 420, cost: 65, build: 10, supply: 8,
      trains: [], desc: 'Raises your supply cap.',
    },
    foundry: {
      type: 'foundry', label: 'Barracks', w: 160, h: 128,
      hp: 760, cost: 120, build: 18,
      trains: ['lancer', 'archer', 'monk'],
      desc: 'Produces Lancers, Archers, and Monks.',
    },
    forge: {
      type: 'forge', label: 'Archery', w: 176, h: 144,
      hp: 980, cost: 175, build: 26,
      trains: ['warrior'],
      desc: 'Produces Warriors.',
    },
    turret: {
      type: 'turret', label: 'Tower', w: 56, h: 96,
      hp: 520, cost: 100, build: 14,
      defense: true, dmg: 20, range: 178, rof: 0.7, ranged: true,
      desc: 'Automated defense tower. Fires on nearby foes.',
    },
  };

  // Player buildable menu order
  RTS.BuildMenu = ['conduit', 'foundry', 'forge', 'turret', 'outpost'];

  // ---- Factions (visual identity + naming) ---------------------------------
  RTS.Factions = {
    aurex: {
      id: 'aurex',
      name: 'Aurex Kingdom',
      tagline: 'Steel. Banners. Order.',
      blurb: 'A disciplined medieval kingdom — pawns, archers, and knights marching ' +
             'under blue banners. Fast to tech, brutal in formation.',
      primary: '#26c6da',   // bright cartoon cyan
      secondary: '#80deea',
      dark: '#00838f',
      accent: '#fff176',
      shapeStyle: 'angular',
      names: {
        core: 'Castle', conduit: 'House', foundry: 'Barracks',
        forge: 'Archery', turret: 'Tower', outpost: 'Outpost',
        pawn: 'Pawn', lancer: 'Lancer', archer: 'Archer',
        monk: 'Monk', warrior: 'Warrior',
      },
    },
    cinder: {
      id: 'cinder',
      name: 'Crimson Kingdom',
      tagline: 'Iron. Banners. Conquest.',
      blurb: 'Red-banner knights — the same ranks as the blue kingdom, sworn to a ' +
             'rival crown. Slow to muster, relentless once the line advances.',
      primary: '#ff7043',
      secondary: '#ffab91',
      dark: '#d84315',
      accent: '#ffee58',
      shapeStyle: 'angular',
      names: {
        core: 'Castle', conduit: 'House', foundry: 'Barracks',
        forge: 'Archery', turret: 'Tower', outpost: 'Outpost',
        pawn: 'Pawn', lancer: 'Lancer', archer: 'Archer',
        monk: 'Monk', warrior: 'Warrior',
      },
    },
  };

  // Helper: get the display name for a role/building under a faction.
  RTS.nameFor = function (factionId, key) {
    var f = RTS.Factions[factionId];
    if (f && f.names[key]) return f.names[key];
    return (RTS.Units[key] && RTS.Units[key].label) ||
           (RTS.Buildings[key] && RTS.Buildings[key].label) || key;
  };

})(window.RTS = window.RTS || {});
