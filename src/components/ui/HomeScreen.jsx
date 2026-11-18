import { useGameStore } from '../../store/useGameStore.js';
import SceneCanvas from '../scene/SceneCanvas.jsx';
import ShowcaseScene from '../../scenes/Showcase/ShowcaseScene.jsx';
import IconButton from './IconButton.jsx';
import SoundToggle from './SoundToggle.jsx';
import { FlameIcon, PlayIcon, SettingsIcon, TrophyIcon } from './Icons.jsx';
import { useSkin } from '../../hooks/useSkin.js';
import { ACHIEVEMENTS, achievementProgress, dailyGoalFor } from '../../systems/progression/progression.js';
import { collectionProgress } from '../../systems/avatars/avatars.js';
import { formatScore } from '../../systems/scoring/scoring.js';
import { unlockAudio } from '../../systems/audio/sfx.js';
import '../../styles/home.css';

export default function HomeScreen() {
  const bestScore = useGameStore((s) => s.bestScore);
  const startGame = useGameStore((s) => s.startGame);
  const startDemo = useGameStore((s) => s.startDemo);
  const openSettings = useGameStore((s) => s.openSettings);
  const settingsOpen = useGameStore((s) => s.settingsOpen);
  const avatarsOpen = useGameStore((s) => s.avatarsOpen);
  const openAvatars = useGameStore((s) => s.openAvatars);
  const flown = useGameStore((s) => s.flown);
  const skin = useSkin();
  const stats = useGameStore((s) => s.stats);
  const daily = useGameStore((s) => s.daily);
  const openAchievements = useGameStore((s) => s.openAchievements);
  const achievementsOpen = useGameStore((s) => s.achievementsOpen);
  const doneCount = ACHIEVEMENTS.filter((a) => achievementProgress(a, stats, bestScore).done).length;
  const progress = collectionProgress(bestScore, flown);

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
        <SceneCanvas camera={{ position: [0, 0.25, 6], fov: 45 }} frameloop={settingsOpen || avatarsOpen || achievementsOpen ? 'demand' : 'always'}>
          <ShowcaseScene />
        </SceneCanvas>
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
        <button
          type="button"
          className="ghost-btn home__demo"
          onClick={() => {
            unlockAudio();
            startDemo();
          }}
        >
          Watch auto play
          <small>A bot plays so you can see how. Nothing is scored.</small>
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

          <button type="button" className="card card--challenge card--button" onClick={openAchievements}>
            <div className="card__icon">
              <FlameIcon />
            </div>
            <div>
              <h2 className="card__label">Daily Fire Challenge{daily.done ? ' · done' : ''}</h2>
              <p className="card__value">{dailyGoalFor(daily.key).text}</p>
            </div>
          </button>
        </div>

        <div className="home__links">
        <button type="button" className="ghost-btn home__bird" onClick={openAchievements}>
          <TrophyIcon />
          <span>
            Achievements {doneCount}/{ACHIEVEMENTS.length}
            {daily.streakDays > 0 ? ` · ${daily.streakDays}-day streak` : ''}
          </span>
        </button>
        <button type="button" className="ghost-btn home__bird" onClick={openAvatars}>
          <FlameIcon />
          <span>
            Your bird: {skin.name} ({skin.colorName}) · {progress.unlocked}/{progress.total} skins
          </span>
        </button>
        </div>
      </section>
    </main>
  );
}
