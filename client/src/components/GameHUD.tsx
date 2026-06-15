import type { CSSProperties, JSX } from 'react';

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

export default function GameHUD(): JSX.Element {
  return (
    <div style={wrapperStyle} aria-label="Game HUD">
      <div style={{ ...cornerPanelStyle, top: 16, left: 16 }}>
        <div style={resourceRowStyle}>
          <span>⚱️ Gold: 500</span>
          <span>🪵 Wood: 200</span>
        </div>
      </div>

      <div style={{ ...cornerPanelStyle, top: 16, right: 16, padding: 6 }}>
        <div style={minimapStyle}>MINIMAP</div>
      </div>

      <div style={actionBarStyle} aria-label="Action bar">
        {Array.from({ length: 6 }, (_, index) => (
          <button key={index} type="button" style={slotStyle} aria-label={`Ability slot ${index + 1}`}>
            {index + 1}
          </button>
        ))}
      </div>

      <div style={{ position: 'fixed', left: 16, bottom: 24 }}>
        <div style={heroPortraitStyle}>HERO</div>
      </div>
    </div>
  );
}
