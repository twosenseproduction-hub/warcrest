import Phaser from 'phaser';
import { GameEvents } from '../events/GameEvents';
import { FogOfWar, type FogState } from '../systems/FogOfWar';

const GRID_SIZE = 20;
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const UNIT_RADIUS = 16;
const UNIT_VISION_RADIUS = 4;
const MIN_TAP_TARGET_RADIUS = 24;
const TICK_INTERVAL_MS = 2_000;
const TREE_TRUNK_TEXTURE = 'placeholder-tree-trunk';
const TREE_CANOPY_TEXTURE = 'placeholder-tree-canopy';
const BUILDING_TEXTURE = 'placeholder-building';
const CANOPY_DEPTH = 9_999;
const MAP_DEPTH = -1;
const FOG_DEPTH = 0;

type TreeParts = {
  trunk: Phaser.GameObjects.Sprite;
  canopy: Phaser.GameObjects.Sprite;
};

export default class MainScene extends Phaser.Scene {
  private readonly fogSystem = new FogOfWar(GRID_SIZE, GRID_SIZE);
  private unit?: Phaser.GameObjects.Arc;
  private building?: Phaser.GameObjects.Sprite;
  private fogGraphics?: Phaser.GameObjects.Graphics;
  private trees: TreeParts[] = [];
  private fogEnabled = true;
  private draggingUnit = false;
  private lastTickLog = 0;

  constructor() {
    super({ key: 'MainScene' });
  }

  create(): void {
    this.input.setPollAlways();
    this.input.setDefaultCursor('pointer');

    this.createPlaceholderTextures();
    this.drawIsometricGrid();
    this.createFogLayer();
    this.createPlaceholderBuilding();
    this.createLayeredTrees();
    this.createPlaceholderUnit();
    this.registerPointerEvents();
    this.registerGameEvents();
    this.updateFogVision();
    this.renderFog();
    this.children.depthSort();

    GameEvents.emit('scene-ready', this);
    this.game.events.emit('scene-ready', this);
  }

  update(time: number, _delta: number): void {
    this.updateFogVision();
    this.renderFog();
    this.sys.displayList.depthSort();

    if (time - this.lastTickLog >= TICK_INTERVAL_MS) {
      console.log('tick');
      this.lastTickLog = time;
    }
  }

  private createPlaceholderTextures(): void {
    if (!this.textures.exists(TREE_TRUNK_TEXTURE)) {
      const trunk = this.add.graphics();
      trunk.fillStyle(0x5c3a21, 1);
      trunk.fillRoundedRect(14, 4, 20, 48, 7);
      trunk.fillStyle(0x7a4f2a, 1);
      trunk.fillRoundedRect(22, 8, 8, 40, 4);
      trunk.generateTexture(TREE_TRUNK_TEXTURE, 48, 56);
      trunk.destroy();
    }

    if (!this.textures.exists(TREE_CANOPY_TEXTURE)) {
      const canopy = this.add.graphics();
      canopy.fillStyle(0x173f2a, 1);
      canopy.fillCircle(48, 34, 30);
      canopy.fillCircle(28, 38, 22);
      canopy.fillCircle(68, 40, 24);
      canopy.fillStyle(0x245f3a, 0.95);
      canopy.fillCircle(46, 28, 22);
      canopy.generateTexture(TREE_CANOPY_TEXTURE, 96, 72);
      canopy.destroy();
    }

    if (!this.textures.exists(BUILDING_TEXTURE)) {
      const building = this.add.graphics();
      building.fillStyle(0x2a3442, 1);
      building.fillRoundedRect(8, 28, 80, 48, 6);
      building.fillStyle(0x44546a, 1);
      building.fillTriangle(4, 30, 48, 4, 92, 30);
      building.lineStyle(2, 0xd1a53a, 0.9);
      building.strokeRoundedRect(8, 28, 80, 48, 6);
      building.generateTexture(BUILDING_TEXTURE, 96, 80);
      building.destroy();
    }
  }

