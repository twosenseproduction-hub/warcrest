# Claude Prompt — No Folder Attachment Needed

Claude often rejects whole folders. Use **one** of these methods:

| Method | What to attach | When |
|--------|----------------|------|
| **1 — No file** | Nothing | Paste Prompt A below |
| **2 — One file** | `CONSOLIDATED_SOURCE.md` | Paste Prompt B |
| **3 — Zip** | `warcrest-bundle.zip` (repo root) | Paste Prompt B |
| **4 — Claude Code** | Point at `./warcrest` folder locally | No upload |

---

# PROMPT A — Fresh build (no attachment)

```
Build WARCREST: Battle for the Ashfen Reach — a mobile-first single-player RTS in HTML/CSS/JS.

EXECUTION: Write ALL files. No plan-only. Runnable via index.html or python3 -m http.server 8080.
No npm, no backend. Original art/names only — do NOT copy Clash Royale, Blizzard, or copyrighted assets.
Art style inspired by Tiny Swords by Pixel Frog — medieval fantasy cartoon, chibi proportions, warm earthy palette.

═══════════════════════════════════════════════════════
MOBILE-FIRST CONTROLS (HIGHEST PRIORITY AFTER GRAPHICS)
═══════════════════════════════════════════════════════

Design every interaction for one-handed phone play. A new player must understand controls without reading a manual.

CORE TOUCH MODEL (keep it simple):
┌─────────────────────────────────────────┐
│  TAP = select or command                │
│  DRAG empty ground = pan camera         │
│  PINCH = zoom (+ two-finger pan)        │
│  LONG-PRESS ground = attack-move        │
│  DOUBLE-TAP empty ground = select army  │
└─────────────────────────────────────────┘

SMART TAPS (reduce steps):
- Tap Ironstone node with nothing selected → nearest worker auto-mines
- Tap friendly unit/building → select
- Tap another friendly unit while group selected → add/remove from group
- Tap enemy while army selected → attack
- Tap ground while army selected → move (or attack-move if armed)
- Tap Ironstone with worker(s) selected → all selected workers mine

THUMB ZONE UI (right edge):
Floating rail buttons (≥52px circles, golden 3D style):
  + / − zoom
  ⚑ select army
  ■ stop
  ⌖ toggle attack-move (highlight when armed)
  ⌂ center camera on base

BOTTOM DOCK:
- Contextual hint bar above tray ("Tap Ironstone to mine", changes with selection)
- Selection info panel (compact when nothing selected)
- Horizontal scroll action tray: buttons ≥78px tall on phone
- Train/build buttons show cost on button face

TOP BAR:
- Centered resource pills (Ironstone + Supply) — largest readable element
- Pause button min 46px

GESTURE FEEDBACK:
- Long-press: expanding orange ring + haptic vibrate + toast "Attack-move"
- Commands: colored ripple on ground (move=cyan, attack=red, attack-move=orange)
- UI→map bleed prevention: block map input 420ms after any HUD tap
- Generous touch slop: 42px on mobile for unit/building hit tests
- Pan ONLY when drag starts on empty ground (never steal drags from unit taps)

CONTEXTUAL HINTS (always visible on mobile):
Update live based on game state:
- Nothing selected: "Tap Ironstone to mine · Citadel Keep to train · double-tap = army"
- Worker selected: "Tap Ironstone to mine · or Build below"
- Army selected: "Tap ground = move · enemy = attack · long-press = attack-move"
- Attack-move armed: "Tap ground or enemy — units attack-move there"
- Building placement: "Tap valid spot near base"

CAMERA (mobile defaults):
- Phone (<520px): default zoom 1.14
- Tablet/mobile (<768px): default zoom 1.08
- Pinch range 0.55–2.0
- Start camera centered on player base

PERFORMANCE:
- cap devicePixelRatio at 2
- touch-action: none on canvas
- preventDefault on touchmove/touchstart for game surface
- viewport: user-scalable=no, viewport-fit=cover
- safe-area-inset on top bar, dock, rail

ONBOARDING (first play, localStorage):
5 bullets covering: tap Ironstone to mine, Citadel Keep to train, tap to move/attack, pan/pinch/+/−, quick rail buttons

═══════════════════════════════════════════════════════
GRAPHICS
═══════════════════════════════════════════════════════
Premium mobile cartoon strategy: chibi units, thick dark outlines, cel-shading, drop shadows,
lush green medieval terrain, glowing Ironstone crystal nodes, warm parchment menus, golden 3D buttons.
Tiny Swords inspired aesthetic — stone keeps, wooden huts, bone totems, earthy warm palette.
Rich src/art.js — NOT plain geometric shapes.

═══════════════════════════════════════════════════════
GAME CONTENT
═══════════════════════════════════════════════════════
Factions:
  Iron Crown (royal blue #1565C0 / silver / gold — player):
    Units: Pawn (worker), Archer (light), Lancer (scout), Warrior (heavy), Catapult (siege), Monk (support)
    Buildings: Citadel Keep (core), Banner Post (supply), Barracks (foundry), War Forge, Arrow Tower (turret)

  Raider Horde (swamp green #558B2F / muddy brown / bone — AI):
    Units: Gnome (worker), Goblin Raider (light), Thief (scout), Troll (heavy), Minotaur (siege), Root Troll (support)
    Buildings: Warren Maw (core), Totem Stake (supply), War Pit (foundry), Skull Forge, Bone Spire (turret)

Resource: Ironstone. Supply 12 + 8/Banner Post or Totem Stake (max 80).
Map: Ashfen Reach, 2600×1800, 7 Ironstone nodes. Win = destroy enemy core.
AI waves at 70s, every 52s. Late waves include elite units: Gnoll, Caveborn, Skull. Match 6–12 min.

Systems: harvest, build placement ghost, train queues, combat/projectiles/splash/heal,
minimap, event log, pause/settings/onboarding/win-loss, WebAudio synth.

Files: index.html, styles/main.css, src/{config,state,entities,map,commands,art,render,systems,ai,input,audio,hud,game}.js, README.md

Start building now — write every file.
```

