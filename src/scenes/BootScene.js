/* ============================================================================
 * WARCREST — BootScene
 * First scene Phaser runs. Keep it tiny: any pre-preload setup goes here, then
 * hand straight off to PreloadScene which loads the game's Phaser assets.
 * ==========================================================================*/
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // Crisp pixel-art scaling for the tiny-swords tilesets/sprites.
    this.scene.start('Preload');
  }
}
