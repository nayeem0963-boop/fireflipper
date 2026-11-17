import { useGameStore, MODE } from '../../store/useGameStore.js';
import { SCORING } from '../../systems/physics/constants.js';
import { formatDistance, formatScore, scoreBreakdown } from '../../systems/scoring/scoring.js';
import { isCoarsePointer } from '../../utils/device.js';
import { RestartIcon } from './Icons.jsx';
import SubmitScore from './SubmitScore.jsx';
import '../../styles/panel.css';

/** One line of the score breakdown: what it was, how much of it, and the points it gave. */
function Row({ label, detail, points }) {
  return (
    <div className="gameover__row">
      <dt>{label}</dt>
      <dd className="gameover__detail">{detail}</dd>
      <dd className="gameover__points">+{formatScore(points)}</dd>
    </div>
  );
}

/**
 * The record line: how far a new best beat the old one, or what the player is chasing.
 * Display only; the bests themselves are decided by the store.
 */
function recordNote(result, daily) {
  const isRecord = daily ? result.isNewDailyBest : result.isNewBest;
  if (!isRecord) return null;
  const label = daily ? 'New daily best!' : 'New best score!';
  const margin = result.score - result.previousBest;
  const sub =
    result.previousBest > 0
      ? `+${formatScore(margin)} over ${formatScore(result.previousBest)}`
      : daily
        ? 'First score today'
        : 'Your first best score';
  return { label, sub };
}

export default function GameOverPanel() {
  const result = useGameStore((s) => s.lastResult);
  const bestScore = useGameStore((s) => s.bestScore);
  const dailyBests = useGameStore((s) => s.dailyBests);
  const dailyKey = useGameStore((s) => s.dailyKey);
  const sessionBest = useGameStore((s) => s.sessionBest);
  const restart = useGameStore((s) => s.restart);
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  if (!result) return null;

  const daily = result.mode === MODE.DAILY;
  const record = recordNote(result, daily);
  const parts = scoreBreakdown(result);
  const best = daily ? (dailyBests[dailyKey] ?? 0) : bestScore;
  // The session best only adds information when it differs from the all-time best.
  const showSession = !daily && !record && sessionBest > 0 && sessionBest < bestScore;

  return (
    <div className="overlay overlay--soft overlay--gameover">
      <div
        className={`panel gameover${record ? ' gameover--record' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gameover-title"
      >
        <div className="gameover__body">
          <header className="gameover__head">
            {daily && <span className="gameover__tag">Daily challenge</span>}
            <h2 id="gameover-title" className="panel__title panel__title--big">
              Scorched!
            </h2>
          </header>

          {record && (
            <p className="gameover__record">
              <span className="gameover__record-label">{record.label}</span>
              <span className="gameover__record-sub">{record.sub}</span>
            </p>
          )}
          {result.unlockedSkins.length > 0 && (
            <span className="badge">New Flipper colour unlocked: {result.unlockedSkins.join(', ')}</span>
          )}

          <div className="gameover__score" aria-label={`Score ${result.score}`}>
            {formatScore(result.score)}
          </div>

          <dl className="gameover__breakdown" aria-label="Score breakdown">
            <Row label="Distance" detail={formatDistance(result.distance)} points={parts.distancePoints} />
            <Row
              label="Fire orbs"
              detail={`${result.orbs} × ${SCORING.orbPoints}`}
              points={parts.orbPoints}
            />
            <Row
              label="Near misses"
              detail={result.nearMisses.toLocaleString()}
              points={parts.nearMissPoints}
            />
          </dl>

          {!record && (
            <p className="gameover__best">
              <span>{daily ? "Today's best" : 'Best'}</span>
              <strong>{formatScore(best)}</strong>
              {showSession && (
                <span className="gameover__session">
                  This session <strong>{formatScore(sessionBest)}</strong>
                </span>
              )}
            </p>
          )}

          {daily && <SubmitScore result={result} />}
        </div>

        <div className="gameover__actions">
          <button
            type="button"
            className="play-btn gameover__retry"
            onClick={restart}
            autoFocus={!daily}
            aria-keyshortcuts="Space"
          >
            <RestartIcon />
            <span>Retry</span>
            {!isCoarsePointer() && <kbd className="gameover__key">Space</kbd>}
          </button>
          <button type="button" className="ghost-btn gameover__menu" onClick={exitToMenu}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
}
