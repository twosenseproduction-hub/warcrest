import type { FactionId } from './units';

export interface TilePosition {
  tileX: number;
  tileY: number;
}

export interface WorldPosition {
  x: number;
  y: number;
}

export interface StartingPosition extends TilePosition {
  playerId: string;
  faction: FactionId;
  world: WorldPosition;
}

export interface ResourceNodeConfig extends TilePosition {
  id: string;
  amount: number;
  world: WorldPosition;
}

export interface MapConfig {
  id: string;
  name: string;
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  isoTileWidth: number;
  isoTileHeight: number;
  worldWidth: number;
  worldHeight: number;
  startingPositions: StartingPosition[];
  resources: ResourceNodeConfig[];
}

const TILE_SIZE = 64;

function worldToTile(position: WorldPosition): TilePosition {
  return {
    tileX: Math.round(position.x / TILE_SIZE),
    tileY: Math.round(position.y / TILE_SIZE),
  };
}

const playerBase: WorldPosition = { x: 544, y: 330 };
const enemyBase: WorldPosition = { x: 2527, y: 330 };

const resourceWorldPositions: Array<Omit<ResourceNodeConfig, 'tileX' | 'tileY'>> = [
  { id: 'ironstone-home-player', world: { x: 395, y: 153 }, amount: 12_500 },
  { id: 'ironstone-expansion-player', world: { x: 523, y: 1298 }, amount: 5_000 },
  { id: 'ironstone-center-left', world: { x: 1487, y: 1266 }, amount: 5_000 },
  { id: 'ironstone-home-enemy', world: { x: 2676, y: 153 }, amount: 12_500 },
  { id: 'ironstone-expansion-enemy', world: { x: 2548, y: 1298 }, amount: 5_000 },
  { id: 'ironstone-center-right', world: { x: 1584, y: 1266 }, amount: 5_000 },
];

export const MAP_CONFIG: MapConfig = {
  id: 'sapphire_shores',
  name: 'Sapphire Shores',
  mapWidth: 48,
  mapHeight: 30,
  tileSize: TILE_SIZE,
  isoTileWidth: 64,
  isoTileHeight: 32,
  worldWidth: 3_072,
  worldHeight: 1_920,
  startingPositions: [
    {
      playerId: 'player-1',
      faction: 'aurex',
      world: playerBase,
      ...worldToTile(playerBase),
    },
    {
      playerId: 'player-2',
      faction: 'cinder',
      world: enemyBase,
      ...worldToTile(enemyBase),
    },
  ],
  resources: resourceWorldPositions.map((resource) => ({
    ...resource,
    ...worldToTile(resource.world),
  })),
};
