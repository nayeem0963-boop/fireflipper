import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { formatDistance, formatScore } from '../../systems/scoring/scoring.js';
import { REWARDS, getReward } from '../../systems/rewards/rewards.js';
import { JOURNEY_LENGTH, WORLD_COUNT } from '../../systems/world/worlds.js';
import RewardArt from './RewardArt.jsx';
import '../../styles/panel.css';
import '../../styles/journey.css';

/** The celebration before the results (ms): the bird glides on while the city is revealed. Skippable after SKIP_GUARD_MS. */
export const ENDING_MS = 6800;
/** Taps made while flying must not skip the ending by accident: skipping only arms after this long. */
export const SKIP_GUARD_MS = 1200;
const CITY = `${import.meta.env?.BASE_URL ?? '/'}images/backdrop/celestial-a.jpg`;
const SPARKS = Array.from({ length: 14 }, (_, i) => ({ '--x': `${6 + ((i * 53) % 88)}%`, '--y': `${8 + ((i * 37) % 46)}%`, '--d': `${(i % 7) * 0.45}s`, '--s': `${0.6 + (i % 4) * 0.25}` }));

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * The ending of the journey (status COMPLETE): first a short celebration over the live scene (the simulation keeps the bird gliding, untouchable, past the finish line), then
 * the results card. The timeline runs on timers that are cleared when the screen goes away, plays once per run (the component is mounted by the status, which only becomes
 * COMPLETE once), and can be skipped with the Skip button, Enter or Escape (after a short guard, so the taps of the final seconds cannot skip it).
 */
export default function JourneyEnding() {
  const [stage, setStage] = useState(() => (reducedMotion() ? 'results' : 'cinematic'));
  const [cityReady, setCityReady] = useState(false);
  const armed = useRef(false);

  useEffect(() => {
    if (stage !== 'cinematic') return undefined;
    const arm = setTimeout(() => { armed.current = true; }, SKIP_GUARD_MS);
    const done = setTimeout(() => setStage('results'), ENDING_MS);
    const onKey = (e) => {
      if (armed.current && (e.key === 'Escape' || e.key === 'Enter')) setStage('results');
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(arm);
      clearTimeout(done);
      window.removeEventListener('keydown', onKey);
    };
  }, [stage]);

  // the city painting is already in the browser cache from the Celestial Realm; if it is not ready in time the gradient alone carries the moment
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setCityReady(true);
    img.src = CITY;
    const late = setTimeout(() => alive && setCityReady(true), 900);
    return () => {
      alive = false;
      img.onload = null;
      clearTimeout(late);
    };
  }, []);

  if (stage === 'results') return <JourneyComplete />;
  return (
    <div className={`ending${cityReady ? ' is-on' : ''}`} aria-live="polite">
      <div className="ending__glow" aria-hidden="true" />
      <div className="ending__city" aria-hidden="true" style={{ backgroundImage: `url(${CITY})` }} />
      <div className="ending__sparks" aria-hidden="true">
        {SPARKS.map((s, i) => <i key={i} style={s} />)}
      </div>
      <div className="ending__text">
        <p className="ending__kicker">Fire Flipper</p>
        <h2 className="ending__title">Journey Complete</h2>
        <p className="ending__sub">You&rsquo;ve reached the Celestial City!</p>
      </div>
      <button type="button" className="ending__skip" onClick={() => armed.current && setStage('results')}>
        Skip
      </button>
    </div>
  );
}

/** The final screen: what the journey earned, and what to do next. Not a Game Over screen. */
export function JourneyComplete() {
  const result = useGameStore((s) => s.lastResult);
  const journey = useGameStore((s) => s.journey);
  const replay = useGameStore((s) => s.replayJourney);
  const openRewards = useGameStore((s) => s.openRewards);
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current?.focus();
  }, []);

  if (!result) return null;
  const earned = (result.rewards ?? []).map(getReward).filter(Boolean);
  const featherNew = earned.some((r) => r.id === 'celestial-feather');
  const others = earned.filter((r) => r.id !== 'celestial-feather');
  const owned = REWARDS.filter((r) => journey.rewards[r.id]).length;

  return (
    <div className="overlay overlay--journey">
      <div className="panel jdone" role="dialog" aria-modal="true" aria-labelledby="jdone-title" tabIndex={-1} ref={dialog}>
        <div className="jdone__body">
          <header className="jdone__head">
            <p className="jdone__brand">Fire Flipper</p>
            <h2 id="jdone-title" className="jdone__title">Journey Complete</h2>
            <p className="jdone__sub">You&rsquo;ve reached the Celestial City!</p>
          </header>

          <section className={`jdone__prize${featherNew ? ' is-new' : ''}`} aria-label="Primary reward">
            <RewardArt id="celestial-feather" className="jdone__feather" />
            <div>
              <p className="jdone__prize-title">{featherNew ? 'Celestial Feather unlocked' : 'Celestial Feather'}</p>
              <p className="jdone__prize-sub">{featherNew ? getReward('celestial-feather').kicker : 'Already in your collection: you have flown the journey before.'}</p>
            </div>
          </section>

          {others.length > 0 && (
            <section className="jdone__others" aria-label="Other rewards unlocked on this journey">
              <h3 className="jdone__h">Also unlocked on this journey</h3>
              <ul>
                {others.map((r) => (
                  <li key={r.id}>
                    <RewardArt id={r.id} />
                    <span>{r.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <dl className="jdone__stats">
            <div><dt>Final distance</dt><dd>{formatDistance(result.distance ?? JOURNEY_LENGTH)}</dd></div>
            <div><dt>Final score</dt><dd>{formatScore(result.score)}{result.isNewBest ? ' · new best!' : ''}</dd></div>
            <div><dt>Orbs collected</dt><dd>{result.orbs}</dd></div>
            <div><dt>Worlds completed</dt><dd>{result.worlds ?? WORLD_COUNT} / {WORLD_COUNT}</dd></div>
            <div><dt>Rewards unlocked</dt><dd>{earned.length} new · {owned} / {REWARDS.length} owned</dd></div>
          </dl>
        </div>

        <footer className="jdone__footer">
          <button type="button" className="play-btn play-btn--compact" onClick={replay} autoFocus>
            <span>Replay Journey</span>
          </button>
          <button type="button" className="ghost-btn" onClick={openRewards}>View Rewards</button>
          <button type="button" className="ghost-btn" onClick={exitToMenu}>Return to Main Menu</button>
        </footer>
      </div>
    </div>
  );
}
