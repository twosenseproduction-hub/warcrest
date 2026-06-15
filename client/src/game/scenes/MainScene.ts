import Phaser from 'phaser';
import { MAP_CONFIG, type TilePosition } from '../data/mapConfig';
import { GameEvents } from '../events/GameEvents';
import { gameState, type Building, type Unit } from '../state/GameState';
import { FogOfWar, type FogState } from '../systems/FogOfWar';
import type { BuildingType } from '../data/buildings';
import type { FactionId, UnitType } from '../data/units';

const TILE_WIDTH = MAP_CONFIG.isoTileWidth;
const TILE_HEIGHT = MAP_CONFIG.isoTileHeight;
const MIN_TAP_TARGET_RADIUS = 24;
const TICK_INTERVAL_MS = 2_000;
const TREE_TRUNK_TEXTURE = 'placeholder-tree-trunk';
const TREE_CANOPY_TEXTURE = 'placeholder-tree-canopy';
const CANOPY_DEPTH = 9_999;
const MAP_DEPTH = -1;
const FOG_DEPTH = 0;
const LONG_PRESS_MS = 450;
const LEGACY_ASSET_BASE = '/legacy-game/assets';
const UNIT_SPRITE_BASE = `${LEGACY_ASSET_BASE}/tiny-swords`;
const ENEMY_SPRITE_BASE = `${LEGACY_ASSET_BASE}/tiny-swords-enemy`;
const RAIDER_BUILDING_BASE = `${LEGACY_ASSET_BASE}/raider`;
const KINGDOM_BUILDING_BASE = `${LEGACY_ASSET_BASE}/tiny-swords`;
const KINGDOM_CUSTOM_BASE = `${LEGACY_ASSET_BASE}/kingdom`;

type UnitAnimationKey = 'idle' | 'run';

type UnitView = {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Sprite;
  healthBar: Phaser.GameObjects.Graphics;
};

type BuildingView = {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  healthBar: Phaser.GameObjects.Graphics;
};

type ResourceView = {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  stones: Phaser.GameObjects.Image[];
  label: Phaser.GameObjects.Text;
};

type UnitSpriteDefinition = {
  idlePath: string;
  runPath: string;
  frameSize: number;
  frameCount: {
    idle: number;
    run: number;
  };
  drawHeight: number;
  footRatio: number;
};

type BuildingSpriteDefinition = {
  path: string;
  width: number;
  height: number;
  footRatio: number;
};

