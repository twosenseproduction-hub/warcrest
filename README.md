# EXOFRONT — Battle for the Ashfen Basin

A standalone, single-player, **mobile-first real-time strategy game** that runs
entirely in the browser. No backend, no accounts, no build step, no external
assets — all art is drawn procedurally on a `<canvas>` and all sounds are
synthesized at runtime with the Web Audio API.

Two original factions clash over a contested resource basin:

- **Aurex Directive** — a precise, high-tech order (teal). Fast tech, ranged focus.
- **Cinder Pact** — a rough, bio-mechanical scavenger horde (orange). Heavy armor, attrition.

You command one faction against an AI opponent that harvests, produces a growing
army, and launches escalating attack waves.

---

## Run it

This is plain HTML/CSS/JS using classic `<script>` tags (no modules, no bundler),
so it works two ways:

### Option A — just open the file
Double-click `index.html`, or drag it into a browser. It runs as-is.

### Option B — local web server (recommended on mobile / iOS)
Serving over HTTP avoids any `file://` quirks and lets you test on your phone.

```bash
cd warcrest   # or clone and cd into the repo root
python3 -m http.server 8080
# then open http://localhost:8080
```

To play on your phone, put the phone on the same Wi-Fi and visit
`http://<your-computer-ip>:8080`.

No installation, no dependencies.

---

## How to play

| Action | Touch | Mouse |
| --- | --- | --- |
| Select unit/building | Tap it | Click it |
| Select many | Toggle **Box**, then drag a box | Shift+drag a box |
| Add/remove from group | Tap another unit | Click another unit |
| Move | Tap ground | Left-click ground |
| Attack | Tap an enemy | Left-click enemy / right-click |
| Attack-move | **Long-press** ground (or arm **Atk-Move**) | Press `A` then click |
| Harvest | Select Drudge → tap a Halcite crystal | same |
| Build | Select Drudge → **Build** → tap a glowing spot | same |
| Pan camera | Drag one finger | Drag |
| Zoom | Pinch | Mouse wheel |
| Select whole army | **Army** button | same |

**Goal:** destroy the enemy core. **Lose** if your core (Citadel / Furnace Maw) falls.

### The loop
1. Mine **Halcite** with Drudges.
2. Train army units at the **Foundry** (Lancer / Skiff / Mender) and **War Forge**
   (Bulwark / Mortar).
3. Raise your **supply cap** with **Conduits** so you can field more units.
4. Defend against Cinder waves, then push and destroy the enemy core.

### Units (6 archetypes per faction)
- **Drudge** (worker) — harvests Halcite, raises structures.
- **Lancer** (light ranged) — cheap, mobile, strong in numbers.
- **Skiff** (fast scout) — raids workers and stragglers.
- **Bulwark** (heavy) — armored frontline tank.
- **Mortar** (siege) — long-range splash; devastating vs clusters and bases.
- **Mender** (support) — repairs nearby allies.

### Buildings (5 types)
- **Citadel** (core) — trains workers, banks Halcite, deposit point.
- **Conduit** — raises supply cap.
- **Foundry** — produces Lancers / Skiffs / Menders.
- **War Forge** — produces Bulwarks / Mortars.
- **Sentinel** (turret) — automated defense tower.

---

## Project structure

```
rts-game/
├── index.html          # DOM shell: menus, HUD, overlays, script order
├── README.md
├── styles/
│   └── main.css         # full UI skin (menus, HUD, overlays)
└── src/
    ├── config.js        # ⭐ ALL balance values, factions, unit/building specs
    ├── state.js         # central game state + accessors
    ├── entities.js      # factories: units, buildings, resources, fx
    ├── map.js           # the single map "Ashfen Basin"
    ├── commands.js      # selection + orders + training + placement
    ├── audio.js         # WebAudio synth (no audio files)
    ├── systems.js       # simulation: movement, combat, harvest, build, win/loss
    ├── ai.js            # enemy faction brain (economy + waves)
    ├── input.js         # camera + touch/mouse: tap/box/long-press/pinch
    ├── render.js        # canvas renderer + minimap (all art procedural)
    ├── hud.js           # DOM HUD: action tray, selection panel, event log
    └── game.js          # scenes, menu wiring, match lifecycle, main loop
```

Everything attaches to a single global `window.RTS` namespace, so the code is
modular across files but still runs without a module loader.

---

## Where to tweak balance

**Almost everything lives in `src/config.js`.** Edit and refresh — no rebuild.

- **Economy pacing:** `Config.startResources`, `Config.harvest.rate`,
  `Config.harvest.capacity`, `Config.startSupplyCap`, `Config.supplyPerPylon`.
- **Unit stats:** `RTS.Units.<role>` — `hp`, `dmg`, `range`, `speed`, `rof`,
  `cost`, `supply`, `splash`, `heal`.
- **Building stats:** `RTS.Buildings.<type>` — `hp`, `cost`, `build` (build time),
  turret `dmg`/`range`/`rof`.
- **Train times:** `RTS.baseTrain()` in `src/commands.js`.
- **AI difficulty & pressure:** `Config.ai` — `income`, `firstWaveAt`,
  `waveInterval`, `maxArmy`, `workerCount`.
- **Faction colors / names:** `RTS.Factions` in `config.js`.

### Quick difficulty presets
- **Easier:** raise `Config.ai.firstWaveAt`, raise `Config.ai.waveInterval`,
  lower `Config.ai.income` and `Config.ai.maxArmy`.
- **Harder:** the opposite.

Target match length is ~6–12 minutes with the shipped values; the first attack
wave lands around 70s so you have time to establish an economy first.

---

## Scope / non-goals

Single-player only. No multiplayer, no servers, no accounts, no cloud save, no
monetization, no campaign. One map, one skirmish mode, two factions.

All names, factions, units, buildings, lore, art, and UI language are original.
