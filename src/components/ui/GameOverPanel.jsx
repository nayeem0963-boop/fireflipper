import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { SCORING } from '../../systems/physics/constants.js';
import { formatDistance, formatScore } from '../../systems/scoring/scoring.js';
import { useTheme } from '../../hooks/useTheme.js';
import { biomeAt } from '../../systems/world/biomes.js';
import { sfx } from '../../systems/audio/sfx.js';
import { isCoarsePointer } from '../../utils/device.js';
import { RestartIcon } from './Icons.jsx';
import '../../styles/panel.css';

const COUNT_MS = 1000;
const CONFETTI = 22;

const CAUSES = {
  lava: 'Burned in the lava',
  column: 'Smashed into a column',
  block: 'Crashed into a stone block',
  rock: 'Struck by a boulder',
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts from 0 to `target` with an ease-out curve; `done` flips true at the end. */
function useCountUp(target, onTick) {
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion() || target <= 0) {
      setValue(target);
      setDone(true);
      return undefined;
    }
    let raf;
    let lastTick = 0;
    const t0 = performance.now();
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / COUNT_MS);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (now - lastTick > 70 && p < 1) {
        lastTick = now;
        onTick?.(p);
      }
      if (p < 1) raf = requestAnimationFrame(frame);
      else setDone(true);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return [value, done];
}

export default function GameOverPanel() {
  const result = useGameStore((s) => s.lastResult);
  const sessionBest = useGameStore((s) => s.sessionBest);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const theme = useTheme();
  const restart = useGameStore((s) => s.restart);
  const exitToMenu = useGameStore((s) => s.exitToMenu);

  const score = result?.score ?? 0;
  const [shown, done] = useCountUp(score, (p) => soundEnabled && sfx.tick(p));
  const [barReady, setBarReady] = useState(false);
  const isRecord = !!result?.isNewBest;

  useEffect(() => {
    const id = requestAnimationFrame(() => setBarReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!done || !soundEnabled) return;
    if (isRecord) sfx.record();
    else sfx.result();
  }, [done, isRecord, soundEnabled]);

  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => {
        const a = (i / CONFETTI) * Math.PI * 2 + (i % 3) * 0.2;
        const d = 120 + ((i * 37) % 90);
        return {
          '--dx': `${Math.cos(a) * d * 1.5}px`,
          '--dy': `${Math.sin(a) * d * 0.9 - 30}px`,
          '--rot': `${(i * 83) % 360}deg`,
          '--delay': `${(i % 5) * 0.04}s`,
          '--hue': i % 3 === 0 ? 'var(--fire-100)' : i % 3 === 1 ? 'var(--fire-300)' : 'var(--fire-500)',
        };
      }),
    [],
  );

  if (!result) return null;

  const { previousBest, distance, orbs, bestStreak, nearMisses, cause, unlockedSkins = [] } = result;
  const { achievements = [], daily, nextGoal } = result;
  const hasBest = previousBest > 0;
  const personalBest = Math.max(previousBest, score);
  const pct = hasBest ? Math.min(1, score / previousBest) : 1;
  const toGo = Math.max(0, previousBest - score + 1);
  let progressText;
  if (isRecord) progressText = hasBest ? `+${formatScore(score - previousBest)} past your old best!` : 'First score on the board!';
  else progressText = `${Math.floor(pct * 100)}% of your best · ${formatScore(toGo)} to beat it`;

  return (
    <div className="overlay overlay--soft overlay--gameover">
      <div
        className={`panel gameover${isRecord ? ' gameover--record' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gameover-title"
      >
        <div className="gameover__body">
          <section className="gameover__hero">
            <p className="gameover__kicker">Run over</p>
            <h2 id="gameover-title" className="panel__title panel__title--big">
              {isRecord ? 'New record!' : theme.copy.over}
            </h2>
            {cause && <p className="gameover__cause">{cause === 'lava' ? (biomeAt(distance)?.lavaCopy ?? theme.copy.lava) : (CAUSES[cause] ?? 'Crashed')}</p>}

            <div className="gameover__scorewrap">
              {isRecord && done && (
                <div className="confetti" aria-hidden="true">
                  {confetti.map((style, i) => (
                    <i key={i} style={style} />
                  ))}
                </div>
              )}
              <div className={`gameover__score${done ? ' is-done' : ''}`} aria-label={`Score ${score}`}>
                {formatScore(shown)}
              </div>
            </div>
            {isRecord && <span className={`badge${done ? ' badge--pop' : ''}`}>New personal best</span>}

            {unlockedSkins.length > 0 && (
              <p className="gameover__unlock">
                Skin unlocked: {unlockedSkins.join(', ')} — pick it under Your bird
              </p>
            )}

            <div className="pb" aria-label="Progress toward personal best">
              <div className="pb__track">
                <div
                  className={`pb__fill${isRecord ? ' pb__fill--record' : ''}`}
                  style={{ width: barReady ? `${Math.round(pct * 100)}%` : '0%' }}
                />
              </div>
              <p className="pb__text">{progressText}</p>
            </div>
          </section>

          <dl className="gameover__stats">
            <Stat label="Distance" delay={0}>
              {formatDistance(distance)}
            </Stat>
            <Stat label="Fire orbs" delay={1}>
              {orbs} <span className="gameover__sub">(+{orbs * SCORING.orbPoints})</span>
            </Stat>
            <Stat label="Best orb streak" delay={2}>
              {bestStreak}
            </Stat>
            <Stat label="Near misses" delay={3}>
              {nearMisses}
            </Stat>
            <Stat label="Personal best" delay={4} highlight={isRecord}>
              {formatScore(personalBest)}
            </Stat>
            <Stat label="Session best" delay={5}>
              {formatScore(sessionBest)}
            </Stat>
          </dl>

          <section className="rewards" aria-label="Rewards and next goal">
            {achievements.map((a) => (
              <p key={a.id} className="reward reward--earned" title={a.desc}>
                <span aria-hidden="true">★</span> Achievement: <strong>{a.name}</strong>
              </p>
            ))}
            {daily?.justCompleted && (
              <p className="reward reward--earned">
                <span aria-hidden="true">🔥</span> Daily goal complete
                {daily.streakDays > 1 ? ` · ${daily.streakDays}-day streak` : ''}
              </p>
            )}
            {daily && !daily.done && (
              <p className="reward">
                Daily: <strong>{daily.text}</strong>
              </p>
            )}
            {nextGoal && (
              <p className="reward reward--goal">
                Next goal: <strong>{nextGoal.text}</strong>
                <span className="reward__bar" aria-hidden="true">
                  <i style={{ width: `${Math.round(nextGoal.ratio * 100)}%` }} />
                </span>
              </p>
            )}
          </section>
        </div>

        <footer className="gameover__footer">
          <button type="button" className="play-btn play-btn--compact" onClick={restart} autoFocus>
            <RestartIcon />
            <span>Retry</span>
          </button>
          <button type="button" className="ghost-btn" onClick={exitToMenu}>
            Main menu
          </button>
          {!isCoarsePointer() && (
            <p className="gameover__hint">
              Press <kbd>Space</kbd> to retry
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, delay, highlight, children }) {
  return (
    <div className={`stat${highlight ? ' stat--hot' : ''}`} style={{ '--i': delay }}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
