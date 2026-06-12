# Claude Prompt — EXOFRONT Mobile RTS

Copy everything below the line into Claude. Attach this repo's `rts-game/` folder if you want it to improve the existing code rather than start fresh.

---

```
You are building a complete, playable, single-player mobile RTS web game called EXOFRONT: Battle for the Ashfen Basin.

IMPORTANT EXECUTION RULES
- Do NOT give me a plan only. Write the actual app code.
- Do NOT stop at architecture. Ship a working game I can open in a browser.
- Build every file. No "coming soon" buttons. If a menu item exists, it must work.
- Do not ask clarifying questions unless truly blocked. Make pragmatic choices.
- Favor playability and visual polish over theoretical completeness.

---

## WHAT THIS IS

A standalone, mobile-first real-time strategy game that runs locally in the browser.
No backend. No login. No multiplayer. No build step required (plain HTML/CSS/JS).
No external game assets from copyrighted titles.

The emotional target: the clarity and juice of a top mobile strategy game (think Clash Royale's readability, bold cartoon style, chunky UI, satisfying feedback) — but with ORIGINAL factions, ORIGINAL unit designs, ORIGINAL names, and ORIGINAL art. Do NOT copy StarCraft, Clash Royale characters, Blizzard factions, Supercell assets, or any copyrighted names/art/layout/lore.

Game title: EXOFRONT
Map name: The Ashfen Basin
Mode: Single skirmish vs AI

---

## PRIMARY GOAL

Make a fully playable mobile RTS with:
- Original factions, buildings, units, UI skin, terrain, and iconography
- Touch-first controls that feel natural without a manual
- Cartoon arena graphics with premium mobile-game polish
- Enough content to feel like a real game, not a tech demo
- Match length target: 6–12 minutes; fun within first 60 seconds

---

## ART DIRECTION (CRITICAL — THIS IS THE MAIN PRIORITY)

Visual style: premium mobile cartoon strategy aesthetic.

Reference the FEEL of top mobile strategy games (bold outlines, chibi proportions, glossy cel-shading, bright saturated colors, chunky UI, satisfying juice) — but create 100% original characters and buildings.

### Graphics requirements
1. **Units must look like characters, not geometric placeholders**
   - Chibi proportions: big head (~40% of height), small body, readable silhouette at phone scale
   - Thick dark outline (~3px at native scale) on every sprite/shape
   - Cel-shaded fills with highlight gloss (lighter patch top-left)
   - Drop shadow ellipse under every unit and building
   - Distinct silhouette per role — identifiable in 0.5 seconds at mobile zoom
   - Facing direction visible (weapon/tool points toward target)
   - Optional: subtle idle bob animation (sin wave on Y)

2. **Buildings must look like arena structures, not flat rectangles**
   - Chunky cartoon architecture: castle tower, hut with peaked roof, forge chimney, cannon turret
   - Construction scaffold overlay while building
   - Faction-colored trim and flags/banners
   - Gloss highlights on roofs/walls

3. **Terrain: bright arena board**
   - Lush green grass base with subtle diamond tile pattern (like a polished arena)
   - Sandy patches near each base spawn
   - Cartoon bushes as decor (not grey rocks)
   - Gold coin/crystal piles for resource nodes with count pill label

4. **UI: mobile game HUD**
   - Blue sky gradient menus
   - Golden 3D beveled buttons (dark outline, drop shadow, press-down state)
   - Fredoka or similar rounded display font
   - Resource pills centered in top bar (Halcite gold icon + Supply cap)
   - Bottom action tray: large scrollable buttons (min 76×72px) with icon + label + cost
   - Right-side floating quick-action rail: Army, Stop, Attack-Move, Center Base (52px circles)
   - Chunky health bars: dark outline, green/yellow/red fill, white shine strip
   - White glowing selection ring + ground ellipse

5. **Juice / feedback**
   - Hit flash (white overlay)
   - Muzzle flash on ranged attacks
   - Spawn burst ring
   - Floating "+12" damage/heal/gold text
   - Screen shake on big explosions
   - Red vignette pulse when base is under attack
   - Projectile trails (chunky colored orbs with outline)

6. **Implementation options (pick the best for quality)**
   - Preferred: dedicated `src/art.js` with rich canvas drawing functions per unit/building/terrain
   - Also acceptable: original local SVG assets in `assets/` rendered to canvas
   - Also acceptable: small sprite sheets you generate as inline SVG or PNG
   - NOT acceptable: plain circles/triangles/hexagons as final art
   - NOT acceptable: fetching external copyrighted sprite sheets

---

## FACTIONS (ORIGINAL)

### Player-selectable: Aurex Directive
- Fantasy: disciplined high-tech order, precision, clean geometry, rail-fire
- Colors: cyan `#26c6da`, light cyan `#80deea`, dark teal `#00838f`, gold accent `#fff176`
- Visual style: angular armor, clean helmets, bright energy weapons

