/* ============================================================================
 * EXOFRONT — audio.js
 * WebAudio synth SFX + shuffled faction background-music playlists.
 * Respects the in-game audio toggle. Lazily created on first user gesture.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var ctx = null, enabled = true, volume = 0.5, last = {};
  var music = null, musicStarted = false;
  var activeFaction = 'default';
  var shuffleOrder = [];
  var shuffleIdx = 0;

  var MUSIC_GAIN = 0.42;
  var MELEE_SRC = 'assets/audio/sword-hit-metal.wav';
  var MELEE_GAIN = 0.14;
  var WIN_SRC = 'assets/audio/fanfare-win.wav';
  var LOSE_SRC = 'assets/audio/fanfare-lose.wav';
  var FANFARE_GAIN = 0.58;
  var SHOT_SRC = 'assets/audio/arrow-shot.wav';
  var SHOT_GAIN = 0.16;
  var COIN_SRC = 'assets/audio/mine-pickaxe.wav';
  var COIN_GAIN = 0.18;
  var BOOM_SRC = 'assets/audio/building-explosion.wav';
  var BOOM_GAIN = 0.38;

  /* Menu / title theme — Rimwalker elves (main game theme). */
  var PLAYLISTS = {
    default: ['assets/audio/moonlit-citadel.mp3'],
    aurex: [
      'assets/audio/iron-crown-shadows.mp3',
      'assets/audio/hurdy-gurdy-siege.mp3',
      'assets/audio/hurdy-gurdy-oath.mp3',
    ],
    cinder: [
      'assets/audio/siege-chimes-silenced.mp3',
      'assets/audio/taiko-throat-scream.mp3',
      'assets/audio/taiko-oath-drum.mp3',
    ],
    rimwalker: [
      'assets/audio/moonlit-citadel.mp3',
      'assets/audio/celestial-forest.mp3',
      'assets/audio/moonlit-citadel-2.mp3',
    ],
  };

  var meleeBuffer = null;
  var winBuffer = null;
  var loseBuffer = null;
  var shotBuffer = null;
  var coinBuffer = null;
  var boomBuffer = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function musicLevel() {
    return enabled ? Math.max(0, Math.min(1, volume * MUSIC_GAIN)) : 0;
  }

  function playlistKey(factionId) {
    if (factionId && PLAYLISTS[factionId]) return factionId;
    return 'default';
  }

  function playlistTracks(key) {
    return PLAYLISTS[key] || PLAYLISTS.default;
  }

  function shufflePlaylist(tracks) {
    var order = [];
    var i;
    for (i = 0; i < tracks.length; i++) order.push(i);
    for (i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    return order;
  }

  function resetShuffle(key) {
    shuffleOrder = shufflePlaylist(playlistTracks(key));
    shuffleIdx = 0;
  }

  function currentTrackSrc() {
    var tracks = playlistTracks(activeFaction);
    if (!shuffleOrder.length) resetShuffle(activeFaction);
    return tracks[shuffleOrder[shuffleIdx % shuffleOrder.length]];
  }

  function trackSrcPath(src) {
    if (!src) return '';
    try {
      return new URL(src, window.location.href).pathname;
    } catch (e) {
      return src;
    }
  }

  function ensureMusic() {
    if (music) return music;
    music = new Audio();
    music.preload = 'auto';
    music.loop = false;
    music.addEventListener('ended', onMusicEnded);
    return music;
  }

  function onMusicEnded() {
    shuffleIdx++;
    if (shuffleIdx >= shuffleOrder.length) resetShuffle(activeFaction);
    playCurrentTrack(true);
  }

  function playCurrentTrack(forceReload) {
    if (!enabled) return;
    var track = ensureMusic();
    var src = currentTrackSrc();
    var nextPath = trackSrcPath(src);
    var curPath = trackSrcPath(track.getAttribute('data-src') || track.src);
    if (forceReload || nextPath !== curPath) {
      track.src = src;
      track.setAttribute('data-src', src);
      track.load();
    }
    track.volume = musicLevel();
    musicStarted = true;
    var play = track.play();
    if (play && play.catch) play.catch(function () {});
  }

  function syncMusicVolume() {
    if (!music) return;
    music.volume = musicLevel();
  }

  function startMusic() {
    if (!enabled) return;
    playCurrentTrack(false);
  }

  function stopMusic() {
    if (!music) return;
    music.pause();
    music.currentTime = 0;
    musicStarted = false;
  }

  function resumeMusic() {
    if (!enabled || !musicStarted || !music) return;
    syncMusicVolume();
    var play = music.play();
    if (play && play.catch) play.catch(function () {});
  }

  function setFaction(factionId, forceRestart) {
    var key = playlistKey(factionId);
    if (!forceRestart && key === activeFaction) return;
    activeFaction = key;
    resetShuffle(key);
    if (music) {
      music.pause();
      music.currentTime = 0;
    }
    if (musicStarted && enabled) playCurrentTrack(true);
  }

  function bindMusicAutostart() {
    if (bindMusicAutostart._bound) return;
    bindMusicAutostart._bound = true;
    resetShuffle(activeFaction);
    ensureMusic();

    function unlock() {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      var c = ensure();
      if (c && c.state === 'suspended') c.resume();
      startMusic();
    }

    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  function loadSample(url, setter) {
    fetch(url)
      .then(function (res) { return res.ok ? res.arrayBuffer() : null; })
      .then(function (buf) {
        if (!buf) return;
        var c = ensure();
        if (!c) return;
        c.decodeAudioData(buf, function (decoded) {
          setter(decoded);
        }, function () {});
      })
      .catch(function () {});
  }

  function loadSamples() {
    loadSample(MELEE_SRC, function (b) { meleeBuffer = b; });
    loadSample(WIN_SRC, function (b) { winBuffer = b; });
    loadSample(LOSE_SRC, function (b) { loseBuffer = b; });
    loadSample(SHOT_SRC, function (b) { shotBuffer = b; });
    loadSample(COIN_SRC, function (b) { coinBuffer = b; });
    loadSample(BOOM_SRC, function (b) { boomBuffer = b; });
  }

  function duckMusicFor(ms) {
    if (!music || music.paused) return;
    music.volume = musicLevel() * 0.18;
    setTimeout(function () { syncMusicVolume(); }, ms);
  }

  function playBuffer(buffer, gainMul, pitchRange, duckMs, fallback) {
    if (!enabled) return;
    var c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();

    if (!buffer) {
      if (fallback) fallback();
      return;
    }

    if (duckMs) duckMusicFor(duckMs);

    var src = c.createBufferSource();
    src.buffer = buffer;
    if (pitchRange) {
      src.playbackRate.value = pitchRange[0] + Math.random() * (pitchRange[1] - pitchRange[0]);
    }
    var g = c.createGain();
    g.gain.value = gainMul * volume;
    src.connect(g);
    g.connect(c.destination);
    src.start(0);
  }

  function playMeleeHit() {
    playBuffer(meleeBuffer, MELEE_GAIN, [0.94, 1.06], 0, function () {
      blip(220, 0.05, 'sawtooth', 0.14, 140);
    });
  }

  function playWinFanfare() {
    playBuffer(winBuffer, FANFARE_GAIN, null, 3500, function () {
      blip(523, 0.12, 'triangle', 0.3);
      setTimeout(function () { blip(784, 0.18, 'triangle', 0.3); }, 130);
    });
  }

  function playLoseFanfare() {
    playBuffer(loseBuffer, FANFARE_GAIN, null, 3500, function () {
      blip(330, 0.2, 'sawtooth', 0.3, 110);
      setTimeout(function () { blip(160, 0.3, 'sawtooth', 0.3, 70); }, 160);
    });
  }

  function playArrowShot() {
    playBuffer(shotBuffer, SHOT_GAIN, [0.96, 1.08], 0, function () {
      blip(720, 0.04, 'square', 0.12, 480);
    });
  }

  function playMineHit() {
    playBuffer(coinBuffer, COIN_GAIN, [0.92, 1.06], 0, function () {
      blip(880, 0.07, 'triangle', 0.22, 1100);
    });
  }

  function playBuildingExplosion() {
    playBuffer(boomBuffer, BOOM_GAIN, [0.98, 1.02], 0, function () {
      blip(120, 0.22, 'sawtooth', 0.3, 50);
    });
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
    coin:   function () { throttled('coin', 140, playMineHit); },
    shot:   function () { throttled('shot', 70, playArrowShot); },
    melee:  function () { throttled('melee', 85, playMeleeHit); },
    boom:   function () { throttled('boom', 120, playBuildingExplosion); },
    win:    playWinFanfare,
    lose:   playLoseFanfare,
  };

  RTS.Audio = {
    play: function (name) { var f = SOUNDS[name]; if (f) f(); },
    setEnabled: function (v) {
      enabled = !!v;
      syncMusicVolume();
      if (!enabled && music) music.pause();
      else resumeMusic();
    },
    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, v));
      syncMusicVolume();
    },
    isEnabled: function () { return enabled; },
    setFaction: setFaction,
    resume: function () {
      var c = ensure();
      if (c && c.state === 'suspended') c.resume();
      if (!musicStarted) startMusic();
      else resumeMusic();
    },
    startMusic: startMusic,
    stopMusic: stopMusic,
    bindAutostart: bindMusicAutostart,
  };

  bindMusicAutostart();
  loadSamples();

})(window.RTS = window.RTS || {});
