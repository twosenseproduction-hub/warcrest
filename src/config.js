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
      // Default at the "second zoom-out distance" from the 0.8 close view
      // (0.8 -> ~0.62 -> ~0.5), matching StarCraft/Warcraft's wider tactical
      // altitude. Locked (no pinch/wheel). Trade-off: smaller units (~30px taps).
      minZoom: 0.5, maxZoom: 0.5,
      default: 0.5,
      lock: true,
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
      startRadius: 420,  // raised from 300 — matches the new wider starting mine placement
    },

    harvest: {
      rate:                 6,
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
    // When 3+ Crown units are within radius of the same target,
    // all attacking units deal +dmgBonus% damage to that target.
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

    // Troll — Trollblood
    // Regen only activates after graceSec since last hit received.
    trollblood: {
      regenPerSec:  12,
      graceSec:     2.0,
    },

    // Gnoll — poison on hit
    gnollPoison: {
      dmgPerSec:  3,
      duration:   4,
    },

    // Archer — Sniper's Focus
    // Each consecutive hit on the SAME target adds one focus stack (+dmgPerStack).
    // Stacks reset immediately when the Archer switches to a different target.
    // Max stacks: maxStacks (total bonus capped at dmgPerStack * maxStacks).
    // Track on unit: unit.sniperTarget (entity ref), unit.sniperStacks (int 0-5).
    archerFocus: {
      dmgPerStack:  0.08,   // +8% per stack
      maxStacks:    5,      // cap at +40% total
    },

    // Monk — damage reduction aura
    monkAura: {
      radius:       130,
      dmgReduction: 0.10,
      maxReduction: 0.25,   // cap if multiple Monks overlap
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
    regenDelay:           5,    // Blood Vigor: seconds out of combat before HP regen kicks in

    matchSoftCapMin: 14,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  RTS.Resource      = { label: 'Ironstone' };
  RTS.resourceLabel = function (factionId) {
    var f = factionId && RTS.Factions && RTS.Factions[factionId];
    if (f && f.resource) return f.resource;
    return RTS.Resource.label;
  };

  RTS.TEAM = { PLAYER: 'player', ENEMY: 'enemy', NEUTRAL: 'neutral' };

  // =========================================================================
  // UNITS
  // Each unit entry carries its base stats plus a `traits` array describing
  // any passive behaviours the systems layer should activate.
  // =========================================================================
  // The base entries below are the IRON CROWN (aurex / Human) roster and act as
  // the shared role template. Other factions reskin these roles through
  // RTS.UnitOverrides (stats) and Factions[fid].names (display names).
  //
  //   tier — Town Hall level required to train this unit. tier 2 units stay
  //          locked until the Citadel Keep is upgraded to a Keep (see Buildings).
  RTS.Units = {

    pawn: {
      role: 'pawn', label: 'Peasant', glyph: 'circle', faction: 'aurex',
      hp: 60, speed: 100, dmg: 5, range: 22, rof: 1.0, tier: 1,
      cost: 45, supply: 1, build: 0, canHarvest: true, canBuild: true,
      traits: [],
      desc: 'Harvests Ironstone and raises structures.',
    },

    // Footman — sturdy basic infantry, the Crown's frontline shield.
    // Iron Discipline: armor soaks 30% of incoming damage, so its real
    // staying power far exceeds its raw HP — the anvil the Crown wins on.
    warrior: {
      role: 'warrior', label: 'Footman', glyph: 'hex', faction: 'aurex',
      hp: 200, speed: 85, dmg: 18, range: 48, rof: 1.0, tier: 1,
      cost: 110, supply: 2, build: 0, armor: 0.30,
      traits: ['armor', 'taunt'],
      tauntRadius: 90,
      desc: 'Armored frontline. Armor soaks 30% of damage — holds the line.',
    },

    // Crossbowman — serviceable ranged backbone, but not the Crown's edge.
    archer: {
      role: 'archer', label: 'Crossbowman', glyph: 'tri', faction: 'aurex',
      hp: 80, speed: 95, dmg: 16, range: 150, rof: 0.85, tier: 1,
      cost: 120, supply: 2, build: 0, ranged: true,
      traits: ['archer_focus'],
      desc: 'Ranged support. Slow, heavy bolts — solid, but the Crown wins in melee.',
    },

    // Knight — mounted heavy cavalry. Tier 2: needs a Keep.
    lancer: {
      role: 'lancer', label: 'Knight', glyph: 'diamond', faction: 'aurex',
      hp: 220, speed: 150, dmg: 26, range: 50, rof: 0.9, tier: 2,
      cost: 170, supply: 3, build: 0, armor: 0.25,
      traits: ['armor', 'building_bane'],
      buildingDmgBonus: 0.3,
      desc: 'Mounted heavy cavalry. Armored, shatters buildings. Requires a Keep.',
    },

    // Priest — premier healer / support caster. Tier 2: needs a Keep.
    monk: {
      role: 'monk', label: 'Priest', glyph: 'cross', faction: 'aurex',
      hp: 95, speed: 100, dmg: 0, range: 120, rof: 0.7, heal: 14, tier: 2,
      cost: 135, supply: 2, build: 0, healer: true,
      traits: ['monk_aura'],
      desc: 'The strongest healer in the Reach. Sustains a Crown push. Requires a Keep.',
    },

  };

  // ---- Per-faction unit stat overrides -------------------------------------
  // Spawning resolves a unit's effective spec from the shared role base
  // (RTS.Units[role]) merged with the faction override below. This is the ONLY
  // place per-faction stats take effect — see RTS.resolveUnitSpec / makeUnit.
  RTS.UnitOverrides = {

    // ---- Rimwalkers (Night-Elf style: ranged-heavy, fast, fragile, evasive).
    // Wild Grace: combat units have a chance to evade a hit entirely. Their
    // power budget is reach + speed + dodge — caught in melee, they crumble.
    rimwalker: {
      pawn:    { hp: 55, speed: 110, dmg: 5, cost: 45, supply: 1 },
      // Thornguard — stopgap melee only. Evasive but weak; the grove avoids brawling.
      warrior: { hp: 150, speed: 95, dmg: 15, range: 48, rof: 1.0, armor: 0, evade: 0.20, cost: 110, supply: 2 },
      // Bark Archer — the backbone: long reach, fast loose, cheap, slippery.
      archer:  { hp: 70, speed: 115, dmg: 16, range: 168, rof: 0.62, ranged: true, evade: 0.25, cost: 115, supply: 2 },
      // Huntress — fast ranged glaive skirmisher (mobile cavalry).
      lancer:  { hp: 150, speed: 188, dmg: 18, range: 150, rof: 0.8, ranged: true, armor: 0, evade: 0.22, cost: 165, supply: 3 },
      // Sapling Mystic — ranged healer/caster, also evasive.
      monk:    { hp: 85, speed: 112, dmg: 6, range: 132, rof: 0.7, heal: 12, ranged: true, evade: 0.20, cost: 130, supply: 2 },
    },

    // ---- Raider Horde (brute attrition: cheap, high-HP melee that regens).
    // Blood Vigor: units regenerate HP a few seconds after leaving combat, so
    // cheap masses heal back up between fights. Weak ranged; folds to burst.
    cinder: {
      pawn:    { hp: 50, speed: 115, dmg: 4, cost: 30, supply: 1, regen: 2 },
      // Grunt — the brute: huge HP, slow, regenerates. The Horde's hammer.
      warrior: { hp: 240, speed: 78, dmg: 26, range: 50, rof: 0.95, armor: 0, regen: 6, cost: 115, supply: 3 },
      // Gnoll — cheap, weak ranged harasser; regens between skirmishes.
      archer:  { hp: 70, speed: 118, dmg: 13, range: 130, rof: 0.7, ranged: true, regen: 3, cost: 70, supply: 2 },
      // Spear Goblin — fast glass-cannon raider.
      lancer:  { hp: 60, speed: 195, dmg: 14, range: 55, rof: 0.55, armor: 0, regen: 2, cost: 55, supply: 1 },
      // Hex Shaman — minor ranged healer (Humans out-heal them by far).
      monk:    { hp: 75, speed: 100, dmg: 6, range: 125, rof: 0.7, heal: 8, ranged: true, regen: 3, cost: 80, supply: 2 },
    },
  };

  // resolveUnitSpec — effective per-faction spec (base role merged with override).
  // Returns the shared base unchanged when the faction has no override for the role.
  RTS.resolveUnitSpec = function (role, factionId) {
    var base = RTS.Units[role];
    if (!base) return null;
    var f = factionId && RTS.UnitOverrides[factionId];
    var ovr = f && f[role];
    if (!ovr) return base;
    return Object.assign({}, base, ovr);
  };
  RTS.unitOverride = function (factionId, role) {
    var f = RTS.UnitOverrides[factionId];
    return (f && f[role]) || null;
  };

  // ---- Buildings -----------------------------------------------------------
  RTS.Buildings = {
    core: {
      type: 'core', label: 'Citadel Keep', w: 256, h: 192,
      hp: 1600, cost: 0, build: 0, deposit: true,
      trains: ['pawn'], desc: 'Main base. Trains workers, banks Ironstone.',
      /* Town Hall tech tiers — upgrading to a Keep (lvl 2) unlocks tier-2 units. */
      tierByLevel:  [1, 2],
      tierName:     ['Citadel Keep', 'Keep'],
      upgradeCosts: [220],   /* cost to research lvl1 -> lvl2 */
      upgradeTime:  [60],    /* seconds to research lvl1 -> lvl2 */
      upgradeHp:    [2000],  /* maxHp once upgraded */
    },
    outpost: {
      type: 'outpost', label: 'Forward Bastion', w: 128, h: 128,
      hp: 1400, cost: 320, build: 55, deposit: true, expansion: true,
      trains: ['pawn'],
      desc: 'Expansion base. Build beside an Ironstone field.',
    },
    conduit: {
      type: 'conduit', label: 'Sheep Pen', w: 192, h: 192,
      hp: 420, cost: 65, build: 16, isPasture: true,
      trains: ['_livestock'],
      desc: 'Raise livestock to increase supply cap.',
      /* Rimwalker Briar Fold: 3 levels each granting more population */
      supplyByLevel: [6, 12, 20],
      upgradeCosts:  [80, 130],   /* cost to go lvl1→2 and lvl2→3 */
      upgradeHp:     [560, 700],  /* maxHp at each upgraded level */
    },
    foundry: {
      type: 'foundry', label: 'Barracks', w: 192, h: 128,
      hp: 760, cost: 120, build: 32,
      trains: ['warrior', 'archer'],
      desc: 'Trains your basic infantry and ranged units.',
    },
    forge: {
      type: 'forge', label: 'War Forge', w: 192, h: 192,
      hp: 980, cost: 175, build: 48,
      trains: ['lancer', 'monk'],
      desc: 'Trains elite cavalry and support casters. Needs a Keep for tier-2 units.',
    },
    chiefs_hall: {
      type: 'chiefs_hall', label: "Chief's Hall", w: 192, h: 192,
      hp: 980, cost: 175, build: 48,
      trains: ['grollusk'],
      desc: 'Trains your Horde champion.',
    },
    turret: {
      type: 'turret', label: 'Arrow Tower', w: 64, h: 128,
      hp: 520, cost: 100, build: 22,
      defense: true, dmg: 20, range: 178, rof: 0.7, ranged: true,
      desc: 'Automated defense tower.',
    },
  };

  // Arrow Tower specialisations — a built turret can research into ONE of these.
  RTS.TowerUpgrades = {
    arrow:   { label: 'Arrow Tower', cost: 90,  time: 16, dmg: 24, range: 240, rof: 0.5,
               splash: 0,  buildingDmgBonus: 0,
               desc: 'Long-range single-target fire — strong against units.' },
    bombard: { label: 'Bombard',     cost: 150, time: 24, dmg: 52, range: 150, rof: 1.5,
               splash: 46, buildingDmgBonus: 0.5,
               desc: 'Short-range splash shells — smash buildings and clustered foes.' },
  };

  RTS.BuildMenu = ['conduit', 'foundry', 'forge', 'turret', 'outpost'];

  RTS.buildMenuFor = function (factionId) {
    var menu = RTS.BuildMenu.slice();
    if (factionId === 'cinder') {
      var fi = menu.indexOf('forge');
      if (fi >= 0) menu.splice(fi + 1, 0, 'chiefs_hall');
      else menu.push('chiefs_hall');
    }
    return menu;
  };

  // ---- Factions ------------------------------------------------------------
  RTS.Factions = {
    aurex: {
      id: 'aurex',
      name: 'Iron Crown',
      tagline: 'Steel · Banners · Order',
      blurb: 'A disciplined medieval kingdom — armored knights, robed monks, and stone ' +
             'keeps under royal blue banners. Close-combat specialists who hold ground and out-sustain. ' +
             'Iron Discipline: melee units have armor, soaking a flat share of all damage.',
      primary:    '#1565C0',
      secondary:  '#CFD8DC',
      dark:       '#0D47A1',
      accent:     '#FFD54F',
      shapeStyle: 'angular',
      passiveTrait: 'iron_discipline',
      units: ['pawn', 'lancer', 'archer', 'monk', 'warrior'],
      names: {
        core: 'Citadel Keep', conduit: 'Sheep Pen', foundry: 'Barracks',
        forge: 'War Forge', chiefs_hall: "Chief's Hall", turret: 'Arrow Tower', outpost: 'Forward Bastion',
        pawn: 'Peasant', lancer: 'Knight', archer: 'Crossbowman',
        monk: 'Priest', warrior: 'Footman',
      },
    },

    cinder: {
      id: 'cinder',
      name: 'Raider Horde',
      tagline: 'Bone · Fire · Chaos',
      blurb: 'A chaotic coalition of gnomes, goblins, gnolls, and trolls. ' +
             'Cheap, high-HP bruisers who win wars of attrition. ' +
             'Blood Vigor: units regenerate health a few seconds after leaving combat.',
      primary:    '#558B2F',
      secondary:  '#5D4037',
      dark:       '#33691E',
      accent:     '#F5F5DC',
      shapeStyle: 'angular',
      passiveTrait: 'blood_vigor',
      units: ['gnome', 'spear_goblin', 'gnoll', 'hex_shaman', 'troll'],
      names: {
        core: 'Warren Maw', conduit: 'Pig Sty', foundry: 'War Pit',
        forge: 'Skull Den', chiefs_hall: "Chief's Hall", turret: 'Bone Spire', outpost: 'Raider Camp',
        pawn: 'Gnome', lancer: 'Spear Goblin', archer: 'Gnoll',
        monk: 'Hex Shaman', warrior: 'Troll',
      },
    },

    rimwalker: {
      id: 'rimwalker',
      name: 'Rimwalkers',
      tagline: 'Root · Grove · Thorncraft',
      blurb: 'Ancient forest wardens who strike from the trees and vanish. ' +
             'Long-ranged, swift, and fragile — masters of hit-and-run who avoid the brawl. ' +
             'Wild Grace: combat units are evasive, with a chance to dodge any incoming hit.',
      primary:    '#2E7D32',
      secondary:  '#A5D6A7',
      dark:       '#1B5E20',
      accent:     '#FFE082',
      shapeStyle: 'organic',
      passiveTrait: 'wild_grace',
      resource:   'Thornstone',
      units: ['pawn', 'lancer', 'archer', 'monk', 'warrior'],
      names: {
        core:        'Roothold',
        conduit:     'Briar Fold',
        foundry:     'Warden Lodge',
        forge:       'Root Forge',
        chiefs_hall: 'Elder Sanctum',
        turret:      'Canopy Spire',
        outpost:     'Grove Cache',
        pawn:        'Grove Hand',
        lancer:      'Huntress',
        archer:      'Bark Archer',
        monk:        'Sapling Mystic',
        warrior:     'Thornguard',
      },
    },
  };

  RTS.nameFor = function (factionId, key) {
    if (RTS.getHero && RTS.getHero(key)) {
      var h = RTS.getHero(key);
      return h.shortName || h.name;
    }
    var f = RTS.Factions[factionId];
    if (f && f.names[key]) return f.names[key];
    return (RTS.Units[key] && RTS.Units[key].label) ||
           (RTS.Buildings[key] && RTS.Buildings[key].label) || key;
  };

  // ---- HUD helper functions ------------------------------------------------

  RTS.Config.getTrainableUnits = function (fid, buildingType) {
    var spec = RTS.Buildings[buildingType];
    return spec ? (spec.trains || []) : [];
  };

  RTS.Config.getBuildables = function (fid) {
    return RTS.buildMenuFor ? RTS.buildMenuFor(fid) : RTS.BuildMenu.slice();
  };

  RTS.Config.unitCost = function (role, fid) {
    if (role === '_livestock') return RTS.Config.livestock ? RTS.Config.livestock.trainCost : 0;
    var spec = RTS.resolveUnitSpec ? RTS.resolveUnitSpec(role, fid) : RTS.Units[role];
    return spec ? (spec.trainCost != null ? spec.trainCost : spec.cost) : 0;
  };

  RTS.Config.buildCost = function (btype) {
    var spec = RTS.Buildings[btype];
    return spec ? spec.cost : 0;
  };

  RTS.Config.canUpgrade = function (b) {
    if (!b || !b.built) return false;
    if (b.upgrading) return false;   /* already researching */
    /* Citadel Keep (core) upgrades to a Keep — unlocks tier-2 units */
    if (b.type === 'core') {
      var cspec = RTS.Buildings.core;
      var maxCore = cspec.tierByLevel ? cspec.tierByLevel.length : 1;
      return (b.level || 1) < maxCore;
    }
    /* Briar Fold (Rimwalker conduit) upgrades through 3 levels */
    if (b.type === 'conduit' && b.faction === 'rimwalker') {
      var spec = RTS.Buildings.conduit;
      var maxLevel = spec.supplyByLevel ? spec.supplyByLevel.length : 1;
      return (b.level || 1) < maxLevel;
    }
    return false;
  };

  RTS.Config.upgradeCost = function (b) {
    var lv = (b.level || 1) - 1; /* 0-indexed into upgradeCosts */
    if (b.type === 'core') {
      var cspec = RTS.Buildings.core;
      return cspec.upgradeCosts ? (cspec.upgradeCosts[lv] || 0) : 0;
    }
    if (b.type === 'conduit') {
      var spec = RTS.Buildings.conduit;
      return spec.upgradeCosts ? (spec.upgradeCosts[lv] || 0) : 0;
    }
    return 0;
  };

  /* Effective Town Hall tier for a team = highest core level it controls. */
  RTS.Config.teamTier = function (s, team) {
    var tier = 1;
    var blds = s && s.entities && s.entities.buildings;
    if (!blds) return tier;
    for (var i = 0; i < blds.length; i++) {
      var b = blds[i];
      if (b.team !== team || b.dead || b.type !== 'core' || !b.built) continue;
      var spec = RTS.Buildings.core;
      var lvl = b.level || 1;
      var t = (spec.tierByLevel && spec.tierByLevel[lvl - 1]) || lvl;
      if (t > tier) tier = t;
    }
    return tier;
  };

  RTS.Config.passiveTags = function (entity) {
    if (!entity || !entity.role) return [];
    var spec = RTS.resolveUnitSpec ? RTS.resolveUnitSpec(entity.role, entity.faction) : RTS.Units[entity.role];
    return spec && spec.traits ? spec.traits.map(function (t) { return t.replace(/_/g, ' '); }) : [];
  };

})(window.RTS = window.RTS || {});
