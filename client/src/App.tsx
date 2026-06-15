import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import GameCanvas from './components/GameCanvas';
import GameHUD from './components/GameHUD';
import type MainScene from './game/scenes/MainScene';

function isGameRoute(): boolean {
  const { hash, pathname } = window.location;

  return pathname === '/game' || pathname === '/game/' || hash === '#/game';
}

export default function App(): JSX.Element {
  const [gameReady, setGameReady] = useState(false);
  const handleReady = useCallback((_scene: MainScene) => {
    setGameReady(true);
  }, []);

  if (isGameRoute()) {
    return (
      <>
        <GameCanvas onReady={handleReady} />
        <GameHUD />
        <span className="game-ready-status" aria-live="polite">
          {gameReady ? 'Game ready' : 'Loading game'}
        </span>
      </>
    );
  }

  return (
    <main className="app-shell">
      <h1>MOW</h1>
      <p>React shell loaded. Open <a href="/game">/game</a> to launch the Phaser canvas.</p>
    </main>
  );
}
