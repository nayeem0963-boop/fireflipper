import { lazy, Suspense } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import IconButton from './IconButton.jsx';
import SoundToggle from './SoundToggle.jsx';
import { FlameIcon, PlayIcon, SettingsIcon, TrophyIcon } from './Icons.jsx';
import { formatScore } from '../../systems/scoring/scoring.js';
import { unlockAudio } from '../../systems/audio/sfx.js';
import '../../styles/home.css';

const HomeStage = lazy(() => import('../scene/HomeStage.jsx'));

export default function HomeScreen() {
  const bestScore = useGameStore((s) => s.bestScore);
  const startGame = useGameStore((s) => s.startGame);
  const openSettings = useGameStore((s) => s.openSettings);
  const settingsOpen = useGameStore((s) => s.settingsOpen);

  return (
    <main className="home">
      <header className="home__topbar">
        <span className="home__domain">fireflipper.com</span>
        <div className="home__topbar-actions">
          <SoundToggle />
          <IconButton label="Settings" onClick={openSettings}>
            <SettingsIcon />
          </IconButton>
        </div>
      </header>

      <section className="home__stage" aria-label="Firebird preview">
        {/* Stop rendering the preview while the settings modal covers it */}
        <Suspense fallback={null}>
          <HomeStage paused={settingsOpen} />
        </Suspense>
      </section>

      <section className="home__brand">
        <h1 className="logo">
          <span className="logo__fire">Fire</span>
          <span className="logo__flipper">Flipper</span>
        </h1>
        <p className="tagline">Flip. Burn. Survive.</p>
      </section>

      <section className="home__actions">
        <button
          type="button"
          className="play-btn"
          onClick={() => {
            unlockAudio();
            startGame();
          }}
          autoFocus
        >
          <PlayIcon />
          <span>Play</span>
        </button>

        <div className="home__cards">
          <article className="card">
            <div className="card__icon">
              <TrophyIcon />
            </div>
            <div>
              <h2 className="card__label">Best score</h2>
              <p className="card__value">{bestScore > 0 ? formatScore(bestScore) : '—'}</p>
            </div>
          </article>

          <article className="card card--challenge">
            <div className="card__icon">
              <FlameIcon />
            </div>
            <div>
              <h2 className="card__label">Daily Fire Challenge</h2>
              <p className="card__value card__value--muted">Coming soon</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
