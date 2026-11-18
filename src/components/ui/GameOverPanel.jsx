import { useGameStore } from '../../store/useGameStore.js';
import { formatDistance, formatScore } from '../../systems/scoring/scoring.js';
import { isCoarsePointer } from '../../utils/device.js';
import { GemIcon, RestartIcon } from './Icons.jsx';
import '../../styles/panel.css';

/** One row of the score ledger: what it was, how many, and the points it paid. */
function Row({ label, detail, points, className }) {
  return (
    <li className={className}>
      <span className="ledger__label">{label}</span>
      <span className="ledger__detail">{detail}</span>
      <span className="ledger__points">+{formatScore(points)}</span>
    </li>
  );
}

export default function GameOverPanel() {
  const result = useGameStore((s) => s.lastResult);
  const bestScore = useGameStore((s) => s.bestScore);
  const sessionBest = useGameStore((s) => s.sessionBest);
  const restart = useGameStore((s) => s.restart);
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  if (!result) return null;
  const pts = result.points ?? { distance: result.distance, orbs: 0, gems: 0, rings: 0, nearMiss: 0, other: 0 };
  const bonus = pts.orbs + pts.gems + pts.rings + pts.nearMiss + pts.other;

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

        {/* Where every point came from. Distance is never multiplied; bonuses were paid at the streak multiplier of the moment. */}
        <ul className="ledger" aria-label="Score breakdown">
          <Row label="Distance" detail={formatDistance(result.distance)} points={pts.distance} className="ledger__row ledger__row--distance" />
          {result.orbs > 0 && <Row label="Fire orbs" detail={`${result.orbs}`} points={pts.orbs} className="ledger__row" />}
          {result.gems > 0 && <Row label="Gems" detail={`${result.gems}`} points={pts.gems} className="ledger__row" />}
          {result.rings > 0 && <Row label="Fire rings" detail={`${result.rings}`} points={pts.rings} className="ledger__row" />}
          {result.nearMisses > 0 && <Row label="Near misses" detail={`${result.nearMisses}`} points={pts.nearMiss} className="ledger__row" />}
          {pts.other > 0 && <Row label="Bonus" detail="" points={pts.other} className="ledger__row" />}
        </ul>
        <p className="ledger__note">
          Bonuses {formatScore(bonus)} · distance {formatScore(pts.distance)} · best streak {result.bestStreak ?? 0} · top multiplier ×{result.maxMult ?? 1}
        </p>
        {result.gems > 0 && (
          <p className="gameover__banked">
            <GemIcon /> +{result.gems} gem{result.gems === 1 ? '' : 's'} banked · {result.gemsBankedTotal} total
          </p>
        )}

        <dl className="gameover__stats">
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
