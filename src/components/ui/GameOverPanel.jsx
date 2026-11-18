import { useGameStore } from '../../store/useGameStore.js';
import { SCORING } from '../../systems/physics/constants.js';
import { formatDistance, formatScore } from '../../systems/scoring/scoring.js';
import { isCoarsePointer } from '../../utils/device.js';
import { RestartIcon } from './Icons.jsx';
import '../../styles/panel.css';

export default function GameOverPanel() {
  const result = useGameStore((s) => s.lastResult);
  const bestScore = useGameStore((s) => s.bestScore);
  const sessionBest = useGameStore((s) => s.sessionBest);
  const restart = useGameStore((s) => s.restart);
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  if (!result) return null;

  return (
    <div className="overlay overlay--soft overlay--gameover">
      <div className="panel panel--center gameover" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
        <p className="gameover__kicker">Run over</p>
        <h2 id="gameover-title" className="panel__title panel__title--big">
          Scorched!
        </h2>
        {result.isNewBest && <span className="badge">New best score!</span>}

        <div className="gameover__score" aria-label={`Score ${result.score}`}>
          {formatScore(result.score)}
        </div>

        <dl className="gameover__stats">
          <div>
            <dt>Distance</dt>
            <dd>{formatDistance(result.distance)}</dd>
          </div>
          <div>
            <dt>Fire orbs</dt>
            <dd>
              {result.orbs} <span className="gameover__sub">(+{result.orbs * SCORING.orbPoints})</span>
            </dd>
          </div>
          {result.gems > 0 && (
            <div>
              <dt>Gems</dt>
              <dd>
                {result.gems} <span className="gameover__sub">(+{result.gems * SCORING.gemPoints})</span>
              </dd>
            </div>
          )}
          {result.rings > 0 && (
            <div>
              <dt>Fire rings</dt>
              <dd>
                {result.rings} <span className="gameover__sub">(+{result.rings * SCORING.ringPoints})</span>
              </dd>
            </div>
          )}
          <div>
            <dt>Session best</dt>
            <dd>{formatScore(sessionBest)}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd>{formatScore(bestScore)}</dd>
          </div>
        </dl>

        <button type="button" className="play-btn play-btn--compact" onClick={restart} autoFocus>
          <RestartIcon />
          <span>Retry</span>
        </button>
        <button type="button" className="ghost-btn" onClick={exitToMenu}>
          Main menu
        </button>
        {!isCoarsePointer() && (
          <p className="panel__note">
            Press <kbd>Space</kbd> to retry
          </p>
        )}
      </div>
    </div>
  );
}