const UNIT_SPRITES: Record<FactionId, Record<UnitType, UnitSpriteDefinition>> = {
  aurex: {
    pawn: {
      idlePath: `${UNIT_SPRITE_BASE}/Units/Blue%20Units/Pawn/Pawn_Idle%20Pickaxe.png`,
      runPath: `${UNIT_SPRITE_BASE}/Units/Blue%20Units/Pawn/Pawn_Run%20Pickaxe.png`,
      frameSize: 192,
      frameCount: { idle: 8, run: 6 },
      drawHeight: 64,
      footRatio: 0.698,
    },
    lancer: {
      idlePath: `${UNIT_SPRITE_BASE}/Units/Blue%20Units/Lancer/Lancer_Idle.png`,
      runPath: `${UNIT_SPRITE_BASE}/Units/Blue%20Units/Lancer/Lancer_Run.png`,
      frameSize: 320,
      frameCount: { idle: 12, run: 6 },
      drawHeight: 72,
      footRatio: 0.616,
    },
    archer: {
      idlePath: `${UNIT_SPRITE_BASE}/Units/Blue%20Units/Archer/Archer_Idle.png`,
      runPath: `${UNIT_SPRITE_BASE}/Units/Blue%20Units/Archer/Archer_Run.png`,
      frameSize: 192,
      frameCount: { idle: 6, run: 4 },
      drawHeight: 64,
      footRatio: 0.703,
    },
    monk: {
      idlePath: `${UNIT_SPRITE_BASE}/Units/Blue%20Units/Monk/Idle.png`,
      runPath: `${UNIT_SPRITE_BASE}/Units/Blue%20Units/Monk/Run.png`,
      frameSize: 192,
      frameCount: { idle: 6, run: 4 },
      drawHeight: 64,
      footRatio: 0.693,
    },
    warrior: {
      idlePath: `${UNIT_SPRITE_BASE}/Units/Blue%20Units/Warrior/Warrior_Idle.png`,
      runPath: `${UNIT_SPRITE_BASE}/Units/Blue%20Units/Warrior/Warrior_Run.png`,
      frameSize: 192,
      frameCount: { idle: 8, run: 6 },
      drawHeight: 74,
      footRatio: 0.708,
    },
  },
  cinder: {
    pawn: {
      idlePath: `${ENEMY_SPRITE_BASE}/Enemies/Gnome/Gnome_Idle.png`,
      runPath: `${ENEMY_SPRITE_BASE}/Enemies/Gnome/Gnome_Run.png`,
      frameSize: 192,
      frameCount: { idle: 8, run: 6 },
      drawHeight: 64,
      footRatio: 0.698,
    },
    lancer: {
      idlePath: `${ENEMY_SPRITE_BASE}/Enemies/Goblin%20Raiders/Spear%20Goblin/Spear%20Goblin_Idle.png`,
      runPath: `${ENEMY_SPRITE_BASE}/Enemies/Goblin%20Raiders/Spear%20Goblin/Spear%20Goblin_Run.png`,
      frameSize: 256,
      frameCount: { idle: 8, run: 6 },
      drawHeight: 72,
      footRatio: 0.616,
    },
    archer: {
      idlePath: `${ENEMY_SPRITE_BASE}/Enemies/Gnoll/Gnoll_Idle.png`,
      runPath: `${ENEMY_SPRITE_BASE}/Enemies/Gnoll/Gnoll_Walk.png`,
      frameSize: 192,
      frameCount: { idle: 6, run: 8 },
      drawHeight: 64,
      footRatio: 0.703,
    },
    monk: {
      idlePath: `${ENEMY_SPRITE_BASE}/Enemies/Goblin%20Raiders/Hex%20Shaman/Hex%20Shaman_Idle.png`,
      runPath: `${ENEMY_SPRITE_BASE}/Enemies/Goblin%20Raiders/Hex%20Shaman/Hex%20Shaman_Run.png`,
      frameSize: 192,
      frameCount: { idle: 8, run: 4 },
      drawHeight: 64,
      footRatio: 0.693,
    },
    warrior: {
      idlePath: `${ENEMY_SPRITE_BASE}/Enemies/Troll/Troll_Idle.png`,
      runPath: `${ENEMY_SPRITE_BASE}/Enemies/Troll/Troll_Walk.png`,
      frameSize: 384,
      frameCount: { idle: 12, run: 10 },
      drawHeight: 74,
      footRatio: 0.708,
    },
  },
};

const BUILDING_SPRITES: Record<FactionId, Record<BuildingType, BuildingSpriteDefinition>> = {
  aurex: {
    core: {
      path: `${KINGDOM_BUILDING_BASE}/Buildings/Blue%20Buildings/Castle.png`,
      width: 256,
      height: 192,
      footRatio: 0.96,
    },
    outpost: {
      path: `${KINGDOM_BUILDING_BASE}/Buildings/Blue%20Buildings/House1.png`,
      width: 128,
      height: 128,
      footRatio: 0.95,
    },
    conduit: {
      path: `${KINGDOM_CUSTOM_BASE}/Shepherds_Hut.png`,
      width: 176,
      height: 144,
      footRatio: 0.94,
    },
    foundry: {
      path: `${KINGDOM_BUILDING_BASE}/Buildings/Blue%20Buildings/Barracks.png`,
      width: 160,
      height: 128,
      footRatio: 0.95,
    },
    forge: {
      path: `${KINGDOM_BUILDING_BASE}/Buildings/Blue%20Buildings/Archery.png`,
      width: 176,
      height: 144,
      footRatio: 0.95,
    },
    turret: {
      path: `${KINGDOM_BUILDING_BASE}/Buildings/Blue%20Buildings/Tower.png`,
      width: 56,
      height: 96,
      footRatio: 0.9,
    },
  },
  cinder: {
    core: {
      path: `${RAIDER_BUILDING_BASE}/Warren_Maw.png`,
      width: 256,
      height: 192,
      footRatio: 0.96,
    },
    outpost: {
      path: `${KINGDOM_BUILDING_BASE}/Buildings/Red%20Buildings/House1.png`,
      width: 128,
      height: 128,
      footRatio: 0.95,
    },
    conduit: {
      path: `${RAIDER_BUILDING_BASE}/Pig_Sty.png`,
      width: 176,
      height: 144,
      footRatio: 0.94,
    },
    foundry: {
      path: `${RAIDER_BUILDING_BASE}/War_Pit.png`,
      width: 160,
      height: 128,
      footRatio: 0.95,
    },
    forge: {
      path: `${KINGDOM_BUILDING_BASE}/Buildings/Red%20Buildings/Archery.png`,
      width: 176,
      height: 144,
      footRatio: 0.95,
    },
    turret: {
      path: `${KINGDOM_BUILDING_BASE}/Buildings/Red%20Buildings/Tower.png`,
      width: 56,
      height: 96,
      footRatio: 0.9,
    },
  },
};

