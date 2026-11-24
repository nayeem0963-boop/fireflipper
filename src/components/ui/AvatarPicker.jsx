import { lazy, Suspense, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import {
  AVATAR_SPECIES,
  avatarFor,
  collectionProgress,
  avatarUnlockScore,
  isAvatarUnlocked,
  speciesProgress,
} from '../../systems/avatars/avatars.js';
import { LICENCE, getCredit } from '../../systems/avatars/credits.js';
import { formatScore } from '../../systems/scoring/scoring.js';
import { useSkin } from '../../hooks/useSkin.js';
import { useTheme } from '../../hooks/useTheme.js';
import IconButton from './IconButton.jsx';
import { CloseIcon } from './Icons.jsx';
import '../../styles/panel.css';
import '../../styles/avatars.css';

const PreviewCanvas = lazy(() => import('../scene/AvatarPreview.jsx'));

const swatch = (a) =>
  a.kind === 'firebird'
    ? { '--skin': a.palette.wing ?? '#ff6a1a', '--skin-2': a.palette.belly ?? '#ffb347' }
    : { '--skin': a.palette.mid, '--skin-2': a.palette.high };

const trailStyle = (a) => ({ background: `linear-gradient(90deg, ${a.trail.stops.join(', ')})` });

/**
 * Choose which bird to fly as. Layout: the live preview and collection progress on one side, a scrolling list of
 * colours and birds on the other, with a fixed header and footer, so it fits a short window with no page scroll.
 * Everything here is cosmetic: every bird flies and collides identically.
 */
export default function AvatarPicker() {
  const close = useGameStore((s) => s.closeAvatars);
  const openCredits = useGameStore((s) => s.openCredits);
  const bestScore = useGameStore((s) => s.bestScore);
  const flown = useGameStore((s) => s.flown);
  const selectSkin = useGameStore((s) => s.selectSkin);
  const current = useSkin();
  const theme = useTheme();
  const dialogRef = useRef(null);
  const credit = getCredit(current.species);
  const progress = collectionProgress(bestScore, flown, theme.id);
  // The theme's own colour first, then the other warm/cool one, then White.
  const order = { [theme.freeSkin]: 0, fire: 1, blue: 1, white: 2 };
  const colours = [...AVATAR_SPECIES.find((sp) => sp.id === current.species).variants].sort(
    (a, b) => order[a.color] - order[b.color],
  );

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Choosing a bird keeps the colour you are on when it is unlocked for that bird, else its Fire colour.
  const pickSpecies = (species) => {
    const same = avatarFor(species.id, current.color);
    selectSkin(isAvatarUnlocked(same, bestScore, theme.id) ? same.id : avatarFor(species.id, theme.freeSkin).id);
  };

  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="panel birds" role="dialog" aria-modal="true" aria-labelledby="avatars-title" tabIndex={-1} ref={dialogRef}>
        <header className="birds__header">
          <h2 id="avatars-title" className="panel__title">
            Choose your bird
          </h2>
          <span className="birds__count" aria-label={`${progress.unlocked} of ${progress.total} skins unlocked`}>
            {progress.unlocked}/{progress.total} skins
          </span>
          <IconButton label="Close" onClick={close}>
            <CloseIcon />
          </IconButton>
        </header>

        <section className="birds__stage" aria-label={`Preview of ${current.name} in ${current.colorName}`}>
          <div className="birds__preview">
            <Suspense fallback={null}>
              <PreviewCanvas avatar={current} />
            </Suspense>
          </div>
          <div className="birds__info">
            <p className="birds__name">
              {current.name} <span className="birds__colour">{current.colorName}</span>
            </p>
            {current.tagline && <p className="birds__tagline">{current.tagline}</p>}
            <p className="birds__trail">
              <span>Trail</span>
              <i style={trailStyle(current)} aria-hidden="true" />
            </p>
          </div>
        </section>

        <div className="birds__list">
          <section aria-label="Skin" className="birds__group">
            <h3 className="birds__heading">Skin</h3>
            <div className="birds__skins" role="radiogroup" aria-label="Skin">
              {colours.map((v) => {
                const unlocked = isAvatarUnlocked(v, bestScore, theme.id);
                const need = avatarUnlockScore(v, theme.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={current.id === v.id}
                    disabled={!unlocked}
                    className={`skin ${current.id === v.id ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}`}
                    style={swatch(v)}
                    onClick={() => selectSkin(v.id)}
                  >
                    <span className="skin__swatch" aria-hidden="true" />
                    <span className="skin__name">{v.colorName}</span>
                    {!unlocked && (
                      <span className="skin__lock">
                        Best score {formatScore(need)}
                        <br />
                        {formatScore(need - bestScore)} to go
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-label="Bird" className="birds__group">
            <h3 className="birds__heading">
              Bird <span className="birds__sub">Flown {progress.flownSpecies}/{progress.species}</span>
            </h3>
            <div className="birds__grid" role="radiogroup" aria-label="Bird">
              {AVATAR_SPECIES.map((sp) => {
                const shown = avatarFor(sp.id, current.color);
                const active = current.species === sp.id;
                const have = speciesProgress(sp.id, bestScore, theme.id);
                const flownRuns = flown[sp.id] ?? 0;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`skin skin--bird ${active ? 'is-active' : ''}`}
                    style={swatch(isAvatarUnlocked(shown, bestScore, theme.id) ? shown : avatarFor(sp.id, theme.freeSkin))}
                    onClick={() => pickSpecies(sp)}
                  >
                    <span className="skin__swatch" aria-hidden="true" />
                    <span className="skin__name">{sp.name}</span>
                    <span className="skin__meta">
                      {have.unlocked}/{have.total} skins{flownRuns > 0 ? ' · flown' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {credit && (
            <p className="birds__credit">
              Model &ldquo;{credit.title}&rdquo; by{' '}
              <a href={credit.authorUrl} target="_blank" rel="noopener noreferrer">
                {credit.author}
              </a>
              , licensed{' '}
              <a href={(credit.licence ?? LICENCE).url} target="_blank" rel="noopener noreferrer">
                {(credit.licence ?? LICENCE).name}
              </a>
              ; modified into a fire bird.{' '}
              <button type="button" className="link-btn" onClick={openCredits}>
                Details
              </button>
            </p>
          )}
        </div>

        <footer className="birds__footer">
          <div className="birds__bar" aria-hidden="true">
            <i style={{ width: `${Math.round((progress.unlocked / progress.total) * 100)}%` }} />
          </div>
          <p className="birds__note">
            {progress.nextUnlock != null
              ? `Next skin unlocks at a best score of ${formatScore(progress.nextUnlock)}. `
              : 'Every skin unlocked! '}
            Skins change how your bird looks, not how it flies.
          </p>
          <button type="button" className="play-btn play-btn--compact" onClick={close}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
