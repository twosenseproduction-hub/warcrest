import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import GameCanvas from './components/GameCanvas';
import GameHUD from './components/GameHUD';
import type MainScene from './game/scenes/MainScene';

function isGameRoute(): boolean {
  const { hash, pathname } = window.location;

  return pathname === '/legacy-game' || pathname === '/legacy-game/' || hash === '#/legacy-game';
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
      <p>Open <a href="/game">/game</a> to launch the current DOM canvas game.</p>
      <p>Open <a href="/legacy-game">/legacy-game</a> to compare against the Phaser placeholder scaffold.</p>
    </main>
  );
}
