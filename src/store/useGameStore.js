import { create } from 'zustand';
import { loadValue, saveValue } from '../utils/storage.js';

export const SCREENS = Object.freeze({ HOME: 'home', GAME: 'game' });

/** Run lifecycle. 'over' is reserved for when collisions are implemented. */
export const STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  OVER: 'over',
});

export const QUALITY = Object.freeze({ AUTO: 'auto', LOW: 'low', HIGH: 'high' });

/**
 * Global game/UI state.
 *
 * Rule of thumb: this store holds state the UI needs to *react* to
 * (screens, run status, HUD numbers, settings). Per-frame simulation data
 * (positions, velocities, pooled obstacles) lives in refs/systems and is
 * only pushed here at a throttled rate, so React doesn't re-render at 60 Hz.
 */
export const useGameStore = create((set, get) => ({
  // --- navigation ---
  screen: SCREENS.HOME,
  settingsOpen: false,

  // --- current run ---
  status: STATUS.IDLE,
  score: 0,
  distance: 0,
  runId: 0, // bumped on every (re)start so systems can reset themselves

  // --- persistent ---
  bestScore: loadValue('bestScore', 0),
  soundEnabled: loadValue('soundEnabled', true),
  quality: loadValue('quality', QUALITY.AUTO),

  // --- navigation actions ---
  startGame: () =>
    set((s) => ({
      screen: SCREENS.GAME,
      status: STATUS.RUNNING,
      score: 0,
      distance: 0,
      runId: s.runId + 1,
    })),
  exitToMenu: () => {
    get().commitBestScore();
    set({ screen: SCREENS.HOME, status: STATUS.IDLE });
  },
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  // --- run actions ---
  pause: () => set((s) => (s.status === STATUS.RUNNING ? { status: STATUS.PAUSED } : s)),
  resume: () => set((s) => (s.status === STATUS.PAUSED ? { status: STATUS.RUNNING } : s)),
  togglePause: () => {
    const { status, pause, resume } = get();
    if (status === STATUS.RUNNING) pause();
    else if (status === STATUS.PAUSED) resume();
  },
  restart: () => {
    get().commitBestScore();
    set((s) => ({ status: STATUS.RUNNING, score: 0, distance: 0, runId: s.runId + 1 }));
  },

  // --- HUD updates (called by systems at a throttled rate) ---
  setDistance: (distance) => set({ distance }),
  addScore: (points) => set((s) => ({ score: s.score + points })),

  commitBestScore: () => {
    const { score, bestScore } = get();
    if (score > bestScore) {
      saveValue('bestScore', score);
      set({ bestScore: score });
    }
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
