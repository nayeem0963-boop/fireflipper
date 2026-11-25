import { lazy, Suspense } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import IconButton from './IconButton.jsx';
import SoundToggle from './SoundToggle.jsx';
import ThemeSwitch from './ThemeSwitch.jsx';
import VersionPicker from './VersionPicker.jsx';
import { FlameIcon, PlayIcon, SettingsIcon, TrophyIcon } from './Icons.jsx';
import { useSkin } from '../../hooks/useSkin.js';
import { ACHIEVEMENTS, achievementProgress, dailyGoalFor } from '../../systems/progression/progression.js';
import { useTheme } from '../../hooks/useTheme.js';
import { useGameVersion } from '../../hooks/useGameVersion.js';
import { usesOriginalAvatar } from '../../systems/versions/versions.js';
import { AVATAR_SPECIES, avatarFor, collectionProgress, isAvatarUnlocked } from '../../systems/avatars/avatars.js';
import { FREE_COLOR } from '../../systems/skins/skins.js';
import { REWARDS, ownedCount } from '../../systems/rewards/rewards.js';
import { formatScore } from '../../systems/scoring/scoring.js';
import { unlockAudio } from '../../systems/audio/sfx.js';
import '../../styles/home.css';

const HomeStage = lazy(() => import('../scene/HomeStage.jsx'));

export default function HomeScreen() {
  const bestScore = useGameStore((s) => s.bestScore);
  const startGame = useGameStore((s) => s.startGame);
  const startDemo = useGameStore((s) => s.startDemo);
  const startPreview = useGameStore((s) => s.startPreview);
  const openSettings = useGameStore((s) => s.openSettings);
  const settingsOpen = useGameStore((s) => s.settingsOpen);
  const avatarsOpen = useGameStore((s) => s.avatarsOpen);
  const openAvatars = useGameStore((s) => s.openAvatars);
  const flown = useGameStore((s) => s.flown);
  const skin = useSkin();
  const version = useGameVersion();
  const theme = useTheme();
  const selectSkin = useGameStore((s) => s.selectSkin);
  const stats = useGameStore((s) => s.stats);
  const daily = useGameStore((s) => s.daily);
  const openAchievements = useGameStore((s) => s.openAchievements);
  const achievementsOpen = useGameStore((s) => s.achievementsOpen);
  const openRewards = useGameStore((s) => s.openRewards);
  const rewardsOpen = useGameStore((s) => s.rewardsOpen);
  const journey = useGameStore((s) => s.journey);
  const doneCount = ACHIEVEMENTS.filter((a) => achievementProgress(a, stats, bestScore).done).length;
  const progress = collectionProgress(bestScore, flown, theme.id);

  return (
    <main className="home">
      <header className="home__topbar">
        <span className="home__domain">fireflipper.com</span>
        <div className="home__topbar-actions">
          <ThemeSwitch compact />
          <SoundToggle />
          <IconButton label="Settings" onClick={openSettings}>
            <SettingsIcon />
          </IconButton>
        </div>
      </header>

      <div className="home__stagewrap">
        <section className="home__stage" aria-label="Bird preview">
          <Suspense fallback={null}>
            <HomeStage paused={settingsOpen || avatarsOpen || achievementsOpen || rewardsOpen} />
          </Suspense>
        </section>

        {/* Every bird is one tap away: the six species, in the colour you have chosen when it is unlocked */}
        {/* The bird strip picks the v1 bird; other versions draw their own avatar, so it is hidden there */}
        {usesOriginalAvatar(version) && (
        <div className="home__birds" role="radiogroup" aria-label="Choose your bird">
          {AVATAR_SPECIES.map((sp) => {
            const shown = avatarFor(sp.id, skin.color);
            const pick = isAvatarUnlocked(shown, bestScore, theme.id) ? shown : avatarFor(sp.id, FREE_COLOR);
            const active = skin.species === sp.id;
            const p = pick.kind === 'firebird' ? [pick.palette.wing ?? '#ff6a1a', pick.palette.belly ?? '#ffb347'] : [pick.palette.mid, pick.palette.high];
            return (
              <button
                key={sp.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`birdchip${active ? ' is-active' : ''}`}
                style={{ '--skin': p[0], '--skin-2': p[1] }}
                onClick={() => selectSkin(pick.id)}
              >
                <span className="birdchip__dot" aria-hidden="true" />
                <span className="birdchip__name">{sp.name}</span>
              </button>
            );
          })}
        </div>
        )}
      </div>

      <section className="home__brand">
        <h1 className="logo" aria-label="Fire Flipper">
          <span className="logo__fire">Fire</span>
          <span className="logo__flipper">Flipper</span>
        </h1>
        <p className="edition">Journey to the Celestial City</p>
        <p className="tagline">Five worlds. One extraordinary journey.</p>
      </section>

      <section className="home__actions">
        <VersionPicker />
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
        <div className="home__watch">
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
          <button
            type="button"
            className="ghost-btn home__demo home__preview"
            onClick={() => {
              unlockAudio();
              startPreview();
            }}
          >
            Journey Preview
            <small>Watch all five worlds and the ending. Nothing is saved.</small>
          </button>
        </div>

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
        <button type="button" className="ghost-btn home__bird" onClick={openRewards}>
          <TrophyIcon />
          <span>
            Rewards · {ownedCount(journey)}/{REWARDS.length}
          </span>
        </button>
        <button type="button" className="ghost-btn home__bird" onClick={openAvatars}>
          <FlameIcon />
          <span>
            Skins · {progress.unlocked}/{progress.total}
          </span>
        </button>
        </div>
      </section>
    </main>
  );
}
