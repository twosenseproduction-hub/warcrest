# Warcrest — Battle for the Ashfen Reach

A standalone, single-player, **mobile-first real-time strategy game** that runs
entirely in the browser. No backend, no accounts, no build step. Art uses the
Tiny Swords pixel pack (Pixel Frog) with original Warcrest faction naming and lore.

Two factions clash over contested **Ironstone** in the Reach:

- **Iron Crown** — disciplined medieval kingdom (royal blue). Fast tech, ranged focus.
- **Raider Horde** — chaotic coalition from the wilds (swamp green / bone). Heavy bruisers, attrition.

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
| Harvest | Tap Ironstone (or select worker → tap node) | same |
| Build | Hammer button → pick structure → tap valid spot | same |
| Pan camera | Drag one finger | Drag |
| Zoom | Pinch | Mouse wheel |
| Select whole army | **Army** button / double-tap ground | same |

**Goal:** destroy the enemy core (**Warren Maw** if you lead the Iron Crown, or **Citadel Keep** if you lead the Horde). **Lose** if your core falls.

### The loop
1. Mine **Ironstone** with workers (**Pawn** / **Gnome**).
2. Build **Barracks** / **War Pit** → train **Lancer** / **Thief**, then **Archer** / **Goblin Raider** and **Monk** / **Root Troll**.
3. Build **War Forge** / **Skull Forge** → train **Warrior** / **Troll**.
4. Raise **supply** with **Banner Post** / **Totem Stake**, defend Horde waves, destroy the enemy keep.

### Iron Crown units
- **Pawn** — harvests Ironstone, raises structures.
- **Lancer** — fast skirmisher (Barracks).
- **Archer** — ranged backbone (Barracks).
- **Monk** — heals allies (Barracks).
- **Warrior** — armored frontline (War Forge).

### Raider Horde units (same roles, different names)
- **Gnome**, **Thief**, **Goblin Raider**, **Root Troll**, **Troll**

### Buildings (Iron Crown / Raider Horde)
- **Citadel Keep** / **Warren Maw** — trains workers, banks Ironstone.
- **Banner Post** / **Totem Stake** — raises supply cap.
- **Barracks** / **War Pit** — light and support units.
- **War Forge** / **Skull Forge** — heavy units.
- **Arrow Tower** / **Bone Spire** — automated defense.

---

## Project structure

```
warcrest/
├── index.html          # DOM shell: menus, HUD, overlays, script order
├── README.md
├── styles/
│   └── main.css         # full UI skin (menus, HUD, overlays)
└── src/
    ├── config.js        # ⭐ ALL balance values, factions, unit/building specs
    ├── state.js         # central game state + accessors
    ├── entities.js      # factories: units, buildings, resources, fx
    ├── map.js           # Sapphire Shores (Ashfen Reach)
    ├── commands.js      # selection + orders + training + placement
    ├── audio.js         # WebAudio synth (no audio files)
    ├── systems.js       # simulation: movement, combat, harvest, build, win/loss
    ├── ai.js            # Raider Horde AI (economy + waves)
    ├── input.js         # camera + touch/mouse: tap/box/long-press/pinch
    ├── render.js        # canvas renderer + minimap
    ├── hud.js           # DOM HUD: action tray, selection panel, event log
    └── game.js          # scenes, menu wiring, match lifecycle, main loop
```

Everything attaches to a single global `window.RTS` namespace.

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
  `waveInterval`, `maxArmy`, `pawnCount`.
- **Faction colors / names / lore:** `RTS.Factions` and `RTS.Resource` in `config.js`.

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

Faction naming and lore are original to Warcrest; unit/building sprites use the
Tiny Swords art pack under its license.
