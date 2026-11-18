import { create } from 'zustand';
import { loadValue, saveValue } from '../utils/storage.js';

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

  // --- current run ---
  status: STATUS.IDLE,
  score: 0,
  distance: 0,
  orbs: 0,
  gems: 0,
  runId: 0, // bumped on every (re)start; the game loop resets the sim on change
  overAt: 0,
  /** { score, distance, orbs, gems, rings, isNewBest } of the last finished run. */
  lastResult: null,

  // --- scores ---
  bestScore: loadValue('bestScore', 0),
  /** Best score since the page was opened (not persisted). */
  sessionBest: 0,
  runsThisSession: 0,
  /** Persistent: gems from every finished run, and the longest streak ever. */
  gemsBanked: loadValue('gemsBanked', 0),
  bestStreak: loadValue('bestStreak', 0),

  /** Live play state shown by the HUD (updated from simulation events, not per frame). */
  play: { streak: 0, mult: 1, stamp: 0, shield: false, magnet: false, magnetStamp: 0, breakStamp: 0, breakReason: null },

  // --- settings ---
  soundEnabled: loadValue('soundEnabled', true),
  quality: loadValue('quality', QUALITY.AUTO),

  // --- navigation actions ---
  startGame: () =>
    set((s) => ({
      screen: SCREENS.GAME,
      ...freshRun(s),
    })),
  exitToMenu: () => set({ screen: SCREENS.HOME, status: STATUS.IDLE }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  // --- run lifecycle (driven by simulation events + UI) ---
  beginRun: () => set((s) => (s.status === STATUS.READY ? { status: STATUS.RUNNING } : s)),
  crash: () => set((s) => (s.status === STATUS.RUNNING ? { status: STATUS.DYING } : s)),
  endRun: (result) => {
    const { score, distance, orbs, gems = 0 } = result;
    const s = get();
    // Guard: a run can only end once.
    if (s.status !== STATUS.DYING && s.status !== STATUS.RUNNING) return;
    const isNewBest = score > s.bestScore;
    if (isNewBest) saveValue('bestScore', score);
    // Gems are the progression currency: bank them the moment the run ends.
    const gemsBanked = s.gemsBanked + gems;
    if (gems > 0) saveValue('gemsBanked', gemsBanked);
    const bestStreak = Math.max(s.bestStreak, result.bestStreak ?? 0);
    if (bestStreak > s.bestStreak) saveValue('bestStreak', bestStreak);
    set({
      status: STATUS.OVER,
      overAt: performance.now(),
      score,
      distance,
      orbs,
      gems,
      lastResult: { ...result, isNewBest, gemsBankedTotal: gemsBanked },
      gemsBanked,
      bestStreak,
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

  /** Streak / power-up state, pushed when a relevant simulation event happens. */
  setPlay: (patch) => set((s) => ({ play: { ...s.play, ...patch } })),

  /** Throttled HUD snapshot from the game loop. Skips no-op updates. */
  setHud: (distance, score, orbs, gems = 0) => {
    const s = get();
    if (s.distance !== distance || s.score !== score || s.orbs !== orbs || s.gems !== gems) set({ distance, score, orbs, gems });
  },

  // --- settings ---
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
  return { status: STATUS.READY, score: 0, distance: 0, orbs: 0, gems: 0, play: { streak: 0, mult: 1, stamp: 0, shield: false, magnet: false, magnetStamp: 0, breakStamp: 0, breakReason: null }, lastResult: null, runId: s.runId + 1 };
}
