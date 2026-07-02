/* ============================================================================
 * Verath — heroes.js
 * Hero unit definitions. Each hero has:
 *   - Base stats (hp, speed, dmg, range)
 *   - A passive trait (always active)
 *   - 3 abilities unlocked at levels 1, 3, 5
 *
 * Heroes are referenced by RTS.Heroes[key].
 * Faction keys match RTS.Factions: 'aurex' = Iron Crown, 'cinder' = Raider Horde
 * 'rimwalker' = future Rimwalker faction (not yet playable)
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  RTS.Heroes = {

    /* -----------------------------------------------------------------------
     * IRON CROWN HEROES
     * ----------------------------------------------------------------------- */

    valdris: {
      id: 'valdris',
      faction: 'aurex',
      name: 'Valdris the Ironwarden',
      shortName: 'Valdris',
      class: 'Vanguard',
      role: 'hero',
      quote: 'The Crown does not ask if the war is just. It asks if the wall will hold.',
      lore: 'The general who built half the Citadel Keeps in Verath personally. ' +
            'Sixty years old, still fights in full plate. Sent to the Sapphire Shores ' +
            'to end the war in one campaign. Privately believes he is being sent to die doing it.',

      // Base stats
      hp: 520,
      speed: 52,
      dmg: 42,
      range: 48,       // melee
      ranged: false,
      supply: 0,        // heroes do not cost supply
      trainCost: 240,   // summoned at the Ancestor's Shrine
      trainTime: 26,

      // Passive — always active
      passive: {
        id: 'ironwarden',
        name: 'Ironwarden',
        desc: 'Valdris takes 25% reduced damage from all sources. Each hit he lands ' +
              'generates armor — stacks up to +40% damage reduction over 6 hits. ' +
              'Decays when he stops attacking.',
        damageReduction: 0.25,
        armorPerHit: 0.067,     // 6 hits = 0.40 max
        armorMax: 0.40,
        armorDecaySec: 2.0,     // seconds after last hit before decay begins
      },

      // Abilities — unlocked at levels 1, 3, 5
      abilities: [
        {
          id: 'advance',
          name: 'Advance',
          unlockLevel: 1,
          cooldown: 9,
          desc: 'Valdris charges forward 180px, pushing through any unit in his path. ' +
                'Enemies hit take 90 damage and are knocked aside.',
          chargePx: 180,
          dmg: 90,
          knockback: 80,
        },
        {
          id: 'iron_edict',
          name: 'Iron Edict',
          unlockLevel: 3,
          cooldown: 28,
          desc: 'Valdris plants his banner. For 10s, friendly units within 240px cannot ' +
                'be killed below 1hp — they survive one lethal hit each.',
          radius: 240,
          duration: 10,
        },
        {
          id: 'the_last_wall',
          name: 'The Last Wall',
          unlockLevel: 5,
          cooldown: 45,
          desc: 'Valdris becomes immovable and invulnerable for 4s, dealing 25 damage/sec ' +
                'to all enemies within 80px. Ends with a shockwave dealing 200 damage in 120px.',
          duration: 4,
          auraDmgPerSec: 25,
          auraRadius: 80,
          shockwaveDmg: 200,
          shockwaveRadius: 120,
        },
      ],
    },

    seraphine: {
      id: 'seraphine',
      faction: 'aurex',
      name: 'Seraphine',
      class: 'Channeler',
      quote: 'The Ashfall took everything once. I will not watch it happen again.',
      lore: 'A young monk from a minor Crown monastery who discovered she could channel ' +
            'something the senior monks could not explain. Not divine. Not quite. Something ' +
            'older — a resonance with Verath itself. The Crown uses her as a field asset. ' +
            'She has her own reasons for being here.',

      hp: 240,
      speed: 118,
      dmg: 6,
      range: 130,
      ranged: true,
      supply: 0,
      trainCost: 220,
      trainTime: 26,

      passive: {
        id: 'resonance_field',
        name: 'Resonance Field',
        desc: 'Friendly units within 160px deal damage that also slows the target by 20% ' +
              'for 1s — every hit, every unit, passively.',
        radius: 160,
        slowPct: 0.20,
        slowDuration: 1.0,
      },

      abilities: [
        {
          id: 'attunement',
          name: 'Attunement',
          unlockLevel: 1,
          cooldown: 12,
          desc: 'Target friendly unit gains +40% attack speed and +25% move speed for 7s.',
          atkSpeedBonus: 0.40,
          moveSpeedBonus: 0.25,
          duration: 7,
        },
        {
          id: 'shatter',
          name: 'Shatter',
          unlockLevel: 3,
          cooldown: 22,
          desc: 'Breaks the resonance in a 180px burst — all enemies in range are silenced ' +
                '(cannot use abilities) and take 80 damage.',
          radius: 180,
          dmg: 80,
          silenceDuration: 3.5,
        },
        {
          id: 'verdant_surge',
          name: 'Verdant Surge',
          unlockLevel: 5,
          cooldown: 50,
          desc: 'For 8s ALL friendly units on the entire map gain +20% damage and ' +
                'regenerate 4hp/sec.',
          dmgBonus: 0.20,
          regenPerSec: 4,
          duration: 8,
          mapWide: true,
        },
      ],
    },

    /* -----------------------------------------------------------------------
     * RAIDER HORDE HEROES
     * ----------------------------------------------------------------------- */

    skrix: {
      id: 'skrix',
      faction: 'cinder',
      name: 'Skrix',
      class: 'Saboteur',
      quote: 'Every general has a plan. Mine is that yours falls apart first.',
      lore: 'Youngest war commander in Horde history. Rose by being right about things ' +
            'older leaders refused to believe. Carries a satchel of devices nobody fully ' +
            'understands. The Iron Crown has a bounty on him. He considers this a performance metric.',

      hp: 200,
      speed: 175,
      dmg: 18,
      range: 112,
      ranged: true,
      supply: 0,
      trainCost: 220,
      trainTime: 24,

      passive: {
        id: 'chaos_tax',
        name: 'Chaos Tax',
        desc: 'Every time an enemy unit uses an ability within 320px of Skrix, ' +
              'that ability\'s cooldown is extended by 2s.',
        radius: 320,
        cooldownPenalty: 2.0,
      },

      abilities: [
        {
          id: 'scatter_charge',
          name: 'Scatter Charge',
          unlockLevel: 1,
          cooldown: 8,
          desc: 'Throws 4 small bombs in a spread pattern. Each deals 55 damage. ' +
                'Forces enemies to break formation to dodge.',
          bombCount: 4,
          dmgPerBomb: 55,
          spreadAngle: 60,    // degrees of spread arc
          fuseDelay: 0.8,
        },
        {
          id: 'unravel',
          name: 'Unravel',
          unlockLevel: 3,
          cooldown: 24,
          desc: 'Target enemy unit switches allegiance for 4s — fights for the Horde ' +
                'temporarily. Works on any non-hero unit.',
          duration: 4,
          heroImmune: true,
        },
        {
          id: 'bedlam',
          name: 'Bedlam',
          unlockLevel: 5,
          cooldown: 40,
          desc: 'For 6s all enemy units within 280px receive random movement commands — ' +
                'they scatter, attack each other, or stand confused.',
          radius: 280,
          duration: 6,
        },
      ],
    },

    grollusk: {
      id: 'grollusk',
      faction: 'cinder',
      name: 'Grollusk',
      class: 'Hex Shaman',
      quote: 'You think the dead are gone. In Verath nothing is gone. Everything is just waiting.',
      lore: 'Ancient gnoll shaman — nobody knows exactly how old. Speaks to the spirits ' +
            'of every Horde member who died fighting the Iron Crown, which after three years ' +
            'of war means he has a very large congregation. Calm in a way that unsettles everyone.',

      hp: 310,
      speed: 88,
      dmg: 18,
      range: 138,
      ranged: true,
      supply: 0,
      trainCost: 220,
      trainTime: 22,

      passive: {
        id: 'death_ward',
        name: 'Death Ward',
        desc: 'When a nearby friendly unit dies within 200px, Grollusk gains +8hp.',
        radius: 200,
        healPerDeath: 8,
      },

      abilities: [
        {
          id: 'hex',
          name: 'Hex',
          unlockLevel: 1,
          cooldown: 10,
          desc: 'Curses target enemy — 40% slower, 25% weaker attacks for 5s.',
          slowPct: 0.40,
          dmgReductionPct: 0.25,
          duration: 5,
        },
        {
          id: 'death_coil',
          name: 'Death Coil',
          unlockLevel: 3,
          cooldown: 16,
          desc: 'Deals 120 damage to target enemy. Heals Grollusk for 60hp.',
          dmg: 120,
          selfHeal: 60,
        },
        {
          id: 'ancestors_fury',
          name: "Ancestor's Fury",
          unlockLevel: 5,
          cooldown: 38,
          desc: 'Summons 3 spirit warriors (80hp, 18dmg) for 12s at target location.',
          spiritCount: 3,
          spiritHp: 80,
          spiritDmg: 18,
          spiritSpeed: 120,
          duration: 12,
        },
      ],
    },

    /* -----------------------------------------------------------------------
     * RIMWALKER HEROES — future expansion, not yet playable in skirmish
     * ----------------------------------------------------------------------- */

    thoryn: {
      id: 'thoryn',
      faction: 'rimwalker',
      name: 'Thoryn',
      shortName: 'Thoryn',
      class: 'Bladedrifter',
      role: 'hero',
      quote: 'I do not fight for what the Spine was. I fight for what is still standing.',
      lore: 'Born after the Ashfall — he never saw the Verdant Spine whole. ' +
            'Grew up on what remains of the Rim, learned to fight because those forests ' +
            'were always under pressure. Takes coin-work when the trees cannot pay. ' +
            'His blade is Rimwalker-forged: heartwood core, tempered in ashfall resin, ' +
            'holds an edge longer than iron. When the war started bleeding toward Rimwalker ' +
            'territory he took a contract. That the contract aligns with keeping his land ' +
            'intact is something he does not acknowledge out loud.',
      playable: true,

      hp: 270,
      speed: 148,
      dmg: 34,
      range: 52,        // melee
      ranged: false,
      supply: 0,
      trainCost: 230,
      trainTime: 26,

      // Passive — always active
      passive: {
        id: 'spine_edge',
        name: "Spine's Edge",
        desc: 'Each consecutive attack on the same target builds tempo — +12% attack speed ' +
              'per hit, up to 3 stacks (+36%). Stacks reset after 2s without attacking ' +
              'or if Thoryn switches targets.',
        stackAtkSpeed: 0.12,
        maxStacks: 3,
        decaySec: 2.0,
      },

      abilities: [
        {
          id: 'thorn_cut',
          name: 'Thorn Cut',
          unlockLevel: 1,
          cooldown: 7,
          desc: 'Three rapid slashes — each deals 38 damage. ' +
                'The third strike leaves a bleeding wound dealing 12 damage/sec for 4s.',
          strikes: 3,
          dmgPerStrike: 38,
          bleedDmgPerSec: 12,
          bleedDuration: 4,
        },
        {
          id: 'vanishing_step',
          name: 'Vanishing Step',
          unlockLevel: 3,
          cooldown: 18,
          desc: 'Thoryn blinks 200px toward target and reappears behind them. ' +
                'Next attack within 3s deals +80% damage.',
          blinkPx: 200,
          bonusDmgPct: 0.80,
          bonusWindow: 3,
        },
        {
          id: 'ashfall_draw',
          name: 'Ashfall Draw',
          unlockLevel: 5,
          cooldown: 38,
          desc: '1.5s draw. Thoryn releases a single cut across a 260px line — ' +
                'all enemies hit take 280 damage and are slowed 50% for 2.5s. ' +
                'The blade carries the memory of the Spine. So does he.',
          castTime: 1.5,
          linePx: 260,
          dmg: 280,
          slowPct: 0.50,
          slowDuration: 2.5,
        },
      ],
    },

    aelindra: {
      id: 'aelindra',
      faction: 'rimwalker',
      name: 'Aelindra Ashveil',
      shortName: 'Aelindra',
      class: 'Wild Rider',
      role: 'hero',
      quote: 'I watched the Spine fall. Now I ride its memory into them.',
      lore: 'The oldest living Rimwalker. She was a young Sylhen during the Ashfall and ' +
            'carries the memory of the Verdant Spine like a wound. She does not enter wars — ' +
            'until now. She rides to this one on a great Rimcat, loosing moonfire arrows ' +
            'from the saddle, never still long enough to be answered.',
      playable: true,
      portraitFile: 'Aelindra_Idle.png',

      hp: 340,
      speed: 158,        // mounted — fast
      dmg: 24,
      range: 190,        // longbow from the saddle
      rof: 0.8,
      ranged: true,
      supply: 0,
      trainCost: 230,
      trainTime: 28,

      passive: {
        id: 'wind_rider',
        name: 'Wind Rider',
        desc: 'Aelindra rides a great Rimcat: she cannot be knocked back, sees 3 tiles ' +
              'farther, and arrows loosed from beyond 120px strike for +25% — reward for ' +
              'hit-and-run kiting.',
        knockbackImmune: true,
        visionBonus: 3,
        longshotPx: 120,
        longshotBonus: 0.25,
      },

      abilities: [
        {
          id: 'thornwall',
          name: 'Thornwall',
          unlockLevel: 1,
          cooldown: 14,
          desc: 'Grows a line of roots blocking unit movement for 8s.',
          wallLength: 240,
          duration: 8,
        },
        {
          id: 'verdant_pulse',
          name: 'Verdant Pulse',
          unlockLevel: 3,
          cooldown: 20,
          desc: 'Heals all friendly units in 300px for 45hp. Damages enemies for 45.',
          radius: 300,
          healAmt: 45,
          dmgAmt: 45,
        },
        {
          id: 'the_ashfall',
          name: 'The Ashfall',
          unlockLevel: 5,
          cooldown: 55,
          desc: 'Massive AoE silence and damage across 240px. 3s cast time. ' +
                'Named after the catastrophe that made Aelindra what she is.',
          radius: 240,
          castTime: 3.0,
          dmg: 300,
          silenceDuration: 5,
        },
      ],
    },

  };

  // Helpers
  RTS.getHero = function (id) { return RTS.Heroes[id] || null; };
  RTS.isHeroRole = function (role) { return !!RTS.getHero(role); };
  RTS.trainSpec = function (role, factionId) {
    return RTS.getHero(role) ||
      (RTS.resolveUnitSpec && RTS.resolveUnitSpec(role, factionId)) ||
      RTS.Units[role] || null;
  };
  RTS.hasLivingHero = function (s, team, heroId) {
    return s.entities.units.some(function (u) {
      return u.team === team && !u.dead && u.heroId === heroId;
    });
  };
  RTS.getHeroesForFaction = function (factionId) {
    return Object.values(RTS.Heroes).filter(function (h) {
      return h.faction === factionId && h.playable !== false;
    });
  };

})(window.RTS = window.RTS || {});
