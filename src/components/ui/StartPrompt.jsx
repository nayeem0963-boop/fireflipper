import { isCoarsePointer } from '../../utils/device.js';
import { RotateIcon } from './Icons.jsx';

/** "Get ready" instructions shown before the first flap. Non-interactive: taps pass through. */
export default function StartPrompt() {
  const touch = isCoarsePointer();
  const portrait = window.matchMedia?.('(orientation: portrait)').matches;
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
        Dodge the rocks, avoid the lava, collect <span className="orb-dot" aria-hidden="true" /> fire orbs,
        plus gems for a shield, magnet or slow-mo
      </p>
      {touch && portrait && (
        <p className="start-prompt__rotate">
          <RotateIcon /> Turn your phone sideways to see further ahead
        </p>
      )}
    </div>
  );
}