### Enemy AI: Cinder Pact
- Fantasy: bio-mechanical scavenger horde, salvage, furnaces, spite
- Colors: orange `#ff7043`, peach `#ffab91`, dark orange `#d84315`, yellow accent `#ffee58`
- Visual style: rough welded plates, hoods, rust, crude weapons

Each faction renames the same unit/building archetypes (see content spec below).

---

## CONTENT SPEC

### Resource
- **Halcite** — single harvestable resource (gold crystals/coins on map)
- Workers mine → carry → deposit at core
- Clear UI: resource counter pulses on income, "+N" float text on delivery

### Buildings (5 types)
| Type | Aurex name | Cinder name | Role |
|------|-----------|-------------|------|
| core | Citadel | Furnace Maw | Main base, trains workers, deposit point. HP 1600. |
| conduit | Conduit | Bellows | +8 supply cap. Cost 80, build 10s. HP 420. |
| foundry | Foundry | Scrap Pit | Trains light/scout/support. Cost 150, build 18s. HP 760. |
| forge | War Forge | Slag Forge | Trains heavy/siege. Cost 220, build 26s. HP 980. |
| turret | Sentinel | Spire Gun | Auto-defense tower. Cost 120, build 14s. HP 520. Dmg 20, range 178. |

### Units (6 archetypes per faction)
| Role | Aurex | Cinder | Stats (base) |
|------|-------|--------|--------------|
| worker | Drudge | Grub | HP 55, spd 100, dmg 5, rng 22, cost 50, supply 1. Harvests + builds. |
| light | Lancer | Spitter | HP 64, spd 124, dmg 9, rng 132, ranged, cost 75, supply 1. |
| scout | Skiff | Runner | HP 46, spd 188, dmg 7, rng 96, ranged, cost 60, supply 1. |
| heavy | Bulwark | Brute | HP 230, spd 62, dmg 30, rng 46, melee, cost 150, supply 3. |
| siege | Mortar | Lobber | HP 120, spd 56, dmg 46, rng 236, splash 46, cost 200, supply 3. |
| support | Mender | Stitcher | HP 80, spd 108, heal 12, rng 110, cost 120, supply 2. |

Train times (seconds): worker 7, light 9, scout 8, support 12, heavy 16, siege 20.

### Map: Ashfen Basin
- World size: 2600 × 1800
- Player base: bottom-left (Citadel + Foundry + 3 workers)
- Enemy base: top-right (core + Foundry + Forge + 4 workers)
- 7 Halcite nodes: 2 near each base, 3 contested center
- Win: destroy enemy core. Lose: your core destroyed.

---

## GAMEPLAY SYSTEMS (ALL REQUIRED)

### 1. Economy
- Worker harvest loop: walk to node → mine → walk to core → deposit
- Carry capacity: 12, mine rate: 26/sec
- Starting Halcite: 250
- Supply cap: 12 from core, +8 per Conduit, max 80

### 2. Base building
- Select worker → Build menu → tap valid placement spot
- Ghost preview: green = valid, red = invalid
- Must be near friendly buildings (within ~360 units)
- Cannot overlap buildings or resource nodes
- Construction progress bar; worker walks to site

### 3. Combat
- Tap enemy to attack; tap ground to move
- Long-press ground OR Attack-Move button = attack-move
- Auto-acquire targets in range
- Ranged = projectiles; melee = instant
- Siege splash damage
- Support heals lowest-HP ally in range
- Unit separation (no stacking blobs)
- Death → corpse fade → explosion effect

### 4. AI opponent
- Passive income: 9.5 Halcite/sec
- Maintains 4 workers harvesting
- Produces mixed army (light/scout/support/heavy/siege rotation)
- Army cap grows over time (max 26)
- Attack waves: first at 70s, then every 52s
- Waves attack-move toward player core
- Event log: "Enemy scouts probing" / "Cinder assault wave inbound!"

### 5. Touch controls (mobile-first)
- Tap: select unit/building, command move/attack/harvest
- Drag empty ground: pan camera
- Pinch: zoom (0.55–2.0×; default 1.08 on mobile)
- Long-press (~460ms): attack-move (with haptic vibrate if available)
- Box select: toggle Box mode OR Shift+drag on desktop
- Tap friendly unit with selection active: add/remove from group
- UI touch blocking: 380ms after button press (no accidental map commands)
- Touch slop: 34px on mobile for easier selection
- Right-click (desktop): quick command

### 6. RTS readability
- Health bars on damaged units/buildings (optional always-on in settings)
- Selection rings (white glow + ground ellipse)
- Faction color coding
- Building construction + production queue progress
- Rally points shown when building selected
- Minimap (top-right, compact on phone)
- Event log (max 6 messages, 2 visible on phone)
- Toast notifications for errors ("Not enough Halcite", "Supply cap reached")

