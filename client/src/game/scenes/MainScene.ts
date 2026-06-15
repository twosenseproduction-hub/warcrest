import Phaser from 'phaser';

const GRID_SIZE = 20;
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const UNIT_RADIUS = 16;
const MIN_TAP_TARGET_RADIUS = 24;
const TICK_INTERVAL_MS = 2_000;

export default class MainScene extends Phaser.Scene {
  private unit?: Phaser.GameObjects.Arc;
  private draggingUnit = false;
  private lastTickLog = 0;

  constructor() {
    super({ key: 'MainScene' });
  }

  create(): void {
    this.input.setPollAlways();
    this.input.setDefaultCursor('pointer');

    this.drawIsometricGrid();
    this.createPlaceholderUnit();
    this.registerPointerEvents();

    this.game.events.emit('scene-ready', this);
  }

  update(time: number, _delta: number): void {
    if (time - this.lastTickLog >= TICK_INTERVAL_MS) {
      console.log('tick');
      this.lastTickLog = time;
    }
  }

  private drawIsometricGrid(): void {
    const graphics = this.add.graphics();
    const originX = this.scale.width / 2;
    const originY = Math.max(96, this.scale.height * 0.16);

    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const x = originX + (col - row) * (TILE_WIDTH / 2);
        const y = originY + (col + row) * (TILE_HEIGHT / 2);
        const fillColor = (row + col) % 2 === 0 ? 0x263a2e : 0x303a36;

        graphics.fillStyle(fillColor, 1);
        graphics.lineStyle(1, 0x45534a, 0.85);
        graphics.beginPath();
        graphics.moveTo(x, y - TILE_HEIGHT / 2);
        graphics.lineTo(x + TILE_WIDTH / 2, y);
        graphics.lineTo(x, y + TILE_HEIGHT / 2);
        graphics.lineTo(x - TILE_WIDTH / 2, y);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      }
    }
  }

  private createPlaceholderUnit(): void {
    const center = this.tileToScreen(Math.floor(GRID_SIZE / 2), Math.floor(GRID_SIZE / 2));

    this.unit = this.add
      .circle(center.x, center.y, UNIT_RADIUS, 0x4fc3f7)
      .setStrokeStyle(2, 0xb3e5fc)
      .setInteractive({
        hitArea: new Phaser.Geom.Circle(0, 0, MIN_TAP_TARGET_RADIUS),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        useHandCursor: false,
      });
  }

  private registerPointerEvents(): void {
    if (!this.unit) return;

    this.unit.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.draggingUnit = true;
      this.unit?.setPosition(pointer.worldX, pointer.worldY);
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.draggingUnit || !this.unit || !pointer.isDown) return;
      this.unit.setPosition(pointer.worldX, pointer.worldY);
    });

    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.draggingUnit = false;
    });

    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => {
      this.draggingUnit = false;
    });
  }

  private tileToScreen(row: number, col: number): Phaser.Math.Vector2 {
    const originX = this.scale.width / 2;
    const originY = Math.max(96, this.scale.height * 0.16);
    const x = originX + (col - row) * (TILE_WIDTH / 2);
    const y = originY + (col + row) * (TILE_HEIGHT / 2);

    return new Phaser.Math.Vector2(x, y);
  }
}
