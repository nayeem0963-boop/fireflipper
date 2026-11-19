import { createGameSim } from './createGameSim.js';
import { HAZARDS } from '../hazards/biomeHazards.js';

/** The single live simulation used by the game screen. */
export const game = createGameSim();

// Preview flag: ?hazards=1 switches the biome hazards on (see systems/hazards/biomeHazards.js). They stay off by default until their telegraphs are drawn.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('hazards') === '1') HAZARDS.enabled = true;

// Development only: lets screenshots and manual checks jump along the track (window.__fireflipper.game).
if (typeof window !== 'undefined' && import.meta.env?.DEV) window.__fireflipper = { game, hazards: HAZARDS };
