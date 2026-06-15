export type FactionId = 'aurex' | 'cinder';
export type UnitType = 'pawn' | 'lancer' | 'archer' | 'monk' | 'warrior';

export interface UnitCost {
  gold: number;
  wood: number;
}

export interface UnitDefinition {
  type: UnitType;
  name: string;
  hp: number;
  attack: number;
  speed: number;
  cost: UnitCost;
  visionRadius: number;
  faction: FactionId;
  range: number;
  supply: number;
  canHarvest?: boolean;
  canBuild?: boolean;
  healer?: boolean;
}

const BASE_UNITS: Omit<UnitDefinition, 'name' | 'faction'>[] = [
  {
    type: 'pawn',
    hp: 55,
    attack: 5,
    speed: 100,
    cost: { gold: 40, wood: 0 },
    visionRadius: 4,
    range: 22,
    supply: 1,
    canHarvest: true,
    canBuild: true,
  },
  {
    type: 'lancer',
    hp: 52,
    attack: 9,
    speed: 178,
    cost: { gold: 45, wood: 0 },
    visionRadius: 4,
    range: 78,
    supply: 1,
  },
  {
    type: 'archer',
    hp: 64,
    attack: 10,
    speed: 118,
    cost: { gold: 60, wood: 0 },
    visionRadius: 5,
    range: 132,
    supply: 1,
  },
  {
    type: 'monk',
    hp: 80,
    attack: 0,
    speed: 108,
    cost: { gold: 90, wood: 0 },
    visionRadius: 5,
    range: 110,
    supply: 2,
    healer: true,
  },
  {
    type: 'warrior',
    hp: 230,
    attack: 30,
    speed: 62,
    cost: { gold: 120, wood: 0 },
    visionRadius: 4,
    range: 46,
    supply: 3,
  },
];

const UNIT_NAMES: Record<FactionId, Record<UnitType, string>> = {
  aurex: {
    pawn: 'Pawn',
    lancer: 'Lancer',
    archer: 'Archer',
    monk: 'Monk',
    warrior: 'Warrior',
  },
  cinder: {
    pawn: 'Gnome',
    lancer: 'Spear Goblin',
    archer: 'Gnoll',
    monk: 'Hex Shaman',
    warrior: 'Troll',
  },
};

export const UNIT_DEFINITIONS: UnitDefinition[] = (['aurex', 'cinder'] satisfies FactionId[])
  .flatMap((faction) => (
    BASE_UNITS.map((unit) => ({
      ...unit,
      name: UNIT_NAMES[faction][unit.type],
      faction,
    }))
  ));

export function getUnitDefinition(faction: FactionId, type: UnitType): UnitDefinition {
  const definition = UNIT_DEFINITIONS.find((unit) => unit.faction === faction && unit.type === type);

  if (!definition) {
    throw new Error(`Missing unit definition for ${faction}:${type}`);
  }

  return definition;
}
