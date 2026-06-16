/**
 * GoldMound.js
 * Renders a 6-layer gold mound with staggered shimmer/highlight animation.
 * Each layer has a base stone PNG and a corresponding highlight sprite sheet
 * that cycles to simulate a living gold shimmer — like Warcraft's Gold Mine glow.
 *
 * Asset paths point directly to the repo's Gold Stones directory.
 */

const GOLD_BASE_PATH = 'assets/tiny-swords/Terrain/Resources/Gold/Gold Stones/';

// Layer definitions: render order bottom → top (1 = base, 6 = top)
const GOLD_LAYERS = [
  { base: 'Gold Stone 1.png', highlight: 'Gold Stone 1_Highlight.png' },
  { base: 'Gold Stone 2.png', highlight: 'Gold Stone 2_Highlight.png' },
  { base: 'Gold Stone 3.png', highlight: 'Gold Stone 3_Highlight.png' },
  { base: 'Gold Stone 4.png', highlight: 'Gold Stone 4_Highlight.png' },
  { base: 'Gold Stone 5.png', highlight: 'Gold Stone 5_Highlight.png' },
  { base: 'Gold Stone 6.png', highlight: 'Gold Stone 6_Highlight.png' },
];

// Shimmer animation config
const SHIMMER_CONFIG = {
  frameWidth: 64,          // px — adjust to match your highlight sprite sheet frame width
  frameHeight: 64,         // px — adjust to match your highlight sprite sheet frame height
  totalFrames: 8,          // number of frames in each highlight sheet
  fps: 6,                  // animation speed (frames per second)
  staggerMs: 180,          // ms offset between each layer starting its shimmer cycle
  highlightOpacity: 0.85,  // max opacity of highlight overlay at peak shimmer
  loopDelay: 2000,         // ms to wait between shimmer loop cycles (idle pause)
};

/**
 * GoldMound Class
 * Manages the canvas rendering of the 6-layer stacked gold mound
 * with per-layer staggered highlight animation.
 *
 * Usage:
 *   const mound = new GoldMound(canvasElement, x, y);
 *   mound.load().then(() => mound.start());
 */
export class GoldMound {
  constructor(canvas, x = 0, y = 0) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.x = x;
    this.y = y;
    this.layers = [];
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    this.isRunning = false;
  }

  /**
   * Preloads all base and highlight images for all 6 layers.
   * Returns a Promise that resolves when all assets are ready.
   */
  async load() {
    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load: ${src}`));
        img.src = src;
      });

    this.layers = await Promise.all(
      GOLD_LAYERS.map(async (layer, index) => ({
        baseImg: await loadImage(GOLD_BASE_PATH + layer.base),
        highlightImg: await loadImage(GOLD_BASE_PATH + layer.highlight),
        currentFrame: 0,
        frameTimer: 0,
        // Stagger each layer's shimmer start so they don't all flash simultaneously
        staggerOffset: index * SHIMMER_CONFIG.staggerMs,
        cycleTimer: index * SHIMMER_CONFIG.staggerMs, // pre-offset so stagger starts immediately
        inDelay: false,
      }))
    );

    console.log(`[GoldMound] All ${this.layers.length} layers loaded.`);
  }

  /**
   * Starts the render/animation loop.
   */
  start() {
    if (!this.layers.length) {
      console.warn('[GoldMound] Call load() before start().');
      return;
    }
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this._loop(this.lastFrameTime);
  }

  /**
   * Stops the animation loop.
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  /**
   * Main render loop — called every animation frame.
   */
  _loop(timestamp) {
    if (!this.isRunning) return;

    const delta = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    this._update(delta);
    this._draw();

    this.animationFrameId = requestAnimationFrame((ts) => this._loop(ts));
  }

  /**
   * Updates highlight animation frame state for each layer.
   * Each layer advances its frame independently based on stagger offset.
   */
  _update(delta) {
    const { fps, totalFrames, loopDelay } = SHIMMER_CONFIG;
    const msPerFrame = 1000 / fps;

    for (const layer of this.layers) {
      if (layer.inDelay) {
        // Waiting in the idle pause between shimmer cycles
        layer.cycleTimer += delta;
        if (layer.cycleTimer >= loopDelay) {
          layer.cycleTimer = 0;
          layer.currentFrame = 0;
          layer.inDelay = false;
        }
        continue;
      }

      layer.frameTimer += delta;
      if (layer.frameTimer >= msPerFrame) {
        layer.frameTimer -= msPerFrame;
        layer.currentFrame++;

        if (layer.currentFrame >= totalFrames) {
          // Finished one full shimmer cycle — enter idle delay before looping
          layer.currentFrame = totalFrames - 1; // hold last frame during delay
          layer.inDelay = true;
          layer.cycleTimer = 0;
        }
      }
    }
  }

  /**
   * Draws all 6 layers to the canvas in order (bottom to top).
   * Each layer renders: base stone first, then the highlight overlay on top.
   */
  _draw() {
    const { ctx, x, y } = this;
    const { frameWidth, frameHeight, highlightOpacity } = SHIMMER_CONFIG;

    // Clear only the mound area (or full canvas if needed)
    ctx.clearRect(x, y, frameWidth, frameHeight);

    for (const layer of this.layers) {
      // 1. Draw the base stone layer
      ctx.globalAlpha = 1.0;
      ctx.drawImage(layer.baseImg, x, y, frameWidth, frameHeight);

      // 2. Draw the highlight overlay at the current animation frame
      // Highlight sheets are horizontal strip sprite sheets (frame 0 = leftmost)
      const srcX = layer.currentFrame * frameWidth;
      const srcY = 0;

      // Fade opacity: peak shimmer at mid-cycle, fade in/out at edges
      const progress = layer.currentFrame / (SHIMMER_CONFIG.totalFrames - 1);
      const shimmerAlpha = highlightOpacity * Math.sin(progress * Math.PI); // smooth bell curve fade

      ctx.globalAlpha = layer.inDelay ? 0 : shimmerAlpha;
      ctx.drawImage(
        layer.highlightImg,
        srcX, srcY, frameWidth, frameHeight, // source rect from sprite sheet
        x, y, frameWidth, frameHeight         // destination on canvas
      );
    }

    // Reset alpha so other canvas elements are unaffected
    ctx.globalAlpha = 1.0;
  }

  /**
   * Updates the mound's position on the canvas.
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
}
