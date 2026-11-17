import { useEffect, useState } from 'react';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { formatDistance, formatScore } from '../../systems/scoring/scoring.js';
import { isFullscreen, isFullscreenSupported, toggleFullscreen } from '../../utils/fullscreen.js';
import IconButton from './IconButton.jsx';
import SoundToggle from './SoundToggle.jsx';
import { ExitIcon, FullscreenIcon, PauseIcon, PlayIcon, RestartIcon } from './Icons.jsx';

/** In-game heads-up display. Pure UI: reads the store, calls store actions. */
export default function GameHUD() {
  const score = useGameStore((s) => s.score);
  const distance = useGameStore((s) => s.distance);
  const orbs = useGameStore((s) => s.orbs);
  const status = useGameStore((s) => s.status);
  const togglePause = useGameStore((s) => s.togglePause);
  const restart = useGameStore((s) => s.restart);
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  const paused = status === STATUS.PAUSED;
  const canPause = status === STATUS.RUNNING || paused;
  const showStats = status !== STATUS.OVER;

  const [fs, setFs] = useState(isFullscreen);
  useEffect(() => {
    const onChange = () => setFs(isFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  return (
    <div className="hud">
      <div className="hud__left">
        <IconButton label="Back to menu" onClick={exitToMenu}>
          <ExitIcon />
        </IconButton>
      </div>

      {showStats && (
        <div className="hud__stats" aria-live="off">
          <div className="stat">
            <span className="stat__label">Score</span>
            <span className="stat__value">{formatScore(score)}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Distance</span>
            <span className="stat__value">{formatDistance(distance)}</span>
          </div>
          <div className="stat stat--orbs">
            <span className="stat__label">Orbs</span>
            {/* key re-mounts the value so the pop animation replays on each pickup */}
            <span className="stat__value" key={orbs}>
              <span className="orb-dot" aria-hidden="true" />
              {orbs}
            </span>
          </div>
        </div>
      )}

      <div className="hud__right">
        <SoundToggle />
        {isFullscreenSupported() && (
          <IconButton label={fs ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen} pressed={fs}>
            <FullscreenIcon />
          </IconButton>
        )}
        <IconButton label="Restart" onClick={restart} className="hud__restart">
          <RestartIcon />
        </IconButton>
        <IconButton
          label={paused ? 'Resume' : 'Pause'}
          onClick={togglePause}
          className="icon-btn--accent"
          disabled={!canPause}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </IconButton>
      </div>
    </div>
  );
}
