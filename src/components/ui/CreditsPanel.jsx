import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { CREDITS, FIRE_FLIPPER_CHANGES, LICENCE } from '../../systems/avatars/credits.js';
import { AVATARS } from '../../systems/avatars/avatars.js';
import IconButton from './IconButton.jsx';
import { CloseIcon } from './Icons.jsx';
import '../../styles/panel.css';
import '../../styles/avatars.css';

/**
 * Credits for the third-party bird models. CC BY 4.0 requires the author to be credited, the licence linked and
 * changes indicated, so all three are shown for every model.
 */
export default function CreditsPanel() {
  const close = useGameStore((s) => s.closeCredits);
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
        className="panel panel--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="panel__header">
          <h2 id="credits-title" className="panel__title">
            Credits
          </h2>
          <IconButton label="Close credits" onClick={close}>
            <CloseIcon />
          </IconButton>
        </div>

        <p className="panel__note">
          The fire-lit wildlife birds are 3D models by other artists, shared under{' '}
          <a href={LICENCE.url} target="_blank" rel="noopener noreferrer">
            {LICENCE.name}
          </a>
          , except the Fire Eagle, which has its own licence (shown with it). Fire Flipper changed each of them as described
          below.
        </p>

        <ul className="credits">
          {CREDITS.map((c) => {
            const bird = AVATARS.find((a) => a.species === c.id);
            return (
              <li key={c.id} className="credits__item">
                <p className="credits__title">
                  {bird?.name ?? c.title}
                  <span className="credits__sub"> · &ldquo;{c.title}&rdquo;</span>
                </p>
                <p className="credits__line">
                  By{' '}
                  <a href={c.authorUrl} target="_blank" rel="noopener noreferrer">
                    {c.author}
                  </a>{' '}
                  ·{' '}
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Source
                  </a>{' '}
                  ·{' '}
                  <a href={(c.licence ?? LICENCE).url} target="_blank" rel="noopener noreferrer">
                    {(c.licence ?? LICENCE).name}
                  </a>
                </p>
                <p className="credits__changes">
                  Changes: {[...c.changes, ...FIRE_FLIPPER_CHANGES].join(' ')}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
