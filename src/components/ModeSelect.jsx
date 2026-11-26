import { useGameStore } from '../store/useGameStore.js';
import { GAMES_CONFIG } from '../systems/versions/versions.js';
import '../styles/versions.css';

/**
 * The mode chooser on the menu: two cards side by side, FireFlipper: Phoenix Flight (v1, the flying game) and FireFlipper: Flame Runner
 * (v2, the ground-runner). Each shows a picture, a one-line subtitle and its keys. Picking a card selects that mode's version
 * (instant, saved, and kept in the address bar as ?version=), and Play then starts it. Everything shown comes from systems/versions.
 */
function ModeIcon({ mode }) {
  // Two small drawings: a bird with swept wings (flight) and a figure mid-stride (runner).
  return mode === 'PHOENIX_FLIGHT' ? (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" focusable="false" className="modecard__icon">
      <path d="M4 26c8-2 13-8 20-16 2 8 7 12 20 14-9 1-13 4-17 10-1-5-4-8-10-8-5 0-9 0-13 0z" fill="currentColor" opacity="0.92" />
      <path d="M24 34c-1 4-3 7-7 10 6 0 10-2 12-6z" fill="currentColor" opacity="0.6" />
      <circle cx="31" cy="21" r="1.6" fill="var(--bg)" />
    </svg>
  ) : (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" focusable="false" className="modecard__icon">
      <circle cx="28" cy="9" r="4.5" fill="currentColor" />
      <path d="M26 15l-7 9 5 3-4 11 4 1 5-12 4 5-1 8h4l1-10-5-8 3-4 6 3 2-3-8-5z" fill="currentColor" opacity="0.92" />
      <path d="M4 42h40" stroke="currentColor" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ModeSelect() {
  const versionId = useGameStore((s) => s.versionId);
  const selectVersion = useGameStore((s) => s.selectVersion);

  return (
    <div className="modes" role="radiogroup" aria-label="Choose a game mode">
      {GAMES_CONFIG.map((v) => {
        const active = v.id === versionId;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`modecard${active ? ' is-active' : ''}`}
            data-mode={v.mode}
            onClick={() => selectVersion(v.id)}
          >
            <ModeIcon mode={v.mode} />
            <span className="modecard__text">
              <span className="modecard__title">{v.title}</span>
              <span className="modecard__sub">{v.subtitle}</span>
              <span className="modecard__keys">
                {v.controls.map((c) => (
                  <span key={c.label} className="modecard__key">
                    {c.keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}{' '}
                    {c.label}
                  </span>
                ))}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
