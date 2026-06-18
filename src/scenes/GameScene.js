export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this._tilemapLayers = null;
  }

  preload() {
    this.load.image(
      'terrain-grass',
      'assets/tiny-swords/Terrain/Tileset/Tilemap_color1.png'
    );
    this.load.tilemapTiledJSON('sapphire', 'assets/maps/sapphire-shores.tmj');
  }

  create() {
    // Point RTS at Phaser's canvas and 2D context so render.js draws into it
    RTS.canvas = this.sys.game.canvas;
    RTS.ctx    = this.sys.game.context;

    // Boot game logic (wires HUD, input, menus)
    RTS.Game.boot();

    // Build Phaser tilemap from the exported Tiled JSON
    const map     = this.make.tilemap({ key: 'sapphire' });
    const tileset = map.addTilesetImage('terrain-grass', 'terrain-grass');

    if (tileset) {
      this._tilemapLayers = {
        ground:   map.createLayer('ground',   tileset, 0, 0),
        elevated: map.createLayer('elevated', tileset, 0, 0),
        cliffs:   map.createLayer('cliffs',   tileset, 0, 0),
      };
      // Water (GID 0 / empty tiles) shows as the map's backgroundcolor (#1a2a4a)
      // Tell the existing canvas renderer to skip terrain — Phaser handles it
      RTS._phaserTerrainActive = true;
    }

    // Bound Phaser camera to world size
    this.cameras.main.setBounds(0, 0, 48 * 64, 30 * 64);

    // After Phaser clears + renders tilemap, draw entities on top via canvas
    this.game.events.on('postrender', () => {
      const s = RTS.Game.state;
      if (!s) return;
      const inGame = s.scene === 'playing' || s.scene === 'paused'
                  || s.scene === 'won'     || s.scene === 'lost';
      if (inGame) {
        RTS.Render.frame(s);
        RTS.renderMinimap(s);
      }
    });
  }

  update(time, _delta) {
    // Sync Phaser camera to RTS camera so tilemap aligns with canvas entities
    const s = RTS.Game && RTS.Game.state;
    if (s && s.camera && this._tilemapLayers) {
      const cam = this.cameras.main;
      cam.scrollX = s.camera.x;
      cam.scrollY = s.camera.y;
      cam.zoom    = s.camera.zoom;
    }

    if (RTS.Game._step) {
      RTS.Game._step(time);
    }
  }
}
