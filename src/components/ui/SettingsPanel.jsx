import { useEffect, useRef } from 'react';
import { useGameStore, QUALITY } from '../../store/useGameStore.js';
import { useSkin } from '../../hooks/useSkin.js';
import { isHapticsSupported } from '../../utils/haptics.js';
import IconButton from './IconButton.jsx';
import { CloseIcon } from './Icons.jsx';
import '../../styles/panel.css';

const QUALITY_OPTIONS = [
  { value: QUALITY.AUTO, label: 'Auto' },
  { value: QUALITY.LOW, label: 'Low' },
  { value: QUALITY.HIGH, label: 'High' },
];

/** Settings modal. Placeholder: only sound and graphics quality for now. */
export default function SettingsPanel() {
  const close = useGameStore((s) => s.closeSettings);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const hapticsEnabled = useGameStore((s) => s.hapticsEnabled);
  const toggleHaptics = useGameStore((s) => s.toggleHaptics);
  const quality = useGameStore((s) => s.quality);
  const setQuality = useGameStore((s) => s.setQuality);
  const openAvatars = useGameStore((s) => s.openAvatars);
  const openCredits = useGameStore((s) => s.openCredits);
  const skin = useSkin();
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="panel__header">
          <h2 id="settings-title" className="panel__title">
            Settings
          </h2>
          <IconButton label="Close settings" onClick={close}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="setting">
          <span className="setting__label">Sound</span>
          <button
            type="button"
            className={`switch ${soundEnabled ? 'is-on' : ''}`}
            role="switch"
            aria-checked={soundEnabled}
            onClick={toggleSound}
          >
            <span className="switch__thumb" />
          </button>
        </div>

        {isHapticsSupported() && (
          <div className="setting">
            <span className="setting__label">Vibration</span>
            <button
              type="button"
              className={`switch ${hapticsEnabled ? 'is-on' : ''}`}
              role="switch"
              aria-checked={hapticsEnabled}
              aria-label="Vibration"
              onClick={toggleHaptics}
            >
              <span className="switch__thumb" />
            </button>
          </div>
        )}

        <div className="setting">
          <span className="setting__label" id="quality-label">
            Graphics
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="quality-label">
            {QUALITY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={quality === o.value}
                className={quality === o.value ? 'is-active' : ''}
                onClick={() => setQuality(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <span className="setting__label">Bird</span>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              close();
              openAvatars();
            }}
          >
            {skin.name} ({skin.colorName})
          </button>
        </div>

        <div className="setting">
          <span className="setting__label">Model credits</span>
          <button type="button" className="ghost-btn" onClick={openCredits}>
            View
          </button>
        </div>

        <p className="panel__note">
          More options (controls, accessibility, account) arrive in later updates.
        </p>
      </div>
    </div>
  );
}
