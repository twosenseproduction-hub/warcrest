/* ============================================================================
 * WARCREST — PreloadScene
 * Loads all Phaser-side assets (tilemap + tilesets, and going forward the
 * unit/building textures) into Phaser's cache BEFORE GameScene runs.
 *
 * NOTE: The existing RTS engine still loads its own raw Image assets via
 * RTS.Assets for the canvas renderer. Those are migrated into this scene
 * incrementally (Phase 3+). For now we own the terrain assets here so
 * GameScene.create() can assume they are ready.
 * ==========================================================================*/
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    // Simple text progress indicator (no extra art assets needed).
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, 'Loading…', {
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.load.on('progress', (p) => {
      label.setText('Loading… ' + Math.round(p * 100) + '%');
    });
    this.load.once('complete', () => label.destroy());

    // ── Terrain (Tiled map + tileset image) ───────────────────────────────
    this.load.image(
      'terrain-grass',
      'assets/tiny-swords/Terrain/Tileset/Tilemap_color1.png'
    );
    this.load.tilemapTiledJSON('sapphire', 'assets/maps/sapphire-shores.tmj');
    this.load.tilemapTiledJSON('turtle_cove', 'assets/maps/turtle-cove.tmj');
    this.load.tilemapTiledJSON('runic_clearing', 'assets/maps/runic-clearing.tmj');
    this.load.tilemapTiledJSON('fairy_clearing', 'assets/maps/fairy-clearing.tmj?v=20260625b');
  }

  create() {
    this.scene.start('GameScene');
  }
}
