import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { AVATARS, isAvatarUnlocked } from '../../systems/avatars/avatars.js';
import { LICENCE, getCredit } from '../../systems/avatars/credits.js';
import { useSkin } from '../../hooks/useSkin.js';
import SceneCanvas from '../scene/SceneCanvas.jsx';
import AvatarStage from '../../scenes/Showcase/AvatarStage.jsx';
import IconButton from './IconButton.jsx';
import { CloseIcon } from './Icons.jsx';
import '../../styles/panel.css';

const swatch = (a) =>
  a.kind === 'model'
    ? { '--skin': a.palette.mid, '--skin-2': a.palette.high }
    : { '--skin': a.palette.wing ?? '#ff6a1a', '--skin-2': a.palette.belly ?? '#ffb347' };

/** Choose which bird to fly as. A live preview shows the selection; model birds credit their authors. */
export default function AvatarPicker() {
  const close = useGameStore((s) => s.closeAvatars);
  const openCredits = useGameStore((s) => s.openCredits);
  const bestScore = useGameStore((s) => s.bestScore);
  const selectSkin = useGameStore((s) => s.selectSkin);
  const current = useSkin();
  const dialogRef = useRef(null);
  const credit = current.kind === 'model' ? getCredit(current.id) : null;

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const group = (title, kind) => (
    <section className="avatars__group" aria-label={title}>
      <h3 className="avatars__heading">{title}</h3>
      <div className="avatars__grid" role="radiogroup" aria-label={title}>
        {AVATARS.filter((a) => a.kind === kind).map((a) => {
          const unlocked = isAvatarUnlocked(a, bestScore);
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={current.id === a.id}
              disabled={!unlocked}
              className={`skin ${current.id === a.id ? 'is-active' : ''}`}
              style={swatch(a)}
              onClick={() => selectSkin(a.id)}
            >
              <span className="skin__swatch" aria-hidden="true" />
              <span className="skin__name">{a.name}</span>
              {!unlocked && <span className="skin__lock">Best score {a.unlockScore.toLocaleString()}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="panel panel--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatars-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="panel__header">
          <h2 id="avatars-title" className="panel__title">
            Choose your bird
          </h2>
          <IconButton label="Close" onClick={close}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="avatars__preview" aria-label={`Preview of ${current.name}`}>
          <SceneCanvas camera={{ position: [0, 0.2, 6], fov: 40 }}>
            <AvatarStage avatar={current} />
          </SceneCanvas>
        </div>
        <p className="avatars__name">{current.name}</p>
        {current.tagline && <p className="avatars__tagline">{current.tagline}</p>}
        {credit && (
          <p className="avatars__credit">
            Model &ldquo;{credit.title}&rdquo; by{' '}
            <a href={credit.authorUrl} target="_blank" rel="noopener noreferrer">
              {credit.author}
            </a>
            , licensed{' '}
            <a href={LICENCE.url} target="_blank" rel="noopener noreferrer">
              {LICENCE.name}
            </a>
            ; modified into a fire bird.{' '}
            <button type="button" className="link-btn" onClick={openCredits}>
              Details
            </button>
          </p>
        )}

        {group('Fire Flipper', 'firebird')}
        {group('Fire-lit wildlife', 'model')}
        <p className="panel__note">Your choice changes how your bird looks, not how it flies.</p>
      </div>
    </div>
  );
}
