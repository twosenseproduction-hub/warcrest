import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { CSSProperties, JSX } from 'react';
import { GameEvents } from '../game/events/GameEvents';
import { createPhaserGame, destroyPhaserGame } from '../game/PhaserGame';
import type MainScene from '../game/scenes/MainScene';

type GameCanvasProps = {
  onReady?: (scene: MainScene) => void;
};

const containerStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  zIndex: 0,
  overflow: 'hidden',
  touchAction: 'none',
} satisfies CSSProperties;

export default function GameCanvas({ onReady }: GameCanvasProps): JSX.Element {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const handleSceneReady = (scene: MainScene): void => {
      onReady?.(scene);
    };

    GameEvents.once('scene-ready', handleSceneReady);
    const game = createPhaserGame('phaser-container');
    gameRef.current = game;

    return () => {
      GameEvents.off('scene-ready', handleSceneReady);
      destroyPhaserGame(game);
      gameRef.current = null;
    };
  }, [onReady]);

  return <div id="phaser-container" style={containerStyle} aria-label="Game canvas" />;
}
