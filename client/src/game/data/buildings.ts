import type { FactionId, UnitType } from './units';

export type BuildingType = 'core' | 'outpost' | 'conduit' | 'foundry' | 'forge' | 'turret';

export interface BuildingCost {
  gold: number;
  wood: number;
}

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  hp: number;
  cost: BuildingCost;
  produces: UnitType[];
  faction: FactionId;
  width: number;
  height: number;
  buildTime: number;
  deposit?: boolean;
  defense?: boolean;
}

const BASE_BUILDINGS: Omit<BuildingDefinition, 'name' | 'faction'>[] = [
  {
    type: 'core',
    hp: 1600,
    cost: { gold: 0, wood: 0 },
    produces: ['pawn'],
    width: 256,
    height: 192,
    buildTime: 0,
    deposit: true,
  },
  {
    type: 'outpost',
    hp: 1400,
    cost: { gold: 320, wood: 0 },
    produces: ['pawn'],
    width: 128,
    height: 128,
    buildTime: 42,
    deposit: true,
  },
  {
    type: 'conduit',
    hp: 420,
    cost: { gold: 65, wood: 0 },
    produces: [],
    width: 192,
    height: 192,
    buildTime: 10,
  },
  {
    type: 'foundry',
    hp: 760,
    cost: { gold: 120, wood: 0 },
    produces: ['lancer', 'archer', 'monk'],
    width: 192,
    height: 128,
    buildTime: 18,
  },
  {
    type: 'forge',
    hp: 980,
    cost: { gold: 175, wood: 0 },
    produces: ['warrior'],
    width: 192,
    height: 192,
    buildTime: 26,
  },
  {
    type: 'turret',
    hp: 520,
    cost: { gold: 100, wood: 0 },
    produces: [],
    width: 64,
    height: 128,
    buildTime: 14,
    defense: true,
  },
];

const BUILDING_NAMES: Record<FactionId, Record<BuildingType, string>> = {
  aurex: {
    core: 'Citadel Keep',
    outpost: 'Forward Bastion',
    conduit: 'Sheep Pen',
    foundry: 'Barracks',
    forge: 'War Forge',
    turret: 'Arrow Tower',
  },
  cinder: {
    core: 'Warren Maw',
    outpost: 'Raider Camp',
    conduit: 'Pig Sty',
    foundry: 'War Pit',
    forge: 'Skull Forge',
    turret: 'Bone Spire',
  },
};

export const BUILDING_DEFINITIONS: BuildingDefinition[] = (['aurex', 'cinder'] satisfies FactionId[])
  .flatMap((faction) => (
    BASE_BUILDINGS.map((building) => ({
      ...building,
      name: BUILDING_NAMES[faction][building.type],
      faction,
    }))
  ));

export function getBuildingDefinition(faction: FactionId, type: BuildingType): BuildingDefinition {
  const definition = BUILDING_DEFINITIONS.find((building) => (
    building.faction === faction && building.type === type
  ));

  if (!definition) {
    throw new Error(`Missing building definition for ${faction}:${type}`);
  }

  return definition;
}
