import { useEffect, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { GameEvents } from '../game/events/GameEvents';
import { gameState, type PlayerResources, type ResourcesUpdatedEvent } from '../game/state/GameState';

const gold = '#FFD700';
const panelBackground = 'rgba(10, 14, 22, 0.82)';
const border = `1px solid ${gold}`;
const fontFamily = '"Courier New", Courier, monospace';

const wrapperStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10,
  pointerEvents: 'none',
  color: gold,
  fontFamily,
  textShadow: '0 1px 2px #000',
};

const cornerPanelStyle: CSSProperties = {
  position: 'fixed',
  padding: '10px 12px',
  background: panelBackground,
  border,
  boxShadow: '0 0 12px rgba(0, 0, 0, 0.55)',
};

const resourceRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  fontWeight: 700,
  letterSpacing: '0.04em',
};

const minimapStyle: CSSProperties = {
  width: 80,
  height: 80,
  display: 'grid',
  placeItems: 'center',
  background: '#111820',
  border,
  color: gold,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
};

const actionBarStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 24,
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 8,
  padding: 10,
  background: panelBackground,
  border,
  boxShadow: '0 0 16px rgba(0, 0, 0, 0.65)',
};

const slotStyle: CSSProperties = {
  width: 48,
  height: 48,
  pointerEvents: 'auto',
  background: '#171d24',
  border,
  borderRadius: 6,
  color: gold,
  font: `700 12px ${fontFamily}`,
  touchAction: 'manipulation',
};

const heroPortraitStyle: CSSProperties = {
  width: 64,
  height: 64,
  display: 'grid',
  placeItems: 'center',
  background: panelBackground,
  border,
  fontWeight: 700,
  letterSpacing: '0.08em',
};

const heroTextStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  textAlign: 'center',
  fontSize: 10,
};

const fogToggleStyle: CSSProperties = {
  position: 'fixed',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  minWidth: 96,
  minHeight: 32,
  padding: '6px 14px',
  pointerEvents: 'auto',
  background: panelBackground,
  border,
  borderRadius: 999,
  color: gold,
  font: `700 12px ${fontFamily}`,
  letterSpacing: '0.08em',
  touchAction: 'manipulation',
};

export default function GameHUD(): JSX.Element {
  const [fogEnabled, setFogEnabled] = useState(true);
  const [resources, setResources] = useState<PlayerResources>(() => (
    gameState.getResourcesForPlayer('player-1')
  ));
  const [hero, setHero] = useState<ResourcesUpdatedEvent['hero']>(() => {
    const heroUnit = gameState.getUnitsForPlayer('player-1').find((unit) => unit.isHero);

    return heroUnit ? { name: heroUnit.name, level: heroUnit.level } : undefined;
  });

  useEffect(() => {
    const handleResourcesUpdated = (event: ResourcesUpdatedEvent): void => {
      if (event.playerId !== 'player-1') return;

      setResources(event.resources);
      setHero(event.hero);
    };

    GameEvents.on('resources-updated', handleResourcesUpdated);
    gameState.emitResourcesUpdated('player-1');

    return () => {
      GameEvents.off('resources-updated', handleResourcesUpdated);
    };
  }, []);

  const handleFogToggle = (): void => {
    setFogEnabled((enabled) => !enabled);
    GameEvents.emit('fog-toggle');
  };

  return (
    <div style={wrapperStyle} aria-label="Game HUD">
      <div style={{ ...cornerPanelStyle, top: 16, left: 16 }}>
        <div style={resourceRowStyle}>
          <span>⚱️ Gold: {Math.floor(resources.gold)}</span>
          <span>🪵 Wood: {Math.floor(resources.wood)}</span>
        </div>
      </div>

      <div style={{ ...cornerPanelStyle, top: 16, right: 16, padding: 6 }}>
        <div style={minimapStyle}>MINIMAP</div>
      </div>

      <button type="button" style={fogToggleStyle} onClick={handleFogToggle} aria-pressed={fogEnabled}>
        {fogEnabled ? 'FOG: ON' : 'FOG: OFF'}
      </button>

      <div style={actionBarStyle} aria-label="Action bar">
        {Array.from({ length: 6 }, (_, index) => (
          <button key={index} type="button" style={slotStyle} aria-label={`Ability slot ${index + 1}`}>
            {index + 1}
          </button>
        ))}
      </div>

      <div style={{ position: 'fixed', left: 16, bottom: 24 }}>
        <div style={heroPortraitStyle}>
          {hero ? (
            <span style={heroTextStyle}>
              <span>{hero.name}</span>
              <span>LVL {hero.level ?? 1}</span>
            </span>
          ) : 'HERO'}
        </div>
      </div>
    </div>
  );
}
