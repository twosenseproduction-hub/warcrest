/* ============================================================================
 * GoldMound.js — plain global script (no ES modules)
 * Registers as RTS.GoldMound and patches RTS.Assets.drawResource.
 *
 * Sprite specs:
 *   Base stone:      128 x 128 px  (Gold Stone 1–6.png)
 *   Highlight sheet: 768 x 128 px  (6 frames × 128 px wide)
 *
 * Depletion phases (Stone 6 depletes first, Stone 1 last):
 *   Phase 6 — 100%     : All 6 stones visible
 *   Phase 5 — 80–99%   : 5 stones
 *   Phase 4 — 60–79%   : 4 stones
 *   Phase 3 — 40–59%   : 3 stones
 *   Phase 2 — 20–39%   : 2 stones
 *   Phase 1 —  1–19%   : 1 stone
 *   Phase 0 —   0%     : Exhausted
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var GOLD_BASE_PATH = 'assets/tiny-swords/Terrain/Resources/Gold/Gold Stones/';
  var FRAME_SIZE     = 128;
  var TOTAL_FRAMES   = 6;
  var FADE_DURATION  = 600; // ms

  var GOLD_LAYERS = [
    { base: 'Gold Stone 1.png', highlight: 'Gold Stone 1_Highlight.png', dx:  32, dy:  48 },
    { base: 'Gold Stone 2.png', highlight: 'Gold Stone 2_Highlight.png', dx:  80, dy:  52 },
    { base: 'Gold Stone 3.png', highlight: 'Gold Stone 3_Highlight.png', dx:   8, dy:  16 },
    { base: 'Gold Stone 4.png', highlight: 'Gold Stone 4_Highlight.png', dx:  72, dy:  20 },
    { base: 'Gold Stone 5.png', highlight: 'Gold Stone 5_Highlight.png', dx:  40, dy:   0 },
    { base: 'Gold Stone 6.png', highlight: 'Gold Stone 6_Highlight.png', dx:   0, dy:   0 },
  ];

  var SHIMMER = {
    fps:              6,
    staggerMs:       200,
    highlightOpacity: 0.9,
    loopDelay:       2200,
  };

  /* ──────────────────────────────────────────────────────────────────────────
   * Image cache — shared with assets.js's own loader via the same URL keys.
   * We piggyback on RTS.Assets.loadImg so images are never double-loaded.
   * ──────────────────────────────────────────────────────────────────────── */
  function ensureLayerImgs(layer) {
    if (layer._baseLoaded && layer._hiLoaded) return;
    if (!layer._baseLoaded) {
      layer._baseImg = null;
      var baseP = RTS.Assets.loadImg(
        'Terrain/Resources/Gold/Gold Stones/' + layer.baseName
      );
      baseP.then(function (img) { layer._baseImg = img; layer._baseLoaded = true; });
    }
    if (!layer._hiLoaded) {
      layer._hiImg = null;
      var hiP = RTS.Assets.loadImg(
        'Terrain/Resources/Gold/Gold Stones/' + layer.hiName
      );
      hiP.then(function (img) { layer._hiImg = img; layer._hiLoaded = true; });
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Per-node shimmer state — keyed by node id.
   * ──────────────────────────────────────────────────────────────────────── */
  var _states = {};

  function getState(n) {
    if (_states[n.id]) return _states[n.id];
    var layers = GOLD_LAYERS.map(function (def, i) {
      return {
        baseName:     def.base,
        hiName:       def.highlight,
        dx:           def.dx,
        dy:           def.dy,
        _baseLoaded:  false,
        _hiLoaded:    false,
        _baseImg:     null,
        _hiImg:       null,
        currentFrame: 0,
        frameTimer:   0,
        cycleTimer:   i * SHIMMER.staggerMs,
        inDelay:      false,
        opacity:      1.0,
        depleted:     false,
      };
    });
    var st = {
      layers:        layers,
      visibleLayers: 6,
      fadeLayer:     -1,
      fadeTimer:     0,
      lastT:         0,
    };
    _states[n.id] = st;
    return st;
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Update shimmer + depletion state for one node.
   * Called each frame from drawResource (delta in seconds).
   * ──────────────────────────────────────────────────────────────────────── */
  function updateState(st, n, tSec) {
    var deltaMs = (tSec - st.lastT) * 1000;
    if (deltaMs <= 0 || deltaMs > 500) { st.lastT = tSec; return; }
    st.lastT = tSec;

    // Sync visible layer count with depletion
    var pct    = n.amount / n.max;
    var target = Math.ceil(Math.max(0, Math.min(1, pct)) * 6);
    if (target < st.visibleLayers) {
      var layerToFade = st.visibleLayers - 1;
      if (layerToFade >= 0 && !st.layers[layerToFade].depleted) {
        st.fadeLayer = layerToFade;
        st.fadeTimer = 0;
      }
      st.visibleLayers = target;
    }

    // Advance fade
    if (st.fadeLayer >= 0) {
      st.fadeTimer += deltaMs;
      var progress = Math.min(1, st.fadeTimer / FADE_DURATION);
      st.layers[st.fadeLayer].opacity = 1.0 - progress;
      if (progress >= 1.0) {
        st.layers[st.fadeLayer].opacity  = 0.0;
        st.layers[st.fadeLayer].depleted = true;
        st.fadeLayer = -1;
      }
    }

    var msPerFrame = 1000 / SHIMMER.fps;
    for (var i = 0; i < st.layers.length; i++) {
      var layer = st.layers[i];
      if (layer.depleted || i >= st.visibleLayers) continue;
      ensureLayerImgs(layer);

      if (layer.inDelay) {
        layer.cycleTimer += deltaMs;
        if (layer.cycleTimer >= SHIMMER.loopDelay) {
          layer.cycleTimer   = 0;
          layer.currentFrame = 0;
          layer.inDelay      = false;
        }
        continue;
      }
      layer.frameTimer += deltaMs;
      if (layer.frameTimer >= msPerFrame) {
        layer.frameTimer  -= msPerFrame;
        layer.currentFrame++;
        if (layer.currentFrame >= TOTAL_FRAMES) {
          layer.currentFrame = TOTAL_FRAMES - 1;
          layer.inDelay      = true;
          layer.cycleTimer   = 0;
        }
      }
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Draw all stone layers for one node.
   * Returns true so assets.js drawResource returns early (no double draw).
   * ──────────────────────────────────────────────────────────────────────── */
  function drawNode(ctx, n, st) {
    var pct  = n.amount / n.max;
    var x    = n.x;
    var footY = n.y + 8;

    // Scale the mound anchor so it shrinks slightly as gold depletes
    var sc = (0.78 + 0.22 * pct) * (n.r / 64);

    ctx.save();
    ctx.translate(x - FRAME_SIZE * sc * 0.5, footY - FRAME_SIZE * sc * 0.82);
    ctx.scale(sc, sc);

    for (var i = 0; i < st.layers.length; i++) {
      var layer = st.layers[i];
      var isFading = (i === st.fadeLayer);
      if (layer.depleted) continue;
      if (i >= st.visibleLayers && !isFading) continue;
      if (!layer._baseImg) continue;

      var lx = layer.dx;
      var ly = layer.dy;

      // Base stone
      ctx.globalAlpha = layer.opacity;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(layer._baseImg, lx, ly, FRAME_SIZE, FRAME_SIZE);

      // Shimmer highlight
      if (layer._hiImg && !layer.inDelay) {
        var progress     = layer.currentFrame / (TOTAL_FRAMES - 1);
        var shimmerAlpha = SHIMMER.highlightOpacity * Math.sin(progress * Math.PI);
        ctx.globalAlpha = shimmerAlpha * layer.opacity;
        ctx.drawImage(
          layer._hiImg,
          layer.currentFrame * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE,
          lx, ly, FRAME_SIZE, FRAME_SIZE
        );
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1.0;

    // Amount label (same style as assets.js)
    var label = Math.ceil(n.amount);
    var lxL   = x + n.r * 0.38;
    var lyL   = footY - n.r * 0.92;
    ctx.font        = '600 9px Fredoka, system-ui';
    ctx.textAlign   = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth   = 2;
    ctx.strokeStyle = 'rgba(18,14,10,0.55)';
    ctx.strokeText(label, lxL, lyL);
    ctx.fillStyle   = pct < 0.35 ? 'rgba(255,183,77,0.82)' : 'rgba(255,224,160,0.75)';
    ctx.fillText(label, lxL, lyL);

    return true;
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Public API — called from assets.js drawResource override below.
   * ──────────────────────────────────────────────────────────────────────── */
  function drawResource(ctx, n, tSec) {
    var st = getState(n);
    updateState(st, n, tSec);
    return drawNode(ctx, n, st);
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Patch assets.js drawResource once RTS.Assets is ready.
   * We wrap the existing function: GoldMound runs first and returns true,
   * so the existing coin fallback is naturally skipped.
   * ──────────────────────────────────────────────────────────────────────── */
  function patchAssetsDrawResource() {
    if (!RTS.Assets) return;
    var _orig = RTS.Assets.drawResource;
    RTS.Assets.drawResource = function (ctx, n) {
      var tSec = RTS._renderT || 0;
      return drawResource(ctx, n, tSec);
    };
    console.log('[GoldMound] drawResource patched.');
  }

  // Patch immediately if Assets already exists, otherwise wait for load.
  if (RTS.Assets) {
    patchAssetsDrawResource();
  } else {
    var _origLoad = window.onload;
    var _patched  = false;
    function tryPatch() {
      if (_patched || !RTS.Assets) return;
      _patched = true;
      patchAssetsDrawResource();
    }
    // Poll briefly — assets.js runs synchronously so it should be ready by DOMContentLoaded
    document.addEventListener('DOMContentLoaded', tryPatch);
    window.addEventListener('load', tryPatch);
  }

  RTS.GoldMound = {
    drawResource: drawResource,
    getState:     getState,
  };

})(window.RTS = window.RTS || {});
