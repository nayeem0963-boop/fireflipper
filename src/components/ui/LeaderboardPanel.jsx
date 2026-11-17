import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { boardDays, fetchBoard } from '../../systems/leaderboard/api.js';
import { todayKey, yesterdayKey } from '../../utils/daily.js';
import { formatDistance, formatScore } from '../../systems/scoring/scoring.js';
import IconButton from './IconButton.jsx';
import { CloseIcon } from './Icons.jsx';
import '../../styles/panel.css';

/** Daily Fire Challenge leaderboard: today's and yesterday's top scores. */
export default function LeaderboardPanel() {
  const close = useGameStore((s) => s.closeLeaderboard);
  const playerId = useGameStore((s) => s.playerId);
  const dialogRef = useRef(null);
  const days = boardDays(todayKey(), yesterdayKey());
  const [dayKey, setDayKey] = useState(days[0].key);
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchBoard(dayKey, playerId).then((res) => {
      if (cancelled) return;
      setState(res.ok ? { status: 'ready', board: res.data } : { status: 'error', error: res.error });
    });
    return () => {
      cancelled = true;
    };
  }, [dayKey, playerId]);

  const board = state.board;

  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="panel__header">
          <h2 id="leaderboard-title" className="panel__title">
            Daily Fire Challenge
          </h2>
          <IconButton label="Close leaderboard" onClick={close}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="segmented" role="radiogroup" aria-label="Day">
          {days.map((d) => (
            <button
              key={d.key}
              type="button"
              role="radio"
              aria-checked={dayKey === d.key}
              className={dayKey === d.key ? 'is-active' : ''}
              onClick={() => setDayKey(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {state.status === 'loading' && <p className="panel__note">Loading scores…</p>}
        {state.status === 'error' && <p className="panel__note panel__note--error">{state.error}</p>}
        {board && board.entries.length === 0 && (
          <p className="panel__note">No scores yet. Play the daily challenge to be first.</p>
        )}
        {board && board.entries.length > 0 && (
          <ol className="board" aria-label={`Scores for ${board.key}`}>
            {board.entries.map((e) => (
              <li key={e.rank} className={`board__row ${e.you ? 'is-you' : ''}`}>
                <span className="board__rank">{e.rank}</span>
                <span className="board__name">{e.name}</span>
                <span className="board__dist">{formatDistance(e.distance)}</span>
                <span className="board__score">{formatScore(e.score)}</span>
              </li>
            ))}
          </ol>
        )}
        {board?.me && board.me.rank > board.entries.length && (
          <p className="panel__note">
            Your best: #{board.me.rank} with {formatScore(board.me.score)}
          </p>
        )}
        <p className="panel__note">Scores are checked by replaying each run, so they can&apos;t be edited.</p>
      </div>
    </div>
  );
}
