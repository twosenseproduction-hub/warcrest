/**
 * WorldCanvasLayer — Phaser display object for all in-world rendering.
 *
 * Replaces the postrender canvas hook: entities, fog, projectiles, effects,
 * selection rings, and build ghosts draw into a dynamic canvas texture that
 * Phaser composites above the tilemap. Visual parity is preserved because the
 * same RTS.Render.drawWorld / drawScreenFx paths are used.
 */
const TEXTURE_KEY = 'warcrest-world-overlay';
const LAYER_DEPTH = 1000;

export class WorldCanvasLayer {
  constructor(scene) {
    this.scene = scene;
    this.dpr = 1;
    this.image = null;
    this._ensureTexture();
    RTS._phaserWorldLayer = this;
  }

  _canvasSize() {
    const cv = this.scene.sys.game.canvas;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = cv.clientWidth || 1;
    const cssH = cv.clientHeight || 1;
    return {
      cssW,
      cssH,
      pxW: Math.max(1, Math.floor(cssW * this.dpr)),
      pxH: Math.max(1, Math.floor(cssH * this.dpr)),
    };
  }

  _ensureTexture() {
    const { cssW, cssH, pxW, pxH } = this._canvasSize();
    // Canvas is hidden on the menu — defer until it has layout size.
    if (cssW < 8 || cssH < 8) return false;

    const textures = this.scene.textures;

    if (!textures.exists(TEXTURE_KEY)) {
      textures.createCanvas(TEXTURE_KEY, pxW, pxH);
    } else {
      const tex = textures.get(TEXTURE_KEY);
      if (tex.getSourceImage().width !== pxW || tex.getSourceImage().height !== pxH) {
        tex.setSize(pxW, pxH);
      }
    }

    const tex = textures.get(TEXTURE_KEY);
    if (tex && typeof Phaser !== 'undefined' && Phaser.Textures && Phaser.Textures.FilterMode) {
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    if (!this.image) {
      this.image = this.scene.add
        .image(0, 0, TEXTURE_KEY)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(LAYER_DEPTH);
    }
    // Phaser game size is device pixels (see GameScene scale.resize). The image
    // must cover the full internal canvas — using CSS px here only fills a
    // corner on Retina and leaves tilemap + overlay misaligned.
    this.image.setDisplaySize(pxW, pxH);
    return true;
  }

  resize() {
    this._ensureTexture();
  }

  /**
   * Redraw the overlay from current game state. Call once per frame while in-game.
   */
  refresh(s) {
    if (!s) return;
    if (!this._ensureTexture() || !this.image) return;

    const { cssW, cssH, pxW, pxH } = this._canvasSize();
    if (!this._ensureTexture()) return;

    const tex = this.scene.textures.get(TEXTURE_KEY);
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, pxW, pxH);

    const opts = { width: cssW, height: cssH, dpr: this.dpr, onMainCanvas: false };
    if (RTS.Render.drawWorld) RTS.Render.drawWorld(s, ctx, opts);
    if (RTS.Render.drawScreenFx) RTS.Render.drawScreenFx(s, ctx, opts);

    tex.refresh();
  }

  destroy() {
    if (this.image) {
      this.image.destroy();
      this.image = null;
    }
    if (this.scene.textures.exists(TEXTURE_KEY)) {
      this.scene.textures.remove(TEXTURE_KEY);
    }
    if (RTS._phaserWorldLayer === this) RTS._phaserWorldLayer = null;
  }
}
