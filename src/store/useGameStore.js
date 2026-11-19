import { create } from 'zustand';
import { loadValue, saveValue } from '../utils/storage.js';
import { newlyUnlocked } from '../systems/skins/skins.js';
import { DEFAULT_THEME, applyTheme, getTheme } from '../systems/theme/themes.js';
import {
  EMPTY_STATS,
  applyRun,
  completeDaily,
  dailyGoalFor,
  dailyMet,
  dayKey,
  newlyEarned,
  nextGoal,
  rollDaily,
} from '../systems/progression/progression.js';
import { avatarFor, getAvatar, isAvatarUnlocked, resolveAvatar } from '../systems/avatars/avatars.js';
import { reachMilestone, sanitizeJourney } from '../systems/rewards/rewards.js';
import { previewRewardIds, previewSeedFor } from '../systems/rewards/preview.js';
import { WORLD_COUNT } from '../systems/world/worlds.js';

export const SCREENS = Object.freeze({ HOME: 'home', GAME: 'game' });

/**
 * Run lifecycle (mirrors the simulation's phases, plus PAUSED):
 *   READY → RUNNING → DYING → OVER, with RUNNING ⇄ PAUSED; or READY → RUNNING → COMPLETE (the finish line at 10,000 m was crossed alive).
 */
export const STATUS = Object.freeze({
  IDLE: 'idle',
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  DYING: 'dying',
  OVER: 'over',
  COMPLETE: 'complete',
});

export const QUALITY = Object.freeze({ AUTO: 'auto', LOW: 'low', HIGH: 'high' });

/**
 * Global game/UI state.
 *
 * This store holds state the UI *reacts* to: screens, run status, HUD
 * numbers, results and settings. Per-frame simulation data lives in the
 * plain-JS simulation (systems/game) and only reaches the store through
 * throttled HUD snapshots and discrete events, so React never re-renders
 * at frame rate.
 */