---

# PROMPT B — Improve existing (attach CONSOLIDATED_SOURCE.md or zip)

```
Attached: complete WARCREST source. KEEP gameplay working. ELEVATE mobile UX + cartoon art.

PRIORITY 1 — MOBILE CONTROLS (input.js, hud.js, index.html, main.css, config.js)
Implement the full mobile control spec:
- Smart tap Ironstone → auto-send nearest worker
- Double-tap empty ground → select army
- Long-press ring visual + haptic for attack-move
- Right thumb rail: zoom +/-, army, stop, attack-move, center base
- Live contextual gesture hint bar
- Pan only from empty ground drags
- Two-finger pinch zoom + pan
- 42px touch slop, 420ms UI block, 78px+ action buttons
- Onboarding with mobile-specific tips

PRIORITY 2 — ART (art.js, render.js)
Tiny Swords inspired medieval cartoon aesthetic:
- Iron Crown: Pawn, Archer, Lancer, Warrior, Catapult, Monk — royal blue/silver/gold palette
- Raider Horde: Gnome, Goblin Raider, Thief, Troll, Minotaur, Root Troll — swamp green/brown/bone palette
- Stone keeps and wooden huts, glowing Ironstone crystal nodes, warm earthy terrain
- Chibi characters per role, chunky buildings, CR-style health bars, juice VFX

PRIORITY 3 — POLISH
Zero console errors. Menus match warm parchment/stone medieval cartoon style.

Return FULL updated files only for files you changed. List changed files at top.
```

---

# Quick reference — mobile control spec

| Gesture | Result |
|---------|--------|
| Tap Ironstone (nothing selected) | Nearest worker mines |
| Tap unit/building | Select |
| Tap unit (group active) | Add/remove from group |
| Tap enemy (army selected) | Attack |
| Tap ground (army selected) | Move |
| Long-press ground | Attack-move |
| Double-tap empty ground | Select army |
| Drag empty ground | Pan |
| Pinch | Zoom (+ pan) |
| ⌖ button | Toggle attack-move |
| ⚑ button | Select all combat units |

If CONSOLIDATED_SOURCE.md is too large, paste Prompt A alone (no attachment).
