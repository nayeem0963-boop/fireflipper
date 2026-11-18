import { useEffect, useRef, useState } from 'react';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { GAME_EVENTS, gameEvents } from '../../systems/events/gameEvents.js';
import { game } from '../../systems/game/gameInstance.js';
import { demoBot, warpToNextEnvironment } from '../../systems/bot/demo.js';
import { BIOMES, biomeIndexAt } from '../../systems/world/environments.js';
import { CONTROLS_TIP, describeAhead } from '../../systems/bot/commentary.js';
import { PlayIcon } from './Icons.jsx';

/**
 * Auto-play overlay. A bot is flying; the viewer is here to learn how the game is played:
 *  - a badge saying so (and that nothing is scored)
 *  - the bot's inputs, shown as the buttons a player would press: TAP lights on every flap, HOLD while held
 *  - a one-line tip about the obstacle section the bird is in or approaching, and how to handle it
 *  - buttons to jump to the next land, or to play for real
 * Kept to the bottom of the screen and the top-left corner, clear of the flight band.
 */
export default function DemoOverlay() {
  const status = useGameStore((s) => s.status);
  const startGame = useGameStore((s) => s.startGame);
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  const [tap, setTap] = useState(0);
  const [hold, setHold] = useState(false);
  const [tip, setTip] = useState(null);
  const [land, setLand] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const lastTap = useRef(0);

  // TAP flashes on each flap the bot makes.
  useEffect(() => {
    const off = gameEvents.on(GAME_EVENTS.FLAP, () => {
      lastTap.current = performance.now();
      setTap((n) => n + 1);
    });
    return off;
  }, []);

  // HOLD, the current tip and which land we are in change slowly: poll a few times a second.
  useEffect(() => {
    const id = setInterval(() => {
      setHold(game.input.holding && game.phase === 'running');
      setTip(describeAhead(game, 45));
      setLand(biomeIndexAt(game.distance));
      setElapsed(game.runTime);
    }, 120);
    return () => clearInterval(id);
  }, []);

  const running = status === STATUS.RUNNING || status === STATUS.PAUSED;
  const last = land >= BIOMES.length - 1;
  const showControls = !tip || elapsed < 7;

  return (
    <>
      <div className="demo__badge" role="status">
        <span className="demo__dot" aria-hidden="true" />
        <span>
          <strong>Auto play</strong>
          <small>A bot is flying. Nothing is scored.</small>
        </span>
      </div>

      <div className="demo__bar">
        <p className="demo__tip" aria-live="polite">
          {showControls ? (
            <>{CONTROLS_TIP}</>
          ) : (
            <>
              <strong>{tip.title}</strong>
              {tip.distance > 3 ? <span className="demo__dist"> in {tip.distance} m</span> : <span className="demo__dist"> now</span>}
              <span className="demo__text"> {tip.text}</span>
            </>
          )}
        </p>
        <div className="demo__row">
          <div className="demo__keys" aria-label="What the bot is pressing">
            <span className={`demo__key${tap && performance.now() - lastTap.current < 220 ? ' is-on' : ''}`} key={tap}>
              Tap
            </span>
            <span className={`demo__key${hold ? ' is-on' : ''}`}>Hold</span>
          </div>
          <div className="demo__buttons">
            <button type="button" className="ghost-btn demo__btn" disabled={!running || last} onClick={warpToNextEnvironment} title="Skip ahead to the next land">
              {last ? 'Last land' : `Next land: ${BIOMES[land + 1].name}`}
            </button>
            <button type="button" className="play-btn play-btn--compact demo__btn demo__btn--play" onClick={startGame}>
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

// Exposed for tests and debugging: the bot's planning cost so far.
export const demoStats = () => demoBot.stats;
