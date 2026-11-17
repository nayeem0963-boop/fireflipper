import { lazy, Suspense } from 'react';
import { useGameStore, MODE } from '../../store/useGameStore.js';
import IconButton from './IconButton.jsx';
import SoundToggle from './SoundToggle.jsx';
import { FlameIcon, PlayIcon, SettingsIcon, TrophyIcon } from './Icons.jsx';
import { formatScore } from '../../systems/scoring/scoring.js';
import { useSkin } from '../../hooks/useSkin.js';
import { todayKey } from '../../utils/daily.js';
import { unlockAudio } from '../../systems/audio/sfx.js';
import '../../styles/home.css';

const HomeStage = lazy(() => import('../scene/HomeStage.jsx'));

export default function HomeScreen() {
  const bestScore = useGameStore((s) => s.bestScore);
  const startGame = useGameStore((s) => s.startGame);
  const dailyBests = useGameStore((s) => s.dailyBests);
  const todaysBest = dailyBests[todayKey()];
  const openSettings = useGameStore((s) => s.openSettings);
  const settingsOpen = useGameStore((s) => s.settingsOpen);
  const leaderboardOpen = useGameStore((s) => s.leaderboardOpen);
  const openLeaderboard = useGameStore((s) => s.openLeaderboard);
  const openAvatars = useGameStore((s) => s.openAvatars);
  const avatarsOpen = useGameStore((s) => s.avatarsOpen);
  const skin = useSkin();

  return (
    <main className="home">
      <header className="home__topbar">
        <span className="home__domain">fireflipper.com</span>
        <div className="home__topbar-actions">
          <SoundToggle />
          <IconButton label="Leaderboard" onClick={openLeaderboard}>
            <TrophyIcon />
          </IconButton>
          <IconButton label="Settings" onClick={openSettings}>
            <SettingsIcon />
          </IconButton>
        </div>
      </header>

      <section className="home__stage" aria-label="Firebird preview">
        {/* Stop rendering the preview while the settings modal covers it */}
        <Suspense fallback={null}>
          <HomeStage paused={settingsOpen || leaderboardOpen || avatarsOpen} />
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

          <button
            type="button"
            className="card card--challenge card--button"
            onClick={() => {
              unlockAudio();
              startGame(MODE.DAILY);
            }}
          >
            <div className="card__icon">
              <FlameIcon />
            </div>
            <div>
              <h2 className="card__label">Daily Fire Challenge</h2>
              <p className="card__value">
                {todaysBest ? `Today: ${formatScore(todaysBest)}` : 'New track every day'}
              </p>
            </div>
          </button>
        </div>

        <button type="button" className="ghost-btn home__bird" onClick={openAvatars}>
          <FlameIcon />
          <span>
            Your bird: {skin.name} ({skin.colorName})
          </span>
        </button>
      </section>
    </main>
  );
}
