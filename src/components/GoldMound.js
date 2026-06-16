/**
 * GoldMound.js
 * Renders a 6-layer gold mound with staggered shimmer/highlight animation
 * and a 6-phase depletion system tied to your gold resource count.
 *
 * Sprite specs (confirmed):
 *   - Each base stone:      128 x 128 px
 *   - Each highlight sheet: 768 x 128 px  (6 frames x 128px wide)
 *   - Stone 1 = smallest object inside the 128x128 frame
 *   - Stone 6 = largest  object inside the 128x128 frame
 *   - Layers offset slightly to build up the mound naturally.
 *
 * Depletion phases (Stone 6 depletes first, Stone 1 last):
 *   Phase 6 — 100%       : All 6 stones visible  (full, rich mound)
 *   Phase 5 —  80%-99%   : 5 stones (Stone 6 fades out)
 *   Phase 4 —  60%-79%   : 4 stones
 *   Phase 3 —  40%-59%   : 3 stones
 *   Phase 2 —  20%-39%   : 2 stones
 *   Phase 1 —   1%-19%   : 1 stone  (scraps)
 *   Phase 0 —   0%       : No stones (node exhausted — call onDepleted callback)
 */

const GOLD_BASE_PATH = 'assets/tiny-swords/Terrain/Resources/Gold/Gold Stones/';

const FRAME_SIZE   = 128; // px — every base + highlight frame is 128x128
const TOTAL_FRAMES = 6;   // 768px sheet / 128px = 6 frames per highlight strip

// Depletion: Stone 6 is removed first (index 5), Stone 1 last (index 0)
// visibleLayers = 6 means all stones show; visibleLayers = 1 means only Stone 1 shows
const DEPLETION_FADE_DURATION = 600; // ms for a stone to fade out when depleted

/**
 * Per-layer positional offsets (dx, dy) relative to the mound anchor point.
 * Anchor = top-left of Stone 6 (largest). All others offset from there.
 * Positive dx = right, positive dy = down (canvas coords).
 */
const GOLD_LAYERS = [
  { base: 'Gold Stone 1.png', highlight: 'Gold Stone 1_Highlight.png', dx:  32, dy:  48 }, // smallest — front-left
  { base: 'Gold Stone 2.png', highlight: 'Gold Stone 2_Highlight.png', dx:  80, dy:  52 }, // small    — front-right
  { base: 'Gold Stone 3.png', highlight: 'Gold Stone 3_Highlight.png', dx:   8, dy:  16 }, // mid      — left
  { base: 'Gold Stone 4.png', highlight: 'Gold Stone 4_Highlight.png', dx:  72, dy:  20 }, // mid      — right
  { base: 'Gold Stone 5.png', highlight: 'Gold Stone 5_Highlight.png', dx:  40, dy:   0 }, // large    — back
  { base: 'Gold Stone 6.png', highlight: 'Gold Stone 6_Highlight.png', dx:   0, dy:   0 }, // largest  — anchor
];

const SHIMMER_CONFIG = {
  fps:              6,    // shimmer animation speed (frames per second)
  staggerMs:       200,   // ms between each layer starting its shimmer cycle
  highlightOpacity: 0.9,  // peak highlight opacity at shimmer peak
  loopDelay:       2200,  // ms idle pause between shimmer cycles
};

/**
 * GoldMound Class
 *
 * Basic usage:
 *   const mound = new GoldMound(canvasElement, x, y, { maxGold: 1500 });
 *   mound.load().then(() => mound.start());
 *
 *   // Called from your game loop whenever gold changes:
 *   mound.setDepletion(currentGold, maxGold);
 *
 *   // Called when node is exhausted:
 *   mound.onDepleted = () => { removeNodeFromMap(mound); };
 */
export class GoldMound {
  constructor(canvas, x = 0, y = 0, options = {}) {
    this.canvas         = canvas;
    this.ctx            = canvas.getContext('2d');
    this.x              = x;
    this.y              = y;
    this.layers         = [];
    this.animationFrameId = null;
    this.lastFrameTime  = 0;
    this.isRunning      = false;

    // Depletion state
    this.visibleLayers  = 6;        // how many stones are currently shown (6 = full)
    this.fadeLayer      = -1;       // index of the layer currently fading out (-1 = none)
    this.fadeTimer      = 0;        // ms elapsed in the current fade-out
    this.onDepleted     = options.onDepleted || null; // callback when all gold is gone
  }

  // ─── Asset Loading ───────────────────────────────────────────────────────────

