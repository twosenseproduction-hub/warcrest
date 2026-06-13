# WARCREST — Consolidated Source Bundle
Single-file reference for Claude. Paste or attach this ONE file instead of the whole folder.


---
## FILE: index.html
```
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#1565c0" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<title>WARCREST — Ashfen Reach</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="styles/main.css" />
</head>
<body>
<div id="app">

  <!-- ===================== GAME LAYER ===================== -->
  <canvas id="game" class="hidden"></canvas>

  <!-- ===================== HUD ===================== -->
  <div id="hud" class="hidden">
    <header id="topbar">
      <div class="tb-left">
        <span id="faction-name" class="faction">Iron Crown</span>
      </div>
      <div class="tb-res">
        <span class="res"><i class="ic-halcite">⬡</i><span id="res-halcite" class="val">0</span></span>
        <span class="res"><i class="ic-supply">▲</i><span id="res-supply" class="val">0/0</span></span>
      </div>
      <div class="tb-right">
        <span id="timer" class="timer">0:00</span>
        <button id="btn-pause" class="icon-btn" aria-label="Pause">⏸</button>
      </div>
    </header>

    <div id="wave-timer" class="wave">Wave 1 in 70s</div>

    <!-- Mobile quick commands (thumb zone) -->
    <div id="mobile-rail">
      <button class="rail-btn" id="btn-rail-army" aria-label="Select army">⚑</button>
      <button class="rail-btn" id="btn-rail-stop" aria-label="Stop">■</button>
      <button class="rail-btn" id="btn-rail-atk" aria-label="Attack move">⌖</button>
      <button class="rail-btn" id="btn-rail-base" aria-label="Center base">⌂</button>
    </div>

    <div id="minimap-wrap" class="hidden">
      <canvas id="minimap"></canvas>
    </div>

    <div id="event-log"></div>
    <div id="toast"></div>

    <div id="dock">
      <div id="selpanel"></div>
      <div id="action-tray"></div>
    </div>
  </div>

  <!-- ===================== MAIN MENU ===================== -->
  <section id="screen-menu" class="screen">
    <div class="bg-grid"></div>
    <div class="menu-inner">
      <div class="logo">
        <div class="logo-mark">◢◤</div>
        <h1 class="logo-text">EXO<span>FRONT</span></h1>
        <p class="logo-sub">Command the Ashfen Reach</p>
      </div>
      <div class="menu-buttons">
        <button id="btn-play" class="big-btn primary">▶ Skirmish</button>
        <button id="btn-howto" class="big-btn">How to Play</button>
        <button id="btn-settings" class="big-btn">Settings</button>
      </div>
      <p class="menu-foot">A standalone single-player real-time strategy game. No accounts, no servers.</p>
    </div>
  </section>

  <!-- ===================== FACTION SELECT ===================== -->
  <section id="screen-faction" class="screen hidden">
    <div class="bg-grid"></div>
    <div class="faction-inner">
      <h2 class="screen-title">Choose Your Faction</h2>
      <p class="screen-sub">You lead one faction; the other defends the opposing base.</p>
      <div class="faction-cards">
        <button class="faction-card aurex" data-faction="aurex">
          <div class="fc-emblem aurex-em">◈</div>
          <h3>Iron Crown</h3>
          <div class="fc-tag">Precision · Order · Light</div>
          <p>A disciplined high-tech order that wages war with clean geometry and
             rail-fire. Fast to tech and brutal in formation.</p>
          <div class="fc-traits"><span>Fast tech</span><span>Ranged focus</span></div>
          <div class="fc-go">Lead the Directive →</div>
        </button>
        <button class="faction-card cinder" data-faction="cinder">
          <div class="fc-emblem cinder-em">⛬</div>
          <h3>Raider Horde</h3>
          <div class="fc-tag">Burn · Scavenge · Endure</div>
          <p>A scavenger horde of bio-mechanical raiders welded from salvage and spite.
             Slow to start, terrifying once the furnaces are lit.</p>
          <div class="fc-traits"><span>Heavy armor</span><span>Attrition</span></div>
          <div class="fc-go">Lead the Pact →</div>
        </button>
      </div>
      <button id="btn-faction-back" class="text-btn">← Back</button>
    </div>
  </section>

  <!-- ===================== HOW TO PLAY ===================== -->
  <section id="screen-howto" class="screen hidden">
    <div class="bg-grid"></div>
    <div class="panel-inner">
      <h2 class="screen-title">How to Play</h2>
      <div class="howto-grid">
        <div class="howto-card"><b>① Harvest</b><p>Select a Pawn, then tap a glowing
           Ironstone crystal. It mines and returns to your Citadel automatically.</p></div>
        <div class="howto-card"><b>② Train</b><p>Select your Citadel to train Pawns,
           or a Foundry / War Forge to build combat units.</p></div>
        <div class="howto-card"><b>③ Build</b><p>Select a Pawn, tap <i>Build</i>, choose a
           structure, then tap a highlighted spot near your base.</p></div>
        <div class="howto-card"><b>④ Command</b><p>Tap units to select, drag a box for many.
           Tap ground to move, tap an enemy to attack.</p></div>
        <div class="howto-card"><b>⑤ Attack-Move</b><p>Long-press the ground (or arm
           <i>Atk-Move</i>) to advance while engaging anything in the way.</p></div>
        <div class="howto-card"><b>⑥ Win</b><p>Hold off the Cinder waves and destroy the
           enemy core to win. Lose your Citadel and it's over.</p></div>
      </div>
      <p class="howto-tip">Pan with one finger · pinch to zoom · supply caps your army —
         build Conduits to raise it.</p>
      <button id="btn-howto-back" class="big-btn">Back</button>
    </div>
  </section>

  <!-- ===================== SETTINGS ===================== -->
  <section id="screen-settings" class="screen hidden">
    <div class="bg-grid"></div>
    <div class="panel-inner">
      <h2 class="screen-title">Settings</h2>
      <div class="settings-list">
        <label class="set-row"><span>Audio</span>
          <input type="checkbox" id="set-audio" checked /></label>
        <label class="set-row"><span>SFX Volume</span>
          <input type="range" id="set-volume" min="0" max="1" step="0.05" value="0.5" /></label>
        <label class="set-row"><span>Always show health bars</span>
          <input type="checkbox" id="set-health" /></label>
      </div>
      <button id="btn-settings-back" class="big-btn">Back</button>
    </div>
  </section>

  <!-- ===================== PAUSE ===================== -->
  <div id="overlay-pause" class="overlay hidden">
    <div class="overlay-card">
      <h2>Paused</h2>
      <button id="btn-resume" class="big-btn primary">Resume</button>
      <button id="btn-pause-settings" class="big-btn">Settings</button>
      <button id="btn-restart" class="big-btn">Restart Match</button>
      <button id="btn-quit" class="big-btn">Quit to Menu</button>
    </div>
  </div>

  <!-- ===================== END (WIN/LOSS) ===================== -->
  <div id="overlay-end" class="overlay hidden">
    <div class="overlay-card end-card">
      <div id="end-icon" class="end-icon">★</div>
      <h2 id="end-title">VICTORY</h2>
      <p id="end-msg"></p>
      <div id="end-stats" class="end-stats"></div>
      <button id="btn-end-again" class="big-btn primary">Play Again</button>
      <button id="btn-end-menu" class="big-btn">Main Menu</button>
    </div>
  </div>

  <!-- ===================== ONBOARDING ===================== -->
  <div id="overlay-onboard" class="overlay hidden">
    <div class="overlay-card">
      <h2>Welcome, Commander</h2>
      <ul class="onboard-list">
        <li><b>Economy:</b> tap a Pawn → tap a crystal to mine Ironstone.</li>
        <li><b>Army:</b> select your Foundry → train Archers.</li>
        <li><b>Move:</b> select units, tap the ground. Tap an enemy to attack.</li>
        <li><b>Defend:</b> a Cinder wave is coming — build up before it lands.</li>
      </ul>
      <button id="btn-onboard-go" class="big-btn primary">Got it — deploy</button>
    </div>
  </div>

</div>

<!-- ===================== SCRIPTS (load order matters) ===================== -->
<script src="src/config.js"></script>
<script src="src/state.js"></script>
<script src="src/entities.js"></script>
<script src="src/map.js"></script>
<script src="src/commands.js"></script>
<script src="src/audio.js"></script>
<script src="src/art.js"></script>
<script src="src/systems.js"></script>
<script src="src/ai.js"></script>
<script src="src/input.js"></script>
<script src="src/render.js"></script>
<script src="src/hud.js"></script>
<script src="src/game.js"></script>
</body>
</html>
```

