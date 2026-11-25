import { useEffect, useRef } from 'react';
import { useGameStore, QUALITY } from '../../store/useGameStore.js';
import ThemeSwitch from './ThemeSwitch.jsx';
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
  const quality = useGameStore((s) => s.quality);
  const setQuality = useGameStore((s) => s.setQuality);
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} ref={dialogRef}>
        <div className="panel__header">
          <h2 id="settings-title" className="panel__title">Settings</h2>
          <IconButton label="Close settings" onClick={close}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="setting">
          <span className="setting__label">Sound</span>
          <button type="button" className={`switch ${soundEnabled ? 'is-on' : ''}`} role="switch" aria-checked={soundEnabled} onClick={toggleSound}>
            <span className="switch__thumb" />
          </button>
        </div>

        <div className="setting">
          <span className="setting__label">Theme</span>
          <ThemeSwitch />
        </div>

        <div className="setting">
          <span className="setting__label" id="quality-label">Graphics</span>
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

        <p className="panel__note">More options (controls, accessibility, account) arrive in later updates.</p>
      </div>
    </div>
  );
}