export const useGameStore = create((set, get) => ({
  // --- navigation ---
  screen: SCREENS.HOME,
  settingsOpen: false,
  /** Auto play (watch-only): a bot flies, nothing is scored or saved. Keep this feature (see CLAUDE.md). */
  demo: false,
  /**
   * Journey Preview: Auto play flown through all five worlds to the ending, with the milestone banners, the celebration and a SIMULATED reward screen. Always together with `demo`
   * (so every persistence path that ignores Auto play ignores this too), and nothing it shows is ever granted or saved: see `persistProgress`.
   */
  preview: false,
  /** The track seed the preview flies (a verified one), or null. */
  previewSeed: null,
  avatarsOpen: false,
  achievementsOpen: false,
  creditsOpen: false,
  rewardsOpen: false,

  // --- current run ---
  status: STATUS.IDLE,
  score: 0,
  distance: 0,
  orbs: 0,
  runId: 0, // bumped on every (re)start; the game loop resets the sim on change
  overAt: 0,
  /** Index (0 to 4) of the last milestone this run has handled, -1 before the first: each is handled once. */
  milestoneIndex: -1,
  /** The milestone being announced (a small banner, not persisted): { id, index, name, at, granted: [reward ids] }. */
  milestone: null,
  /** Reward ids granted during this run (for the results screens). */
  runRewards: [],
  /** Stats of the last finished run, plus isNewBest and the previousBest it was measured against. */
  lastResult: null,

  // --- scores ---
  bestScore: loadValue('bestScore', 0),
  /** Best score since the page was opened (not persisted). */
  sessionBest: 0,
  runsThisSession: 0,

  /** Selected bird skin id (species + colour). Cosmetic only: no effect on physics or collisions. */
  skinId: initialSkins().active,
  /** Each theme remembers its own bird choice: { red: 'flipper-fire', blue: 'toco-toucan-blue', ... }. */
  skinsByTheme: initialSkins().byTheme,
  /** Completed runs per bird species, for collection progress: { species: runs }. */
  flown: loadValue('flown', {}),

  // --- progression (see systems/progression) ---
  stats: { ...EMPTY_STATS, ...loadValue('stats', {}) },
  /** Earned achievements: { id: run number it was earned on }. */
  earned: loadValue('achievements', {}),
  /** Today's goal state: { key, done, streakDays, lastDoneKey }. */
  daily: rollDaily(loadValue('daily', null), dayKey()),

  /** The journey record (see systems/rewards): the permanent rewards owned, completions and how often each milestone was reached. Saved the moment a reward is granted. */
  journey: sanitizeJourney(loadValue('journey', null)),

  /** Visual theme id ('red' | 'blue'): looks only, no effect on gameplay. */
  theme: initialTheme(),

  // --- settings ---
  soundEnabled: loadValue('soundEnabled', true),
  quality: loadValue('quality', QUALITY.AUTO),

  // --- navigation actions ---
  startGame: () =>
    set((s) => ({
      screen: SCREENS.GAME,
      demo: false,
      preview: false,
      ...freshRun(s, false),
    })),
  startDemo: () =>
    set((s) => ({
      screen: SCREENS.GAME,
      demo: true,
      preview: false,
      ...freshRun(s, false),
    })),
  /** The Journey Preview: Auto play with the whole journey's presentation, and no permanent effect of any kind. */
  startPreview: () =>
    set((s) => ({
      screen: SCREENS.GAME,
      demo: true,
      preview: true,
      ...freshRun(s, true),
    })),
  exitToMenu: () => set({ screen: SCREENS.HOME, status: STATUS.IDLE, demo: false, preview: false, previewSeed: null, milestone: null, runRewards: [] }),
  openAvatars: () => set({ avatarsOpen: true }),
  closeAvatars: () => set({ avatarsOpen: false }),
  openAchievements: () => set({ achievementsOpen: true }),
  closeAchievements: () => set({ achievementsOpen: false }),
  openCredits: () => set({ creditsOpen: true }),
  closeCredits: () => set({ creditsOpen: false }),
  openRewards: () => set({ rewardsOpen: true }),
  closeRewards: () => set({ rewardsOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  // --- run lifecycle (driven by simulation events + UI) ---
  beginRun: () => set((s) => (s.status === STATUS.READY ? { status: STATUS.RUNNING } : s)),
  crash: () => set((s) => (s.status === STATUS.RUNNING ? { status: STATUS.DYING } : s)),
  /**
   * A milestone (a world completed, 2,000 m apart; not the finish line) was survived: grant what the schedule lists, save it at once and announce it with a small banner.
   * Handled once per run (`milestoneIndex`), never for Auto play, and only while the run is live: a late event for a crashed run is ignored.
   */
  milestoneReached: ({ index, at, name }) => {
    const s = get();
    if (s.status !== STATUS.RUNNING || !Number.isInteger(index) || index <= s.milestoneIndex || index >= WORLD_COUNT - 1) return;
    if (s.preview) {
      // Journey Preview: the banner and the simulated unlocks only. The real journey record, the stats and storage are not touched (previewRewardIds is pure).
      const ids = previewRewardIds(index);
      set({ milestoneIndex: index, milestone: { id: `${s.runId}:${index}`, index, at, name, granted: ids, preview: true }, runRewards: [...s.runRewards, ...ids] });
      return;
    }
    if (s.demo) return; // Auto play: nothing (and the preview branch above has already returned)
    const { journey, granted } = reachMilestone(s.journey, index, s.stats.runs + 1);
    persistProgress('journey', journey);
    set({
      journey,
      milestoneIndex: index,
      milestone: { id: `${s.runId}:${index}`, index, at, name, granted: granted.map((r) => r.id) },
      runRewards: [...s.runRewards, ...granted.map((r) => r.id)],
    });
  },
  /** Called when the banner has had its moment (or a new run starts). */
  clearMilestone: () => set((s) => (s.milestone ? { milestone: null } : s)),
  /**
   * Ends the run: a crash (status DYING) or the finish line (`completed`: the journey was won, status COMPLETE). Either way it can only happen once.
   * A completed journey is also a milestone (the last one): it grants the Celestial Feather and the Trophy the first time.
   */
  endRun: ({ score, distance, orbs, bestStreak = 0, nearMisses = 0, cause = null, completed = false, worlds = 0 }) => {
    const s = get();
    // Guard: a run can only end once.
    if (s.status !== STATUS.DYING && s.status !== STATUS.RUNNING) return;
    // A finish line can only be crossed alive: a run that already crashed (DYING) can never complete.
    if (completed && s.status !== STATUS.RUNNING) return;
    // Journey Preview, finish line: show the ending with SIMULATED rewards. Nothing is granted, counted or saved, and the real record is not read or written.
    if (s.preview && completed) {
      const rewards = [...new Set([...s.runRewards, ...previewRewardIds(WORLD_COUNT - 1)])];
      set({
        status: STATUS.COMPLETE,
        overAt: performance.now(),
        score,
        distance,
        orbs,
        lastResult: { score, distance, orbs, bestStreak, nearMisses, cause: null, completed: true, worlds: WORLD_COUNT, rewards, preview: true, isNewBest: false },
        runRewards: rewards,
      });
      return;
    }
    // Auto play never counts: no best score, stats, achievements or daily progress. (A preview run never falls through to the real path below, whatever else its flags say.)
    if (s.demo || s.preview) {
      set({ status: STATUS.OVER, overAt: performance.now(), lastResult: null });
      return;
    }
    // The journey: the finish line is the last milestone. (Earlier milestones were granted live, as they were reached.)
    let journey = s.journey;
    let runRewards = s.runRewards;
    if (completed) {
      const done = reachMilestone(journey, WORLD_COUNT - 1, s.stats.runs + 1);
      journey = done.journey;
      runRewards = [...runRewards, ...done.granted.map((r) => r.id)];
      persistProgress('journey', journey);
    }
    const previousBest = s.bestScore;
    const isNewBest = score > previousBest;
    if (isNewBest) persistProgress('bestScore', score);
    const species = resolveAvatar(s.skinId, s.bestScore, s.theme, s.journey.rewards).species;
    const flown = { ...s.flown, [species]: (s.flown[species] ?? 0) + 1 };
    persistProgress('flown', flown);
    const unlockedSkins = newlyUnlocked(previousBest, score, s.theme).map((k) => k.name);

    // Progression: lifetime stats, achievements and the daily goal.
    const run = { score, distance, orbs, bestStreak, nearMisses };
    const bestAfter = Math.max(previousBest, score);
    const stats = applyRun(s.stats, run, { isNewBest, hadBest: previousBest > 0 });
    const earnedNow = newlyEarned(s.stats, previousBest, stats, bestAfter);
    const earned = { ...s.earned };
    for (const a of earnedNow) earned[a.id] = stats.runs;
    const rolled = rollDaily(s.daily, dayKey());
    const dailyGoal = dailyGoalFor(rolled.key);
    const dailyJustMet = !rolled.done && dailyMet(dailyGoal, run);
    const daily = dailyJustMet ? completeDaily(rolled) : rolled;
    persistProgress('stats', stats);
    persistProgress('achievements', earned);
    persistProgress('daily', daily);
    set({
      stats,
      earned,
      daily,
      flown,
      journey,
      runRewards,
      status: completed ? STATUS.COMPLETE : STATUS.OVER,
      overAt: performance.now(),
      score,
      distance,
      orbs,
      lastResult: {
        score,
        distance,
        orbs,
        bestStreak,
        nearMisses,
        cause,
        completed,
        worlds: completed ? WORLD_COUNT : worlds,
        rewards: runRewards,
        isNewBest,
        previousBest,
        unlockedSkins,
        achievements: earnedNow.map((a) => ({ id: a.id, name: a.name, desc: a.desc })),
        daily: { text: dailyGoal.text, done: daily.done, justCompleted: dailyJustMet, streakDays: daily.streakDays },
        nextGoal: nextGoal(stats, bestAfter),
      },
      bestScore: Math.max(s.bestScore, score),
      sessionBest: Math.max(s.sessionBest, score),
      runsThisSession: s.runsThisSession + 1,
    });
  },
  restart: () => set((s) => freshRun(s)),
  /** Fly the journey again from the start (the same as a restart: nothing is carried over but the permanent record). */
  replayJourney: () => set((s) => freshRun(s)),

  pause: () => set((s) => (s.status === STATUS.RUNNING ? { status: STATUS.PAUSED } : s)),
  resume: () => set((s) => (s.status === STATUS.PAUSED ? { status: STATUS.RUNNING } : s)),
  togglePause: () => {
    const { status, pause, resume } = get();
    if (status === STATUS.RUNNING) pause();
    else if (status === STATUS.PAUSED) resume();
  },

  /** Throttled HUD snapshot from the game loop. Skips no-op updates. */
  setHud: (distance, score, orbs) => {
    const s = get();
    if (s.distance !== distance || s.score !== score || s.orbs !== orbs) set({ distance, score, orbs });
  },

  // --- settings ---
  setTheme: (id) => {
    const s = get();
    const theme = getTheme(id).id;
    // Each theme remembers its own bird; the first time, keep the same species in the new theme's own colour.
    const species = getAvatar(s.skinsByTheme[s.theme] ?? s.skinId).species;
    const skinId = s.skinsByTheme[theme] ?? avatarFor(species, getTheme(theme).freeSkin).id;
    saveValue('theme', theme);
    applyTheme(theme);
    set({ theme, skinId });
  },
  selectSkin: (id) => {
    const s = get();
    if (!isAvatarUnlocked(getAvatar(id), s.bestScore, s.theme, s.journey.rewards)) return;
    const skinsByTheme = { ...s.skinsByTheme, [s.theme]: id };
    saveValue('skinsByTheme', skinsByTheme);
    set({ skinId: id, skinsByTheme });
  },
  toggleSound: () =>
    set((s) => {
      saveValue('soundEnabled', !s.soundEnabled);
      return { soundEnabled: !s.soundEnabled };
    }),
  setQuality: (quality) => {
    saveValue('quality', quality);
    set({ quality });
  },
}));

/** Load the saved theme and apply it right away, so the first paint already has the right colours. */
function initialTheme() {
  const theme = getTheme(loadValue('theme', DEFAULT_THEME)).id;
  applyTheme(theme);
  return theme;
}

/** Saved bird choice per theme (the old single `skinId` becomes the red theme's), and the active theme's choice. */
function initialSkins() {
  const theme = getTheme(loadValue('theme', DEFAULT_THEME)).id;
  const saved = loadValue('skinsByTheme', null);
  const byTheme = saved ?? { red: loadValue('skinId', 'flipper-fire') };
  const active = byTheme[theme] ?? avatarFor(getAvatar(byTheme.red ?? 'flipper-fire').species, getTheme(theme).freeSkin).id;
  return { byTheme, active };
}

function freshRun(s, preview = s.preview) {
  const runId = s.runId + 1;
  return { status: STATUS.READY, score: 0, distance: 0, orbs: 0, lastResult: null, runId, milestoneIndex: -1, milestone: null, runRewards: [], previewSeed: preview ? previewSeedFor(runId) : null };
}

/**
 * The ONLY way progression (best score, stats, achievements, daily goal, the journey and its rewards) reaches storage. It refuses during Auto play and the Journey Preview whatever the caller,
 * so a path that forgets its own check still cannot save anything. (Settings such as sound, theme and quality are saved elsewhere: they are not progression.)
 */
function persistProgress(key, value) {
  const s = useGameStore.getState();
  if (s.demo || s.preview) return false;
  saveValue(key, value);
  return true;
}
