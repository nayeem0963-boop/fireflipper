import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { AVATAR_SPECIES, avatarFor, isAvatarUnlocked } from '../../systems/avatars/avatars.js';
import { LICENCE, getCredit } from '../../systems/avatars/credits.js';
import { useSkin } from '../../hooks/useSkin.js';
import SceneCanvas from '../scene/SceneCanvas.jsx';
import AvatarStage from '../../scenes/Showcase/AvatarStage.jsx';
import IconButton from './IconButton.jsx';
import { CloseIcon } from './Icons.jsx';
import '../../styles/panel.css';

const swatch = (a) =>
  a.kind === 'firebird'
    ? { '--skin': a.palette.wing ?? '#ff6a1a', '--skin-2': a.palette.belly ?? '#ffb347' }
    : { '--skin': a.palette.mid, '--skin-2': a.palette.high };

/** Choose which bird to fly as. A live preview shows the selection; model birds credit their authors. */
export default function AvatarPicker() {
  const close = useGameStore((s) => s.closeAvatars);
  const openCredits = useGameStore((s) => s.openCredits);
  const bestScore = useGameStore((s) => s.bestScore);
  const selectSkin = useGameStore((s) => s.selectSkin);
  const current = useSkin();
  const dialogRef = useRef(null);
  const credit = current.kind === 'model' ? getCredit(current.species) : null;

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Choosing a species keeps the colour you are on when that colour is free for it, else its Fire version.
  const pickSpecies = (species) => {
    const same = avatarFor(species.id, current.color);
    selectSkin(isAvatarUnlocked(same, bestScore) ? same.id : avatarFor(species.id, 'fire').id);
  };
  const colours = AVATAR_SPECIES.find((sp) => sp.id === current.species).variants;

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

        <div className="avatars__preview" aria-label={`Preview of ${current.name} in ${current.colorName}`}>
          <SceneCanvas camera={{ position: [0, 0.2, 6], fov: 40 }}>
            <AvatarStage avatar={current} />
          </SceneCanvas>
        </div>
        <p className="avatars__name">
          {current.name} <span className="avatars__colour">{current.colorName}</span>
        </p>
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

        <section className="avatars__group" aria-label="Colour">
          <h3 className="avatars__heading">Colour</h3>
          <div className="avatars__colours" role="radiogroup" aria-label="Colour">
            {colours.map((v) => {
              const unlocked = isAvatarUnlocked(v, bestScore);
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={current.id === v.id}
                  disabled={!unlocked}
                  className={`skin ${current.id === v.id ? 'is-active' : ''}`}
                  style={swatch(v)}
                  onClick={() => selectSkin(v.id)}
                >
                  <span className="skin__swatch" aria-hidden="true" />
                  <span className="skin__name">{v.colorName}</span>
                  {!unlocked && (
                    <span className="skin__lock">Best score {v.unlockScore.toLocaleString()}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="avatars__group" aria-label="Bird">
          <h3 className="avatars__heading">Bird</h3>
          <div className="avatars__grid" role="radiogroup" aria-label="Bird">
            {AVATAR_SPECIES.map((sp) => {
              const shown = avatarFor(sp.id, current.color);
              const active = current.species === sp.id;
              return (
                <button
                  key={sp.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`skin ${active ? 'is-active' : ''}`}
                  style={swatch(isAvatarUnlocked(shown, bestScore) ? shown : avatarFor(sp.id, 'fire'))}
                  onClick={() => pickSpecies(sp)}
                >
                  <span className="skin__swatch" aria-hidden="true" />
                  <span className="skin__name">{sp.name}</span>
                </button>
              );
            })}
          </div>
        </section>
        <p className="panel__note">Your choice changes how your bird looks, not how it flies.</p>
      </div>
    </div>
  );
}
