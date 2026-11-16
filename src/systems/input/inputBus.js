import { createEmitter } from '../../utils/emitter.js';

/**
 * Gameplay input as abstract actions. Input sources (keyboard, pointer,
 * touch, later gamepad) emit these; game code subscribes. Keeps input
 * handling decoupled from rendering and from React.
 */
export const ACTIONS = Object.freeze({
  FLAP_PRESS: 'flap-press',
  FLAP_RELEASE: 'flap-release',
  DIVE_PRESS: 'dive-press',
  DIVE_RELEASE: 'dive-release',
  PAUSE: 'pause',
});

const bus = createEmitter();
export const onAction = bus.on;
export const emitAction = bus.emit;
