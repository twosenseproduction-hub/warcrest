import Phaser from 'phaser';

// Shared React <-> Phaser event bus.
// Current events: 'fog-toggle', 'scene-ready', 'resources-updated'.
export const GameEvents = new Phaser.Events.EventEmitter();
