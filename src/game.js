/* ============================================================================
 * EXOFRONT — game.js
 * Scene flow (menu / faction select / settings / how-to / play / pause / end),
 * match lifecycle, menu wiring, and the main requestAnimationFrame loop.
 * Bootstraps everything on DOMContentLoaded.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var state = null;
  var lastT = 0;
  var ONBOARD_KEY = 'warcrest_onboarded';

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

      if (RTS.Assets) {
        RTS.Assets.load(function () {
          var afterParticles = function () {
            if (RTS.Sprites) RTS.Sprites.load();
          };
          if (RTS.Particles) RTS.Particles.load(afterParticles);
          else afterParticles();
        });
      }

      requestAnimationFrame(loop);
    },

    scene: function (name) {
      state.scene = name;
      if (name === 'menu' || name === 'factionselect' || name === 'mapselect' || name === 'howto' || name === 'settings') {
        document.body.classList.remove('player-aurex', 'player-cinder');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#1565c0');
      }
      show($('screen-menu'), name === 'menu');
      show($('screen-map'), name === 'mapselect');
      show($('screen-faction'), name === 'factionselect');
      show($('screen-settings'), name === 'settings');
      show($('screen-howto'), name === 'howto');
      show($('hud'), name === 'playing' || name === 'paused');
      show($('overlay-pause'), name === 'paused');
      show($('overlay-end'), name === 'won' || name === 'lost');
      var inGame = (name === 'playing' || name === 'paused' || name === 'won' || name === 'lost');
      show(RTS.canvas, inGame);
      show($('map-tools'), inGame);
      show($('command-deck'), inGame);
    },

    startMatch: function (factionId, mapId) {
      state = RTS.createState();
      RTS.resetIds();
      state.mapId = mapId || state.mapId || 'sapphire_shores';
      state.playerFaction = factionId;
      state.enemyFaction = factionId === 'aurex' ? 'cinder' : 'aurex';
      applyFactionTheme(factionId);
      if (RTS.Assets && RTS.Assets.preloadFactions) {
        RTS.Assets.preloadFactions([state.playerFaction, state.enemyFaction]);
      }
      RTS.buildMap(state, state.mapId);
      this.scene('playing');           // make canvas visible before sizing
      RTS.Render.resize(state);
      var core = RTS.playerCore(state);
      if (core) RTS.Cam.centerOn(state, core.x, core.y);
      RTS.HUD.sync(state);
      RTS.HUD.renderLog(state);
      updateOnboarding(state);
      var intro = (state.map && state.map.intro) || 'Battle begins';
      RTS.log(state, intro, 'good');
      RTS.log(state, 'Lead the ' + RTS.Factions[factionId].name + ' — destroy the ' +
        RTS.nameFor(state.enemyFaction, 'core'), 'info');
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
      ? ((s.map && s.map.win) || ('The ' + RTS.nameFor(s.enemyFaction, 'core') +
         ' falls. The Reach is yours.'))
      : ((s.map && s.map.lose) || ('Your ' + RTS.nameFor(s.playerFaction, 'core') +
         ' has fallen — for now.'));
    if (ic) {
      ic.src = won ? 'assets/ui/sword-icon-win.png' : 'assets/ui/sword-icon-lose.png';
      ic.style.filter = won ? '' : 'grayscale(0.7)';
    }
    var ribbon = document.querySelector('#overlay-end .ts-ribbon-banner');
    if (ribbon) ribbon.classList.toggle('red', !won);
    if (st) {
      st.innerHTML =
        stat('Time', fmt(s.timers.gameTime)) +
        stat('Kills', s.stats.kills) +
        stat('Units built', s.stats.unitsBuilt) +
        stat(RTS.resourceLabel() + ' mined', Math.floor(s.stats.harvested));
    }
    RTS.Audio.play(won ? 'win' : 'lose');
    if (won && !RTS.Config.reducedMotion) { s.screenFlash = 0.6; s.flashColor = '#34e0c4'; }
  };
  function stat(k, v) { return '<div class="end-stat"><span>' + k + '</span><b>' + v + '</b></div>'; }

  function applyFactionTheme(factionId) {
    var fid = factionId || 'aurex';
    var f = RTS.Factions[fid];
    document.body.classList.remove('player-aurex', 'player-cinder');
    document.body.classList.add('player-' + fid);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && f) meta.setAttribute('content', f.primary);
  }

  function updateOnboarding(s) {
    var tip = $('onboard-defend-tip');
    if (!tip || !s) return;
    var enemy = RTS.Factions[s.enemyFaction];
    tip.innerHTML = '<b>Defend:</b> ' + enemy.name + ' waves are coming — build up before they land.';
  }

  // ---- Menu wiring ---------------------------------------------------------
  var settingsReturn = 'menu';
  var pendingMapId = 'sapphire_shores';

  function wireMenus() {
    on('btn-play', function () {
      pendingMapId = 'sapphire_shores';
      RTS.Game.scene('factionselect');
      RTS.Audio.resume();
      RTS.Audio.play('click');
    });
    on('btn-howto', function () { RTS.Game.scene('howto'); RTS.Audio.play('click'); });
    on('btn-settings', function () { RTS.Game.scene('settings'); RTS.Audio.play('click'); });
    on('btn-howto-back', function () { RTS.Game.scene('menu'); });
    on('btn-map-back', function () { RTS.Game.scene('menu'); });
    on('btn-faction-back', function () { RTS.Game.scene('menu'); });

    Array.prototype.forEach.call(document.querySelectorAll('[data-map]'), function (card) {
      card.addEventListener('click', function () {
        pendingMapId = card.dataset.map;
        RTS.Audio.play('click');
        RTS.Game.scene('factionselect');
      });
    });

    // faction cards
    Array.prototype.forEach.call(document.querySelectorAll('[data-faction]'), function (card) {
      card.addEventListener('click', function () {
        RTS.Audio.play('ready');
        RTS.Game.startMatch(card.dataset.faction, pendingMapId);
      });
    });

    // pause menu
    on('btn-resume', function () { RTS.Game.togglePause(); });
    on('btn-restart', function () { RTS.Game.startMatch(state.playerFaction, state.mapId); });
    on('btn-quit', function () { RTS.Game.scene('menu'); });
    on('btn-pause-settings', function () { settingsReturn = 'paused'; RTS.Game.scene('settings'); });
    on('btn-settings-back', function () { RTS.Game.scene(prevSceneForSettings()); });

    // end overlay
    on('btn-end-again', function () { RTS.Game.startMatch(state.playerFaction, state.mapId); });
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
      if (RTS.update) RTS.update(state, dt);
      if (RTS.updateHeroLifecycle) RTS.updateHeroLifecycle(state, dt);
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
