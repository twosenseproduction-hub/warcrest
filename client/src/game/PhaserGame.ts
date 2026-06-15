import Phaser from 'phaser';
import MainScene from './scenes/MainScene';

export function createPhaserGame(containerId: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: containerId,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1a2e',
    scene: [MainScene],
    input: {
      mouse: false,
      touch: {
        capture: true,
      },
      activePointers: 3,
      windowEvents: true,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    disableContextMenu: true,
  };

  return new Phaser.Game(config);
}

export function destroyPhaserGame(game: Phaser.Game): void {
  game.destroy(true);
}
