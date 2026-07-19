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

  /* All factions share the same two-track playlist. */
  var CORE_TRACKS = [
    'assets/audio/moonlit-citadel.mp3',
    'assets/audio/celestial-forest.mp3',
  ];

  var PLAYLISTS = {
    default:   CORE_TRACKS,
    aurex:     CORE_TRACKS,
    cinder:    CORE_TRACKS,
    rimwalker: CORE_TRACKS,
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

  /* ---- procedural ambient bed: wind + sea swell (+ rare distant birds) ------
   * No audio assets needed — looping filtered noise driven by slow LFOs gives a
   * moody outdoor wash that suits the darker island tone. */
  var ambient = null, AMBIENT_GAIN = 0.42;
  function makeNoiseBuffer(c, secs) {
    var len = Math.floor(c.sampleRate * secs);
    var buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    return buf;
  }
  function startAmbient() {
    var c = ensure(); if (!c || ambient) return;
    if (c.state === 'suspended') c.resume();
    var noise = makeNoiseBuffer(c, 4);
    var master = c.createGain(); master.gain.value = 0; master.connect(c.destination);
    // sea swell — low rumble with a slow rolling LFO
    var ws = c.createBufferSource(); ws.buffer = noise; ws.loop = true;
    var wlp = c.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 430; wlp.Q.value = 0.6;
    var wg = c.createGain(); wg.gain.value = 0.85; ws.connect(wlp); wlp.connect(wg); wg.connect(master);
    var lfo = c.createOscillator(); lfo.frequency.value = 0.13; var lfoG = c.createGain(); lfoG.gain.value = 0.5;
    lfo.connect(lfoG); lfoG.connect(wg.gain); lfo.start();
    // wind — airy band, slower gust LFO
    var nd = c.createBufferSource(); nd.buffer = noise; nd.loop = true; nd.playbackRate.value = 0.8;
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1050; bp.Q.value = 0.7;
    var ng = c.createGain(); ng.gain.value = 0.3; nd.connect(bp); bp.connect(ng); ng.connect(master);
    var lfo2 = c.createOscillator(); lfo2.frequency.value = 0.07; var lfo2G = c.createGain(); lfo2G.gain.value = 0.2;
    lfo2.connect(lfo2G); lfo2G.connect(ng.gain); lfo2.start();
    ws.start(); nd.start();
    master.gain.setValueAtTime(0, c.currentTime);
    master.gain.linearRampToValueAtTime(enabled ? AMBIENT_GAIN * volume : 0, c.currentTime + 2.5);
    ambient = { master: master, nodes: [ws, nd, lfo, lfo2], birdTimer: null };
    scheduleBird();
  }
  function scheduleBird() {
    if (!ambient) return;
    ambient.birdTimer = setTimeout(function () {
      if (ambient && enabled) {
        var base = 1500 + Math.random() * 800, notes = 2 + (Math.random() * 2 | 0);
        for (var i = 0; i < notes; i++) (function (i) { setTimeout(function () { blip(base * (1 + i * 0.1), 0.07, 'sine', 0.05); }, i * 120); })(i);
      }
      scheduleBird();
    }, 9000 + Math.random() * 13000);
  }
  function stopAmbient() {
    if (!ambient) return; var c = ensure();
    try {
      if (ambient.birdTimer) clearTimeout(ambient.birdTimer);
      ambient.master.gain.cancelScheduledValues(c.currentTime);
      ambient.master.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
      ambient.nodes.forEach(function (n) { try { n.stop(c.currentTime + 1); } catch (e) {} });
    } catch (e) {}
    ambient = null;
  }
  function syncAmbientVolume() {
    if (!ambient) return; var c = ensure(); if (!c) return;
    ambient.master.gain.setTargetAtTime(enabled ? AMBIENT_GAIN * volume : 0, c.currentTime, 0.3);
  }

  RTS.Audio = {
    play: function (name) { var f = SOUNDS[name]; if (f) f(); },
    setEnabled: function (v) {
      enabled = !!v;
      syncMusicVolume();
      syncAmbientVolume();
      if (!enabled && music) music.pause();
      else resumeMusic();
    },
    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, v));
      syncMusicVolume();
      syncAmbientVolume();
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
    startAmbient: startAmbient,
    stopAmbient: stopAmbient,
    bindAutostart: bindMusicAutostart,
  };

  bindMusicAutostart();
  loadSamples();

})(window.RTS = window.RTS || {});
