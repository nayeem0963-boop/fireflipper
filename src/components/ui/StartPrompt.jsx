import { isCoarsePointer } from '../../utils/device.js';

/** "Get ready" instructions shown before the first flap. Non-interactive: taps pass through. */
export default function StartPrompt() {
  const touch = isCoarsePointer();
  return (
    <div className="start-prompt" aria-live="polite">
      <p className="start-prompt__title">{touch ? 'Tap to fly' : 'Click or press Space to fly'}</p>
      <ul className="start-prompt__tips">
        <li>
          <strong>{touch ? 'Tap' : 'Tap / Space'}</strong> flap
        </li>
        <li>
          <strong>Hold</strong> climb higher
        </li>
        <li>
          <strong>Release</strong> fall
        </li>
        {!touch && (
          <li>
            <kbd>↓</kbd> / <kbd>S</kbd> dive
          </li>
        )}
      </ul>
      <p className="start-prompt__goal">
        Dodge the rocks, avoid the lava, collect <span className="orb-dot" aria-hidden="true" /> fire orbs
      </p>
    </div>
  );
}
