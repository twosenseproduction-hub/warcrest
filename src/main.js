import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js?v=20260626a';
import { GameScene } from './scenes/GameScene.js?v=20260626a';

const config = {
  type: Phaser.CANVAS,
  // Reuse the existing #game canvas so RTS input and CSS sizing keep working
  canvas: document.getElementById('game'),
  // Water shows through where the tilemap has no land tiles (matches the
  // Tiled map's backgroundcolor). Phaser clears to this each frame.
  backgroundColor: '#1a2a4a',
  scale: {
    // Let existing CSS + RTS.Render.resize() control canvas sizing
    mode: Phaser.Scale.NONE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  // Phaser owns terrain + entity overlay; RTS.Input still uses native pointer
  // events on the same #game canvas element.
  input: {
    keyboard: false,
    mouse: false,
    touch: false,
    gamepad: false,
  },
  // Boot -> Preload -> Game. Phaser auto-starts the first scene (Boot).
  scene: [BootScene, PreloadScene, GameScene],
};

window.__warcrestGame = new Phaser.Game(config);
