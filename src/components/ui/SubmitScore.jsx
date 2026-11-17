import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { submitRun } from '../../systems/leaderboard/api.js';
import { game } from '../../systems/game/gameInstance.js';

const NAME_RE = /^[\p{L}\p{N} _-]{3,16}$/u;

/**
 * Game-over form for the daily challenge: sends the run's seed-derived replay
 * to the server, which verifies the score by re-simulating it.
 */
export default function SubmitScore({ result }) {
  const dailyKey = useGameStore((s) => s.dailyKey);
  const playerId = useGameStore((s) => s.playerId);
  const savedName = useGameStore((s) => s.playerName);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const openLeaderboard = useGameStore((s) => s.openLeaderboard);
  const [name, setName] = useState(savedName);
  const [state, setState] = useState({ status: 'idle' });

  const clean = name.trim().replace(/\s+/g, ' ');
  const valid = NAME_RE.test(clean);
  const tooLong = game.logOverflow;

  async function onSubmit(e) {
    e.preventDefault();
    if (!valid || state.status === 'sending') return;
    setState({ status: 'sending' });
    setPlayerName(clean);
    const res = await submitRun({
      playerId,
      name: clean,
      dailyKey,
      inputs: game.inputLog.slice(),
      claimedScore: result.score,
    });
    setState(res.ok ? { status: 'done', data: res.data } : { status: 'error', error: res.error });
  }

  if (state.status === 'done') {
    const { data } = state;
    return (
      <div className="submit">
        <p className="submit__done">
          {data.onBoard
            ? `You're #${data.rank} on today's board.`
            : 'Score recorded, just short of the top 100.'}
          {!data.improved && ' (Your earlier score is higher, so it stays.)'}
        </p>
        <button type="button" className="ghost-btn" onClick={openLeaderboard}>
          View leaderboard
        </button>
      </div>
    );
  }

  if (tooLong) return <p className="panel__note">This run is too long to submit.</p>;

  return (
    <form className="submit" onSubmit={onSubmit}>
      <label className="submit__label" htmlFor="submit-name">
        Name for the leaderboard
      </label>
      <div className="submit__row">
        <input
          id="submit-name"
          className="submit__input"
          value={name}
          maxLength={16}
          autoComplete="nickname"
          placeholder="3-16 letters or numbers"
          onChange={(e) => setName(e.target.value)}
          // Keep typed keys (Space, etc.) from reaching the game controls.
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
        />
        <button
          type="submit"
          className="play-btn play-btn--compact"
          disabled={!valid || state.status === 'sending'}
        >
          {state.status === 'sending' ? 'Sending…' : 'Submit'}
        </button>
      </div>
      {state.status === 'error' && <p className="panel__note panel__note--error">{state.error}</p>}
    </form>
  );
}
