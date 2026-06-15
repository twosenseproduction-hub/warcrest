import { getBuildingDefinition, type BuildingType } from '../data/buildings';
import { MAP_CONFIG, type TilePosition } from '../data/mapConfig';
import { getUnitDefinition, type FactionId, type UnitType } from '../data/units';
import { GameEvents } from '../events/GameEvents';

export interface Player {
  id: string;
  name: string;
  faction: FactionId;
}

export interface PlayerResources {
  gold: number;
  wood: number;
}

export interface Unit extends TilePosition {
  id: string;
  playerId: string;
  faction: FactionId;
  type: UnitType;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  visionRadius: number;
  targetTile?: TilePosition;
  level?: number;
  isHero?: boolean;
}

export interface Building extends TilePosition {
  id: string;
  playerId: string;
  faction: FactionId;
  type: BuildingType;
  name: string;
  hp: number;
  maxHp: number;
  produces: UnitType[];
}

export interface ResourceNode extends TilePosition {
  id: string;
  amount: number;
}

export interface ResourcesUpdatedEvent {
  playerId: string;
  resources: PlayerResources;
  hero?: Pick<Unit, 'name' | 'level'>;
}

export class GameState {
  units: Map<string, Unit>;
  buildings: Map<string, Building>;
  resources: Map<string, PlayerResources>;
  currentTick: number;
  players: Player[];
  resourceNodes: ResourceNode[];
  selectedUnitId: string | null;

  constructor(players: Player[]) {
    this.units = new Map();
    this.buildings = new Map();
    this.resources = new Map();
    this.currentTick = 0;
    this.players = players;
    this.resourceNodes = MAP_CONFIG.resources.map((resource) => ({
      id: resource.id,
      tileX: resource.tileX,
      tileY: resource.tileY,
      amount: resource.amount,
    }));
    this.selectedUnitId = null;

    for (const player of players) {
      this.resources.set(player.id, { gold: 280, wood: 0 });
    }
  }

  addUnit(unit: Unit): void {
    this.units.set(unit.id, unit);
  }

  removeUnit(id: string): void {
    this.units.delete(id);

    if (this.selectedUnitId === id) {
      this.selectedUnitId = null;
    }
  }

  addBuilding(building: Building): void {
    this.buildings.set(building.id, building);
  }

  removeBuilding(id: string): void {
    this.buildings.delete(id);
  }

  getUnitsForPlayer(playerId: string): Unit[] {
    return Array.from(this.units.values()).filter((unit) => unit.playerId === playerId);
  }

  tick(delta: number): void {
    this.currentTick += 1;

    for (const unit of this.units.values()) {
      this.advanceUnitMovement(unit, delta);
    }
  }

  getSelectedUnit(): Unit | null {
    return this.selectedUnitId ? this.units.get(this.selectedUnitId) ?? null : null;
  }

  selectUnit(id: string | null): void {
    this.selectedUnitId = id;
  }

  moveSelectedUnitToTile(tile: TilePosition): void {
    const unit = this.getSelectedUnit();

    if (!unit) return;

    unit.targetTile = {
      tileX: tile.tileX,
      tileY: tile.tileY,
    };
  }

  getResourcesForPlayer(playerId: string): PlayerResources {
    const resources = this.resources.get(playerId);

    if (!resources) {
      throw new Error(`Missing resources for player ${playerId}`);
    }

    return resources;
  }

  setResourcesForPlayer(playerId: string, resources: PlayerResources): void {
    this.resources.set(playerId, resources);
    this.emitResourcesUpdated(playerId);
  }

  emitResourcesUpdated(playerId: string): void {
    const hero = this.getUnitsForPlayer(playerId).find((unit) => unit.isHero);
    const event: ResourcesUpdatedEvent = {
      playerId,
      resources: this.getResourcesForPlayer(playerId),
      hero: hero ? { name: hero.name, level: hero.level } : undefined,
    };

    GameEvents.emit('resources-updated', event);
  }

  private advanceUnitMovement(unit: Unit, delta: number): void {
    if (!unit.targetTile) return;

    const dx = unit.targetTile.tileX - unit.tileX;
    const dy = unit.targetTile.tileY - unit.tileY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= 0.02) {
      unit.tileX = unit.targetTile.tileX;
      unit.tileY = unit.targetTile.tileY;
      unit.targetTile = undefined;
      return;
    }

    const tilesPerSecond = unit.speed / MAP_CONFIG.tileSize;
    const step = Math.min(distance, tilesPerSecond * delta);

    unit.tileX += (dx / distance) * step;
    unit.tileY += (dy / distance) * step;
  }
}

function createUnit(
  id: string,
  playerId: string,
  faction: FactionId,
  type: UnitType,
  tile: TilePosition,
  options: Pick<Unit, 'isHero' | 'level'> = {},
): Unit {
  const definition = getUnitDefinition(faction, type);

  return {
    id,
    playerId,
    faction,
    type,
    name: options.isHero ? `${definition.name} Captain` : definition.name,
    tileX: tile.tileX,
    tileY: tile.tileY,
    hp: definition.hp,
    maxHp: definition.hp,
    attack: definition.attack,
    speed: definition.speed,
    visionRadius: definition.visionRadius,
    isHero: options.isHero,
    level: options.level,
  };
}

function createBuilding(
  id: string,
  playerId: string,
  faction: FactionId,
  type: BuildingType,
  tile: TilePosition,
): Building {
  const definition = getBuildingDefinition(faction, type);

  return {
    id,
    playerId,
    faction,
    type,
    name: definition.name,
    tileX: tile.tileX,
    tileY: tile.tileY,
    hp: definition.hp,
    maxHp: definition.hp,
    produces: definition.produces,
  };
}

export function createInitialGameState(): GameState {
  const state = new GameState([
    { id: 'player-1', name: 'Player', faction: 'aurex' },
    { id: 'player-2', name: 'Enemy', faction: 'cinder' },
  ]);
  const playerStart = MAP_CONFIG.startingPositions[0];
  const enemyStart = MAP_CONFIG.startingPositions[1];

  state.addBuilding(createBuilding('b-player-core', 'player-1', 'aurex', 'core', playerStart));
  state.addBuilding(createBuilding('b-enemy-core', 'player-2', 'cinder', 'core', enemyStart));
  state.addBuilding(createBuilding('b-player-foundry', 'player-1', 'aurex', 'foundry', {
    tileX: playerStart.tileX + 3,
    tileY: playerStart.tileY + 2,
  }));
  state.addUnit(createUnit('u-player-hero', 'player-1', 'aurex', 'lancer', {
    tileX: playerStart.tileX + 1,
    tileY: playerStart.tileY + 1,
  }, { isHero: true, level: 1 }));
  state.addUnit(createUnit('u-player-pawn', 'player-1', 'aurex', 'pawn', {
    tileX: playerStart.tileX + 2,
    tileY: playerStart.tileY + 1,
  }));
  state.addUnit(createUnit('u-player-archer', 'player-1', 'aurex', 'archer', {
    tileX: playerStart.tileX + 1,
    tileY: playerStart.tileY + 3,
  }));
  state.addUnit(createUnit('u-enemy-lancer', 'player-2', 'cinder', 'lancer', {
    tileX: enemyStart.tileX - 1,
    tileY: enemyStart.tileY + 1,
  }));

  return state;
}

export const gameState = createInitialGameState();
