/**
 * GoldMound.js
 * Renders a 6-layer gold mound with staggered shimmer/highlight animation.
 *
 * Sprite specs (confirmed):
 *   - Each base stone:      128 x 128 px
 *   - Each highlight sheet: 768 x 128 px  (6 frames × 128px wide)
 *   - Stone 1 = smallest object inside the 128x128 frame
 *   - Stone 6 = largest  object inside the 128x128 frame
 *   - Layers are offset slightly so smaller stones peek out
 *     from behind larger ones, building up the mound naturally.
 */

const GOLD_BASE_PATH = 'assets/tiny-swords/Terrain/Resources/Gold/Gold Stones/';

const FRAME_SIZE    = 128; // px — every base + highlight frame is 128×128
const TOTAL_FRAMES  = 6;   // 768px sheet / 128px = 6 frames per highlight strip

/**
 * Per-layer positional offsets (dx, dy) relative to the mound's anchor point.
 * Stone 1 (smallest) sits at the front-bottom.
 * Stone 6 (largest)  is the centerpiece of the mound.
 * Adjust these values in-game to fine-tune the pile composition.
 *
 * Offset convention:  positive dx = right,  positive dy = down (canvas coords)
 */
const GOLD_LAYERS = [
  { base: 'Gold Stone 1.png', highlight: 'Gold Stone 1_Highlight.png', dx:  32, dy:  48 }, // small front-left
  { base: 'Gold Stone 2.png', highlight: 'Gold Stone 2_Highlight.png', dx:  80, dy:  52 }, // small front-right
  { base: 'Gold Stone 3.png', highlight: 'Gold Stone 3_Highlight.png', dx:   8, dy:  16 }, // mid left
  { base: 'Gold Stone 4.png', highlight: 'Gold Stone 4_Highlight.png', dx:  72, dy:  20 }, // mid right
  { base: 'Gold Stone 5.png', highlight: 'Gold Stone 5_Highlight.png', dx:  40, dy:   0 }, // large back
  { base: 'Gold Stone 6.png', highlight: 'Gold Stone 6_Highlight.png', dx:   0, dy:   0 }, // largest — anchor/base
];

// Shimmer animation config
const SHIMMER_CONFIG = {
  fps:             6,     // shimmer animation speed
  staggerMs:       200,   // ms between each layer starting its shimmer (ripple effect)
  highlightOpacity: 0.9,  // peak opacity of the highlight overlay
  loopDelay:       2200,  // ms idle pause between shimmer cycles
};

/**
 * GoldMound Class
 *
 * Usage:
 *   const mound = new GoldMound(canvasElement, x, y);
 *   mound.load().then(() => mound.start());
 *
 * The anchor point (x, y) is the top-left corner of Stone 6 (the largest stone).
 * All other layers offset from there per the GOLD_LAYERS config above.
 */
export class GoldMound {
  constructor(canvas, x = 0, y = 0) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.x      = x;
    this.y      = y;
    this.layers = [];
    this.animationFrameId = null;
    this.lastFrameTime    = 0;
    this.isRunning        = false;
  }

  // ─── Asset Loading ──────────────────────────────────────────────────────────

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
        baseImg:      await loadImage(GOLD_BASE_PATH + def.base),
        highlightImg: await loadImage(GOLD_BASE_PATH + def.highlight),
        dx:           def.dx,
        dy:           def.dy,
        // Animation state
        currentFrame: 0,
        frameTimer:   0,
        cycleTimer:   index * SHIMMER_CONFIG.staggerMs, // pre-stagger so ripple starts immediately
        inDelay:      false,
      }))
    );

    console.log(`[GoldMound] ${this.layers.length} layers loaded.`);
  }

  // ─── Loop Control ───────────────────────────────────────────────────────────

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

  // ─── Render Loop ────────────────────────────────────────────────────────────

  _loop(timestamp) {
    if (!this.isRunning) return;
    const delta        = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    this._update(delta);
    this._draw();
    this.animationFrameId = requestAnimationFrame((ts) => this._loop(ts));
  }

  // ─── Animation Update ───────────────────────────────────────────────────────

  _update(delta) {
    const msPerFrame = 1000 / SHIMMER_CONFIG.fps;
    const { loopDelay } = SHIMMER_CONFIG;

    for (const layer of this.layers) {
      if (layer.inDelay) {
        layer.cycleTimer += delta;
        if (layer.cycleTimer >= loopDelay) {
          layer.cycleTimer  = 0;
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
          layer.currentFrame = TOTAL_FRAMES - 1; // hold last frame during idle
          layer.inDelay      = true;
          layer.cycleTimer   = 0;
        }
      }
    }
  }

  // ─── Draw ───────────────────────────────────────────────────────────────────

  _draw() {
    const { ctx, x, y }              = this;
    const { highlightOpacity }       = SHIMMER_CONFIG;

    // Clear the full mound bounding box before redrawing
    // Bounding box = 128 (frame) + max dx offset + padding
    ctx.clearRect(x - 4, y - 4, FRAME_SIZE + 96, FRAME_SIZE + 64);

    for (const layer of this.layers) {
      const lx = x + layer.dx;
      const ly = y + layer.dy;

      // 1. Base stone — always fully opaque
      ctx.globalAlpha = 1.0;
      ctx.drawImage(layer.baseImg, lx, ly, FRAME_SIZE, FRAME_SIZE);

      // 2. Highlight overlay — sampled from horizontal sprite sheet
      //    srcX advances by FRAME_SIZE per frame across the 768px sheet
      const srcX = layer.currentFrame * FRAME_SIZE;

      // Bell-curve alpha: smoothly fade in → peak → fade out across the 6 frames
      const progress      = layer.currentFrame / (TOTAL_FRAMES - 1);
      const shimmerAlpha  = layer.inDelay ? 0 : highlightOpacity * Math.sin(progress * Math.PI);

      ctx.globalAlpha = shimmerAlpha;
      ctx.drawImage(
        layer.highlightImg,
        srcX, 0, FRAME_SIZE, FRAME_SIZE, // source slice from sprite sheet
        lx,   ly, FRAME_SIZE, FRAME_SIZE  // destination on canvas at layer offset
      );
    }

    // Always restore globalAlpha so nothing else on the canvas is affected
    ctx.globalAlpha = 1.0;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
}
