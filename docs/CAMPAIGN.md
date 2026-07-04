# Warcrest — Campaign & Modes

> Story bible + level design for the single-player campaign, and the shape of the
> **Campaign / Skirmish** mode split. Built on the canon already in the codebase:
> the world of **Valdris** and the factions **Iron Crown**, **Rimwalkers**, and the
> **Raider Horde** (`index.html` faction cards). This doc adds the fourth power —
> the **Hollow Crown** (undead) — and the neutral **creeps**, and lays out a
> five-act campaign that teaches the game one system at a time (per
> `DESIGN_DIRECTION.md`: *layer complexity onto a proven core*).

---

## 1. The world of Valdris

Valdris is a broken country of **holdfasts** — walled thrones ringed by a handful
of buildable ground. Nobody holds open land; you hold *anchors*. Between them lie
sundered isles, fords, creep-haunted wilds, and the old **barrow-roads** where the
first kings were buried standing up, crowned, facing the border they died
defending.

Three living powers have carved Valdris between them, and a fourth has been waking
under it.

The spine of the story is simple and old, and it works: **the living powers
exhaust each other in a border war, and the war's own dead rise to inherit the
ruin.** Every faction is right about its enemies and blind to the thing climbing
out of the barrows behind them.

### The unifying thread — the Rimebound Crown
A relic: the first high-king's crown, buried with him in the deepest barrow. It
does not raise the dead — it *organizes* them. While it lay quiet, the dead were
scattered and mindless (the creeps you fight everywhere). When the border war
spills enough blood onto the barrow-roads, the Crown wakes, and the scattered dead
become an army with a will. Each act is one faction finding a shard of the truth;
the finale is the fight over the Crown itself.

---

## 2. The four factions

Playable identity should be felt through *how you win*, not a stat sheet. Each
faction owns one verb.

### Iron Crown — *hold the line* (humans · `aurex`)
Royal-blue knights from stone keeps: **Pawns, Archers, Lancers, Warriors**, led by
the **Paladin** (existing hero: Consecration / Hammer of Justice / Divine Shield).
Disciplined, ranged-forward, fast to tech. Their power is **formation and towers** —
the Crown wins by making ground too expensive to take.
- **Faction mechanic — Muster:** units near a friendly Tower or the Throne gain a
  small armor/damage bonus. Rewards the anchored, defensive playstyle.
- Fantasy: Lawful, brittle if caught in the open, unbeatable behind a wall.

### Rimwalkers — *the grove remembers* (forest wardens · `rimwalker`)
Living-wood wardens — **Grove Hands, Bark Archers, Bramble Wardens, Thornguards** —
and the hero **Aelindra** (maps to the existing Elf-Queen Warden kit: Blink / Fan
of Knives / Shadow Strike). Organic, evasive, poison and regrowth.
- **Faction mechanic — Grove Bond:** buildings slowly regrow HP; units standing in
  grove/forest tiles regenerate. They out-*last* rather than out-punch.
- Fantasy: Patient, mobile, punishing to a besieger who can't end the fight fast.

### Raider Horde — *take it back* (wilds · `cinder`)
Chaotic wild-folk behind skull totems — **Gnomes/Grunts, Spear Goblins, Gnolls,
Hex Shamans, Trolls** — led by the **Chieftain** (existing boss kit: Boulder Hurl /
Seismic Slam / War Roar). Slow to muster, relentless once rolling.
- **Faction mechanic — Bloodfury:** kills briefly raise nearby horde damage/speed
  (a rolling snowball). Cheap chaff, expensive elites (the **Drake** sits here).
- Fantasy: Attrition and momentum — survive the first wave and you're in trouble.

### The Hollow Crown — *inherit the dead* (undead · `hollow`) — **NEW**
The barrow-kings, risen under the Rimebound Crown. Where the Iron Crown is the
*living* kingdom, the Hollow Crown is its buried predecessor come to reclaim it —
same heraldry, drained of color: bone-white banners, a crown of frost. Roster
(new art to author): **Thralls** (raised chaff, free-ish), **Boneshot archers**,
**Wights** (elite melee), **Necro-Acolytes** (raise corpses into more thralls),
and a hero, the **Barrow-King** (kit sketch: *Raise Dead* — turn nearby corpses
into thralls; *Frost Nova* — AoE slow; *Deathgrip* — pull + stun a target).
- **Faction mechanic — Harvest:** every unit that dies on the field (yours *or*
  theirs) leaves a corpse the Hollow Crown can raise. They get *stronger the longer
  the battle runs* — the anti-Rimwalker.
