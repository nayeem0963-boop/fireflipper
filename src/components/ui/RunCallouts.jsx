import { useEffect } from 'react';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { POWERUP_INFO } from '../../systems/powerups/appearance.js';

/** Metres flown before the first-run coaching hints retire for good. */
const TUTORIAL_END = 70;

const HINTS = [
  { until: 20, text: 'Hold to climb higher, release to fall' },
  { until: TUTORIAL_END, text: 'Skim past rocks for near-miss bonus points' },
];

/** Floating feedback during a run: near-miss callouts and first-run coaching. Pure UI. */
export default function RunCallouts() {
  const status = useGameStore((s) => s.status);
  const callout = useGameStore((s) => s.callout);
  const distance = useGameStore((s) => s.distance);
  const power = useGameStore((s) => s.power);
  const tutorialDone = useGameStore((s) => s.tutorialDone);
  const completeTutorial = useGameStore((s) => s.completeTutorial);
  const running = status === STATUS.RUNNING;

  useEffect(() => {
    if (running && !tutorialDone && distance >= TUTORIAL_END) completeTutorial();
  }, [running, tutorialDone, distance, completeTutorial]);

  const hint = running && !tutorialDone ? HINTS.find((h) => distance < h.until) : null;

  const active = [
    power.shield && { key: 'shield', label: POWERUP_INFO.shield.label, color: POWERUP_INFO.shield.color },
    power.magnet > 0 && {
      key: 'magnet',
      label: `${POWERUP_INFO.magnet.label} ${power.magnet}s`,
      color: POWERUP_INFO.magnet.color,
    },
    power.slow > 0 && {
      key: 'slow',
      label: `${POWERUP_INFO.slow.label} ${power.slow}s`,
      color: POWERUP_INFO.slow.color,
    },
  ].filter(Boolean);

  return (
    <div className="callouts" aria-live="polite">
      {running && active.length > 0 && (
        <ul className="power-chips" aria-label="Active power-ups">
          {active.map((c) => (
            <li key={c.key} className="power-chip" style={{ '--chip': c.color }}>
              {c.label}
            </li>
          ))}
        </ul>
      )}
      {hint && (
        <p className="coach" key={hint.text}>
          {hint.text}
        </p>
      )}
      {running && callout && (
        // key replays the pop animation for every near miss
        <p className="near-miss" key={callout.id}>
          Close call! +{callout.points}
          {callout.streak > 1 && (
            <span className="near-miss__streak">x{Math.min(callout.streak, 5)} streak</span>
          )}
        </p>
      )}
    </div>
  );
}