  async load() {
    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const img   = new Image();
        img.onload  = () => resolve(img);
        img.onerror = () => reject(new Error(`[GoldMound] Failed to load: ${src}`));
        img.src     = src;
      });

    this.layers = await Promise.all(
      GOLD_LAYERS.map(async (def, index) => ({
        baseImg:       await loadImage(GOLD_BASE_PATH + def.base),
        highlightImg:  await loadImage(GOLD_BASE_PATH + def.highlight),
        dx:            def.dx,
        dy:            def.dy,
        // Shimmer animation state
        currentFrame:  0,
        frameTimer:    0,
        cycleTimer:    index * SHIMMER_CONFIG.staggerMs,
        inDelay:       false,
        // Depletion state
        opacity:       1.0,   // 1.0 = fully visible, 0.0 = gone
        depleted:      false, // true = this stone has been fully removed
      }))
    );

    console.log(`[GoldMound] ${this.layers.length} layers loaded.`);
  }

  // ─── Depletion API ───────────────────────────────────────────────────────────

  /**
   * Call this whenever your gold amount changes.
   * @param {number} current  — current gold remaining (e.g. 450)
   * @param {number} max      — starting/max gold amount (e.g. 1500)
   *
   * Automatically triggers fade-out of the appropriate stone layer
   * and fires onDepleted() when current reaches 0.
   */
  setDepletion(current, max) {
    if (max <= 0) return;

    const ratio = Math.max(0, Math.min(1, current / max));

    // Map 0–1 ratio to 0–6 visible layers
    // ratio 1.0 = 6 layers, ratio 0.0 = 0 layers
    const targetLayers = Math.ceil(ratio * 6);

    if (targetLayers < this.visibleLayers) {
      // A stone needs to be removed — trigger fade-out on the topmost visible layer
      // Depletion removes from the top (Stone 6 first = index 5)
      const layerToFade = this.visibleLayers - 1; // 0-based index

      if (layerToFade >= 0 && !this.layers[layerToFade].depleted) {
        this.fadeLayer = layerToFade;
        this.fadeTimer = 0;
      }

      this.visibleLayers = targetLayers;
    }

    // Fire depletion callback when node is exhausted
    if (current <= 0 && this.onDepleted) {
      this.onDepleted();
    }
  }

  // ─── Loop Control ────────────────────────────────────────────────────────────

  start() {
    if (!this.layers.length) {
      console.warn('[GoldMound] Call load() before start().');
      return;
    }
    this.isRunning     = true;
    this.lastFrameTime = performance.now();
    this._loop(this.lastFrameTime);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }

  // ─── Render Loop ─────────────────────────────────────────────────────────────

  _loop(timestamp) {
    if (!this.isRunning) return;
    const delta        = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    this._update(delta);
    this._draw();
    this.animationFrameId = requestAnimationFrame((ts) => this._loop(ts));
  }

  // ─── Animation Update ────────────────────────────────────────────────────────

  _update(delta) {
    const msPerFrame    = 1000 / SHIMMER_CONFIG.fps;
    const { loopDelay } = SHIMMER_CONFIG;

    // Advance fade-out timer for the currently depleting layer
    if (this.fadeLayer >= 0) {
      this.fadeTimer += delta;
      const progress = Math.min(1, this.fadeTimer / DEPLETION_FADE_DURATION);
      this.layers[this.fadeLayer].opacity = 1.0 - progress;

      if (progress >= 1.0) {
        this.layers[this.fadeLayer].opacity  = 0.0;
        this.layers[this.fadeLayer].depleted = true;
        this.fadeLayer = -1; // fade complete
      }
    }

    // Advance shimmer animation for each visible, non-depleted layer
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (layer.depleted || i >= this.visibleLayers) continue;

      if (layer.inDelay) {
        layer.cycleTimer += delta;
        if (layer.cycleTimer >= loopDelay) {
          layer.cycleTimer   = 0;
          layer.currentFrame = 0;
          layer.inDelay      = false;
        }
        continue;
      }

      layer.frameTimer += delta;
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

  // ─── Draw ─────────────────────────────────────────────────────────────────────

  _draw() {
    const { ctx, x, y }        = this;
    const { highlightOpacity } = SHIMMER_CONFIG;

    ctx.clearRect(x - 4, y - 4, FRAME_SIZE + 96, FRAME_SIZE + 64);

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];

      // Skip fully depleted stones and stones above visible threshold
      // Exception: allow the currently-fading layer to still render during its fade
      const isFading = (i === this.fadeLayer);
      if (layer.depleted) continue;
      if (i >= this.visibleLayers && !isFading) continue;

      const lx = x + layer.dx;
      const ly = y + layer.dy;

      // 1. Base stone — respects depletion fade opacity
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(layer.baseImg, lx, ly, FRAME_SIZE, FRAME_SIZE);

      // 2. Highlight shimmer overlay — also fades with the stone
      const srcX         = layer.currentFrame * FRAME_SIZE;
      const progress     = layer.currentFrame / (TOTAL_FRAMES - 1);
      const shimmerAlpha = layer.inDelay ? 0 : highlightOpacity * Math.sin(progress * Math.PI);

      ctx.globalAlpha = shimmerAlpha * layer.opacity;
      ctx.drawImage(
        layer.highlightImg,
        srcX, 0, FRAME_SIZE, FRAME_SIZE,
        lx,   ly, FRAME_SIZE, FRAME_SIZE
      );
    }

    ctx.globalAlpha = 1.0;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  /** Returns current depletion phase (6 = full, 0 = empty) for UI/minimap use */
  getPhase() {
    return this.visibleLayers;
  }
}
