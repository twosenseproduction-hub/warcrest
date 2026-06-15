import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import GameCanvas from './components/GameCanvas';
import GameHUD from './components/GameHUD';
import type MainScene from './game/scenes/MainScene';

function isPhaserLabRoute(): boolean {
  const { hash, pathname } = window.location;

  return pathname === '/phaser-lab' || pathname === '/phaser-lab/' || hash === '#/phaser-lab';
}

export default function App(): JSX.Element {
  const [gameReady, setGameReady] = useState(false);
  const handleReady = useCallback((_scene: MainScene) => {
    setGameReady(true);
  }, []);

  if (isPhaserLabRoute()) {
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
      <p>Open <a href="/game">/game</a> to launch the real Warcrest game with Fog of War.</p>
      <p>Open <a href="/legacy-game">/legacy-game</a> for the untouched backup.</p>
      <p>Open <a href="/phaser-lab">/phaser-lab</a> for the parked Phaser scaffold.</p>
    </main>
  );
}
