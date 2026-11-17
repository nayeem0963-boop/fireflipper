import { createGameSim } from './createGameSim.js';

/** The single live simulation used by the game screen. */
export const game = createGameSim();

/** The ghost of the player's best daily attempt, when one is racing (set by useGameLoop). */
export const ghostState = { ghost: null };
