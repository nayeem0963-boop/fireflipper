import { useGameStore } from '../../store/useGameStore.js';
import { dailyGoalFor, nextGoal } from '../../systems/progression/progression.js';
import { isCoarsePointer } from '../../utils/device.js';
import { RotateIcon } from './Icons.jsx';
import { useGameVersion } from '../../hooks/useGameVersion.js';
import { isRunner } from '../../systems/versions/versions.js';

/** "Get ready" instructions shown before the first flap. Non-interactive: taps pass through. */
export default function StartPrompt() {
  const stats = useGameStore((s) => s.stats);
  const bestScore = useGameStore((s) => s.bestScore);
  const daily = useGameStore((s) => s.daily);
  const goal = nextGoal(stats, bestScore);
  const dailyGoal = daily.done ? null : dailyGoalFor(daily.key);
  const runner = isRunner(useGameVersion());
  const touch = isCoarsePointer();
  const portrait = window.matchMedia?.('(orientation: portrait)').matches;
  return (
    <div className="start-prompt" aria-live="polite">
      {/* v2 (the ground-runner) has its own wording: she runs on the land and TAP is a jump */}
      <p className="start-prompt__title">
        {runner ? (touch ? 'Tap to jump' : 'Click or press Space to jump') : touch ? 'Tap to fly' : 'Click or press Space to fly'}
      </p>
      <ul className="start-prompt__tips">
        <li>
          <strong>{touch ? 'Tap' : 'Tap / Space'}</strong> {runner ? 'jump' : 'flap'}
        </li>
        <li>
          <strong>Hold</strong> {runner ? 'jump higher' : 'climb higher'}
        </li>
        <li>
          <strong>Release</strong> {runner ? 'a short hop' : 'fall'}
        </li>
        {!touch && (
          <li>
            <kbd>↓</kbd> / <kbd>S</kbd> {runner ? 'drop fast' : 'dive'}
          </li>
        )}
      </ul>
      <p className="start-prompt__goal">
        {runner ? (
          <>
            Jump the rocks and ice, leap the crevasses, collect <span className="orb-dot" aria-hidden="true" /> orbs
          </>
        ) : (
          <>
            Dodge the rocks, avoid the lava, collect <span className="orb-dot" aria-hidden="true" /> fire orbs
          </>
        )}
      </p>
      {(goal || dailyGoal) && (
        <p className="start-prompt__run-goal">
          {goal && (
            <span>
              Goal: <strong>{goal.text}</strong>
            </span>
          )}
          {dailyGoal && (
            <span>
              Daily: <strong>{dailyGoal.text}</strong>
            </span>
          )}
        </p>
      )}
      {touch && portrait && (
        <p className="start-prompt__rotate">
          <RotateIcon /> Turn your phone sideways to see further ahead
        </p>
      )}
    </div>
  );
}
