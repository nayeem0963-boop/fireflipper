/**
 * Tiny pub/sub for gameplay input. Input sources (keyboard, pointer,
 * touch, gamepad later) emit abstract actions; systems subscribe.
 * Keeps input handling decoupled from rendering and from React.
 */
export const ACTIONS = Object.freeze({ FLAP: 'flap', PAUSE: 'pause' });

const listeners = new Map();

export function onAction(action, fn) {
  if (!listeners.has(action)) listeners.set(action, new Set());
  listeners.get(action).add(fn);
  return () => listeners.get(action)?.delete(fn);
}

export function emitAction(action, payload) {
  listeners.get(action)?.forEach((fn) => fn(payload));
}
