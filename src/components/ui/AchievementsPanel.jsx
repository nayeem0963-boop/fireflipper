import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { ACHIEVEMENTS, CATEGORIES, achievementProgress, dailyGoalFor } from '../../systems/progression/progression.js';
import { SKINS } from '../../systems/skins/skins.js';
import { formatScore } from '../../systems/scoring/scoring.js';
import IconButton from './IconButton.jsx';
import { CloseIcon } from './Icons.jsx';
import '../../styles/panel.css';
import '../../styles/progress.css';

/**
 * Achievements, the daily goal and cosmetic unlock milestones. A fixed header and footer around one scrolling
 * list, so the panel fits a short window. Purely a progress display: nothing here affects gameplay.
 */
export default function AchievementsPanel() {
  const close = useGameStore((s) => s.closeAchievements);
  const stats = useGameStore((s) => s.stats);
  const bestScore = useGameStore((s) => s.bestScore);
  const earned = useGameStore((s) => s.earned);
  const daily = useGameStore((s) => s.daily);
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const done = ACHIEVEMENTS.filter((a) => achievementProgress(a, stats, bestScore).done).length;
  const goal = dailyGoalFor(daily.key);

  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="panel prog" role="dialog" aria-modal="true" aria-labelledby="prog-title" tabIndex={-1} ref={dialogRef}>
        <header className="prog__header">
          <h2 id="prog-title" className="panel__title">
            Achievements
          </h2>
          <span className="birds__count">
            {done}/{ACHIEVEMENTS.length}
          </span>
          <IconButton label="Close" onClick={close}>
            <CloseIcon />
          </IconButton>
        </header>

        <div className="prog__list">
          <section className={`prog__daily${daily.done ? ' is-done' : ''}`} aria-label="Daily goal">
            <h3 className="birds__heading">Daily goal</h3>
            <p className="prog__daily-text">
              {daily.done ? '✓ ' : ''}
              {goal.text}
            </p>
            <p className="prog__sub">
              {daily.done ? 'Complete! A new goal arrives tomorrow.' : 'Resets every day (UTC).'}
              {daily.streakDays > 0 ? ` ${daily.streakDays}-day streak.` : ''}
            </p>
          </section>

          {CATEGORIES.map((c) => (
            <section key={c.id} aria-label={c.name} className="prog__group">
              <h3 className="birds__heading">{c.name}</h3>
              <ul className="prog__items">
                {ACHIEVEMENTS.filter((a) => a.category === c.id).map((a) => {
                  const p = achievementProgress(a, stats, bestScore);
                  return (
                    <li key={a.id} className={`ach${p.done ? ' is-done' : ''}`}>
                      <span className="ach__mark" aria-hidden="true">
                        {p.done ? '★' : '☆'}
                      </span>
                      <div className="ach__text">
                        <p className="ach__name">{a.name}</p>
                        <p className="ach__desc">{a.desc}</p>
                      </div>
                      <div className="ach__prog">
                        <span>
                          {formatScore(p.value)}/{formatScore(p.target)}
                        </span>
                        <i aria-hidden="true">
                          <b style={{ width: `${Math.round(p.ratio * 100)}%` }} />
                        </i>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section aria-label="Cosmetic unlocks" className="prog__group">
            <h3 className="birds__heading">Cosmetic unlocks</h3>
            <ul className="prog__items">
              {SKINS.filter((k) => k.unlockScore > 0).map((k) => (
                <li key={k.id} className={`ach${bestScore >= k.unlockScore ? ' is-done' : ''}`}>
                  <span className="ach__mark" aria-hidden="true">
                    {bestScore >= k.unlockScore ? '★' : '🔒'}
                  </span>
                  <div className="ach__text">
                    <p className="ach__name">{k.name} skin for every bird</p>
                    <p className="ach__desc">Reach a best score of {formatScore(k.unlockScore)}</p>
                  </div>
                  <div className="ach__prog">
                    <span>
                      {formatScore(Math.min(bestScore, k.unlockScore))}/{formatScore(k.unlockScore)}
                    </span>
                    <i aria-hidden="true">
                      <b style={{ width: `${Math.round(Math.min(1, bestScore / k.unlockScore) * 100)}%` }} />
                    </i>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="prog__footer">
          <p className="birds__note">
            {stats.runs} runs · {formatScore(stats.totalDistance)} m flown · {formatScore(stats.totalOrbs)} orbs
          </p>
          <button type="button" className="play-btn play-btn--compact" onClick={close}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