- Fantasy: You don't out-produce them; you must end it before the corpse pile does.

**Faction counter-triangle (for skirmish balance + campaign matchups):**
Iron Crown (defense/range) ▸ beats ▸ Raider Horde (melee rush) ▸ beats ▸ Rimwalker
(attrition, gets snowballed) ▸ beats ▸ Iron Crown (out-lasts the turtle). The
Hollow Crown sits *outside* the triangle — it beats anyone who lets the fight go
long, and loses to whoever ends it fast.

---

## 3. Creeps & neutral objectives (shared across all missions)

Creeps are the mindless dead and wild things — the world before the Crown wakes.
They exist to make the *map* matter (per pillar 5), and they seed the undead threat
visually long before Act IV.

| Creep camp | Where | Guards | Reward for clearing |
|---|---|---|---|
| **Barrow-wights** | old barrow-roads | 2–3 slow undead | opens a corpse-shrine (see below) |
| **Gnoll pack** | forest edges | fast melee chaff | a **Gold Mine** node freed to claim |
| **Bog-lurkers** | fords / shallows | ranged spitters | a **Lumber** grove freed |
| **Stone sentinels** | ridge chokes | one tanky elite | a **neutral Tower** you can garrison |

**Neutral objectives (contest, don't destroy):**
- **Corpse-shrine** — channel to gain a one-time buff (heal pulse / temporary
  damage aura). In Act IV the Hollow Crown *owns* these instead.
- **Mercenary camp** — pay gold to hire 2–3 neutral units once.
- **Expansion throne** — a second buildable ring; taking it doubles economy but
  splits your defense (the core risk/reward of map control).

Design rule: **every creep clear should unlock a power spike** (a mine, a shrine, a
merc squad) so the player learns *map control = tempo*, not just XP.

---

## 4. Campaign structure

Five acts, one playable faction each for Acts I–IV (so the campaign *is* the
faction tutorial), then a grand-alliance finale. ~5–6 missions per act, each
~12–18 min. Each mission introduces **exactly one** new system and reuses
everything before it. A light roguelite meta (per-act hero perks, persistent
unlocks) rides between missions.

Legend: **▸ New system** = the one mechanic this mission teaches.

---

### ACT I — "The Border Does Not Hold" · play **Iron Crown**
The Raider Horde is raiding across the Sundered Isles. You are a Paladin-marshal
sent to hold the border. (Also the game's onboarding.)

1. **Muster at Dawnwatch** — *tutorial.* Pilot the hero; walk, auto-fight one gnoll
   pack. ▸ **New: hero control + auto-attack.**
2. **Hold the Ford** — build House + Barracks on anchored plots; train Pawns; defend
   one wave. ▸ **New: anchored building + train + prep→assault rhythm.**
3. **The Free Mine** — clear a gnoll creep camp to claim a gold mine, then out-tech
   the raiders. ▸ **New: creeps + economy/expansion.**
4. **Towers of Stonewatch** — a defense mission; the Horde assaults in escalating
   waves. ▸ **New: Towers + the Muster faction mechanic + fog-gated defense.**
5. **The Chieftain's Van** — first real enemy hero fight (Raider Chieftain
   mini-boss); use terrain + towers to survive Boulder Hurl. ▸ **New: enemy hero +
   ability range/telegraph reading.**
6. **Break the Warcamp** *(act finale)* — assault the Horde forward base and raze
   its throne. First taste of *attacking* a base, not just holding. Ends on the
   discovery: the Horde is retreating *from* something in the barrows.

**Boss:** Raider Warlord (Chieftain kit). **Reward/unlock:** Paladin perk tier 1;
the **Lancer** unit unlocked for skirmish.

---

### ACT II — "What the Wilds Flee" · play **Raider Horde**
Told from the other side: the Horde isn't invading for plunder — it's being
*pushed* off ancestral barrow-land by the dead waking beneath it.

1. **The Long Retreat** — a fighting withdrawal; learn the Horde while
   outnumbered. ▸ **New: Bloodfury snowball mechanic.**
2. **Totems of the Deep Wood** — claim corpse-shrines before the barrow-wights do.
   ▸ **New: neutral objective contest (shrines) + day/night (wights stronger at
   night).**
3. **Blood on the Barrow-Road** — escort the Chieftain across a wight-infested road.
   ▸ **New: escort/protect-the-VIP objective + heavier creeps.**
4. **The Drake Pens** — free and tame the **Drake** (the elite you already wired in)
   as a mid-mission power spike. ▸ **New: elite/high-supply unit + a hero-scale
   ally.**
5. **Warsong of the Horde** — a big open battle vs an Iron Crown expedition; War
   Roar + Bloodfury at full tilt. ▸ **New: large-army command + attack-move
   discipline.**
6. **The First Wight-King** *(act finale)* — the Horde breaks into the deepest
   barrow and kills a risen barrow-lord… and finds the **Rimebound Crown** empty of
   its wearer. Someone already took it.

**Boss:** Wight-King (early Hollow-Crown kit preview). **Unlock:** Drake + Hex
Shaman for skirmish; Chieftain perk tier.

---

### ACT III — "The Grove Corrupted" · play **Rimwalkers**
The blight from the opened barrows is rotting the living wood. Aelindra must
cleanse the grove and learn who wears the Crown now.

1. **Rot at the Roots** — cleanse blighted grove tiles (channel objectives) while
   defending. ▸ **New: Grove Bond regen + cleanse/reclaim objective.**
2. **Blink and Bramble** — a mobility mission built around Aelindra's Blink through
   choke terrain. ▸ **New: hero-mobility ability puzzles.**
3. **The Poisoned Ford** — hold a ford at night vs rising thralls; Fan of Knives
   clears chaff. ▸ **New: AoE ability vs swarm + night survival.**
4. **Emissaries** — a *temporary alliance* mission: fight beside an Iron Crown
   detachment (allied AI) against the dead. ▸ **New: allied-faction co-op + mixed
   army.**
5. **The Weeping Barrow** — descend into a corrupted barrow; tight, dark, corpse
   everywhere (Harvest preview — the more you kill, the more rise). ▸ **New:
   attrition pressure / "end it fast" tension.**
6. **Crown of Frost** *(act finale)* — Aelindra confronts the **Barrow-King** and
   learns his identity: the *first Iron King*, the ancestor the living Crown still
   venerates. The living kingdom's founder is the undead's leader.

**Boss:** Barrow-King (partial kit). **Unlock:** Bramble Warden + Thornguard;
Aelindra perk tier.

---

### ACT IV — "The Hollow Crown" · play **The Undead** *(the twist act)*
Play the dead. Not as villains twirling — as the *inevitable*: every soldier the
living factions spent in Acts I–III is now your army. This is where "Harvest" and
"you get stronger the longer it runs" become the player's own engine.

1. **Rise** — *tutorial for the faction.* Raise your first thralls from a battlefield
   of Act-I corpses. ▸ **New: Raise Dead / Harvest as *your* economy.**
2. **The Acolytes' March** — Necro-Acolytes convert corpses mid-fight; snowball a
   siege. ▸ **New: corpse-economy loop + Frost Nova slow.**
3. **Reclaim Dawnwatch** — assault the *same* Act-I tutorial keep, now from the dead
   side (payoff of familiar geography). ▸ **New: siege as the attacker with a
   growing army.**
4. **Deathgrip the Living** — pick off enemy heroes with the Barrow-King's pull;
   a hunter mission. ▸ **New: hero-vs-hero focus play.**
5. **Two Crowns** — the living factions finally ally against you; you fight all
   three at once and *still win by attrition* if you don't let them end it. ▸
   **New: multi-front defense + Harvest at scale.**

**Boss/turn:** at the height of victory, the Barrow-King reveals he means to raise
*all* of Valdris — including the player's own risen kin — and the player-undead
faction fractures. Sets up the finale.

---

### ACT V — "Warcrest" · play **Grand Alliance** (choose your hero)
The three living factions + the fractured undead who refused the Barrow-King unite
for one siege on the barrow-throne to shatter the Rimebound Crown.

1. **The Last Muster** — build a combined-arms army (mixed roster from all
   factions). ▸ **New: full roster / free faction mixing.**
2. **The Frozen Road** — push the barrow-road under endless Harvest pressure; a race
   against the rising dead. ▸ **New: timed push / soft enrage.**
3. **Warcrest** *(final)* — the Barrow-King, all three ability phases, on the
   barrow-throne. Shatter the Crown. Choose the ending (who takes the empty throne
   — sets a New-Game+ faction bonus).

**Reward:** everything unlocked for Skirmish; New-Game+ modifiers.

---

## 5. Campaign vs Skirmish — the mode split

The title/start flow gets one new decision **before** faction/hero select:

```
        ┌─────────────┐
        │   WARCREST  │
        └─────────────┘
        ▼           ▼
  ┌──────────┐  ┌──────────┐
  │ CAMPAIGN │  │ SKIRMISH │
  └──────────┘  └──────────┘
      │              │
  Act/Mission     Faction pick +
  select (linear   map + AI count +
  unlock, saved    difficulty
  progress)        (current free-play)
```

### Campaign mode
- **Linear mission select** with progress saved to `localStorage` (per-mission:
  locked / unlocked / cleared, plus stars for optional objectives).
- Each mission = a **hand-authored map** (anchor layout, creep camps, objective
  script, scripted waves) + a **narrative card** before/after (the story beats
  above).
- Fixed playable faction/hero per act (Acts I–IV) — the campaign teaches identity.
- Persistent **hero perks** and **unit unlocks** carry between missions (light
  roguelite meta).
- Reuses the existing engine wholesale; a "mission" is just a data object:
  `{ faction, hero, mapId, plots[], creeps[], objectives[], waves[], intro, outro }`.

### Skirmish mode (already the live build)
- The current symmetric free-play: pick faction + hero, one AI opponent, fight to
  raze the throne. Kept as the *secondary* mode per `DESIGN_DIRECTION.md`.
- Extensions to layer in later: choose enemy faction, 1–3 AI, difficulty, map pick.

### Implementation path (engine changes, smallest first)
1. **Mode-select screen** in front of the existing hero-select overlay; a global
   `gameMode ∈ {campaign, skirmish}`. Skirmish → current flow untouched.
2. **Mission data table** `CAMPAIGN=[{…}]` — start with **Act I / Mission 1–2**
   reusing the current map + a scripted objective + intro/outro cards. Proves the
   campaign scaffold end-to-end on one mission before authoring the rest (the
   design doc's "first slice" discipline).
3. **Objective system** — a tiny state machine: `defend(waves)`, `raze(target)`,
   `clear(camp)`, `channel(shrine, t)`, `escort(vip, path)`, `survive(t)`. Most
   already exist in pieces (throne win/loss, waves, fog).
4. **Progress save** (`localStorage`) + mission-select UI.
5. **New content:** Hollow-Crown roster art + Barrow-King hero kit; per-mission
   maps; narrative cards.

**Recommended next build step:** ship #1 + #2 (mode select + first two campaign
missions on the existing map). That makes "Campaign or Skirmish" real and playable
without waiting on all the art, exactly the "build the loop before betting the game
on it" rule.

---

## 6. Authoring checklist (what each new faction/mission needs)

- **Hollow Crown:** 5 unit rigs + Barrow-King hero (Raise Dead / Frost Nova /
  Deathgrip), bone-white palette, Harvest economy hook, faction plot theme (bones —
  already sketched in `PLOT_THEME`).
- **Per mission:** map anchor layout, creep/neutral placements, objective script,
  wave script, intro/outro narrative card, star (optional) objective.
- **Meta:** hero perk trees (3 tiers × 4 heroes), unit unlock gates, save schema.
