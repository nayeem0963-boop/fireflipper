import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { STREAK, POWERUPS } from '../../systems/physics/constants.js';
import { nextTier } from '../../systems/scoring/streak.js';
import { MagnetIcon, ShieldIcon } from './Icons.jsx';

/**
 * The score multiplier, front and centre. Shows:
 *  - the multiplier (x1..x5), popping when it goes up and shaking red when a streak ends
 *  - the streak length and how many more collections reach the next multiplier
 *  - a bar that drains over the streak window: collect something before it empties to keep the streak
 *  - which power-ups are active (shield held, magnet time remaining)
 * The two bars are CSS animations restarted by key, so React does not re-render at frame rate.
 */
export default function StreakMeter() {
  const play = useGameStore((s) => s.play);
  const status = useGameStore((s) => s.status);
  // The timer lives in the simulation, which is frozen when paused or once the bird has crashed.
  const paused = status === STATUS.PAUSED || status === STATUS.DYING || status === STATUS.OVER;
  const { streak, mult, stamp, shield, magnet, magnetStamp, breakStamp, breakReason } = play;
  const next = nextTier(streak);
  const live = streak > 0;

  return (
    <div className={`streak${paused ? ' is-paused' : ''}${live ? ' is-live' : ''}`} data-mult={mult} aria-live="off">
      <div className="streak__main">
        {/* key restarts the pop (tier up) or shake (streak lost) animation */}
        <span className="streak__mult" key={`m${mult}`}>
          ×{mult}
        </span>
        <span className="streak__text" key={`b${breakStamp}`} data-broke={breakStamp > 0 && !live ? breakReason : undefined}>
          {live ? (
            <>
              <strong>{streak}</strong> streak
              {next ? <span className="streak__next"> · ×{next.mult} at {next.at}</span> : <span className="streak__next"> · max</span>}
            </>
          ) : breakStamp > 0 && breakReason === 'shield' ? (
            'Shield saved you: streak lost'
          ) : breakStamp > 0 ? (
            'Streak lost'
          ) : (
            'Collect orbs to build a streak'
          )}
        </span>
      </div>
      <div className="streak__bar" aria-hidden="true">
        {live && <i key={stamp} style={{ animationDuration: `${STREAK.window}s` }} />}
      </div>
      {(shield || magnet) && (
        <div className="streak__power">
          {shield && (
            <span className="power power--shield" title="Shield: absorbs one hit">
              <ShieldIcon /> Shield
            </span>
          )}
          {magnet && (
            <span className="power power--magnet" title="Magnet: pulls orbs toward you">
              <MagnetIcon />
              <span className="power__bar">
                <i key={magnetStamp} style={{ animationDuration: `${POWERUPS.magnetTime}s` }} />
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
