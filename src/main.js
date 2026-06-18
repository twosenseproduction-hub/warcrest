import { GameScene } from './scenes/GameScene.js';

const config = {
  type: Phaser.CANVAS,
  // Reuse the existing #game canvas so RTS input and CSS sizing keep working
  canvas: document.getElementById('game'),
  backgroundColor: '#4caf50',
  scale: {
    // Let existing CSS + RTS.Render.resize() control canvas sizing
    mode: Phaser.Scale.NONE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  // Disable Phaser's input — input.js handles all pointer/touch events
  input: {
    keyboard: false,
    mouse: false,
    touch: false,
    gamepad: false,
  },
  scene: [GameScene],
};

new Phaser.Game(config);
