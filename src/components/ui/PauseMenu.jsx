import { useGameStore } from '../../store/useGameStore.js';
import { PlayIcon } from './Icons.jsx';
import '../../styles/panel.css';

export default function PauseMenu() {
  const resume = useGameStore((s) => s.resume);
  const restart = useGameStore((s) => s.restart);
  const exitToMenu = useGameStore((s) => s.exitToMenu);

  return (
    <div className="overlay overlay--soft">
      <div className="panel panel--center" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <h2 id="pause-title" className="panel__title panel__title--big">Paused</h2>
        <button type="button" className="play-btn play-btn--compact" onClick={resume} autoFocus>
          <PlayIcon />
          <span>Resume</span>
        </button>
        <div className="panel__row">
          <button type="button" className="ghost-btn" onClick={restart}>Restart</button>
          <button type="button" className="ghost-btn" onClick={exitToMenu}>Main menu</button>
        </div>
      </div>
    </div>
  );
}
