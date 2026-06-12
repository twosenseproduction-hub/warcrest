/* ============================================================================
 * EXOFRONT — audio.js
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
    coin:   function () { throttled('coin', 120, function () { blip(880, 0.07, 'triangle', 0.22, 1100); }); },
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
