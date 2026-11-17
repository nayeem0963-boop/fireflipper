import { useEffect } from 'react';
import { useGameStore, STATUS } from '../../store/useGameStore.js';

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
  const tutorialDone = useGameStore((s) => s.tutorialDone);
  const completeTutorial = useGameStore((s) => s.completeTutorial);
  const running = status === STATUS.RUNNING;

  useEffect(() => {
    if (running && !tutorialDone && distance >= TUTORIAL_END) completeTutorial();
  }, [running, tutorialDone, distance, completeTutorial]);

  const hint = running && !tutorialDone ? HINTS.find((h) => distance < h.until) : null;

  return (
    <div className="callouts" aria-live="polite">
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
