import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { GAME_EVENTS, gameEvents } from '../../systems/events/gameEvents.js';
import { getActiveSim } from '../../hooks/useGameSim.js';
import { PlayIcon } from './Icons.jsx';
import { useGameVersion } from '../../hooks/useGameVersion.js';
import { isRunner } from '../../systems/versions/versions.js';

/**
 * Auto-play overlay (keep this feature: see CLAUDE.md). A bot is flying; the viewer watches to learn how the game
 * plays: a badge saying so (and that nothing is scored), the bot's inputs shown as the buttons a player would
 * press (TAP lights on every flap, HOLD while held), and buttons to play for real or exit. Kept to the top-left
 * corner and the bottom of the screen, clear of the flight band.
 */
export default function DemoOverlay() {
  const startGame = useGameStore((s) => s.startGame);
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  const preview = useGameStore((s) => s.preview);
  const runner = isRunner(useGameVersion());
  const [tap, setTap] = useState(0);
  const [hold, setHold] = useState(false);
  const lastTap = useRef(0);

  useEffect(() => {
    const off = gameEvents.on(GAME_EVENTS.FLAP, () => {
      lastTap.current = performance.now();
      setTap((n) => n + 1);
    });
    return off;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const sim = getActiveSim();
      setHold(sim.input.holding && sim.phase === 'running');
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="demo__badge" role="status">
        <span className="demo__dot" aria-hidden="true" />
        <span>
          <strong>{preview ? 'Journey Preview' : 'Auto play'}</strong>
          <small>
            {preview
              ? `A bot ${runner ? 'runs' : 'flies'} all 10,000 m. Nothing is saved.`
              : `A bot is ${runner ? 'running' : 'flying'}. Nothing is scored.`}
          </small>
        </span>
      </div>

      <div className="demo__bar">
        <div className="demo__row">
          <div className="demo__keys" aria-label="What the bot is pressing">
            <span className={`demo__key${tap && performance.now() - lastTap.current < 220 ? ' is-on' : ''}`} key={tap}>
              Tap
            </span>
            <span className={`demo__key${hold ? ' is-on' : ''}`}>Hold</span>
          </div>
          <div className="demo__buttons">
            <button type="button" className="play-btn play-btn--compact demo__btn" onClick={startGame}>
              <PlayIcon />
              <span>Play it yourself</span>
            </button>
            <button type="button" className="ghost-btn demo__btn" onClick={exitToMenu}>
              Exit
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
