import { createGameSim } from './createGameSim.js';
import { HAZARDS } from '../hazards/biomeHazards.js';
import { FLIERS } from '../fliers/fliers.js';

/** The single live simulation used by the game screen. */
export const game = createGameSim();

// The biome hazards are on by default (see systems/hazards/biomeHazards.js); ?hazards=0 switches them off (comparison / rollback).
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('hazards') === '0') HAZARDS.enabled = false;

// ?fliers=0 switches the flying hazards off (comparison / rollback); they are on by default (see systems/fliers/fliers.js).
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fliers') === '0') FLIERS.enabled = false;

// Development only: lets screenshots and manual checks jump along the track (window.__fireflipper.game).
if (typeof window !== 'undefined' && import.meta.env?.DEV) window.__fireflipper = { game, hazards: HAZARDS };
