import type { BuildingType } from './buildings';
import type { FactionId, UnitType } from './units';

export interface FactionDefinition {
  id: FactionId;
  name: string;
  color: string;
  units: UnitType[];
  buildings: BuildingType[];
}

const ALL_UNITS: UnitType[] = ['pawn', 'lancer', 'archer', 'monk', 'warrior'];
const ALL_BUILDINGS: BuildingType[] = ['core', 'outpost', 'conduit', 'foundry', 'forge', 'turret'];

export const FACTION_DEFINITIONS: FactionDefinition[] = [
  {
    id: 'aurex',
    name: 'Iron Crown',
    color: '#1565C0',
    units: ALL_UNITS,
    buildings: ALL_BUILDINGS,
  },
  {
    id: 'cinder',
    name: 'Raider Horde',
    color: '#558B2F',
    units: ALL_UNITS,
    buildings: ALL_BUILDINGS,
  },
];

export function getFactionDefinition(faction: FactionId): FactionDefinition {
  const definition = FACTION_DEFINITIONS.find((entry) => entry.id === faction);

  if (!definition) {
    throw new Error(`Missing faction definition for ${faction}`);
  }

  return definition;
}
