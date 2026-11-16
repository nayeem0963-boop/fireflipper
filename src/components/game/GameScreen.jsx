import { useEffect, useRef, useState } from 'react';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import SceneCanvas from '../scene/SceneCanvas.jsx';
import EmberValleyScene from '../../scenes/EmberValley/EmberValleyScene.jsx';
import GameHUD from '../ui/GameHUD.jsx';
import PauseMenu from '../ui/PauseMenu.jsx';
import { useGameInput } from '../../hooks/useGameInput.js';
import { usePauseWhenHidden } from '../../hooks/usePauseWhenHidden.js';
import { ACTIONS, onAction } from '../../systems/input/inputBus.js';
import { runtime } from '../../systems/runtime.js';
import { isCoarsePointer } from '../../utils/device.js';
import '../../styles/game.css';

/**
 * Gameplay screen: composes the fullscreen canvas, HUD and overlays, and
 * wires input actions to systems. No game rules live here.
 */
export default function GameScreen() {
  const status = useGameStore((s) => s.status);
  const runId = useGameStore((s) => s.runId);
  const playSurface = useRef(null);
  const [showHint, setShowHint] = useState(true);

  useGameInput(playSurface);
  usePauseWhenHidden();

  // Map abstract actions to effects. Flight physics will subscribe here later.
  useEffect(() => {
    const offFlap = onAction(ACTIONS.FLAP, () => {
      if (useGameStore.getState().status !== STATUS.RUNNING) return;
      runtime.lastFlapAt = performance.now();
      setShowHint(false);
    });
    const offPause = onAction(ACTIONS.PAUSE, () => useGameStore.getState().togglePause());
    return () => {
      offFlap();
      offPause();
    };
  }, []);

  useEffect(() => setShowHint(true), [runId]);

  const paused = status === STATUS.PAUSED;

  return (
    <main className="game">
      <div className="game__surface" ref={playSurface}>
        <SceneCanvas camera={{ position: [0, 0.6, 10], fov: 50 }} frameloop={paused ? 'demand' : 'always'}>
          <EmberValleyScene />
        </SceneCanvas>
      </div>

      <GameHUD />

      {showHint && !paused && (
        <p className="game__hint" aria-hidden="true">
          {isCoarsePointer() ? (
            'Tap anywhere to flap'
          ) : (
            <>
              Click or press <kbd>Space</kbd> to flap
            </>
          )}
        </p>
      )}

      {paused && <PauseMenu />}
    </main>
  );
}