const GOLD_STONE_PATHS = [
  `${UNIT_SPRITE_BASE}/Terrain/Resources/Gold/Gold%20Stones/Gold%20Stone%201.png`,
  `${UNIT_SPRITE_BASE}/Terrain/Resources/Gold/Gold%20Stones/Gold%20Stone%202.png`,
  `${UNIT_SPRITE_BASE}/Terrain/Resources/Gold/Gold%20Stones/Gold%20Stone%203.png`,
];

type TreeParts = {
  trunk: Phaser.GameObjects.Sprite;
  canopy: Phaser.GameObjects.Sprite;
};

export default class MainScene extends Phaser.Scene {
  private readonly fogSystem = new FogOfWar(MAP_CONFIG.mapWidth, MAP_CONFIG.mapHeight);
  private unitViews = new Map<string, UnitView>();
  private buildingViews = new Map<string, BuildingView>();
  private resourceViews = new Map<string, ResourceView>();
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

  preload(): void {
    for (const faction of Object.keys(UNIT_SPRITES) as FactionId[]) {
      for (const unitType of Object.keys(UNIT_SPRITES[faction]) as UnitType[]) {
        const definition = UNIT_SPRITES[faction][unitType];

        this.load.spritesheet(this.unitTextureKey(faction, unitType, 'idle'), definition.idlePath, {
          frameWidth: definition.frameSize,
          frameHeight: definition.frameSize,
        });
        this.load.spritesheet(this.unitTextureKey(faction, unitType, 'run'), definition.runPath, {
          frameWidth: definition.frameSize,
          frameHeight: definition.frameSize,
        });
      }
    }

    for (const faction of Object.keys(BUILDING_SPRITES) as FactionId[]) {
      for (const buildingType of Object.keys(BUILDING_SPRITES[faction]) as BuildingType[]) {
        this.load.image(this.buildingTextureKey(faction, buildingType), BUILDING_SPRITES[faction][buildingType].path);
      }
    }

    GOLD_STONE_PATHS.forEach((path, index) => {
      this.load.image(this.goldTextureKey(index), path);
    });
  }

  create(): void {
    this.input.setPollAlways();
    this.input.setDefaultCursor('pointer');

    this.createPlaceholderTextures();
    this.createUnitAnimations();
    this.drawIsometricGrid();
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

  }

  private createUnitAnimations(): void {
    for (const faction of Object.keys(UNIT_SPRITES) as FactionId[]) {
      for (const unitType of Object.keys(UNIT_SPRITES[faction]) as UnitType[]) {
        const definition = UNIT_SPRITES[faction][unitType];

        this.createAnimationIfMissing(
          this.unitAnimationKey(faction, unitType, 'idle'),
          this.unitTextureKey(faction, unitType, 'idle'),
          definition.frameCount.idle,
          6,
          -1,
        );
        this.createAnimationIfMissing(
          this.unitAnimationKey(faction, unitType, 'run'),
          this.unitTextureKey(faction, unitType, 'run'),
          definition.frameCount.run,
          10,
          -1,
        );
      }
    }
  }

