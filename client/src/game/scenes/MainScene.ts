import Phaser from 'phaser';
import { MAP_CONFIG, type TilePosition } from '../data/mapConfig';
import { GameEvents } from '../events/GameEvents';
import { gameState, type Building, type Unit } from '../state/GameState';
import { FogOfWar, type FogState } from '../systems/FogOfWar';

const TILE_WIDTH = MAP_CONFIG.isoTileWidth;
const TILE_HEIGHT = MAP_CONFIG.isoTileHeight;
const MIN_TAP_TARGET_RADIUS = 24;
const TICK_INTERVAL_MS = 2_000;
const TREE_TRUNK_TEXTURE = 'placeholder-tree-trunk';
const TREE_CANOPY_TEXTURE = 'placeholder-tree-canopy';
const BUILDING_TEXTURE = 'placeholder-building';
const CANOPY_DEPTH = 9_999;
const MAP_DEPTH = -1;
const FOG_DEPTH = 0;
const LONG_PRESS_MS = 450;

type UnitView = {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

type BuildingView = {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

type TreeParts = {
  trunk: Phaser.GameObjects.Sprite;
  canopy: Phaser.GameObjects.Sprite;
};

export default class MainScene extends Phaser.Scene {
  private readonly fogSystem = new FogOfWar(MAP_CONFIG.mapWidth, MAP_CONFIG.mapHeight);
  private unitViews = new Map<string, UnitView>();
  private buildingViews = new Map<string, BuildingView>();
  private resourceGraphics?: Phaser.GameObjects.Graphics;
  private fogGraphics?: Phaser.GameObjects.Graphics;
  private selectionGraphics?: Phaser.GameObjects.Graphics;
  private trees: TreeParts[] = [];
  private fogEnabled = true;
  private lastTickLog = 0;
  private longPressTimer: number | null = null;
  private longPressFired = false;
  private pointerDownTile: TilePosition | null = null;

  constructor() {
    super({ key: 'MainScene' });
  }

  create(): void {
    this.input.setPollAlways();
    this.input.setDefaultCursor('pointer');

    this.createPlaceholderTextures();
    this.drawIsometricGrid();
    this.createResourceLayer();
    this.createFogLayer();
    this.createSelectionLayer();
    this.createLayeredTrees();
    this.renderGameState();
    this.registerPointerEvents();
    this.registerGameEvents();
    this.updateFogVision();
    this.renderFog();
    this.children.depthSort();

    gameState.emitResourcesUpdated('player-1');
    GameEvents.emit('scene-ready', this);
    this.game.events.emit('scene-ready', this);
  }

  update(time: number, delta: number): void {
    gameState.tick(delta / 1_000);
    this.renderGameState();
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

    for (let row = 0; row < MAP_CONFIG.mapHeight; row += 1) {
      for (let col = 0; col < MAP_CONFIG.mapWidth; col += 1) {
        const { x, y } = this.tileToScreen({ tileX: col, tileY: row });
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

  private createResourceLayer(): void {
    this.resourceGraphics = this.add.graphics();
    this.resourceGraphics.setDepth(1);
    this.renderResources();
  }

  private createFogLayer(): void {
    this.fogGraphics = this.add.graphics();
    this.fogGraphics.setDepth(FOG_DEPTH);
  }

  private createSelectionLayer(): void {
    this.selectionGraphics = this.add.graphics();
    this.selectionGraphics.setDepth(CANOPY_DEPTH + 1);
  }

  private createLayeredTrees(): void {
    const treeTiles = [
      { row: 8, col: 10 },
      { row: 9, col: 12 },
      { row: 11, col: 10 },
      { row: 10, col: 13 },
    ];

    this.trees = treeTiles.map(({ row, col }) => {
      const position = this.tileToScreen({ tileX: col, tileY: row });
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

  private renderGameState(): void {
    this.renderBuildings();
    this.renderUnits();
    this.renderSelection();
  }

  private renderResources(): void {
    if (!this.resourceGraphics) return;

    this.resourceGraphics.clear();

    for (const resource of gameState.resourceNodes) {
      const position = this.tileToScreen(resource);

      this.resourceGraphics.fillStyle(0xb7d6ff, 0.95);
      this.resourceGraphics.fillCircle(position.x, position.y, 11);
      this.resourceGraphics.lineStyle(2, 0xffffff, 0.7);
      this.resourceGraphics.strokeCircle(position.x, position.y, 12);
    }
  }

  private renderBuildings(): void {
    for (const building of gameState.buildings.values()) {
      const view = this.ensureBuildingView(building);
      const position = this.tileToScreen(building);

      view.container.setPosition(position.x, position.y);
      view.container.setDepth(position.y);
      view.label.setText(building.name);
    }

    for (const [id, view] of this.buildingViews) {
      if (!gameState.buildings.has(id)) {
        view.container.destroy(true);
        this.buildingViews.delete(id);
      }
    }
  }

  private ensureBuildingView(building: Building): BuildingView {
    const existing = this.buildingViews.get(building.id);

    if (existing) return existing;

    const color = building.playerId === 'player-1' ? 0x244f9e : 0x7a2f2f;
    const body = this.add.rectangle(0, -18, 86, 48, color, 0.95)
      .setStrokeStyle(2, 0xd1a53a, 0.9);
    const roof = this.add.sprite(0, -36, BUILDING_TEXTURE).setScale(0.8);
    const label = this.add.text(0, -62, building.name, {
      color: '#FFD700',
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    const container = this.add.container(0, 0, [body, roof, label]);

    container.setSize(96, 80);
    this.buildingViews.set(building.id, { container, body, label });

    return { container, body, label };
  }

  private renderUnits(): void {
    for (const unit of gameState.units.values()) {
      const view = this.ensureUnitView(unit);
      const position = this.tileToScreen(unit);

      view.container.setPosition(position.x, position.y);
      view.container.setDepth(position.y);
      view.label.setText(unit.type);
    }

    for (const [id, view] of this.unitViews) {
      if (!gameState.units.has(id)) {
        view.container.destroy(true);
        this.unitViews.delete(id);
      }
    }
  }

  private ensureUnitView(unit: Unit): UnitView {
    const existing = this.unitViews.get(unit.id);

    if (existing) return existing;

    const color = unit.playerId === 'player-1' ? 0x4fc3f7 : 0xef5350;
    const body = this.add.rectangle(0, -16, 36, 36, color, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.75);
    const label = this.add.text(0, 14, unit.type, {
      color: '#ffffff',
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    const container = this.add.container(0, 0, [body, label]);

    container.setSize(48, 48);
    container.setInteractive({
      hitArea: new Phaser.Geom.Circle(0, -8, MIN_TAP_TARGET_RADIUS),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: false,
    });
    this.unitViews.set(unit.id, { container, body, label });

    return { container, body, label };
  }

  private renderSelection(): void {
    if (!this.selectionGraphics) return;

    this.selectionGraphics.clear();

    const selectedUnit = gameState.getSelectedUnit();

    if (!selectedUnit) return;

    const position = this.tileToScreen(selectedUnit);

    this.selectionGraphics.lineStyle(3, 0xffd700, 0.95);
    this.selectionGraphics.strokeCircle(position.x, position.y - 8, 24);
  }

  private registerGameEvents(): void {
    GameEvents.on('fog-toggle', this.handleFogToggle, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameEvents.off('fog-toggle', this.handleFogToggle, this);
    });
  }

  private registerPointerEvents(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const tile = this.screenToTile(pointer.worldX, pointer.worldY);

      this.longPressFired = false;
      this.pointerDownTile = tile;
      this.clearLongPressTimer();
      this.longPressTimer = window.setTimeout(() => {
        this.longPressFired = true;
        console.log(`context menu stub: tile ${tile.tileX},${tile.tileY}`);
      }, LONG_PRESS_MS);
    });

    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      this.clearLongPressTimer();

      if (this.longPressFired) return;

      const tile = this.screenToTile(pointer.worldX, pointer.worldY);
      const tappedUnit = this.findUnitAtTile(tile);

      if (tappedUnit && tappedUnit.playerId === 'player-1') {
        gameState.selectUnit(tappedUnit.id);
      } else {
        gameState.moveSelectedUnitToTile(tile);
      }

      this.pointerDownTile = null;
    });

    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => {
      this.clearLongPressTimer();
      this.pointerDownTile = null;
    });
  }

  private handleFogToggle(): void {
    this.fogEnabled = !this.fogEnabled;

    if (!this.fogEnabled) {
      this.fogGraphics?.clear();
    }
  }

  private updateFogVision(): void {
    this.fogSystem.updateVision(
      gameState.getUnitsForPlayer('player-1').map((unit) => ({
        tileX: Math.round(unit.tileX),
        tileY: Math.round(unit.tileY),
        visionRadius: unit.visionRadius,
      })),
    );
  }

  private renderFog(): void {
    if (!this.fogGraphics) return;

    this.fogGraphics.clear();

    if (!this.fogEnabled) return;

    for (let tileY = 0; tileY < MAP_CONFIG.mapHeight; tileY += 1) {
      for (let tileX = 0; tileX < MAP_CONFIG.mapWidth; tileX += 1) {
        const fogState = this.fogSystem.getState(tileX, tileY);

        if (fogState === 'visible') continue;

        this.drawFogTile(tileX, tileY, fogState);
      }
    }
  }

  private drawFogTile(tileX: number, tileY: number, fogState: Exclude<FogState, 'visible'>): void {
    if (!this.fogGraphics) return;

    const position = this.tileToScreen({ tileX, tileY });
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

  private tileToScreen(tile: TilePosition): Phaser.Math.Vector2 {
    const originX = this.scale.width / 2;
    const originY = Math.max(96, this.scale.height * 0.16);
    const x = originX + (tile.tileX - tile.tileY) * (TILE_WIDTH / 2);
    const y = originY + (tile.tileX + tile.tileY) * (TILE_HEIGHT / 2);

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
      tileX: Phaser.Math.Clamp(col, 0, MAP_CONFIG.mapWidth - 1),
      tileY: Phaser.Math.Clamp(row, 0, MAP_CONFIG.mapHeight - 1),
    };
  }

  private findUnitAtTile(tile: TilePosition): Unit | null {
    let bestUnit: Unit | null = null;
    let bestDistance = Infinity;

    for (const unit of gameState.units.values()) {
      const dx = unit.tileX - tile.tileX;
      const dy = unit.tileY - tile.tileY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= 0.75 && distance < bestDistance) {
        bestUnit = unit;
        bestDistance = distance;
      }
    }

    return bestUnit;
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer === null) return;

    window.clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }
}
