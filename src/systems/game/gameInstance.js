import { createGameSim } from './createGameSim.js';

/** The single live simulation used by the game screen. */
export const game = createGameSim();

// Development only: lets screenshots and manual checks jump along the track (window.__fireflipper.game).
if (typeof window !== 'undefined' && import.meta.env?.DEV) window.__fireflipper = { game };