  private drawIsometricGrid(): void {
    const graphics = this.add.graphics();
    graphics.setDepth(MAP_DEPTH);
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

  private createFogLayer(): void {
    this.fogGraphics = this.add.graphics();
    this.fogGraphics.setDepth(FOG_DEPTH);
  }

  private createPlaceholderBuilding(): void {
    const position = this.tileToScreen(9, 11);

    this.building = this.add
      .sprite(position.x, position.y + 14, BUILDING_TEXTURE)
      .setOrigin(0.5, 1);
    this.building.setDepth(this.building.y);
  }

  private createLayeredTrees(): void {
    const treeTiles = [
      { row: 8, col: 10 },
      { row: 9, col: 12 },
      { row: 11, col: 10 },
      { row: 10, col: 13 },
    ];

    this.trees = treeTiles.map(({ row, col }) => {
      const position = this.tileToScreen(row, col);
      const trunk = this.add
        .sprite(position.x, position.y + 14, TREE_TRUNK_TEXTURE)
        .setOrigin(0.5, 1);
      const canopy = this.add
        .sprite(position.x, position.y - 22, TREE_CANOPY_TEXTURE)
        .setOrigin(0.5, 0.72);

      trunk.setDepth(trunk.y);
      canopy.setDepth(CANOPY_DEPTH);

      return { trunk, canopy };
    });
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
    this.unit.setDepth(this.unit.y);
  }

  private registerGameEvents(): void {
    GameEvents.on('fog-toggle', this.handleFogToggle, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameEvents.off('fog-toggle', this.handleFogToggle, this);
    });
  }

  private registerPointerEvents(): void {
    if (!this.unit) return;

    this.unit.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.draggingUnit = true;
      this.unit?.setPosition(pointer.worldX, pointer.worldY);
      this.unit?.setDepth(pointer.worldY);
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.draggingUnit || !this.unit || !pointer.isDown) return;
      this.unit.setPosition(pointer.worldX, pointer.worldY);
      this.unit.setDepth(this.unit.y);
    });

    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.draggingUnit = false;
    });

    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => {
      this.draggingUnit = false;
    });
  }

  private handleFogToggle(): void {
    this.fogEnabled = !this.fogEnabled;

    if (!this.fogEnabled) {
      this.fogGraphics?.clear();
    }
  }

  private updateFogVision(): void {
    if (!this.unit) return;

    const unitTile = this.screenToTile(this.unit.x, this.unit.y);

    this.fogSystem.updateVision([
      {
        tileX: unitTile.tileX,
        tileY: unitTile.tileY,
        visionRadius: UNIT_VISION_RADIUS,
      },
    ]);
  }

  private renderFog(): void {
    if (!this.fogGraphics) return;

    this.fogGraphics.clear();

    if (!this.fogEnabled) return;

    for (let tileY = 0; tileY < GRID_SIZE; tileY += 1) {
      for (let tileX = 0; tileX < GRID_SIZE; tileX += 1) {
        const fogState = this.fogSystem.getState(tileX, tileY);

        if (fogState === 'visible') continue;

        this.drawFogTile(tileX, tileY, fogState);
      }
    }
  }

  private drawFogTile(tileX: number, tileY: number, fogState: Exclude<FogState, 'visible'>): void {
    if (!this.fogGraphics) return;

    const position = this.tileToScreen(tileY, tileX);
    const alpha = fogState === 'unexplored' ? 1 : 0.6;

    this.fogGraphics.fillStyle(0x000000, alpha);
    this.fogGraphics.beginPath();
    this.fogGraphics.moveTo(position.x, position.y - TILE_HEIGHT / 2);
    this.fogGraphics.lineTo(position.x + TILE_WIDTH / 2, position.y);
    this.fogGraphics.lineTo(position.x, position.y + TILE_HEIGHT / 2);
    this.fogGraphics.lineTo(position.x - TILE_WIDTH / 2, position.y);
    this.fogGraphics.closePath();
    this.fogGraphics.fillPath();
  }

  private tileToScreen(row: number, col: number): Phaser.Math.Vector2 {
    const originX = this.scale.width / 2;
    const originY = Math.max(96, this.scale.height * 0.16);
    const x = originX + (col - row) * (TILE_WIDTH / 2);
    const y = originY + (col + row) * (TILE_HEIGHT / 2);

    return new Phaser.Math.Vector2(x, y);
  }

  private screenToTile(x: number, y: number): { tileX: number; tileY: number } {
    const originX = this.scale.width / 2;
    const originY = Math.max(96, this.scale.height * 0.16);
    const colMinusRow = (x - originX) / (TILE_WIDTH / 2);
    const colPlusRow = (y - originY) / (TILE_HEIGHT / 2);
    const col = Math.round((colMinusRow + colPlusRow) / 2);
    const row = Math.round((colPlusRow - colMinusRow) / 2);

    return {
      tileX: Phaser.Math.Clamp(col, 0, GRID_SIZE - 1),
      tileY: Phaser.Math.Clamp(row, 0, GRID_SIZE - 1),
    };
  }
}