  private createAnimationIfMissing(
    key: string,
    textureKey: string,
    frameCount: number,
    frameRate: number,
    repeat: number,
  ): void {
    if (this.anims.exists(key)) return;

    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(textureKey, {
        start: 0,
        end: frameCount - 1,
      }),
      frameRate,
      repeat,
    });
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
    this.renderResources();
    this.renderBuildings();
    this.renderUnits();
    this.renderSelection();
  }

  private renderResources(): void {
    for (const resource of gameState.resourceNodes) {
      const position = this.tileToScreen(resource);
      const view = this.ensureResourceView(resource.id);

      view.container.setPosition(position.x, position.y + 8);
      view.container.setDepth(position.y + 1);
      view.label.setText(String(Math.ceil(resource.amount)));
    }

    for (const [id, view] of this.resourceViews) {
      if (!gameState.resourceNodes.some((resource) => resource.id === id)) {
        view.container.destroy(true);
        this.resourceViews.delete(id);
      }
    }
  }

  private ensureResourceView(id: string): ResourceView {
    const existing = this.resourceViews.get(id);

    if (existing) return existing;

    const shadow = this.add.ellipse(0, 6, 70, 32, 0x000000, 0.3);
    const stones = [
      this.add.image(0, -16, this.goldTextureKey(0)).setDisplaySize(58, 48),
      this.add.image(-24, -6, this.goldTextureKey(1)).setDisplaySize(36, 31),
      this.add.image(24, -6, this.goldTextureKey(2)).setDisplaySize(34, 30),
    ];
    const label = this.add.text(24, -48, '', {
      color: '#ffe0a0',
      fontFamily: 'Fredoka, system-ui',
      fontSize: '9px',
      fontStyle: '600',
      stroke: 'rgba(18, 14, 10, 0.55)',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);
    const container = this.add.container(0, 0, [shadow, ...stones, label]);

    this.resourceViews.set(id, { container, shadow, stones, label });

    return { container, shadow, stones, label };
  }

  private renderBuildings(): void {
    for (const building of gameState.buildings.values()) {
      const view = this.ensureBuildingView(building);
      const position = this.tileToScreen(building);

      view.container.setPosition(position.x, position.y);
      view.container.setDepth(position.y);
      this.drawHealthBar(view.healthBar, -42, -108, 84, building.hp / building.maxHp, 0x66bb6a);
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

    const definition = BUILDING_SPRITES[building.faction][building.type];
    const shadow = this.add.ellipse(0, 4, Math.max(definition.width, definition.height), 42, 0x000000, 0.36);
    const sprite = this.add
      .image(0, 0, this.buildingTextureKey(building.faction, building.type))
      .setOrigin(0.5, definition.footRatio)
      .setDisplaySize(definition.width, definition.height);
    const healthBar = this.add.graphics();
    const container = this.add.container(0, 0, [shadow, sprite, healthBar]);

    container.setSize(96, 80);
    this.buildingViews.set(building.id, { container, shadow, sprite, healthBar });

    return { container, shadow, sprite, healthBar };
  }

  private renderUnits(): void {
    for (const unit of gameState.units.values()) {
      const view = this.ensureUnitView(unit);
      const position = this.tileToScreen(unit);
      const moving = Boolean(unit.targetTile);
      const animationKey = this.unitAnimationKey(unit.faction, unit.type, moving ? 'run' : 'idle');

      view.container.setPosition(position.x, position.y);
      view.container.setDepth(position.y);
      view.sprite.play(animationKey, true);
      this.drawHealthBar(view.healthBar, -18, -64, 36, unit.hp / unit.maxHp, 0x66bb6a);

      if (unit.targetTile) {
        view.sprite.setFlipX(unit.targetTile.tileX < unit.tileX);
      }
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

    const definition = UNIT_SPRITES[unit.faction][unit.type];
    const textureKey = this.unitTextureKey(unit.faction, unit.type, 'idle');
    const shadow = this.add.ellipse(0, 3, 34, 12, 0x000000, 0.32);
    const sprite = this.add
      .sprite(0, 0, textureKey, 0)
      .setOrigin(0.5, definition.footRatio)
      .setDisplaySize(definition.drawHeight, definition.drawHeight);
    const healthBar = this.add.graphics();
    const container = this.add.container(0, 0, [shadow, sprite, healthBar]);

    container.setSize(48, 48);
    container.setInteractive({
      hitArea: new Phaser.Geom.Circle(0, -8, MIN_TAP_TARGET_RADIUS),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: false,
    });
    this.unitViews.set(unit.id, { container, shadow, sprite, healthBar });

    return { container, shadow, sprite, healthBar };
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

  private drawHealthBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    pct: number,
    fillColor: number,
  ): void {
    const clampedPct = Phaser.Math.Clamp(pct, 0, 1);

    graphics.clear();
    graphics.fillStyle(0x1a1208, 0.82);
    graphics.fillRoundedRect(x, y, width, 6, 2);
    graphics.fillStyle(fillColor, 0.95);
    graphics.fillRoundedRect(x + 1, y + 1, Math.max(0, (width - 2) * clampedPct), 4, 2);
    graphics.lineStyle(1, 0xffe0a0, 0.48);
    graphics.strokeRoundedRect(x, y, width, 6, 2);
  }

  private unitTextureKey(faction: FactionId, type: UnitType, animation: UnitAnimationKey): string {
    return `unit-${faction}-${type}-${animation}`;
  }

  private unitAnimationKey(faction: FactionId, type: UnitType, animation: UnitAnimationKey): string {
    return `anim-${faction}-${type}-${animation}`;
  }

  private buildingTextureKey(faction: FactionId, type: BuildingType): string {
    return `building-${faction}-${type}`;
  }

  private goldTextureKey(index: number): string {
    return `gold-stone-${index}`;
  }
}
