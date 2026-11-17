import { create } from 'zustand';
import { loadValue, saveValue } from '../utils/storage.js';
import { seedForKey, todayKey } from '../utils/daily.js';
import { DEFAULT_SKIN_ID, isUnlocked, getSkin, newlyUnlocked } from '../systems/skins/skins.js';

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

export const MODE = Object.freeze({ FREE: 'free', DAILY: 'daily' });

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
  leaderboardOpen: false,

  // --- current run ---
  mode: MODE.FREE,
  /** Fixed track seed for the current run (daily challenge), or null for a random track. */
  seed: null,
  dailyKey: null,
  status: STATUS.IDLE,
  score: 0,
  distance: 0,
  orbs: 0,
  /** Latest near-miss callout { id, streak, points } for the HUD; null between runs. */
  callout: null,
  /** Active power-ups for the HUD: shield flag, magnet/slow seconds remaining (rounded up). */
  power: { shield: false, magnet: 0, slow: 0 },
  runId: 0, // bumped on every (re)start; the game loop resets the sim on change
  overAt: 0,
  /** { score, distance, orbs, isNewBest } of the last finished run. */
  lastResult: null,

  // --- scores ---
  bestScore: loadValue('bestScore', 0),
  /** Best score since the page was opened (not persisted). */
  sessionBest: 0,
  runsThisSession: 0,
  /** Best score per daily challenge date, e.g. { '2026-11-17': 812 }. Only recent days are kept. */
  dailyBests: loadValue('dailyBests', {}),

  // --- settings ---
  soundEnabled: loadValue('soundEnabled', true),
  quality: loadValue('quality', QUALITY.AUTO),
  /** Anonymous id for the leaderboard (no accounts yet) and the display name the player picked. */
  playerId: loadPlayerId(),
  playerName: loadValue('playerName', ''),
  /** Selected bird skin id; falls back to the default while it is still locked. */
  skinId: loadValue('skinId', DEFAULT_SKIN_ID),
  /** First-run coaching hints are shown until the player has flown a short distance. */
  tutorialDone: loadValue('tutorialDone', false),

  // --- navigation actions ---
  startGame: (mode = MODE.FREE) =>
    set((s) => {
      const daily = mode === MODE.DAILY;
      const dailyKey = daily ? todayKey() : null;
      return {
        screen: SCREENS.GAME,
        mode,
        dailyKey,
        seed: daily ? seedForKey(dailyKey) : null,
        ...freshRun(s),
      };
    }),
  exitToMenu: () => set({ screen: SCREENS.HOME, status: STATUS.IDLE }),
  openLeaderboard: () => set({ leaderboardOpen: true }),
  closeLeaderboard: () => set({ leaderboardOpen: false }),
  setPlayerName: (name) => {
    saveValue('playerName', name);
    set({ playerName: name });
  },
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  // --- run lifecycle (driven by simulation events + UI) ---
  beginRun: () => set((s) => (s.status === STATUS.READY ? { status: STATUS.RUNNING } : s)),
  crash: () => set((s) => (s.status === STATUS.RUNNING ? { status: STATUS.DYING } : s)),
  endRun: ({ score, distance, orbs, nearMisses = 0 }) => {
    const s = get();
    // Guard: a run can only end once.
    if (s.status !== STATUS.DYING && s.status !== STATUS.RUNNING) return;
    const daily = s.mode === MODE.DAILY;
    // Daily scores are kept apart from the free-play best: the track is the same every attempt.
    const isNewBest = !daily && score > s.bestScore;
    if (isNewBest) saveValue('bestScore', score);
    let dailyBests = s.dailyBests;
    let isNewDailyBest = false;
    if (daily) {
      const previous = dailyBests[s.dailyKey] ?? 0;
      isNewDailyBest = score > previous;
      if (isNewDailyBest) {
        // Keep the last week only, so storage doesn't grow forever.
        const kept = Object.keys(dailyBests).sort().slice(-6);
        dailyBests = { ...Object.fromEntries(kept.map((k) => [k, dailyBests[k]])), [s.dailyKey]: score };
        saveValue('dailyBests', dailyBests);
      }
    }
    set({
      status: STATUS.OVER,
      overAt: performance.now(),
      score,
      distance,
      orbs,
      lastResult: {
        score,
        distance,
        orbs,
        nearMisses,
        isNewBest,
        isNewDailyBest,
        mode: s.mode,
        unlockedSkins: daily ? [] : newlyUnlocked(s.bestScore, score).map((k) => k.name),
      },
      dailyBests,
      bestScore: daily ? s.bestScore : Math.max(s.bestScore, score),
      sessionBest: daily ? s.sessionBest : Math.max(s.sessionBest, score),
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

  nearMiss: (streak, points) =>
    set((s) =>
      s.status === STATUS.RUNNING ? { callout: { id: (s.callout?.id ?? 0) + 1, streak, points } } : s,
    ),
  setPower: (shield, magnet, slow) => {
    const p = get().power;
    if (p.shield !== shield || p.magnet !== magnet || p.slow !== slow)
      set({ power: { shield, magnet, slow } });
  },
  completeTutorial: () => {
    saveValue('tutorialDone', true);
    set({ tutorialDone: true });
  },

  /** Throttled HUD snapshot from the game loop. Skips no-op updates. */
  setHud: (distance, score, orbs) => {
    const s = get();
    if (s.distance !== distance || s.score !== score || s.orbs !== orbs) set({ distance, score, orbs });
  },

  // --- settings ---
  toggleSound: () =>
    set((s) => {
      saveValue('soundEnabled', !s.soundEnabled);
      return { soundEnabled: !s.soundEnabled };
    }),
  selectSkin: (id) => {
    const s = get();
    if (!isUnlocked(getSkin(id), s.bestScore)) return;
    saveValue('skinId', id);
    set({ skinId: id });
  },
  setQuality: (quality) => {
    saveValue('quality', quality);
    set({ quality });
  },
}));

function loadPlayerId() {
  let id = loadValue('playerId', null);
  if (typeof id !== 'string' || id.length < 16) {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    saveValue('playerId', id);
  }
  return id;
}

function freshRun(s) {
  return {
    status: STATUS.READY,
    score: 0,
    distance: 0,
    orbs: 0,
    callout: null,
    power: { shield: false, magnet: 0, slow: 0 },
    lastResult: null,
    runId: s.runId + 1,
  };
}
