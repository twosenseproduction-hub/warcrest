# Verath — Campaign & Modes

> Level design + the **Campaign / Skirmish** mode split, derived from the locked
> story bible in `LORE.md`. **`LORE.md` is canon; this file must not contradict it.**
> World: the **Verath basin**. Two active factions — **Iron Crown** (`aurex`) and
> **Raider Horde** (`cinder`) — warring over ironstone on the Verath Floor. The
> **Rimwalkers** (`rimwalker`) are a neutral/future faction who know the real
> secret. The escalating threat is **the Deepvein dead** — what rose in the Ashfall
> is *undeath itself*, and it raises every corpse the war leaves behind (see
> `LORE.md` → The Secret). Missions teach one system at a time (`DESIGN_DIRECTION.md`:
> *layer complexity onto a proven core*).

---

## 1. The dramatic spine

The Verath Wars are a resource war that becomes something else. Iron Crown and
Raider Horde bleed each other over the Deepvein ironstone; the Crown's surveys
have already disturbed what the Rimwalkers spent three centuries containing. Every
act, the *creeps* get stranger and more ash-touched, seeding the reveal long
before it lands. Both factions are right about each other and blind to what's
climbing up the Deepvein behind them.

- **Acts I–II** — the mortal war, told from **both** sides (Iron Crown, then
  Raider Horde), so the campaign teaches each faction's identity.
- **Act III** — the disturbance escalates; the Rimwalkers (Aelindra, Toryn) break
  their silence. Forced, uneasy cooperation.
- **Act IV** — the descent into the Deepvein; the source of the Ashfall.

The entity is undeath — but the *scope* of it stays hidden until late. Early acts
show only stray **risen dead** ("ash-touched") near the shafts; the full Deepvein
army — and that it raises the war's own fallen — lands as the Act III/IV reveal.

---

## 2. Factions in play (see `LORE.md` for full text)

| Faction | Verb | Mechanic | Heroes |
|---|---|---|---|
| **Iron Crown** (`aurex`) | *hold the line* | **Muster** — units near Towers/Throne gain armor/damage | **Valdris the Ironwarden** (vanguard), **Seraphine** (channeler) |
| **Raider Horde** (`cinder`) | *reclaim* | **Bloodfury** — kills snowball nearby damage/speed | **Skrix** (saboteur), **Grollusk** (hex shaman) |
| **Rimwalkers** (`rimwalker`) — *future* | *outlast* | **Grove Bond** — buildings/units regrow in grove tiles | **Aelindra Ashveil** (moonfire warden) |

Hero kits are specified in `LORE.md` (passive + Lv1/Lv3/Lv5). The current build's
**Paladin** maps to **Valdris** (Iron Crown tank); the **Elf-Queen/Warden** kit is
a stand-in for **Aelindra** until the Rimwalker faction ships. New heroes to author:
Seraphine, Skrix, Grollusk.

**Counter feel (skirmish balance):** Iron Crown (defense/range) trades with Raider
Horde (melee snowball) — the Crown wins if the wall holds past the first surge; the
Horde wins if it doesn't. Rimwalker (future) is the outlast/vision spoiler.

---

## 3. Creeps & neutral objectives (make the *map* matter)

Creeps are Verath's wildlife and, increasingly, the ash-touched things stirring
from the Deepvein. Clearing a camp should always unlock a **power spike**.

| Camp | Where (`LORE.md` locations) | Guards | Reward |
|---|---|---|---|
| **Wild pack** | Sapphire Shores | fast melee chaff | frees an **ironstone mine** to claim |
| **Bog-lurkers** | fords / the Reach shallows | ranged spitters | frees a **lumber grove** |
| **Ridge sentinels** | Rimwall cliffs | one tanky elite | a **neutral Tower** to garrison |
| **Risen barrow** (live: skirmish flanks) | Sapphire Shores, along the veins | Risen Warriors/Bowmen + a Bonecaster; a **Barrow King** elite camp | gold bounty (the first playable taste of the Deepvein dead) |
| **Ash-touched** (Act III+) | near the Deepvein | corrupted, harder, "wrong" | ironstone cache + a story beat |

