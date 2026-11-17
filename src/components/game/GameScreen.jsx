import { useEffect, useRef } from 'react';
import { useGameStore, STATUS, retryArmed } from '../../store/useGameStore.js';
import SceneCanvas from '../scene/SceneCanvas.jsx';
import EmberValleyScene from '../../scenes/EmberValley/EmberValleyScene.jsx';
import GameHUD from '../ui/GameHUD.jsx';
import PauseMenu from '../ui/PauseMenu.jsx';
import StartPrompt from '../ui/StartPrompt.jsx';
import GameOverPanel from '../ui/GameOverPanel.jsx';
import { useGameInput } from '../../hooks/useGameInput.js';
import { usePauseWhenHidden } from '../../hooks/usePauseWhenHidden.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { ACTIONS, onAction } from '../../systems/input/inputBus.js';
import { game } from '../../systems/game/gameInstance.js';
import { unlockAudio } from '../../systems/audio/sfx.js';
import { BASE_FOV } from '../../scenes/EmberValley/cameraConfig.js';
import '../../styles/game.css';

/**
 * Gameplay screen: composes the fullscreen canvas, HUD and overlays, and
 * routes input actions to the simulation. Contains no game rules.
 */
export default function GameScreen() {
  const status = useGameStore((s) => s.status);
  const playSurface = useRef(null);

  useGameInput(playSurface);
  usePauseWhenHidden();
  useGameAudio();

  useEffect(() => {
    const store = useGameStore.getState;
    const offs = [
      onAction(ACTIONS.FLAP_PRESS, () => {
        unlockAudio();
        const { status: st, overAt, restart } = store();
        if (st === STATUS.OVER) {
          if (retryArmed(overAt)) restart();
          return;
        }
        if (st === STATUS.READY || st === STATUS.RUNNING) {
          game.setHolding(true);
          game.flap();
        }
      }),
      onAction(ACTIONS.FLAP_RELEASE, () => game.setHolding(false)),
      onAction(ACTIONS.DIVE_PRESS, () => game.setDive(true)),
      onAction(ACTIONS.DIVE_RELEASE, () => game.setDive(false)),
      onAction(ACTIONS.PAUSE, () => store().togglePause()),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const paused = status === STATUS.PAUSED;

  return (
    <main className="game">
      <div className="game__surface" ref={playSurface}>
        <SceneCanvas camera={{ position: [0, 0.5, 10], fov: BASE_FOV }} frameloop={paused ? 'demand' : 'always'}>
          <EmberValleyScene />
        </SceneCanvas>
      </div>

      <GameHUD />

      {status === STATUS.READY && <StartPrompt />}
      {status === STATUS.DYING && <div className="game__flash" aria-hidden="true" />}
      {paused && <PauseMenu />}
      {status === STATUS.OVER && <GameOverPanel />}
    </main>
  );
}
