import { lazy, Suspense, useEffect, useRef } from 'react';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import GameHUD from '../ui/GameHUD.jsx';
import PauseMenu from '../ui/PauseMenu.jsx';
import StartPrompt from '../ui/StartPrompt.jsx';
import DemoOverlay from '../ui/DemoOverlay.jsx';
import GameOverPanel from '../ui/GameOverPanel.jsx';
import { useGameInput } from '../../hooks/useGameInput.js';
import { usePauseWhenHidden } from '../../hooks/usePauseWhenHidden.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { ACTIONS, onAction } from '../../systems/input/inputBus.js';
import { game } from '../../systems/game/gameInstance.js';
import { unlockAudio } from '../../systems/audio/sfx.js';
import '../../styles/game.css';

const GameStage = lazy(() => import('../scene/GameStage.jsx'));

/** Ignore retry input this soon after the game-over screen appears (avoids accidental restarts). */
const RETRY_GUARD_MS = 450;

/**
 * Gameplay screen: composes the fullscreen canvas, HUD and overlays, and
 * routes input actions to the simulation. Contains no game rules.
 */
export default function GameScreen() {
  const status = useGameStore((s) => s.status);
  const demo = useGameStore((s) => s.demo);
  const restart = useGameStore((s) => s.restart);
  const playSurface = useRef(null);

  useGameInput(playSurface);
  usePauseWhenHidden();
  useGameAudio();

  useEffect(() => {
    const store = useGameStore.getState;
    const offs = [
      onAction(ACTIONS.FLAP_PRESS, () => {
        unlockAudio();
        const { status: st, overAt, restart, demo: watching } = store();
        if (watching) return; // auto play: the bot is flying, taps do nothing
        if (st === STATUS.OVER) {
          if (performance.now() - overAt > RETRY_GUARD_MS) restart();
          return;
        }
        if (st === STATUS.READY || st === STATUS.RUNNING) {
          game.setHolding(true);
          game.flap();
        }
      }),
      onAction(ACTIONS.FLAP_RELEASE, () => !store().demo && game.setHolding(false)),
      onAction(ACTIONS.DIVE_PRESS, () => !store().demo && game.setDive(true)),
      onAction(ACTIONS.DIVE_RELEASE, () => !store().demo && game.setDive(false)),
      onAction(ACTIONS.PAUSE, () => store().togglePause()),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // Auto play has no game-over screen: if the bot ever crashes, it simply starts again.
  useEffect(() => {
    if (!(demo && status === STATUS.OVER)) return undefined;
    const id = setTimeout(restart, 1600);
    return () => clearTimeout(id);
  }, [demo, status, restart]);

  const paused = status === STATUS.PAUSED;

  return (
    <main className="game">
      <div className="game__surface" ref={playSurface}>
        <Suspense fallback={null}>
          <GameStage paused={paused} />
        </Suspense>
      </div>

      <GameHUD />

      {demo && <DemoOverlay />}
      {status === STATUS.READY && !demo && <StartPrompt />}
      {status === STATUS.DYING && <div className="game__flash" aria-hidden="true" />}
      {paused && <PauseMenu />}
      {status === STATUS.OVER && !demo && <GameOverPanel />}
    </main>
  );
}