**Neutral objectives (contest, don't raze):** ironstone-shrine buff, mercenary camp
(hire once), expansion throne (double economy, split defense). Rimwalker Holds
appear as neutral, initially non-hostile sites you can parley with in Act III.

---

## 4. Campaign — four acts across the canon maps

Maps follow `LORE.md`: **Sapphire Shores** (current) → **Verath Floor** → **Rimwall
Pass** → **The Deepvein** (final). ~5 missions/act, ~12–18 min each; each teaches
**one** new system and reuses everything before it. Light roguelite meta (hero
perks, unit unlocks) rides between missions.

Legend: **▸ New** = the one system this mission introduces.

---

### ACT I — "Inevitable" · play **Iron Crown** (Valdris) · *Sapphire Shores*
Valdris is sent to end the Verath War in one campaign. Secure the Shores, protect
the Deepvein surveys. (Also the game's onboarding.)

1. **The Survey Road** — *tutorial.* Pilot Valdris; walk, auto-fight a gnoll pack.
   ▸ **hero control + auto-attack.**
2. **Beachhead** — build House + Barracks on anchored plots; train Pawns; defend one
   Horde wave. ▸ **anchored building + train + prep→assault rhythm.**
3. **Ring the Ironstone** — clear a gnoll camp to claim an ironstone mine; out-tech
   the raiders. ▸ **creeps + economy/expansion.**
4. **The Wall Holds** — pure defense; the Horde assaults in escalating waves.
   ▸ **Towers + the Muster mechanic + fog-gated defense.**
5. **The Chieftain's Vanguard** — first enemy-hero fight (the Raider Chieftain); read
   telegraphs, survive with towers + Advance charge. ▸ **enemy hero + ability
   range/telegraph reading.**
6. **Break the Camp** *(finale)* — raze the Horde forward base. Ends on: the surveys
   under the Shores have hit something that *rings wrong*. The Horde is pulling back
   — not in defeat, in fear.

**Enemy:** Raider Horde. **Unlock:** Valdris perk tier 1; **Seraphine** playable.

---

### ACT II — "Cornered" · play **Raider Horde** (Skrix / Grollusk) · *Verath Floor*
The other side: the Horde isn't raiding for spoil — it's being pushed off the
ancestral Floor, and the ground itself is turning against everyone.

1. **The Long Retreat** — a fighting withdrawal while outnumbered. ▸ **Bloodfury
   snowball.**
2. **Skull Totems** — claim ironstone-shrines before the Crown does. ▸ **neutral
   objective contest + day/night** (creeps stronger at night).
3. **Grollusk's Congregation** — hold a ford; Grollusk's Death Ward turns losses into
   sustain. ▸ **support/attrition hero play.**
4. **Totem of the Deep** — claim an ancestral skull-totem that empowers the horde
   (a standing Bloodfury boost) as a mid-mission power spike. ▸ **map objective →
   army buff / power spike.**
5. **Sabotage** — Skrix's Scatter/Unravel dismantle an Iron Crown column. ▸ **large-army
   command + attack-move discipline.**
6. **What Rings Below** *(finale)* — the Horde breaks into a survey shaft and meets the
   first **risen dead** — not Crown, not Horde, not living at all. They send word to the
   only ones who might know: the Rimwalkers.

**Enemy:** Iron Crown (+ first ash-touched creeps). **Unlock:** Shaman + heavy
Raider Warrior for skirmish; Horde perk tier.

---

### ACT III — "The Silent Council Speaks" · play **Iron Crown / Horde** + **Rimwalker** allies · *Rimwall Pass*
Aelindra and Toryn break three centuries of silence. Uneasy cooperation as the
ash-touched spread out of the Deepvein.

1. **Parley at the High Rim** — reach a Rimwalker Hold without razing it (escort /
   don't-provoke rules). ▸ **neutral parley + allied-faction AI.**
2. **Grove Bond** — fight beside Rimwalker units; their buildings regrow. ▸ **allied
   mechanic (regen) + mixed army.**
3. **The Ashen Tide** — hold Rimwall Pass at night vs waves of ash-touched. ▸ **AoE vs
   swarm + night survival.**
4. **Toryn's Road** — escort Toryn Greywarden along the barrow-road to the shaft.
   ▸ **escort/protect-the-VIP + heavier corrupted creeps.**
5. **Containment Fails** *(finale)* — the three-century seal breaks. Aelindra names
   what's below: the thing that caused the Ashfall never left. The Deepvein opens.

**Enemy:** ash-touched (+ skirmishing between factions who still don't fully trust
each other). **Unlock:** Aelindra playable (Rimwalker faction preview); Rimwalker
units for skirmish.

---

### ACT IV — "The Deepvein" · play a **combined force** (choose hero) · *The Deepvein*
The descent. Iron Crown, Horde, and Rimwalker fight together under the Shores.

1. **Into the Ring** — build a forward camp underground under constant pressure.
   ▸ **full roster / free faction mixing.**
2. **The Living Ore** — ironstone here still *moves*; the entity manifests through it.
   Push deeper against a soft enrage. ▸ **timed push / escalating pressure.**
3. **The Ashfall Remembered** *(final)* — confront the source. Aelindra's ultimate,
   "The Ashfall," is the key. Multi-phase finale. Choose the ending — who holds the
   Floor after — setting a New-Game+ modifier.

**Reward:** everything unlocked for Skirmish; New-Game+ modifiers.

> Design note: the Deepvein dead are the antagonist force — the **undead** the
> earlier design work explored (raise-from-corpses "Harvest" economy, a Barrow-King-
> style leader). For the campaign they can start as creep-tier risen and grow into a
> full roster if the undead later become a **playable faction**. The reveal — that they
> raise *your own fallen* — is the payoff of every corpse the war left on the Floor.
>
> **Implemented (creep tier).** The full Bitgem undead roster now ships as game-ready
> rigs — Risen Thrall / Warrior / Grave Stalker / Risen Bowman / Bonecaster, led by the
> **Barrow King** elite — with cold necrotic eye-lights and soul-fire on the casters.
> They appear as neutral creep camps on the flanks of the Sapphire Shores skirmish map
> (the dead crawl up the ironstone veins along the Reach), and as the escalating waves
> of the Act II "Sealing Rite" (`a2m1`), climaxing with the Barrow King. Deployment as a
> full playable/enemy faction — hero, buildings, Harvest economy — is the next step.

---

## 5. Campaign vs Skirmish — the mode split

New decision **before** faction/hero select:

```
        ┌──────────┐
        │  VERATH  │
        └──────────┘
        ▼          ▼
  ┌──────────┐ ┌──────────┐
  │ CAMPAIGN │ │ SKIRMISH │
  └──────────┘ └──────────┘
      │             │
  Act/Mission    Faction pick +
  select (linear  map + AI count +
  unlock, saved)  difficulty (current free-play)
```

### Campaign mode
- Linear **mission select**, progress saved to `localStorage` (locked / unlocked /
  cleared, optional-objective stars).
- Each mission = a hand-authored map (anchor layout, creeps, objective script, waves)
  + narrative cards before/after (the beats above).
- Fixed playable faction/hero per act — the campaign teaches identity.
- Persistent hero perks + unit unlocks between missions.
- Engine-wise a mission is just data:
  `{ faction, hero, mapId, plots[], creeps[], objectives[], waves[], intro, outro }`.

### Skirmish mode (the current live build)
- Pick faction + hero, one AI opponent, raze the throne. Kept as the secondary mode.
- Later: choose enemy faction, 1–3 AI, difficulty, map pick.

### Implementation path (smallest first)
1. **Mode-select screen** in front of hero-select; global `gameMode ∈ {campaign,
   skirmish}`. Skirmish → current flow untouched.
2. **Mission data table** `CAMPAIGN=[{…}]` — start with **Act I Mission 1** on the
   current Sapphire-Shores map (Iron Crown vs Horde) with an intro/outro card and the
   existing raze-the-throne objective. Proves the scaffold before authoring the rest.
3. **Objective system** — small state machine: `defend(waves)`, `raze(target)`,
   `clear(camp)`, `channel(shrine,t)`, `escort(vip,path)`, `survive(t)`. Most pieces
   exist (throne win/loss, waves, fog).
4. **Progress save** (`localStorage`) + mission-select UI.
5. **New content:** Seraphine/Skrix/Grollusk hero kits; ash-touched creep art;
   Verath Floor / Rimwall Pass / Deepvein maps; narrative cards.

**Status:** the mode-select + Act I Mission 1 ("The Survey Road") are **live** on the
existing map — Campaign launches the Paladin (≈ Valdris, Iron Crown) vs the Raider
Horde with an intro/outro card, an objective banner, and `localStorage` progress;
Skirmish is the untouched free-play. Later missions show in the list but are locked.

---

## 5b. Roster gaps — every faction needs a Siege Engine + a Flyer

Current rosters cover melee / ranged / caster but each active faction is **missing
two archetypes** the game wants:

- **Siege engine** — slow, high-HP, big damage vs *buildings* (razes thrones/plots
  fast, weak vs units). Iron Crown: a bombard/trebuchet; Raider Horde: a ram or
  rock-lobber (ties to the Chieftain's boulder theme).
- **Flying unit** — moves over water/terrain, ignores ground blockers; the answer to
  turtles and a soft counter to siege. **The shelved Drake becomes the RIMWALKER
  flyer** (renamed) when that faction ships. Iron Crown + Raider Horde each still need
  their own flyer (e.g. a Crown gryphon-rider / hippogryph analogue; a Horde
  wyvern/bat analogue) — new art to author.

| Faction | Melee | Ranged | Caster | **Siege (needed)** | **Flyer (needed)** |
|---|---|---|---|---|---|
| Iron Crown | Warrior | Archer | Priestess | bombard/trebuchet | crown flyer |
| Raider Horde | Grunt / Warrior | Archer | Shaman | ram / rock-lobber | horde flyer |
| Rimwalker (future) | Thornguard | Bark Archer | Mystic | living catapult | **Drake (renamed)** |

Engine work a flyer needs: a `flying` flag (fixed altitude offset, skips
ground/water collision + pathing), targetable by ranged/anti-air only. Siege needs a
damage-vs-structure multiplier (the `damage()` chokepoint already exists).

---

## 6. Naming note

The bible renames the game **Warcrest → Verath**. This doc + `LORE.md` use *Verath*.
A full code/asset rename (title screens, repo, deploy app) is a separate mechanical
pass; the in-game campaign cards use *Verath* now, and the rest can follow when
desired.