---

## APP FLOW / SCREENS

1. **Main menu** — logo EXOFRONT, Skirmish, How to Play, Settings
2. **Faction select** — Aurex vs Cinder cards with traits; player picks one, other is AI
3. **Onboarding overlay** — first-play tips (4 bullets), stored in localStorage
4. **Gameplay** — canvas + HUD
5. **Pause menu** — Resume, Settings, Restart, Quit to Menu
6. **Settings** — audio toggle, SFX volume slider, always-show-health toggle
7. **Win/Loss overlay** — stats (time, kills, units built, halcite mined), Play Again, Main Menu
8. **How to Play** — 6 cards explaining harvest/train/build/command/attack-move/win

Audio: WebAudio synth only (no audio files). Short blips for click, move, attack, build, ready, shot, boom, win, lose.

---

## TECHNICAL REQUIREMENTS

### Stack
- HTML + CSS + JavaScript (ES5-compatible IIFE modules OR ES modules — your choice)
- Canvas for game world rendering
- DOM for HUD/menus/overlays
- NO backend, NO npm required to run (zero dependencies ideal)
- Classic `<script>` tags OR type="module" — must run by opening index.html or `python3 -m http.server 8080`
- Single global namespace: `window.RTS`

### Project structure
```
rts-game/
├── index.html
├── README.md
├── styles/main.css
├── assets/          (optional: original SVG/PNG if you use file-based art)
└── src/
    ├── config.js    ← ALL balance values, factions, unit/building specs
    ├── state.js     ← central game state object
    ├── entities.js  ← factories for units, buildings, resources, effects
    ├── map.js       ← Ashfen Basin layout
    ├── commands.js  ← selection, orders, training, building placement
    ├── art.js       ← ★ ALL cartoon drawing (units, buildings, terrain, VFX)
    ├── render.js    ← camera transform, render loop, minimap
    ├── systems.js   ← simulation: movement, combat, harvest, build, win/loss
    ├── ai.js        ← enemy brain
    ├── input.js     ← touch/mouse/camera/pinch/box-select/long-press
    ├── audio.js     ← WebAudio synth
    ├── hud.js       ← DOM HUD sync, action tray, selection panel, event log
    └── game.js      ← scenes, menus, game loop, bootstrap
```

### Architecture rules
- One central `state` object; no scattered globals
- `requestAnimationFrame` game loop with delta time
- Separate simulation from rendering
- All balance in `config.js` — document where to tweak in README
- `prefers-reduced-motion` respected (disable shake/animations)

---

## BALANCE TARGETS

- First meaningful choice within ~30 seconds (train worker vs light vs build conduit)
- First combat pressure at ~70 seconds (first AI wave)
- Match length: 6–12 minutes
- Worker mining loop must be obvious from visuals alone (carry bag, +N float, gold node)
- Heavy/siege units feel expensive but impactful

---

## MOBILE UX CHECKLIST

- [ ] viewport meta: no user scaling, viewport-fit=cover
- [ ] touch-action: none on canvas
- [ ] preventDefault on touchmove/touchstart for game surface
- [ ] safe-area-inset padding on top bar and bottom dock
- [ ] action buttons ≥ 72px tall
- [ ] quick-action rail on right for thumb reach
- [ ] default zoom closer on phones (< 768px width)
- [ ] event log trimmed on small screens
- [ ] no dead buttons anywhere

---

## NON-GOALS

- Multiplayer, accounts, cloud save, campaign, monetization, app store packaging
- Copying any existing game's assets, characters, factions, or UI verbatim
- Phaser/React/build tools unless you strongly justify it — keep run instructions to "open index.html"

---

## DELIVERABLES

1. Create ALL project files with complete working code
2. Include README.md with exact run instructions
3. Include balance tuning section pointing to config.js
4. Game must load with zero console errors
5. Graphics must be cartoon-quality — NOT geometric placeholders

---

## OPTIONAL: IMPROVE EXISTING CODEBASE

If I attach the current `rts-game/` folder, you may refactor it rather than rewrite from scratch. The existing game has all systems working (economy, combat, AI, touch input, menus). Your job is primarily to **elevate the art and mobile UX** to premium mobile-game quality while keeping gameplay intact.

Key files today:
- `src/art.js` — cartoon canvas drawing (needs major quality pass)
- `src/render.js` — render loop
- `src/config.js` — all balance numbers (use as-is unless rebalance needed)
- `src/systems.js`, `src/ai.js`, `src/input.js`, `src/hud.js`, `src/game.js` — working logic

Focus your creativity on `art.js`, `styles/main.css`, and mobile polish in `index.html` / `hud.js` / `input.js`.

---

Start building now. Write the files.
```
