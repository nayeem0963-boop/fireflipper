import { create } from 'zustand';
import { loadValue, saveValue } from '../utils/storage.js';
import { newlyUnlocked } from '../systems/skins/skins.js';
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
import { DEFAULT_AVATAR_ID, getAvatar, isAvatarUnlocked, resolveAvatar } from '../systems/avatars/avatars.js';

export const SCREENS = Object.freeze({ HOME: 'home', GAME: 'game' });

/**
 * Run lifecycle (mirrors the simulation's phases, plus PAUSED):
 *   READY → RUNNING → DYING → OVER, with RUNNING ⇄ PAUSED.
 */
export const STATUS = Object.freeze({
  IDLE: 'idle',
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  DYING: 'dying',
  OVER: 'over',
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
  avatarsOpen: false,
  achievementsOpen: false,
  creditsOpen: false,

  // --- current run ---
  status: STATUS.IDLE,
  score: 0,
  distance: 0,
  orbs: 0,
  runId: 0, // bumped on every (re)start; the game loop resets the sim on change
  overAt: 0,
  /** Stats of the last finished run, plus isNewBest and the previousBest it was measured against. */
  lastResult: null,

  // --- scores ---
  bestScore: loadValue('bestScore', 0),
  /** Best score since the page was opened (not persisted). */
  sessionBest: 0,
  runsThisSession: 0,

  /** Selected bird skin id (species + colour). Cosmetic only: no effect on physics or collisions. */
  skinId: loadValue('skinId', DEFAULT_AVATAR_ID),
  /** Completed runs per bird species, for collection progress: { species: runs }. */
  flown: loadValue('flown', {}),

  // --- progression (see systems/progression) ---
  stats: { ...EMPTY_STATS, ...loadValue('stats', {}) },
  /** Earned achievements: { id: run number it was earned on }. */
  earned: loadValue('achievements', {}),
  /** Today's goal state: { key, done, streakDays, lastDoneKey }. */
  daily: rollDaily(loadValue('daily', null), dayKey()),

  // --- settings ---
  soundEnabled: loadValue('soundEnabled', true),
  quality: loadValue('quality', QUALITY.AUTO),

  // --- navigation actions ---
  startGame: () =>
    set((s) => ({
      screen: SCREENS.GAME,
      demo: false,
      ...freshRun(s),
    })),
  startDemo: () =>
    set((s) => ({
      screen: SCREENS.GAME,
      demo: true,
      ...freshRun(s),
    })),
  exitToMenu: () => set({ screen: SCREENS.HOME, status: STATUS.IDLE, demo: false }),
  openAvatars: () => set({ avatarsOpen: true }),
  closeAvatars: () => set({ avatarsOpen: false }),
  openAchievements: () => set({ achievementsOpen: true }),
  closeAchievements: () => set({ achievementsOpen: false }),
  openCredits: () => set({ creditsOpen: true }),
  closeCredits: () => set({ creditsOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  // --- run lifecycle (driven by simulation events + UI) ---
  beginRun: () => set((s) => (s.status === STATUS.READY ? { status: STATUS.RUNNING } : s)),
  crash: () => set((s) => (s.status === STATUS.RUNNING ? { status: STATUS.DYING } : s)),
  endRun: ({ score, distance, orbs, bestStreak = 0, nearMisses = 0, cause = null }) => {
    const s = get();
    // Guard: a run can only end once.
    if (s.status !== STATUS.DYING && s.status !== STATUS.RUNNING) return;
    // Auto play never counts: no best score, stats, achievements or daily progress.
    if (s.demo) {
      set({ status: STATUS.OVER, overAt: performance.now(), lastResult: null });
      return;
    }
    const previousBest = s.bestScore;
    const isNewBest = score > previousBest;
    if (isNewBest) saveValue('bestScore', score);
    const species = resolveAvatar(s.skinId, s.bestScore).species;
    const flown = { ...s.flown, [species]: (s.flown[species] ?? 0) + 1 };
    saveValue('flown', flown);
    const unlockedSkins = newlyUnlocked(previousBest, score).map((k) => k.name);

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
    saveValue('stats', stats);
    saveValue('achievements', earned);
    saveValue('daily', daily);
    set({
      stats,
      earned,
      daily,
      flown,
      status: STATUS.OVER,
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
  selectSkin: (id) => {
    const s = get();
    if (!isAvatarUnlocked(getAvatar(id), s.bestScore)) return;
    saveValue('skinId', id);
    set({ skinId: id });
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

function freshRun(s) {
  return { status: STATUS.READY, score: 0, distance: 0, orbs: 0, lastResult: null, runId: s.runId + 1 };
}