---
## FILE: styles/main.css
```
/* ============================================================================
 * WARCREST — main.css
 * Cartoon mobile-strategy UI: bold panels, golden buttons, Fredoka type.
 * ==========================================================================*/
:root {
  --sky: #1e88e5;
  --sky-dark: #1565c0;
  --grass: #43a047;
  --panel: rgba(21, 101, 192, 0.92);
  --panel-edge: rgba(255, 255, 255, 0.35);
  --gold: #ffc107;
  --gold-dark: #ff8f00;
  --teal: #26c6da;
  --teal-2: #80deea;
  --orange: #ff7043;
  --text: #fff;
  --muted: rgba(255, 255, 255, 0.75);
  --danger: #ef5350;
  --good: #66bb6a;
  --outline: #1a1208;
  --radius: 14px;
  --sh: 0 4px 0 rgba(0, 0, 0, 0.35), 0 8px 20px rgba(0, 0, 0, 0.25);
  --btn-h: 56px;
  --rail-size: 52px;
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body {
  margin: 0; padding: 0; height: 100%; overflow: hidden;
  background: var(--sky-dark); color: var(--text);
  font-family: 'Fredoka', system-ui, -apple-system, sans-serif;
  user-select: none; -webkit-user-select: none; overscroll-behavior: none;
  touch-action: manipulation;
}
#app { position: fixed; inset: 0; }
.hidden { display: none !important; }

#game {
  position: absolute; inset: 0; width: 100%; height: 100%;
  touch-action: none; display: block; background: var(--grass);
}

/* ============================================================================
 * Menus — blue sky panels
 * ==========================================================================*/
.screen {
  position: absolute; inset: 0; z-index: 30;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, #42a5f5 0%, #1e88e5 45%, #1565c0 100%);
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  overflow-y: auto;
}
.bg-grid {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.25;
  background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255,255,255,0.25) 0%, transparent 40%);
}

.menu-inner { position: relative; text-align: center; max-width: 420px; width: 100%; }
.logo { margin-bottom: 28px; }
.logo-mark { font-size: 52px; color: var(--gold); text-shadow: 0 3px 0 var(--outline); }
.logo-text {
  margin: 4px 0 0; font-size: 48px; font-weight: 700; letter-spacing: 2px;
  color: #fff; text-shadow: 0 3px 0 var(--outline), 0 0 20px rgba(255,255,255,0.3);
}
.logo-text span { color: var(--gold); }
.logo-sub { color: var(--muted); font-size: 13px; font-weight: 600; }
.menu-buttons { display: flex; flex-direction: column; gap: 12px; }
.menu-foot { margin-top: 22px; color: var(--muted); font-size: 12px; line-height: 1.5; }

/* Golden 3D buttons */
.big-btn {
  width: 100%; min-height: var(--btn-h); padding: 14px 20px;
  font-family: inherit; font-size: 18px; font-weight: 700;
  color: var(--outline); background: linear-gradient(180deg, #ffe082 0%, var(--gold) 55%, var(--gold-dark) 100%);
  border: 3px solid var(--outline); border-radius: var(--radius);
  box-shadow: var(--sh); cursor: pointer;
  transition: transform 0.08s;
}
.big-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,0.35); }
.big-btn.primary {
  background: linear-gradient(180deg, #80deea 0%, var(--teal) 55%, #00838f 100%);
  color: #fff; text-shadow: 0 1px 0 var(--outline);
}
.text-btn {
  background: none; border: none; color: var(--muted); font-family: inherit;
  font-size: 15px; font-weight: 600; margin-top: 14px; cursor: pointer; padding: 12px;
}
.icon-btn {
  background: linear-gradient(180deg, #546e7a, #37474f);
  border: 2px solid var(--outline); color: #fff;
  width: 46px; height: 46px; border-radius: 12px; font-size: 18px; cursor: pointer;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}
.icon-btn:active { transform: translateY(2px); box-shadow: none; }

.screen-title { font-size: 26px; font-weight: 700; margin: 0 0 6px; text-shadow: 0 2px 0 var(--outline); }
.screen-sub { color: var(--muted); margin: 0 0 18px; font-size: 14px; }

/* Faction cards */
.faction-inner { position: relative; text-align: center; max-width: 720px; width: 100%; }
.faction-cards { display: flex; flex-direction: column; gap: 14px; }
@media (min-width: 640px) { .faction-cards { flex-direction: row; } }
.faction-card {
  flex: 1; text-align: left; padding: 18px; border-radius: 16px; cursor: pointer;
  background: rgba(255,255,255,0.12); border: 3px solid rgba(255,255,255,0.35);
  color: #fff; box-shadow: var(--sh); transition: transform 0.1s;
}
.faction-card:active { transform: scale(0.98); }
.faction-card.aurex { border-color: var(--teal); background: rgba(38, 198, 218, 0.2); }
.faction-card.cinder { border-color: var(--orange); background: rgba(255, 112, 67, 0.2); }
.fc-emblem { font-size: 36px; margin-bottom: 6px; }
.aurex-em { color: var(--teal-2); }
.cinder-em { color: var(--orange); }
.faction-card h3 { margin: 0 0 4px; font-size: 20px; }
.fc-tag { font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
.faction-card p { font-size: 13px; line-height: 1.45; margin: 0 0 10px; opacity: 0.9; }
.fc-traits { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.fc-traits span {
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px;
  background: rgba(0,0,0,0.25); border: 2px solid rgba(255,255,255,0.2);
}
.fc-go { font-weight: 700; color: var(--gold); font-size: 14px; }

.panel-inner { position: relative; text-align: center; max-width: 580px; width: 100%; }
.howto-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 16px; text-align: left; }
@media (min-width: 520px) { .howto-grid { grid-template-columns: 1fr 1fr; } }
.howto-card {
  background: rgba(255,255,255,0.12); border: 2px solid rgba(255,255,255,0.25);
  border-radius: 12px; padding: 12px 14px;
}
.howto-card b { color: var(--gold); display: block; margin-bottom: 4px; }
.howto-card p { margin: 0; font-size: 13px; line-height: 1.45; opacity: 0.92; }
.howto-tip { color: var(--muted); font-size: 13px; margin: 0 0 18px; }

.settings-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
.set-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; background: rgba(255,255,255,0.12);
  border: 2px solid rgba(255,255,255,0.25); border-radius: 12px; font-size: 15px;
}
.set-row input[type="checkbox"] { width: 24px; height: 24px; accent-color: var(--gold); }
.set-row input[type="range"] { width: 140px; accent-color: var(--gold); }

/* Overlays */
.overlay {
  position: absolute; inset: 0; z-index: 40;
  display: flex; align-items: center; justify-content: center;
  background: rgba(21, 101, 192, 0.75); backdrop-filter: blur(4px); padding: 16px;
}
.overlay-card {
  background: linear-gradient(180deg, #42a5f5, #1565c0);
  border: 3px solid var(--outline); border-radius: 18px;
  padding: 24px 20px; max-width: 360px; width: 100%;
  text-align: center; box-shadow: var(--sh);
  display: flex; flex-direction: column; gap: 10px;
}
.overlay-card h2 { margin: 0 0 6px; font-size: 24px; text-shadow: 0 2px 0 var(--outline); }
.onboard-list { text-align: left; margin: 4px 0 12px; padding-left: 18px; line-height: 1.65; font-size: 14px; }
.onboard-list b { color: var(--gold); }

.end-card { animation: pop 0.35s ease; }
@keyframes pop { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.end-icon { font-size: 52px; margin-bottom: 4px; }
#overlay-end.won .end-icon { color: var(--gold); }
#overlay-end.lost .end-icon { color: var(--danger); }
#end-msg { color: var(--muted); font-size: 14px; margin: 0 0 6px; }
.end-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 6px 0 12px; }
.end-stat {
  background: rgba(0,0,0,0.2); border: 2px solid rgba(255,255,255,0.2);
  border-radius: 10px; padding: 10px;
}
.end-stat span { font-size: 10px; color: var(--muted); text-transform: uppercase; }
.end-stat b { font-size: 20px; }

/* ============================================================================
 * In-game HUD — compact mobile layout
 * ==========================================================================*/
#hud { position: absolute; inset: 0; z-index: 20; pointer-events: none; }
#hud > * { pointer-events: auto; }

#topbar {
  position: absolute; top: 0; left: 0; right: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  padding: max(6px, env(safe-area-inset-top)) 10px 6px;
  background: linear-gradient(180deg, rgba(21,101,192,0.95), rgba(21,101,192,0));
}
.tb-left { display: none; }
@media (min-width: 520px) { .tb-left { display: block; } .tb-left .faction { font-weight: 700; font-size: 13px; } }
.tb-res { display: flex; gap: 8px; flex: 1; justify-content: center; }
.res {
  display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 17px;
  background: rgba(0,0,0,0.45); padding: 8px 14px; border-radius: 22px;
  border: 2px solid var(--outline); box-shadow: 0 2px 0 rgba(0,0,0,0.3);
  min-height: 40px;
}
.ic-halcite { color: var(--gold); font-style: normal; font-size: 18px; }
.ic-supply { color: var(--teal-2); font-style: normal; }
.val.warn { color: var(--danger); }
.tb-right { display: flex; align-items: center; gap: 6px; }
.timer { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 15px; display: none; }
@media (min-width: 400px) { .timer { display: block; } }

.wave {
  position: absolute; top: calc(max(6px, env(safe-area-inset-top)) + 48px); left: 50%;
  transform: translateX(-50%); font-size: 12px; font-weight: 600;
  background: rgba(0,0,0,0.5); padding: 5px 12px; border-radius: 16px;
  border: 2px solid var(--outline); pointer-events: none;
}
.wave.warn { color: var(--gold); border-color: var(--gold-dark); }

/* Mobile quick-action rail (right thumb zone) */
#mobile-rail {
  position: absolute; right: max(8px, env(safe-area-inset-right));
  bottom: calc(150px + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; gap: 10px; z-index: 25;
}
.rail-btn {
  width: var(--rail-size); height: var(--rail-size);
  border-radius: 50%; border: 3px solid var(--outline);
  background: linear-gradient(180deg, #ffe082, var(--gold) 60%, var(--gold-dark));
  color: var(--outline); font-size: 22px; font-weight: 700;
  box-shadow: 0 4px 0 rgba(0,0,0,0.35);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-family: inherit;
}
.rail-btn:active { transform: translateY(3px); box-shadow: none; }
.rail-btn.active {
  background: linear-gradient(180deg, #ffab91, var(--orange) 60%, #d84315);
  color: #fff;
}
@media (min-width: 768px) {
  #mobile-rail { bottom: 130px; }
  :root { --rail-size: 48px; }
}

/* Minimap — smaller on phone */
#minimap-wrap {
  position: absolute; top: calc(max(6px, env(safe-area-inset-top)) + 48px); right: 8px;
  width: 88px; height: 64px; border-radius: 10px; overflow: hidden;
  border: 2px solid var(--outline); background: rgba(0,0,0,0.5); box-shadow: var(--sh);
  pointer-events: none;
}
#minimap { width: 100%; height: 100%; display: block; }
@media (min-width: 520px) { #minimap-wrap { width: 120px; height: 84px; } }

#event-log {
  position: absolute; left: 8px; top: calc(max(6px, env(safe-area-inset-top)) + 48px);
  display: flex; flex-direction: column; gap: 4px; max-width: 55%; pointer-events: none;
}
.evt {
  font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 8px;
  background: rgba(0,0,0,0.55); border: 2px solid var(--outline);
  color: #fff; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.evt.good { border-color: var(--good); }
.evt.warn { border-color: var(--gold); }
.evt.bad { border-color: var(--danger); }
.evt.fresh { animation: evtIn 0.25s ease; }
@keyframes evtIn { from { transform: translateX(-10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@media (max-width: 480px) {
  #event-log .evt:nth-child(n+3) { display: none; }
}

#toast {
  position: absolute; bottom: calc(140px + env(safe-area-inset-bottom)); left: 50%;
  transform: translateX(-50%) translateY(8px);
  background: rgba(0,0,0,0.85); border: 2px solid var(--gold); color: var(--gold);
  padding: 10px 18px; border-radius: 24px; font-size: 14px; font-weight: 700;
  opacity: 0; transition: opacity 0.2s, transform 0.2s; pointer-events: none;
  max-width: 85%; text-align: center;
}
#toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

/* Dock */
#dock {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 6px 6px max(6px, env(safe-area-inset-bottom));
  padding-right: calc(var(--rail-size) + 20px);
  background: linear-gradient(0deg, rgba(21,101,192,0.97) 0%, rgba(21,101,192,0.85) 60%, transparent);
}
@media (min-width: 768px) { #dock { padding-right: 6px; } }

#selpanel {
  margin-bottom: 6px; padding: 8px 12px;
  background: rgba(0,0,0,0.45); border: 2px solid var(--outline);
  border-radius: 12px; font-size: 13px; min-height: 0;
}
#selpanel.compact { padding: 6px 10px; opacity: 0.85; }
.sel-hint { color: var(--muted); font-size: 12px; font-weight: 600; }
.sel-title { font-weight: 700; font-size: 15px; color: var(--gold); }
.sel-sub { color: var(--muted); font-size: 12px; margin: 2px 0 4px; }
.sel-stats, .sel-line { color: rgba(255,255,255,0.85); font-size: 12px; }
.sel-chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; }
.chip {
  font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px;
  background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);
}
.sel-bar { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 11px; color: var(--muted); }
.sel-bar .bar { flex: 1; height: 8px; background: rgba(0,0,0,0.5); border-radius: 6px; border: 2px solid var(--outline); overflow: hidden; }
.sel-bar .bar i { display: block; height: 100%; border-radius: 4px; }
.sel-bar b { color: #fff; font-variant-numeric: tabular-nums; }

#action-tray {
  display: flex; gap: 8px; overflow-x: auto; padding: 4px 2px;
  -webkit-overflow-scrolling: touch; scrollbar-width: none;
  scroll-snap-type: x proximity;
}
#action-tray::-webkit-scrollbar { display: none; }

.act {
  flex: 0 0 auto; min-width: 76px; height: 72px; padding: 6px 8px;
  scroll-snap-align: start;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  background: linear-gradient(180deg, #546e7a 0%, #37474f 100%);
  border: 3px solid var(--outline); border-radius: 14px;
  color: #fff; cursor: pointer;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}
.act:active { transform: translateY(2px); box-shadow: none; }
.act .ico { font-size: 22px; line-height: 1; }
.act .lbl { font-size: 10px; font-weight: 700; white-space: nowrap; max-width: 68px; overflow: hidden; text-overflow: ellipsis; }
.act .cost { font-size: 10px; font-weight: 700; color: var(--gold); }
.act.disabled { opacity: 0.45; filter: grayscale(0.4); }
.act.active {
  background: linear-gradient(180deg, #ffab91, #ff7043 60%, #d84315);
  border-color: var(--outline);
}
.act.danger { background: linear-gradient(180deg, #ef9a9a, var(--danger)); }
.act-info {
  flex: 1; display: flex; align-items: center; padding: 0 12px;
  color: var(--muted); font-size: 12px; font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

---
## FILE: src/config.js
```
/* ============================================================================
 * WARCREST — config.js
 * Central balance + tuning constants. Tweak values here to rebalance the game.
 * All game systems read from RTS.Config / RTS.Units / RTS.Buildings.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  // ---- Core balance knobs (edit these first) -------------------------------
  var isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  RTS.Config = {
    world: { w: 2600, h: 1800 },
    camera: {
      minZoom: 0.55, maxZoom: 2.0,
      default: isMobile ? 1.08 : 0.92,
      panInertia: 0.86,
    },
    touch: { slopPx: isMobile ? 34 : 18, dragPx: isMobile ? 16 : 12, uiBlockMs: 380 },

    // Economy
    startResources: 250,        // starting Ironstone for the player
    startSupplyCap: 12,         // supply provided by the Core
    supplyPerPylon: 8,          // supply added per Conduit
    maxSupplyCap: 80,
    passiveTrickle: 0.0,        // passive income/sec (0 = pure harvesting)

    harvest: {
      rate: 26,                 // halcite mined per second while on node
      capacity: 12,             // amount a worker carries per trip
      reach: 42,                // distance to begin mining
      depositReach: 56,         // distance to deposit at a base
    },

    // AI difficulty / pacing
    ai: {
      startResources: 320,
      income: 9.5,              // enemy passive halcite/sec (abstracted economy)
      firstWaveAt: 70,          // seconds before first real attack wave
      waveInterval: 52,         // seconds between waves
      waveGrowth: 1.18,         // wave size multiplier each wave
      maxArmy: 26,              // soft cap on simultaneous enemy combat units
      workerCount: 4,
      retaliate: true,
    },

    // Combat feel
    separation: 150,            // unit push-apart strength
    projectileSpeed: 520,
    hitFlash: 0.13,
    muzzleFlash: 0.09,
    corpseFade: 1.2,
    maxEffects: 60,

    // Match
    matchSoftCapMin: 14,        // event log nudge if running long

    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  // ---- Teams ---------------------------------------------------------------
  RTS.TEAM = { PLAYER: 'player', ENEMY: 'enemy', NEUTRAL: 'neutral' };

  // ---- Roles (shared archetypes used by both factions) ---------------------
  // costs in Ironstone, times in seconds, ranges/speeds in world units.
  RTS.Units = {
    worker: {
      role: 'worker', label: 'Pawn', glyph: 'circle',
      hp: 55, speed: 100, dmg: 5, range: 22, rof: 1.0,
      cost: 50, supply: 1, build: 0, canHarvest: true, canBuild: true,
      desc: 'Harvests Ironstone and raises structures.',
    },
    light: {
      role: 'light', label: 'Archer', glyph: 'tri',
      hp: 64, speed: 124, dmg: 9, range: 132, rof: 0.62,
      cost: 75, supply: 1, build: 0, ranged: true,
      desc: 'Cheap mobile ranged trooper. Strong in numbers.',
    },
    scout: {
      role: 'scout', label: 'Lancer', glyph: 'diamond',
      hp: 46, speed: 188, dmg: 7, range: 96, rof: 0.5,
      cost: 60, supply: 1, build: 0, ranged: true,
      desc: 'Fast recon raider. Picks off workers and stragglers.',
    },
    heavy: {
      role: 'heavy', label: 'Warrior', glyph: 'hex',
      hp: 230, speed: 62, dmg: 30, range: 46, rof: 0.85,
      cost: 150, supply: 3, build: 0,
      desc: 'Slow armored bruiser. Soaks damage at the front.',
    },
    siege: {
      role: 'siege', label: 'Catapult', glyph: 'pent',
      hp: 120, speed: 56, dmg: 46, range: 236, rof: 2.0,
      cost: 200, supply: 3, build: 0, ranged: true, splash: 46,
      desc: 'Long-range area damage. Devastating vs clusters and bases.',
    },
    support: {
      role: 'support', label: 'Monk', glyph: 'cross',
      hp: 80, speed: 108, dmg: 0, range: 110, rof: 0.7, heal: 12,
      cost: 120, supply: 2, build: 0, healer: true,
      desc: 'Repairs nearby allied units. Keep it behind the line.',
    },
  };

  // ---- Buildings -----------------------------------------------------------
  RTS.Buildings = {
    core: {
      type: 'core', label: 'Citadel', w: 96, h: 96,
      hp: 1600, cost: 0, build: 0, deposit: true,
      trains: ['worker'], desc: 'Main base. Trains Pawns and banks Ironstone.',
    },
    conduit: {
      type: 'conduit', label: 'Conduit', w: 60, h: 60,
      hp: 420, cost: 80, build: 10, supply: 8,
      trains: [], desc: 'Raises your supply cap.',
    },
    foundry: {
      type: 'foundry', label: 'Foundry', w: 78, h: 70,
      hp: 760, cost: 150, build: 18,
      trains: ['light', 'scout', 'support'],
      desc: 'Produces Archers, Lancers and Monks.',
    },
    forge: {
      type: 'forge', label: 'War Forge', w: 86, h: 78,
      hp: 980, cost: 220, build: 26,
      trains: ['heavy', 'siege'],
      desc: 'Produces Warriors and Catapults.',
    },
    turret: {
      type: 'turret', label: 'Sentinel', w: 54, h: 54,
      hp: 520, cost: 120, build: 14,
      defense: true, dmg: 20, range: 178, rof: 0.7, ranged: true,
      desc: 'Automated defense tower. Fires on nearby foes.',
    },
  };

  // Player buildable menu order
  RTS.BuildMenu = ['conduit', 'foundry', 'forge', 'turret'];

  // ---- Factions (visual identity + naming) ---------------------------------
  RTS.Factions = {
    aurex: {
      id: 'aurex',
      name: 'Iron Crown',
      tagline: 'Precision. Order. Light.',
      blurb: 'A disciplined high-tech order that wages war with clean geometry, ' +
             'rail-fire and immaculate logistics. Fast to tech, brutal in formation.',
      primary: '#26c6da',   // bright cartoon cyan
      secondary: '#80deea',
      dark: '#00838f',
      accent: '#fff176',
      shapeStyle: 'angular',
      names: {
        core: 'Citadel', conduit: 'Conduit', foundry: 'Foundry',
        forge: 'War Forge', turret: 'Sentinel',
        worker: 'Pawn', light: 'Archer', scout: 'Lancer',
        heavy: 'Warrior', siege: 'Catapult', support: 'Monk',
      },
    },
    cinder: {
      id: 'cinder',
      name: 'Raider Horde',
      tagline: 'Burn. Scavenge. Endure.',
      blurb: 'A scavenger horde of bio-mechanical raiders welded from salvage and ' +
             'spite. Slow to start, terrifying once the furnaces are lit.',
      primary: '#ff7043',   // bright cartoon orange
      secondary: '#ffab91',
      dark: '#d84315',
      accent: '#ffee58',
      shapeStyle: 'rough',
      names: {
        core: 'Warren Maw', conduit: 'Bellows', foundry: 'Scrap Pit',
        forge: 'Slag Forge', turret: 'Spire Gun',
        worker: 'Grub', light: 'Spitter', scout: 'Runner',
        heavy: 'Brute', siege: 'Lobber', support: 'Stitcher',
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
```

---
## FILE: src/state.js
```
/* ============================================================================
 * WARCREST — state.js
 * Single central game-state object + small accessors. No scattered globals.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var idCounter = 1;
  RTS.nextId = function () { return 'e' + (idCounter++); };
  RTS.resetIds = function () { idCounter = 1; };

  // The one state object. Everything mutable about a match lives here.
  RTS.createState = function () {
    return {
      // scene flow: boot | menu | factionselect | settings | playing | paused | won | lost
      scene: 'menu',
      // input modes within play: select | place-building | attack-target
      inputMode: 'select',
      pending: { building: null },     // building type queued for placement
      attackMoveArmed: false,
      boxSelectArmed: false,

      playerFaction: 'aurex',
      enemyFaction: 'cinder',

      camera: { x: 0, y: 0, zoom: RTS.Config.camera.default, vx: 0, vy: 0,
                dragging: false, dragStart: null },

      // resources keyed by team
      res: {
        player: { halcite: RTS.Config.startResources, supplyUsed: 0, supplyCap: RTS.Config.startSupplyCap },
        enemy:  { halcite: RTS.Config.ai.startResources, supplyUsed: 0, supplyCap: 999 },
      },

      entities: {
        units: [],
        buildings: [],
        resources: [],
        projectiles: [],
        effects: [],
      },

      selectedIds: [],
      selectionBox: null,            // {x1,y1,x2,y2} world coords while dragging

      timers: {
        gameTime: 0,
        nextWave: RTS.Config.ai.firstWaveAt,
        waveNumber: 0,
        aiThink: 0,
      },

      ui: {
        eventLog: [],
        pointer: null,
        longPressTimer: null,
        longPressAnchor: null,
        lastUiAt: 0,
        baseAlarm: 0,                // >0 = base under attack pulse
        toast: null,
      },

      settings: {
        audio: true,
        sfxVolume: 0.5,
        showHealthAlways: false,
        edgePan: false,
      },

      stats: { unitsBuilt: 0, unitsLost: 0, kills: 0, harvested: 0 },

      screenShake: 0,
      screenFlash: 0,
      flashColor: '#ff5555',
      _running: false,
    };
  };

  // Convenience getters operating on a state -------------------------------
  RTS.getById = function (s, id) {
    var e = s.entities;
    for (var i = 0; i < e.units.length; i++) if (e.units[i].id === id) return e.units[i];
    for (var j = 0; j < e.buildings.length; j++) if (e.buildings[j].id === id) return e.buildings[j];
    return null;
  };

  RTS.playerCore = function (s) {
    return s.entities.buildings.find(function (b) {
      return b.team === RTS.TEAM.PLAYER && b.type === 'core' && !b.dead;
    });
  };
  RTS.enemyCore = function (s) {
    return s.entities.buildings.find(function (b) {
      return b.team === RTS.TEAM.ENEMY && b.type === 'core' && !b.dead;
    });
  };

  RTS.deposits = function (s, team) {
    return s.entities.buildings.filter(function (b) {
      return b.team === team && !b.dead && b.built && RTS.Buildings[b.type].deposit;
    });
  };

  RTS.recalcSupply = function (s, team) {
    var used = 0;
    s.entities.units.forEach(function (u) {
      if (u.team === team && !u.dead) used += (RTS.Units[u.role].supply || 1);
    });
    var cap = (team === RTS.TEAM.PLAYER) ? RTS.Config.startSupplyCap : 999;
    if (team === RTS.TEAM.PLAYER) {
      s.entities.buildings.forEach(function (b) {
        if (b.team === team && !b.dead && b.built && RTS.Buildings[b.type].supply) {
          cap += RTS.Buildings[b.type].supply;
        }
      });
      cap = Math.min(cap, RTS.Config.maxSupplyCap);
    }
    s.res[team].supplyUsed = used;
    s.res[team].supplyCap = cap;
  };

  // Event log (short messages) ----------------------------------------------
  RTS.log = function (s, msg, tone) {
    s.ui.eventLog.unshift({ text: msg, tone: tone || 'info', at: s.timers.gameTime });
    if (s.ui.eventLog.length > 6) s.ui.eventLog.pop();
    if (RTS.HUD && RTS.HUD.renderLog) RTS.HUD.renderLog(s);
  };

  RTS.toast = function (s, msg) {
    s.ui.toast = { text: msg, t: 2.4 };
  };

})(window.RTS = window.RTS || {});
```

---
## FILE: src/entities.js
```
/* ============================================================================
 * WARCREST — entities.js
 * Factories for units, buildings, resource nodes, projectiles, effects.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  RTS.makeUnit = function (s, role, team, x, y, factionId) {
    var spec = RTS.Units[role];
    var u = {
      id: RTS.nextId(), kind: 'unit', role: role, team: team,
      faction: factionId || (team === RTS.TEAM.PLAYER ? s.playerFaction : s.enemyFaction),
      x: x, y: y, vx: 0, vy: 0,
      hp: spec.hp, maxHp: spec.hp,
      speed: spec.speed, dmg: spec.dmg, range: spec.range, rof: spec.rof,
      ranged: !!spec.ranged, splash: spec.splash || 0, heal: spec.heal || 0,
      radius: role === 'heavy' ? 18 : role === 'siege' ? 17 : role === 'worker' ? 14 : 15,
      cooldown: 0, target: null, moveTo: null, attackMove: false,
      harvest: null,            // {nodeId, phase, carry}
      buildTask: null,          // {buildingId}
      hitFlash: 0, muzzleFlash: 0, spawnFlash: 0.3, dead: false, corpse: 0,
      facing: 0,
    };
    s.entities.units.push(u);
    if (team === RTS.TEAM.PLAYER) RTS.recalcSupply(s, team);
    return u;
  };

  RTS.makeBuilding = function (s, type, team, x, y, factionId, prebuilt) {
    var spec = RTS.Buildings[type];
    var b = {
      id: RTS.nextId(), kind: 'building', type: type, team: team,
      faction: factionId || (team === RTS.TEAM.PLAYER ? s.playerFaction : s.enemyFaction),
      x: x, y: y, w: spec.w, h: spec.h,
      hp: prebuilt ? spec.hp : Math.max(1, spec.hp * 0.08), maxHp: spec.hp,
      built: !!prebuilt, progress: prebuilt ? 1 : 0, buildTime: spec.build || 0.001,
      queue: [], train: null, rally: null,
      cooldown: 0, target: null,
      hitFlash: 0, dead: false, spawnFlash: 0.3,
    };
    s.entities.buildings.push(b);
    if (team === RTS.TEAM.PLAYER) RTS.recalcSupply(s, team);
    return b;
  };

  RTS.makeResource = function (s, x, y, amount) {
    var node = {
      id: RTS.nextId(), kind: 'resource', x: x, y: y, r: 38,
      amount: amount, max: amount,
    };
    s.entities.resources.push(node);
    return node;
  };

  RTS.makeProjectile = function (s, from, target, dmg, opts) {
    opts = opts || {};
    s.entities.projectiles.push({
      id: RTS.nextId(), x: from.x, y: from.y,
      targetId: target.id, team: from.team, dmg: dmg,
      speed: opts.speed || RTS.Config.projectileSpeed,
      splash: opts.splash || 0,
      color: opts.color || '#ffffff', life: 2.2,
      lastX: target.x, lastY: target.y,
    });
  };

  RTS.addEffect = function (s, fx) {
    fx.id = RTS.nextId();
    s.entities.effects.push(fx);
    if (s.entities.effects.length > RTS.Config.maxEffects) {
      s.entities.effects.splice(0, s.entities.effects.length - RTS.Config.maxEffects);
    }
  };

  RTS.spawnHit = function (s, x, y, team) {
    if (RTS.Config.reducedMotion) return;
    var c = team === RTS.TEAM.ENEMY ? '#ffd1a8' : '#bdfff2';
    RTS.addEffect(s, { kind: 'spark', x: x, y: y, life: 0.16, max: 0.16, color: c });
    RTS.addEffect(s, { kind: 'ring', x: x, y: y, life: 0.22, max: 0.22, color: c, r: 4 });
  };

  RTS.spawnExplosion = function (s, x, y, size, color) {
    if (RTS.Config.reducedMotion) return;
    RTS.addEffect(s, { kind: 'boom', x: x, y: y, life: 0.42, max: 0.42,
                       color: color || '#ffcf6b', r: size || 18 });
  };

  RTS.spawnFloat = function (s, x, y, text, color) {
    RTS.addEffect(s, { kind: 'float', x: x, y: y, life: 0.9, max: 0.9,
                       color: color || '#ffe08a', text: text });
  };

})(window.RTS = window.RTS || {});
```

---
## FILE: src/map.js
```
/* ============================================================================
 * WARCREST — map.js
 * Builds the single playable map: "The Ashfen Reach".
 * Player base bottom-left, enemy base top-right, Ironstone fields between.
 * Also generates a stable terrain detail layer (decor) for the biome look.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  // deterministic pseudo-random so terrain decor is stable per match
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  RTS.buildMap = function (s) {
    var W = RTS.Config.world.w, H = RTS.Config.world.h;
    var pf = s.playerFaction, ef = s.enemyFaction;

    // ---- Player base (bottom-left) ----
    var pcx = 320, pcy = H - 320;
    var core = RTS.makeBuilding(s, 'core', RTS.TEAM.PLAYER, pcx, pcy, pf, true);
    core.rally = { x: pcx + 130, y: pcy - 40 };
    RTS.makeBuilding(s, 'foundry', RTS.TEAM.PLAYER, pcx + 150, pcy - 110, pf, true);
    for (var i = 0; i < 3; i++) {
      RTS.makeUnit(s, 'worker', RTS.TEAM.PLAYER, pcx + 70 + i * 26, pcy + 64, pf);
    }

    // ---- Enemy base (top-right) ----
    var ecx = W - 320, ecy = 320;
    var ecore = RTS.makeBuilding(s, 'core', RTS.TEAM.ENEMY, ecx, ecy, ef, true);
    ecore.rally = { x: ecx - 130, y: ecy + 40 };
    RTS.makeBuilding(s, 'foundry', RTS.TEAM.ENEMY, ecx - 150, ecy + 110, ef, true);
    RTS.makeBuilding(s, 'forge', RTS.TEAM.ENEMY, ecx - 40, ecy + 150, ef, true);
    for (var k = 0; k < RTS.Config.ai.workerCount; k++) {
      RTS.makeUnit(s, 'worker', RTS.TEAM.ENEMY, ecx - 70 - k * 26, ecy + 64, ef);
    }

    // ---- Ironstone fields ----
    // Two near each base, two contested in the middle.
    RTS.makeResource(s, pcx + 40, pcy - 200, 1500);
    RTS.makeResource(s, pcx + 240, pcy + 30, 1300);
    RTS.makeResource(s, ecx - 40, ecy + 200, 1500);
    RTS.makeResource(s, ecx - 240, ecy - 30, 1300);
    RTS.makeResource(s, W * 0.5, H * 0.5 - 90, 1800);
    RTS.makeResource(s, W * 0.5 - 60, H * 0.5 + 120, 1800);
    RTS.makeResource(s, W * 0.36, H * 0.62, 1100);
    RTS.makeResource(s, W * 0.64, H * 0.38, 1100);

    // ---- Terrain decor (stable, cosmetic) ----
    var rnd = mulberry(1337);
    var decor = [];
    for (var d = 0; d < 70; d++) {
      decor.push({
        x: rnd() * W, y: rnd() * H,
        r: 10 + rnd() * 28,
        shade: 0.04 + rnd() * 0.06,
        rot: rnd() * Math.PI,
        kind: rnd() < 0.65 ? 'rock' : 'crack', // rock = bush in art.js
      });
    }
    s.map = { w: W, h: H, decor: decor };

    RTS.recalcSupply(s, RTS.TEAM.PLAYER);
    RTS.recalcSupply(s, RTS.TEAM.ENEMY);
  };

})(window.RTS = window.RTS || {});
```

---
## FILE: src/commands.js
```
/* ============================================================================
 * WARCREST — commands.js
 * Selection + issuing orders (move / attack / harvest / stop / build / train).
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  function dist(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
  RTS.dist = dist;

  // ---- Selection -----------------------------------------------------------
  RTS.select = function (s, id, additive) {
    if (!additive) s.selectedIds = [];
    if (id && s.selectedIds.indexOf(id) < 0) s.selectedIds.push(id);
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
  };

  RTS.toggleSelect = function (s, id) {
    var i = s.selectedIds.indexOf(id);
    if (i >= 0) s.selectedIds.splice(i, 1); else s.selectedIds.push(id);
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
  };

  RTS.clearSelection = function (s) {
    s.selectedIds = [];
    s.attackMoveArmed = false;
    s.inputMode = 'select';
    RTS.HUD.sync(s);
  };

  RTS.selectBox = function (s, x1, y1, x2, y2, additive) {
    var minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    var minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    if (maxX - minX < 10 && maxY - minY < 10) return false;
    if (!additive) s.selectedIds = [];
    var got = 0;
    s.entities.units.forEach(function (u) {
      if (u.dead || u.team !== RTS.TEAM.PLAYER) return;
      if (u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY) {
        if (s.selectedIds.indexOf(u.id) < 0) { s.selectedIds.push(u.id); got++; }
      }
    });
    if (got) RTS.log(s, got + ' selected', 'info');
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
    return got > 0;
  };

  RTS.selectAllArmy = function (s) {
    s.selectedIds = s.entities.units
      .filter(function (u) { return u.team === RTS.TEAM.PLAYER && !u.dead && u.role !== 'worker'; })
      .map(function (u) { return u.id; });
    if (!s.selectedIds.length) {
      var w = s.entities.units.find(function (u) { return u.team === RTS.TEAM.PLAYER && !u.dead; });
      if (w) s.selectedIds = [w.id];
    }
    RTS.refreshMode(s);
    RTS.HUD.sync(s);
  };

  RTS.selectedUnits = function (s) {
    return s.selectedIds.map(function (id) { return RTS.getById(s, id); })
      .filter(function (e) { return e && e.kind === 'unit' && e.team === RTS.TEAM.PLAYER && !e.dead; });
  };
  RTS.selectedBuildings = function (s) {
    return s.selectedIds.map(function (id) { return RTS.getById(s, id); })
      .filter(function (e) { return e && e.kind === 'building' && e.team === RTS.TEAM.PLAYER && !e.dead; });
  };

  RTS.refreshMode = function (s) {
    var combat = RTS.selectedUnits(s).filter(function (u) { return u.role !== 'worker'; });
    if (s.attackMoveArmed && combat.length) s.inputMode = 'attack-target';
    else if (RTS.selectedUnits(s).length) s.inputMode = 'select';
    else s.inputMode = 'select';
  };

  // ---- Orders --------------------------------------------------------------
  RTS.orderMove = function (s, units, x, y, attackMove) {
    var n = units.length, idx = 0;
    units.forEach(function (u) {
      var off = spread(idx++, n);
      u.moveTo = { x: x + off.x, y: y + off.y };
      u.target = null; u.attackMove = !!attackMove;
      u.harvest = null; u.buildTask = null;
    });
    if (attackMove) RTS.Audio.play('attack');
    else RTS.Audio.play('move');
  };

  RTS.orderAttack = function (s, units, targetId) {
    units.forEach(function (u) {
      u.target = targetId; u.moveTo = null; u.attackMove = false;
      u.harvest = null; u.buildTask = null;
    });
    RTS.Audio.play('attack');
  };

  RTS.orderStop = function (s, units) {
    units.forEach(function (u) {
      u.moveTo = null; u.target = null; u.attackMove = false;
      u.harvest = null; u.buildTask = null; u.vx = 0; u.vy = 0;
    });
  };

  RTS.orderHarvest = function (s, worker, nodeId) {
    if (worker.role !== 'worker') return;
    worker.harvest = { nodeId: nodeId, phase: 'toNode', carry: 0 };
    worker.moveTo = null; worker.target = null; worker.buildTask = null;
  };

  function spread(i, n) {
    if (n <= 1) return { x: 0, y: 0 };
    var perRow = Math.ceil(Math.sqrt(n));
    var gap = 30;
    var col = i % perRow, row = Math.floor(i / perRow);
    return { x: (col - perRow / 2) * gap, y: (row - perRow / 2) * gap };
  }

  // ---- Economy helpers -----------------------------------------------------
  RTS.canAfford = function (s, team, cost) { return s.res[team].halcite >= cost; };
  RTS.hasSupply = function (s, team, n) {
    if (team !== RTS.TEAM.PLAYER) return true;
    return s.res[team].supplyUsed + n <= s.res[team].supplyCap;
  };

  // ---- Training ------------------------------------------------------------
  RTS.train = function (s, building, role) {
    var team = building.team;
    var spec = RTS.Units[role];
    if (!building.built) { if (team === RTS.TEAM.PLAYER) RTS.toast(s, 'Building not finished'); return false; }
    if (!RTS.canAfford(s, team, spec.cost)) {
      if (team === RTS.TEAM.PLAYER) { RTS.toast(s, 'Not enough Ironstone'); RTS.log(s, 'Not enough Ironstone', 'warn'); RTS.Audio.play('deny'); }
      return false;
    }
    if (!RTS.hasSupply(s, team, spec.supply)) {
      if (team === RTS.TEAM.PLAYER) { RTS.toast(s, 'Supply cap reached — build a Conduit'); RTS.log(s, 'Supply blocked', 'warn'); RTS.Audio.play('deny'); }
      return false;
    }
    s.res[team].halcite -= spec.cost;
    var trainTime = baseTrain(role);
    building.queue.push({ role: role, remaining: trainTime, total: trainTime });
    if (!building.train) building.train = building.queue[0];
    if (team === RTS.TEAM.PLAYER) {
      RTS.Audio.play('click');
      RTS.HUD.sync(s);
    }
    return true;
  };

  function baseTrain(role) {
    switch (role) {
      case 'worker': return 7;
      case 'light': return 9;
      case 'scout': return 8;
      case 'support': return 12;
      case 'heavy': return 16;
      case 'siege': return 20;
      default: return 10;
    }
  }
  RTS.baseTrain = baseTrain;

  // ---- Building placement --------------------------------------------------
  RTS.beginPlacement = function (s, type) {
    if (!RTS.canAfford(s, RTS.TEAM.PLAYER, RTS.Buildings[type].cost)) {
      RTS.toast(s, 'Not enough Ironstone'); RTS.Audio.play('deny'); return;
    }
    s.pending.building = type;
    s.inputMode = 'place-building';
    RTS.toast(s, 'Tap a highlighted spot to build ' + RTS.nameFor(s.playerFaction, type));
    RTS.HUD.sync(s);
  };

  RTS.cancelPlacement = function (s) {
    s.pending.building = null;
    s.inputMode = 'select';
    RTS.HUD.sync(s);
  };

  RTS.canPlaceAt = function (s, type, x, y) {
    var spec = RTS.Buildings[type];
    var hw = spec.w / 2, hh = spec.h / 2;
    var W = RTS.Config.world.w, H = RTS.Config.world.h;
    if (x - hw < 20 || x + hw > W - 20 || y - hh < 20 || y + hh > H - 20) return false;

    // not overlapping other buildings (with margin)
    var ok = true;
    s.entities.buildings.forEach(function (b) {
      if (b.dead) return;
      var ox = Math.abs(b.x - x), oy = Math.abs(b.y - y);
      if (ox < (b.w / 2 + hw + 14) && oy < (b.h / 2 + hh + 14)) ok = false;
    });
    if (!ok) return false;

    // not on a resource node
    for (var i = 0; i < s.entities.resources.length; i++) {
      var n = s.entities.resources[i];
      if (RTS.dist(x, y, n.x, n.y) < n.r + Math.max(hw, hh) + 10) return false;
    }

    // must be reasonably near a friendly building (base proximity)
    var near = s.entities.buildings.some(function (b) {
      return b.team === RTS.TEAM.PLAYER && !b.dead && RTS.dist(x, y, b.x, b.y) < 360;
    });
    if (!near) return false;

    return true;
  };

  RTS.placeBuilding = function (s, type, x, y) {
    if (!RTS.canPlaceAt(s, type, x, y)) { RTS.toast(s, 'Invalid location'); RTS.Audio.play('deny'); return false; }
    if (!RTS.canAfford(s, RTS.TEAM.PLAYER, RTS.Buildings[type].cost)) { RTS.toast(s, 'Not enough Ironstone'); RTS.Audio.play('deny'); return false; }
    s.res.player.halcite -= RTS.Buildings[type].cost;
    var b = RTS.makeBuilding(s, type, RTS.TEAM.PLAYER, x, y, s.playerFaction, false);
    // send nearest idle worker to "build" it (cosmetic walk)
    var workers = s.entities.units.filter(function (u) {
      return u.team === RTS.TEAM.PLAYER && u.role === 'worker' && !u.dead;
    });
    if (workers.length) {
      workers.sort(function (a, c) { return RTS.dist(a.x, a.y, x, y) - RTS.dist(c.x, c.y, x, y); });
      var w = workers[0];
      w.harvest = null; w.target = null;
      w.buildTask = { buildingId: b.id };
      w.moveTo = { x: x, y: y };
    }
    RTS.log(s, RTS.nameFor(s.playerFaction, type) + ' under construction', 'good');
    RTS.Audio.play('build');
    s.pending.building = null;
    s.inputMode = 'select';
    RTS.HUD.sync(s);
    return true;
  };

})(window.RTS = window.RTS || {});
```

---
## FILE: src/art.js
```
/* ============================================================================
 * WARCREST — art.js
 * Original cartoon arena art: bold outlines, chibi units, glossy cel-shading.
 * Inspired by mobile strategy polish — NOT copied assets or characters.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var OUTLINE = '#1a1208';
  var OUTLINE_W = 3.2;

  RTS.Art = {
    drawTerrain: drawTerrain,
    drawResource: drawResource,
    drawBuilding: drawBuilding,
    drawUnit: drawUnit,
    drawProjectile: drawProjectile,
    drawSelectionRing: drawSelectionRing,
    drawHealthBar: drawHealthBar,
    drawShadow: drawShadow,
  };

  // ---- Terrain (bright arena grass) ----------------------------------------
  function drawTerrain(s, ctx) {
    var W = RTS.Config.world.w, H = RTS.Config.world.h;

    // sky-to-grass wash (subtle — camera is top-down)
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#5cb85c');
    bg.addColorStop(0.45, '#4caf50');
    bg.addColorStop(1, '#3d9a40');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // diamond tile pattern (arena board feel)
    var tile = 64;
    ctx.save();
    ctx.globalAlpha = 0.14;
    for (var ty = 0; ty < H + tile; ty += tile) {
      for (var tx = 0; tx < W + tile; tx += tile) {
        var alt = ((tx / tile | 0) + (ty / tile | 0)) % 2;
        ctx.fillStyle = alt ? '#2e7d32' : '#388e3c';
        ctx.beginPath();
        ctx.moveTo(tx, ty + tile / 2);
        ctx.lineTo(tx + tile / 2, ty);
        ctx.lineTo(tx + tile, ty + tile / 2);
        ctx.lineTo(tx + tile / 2, ty + tile);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // sandy lanes near bases
    drawSandPatch(ctx, 320, H - 320, 280);
    drawSandPatch(ctx, W - 320, 320, 280);

    // decor: bushes & pebbles
    if (s.map && s.map.decor) {
      s.map.decor.forEach(function (d) {
        ctx.save();
        ctx.translate(d.x, d.y);
        if (d.kind === 'rock') drawBush(ctx, d.r);
        else drawPebbles(ctx, d.r, d.rot);
        ctx.restore();
      });
    }

    // arena border fence posts
    ctx.strokeStyle = hexA(OUTLINE, 0.35);
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, W - 16, H - 16);
  }

  function drawSandPatch(ctx, cx, cy, r) {
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(210,180,120,0.55)');
    g.addColorStop(1, 'rgba(210,180,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  function drawBush(ctx, r) {
    var shades = ['#2e7d32', '#43a047', '#66bb6a'];
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = shades[i];
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((i - 1) * r * 0.45, -r * 0.1, r * 0.55, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  }

  function drawPebbles(ctx, r, rot) {
    ctx.rotate(rot);
    ctx.fillStyle = hexA('#8d6e63', 0.5);
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---- Ironstone pile (cartoon gold heap) ------------------------------------
  function drawResource(ctx, n) {
    var pct = n.amount / n.max;
    var sc = 0.55 + 0.45 * pct;
    var x = n.x, y = n.y;

    drawShadow(ctx, x, y, n.r * sc * 0.9, 0.35);

    // glow ring
    ctx.fillStyle = hexA('#ffd54f', 0.25);
    ctx.beginPath(); ctx.arc(x, y, n.r + 8, 0, Math.PI * 2); ctx.fill();

    // stacked coins / crystals
    for (var i = 0; i < 5; i++) {
      var ox = Math.cos(i * 1.3) * n.r * 0.35 * sc;
      var oy = Math.sin(i * 1.3) * n.r * 0.2 * sc - i * 3;
      drawCoin(ctx, x + ox, y + oy, n.r * 0.38 * sc);
    }
    // big center gem
    drawGem(ctx, x, y - n.r * 0.15 * sc, n.r * 0.5 * sc);

    // label pill
    var label = Math.ceil(n.amount);
    ctx.font = 'bold 12px Fredoka, system-ui';
    ctx.textAlign = 'center';
    var tw = ctx.measureText(label).width + 16;
    roundRect(ctx, x - tw / 2, y + n.r * sc + 6, tw, 18, 9);
    ctx.fillStyle = OUTLINE; ctx.fill();
    roundRect(ctx, x - tw / 2 + 1, y + n.r * sc + 7, tw - 2, 16, 8);
    ctx.fillStyle = '#ffc107'; ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.fillText(label, x, y + n.r * sc + 19);
  }

  function drawCoin(ctx, x, y, r) {
    var g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, '#ffe082'); g.addColorStop(1, '#ffb300');
    ctx.fillStyle = g; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = hexA('#fff8e1', 0.6);
    ctx.beginPath(); ctx.ellipse(x - r * 0.2, y - r * 0.15, r * 0.35, r * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGem(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.85, y);
    ctx.lineTo(x, y + r * 0.9);
    ctx.lineTo(x - r * 0.85, y);
    ctx.closePath();
    var g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, '#fff59d'); g.addColorStop(0.5, '#ffca28'); g.addColorStop(1, '#ff8f00');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W; ctx.stroke();
    ctx.fillStyle = hexA('#fff', 0.45);
    ctx.beginPath(); ctx.moveTo(x - r * 0.15, y - r * 0.5); ctx.lineTo(x + r * 0.1, y - r * 0.15); ctx.lineTo(x - r * 0.05, y); ctx.closePath(); ctx.fill();
  }

  // ---- Buildings (chunky cartoon structures) -------------------------------
  function drawBuilding(ctx, b, f, s) {
    if (b.dead) return;
    var x = b.x, y = b.y;
    var built = b.built;
    var alpha = built ? 1 : 0.65 + b.progress * 0.35;

    drawShadow(ctx, x, y + b.h * 0.15, Math.max(b.w, b.h) * 0.55, 0.4);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    switch (b.type) {
      case 'core': drawCastle(ctx, b, f); break;
      case 'conduit': drawTower(ctx, b, f, '#9c27b0'); break;
      case 'foundry': drawBarracks(ctx, b, f); break;
      case 'forge': drawForge(ctx, b, f); break;
      case 'turret': drawCannonTower(ctx, b, f); break;
      default: drawBarracks(ctx, b, f);
    }

    ctx.restore();

    // construction scaffold
    if (!built) {
      ctx.strokeStyle = hexA(OUTLINE, 0.6); ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.strokeRect(x - b.w / 2 - 4, y - b.h / 2 - 4, b.w + 8, b.h + 8);
      ctx.setLineDash([]);
      drawHealthBar(ctx, x, y - b.h / 2 - 14, b.w, b.progress, '#42a5f5', true);
    }

    if (b.hitFlash > 0) {
      ctx.fillStyle = hexA('#fff', (b.hitFlash / RTS.Config.hitFlash) * 0.55);
      ctx.fillRect(x - b.w / 2, y - b.h / 2, b.w, b.h);
    }

    if (built && (b.hp < b.maxHp || s.settings.showHealthAlways)) {
      drawHealthBar(ctx, x, y - b.h / 2 - 14, b.w, b.hp / b.maxHp, f.primary, true);
    }

    // name tag
    ctx.font = 'bold 11px Fredoka, system-ui';
    ctx.textAlign = 'center';
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.strokeText(RTS.nameFor(b.faction, b.type), x, y + b.h / 2 + 18);
    ctx.fillStyle = '#fff'; ctx.fillText(RTS.nameFor(b.faction, b.type), x, y + b.h / 2 + 18);

    if (b.train) {
      var pct = 1 - b.train.remaining / b.train.total;
      drawHealthBar(ctx, x, y + b.h / 2 + 24, b.w * 0.8, pct, f.secondary, false);
    }
  }

  function drawCastle(ctx, b, f) {
    var w = b.w, h = b.h;
    // base wall
    fillStrokeRect(ctx, -w / 2, -h / 2 + 10, w, h - 10, shade(f.primary, 0.1), OUTLINE, 8);
    // battlements
    var bw = w / 5;
    for (var i = 0; i < 5; i++) {
      fillStrokeRect(ctx, -w / 2 + i * bw + 2, -h / 2 - 6, bw - 4, 18, f.primary, OUTLINE, 4);
    }
    // door
    fillStrokeRect(ctx, -12, h / 2 - 28, 24, 28, shade(f.dark, -0.2), OUTLINE, 6);
    // flag
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -h / 2 - 6); ctx.lineTo(0, -h / 2 - 38); ctx.stroke();
    ctx.fillStyle = f.secondary;
    ctx.beginPath(); ctx.moveTo(0, -h / 2 - 36); ctx.lineTo(22, -h / 2 - 28); ctx.lineTo(0, -h / 2 - 20); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // glossy highlight
    ctx.fillStyle = hexA('#fff', 0.2);
    roundRect(ctx, -w / 2 + 6, -h / 2 + 16, w * 0.35, h * 0.25, 6); ctx.fill();
  }

  function drawTower(ctx, b, f, accent) {
    var w = b.w, h = b.h;
    fillStrokeRect(ctx, -w / 2 + 8, -h / 2 + 6, w - 16, h - 6, shade(f.primary, 0.05), OUTLINE, 6);
    fillStrokeRect(ctx, -w / 2, -h / 2 - 4, w, 14, accent || f.secondary, OUTLINE, 4);
    ctx.fillStyle = hexA('#fff', 0.35);
    ctx.beginPath(); ctx.arc(0, -4, w * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawBarracks(ctx, b, f) {
    var w = b.w, h = b.h;
    // hut body
    fillStrokeRect(ctx, -w / 2, -h / 2 + 8, w, h - 8, f.primary, OUTLINE, 8);
    // roof
    ctx.fillStyle = shade(f.dark, 0.1); ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 4, -h / 2 + 8);
    ctx.lineTo(0, -h / 2 - 14);
    ctx.lineTo(w / 2 + 4, -h / 2 + 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // door
    fillStrokeRect(ctx, -10, h / 2 - 22, 20, 22, '#5d4037', OUTLINE, 4);
  }

  function drawForge(ctx, b, f) {
    var w = b.w, h = b.h;
    fillStrokeRect(ctx, -w / 2, -h / 2 + 6, w, h - 6, shade(f.primary, -0.15), OUTLINE, 6);
    // chimney
    fillStrokeRect(ctx, w / 2 - 22, -h / 2 - 18, 16, 28, '#78909c', OUTLINE, 3);
    // smoke puff
    ctx.fillStyle = hexA('#eceff1', 0.7);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w / 2 - 14, -h / 2 - 24, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // anvil hint
    ctx.fillStyle = '#455a64'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.fillRect(-8, 4, 16, 8); ctx.strokeRect(-8, 4, 16, 8);
  }

  function drawCannonTower(ctx, b, f) {
    var w = b.w;
    fillStrokeRect(ctx, -w / 2, -w / 2 + 4, w, w - 4, '#78909c', OUTLINE, w * 0.2);
    ctx.fillStyle = '#37474f'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.beginPath(); ctx.arc(0, -2, w * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // cannon barrel
    ctx.save(); ctx.rotate(-0.6);
    fillStrokeRect(ctx, 4, -5, w * 0.55, 10, '#263238', OUTLINE, 4);
    ctx.restore();
  }

  // ---- Units (chibi characters) --------------------------------------------
  function drawUnit(ctx, u, f, s) {
    if (u.dead) {
      var a = Math.max(0, u.corpse / RTS.Config.corpseFade);
      ctx.globalAlpha = a * 0.5;
      drawShadow(ctx, u.x, u.y, u.radius, 0.2);
      ctx.fillStyle = '#455a64';
      ctx.beginPath(); ctx.ellipse(u.x, u.y, u.radius, u.radius * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    var r = u.radius * (1 + u.spawnFlash * 0.35);
    var x = u.x, y = u.y;
    var face = u.facing;

    drawShadow(ctx, x, y, r * 1.1, 0.38);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(face);

    var pal = palette(f, u.team);
    switch (u.role) {
      case 'worker': drawChibiWorker(ctx, r, pal, f); break;
      case 'light': drawChibiKnight(ctx, r, pal, u.ranged); break;
      case 'scout': drawChibiRunner(ctx, r, pal); break;
      case 'heavy': drawChibiTank(ctx, r, pal); break;
      case 'siege': drawChibiSiege(ctx, r, pal); break;
      case 'support': drawChibiHealer(ctx, r, pal); break;
      default: drawChibiKnight(ctx, r, pal, true);
    }

    ctx.restore();

    // carry bag for worker
    if (u.role === 'worker' && u.harvest && u.harvest.carry > 0) {
      ctx.font = 'bold 11px Fredoka, system-ui';
      ctx.textAlign = 'center';
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      ctx.strokeText('+' + Math.floor(u.harvest.carry), x, y - r - 10);
      ctx.fillStyle = '#ffc107';
      ctx.fillText('+' + Math.floor(u.harvest.carry), x, y - r - 10);
    }

    if (u.muzzleFlash > 0 && u.ranged) {
      var mx = x + Math.cos(face) * (r + 6), my = y + Math.sin(face) * (r + 6);
      ctx.fillStyle = hexA('#fff176', u.muzzleFlash / RTS.Config.muzzleFlash);
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    if (u.hitFlash > 0) {
      ctx.fillStyle = hexA('#fff', (u.hitFlash / RTS.Config.hitFlash) * 0.65);
      ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 1.1, 0, Math.PI * 2); ctx.fill();
    }

    if (u.hp < u.maxHp || s.settings.showHealthAlways) {
      drawHealthBar(ctx, x, y - r - 12, Math.max(28, r * 2.6), u.hp / u.maxHp, pal.main, false);
    }
  }

  function palette(f, team) {
    return {
      main: f.primary,
      light: f.secondary,
      dark: f.dark,
      skin: team === 'player' ? '#ffcc80' : '#bcaaa4',
      trim: f.accent,
    };
  }

  function drawChibiWorker(ctx, r, pal) {
    // body
    drawBody(ctx, r, pal.main, pal.dark);
    // head
    drawHead(ctx, -r * 0.55, r * 0.62, r * 0.52, pal.skin);
    // hard hat
    ctx.fillStyle = '#ffc107'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.58, Math.PI, 0); ctx.fill(); ctx.stroke();
    // pickaxe
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 1.1, -r * 0.3); ctx.stroke();
    ctx.fillStyle = '#90a4ae';
    ctx.beginPath(); ctx.moveTo(r * 1.0, -r * 0.45); ctx.lineTo(r * 1.25, -r * 0.15); ctx.lineTo(r * 1.05, -r * 0.05); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  function drawChibiKnight(ctx, r, pal, ranged) {
    drawBody(ctx, r * 0.95, pal.main, pal.dark);
    drawHead(ctx, -r * 0.5, r * 0.55, r * 0.48, pal.skin);
    // helmet visor
    ctx.fillStyle = pal.dark; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.beginPath(); ctx.arc(0, -r * 0.48, r * 0.5, Math.PI, 0); ctx.fill(); ctx.stroke();
    if (ranged) {
      // bow
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(r * 0.7, 0, r * 0.45, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.4); ctx.lineTo(r * 0.7, r * 0.4); ctx.stroke();
    } else {
      // sword
      ctx.fillStyle = '#eceff1'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      ctx.fillRect(r * 0.55, -r * 0.55, r * 0.12, r * 1.1); ctx.strokeRect(r * 0.55, -r * 0.55, r * 0.12, r * 1.1);
      ctx.fillStyle = pal.trim;
      ctx.fillRect(r * 0.48, -r * 0.08, r * 0.26, r * 0.16); ctx.strokeRect(r * 0.48, -r * 0.08, r * 0.26, r * 0.16);
    }
    // shield
    ctx.fillStyle = pal.light; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.beginPath(); ctx.ellipse(-r * 0.55, r * 0.05, r * 0.35, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  function drawChibiRunner(ctx, r, pal) {
    drawBody(ctx, r * 0.85, pal.light, pal.dark);
    drawHead(ctx, -r * 0.45, r * 0.5, r * 0.42, pal.skin);
    // hood
    ctx.fillStyle = pal.main; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.quadraticCurveTo(0, -r * 0.95, r * 0.5, -r * 0.2);
    ctx.lineTo(r * 0.35, -r * 0.35); ctx.quadraticCurveTo(0, -r * 0.75, -r * 0.35, -r * 0.35); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // dual blades
    ctx.fillStyle = '#cfd8dc'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.save(); ctx.translate(r * 0.4, r * 0.1); ctx.rotate(0.5);
    ctx.fillRect(0, -r * 0.5, r * 0.1, r * 0.9); ctx.strokeRect(0, -r * 0.5, r * 0.1, r * 0.9);
    ctx.restore();
    ctx.save(); ctx.translate(r * 0.4, -r * 0.1); ctx.rotate(-0.5);
    ctx.fillRect(0, -r * 0.5, r * 0.1, r * 0.9); ctx.strokeRect(0, -r * 0.5, r * 0.1, r * 0.9);
    ctx.restore();
  }

  function drawChibiTank(ctx, r, pal) {
    // wide body
    fillStrokeRect(ctx, -r * 0.95, -r * 0.15, r * 1.9, r * 1.1, pal.main, OUTLINE, r * 0.35);
    drawHead(ctx, -r * 0.55, r * 0.62, r * 0.55, pal.skin);
    // helmet
    ctx.fillStyle = pal.dark; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.beginPath(); ctx.arc(0, -r * 0.5, r * 0.58, Math.PI, 0); ctx.fill(); ctx.stroke();
    // big hammer
    ctx.fillStyle = '#78909c'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.fillRect(r * 0.4, -r * 0.15, r * 0.14, r * 1.0); ctx.strokeRect(r * 0.4, -r * 0.15, r * 0.14, r * 1.0);
    ctx.fillRect(r * 0.25, -r * 0.55, r * 0.45, r * 0.35); ctx.strokeRect(r * 0.25, -r * 0.55, r * 0.45, r * 0.35);
  }

  function drawChibiSiege(ctx, r, pal) {
    // cart
    fillStrokeRect(ctx, -r * 0.9, -r * 0.1, r * 1.6, r * 0.9, '#8d6e63', OUTLINE, 6);
    // wheels
    ctx.fillStyle = '#5d4037'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.55, r * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.35, r * 0.55, r * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // cannon
    ctx.fillStyle = '#37474f'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.save(); ctx.translate(r * 0.1, 0); ctx.rotate(-0.25);
    ctx.fillRect(0, -r * 0.18, r * 1.3, r * 0.36); ctx.strokeRect(0, -r * 0.18, r * 1.3, r * 0.36);
    ctx.restore();
    drawHead(ctx, -r * 0.35, r * 0.45, r * 0.38, pal.skin);
  }

  function drawChibiHealer(ctx, r, pal) {
    drawBody(ctx, r * 0.9, '#eceff1', pal.dark);
    drawHead(ctx, -r * 0.48, r * 0.52, r * 0.46, pal.skin);
    // hood + cross
    ctx.fillStyle = pal.main; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.beginPath(); ctx.arc(0, -r * 0.45, r * 0.52, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#66bb6a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.75); ctx.lineTo(0, -r * 0.35); ctx.moveTo(-r * 0.2, -r * 0.55); ctx.lineTo(r * 0.2, -r * 0.55); ctx.stroke();
    // glow orb
    ctx.fillStyle = hexA('#69f0ae', 0.6);
    ctx.beginPath(); ctx.arc(-r * 0.55, 0, r * 0.25, 0, Math.PI * 2); ctx.fill();
  }

  function drawBody(ctx, r, col, dark) {
    var g = ctx.createLinearGradient(0, 0, 0, r);
    g.addColorStop(0, shade(col, 0.15)); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 0.65, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = hexA('#fff', 0.18);
    ctx.beginPath(); ctx.ellipse(-r * 0.15, r * 0.05, r * 0.22, r * 0.28, -0.3, 0, Math.PI * 2); ctx.fill();
  }

  function drawHead(ctx, hx, hy, hr, skin) {
    ctx.fillStyle = skin; ctx.strokeStyle = OUTLINE; ctx.lineWidth = OUTLINE_W;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // eyes
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.arc(hx - hr * 0.28, hy + hr * 0.05, hr * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + hr * 0.28, hy + hr * 0.05, hr * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx - hr * 0.24, hy + hr * 0.02, hr * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + hr * 0.32, hy + hr * 0.02, hr * 0.05, 0, Math.PI * 2); ctx.fill();
  }

  // ---- Projectiles (chunky orbs) -------------------------------------------
  function drawProjectile(ctx, p) {
    var dx = p.x - p.lastX, dy = p.y - p.lastY, d = Math.hypot(dx, dy) || 1;
    // trail
    ctx.strokeStyle = hexA(p.color, 0.4); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x - dx / d * 14, p.y - dy / d * 14); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = p.color; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.splash ? 5 : 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hexA('#fff', 0.5);
    ctx.beginPath(); ctx.arc(p.x - 1.5, p.y - 1.5, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  // ---- Selection ring ------------------------------------------------------
  function drawSelectionRing(ctx, e, t, pulse) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.shadowColor = hexA('#fff', 0.6); ctx.shadowBlur = 8;
    if (e.kind === 'unit') {
      ctx.beginPath(); ctx.arc(e.x, e.y, (e.radius + 8) * pulse, 0, Math.PI * 2); ctx.stroke();
    } else {
      roundRect(ctx, e.x - e.w / 2 - 6, e.y - e.h / 2 - 6, e.w + 12, e.h + 12, 8);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // ground ring
    ctx.strokeStyle = hexA('#fff', 0.45); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + (e.radius || e.h * 0.3), (e.radius || e.w * 0.4) + 6, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ---- Health bar (CR-style chunky bar) ------------------------------------
  function drawHealthBar(ctx, cx, y, w, pct, color, large) {
    pct = Math.max(0, Math.min(1, pct));
    var h = large ? 10 : 7;
    var x = cx - w / 2;
    var fill = pct <= 0.25 ? '#ef5350' : pct <= 0.55 ? '#ffca28' : (color || '#66bb6a');

    // outline
    roundRect(ctx, x - 2, y - 2, w + 4, h + 4, h / 2 + 2);
    ctx.fillStyle = OUTLINE; ctx.fill();

    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = '#37474f'; ctx.fill();

    if (pct > 0) {
      roundRect(ctx, x + 1, y + 1, (w - 2) * pct, h - 2, h / 2 - 1);
      ctx.fillStyle = fill; ctx.fill();
      // shine
      ctx.fillStyle = hexA('#fff', 0.25);
      roundRect(ctx, x + 2, y + 2, Math.max(0, (w - 4) * pct - 2), (h - 4) * 0.45, 2);
      ctx.fill();
    }
  }

  function drawShadow(ctx, x, y, r, alpha) {
    ctx.fillStyle = hexA(OUTLINE, alpha || 0.3);
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.35, r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---- Shared utils --------------------------------------------------------
  function fillStrokeRect(ctx, x, y, w, h, fill, stroke, rad) {
    roundRect(ctx, x, y, w, h, rad || 4);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = OUTLINE_W; ctx.stroke();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function shade(hex, amt) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

})(window.RTS = window.RTS || {});
```

---
## FILE: src/render.js
```
/* ============================================================================
 * WARCREST — render.js
 * Canvas renderer — delegates cartoon art to art.js
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;
  var Art = function () { return RTS.Art; };

  RTS.Render = {
    dpr: 1,
    resize: function (s) {
      var cv = RTS.canvas;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      cv.width = Math.floor(cv.clientWidth * dpr);
      cv.height = Math.floor(cv.clientHeight * dpr);
      RTS.Cam.clamp(s);
    },

    frame: function (s) {
      var cv = RTS.canvas, ctx = RTS.ctx, dpr = this.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var W = cv.clientWidth, H = cv.clientHeight;

      ctx.fillStyle = '#4caf50';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      var shake = (s.screenShake > 0 && !RTS.Config.reducedMotion)
        ? { x: (Math.random() - 0.5) * s.screenShake, y: (Math.random() - 0.5) * s.screenShake } : { x: 0, y: 0 };
      var c = s.camera;
      ctx.translate(-c.x * c.zoom + shake.x, -c.y * c.zoom + shake.y);
      ctx.scale(c.zoom, c.zoom);

      Art().drawTerrain(s, ctx);
      s.entities.resources.forEach(function (n) { if (n.amount > 0) Art().drawResource(ctx, n); });
      s.entities.buildings.forEach(function (b) { Art().drawBuilding(ctx, b, RTS.Factions[b.faction], s); });
      s.entities.units.forEach(function (u) { Art().drawUnit(ctx, u, RTS.Factions[u.faction], s); });
      drawProjectiles(s, ctx);
      drawEffects(s, ctx);
      drawSelection(s, ctx);
      drawGhost(s, ctx);
      drawSelectionBox(s, ctx);

      ctx.restore();

      if (s.screenFlash > 0) {
        ctx.fillStyle = RTS.hexA(s.flashColor, s.screenFlash * 0.28);
        ctx.fillRect(0, 0, W, H);
      }
      if (s.ui.baseAlarm > 0) {
        var a = (Math.sin(s.timers.gameTime * 9) * 0.5 + 0.5) * s.ui.baseAlarm * 0.22;
        ctx.strokeStyle = RTS.hexA('#ff5252', Math.min(0.95, a + 0.25));
        ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
      }
    },
  };

  function drawProjectiles(s, ctx) {
    s.entities.projectiles.forEach(function (p) { Art().drawProjectile(ctx, p); });
  }

  function drawEffects(s, ctx) {
    s.entities.effects.forEach(function (fx) {
      var a = Math.max(0, fx.life / fx.max);
      if (fx.kind === 'spark') {
        ctx.fillStyle = RTS.hexA(fx.color, a);
        ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1.5;
        for (var i = 0; i < 4; i++) {
          var ang = i * 1.57;
          ctx.beginPath(); ctx.moveTo(fx.x, fx.y);
          ctx.lineTo(fx.x + Math.cos(ang) * 6, fx.y + Math.sin(ang) * 6); ctx.stroke();
        }
      } else if (fx.kind === 'ring' || fx.kind === 'cmd') {
        ctx.strokeStyle = RTS.hexA(fx.color, a * 0.85); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = RTS.hexA(fx.color, a * 0.15);
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * 0.6, 0, Math.PI * 2); ctx.fill();
      } else if (fx.kind === 'boom') {
        ctx.fillStyle = RTS.hexA(fx.color, a * 0.55);
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = RTS.hexA('#fff', a * 0.7); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2); ctx.stroke();
      } else if (fx.kind === 'heal') {
        ctx.font = 'bold 14px Fredoka, system-ui'; ctx.textAlign = 'center';
        ctx.fillStyle = RTS.hexA('#69f0ae', a);
        ctx.fillText('+', fx.x, fx.y + 5);
      } else if (fx.kind === 'float') {
        ctx.font = 'bold 15px Fredoka, system-ui'; ctx.textAlign = 'center';
        ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 3;
        ctx.strokeText(fx.text, fx.x, fx.y);
        ctx.fillStyle = RTS.hexA(fx.color, a);
        ctx.fillText(fx.text, fx.x, fx.y);
      }
    });
  }

  function drawSelection(s, ctx) {
    if (!s.selectedIds.length) return;
    var t = s.timers.gameTime;
    var pulse = RTS.Config.reducedMotion ? 1 : 1 + Math.sin(t * 5) * 0.05;
    s.selectedIds.forEach(function (id) {
      var e = RTS.getById(s, id);
      if (!e || e.dead) return;
      Art().drawSelectionRing(ctx, e, t, pulse);
      if (e.kind === 'building' && e.rally) {
        ctx.setLineDash([4, 5]); ctx.strokeStyle = RTS.hexA('#fff', 0.5); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.rally.x, e.rally.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffc107'; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.rally.x, e.rally.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    });
  }

  function drawGhost(s, ctx) {
    if (s.inputMode !== 'place-building' || !s.ui.ghost) return;
    var g = s.ui.ghost, spec = RTS.Buildings[g.type];
    var col = g.valid ? '#66bb6a' : '#ef5350';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = RTS.hexA(col, 0.35);
    ctx.fillRect(g.x - spec.w / 2, g.y - spec.h / 2, spec.w, spec.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([8, 5]);
    ctx.strokeRect(g.x - spec.w / 2, g.y - spec.h / 2, spec.w, spec.h);
    ctx.setLineDash([]);
  }

  function drawSelectionBox(s, ctx) {
    if (!s.selectionBox) return;
    var b = s.selectionBox;
    var x = Math.min(b.x1, b.x2), y = Math.min(b.y1, b.y2);
    var w = Math.abs(b.x2 - b.x1), h = Math.abs(b.y2 - b.y1);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 5]);
    ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  }

  RTS.renderMinimap = function (s) {
    var cv = RTS.minimap; if (!cv) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== cv.clientWidth * dpr) { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = cv.clientWidth, H = cv.clientHeight;
    var sx = W / RTS.Config.world.w, sy = H / RTS.Config.world.h;
    ctx.fillStyle = '#388e3c'; ctx.fillRect(0, 0, W, H);
    s.entities.resources.forEach(function (n) {
      ctx.fillStyle = '#ffc107';
      ctx.beginPath(); ctx.arc(n.x * sx, n.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
    });
    s.entities.buildings.forEach(function (b) {
      ctx.fillStyle = b.team === TEAM.PLAYER ? '#26c6da' : '#ff7043';
      ctx.fillRect(b.x * sx - 3, b.y * sy - 3, 6, 6);
    });
    s.entities.units.forEach(function (u) {
      if (u.dead) return;
      ctx.fillStyle = u.team === TEAM.PLAYER ? '#80deea' : '#ffab91';
      ctx.fillRect(u.x * sx - 1.5, u.y * sy - 1.5, 3, 3);
    });
    var view = RTS.Cam.viewSizeWorld(s);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(s.camera.x * sx, s.camera.y * sy, view.w * sx, view.h * sy);
  };

  RTS.hexA = function (hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

})(window.RTS = window.RTS || {});
```

---
## FILE: src/systems.js
```
/* ============================================================================
 * WARCREST — systems.js
 * The simulation: movement, targeting, combat, harvesting, construction,
 * production, projectiles, effects, separation, and win/loss detection.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TEAM = RTS.TEAM;
  function dist(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }

  RTS.update = function (s, dt) {
    s.timers.gameTime += dt;
    s.screenShake = Math.max(0, s.screenShake - dt * 12);
    s.screenFlash = Math.max(0, s.screenFlash - dt * 1.6);
    s.ui.baseAlarm = Math.max(0, s.ui.baseAlarm - dt);
    if (s.ui.toast) { s.ui.toast.t -= dt; if (s.ui.toast.t <= 0) s.ui.toast = null; }

    var i;
    for (i = 0; i < s.entities.units.length; i++) updateUnit(s, s.entities.units[i], dt);
    for (i = 0; i < s.entities.buildings.length; i++) updateBuilding(s, s.entities.buildings[i], dt);
    updateProjectiles(s, dt);
    updateEffects(s, dt);
    RTS.AI.update(s, dt);

    // cull dead units after corpse fade
    s.entities.units = s.entities.units.filter(function (u) {
      if (!u.dead) return true;
      u.corpse -= dt;
      return u.corpse > 0;
    });
    s.entities.buildings = s.entities.buildings.filter(function (b) { return !b.dead; });
    s.entities.resources = s.entities.resources.filter(function (n) { return n.amount > 0.5; });

    RTS.recalcSupply(s, TEAM.PLAYER);
    checkEndGame(s);
  };

  // ---- Units ---------------------------------------------------------------
  function updateUnit(s, u, dt) {
    if (u.dead) return;
    u.cooldown = Math.max(0, u.cooldown - dt);
    u.hitFlash = Math.max(0, u.hitFlash - dt);
    u.muzzleFlash = Math.max(0, u.muzzleFlash - dt);
    u.spawnFlash = Math.max(0, u.spawnFlash - dt);

    // Worker behaviours take priority
    if (u.role === 'worker') {
      if (u.buildTask) { doBuildTask(s, u, dt); return; }
      if (u.harvest) { doHarvest(s, u, dt); return; }
    }

    // Healer support
    if (u.heal > 0) { doHeal(s, u, dt); }

    // Resolve current explicit target
    var target = u.target ? RTS.getById(s, u.target) : null;
    if (target && (target.dead)) { u.target = null; target = null; }

    // Auto-acquire if attack-moving or idle-aggressive
    if (!target && u.role !== 'worker' && u.heal === 0) {
      if (u.attackMove || u.team === TEAM.ENEMY || !u.moveTo) {
        var foe = nearestEnemy(s, u.x, u.y, u.team, u.range * (u.attackMove ? 1.6 : 1.25));
        if (foe) { target = foe; if (!u.attackMove && !u.moveTo) u.target = foe.id; }
      }
    }

    if (target) {
      var tr = target.radius || Math.max(target.w, target.h) / 2;
      var d = dist(u.x, u.y, target.x, target.y);
      if (d <= u.range + tr * 0.4) {
        u.vx = 0; u.vy = 0;
        u.facing = Math.atan2(target.y - u.y, target.x - u.x);
        if (u.cooldown <= 0 && u.dmg > 0) {
          u.cooldown = u.rof;
          fire(s, u, target);
        }
      } else {
        moveToward(u, target.x, target.y, dt, u.range * 0.8 + tr);
      }
    } else if (u.moveTo) {
      var dd = dist(u.x, u.y, u.moveTo.x, u.moveTo.y);
      if (dd < 10) { u.moveTo = null; u.vx = 0; u.vy = 0; }
      else moveToward(u, u.moveTo.x, u.moveTo.y, dt, 6);
    } else {
      u.vx *= 0.8; u.vy *= 0.8;
    }

    separation(s, u, dt);
    u.x += u.vx * dt; u.y += u.vy * dt;
    clampToWorld(u);
  }

  function fire(s, u, target) {
    u.muzzleFlash = RTS.Config.muzzleFlash;
    if (u.ranged) {
      RTS.makeProjectile(s, u, target, u.dmg, {
        splash: u.splash,
        color: RTS.Factions[u.faction].accent,
      });
      RTS.Audio.play(u.role === 'siege' ? 'boom' : 'shot');
    } else {
      applyDamage(s, target, u.dmg, u);
      RTS.Audio.play('melee');
    }
  }

  function doHeal(s, u, dt) {
    // find most-hurt nearby ally
    var best = null, bestScore = 0;
    s.entities.units.forEach(function (a) {
      if (a.dead || a.team !== u.team || a === u) return;
      if (a.hp >= a.maxHp) return;
      var d = dist(u.x, u.y, a.x, a.y);
      if (d > u.range) return;
      var score = (1 - a.hp / a.maxHp);
      if (score > bestScore) { bestScore = score; best = a; }
    });
    if (best && u.cooldown <= 0) {
      u.cooldown = u.rof;
      best.hp = Math.min(best.maxHp, best.hp + u.heal);
      RTS.addEffect(s, { kind: 'heal', x: best.x, y: best.y, life: 0.3, max: 0.3, color: '#9bffd0' });
    }
  }

  // ---- Harvesting ----------------------------------------------------------
  function doHarvest(s, u, dt) {
    var H = RTS.Config.harvest;
    var node = u.harvest.nodeId ? s.entities.resources.find(function (n) { return n.id === u.harvest.nodeId; }) : null;

    if (u.harvest.phase === 'toNode') {
      if (!node || node.amount <= 0) {
        // find another node
        node = nearestNode(s, u.x, u.y);
        if (!node) { u.harvest = null; return; }
        u.harvest.nodeId = node.id;
      }
      if (dist(u.x, u.y, node.x, node.y) <= node.r + H.reach * 0.4) { u.harvest.phase = 'mining'; u.vx = 0; u.vy = 0; }
      else moveToward(u, node.x, node.y, dt, node.r);
      u.x += u.vx * dt; u.y += u.vy * dt; clampToWorld(u);
      return;
    }

    if (u.harvest.phase === 'mining') {
      if (!node || node.amount <= 0) { u.harvest.phase = 'toBase'; return; }
      var mined = Math.min(H.rate * dt, node.amount, H.capacity - u.harvest.carry);
      node.amount -= mined; u.harvest.carry += mined;
      if (u.harvest.carry >= H.capacity - 0.01) u.harvest.phase = 'toBase';
      return;
    }

    if (u.harvest.phase === 'toBase') {
      var dep = nearestDeposit(s, u);
      if (!dep) { u.harvest.phase = 'mining'; return; }
      if (dist(u.x, u.y, dep.x, dep.y) <= Math.max(dep.w, dep.h) / 2 + H.depositReach * 0.5) {
        var amt = Math.floor(u.harvest.carry);
        if (amt > 0) {
          s.res[u.team].halcite += amt;
          if (u.team === TEAM.PLAYER) { s.stats.harvested += amt; RTS.spawnFloat(s, u.x, u.y - 18, '+' + amt); }
        }
        u.harvest.carry = 0;
        u.harvest.phase = node && node.amount > 0 ? 'toNode' : 'findNode';
        if (u.harvest.phase === 'findNode') {
          var nn = nearestNode(s, u.x, u.y);
          if (nn) { u.harvest.nodeId = nn.id; u.harvest.phase = 'toNode'; }
          else u.harvest = null;
        }
      } else {
        moveToward(u, dep.x, dep.y, dt, Math.max(dep.w, dep.h) / 2);
      }
      u.x += u.vx * dt; u.y += u.vy * dt; clampToWorld(u);
      return;
    }
  }

  function doBuildTask(s, u, dt) {
    var b = RTS.getById(s, u.buildTask.buildingId);
    if (!b || b.dead) { u.buildTask = null; u.moveTo = null; return; }
    if (b.built) { u.buildTask = null; u.moveTo = null; return; }
    var reach = Math.max(b.w, b.h) / 2 + 28;
    if (dist(u.x, u.y, b.x, b.y) > reach) {
      moveToward(u, b.x, b.y, dt, reach - 6);
      u.x += u.vx * dt; u.y += u.vy * dt; clampToWorld(u);
    } else { u.vx = 0; u.vy = 0; }
    // construction advances whether or not worker arrived (worker speeds nothing extra here)
  }

  // ---- Buildings -----------------------------------------------------------
  function updateBuilding(s, b, dt) {
    if (b.dead) return;
    b.hitFlash = Math.max(0, b.hitFlash - dt);
    b.spawnFlash = Math.max(0, b.spawnFlash - dt);
    b.cooldown = Math.max(0, b.cooldown - dt);

    if (!b.built) {
      b.progress = Math.min(1, b.progress + dt / b.buildTime);
      b.hp = Math.max(b.hp, b.maxHp * (0.08 + 0.92 * b.progress));
      if (b.progress >= 1) {
        b.built = true; b.hp = b.maxHp; b.spawnFlash = 0.5;
        if (b.team === TEAM.PLAYER) {
          RTS.recalcSupply(s, TEAM.PLAYER);
          RTS.log(s, RTS.nameFor(b.faction, b.type) + ' online', 'good');
          RTS.Audio.play('ready');
        }
      }
      return;
    }

    // Defensive structures fire
    var spec = RTS.Buildings[b.type];
    if (spec.defense) {
      var foe = nearestEnemy(s, b.x, b.y, b.team, spec.range);
      if (foe && b.cooldown <= 0) {
        b.cooldown = spec.rof;
        RTS.makeProjectile(s, b, foe, spec.dmg, { color: RTS.Factions[b.faction].accent });
        RTS.Audio.play('shot');
      }
    }

    // Production queue
    if (b.queue.length) {
      var job = b.queue[0];
      b.train = job;
      job.remaining -= dt;
      if (job.remaining <= 0) {
        b.queue.shift();
        spawnTrained(s, b, job.role);
        b.train = b.queue[0] || null;
        if (b.team === TEAM.PLAYER) RTS.HUD.sync(s);
      }
    } else { b.train = null; }
  }

  function spawnTrained(s, b, role) {
    var ang = b.team === TEAM.PLAYER ? -0.4 : Math.PI - 0.4;
    var ox = Math.cos(ang) * (b.w / 2 + 26);
    var oy = Math.sin(ang) * (b.h / 2 + 26);
    var u = RTS.makeUnit(s, role, b.team, b.x + ox, b.y + oy, b.faction);
    u.spawnFlash = 0.4;
    if (b.rally) { u.moveTo = { x: b.rally.x, y: b.rally.y }; }
    if (b.team === TEAM.PLAYER) {
      s.stats.unitsBuilt++;
      RTS.log(s, RTS.nameFor(b.faction, role) + ' ready', 'good');
      RTS.Audio.play('ready');
      RTS.recalcSupply(s, TEAM.PLAYER);
    }
    RTS.spawnExplosion(s, u.x, u.y, 10, RTS.Factions[b.faction].secondary);
  }

  // ---- Combat helpers ------------------------------------------------------
  function applyDamage(s, target, amount, attacker) {
    target.hp -= amount;
    target.hitFlash = RTS.Config.hitFlash;
    var ty = target.y - (target.radius || (target.h ? target.h * 0.3 : 10));
    RTS.spawnHit(s, target.x, ty, target.team);

    // base-under-attack alarm
    if (target.team === TEAM.PLAYER && target.kind === 'building') {
      s.ui.baseAlarm = 1.2;
    }

    if (target.hp <= 0 && !target.dead) {
      killEntity(s, target, attacker);
    }
  }
  RTS.applyDamage = applyDamage;

  function killEntity(s, e, attacker) {
    e.dead = true; e.hp = 0;
    if (e.kind === 'unit') {
      e.corpse = RTS.Config.corpseFade;
      RTS.spawnExplosion(s, e.x, e.y, e.radius + 6, RTS.Factions[e.faction].primary);
      if (attacker && attacker.team === TEAM.PLAYER) s.stats.kills++;
      if (e.team === TEAM.PLAYER) s.stats.unitsLost++;
      s.selectedIds = s.selectedIds.filter(function (id) { return id !== e.id; });
    } else {
      RTS.spawnExplosion(s, e.x, e.y, Math.max(e.w, e.h) * 0.5, '#ffce6b');
      s.screenShake = Math.max(s.screenShake, 5);
      if (e.team === TEAM.PLAYER) {
        s.ui.baseAlarm = 1.4; s.screenFlash = 0.4; s.flashColor = '#ff5555';
        RTS.log(s, RTS.nameFor(e.faction, e.type) + ' destroyed!', 'bad');
      } else {
        RTS.log(s, 'Enemy ' + RTS.nameFor(e.faction, e.type) + ' destroyed', 'good');
      }
      s.selectedIds = s.selectedIds.filter(function (id) { return id !== e.id; });
      RTS.Audio.play('boom');
    }
  }

  function updateProjectiles(s, dt) {
    var live = [];
    for (var i = 0; i < s.entities.projectiles.length; i++) {
      var p = s.entities.projectiles[i];
      p.life -= dt;
      var t = RTS.getById(s, p.targetId);
      var tx = t && !t.dead ? t.x : p.lastX;
      var ty = t && !t.dead ? t.y : p.lastY;
      p.lastX = tx; p.lastY = ty;
      var dx = tx - p.x, dy = ty - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var step = p.speed * dt;
      if (d <= step || p.life <= 0) {
        // impact
        if (p.splash > 0) {
          splashDamage(s, tx, ty, p.splash, p.dmg, p.team);
          RTS.spawnExplosion(s, tx, ty, p.splash, '#ffb24d');
          s.screenShake = Math.max(s.screenShake, 3);
        } else if (t && !t.dead) {
          applyDamage(s, t, p.dmg, { team: p.team });
        }
        continue;
      }
      p.x += dx / d * step; p.y += dy / d * step;
      live.push(p);
    }
    s.entities.projectiles = live;
  }

  function splashDamage(s, x, y, radius, dmg, team) {
    function hit(arr) {
      arr.forEach(function (e) {
        if (e.dead || e.team === team || e.team === TEAM.NEUTRAL) return;
        var er = e.radius || Math.max(e.w, e.h) / 2;
        var d = dist(x, y, e.x, e.y);
        if (d <= radius + er) {
          var f = 1 - Math.min(1, d / (radius + er));
          applyDamage(s, e, dmg * (0.4 + 0.6 * f), { team: team });
        }
      });
    }
    hit(s.entities.units); hit(s.entities.buildings);
  }

  function updateEffects(s, dt) {
    s.entities.effects = s.entities.effects.filter(function (fx) {
      fx.life -= dt;
      if (fx.kind === 'ring' || fx.kind === 'boom') fx.r += 60 * dt;
      if (fx.kind === 'float') fx.y -= 22 * dt;
      return fx.life > 0;
    });
  }

  // ---- Shared spatial helpers ----------------------------------------------
  function moveToward(u, tx, ty, dt, stop) {
    var dx = tx - u.x, dy = ty - u.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d <= stop) { u.vx = 0; u.vy = 0; return; }
    u.vx = dx / d * u.speed; u.vy = dy / d * u.speed;
    u.facing = Math.atan2(dy, dx);
  }

  function separation(s, u, dt) {
    var push = RTS.Config.separation;
    var units = s.entities.units;
    for (var i = 0; i < units.length; i++) {
      var o = units[i];
      if (o === u || o.dead) continue;
      var dx = u.x - o.x, dy = u.y - o.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var minD = u.radius + o.radius + 2;
      if (d < minD && d > 0.01) {
        var f = (minD - d) / minD * push * dt;
        u.x += (dx / d) * f; u.y += (dy / d) * f;
      }
    }
  }

  function clampToWorld(u) {
    u.x = Math.max(u.radius, Math.min(RTS.Config.world.w - u.radius, u.x));
    u.y = Math.max(u.radius, Math.min(RTS.Config.world.h - u.radius, u.y));
  }

  function nearestEnemy(s, x, y, team, maxR) {
    var best = null, bd = maxR;
    var foeTeam = team === TEAM.PLAYER ? TEAM.ENEMY : TEAM.PLAYER;
    var u = s.entities.units;
    for (var i = 0; i < u.length; i++) {
      if (u[i].dead || u[i].team !== foeTeam) continue;
      var d = dist(x, y, u[i].x, u[i].y);
      if (d < bd) { bd = d; best = u[i]; }
    }
    var b = s.entities.buildings;
    for (var j = 0; j < b.length; j++) {
      if (b[j].dead || b[j].team !== foeTeam) continue;
      var db = dist(x, y, b[j].x, b[j].y);
      if (db < bd) { bd = db; best = b[j]; }
    }
    return best;
  }
  RTS.nearestEnemy = nearestEnemy;

  function nearestNode(s, x, y) {
    var best = null, bd = Infinity;
    s.entities.resources.forEach(function (n) {
      if (n.amount <= 0) return;
      var d = dist(x, y, n.x, n.y);
      if (d < bd) { bd = d; best = n; }
    });
    return best;
  }
  RTS.nearestNode = nearestNode;

  function nearestDeposit(s, u) {
    var deps = RTS.deposits(s, u.team);
    var best = null, bd = Infinity;
    deps.forEach(function (b) {
      var d = dist(u.x, u.y, b.x, b.y);
      if (d < bd) { bd = d; best = b; }
    });
    return best;
  }

  // ---- Win / loss ----------------------------------------------------------
  function checkEndGame(s) {
    if (s.scene !== 'playing') return;
    if (!RTS.enemyCore(s)) { RTS.endMatch(s, 'won'); }
    else if (!RTS.playerCore(s)) { RTS.endMatch(s, 'lost'); }
  }

})(window.RTS = window.RTS || {});
```

---
## FILE: src/ai.js
```
/* ============================================================================
 * WARCREST — ai.js
 * Enemy faction brain. Harvests, produces a growing army, and launches waves
 * at the player. Not a genius — but it builds a real, escalating match.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;

  RTS.AI = {
    update: function (s, dt) {
      if (!s.ai) s.ai = { think: 0, harvestTick: 0, composition: 0 };
      var cfg = RTS.Config.ai;

      // Abstracted passive economy (keeps the AI funded without micromanaging)
      s.res.enemy.halcite += cfg.income * dt;

      // Keep enemy workers harvesting
      s.ai.harvestTick -= dt;
      if (s.ai.harvestTick <= 0) {
        s.ai.harvestTick = 1.5;
        assignWorkers(s);
      }

      // Production thinking
      s.ai.think -= dt;
      if (s.ai.think <= 0) {
        s.ai.think = 1.4;
        produce(s);
      }

      // Attack waves
      if (s.timers.gameTime >= s.timers.nextWave) {
        launchWave(s);
        s.timers.waveNumber++;
        s.timers.nextWave = s.timers.gameTime + cfg.waveInterval;
      }
    },
  };

  function enemyUnits(s, role) {
    return s.entities.units.filter(function (u) {
      return u.team === TEAM.ENEMY && !u.dead && (!role || u.role === role);
    });
  }
  function enemyBuilding(s, type) {
    return s.entities.buildings.find(function (b) {
      return b.team === TEAM.ENEMY && !b.dead && b.built && b.type === type;
    });
  }

  function assignWorkers(s) {
    enemyUnits(s, 'worker').forEach(function (w) {
      if (!w.harvest && !w.buildTask) {
        var node = RTS.nearestNode(s, w.x, w.y);
        if (node) w.harvest = { nodeId: node.id, phase: 'toNode', carry: 0 };
      }
    });
  }

  function produce(s) {
    var cfg = RTS.Config.ai;
    var core = RTS.enemyCore(s);
    if (!core) return;

    // maintain worker count
    if (enemyUnits(s, 'worker').length < cfg.workerCount && core.queue.length === 0) {
      RTS.train(s, core, 'worker');
    }

    var army = enemyUnits(s).filter(function (u) { return u.role !== 'worker'; }).length;
    var queued = 0;
    s.entities.buildings.forEach(function (b) {
      if (b.team === TEAM.ENEMY) queued += b.queue.length;
    });

    // target army grows over time
    var target = Math.min(cfg.maxArmy, 4 + Math.floor(s.timers.gameTime / 22));
    if (army + queued >= target) return;

    // Choose a unit by a rotating composition for variety
    var foundry = enemyBuilding(s, 'foundry');
    var forge = enemyBuilding(s, 'forge');
    var pick = s.ai.composition++ % 6;
    var role, bldg;
    if (pick === 0 || pick === 3) { role = 'light'; bldg = foundry; }
    else if (pick === 1) { role = 'scout'; bldg = foundry; }
    else if (pick === 4) { role = 'support'; bldg = foundry; }
    else if (pick === 2) { role = 'heavy'; bldg = forge; }
    else { role = 'siege'; bldg = forge; }

    if (!bldg) bldg = foundry || forge;
    if (bldg && bldg.queue.length < 2) RTS.train(s, bldg, role);
  }

  function launchWave(s) {
    var pcore = RTS.playerCore(s);
    if (!pcore) return;
    var army = enemyUnits(s).filter(function (u) { return u.role !== 'worker'; });

    // Only commit if there's a meaningful force; otherwise harass with what we have.
    var commit = army.filter(function (u) { return !u.attackMove; });
    if (!commit.length) return;

    // stage near player base then attack-move (auto-acquires on the way)
    var jitter = 60;
    commit.forEach(function (u) {
      u.attackMove = true;
      u.target = null;
      u.moveTo = {
        x: pcore.x + (Math.random() - 0.5) * jitter,
        y: pcore.y + (Math.random() - 0.5) * jitter,
      };
    });

    if (s.timers.waveNumber === 0) {
      RTS.log(s, 'Enemy scouts probing your front', 'warn');
    } else {
      RTS.log(s, 'Horde assault wave inbound!', 'bad');
      RTS.toast(s, 'Wave incoming — defend the Citadel');
    }
  }

})(window.RTS = window.RTS || {});
```

---
## FILE: src/input.js
```
/* ============================================================================
 * WARCREST — input.js
 * Camera math + unified touch/mouse input: tap select, command, box select,
 * long-press attack-move, one-finger pan, two-finger pinch-zoom + pan,
 * and building placement.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;

  // ---- Camera helpers ------------------------------------------------------
  RTS.Cam = {
    worldToScreen: function (s, wx, wy) {
      var c = s.camera;
      return { x: (wx - c.x) * c.zoom, y: (wy - c.y) * c.zoom };
    },
    screenToWorld: function (s, sx, sy) {
      var c = s.camera;
      return { x: c.x + sx / c.zoom, y: c.y + sy / c.zoom };
    },
    viewSizeWorld: function (s) {
      var cv = RTS.canvas;
      return { w: cv.clientWidth / s.camera.zoom, h: cv.clientHeight / s.camera.zoom };
    },
    clamp: function (s) {
      var c = s.camera, cv = RTS.canvas;
      var vw = cv.clientWidth / c.zoom, vh = cv.clientHeight / c.zoom;
      var W = RTS.Config.world.w, H = RTS.Config.world.h;
      if (vw >= W) c.x = (W - vw) / 2; else c.x = Math.max(0, Math.min(W - vw, c.x));
      if (vh >= H) c.y = (H - vh) / 2; else c.y = Math.max(0, Math.min(H - vh, c.y));
    },
    centerOn: function (s, wx, wy) {
      var cv = RTS.canvas;
      s.camera.x = wx - (cv.clientWidth / s.camera.zoom) / 2;
      s.camera.y = wy - (cv.clientHeight / s.camera.zoom) / 2;
      RTS.Cam.clamp(s);
    },
    zoomAt: function (s, factor, cssX, cssY) {
      var c = s.camera;
      var before = RTS.Cam.screenToWorld(s, cssX, cssY);
      c.zoom = Math.max(RTS.Config.camera.minZoom, Math.min(RTS.Config.camera.maxZoom, c.zoom * factor));
      var after = RTS.Cam.screenToWorld(s, cssX, cssY);
      c.x += before.x - after.x;
      c.y += before.y - after.y;
      RTS.Cam.clamp(s);
    },
  };

  // ---- Hit testing ---------------------------------------------------------
  function hitTest(s, wx, wy) {
    var slop = (RTS.Config.touch ? RTS.Config.touch.slopPx : 28) / s.camera.zoom;
    var cands = [];
    s.entities.units.forEach(function (u) {
      if (u.dead) return;
      var d = RTS.dist(wx, wy, u.x, u.y);
      if (d <= u.radius + slop) {
        cands.push({ e: u, sort: (u.team === TEAM.PLAYER ? 0 : 100) + d });
      }
    });
    s.entities.buildings.forEach(function (b) {
      if (b.dead) return;
      var pad = 10 + slop * 0.4;
      if (wx >= b.x - b.w / 2 - pad && wx <= b.x + b.w / 2 + pad &&
          wy >= b.y - b.h / 2 - pad && wy <= b.y + b.h / 2 + pad) {
        cands.push({ e: b, sort: (b.team === TEAM.PLAYER ? 20 : 120) + RTS.dist(wx, wy, b.x, b.y) });
      }
    });
    s.entities.resources.forEach(function (n) {
      if (n.amount <= 0) return;
      if (RTS.dist(wx, wy, n.x, n.y) <= n.r + slop * 0.8) {
        cands.push({ e: n, sort: 200 + RTS.dist(wx, wy, n.x, n.y) });
      }
    });
    cands.sort(function (a, b) { return a.sort - b.sort; });
    return cands.length ? cands[0].e : null;
  }

  // ---- Tap resolution ------------------------------------------------------
  function tapWorld(s, wx, wy, additive) {
    if (s.inputMode === 'place-building' && s.pending.building) {
      RTS.placeBuilding(s, s.pending.building, wx, wy);
      return;
    }

    var hit = hitTest(s, wx, wy);
    var sel = RTS.selectedUnits(s);
    var combat = sel.filter(function (u) { return u.role !== 'worker'; });
    var workers = sel.filter(function (u) { return u.role === 'worker'; });

    // Worker + resource → harvest
    if (hit && hit.kind === 'resource' && workers.length) {
      workers.forEach(function (w) { RTS.orderHarvest(s, w, hit.id); });
      RTS.Audio.play('move');
      RTS.toast(s, 'Harvesting Ironstone');
      return;
    }

    // Friendly unit/building → select (or add to group)
    if (hit && (hit.kind === 'unit' || hit.kind === 'building') && hit.team === TEAM.PLAYER) {
      if ((additive || (hit.kind === 'unit' && sel.length)) && hit.kind === 'unit') {
        RTS.toggleSelect(s, hit.id);
      } else {
        RTS.select(s, hit.id, false);
      }
      RTS.Audio.play('click');
      return;
    }

    // Enemy → attack with selected combat
    if (hit && (hit.kind === 'unit' || hit.kind === 'building') && hit.team === TEAM.ENEMY && combat.length) {
      RTS.orderAttack(s, combat, hit.id);
      flash(s, wx, wy, '#ff5a5a');
      RTS.log(s, 'Engaging target', 'info');
      return;
    }

    // Empty ground → move
    if (combat.length && (!hit || hit.kind === 'resource')) {
      RTS.orderMove(s, combat, wx, wy, s.attackMoveArmed);
      flash(s, wx, wy, s.attackMoveArmed ? '#ff9a3c' : RTS.Factions[s.playerFaction].primary);
      // workers also move if only workers selected
      return;
    }
    if (workers.length && !combat.length && (!hit || hit.kind === 'resource')) {
      RTS.orderMove(s, workers, wx, wy, false);
      flash(s, wx, wy, RTS.Factions[s.playerFaction].primary);
      return;
    }

    if (!hit) RTS.clearSelection(s);
  }

  function flash(s, wx, wy, color) {
    RTS.addEffect(s, { kind: 'cmd', x: wx, y: wy, life: 0.34, max: 0.34, color: color, r: 10 });
  }

  // ---- Long press (attack-move on empty ground) ----------------------------
  function startLongPress(s, wx, wy, cssX, cssY) {
    clearLongPress(s);
    var combat = RTS.selectedUnits(s).filter(function (u) { return u.role !== 'worker'; });
    if (!combat.length || s.inputMode === 'place-building') return;
    s.ui.longPressAnchor = { wx: wx, wy: wy, cssX: cssX, cssY: cssY, start: performance.now() };
    s.ui.longPressTimer = setTimeout(function () {
      var p = s.ui.pointer;
      if (!p || p.moved) return;
      p.longPressFired = true;
      RTS.orderMove(s, combat, wx, wy, true);
      flash(s, wx, wy, '#ff9a3c');
      RTS.log(s, 'Attack-move ordered', 'info');
      if (navigator.vibrate) navigator.vibrate(15);
      clearLongPress(s);
    }, 460);
  }
  function clearLongPress(s) {
    if (s.ui.longPressTimer) clearTimeout(s.ui.longPressTimer);
    s.ui.longPressTimer = null;
    s.ui.longPressAnchor = null;
  }

  // ---- Init / event wiring -------------------------------------------------
  RTS.Input = {
    init: function (canvas, getState) {
      var DRAG = (RTS.Config.touch && RTS.Config.touch.dragPx) || 12;
      var UIBLOCK = (RTS.Config.touch && RTS.Config.touch.uiBlockMs) || 320;

      function st() { return getState(); }
      function active() { var s = st(); return s.scene === 'playing'; }
      function rect() { return canvas.getBoundingClientRect(); }
      function isSurface(e) { return e.target === canvas; }
      function uiBlocked(s) { return performance.now() - (s.ui.lastUiAt || 0) < UIBLOCK; }

      // --- single-pointer (mouse or 1 touch) ---
      function down(cssX, cssY, shift) {
        var s = st(); if (!active() || uiBlocked(s)) return;
        var w = RTS.Cam.screenToWorld(s, cssX, cssY);
        var hit = hitTest(s, w.x, w.y);
        var onEmpty = !hit || hit.kind === 'resource';
        var boxArmed = s.boxSelectArmed || shift;
        s.ui.pointer = {
          cssX: cssX, cssY: cssY, startX: cssX, startY: cssY,
          wx: w.x, wy: w.y, moved: false, panning: false, boxing: false,
          longPressFired: false, onEmpty: onEmpty, useBox: onEmpty && boxArmed, shift: !!shift,
          hitId: hit ? hit.id : null,
        };
        if (s.inputMode === 'place-building') { updateGhost(s, w.x, w.y); return; }
        if (onEmpty && !boxArmed) startLongPress(s, w.x, w.y, cssX, cssY);
      }

      function move(cssX, cssY) {
        var s = st(); if (!active() || !s.ui.pointer) return;
        var p = s.ui.pointer;
        var w = RTS.Cam.screenToWorld(s, cssX, cssY);
        if (s.inputMode === 'place-building') { updateGhost(s, w.x, w.y); }
        var dx = cssX - p.startX, dy = cssY - p.startY;
        if (Math.hypot(dx, dy) <= DRAG) {
          if (s.ui.longPressAnchor) s.ui.longPressAnchor.cssX = cssX, s.ui.longPressAnchor.cssY = cssY;
          return;
        }
        p.moved = true; clearLongPress(s);

        if (s.inputMode === 'place-building') { p.cssX = cssX; p.cssY = cssY; return; }

        if (p.useBox && p.onEmpty) {
          p.boxing = true;
          s.selectionBox = { x1: p.wx, y1: p.wy, x2: w.x, y2: w.y };
          return;
        }
        if (p.onEmpty || p.panning) {
          p.panning = true;
          var prev = RTS.Cam.screenToWorld(s, p.cssX, p.cssY);
          s.camera.x -= (w.x - prev.x);
          s.camera.y -= (w.y - prev.y);
          // recompute because camera moved; simpler: pan by delta in css
          RTS.Cam.clamp(s);
        }
        p.cssX = cssX; p.cssY = cssY;
      }

      function up(cssX, cssY) {
        var s = st(); if (!active()) { s.ui.pointer = null; return; }
        clearLongPress(s);
        var p = s.ui.pointer; s.ui.pointer = null;
        if (!p) return;
        if (p.boxing && s.selectionBox) {
          var b = s.selectionBox;
          RTS.selectBox(s, b.x1, b.y1, b.x2, b.y2, p.shift);
          s.selectionBox = null;
          return;
        }
        s.selectionBox = null;
        if (!p.moved && !p.longPressFired && !uiBlocked(s)) {
          var w = RTS.Cam.screenToWorld(s, cssX, cssY);
          tapWorld(s, w.x, w.y, p.shift);
        }
      }

      function updateGhost(s, wx, wy) {
        s.ui.ghost = { x: wx, y: wy, type: s.pending.building,
                       valid: RTS.canPlaceAt(s, s.pending.building, wx, wy) };
      }

      // --- Mouse ---
      canvas.addEventListener('mousedown', function (e) {
        if (!isSurface(e)) return; e.preventDefault();
        var r = rect(); down(e.clientX - r.left, e.clientY - r.top, e.shiftKey);
      });
      window.addEventListener('mousemove', function (e) {
        var s = st(); if (!s.ui.pointer && s.inputMode !== 'place-building') return;
        var r = rect(); move(e.clientX - r.left, e.clientY - r.top);
      });
      window.addEventListener('mouseup', function (e) {
        var r = rect(); up(e.clientX - r.left, e.clientY - r.top);
      });
      canvas.addEventListener('wheel', function (e) {
        var s = st(); if (!active()) return; e.preventDefault();
        var r = rect();
        RTS.Cam.zoomAt(s, e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
      canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var s = st(); if (!active()) return;
        // right-click = quick command (move/attack) like RTS
        var r = rect();
        var w = RTS.Cam.screenToWorld(s, e.clientX - r.left, e.clientY - r.top);
        if (s.inputMode === 'place-building') { RTS.cancelPlacement(s); return; }
        tapWorld(s, w.x, w.y, false);
      });

      // --- Touch (with pinch) ---
      var pinch = null; // {d0, zoom0, cx, cy, camx, camy}
      canvas.addEventListener('touchstart', function (e) {
        if (!isSurface(e)) return; e.preventDefault();
        var s = st(); if (!active()) return;
        var r = rect();
        if (e.touches.length === 2) {
          clearLongPress(s); s.ui.pointer = null; s.selectionBox = null;
          pinch = beginPinch(s, e, r);
          return;
        }
        pinch = null;
        var t = e.touches[0];
        down(t.clientX - r.left, t.clientY - r.top, false);
      }, { passive: false });

      canvas.addEventListener('touchmove', function (e) {
        if (!active()) return; e.preventDefault();
        var s = st(); var r = rect();
        if (e.touches.length === 2 && pinch) { doPinch(s, e, r, pinch); return; }
        if (e.touches.length === 1 && !pinch) {
          var t = e.touches[0]; move(t.clientX - r.left, t.clientY - r.top);
        }
      }, { passive: false });

      canvas.addEventListener('touchend', function (e) {
        if (!active()) return;
        var s = st(); var r = rect();
        if (pinch && e.touches.length < 2) { pinch = null; s.ui.pointer = null; return; }
        if (e.touches.length === 0) {
          var t = e.changedTouches[0];
          up(t.clientX - r.left, t.clientY - r.top);
        }
      }, { passive: false });

      canvas.addEventListener('touchcancel', function () {
        var s = st(); clearLongPress(s); s.ui.pointer = null; s.selectionBox = null; pinch = null;
      }, { passive: true });

      function beginPinch(s, e, r) {
        var a = e.touches[0], b = e.touches[1];
        var ax = a.clientX - r.left, ay = a.clientY - r.top;
        var bx = b.clientX - r.left, by = b.clientY - r.top;
        return {
          d0: Math.hypot(bx - ax, by - ay) || 1,
          zoom0: s.camera.zoom,
          cx: (ax + bx) / 2, cy: (ay + by) / 2,
          camx: s.camera.x, camy: s.camera.y,
        };
      }
      function doPinch(s, e, r, pz) {
        var a = e.touches[0], b = e.touches[1];
        var ax = a.clientX - r.left, ay = a.clientY - r.top;
        var bx = b.clientX - r.left, by = b.clientY - r.top;
        var d = Math.hypot(bx - ax, by - ay) || 1;
        var cx = (ax + bx) / 2, cy = (ay + by) / 2;
        // zoom around the pinch midpoint
        var targetZoom = Math.max(RTS.Config.camera.minZoom,
                          Math.min(RTS.Config.camera.maxZoom, pz.zoom0 * (d / pz.d0)));
        // world point under original midpoint
        s.camera.x = pz.camx; s.camera.y = pz.camy; s.camera.zoom = pz.zoom0;
        var worldMid = RTS.Cam.screenToWorld(s, pz.cx, pz.cy);
        s.camera.zoom = targetZoom;
        var after = RTS.Cam.screenToWorld(s, cx, cy);
        s.camera.x += worldMid.x - after.x;
        s.camera.y += worldMid.y - after.y;
        RTS.Cam.clamp(s);
      }

      // keyboard niceties (desktop): Esc cancels placement, A = attack-move arm
      window.addEventListener('keydown', function (e) {
        var s = st(); if (!active()) return;
        if (e.key === 'Escape') { if (s.inputMode === 'place-building') RTS.cancelPlacement(s); else RTS.clearSelection(s); }
        if (e.key === 'a' || e.key === 'A') { s.attackMoveArmed = !s.attackMoveArmed; RTS.refreshMode(s); RTS.HUD.sync(s); }
        if (e.key === 's' || e.key === 'S') { RTS.orderStop(s, RTS.selectedUnits(s)); }
      });
    },
  };

})(window.RTS = window.RTS || {});
```

---
## FILE: src/audio.js
```
/* ============================================================================
 * WARCREST — audio.js
 * Tiny WebAudio synth. No external files — all sounds generated as short blips.
 * Respects the in-game audio toggle. Lazily created on first user gesture.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var ctx = null, enabled = true, volume = 0.5, last = {};

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function blip(freq, dur, type, gain, slideTo) {
    if (!enabled) return;
    var c = ensure(); if (!c) return;
    if (c.state === 'suspended') c.resume();
    var t = c.currentTime;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    var peak = (gain == null ? 0.3 : gain) * volume;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  // Throttle very frequent sounds (shots) so battles don't machine-gun the ears.
  function throttled(key, ms, fn) {
    var now = performance.now();
    if (last[key] && now - last[key] < ms) return;
    last[key] = now; fn();
  }

  var SOUNDS = {
    click:  function () { blip(520, 0.06, 'square', 0.25); },
    deny:   function () { blip(180, 0.14, 'sawtooth', 0.25, 90); },
    move:   function () { blip(440, 0.05, 'triangle', 0.2, 560); },
    attack: function () { blip(300, 0.08, 'square', 0.25, 220); },
    build:  function () { blip(330, 0.12, 'triangle', 0.25, 500); },
    ready:  function () { blip(660, 0.09, 'triangle', 0.28, 880); },
    shot:   function () { throttled('shot', 55, function () { blip(720, 0.04, 'square', 0.12, 480); }); },
    melee:  function () { throttled('melee', 70, function () { blip(220, 0.05, 'sawtooth', 0.14, 140); }); },
    boom:   function () { throttled('boom', 80, function () { blip(120, 0.22, 'sawtooth', 0.3, 50); }); },
    win:    function () { blip(523, 0.12, 'triangle', 0.3); setTimeout(function(){blip(784,0.18,'triangle',0.3);}, 130); },
    lose:   function () { blip(330, 0.2, 'sawtooth', 0.3, 110); setTimeout(function(){blip(160,0.3,'sawtooth',0.3,70);}, 160); },
  };

  RTS.Audio = {
    play: function (name) { var f = SOUNDS[name]; if (f) f(); },
    setEnabled: function (v) { enabled = !!v; },
    setVolume: function (v) { volume = Math.max(0, Math.min(1, v)); },
    isEnabled: function () { return enabled; },
    resume: function () { var c = ensure(); if (c && c.state === 'suspended') c.resume(); },
  };

})(window.RTS = window.RTS || {});
```

---
## FILE: src/hud.js
```
/* ============================================================================
 * WARCREST — hud.js
 * DOM HUD: top bar, contextual action tray, selection panel, event log, toast,
 * mode banner. Rebuilds the action tray from the current selection each sync.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;
  var D = {}; var getState;

  function $(id) { return document.getElementById(id); }

  RTS.HUD = {
    init: function (getStateFn) {
      getState = getStateFn;
      ['res-halcite', 'res-supply', 'timer', 'faction-name', 'btn-pause',
       'selpanel', 'action-tray', 'event-log', 'toast',
       'wave-timer', 'btn-rail-army', 'btn-rail-stop', 'btn-rail-atk', 'btn-rail-base'].forEach(function (id) { D[id] = $(id); });

      D['action-tray'].addEventListener('pointerdown', markUi, true);
      D['action-tray'].addEventListener('touchstart', markUi, true);
      D['selpanel'].addEventListener('pointerdown', markUi, true);
      D['btn-pause'].addEventListener('click', function () { RTS.Game.togglePause(); });

      // mobile quick rail
      wireRail('btn-rail-army', function (s) { RTS.selectAllArmy(s); RTS.Audio.play('click'); });
      wireRail('btn-rail-stop', function (s) { RTS.orderStop(s, RTS.selectedUnits(s)); RTS.Audio.play('click'); });
      wireRail('btn-rail-atk', function (s) {
        s.attackMoveArmed = !s.attackMoveArmed; RTS.refreshMode(s); RTS.Audio.play('click'); RTS.HUD.sync(s);
      });
      wireRail('btn-rail-base', function (s) {
        var core = RTS.playerCore(s);
        if (core) { RTS.Cam.centerOn(s, core.x, core.y); RTS.Audio.play('click'); }
      });

      // delegate tray clicks
      D['action-tray'].addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]'); if (!btn) return;
        if (btn.classList.contains('disabled')) { RTS.Audio.play('deny'); return; }
        handleAction(getState(), btn.dataset);
      });
    },

    sync: function (s) {
      if (!D['res-halcite']) return;
      // top bar
      D['res-halcite'].textContent = Math.floor(s.res.player.halcite);
      var sp = s.res.player;
      D['res-supply'].textContent = sp.supplyUsed + '/' + sp.supplyCap;
      D['res-supply'].className = sp.supplyUsed >= sp.supplyCap ? 'val warn' : 'val';
      D['faction-name'].textContent = RTS.Factions[s.playerFaction].name;

      // highlight mobile rail attack-move
      if (D['btn-rail-atk']) D['btn-rail-atk'].classList.toggle('active', !!s.attackMoveArmed);
      if (D['btn-rail-base']) { /* no state */ }

      renderSelPanel(s);
      renderTray(s);
    },

    renderLog: function (s) {
      var box = D['event-log']; if (!box) return;
      box.innerHTML = '';
      s.ui.eventLog.forEach(function (ev, i) {
        var li = document.createElement('div');
        li.className = 'evt ' + ev.tone + (i === 0 ? ' fresh' : '');
        li.textContent = ev.text;
        box.appendChild(li);
      });
    },

    tick: function (s, dt) {
      // timer + wave countdown + toast (called each frame)
      if (D['timer']) D['timer'].textContent = fmtTime(s.timers.gameTime);
      if (D['wave-timer']) {
        var rem = Math.max(0, s.timers.nextWave - s.timers.gameTime);
        D['wave-timer'].textContent = 'Wave ' + (s.timers.waveNumber + 1) + ' in ' + Math.ceil(rem) + 's';
        D['wave-timer'].className = rem < 10 ? 'wave warn' : 'wave';
      }
      var t = D['toast'];
      if (s.ui.toast) { t.textContent = s.ui.toast.text; t.classList.add('show'); }
      else t.classList.remove('show');
    },
  };

  function markUi() { var s = getState(); if (s) s.ui.lastUiAt = performance.now(); }

  function wireRail(id, fn) {
    var el = D[id]; if (!el) return;
    el.addEventListener('pointerdown', markUi, true);
    el.addEventListener('click', function () { var s = getState(); if (s) fn(s); });
  }

  // ---- Selection panel -----------------------------------------------------
  function renderSelPanel(s) {
    var p = D['selpanel']; p.innerHTML = '';
    var units = RTS.selectedUnits(s);
    var blds = RTS.selectedBuildings(s);

    if (!units.length && !blds.length) {
      p.innerHTML = '<div class="sel-hint">Tap a unit · drag to pan · pinch to zoom</div>';
      p.classList.add('compact');
      return;
    }
    p.classList.remove('compact');

    if (blds.length === 1 && !units.length) {
      var b = blds[0], spec = RTS.Buildings[b.type];
      var html = '<div class="sel-title">' + RTS.nameFor(b.faction, b.type) + '</div>';
      html += '<div class="sel-sub">' + spec.desc + '</div>';
      html += bar('Integrity', b.hp, b.maxHp, '#34e0c4');
      if (!b.built) html += '<div class="sel-line">Constructing… ' + Math.floor(b.progress * 100) + '%</div>';
      if (b.train) {
        html += '<div class="sel-line">Producing ' + RTS.nameFor(b.faction, b.train.role) +
                ' (' + Math.ceil(b.train.remaining) + 's) · queue ' + b.queue.length + '</div>';
      }
      p.innerHTML = html;
      return;
    }

    if (units.length === 1 && !blds.length) {
      var u = units[0], us = RTS.Units[u.role];
      var h = '<div class="sel-title">' + RTS.nameFor(u.faction, u.role) + '</div>';
      h += '<div class="sel-sub">' + us.desc + '</div>';
      h += bar('Health', u.hp, u.maxHp, '#34e0c4');
      var line = [];
      if (u.dmg > 0) line.push('DMG ' + u.dmg);
      if (u.heal > 0) line.push('HEAL ' + u.heal);
      line.push('RNG ' + Math.round(u.range));
      line.push('SPD ' + Math.round(u.speed));
      h += '<div class="sel-stats">' + line.join(' · ') + '</div>';
      if (u.role === 'worker' && u.harvest) {
        var ph = u.harvest.phase === 'mining' ? 'mining' :
                 u.harvest.phase === 'toBase' ? 'returning +' + Math.floor(u.harvest.carry) : 'to field';
        h += '<div class="sel-line">Harvesting · ' + ph + '</div>';
      }
      p.innerHTML = h;
      return;
    }

    // group
    var all = units.concat(blds);
    var counts = {};
    units.forEach(function (u) { var k = RTS.nameFor(u.faction, u.role); counts[k] = (counts[k] || 0) + 1; });
    var totHp = 0, totMax = 0;
    all.forEach(function (e) { totHp += e.hp; totMax += e.maxHp; });
    var ph2 = '<div class="sel-title">' + all.length + ' selected</div>';
    var chips = Object.keys(counts).map(function (k) {
      return '<span class="chip">' + counts[k] + '× ' + k + '</span>';
    }).join('');
    ph2 += '<div class="sel-chips">' + chips + '</div>';
    ph2 += bar('Avg health', totHp, totMax, '#34e0c4');
    p.innerHTML = ph2;
  }

  function bar(label, v, max, color) {
    var pct = Math.max(0, Math.min(1, v / max));
    var c = pct <= 0.3 ? '#ef4444' : pct <= 0.6 ? '#fbbf24' : color;
    return '<div class="sel-bar"><span>' + label + '</span>' +
           '<div class="bar"><i style="width:' + (pct * 100) + '%;background:' + c + '"></i></div>' +
           '<b>' + Math.ceil(v) + '/' + Math.ceil(max) + '</b></div>';
  }

  // ---- Action tray ---------------------------------------------------------
  function renderTray(s) {
    var tray = D['action-tray']; tray.innerHTML = '';

    if (s.inputMode === 'place-building') {
      tray.appendChild(actionBtn('✕', 'Cancel', { act: 'cancel-place' }, false, 'danger'));
      tray.appendChild(infoBtn('Tap a glowing spot near your base'));
      return;
    }

    var units = RTS.selectedUnits(s);
    var blds = RTS.selectedBuildings(s);
    var hasWorker = units.some(function (u) { return u.role === 'worker'; });
    var hasCombat = units.some(function (u) { return u.role !== 'worker'; });
    var hasCore = blds.some(function (b) { return b.type === 'core'; });

    // global quick-commands (always available)
    tray.appendChild(actionBtn('⚑', 'Army', { act: 'army' }, false, ''));
    tray.appendChild(actionBtn('▢', 'Box', { act: 'box' }, false, s.boxSelectArmed ? 'active' : ''));

    // production from selected buildings
    blds.forEach(function (b) {
      RTS.Buildings[b.type].trains.forEach(function (role) {
        var spec = RTS.Units[role];
        var afford = s.res.player.halcite >= spec.cost;
        var supplyOk = s.res.player.supplyUsed + spec.supply <= s.res.player.supplyCap;
        var dis = !b.built || !afford || !supplyOk;
        tray.appendChild(actionBtn(glyphIcon(spec.glyph), RTS.nameFor(b.faction, role),
          { act: 'train', role: role, bid: b.id }, dis, '',
          spec.cost + '⬡' + (spec.supply > 1 ? ' ' + spec.supply + '▲' : '')));
      });
    });

    // build menu (workers or core can build)
    if (hasWorker || hasCore) {
      RTS.BuildMenu.forEach(function (t) {
        var spec = RTS.Buildings[t];
        var dis = s.res.player.halcite < spec.cost;
        tray.appendChild(actionBtn(buildIcon(t), RTS.nameFor(s.playerFaction, t),
          { act: 'build', type: t }, dis, '', spec.cost + '⬡'));
      });
    }

    // combat commands
    if (units.length) {
      tray.appendChild(actionBtn('■', 'Stop', { act: 'stop' }, false, ''));
      if (hasCombat) {
        tray.appendChild(actionBtn('⌖', 'Atk-Move', { act: 'attackmove' }, false,
          s.attackMoveArmed ? 'active' : ''));
      }
    }

    if (!units.length && !blds.length) {
      tray.appendChild(infoBtn('Select your Citadel to train Pawns'));
    }
  }

  function actionBtn(icon, label, data, disabled, extra, cost) {
    var b = document.createElement('button');
    b.className = 'act' + (disabled ? ' disabled' : '') + (extra ? ' ' + extra : '');
    for (var k in data) b.dataset[k] = data[k];
    b.innerHTML = '<span class="ico">' + icon + '</span><span class="lbl">' + label + '</span>' +
                  (cost ? '<span class="cost">' + cost + '</span>' : '');
    return b;
  }
  function infoBtn(text) {
    var d = document.createElement('div'); d.className = 'act-info'; d.textContent = text; return d;
  }

  function glyphIcon(g) {
    return ({ circle: '●', tri: '▲', diamond: '◆', hex: '⬢', pent: '⬟', cross: '✚' })[g] || '●';
  }
  function buildIcon(t) {
    return ({ conduit: '◈', foundry: '▤', forge: '⏶', turret: '⊙' })[t] || '◻';
  }

  // ---- Action handling -----------------------------------------------------
  function handleAction(s, data) {
    markUi();
    switch (data.act) {
      case 'army': RTS.selectAllArmy(s); break;
      case 'box': s.boxSelectArmed = !s.boxSelectArmed; RTS.Audio.play('click'); RTS.HUD.sync(s); break;
      case 'stop': RTS.orderStop(s, RTS.selectedUnits(s)); RTS.Audio.play('click'); break;
      case 'attackmove': s.attackMoveArmed = !s.attackMoveArmed; RTS.refreshMode(s); RTS.Audio.play('click'); RTS.HUD.sync(s); break;
      case 'train':
        var b = RTS.getById(s, data.bid); if (b) RTS.train(s, b, data.role); break;
      case 'build': RTS.beginPlacement(s, data.type); break;
      case 'cancel-place': RTS.cancelPlacement(s); RTS.Audio.play('click'); break;
    }
  }

  function fmtTime(t) {
    var m = Math.floor(t / 60), sec = Math.floor(t % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

})(window.RTS = window.RTS || {});
```

---
## FILE: src/game.js
```
/* ============================================================================
 * WARCREST — game.js
 * Scene flow (menu / faction select / settings / how-to / play / pause / end),
 * match lifecycle, menu wiring, and the main requestAnimationFrame loop.
 * Bootstraps everything on DOMContentLoaded.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var state = null;
  var lastT = 0;
  var ONBOARD_KEY = 'exofront_onboarded';

  function $(id) { return document.getElementById(id); }
  function show(el, on) { if (el) el.classList.toggle('hidden', !on); }

  RTS.Game = {
    get state() { return state; },

    boot: function () {
      RTS.canvas = $('game');
      RTS.ctx = RTS.canvas.getContext('2d');
      RTS.minimap = $('minimap');

      state = RTS.createState();
      RTS.HUD.init(function () { return state; });
      RTS.Input.init(RTS.canvas, function () { return state; });

      wireMenus();
      window.addEventListener('resize', function () { RTS.Render.resize(state); });
      this.scene('menu');
      requestAnimationFrame(loop);
    },

    scene: function (name) {
      state.scene = name;
      show($('screen-menu'), name === 'menu');
      show($('screen-faction'), name === 'factionselect');
      show($('screen-settings'), name === 'settings');
      show($('screen-howto'), name === 'howto');
      show($('hud'), name === 'playing' || name === 'paused');
      show($('overlay-pause'), name === 'paused');
      show($('overlay-end'), name === 'won' || name === 'lost');
      var inGame = (name === 'playing' || name === 'paused' || name === 'won' || name === 'lost');
      show(RTS.canvas, inGame);
      show($('minimap-wrap'), inGame);
    },

    startMatch: function (factionId) {
      state = RTS.createState();
      RTS.resetIds();
      state.playerFaction = factionId;
      state.enemyFaction = factionId === 'aurex' ? 'cinder' : 'aurex';
      RTS.buildMap(state);
      this.scene('playing');           // make canvas visible before sizing
      RTS.Render.resize(state);
      var core = RTS.playerCore(state);
      if (core) RTS.Cam.centerOn(state, core.x, core.y);
      RTS.HUD.sync(state);
      RTS.HUD.renderLog(state);
      RTS.log(state, 'Battle for the Ashfen Reach begins', 'good');
      RTS.Audio.resume();
      lastT = performance.now();

      if (!localStorage.getItem(ONBOARD_KEY)) {
        show($('overlay-onboard'), true);
        state.scene = 'paused'; // pause sim while reading tips, but keep visuals
        show($('hud'), true);
      }
    },

    togglePause: function () {
      if (state.scene === 'playing') { this.scene('paused'); RTS.Audio.play('click'); }
      else if (state.scene === 'paused') { this.scene('playing'); lastT = performance.now(); RTS.Audio.play('click'); }
    },

    resume: function () {
      show($('overlay-onboard'), false);
      if (state.scene === 'paused') { this.scene('playing'); lastT = performance.now(); }
    },
  };

  // endMatch is called by the simulation; expose globally.
  RTS.endMatch = function (s, result) {
    if (s.scene === 'won' || s.scene === 'lost') return;
    RTS.Game.scene(result);
    var won = result === 'won';
    var ov = $('overlay-end');
    if (ov) ov.className = 'overlay ' + result;
    var t = $('end-title'), m = $('end-msg'), st = $('end-stats'), ic = $('end-icon');
    if (t) t.textContent = won ? 'VICTORY' : 'DEFEAT';
    if (m) m.textContent = won
      ? 'The enemy core is shattered. The Basin is yours.'
      : 'Your Citadel has fallen. The Basin is lost — for now.';
    if (ic) ic.textContent = won ? '★' : '✕';
    if (st) {
      st.innerHTML =
        stat('Time', fmt(s.timers.gameTime)) +
        stat('Kills', s.stats.kills) +
        stat('Units built', s.stats.unitsBuilt) +
        stat('Ironstone mined', Math.floor(s.stats.harvested));
    }
    RTS.Audio.play(won ? 'win' : 'lose');
    if (won && !RTS.Config.reducedMotion) { s.screenFlash = 0.6; s.flashColor = '#34e0c4'; }
  };
  function stat(k, v) { return '<div class="end-stat"><span>' + k + '</span><b>' + v + '</b></div>'; }

  // ---- Menu wiring ---------------------------------------------------------
  function wireMenus() {
    on('btn-play', function () { RTS.Game.scene('factionselect'); RTS.Audio.resume(); RTS.Audio.play('click'); });
    on('btn-howto', function () { RTS.Game.scene('howto'); RTS.Audio.play('click'); });
    on('btn-settings', function () { RTS.Game.scene('settings'); RTS.Audio.play('click'); });
    on('btn-howto-back', function () { RTS.Game.scene('menu'); });
    on('btn-faction-back', function () { RTS.Game.scene('menu'); });
    on('btn-settings-back', function () { RTS.Game.scene(prevSceneForSettings()); });

    // faction cards
    Array.prototype.forEach.call(document.querySelectorAll('[data-faction]'), function (card) {
      card.addEventListener('click', function () {
        RTS.Audio.play('ready');
        RTS.Game.startMatch(card.dataset.faction);
      });
    });

    // pause menu
    on('btn-resume', function () { RTS.Game.togglePause(); });
    on('btn-restart', function () { RTS.Game.startMatch(state.playerFaction); });
    on('btn-quit', function () { RTS.Game.scene('menu'); });
    on('btn-pause-settings', function () { settingsReturn = 'paused'; RTS.Game.scene('settings'); });

    // end overlay
    on('btn-end-again', function () { RTS.Game.startMatch(state.playerFaction); });
    on('btn-end-menu', function () { RTS.Game.scene('menu'); });

    // onboarding
    on('btn-onboard-go', function () {
      localStorage.setItem(ONBOARD_KEY, '1');
      RTS.Game.resume();
    });

    // settings controls
    var audio = $('set-audio'), health = $('set-health'), vol = $('set-volume'), edge = $('set-edge');
    if (audio) { audio.checked = true; audio.addEventListener('change', function () {
      state.settings.audio = audio.checked; RTS.Audio.setEnabled(audio.checked); }); }
    if (health) { health.addEventListener('change', function () { state.settings.showHealthAlways = health.checked; }); }
    if (vol) { vol.addEventListener('input', function () {
      state.settings.sfxVolume = +vol.value; RTS.Audio.setVolume(+vol.value); }); }
  }

  var settingsReturn = 'menu';
  function prevSceneForSettings() {
    var r = settingsReturn; settingsReturn = 'menu';
    return r;
  }

  function on(id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); }

  // ---- Main loop -----------------------------------------------------------
  function loop(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000) || 0;
    lastT = now;

    if (state.scene === 'playing') {
      RTS.update(state, dt);
      RTS.HUD.tick(state, dt);
    }
    if (state.scene === 'playing' || state.scene === 'paused' ||
        state.scene === 'won' || state.scene === 'lost') {
      RTS.Render.frame(state);
      RTS.renderMinimap(state);
      if (state.scene !== 'playing') RTS.HUD.tick(state, 0);
    }
    requestAnimationFrame(loop);
  }

  function fmt(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }

  document.addEventListener('DOMContentLoaded', function () { RTS.Game.boot(); });

})(window.RTS = window.RTS || {});
```
