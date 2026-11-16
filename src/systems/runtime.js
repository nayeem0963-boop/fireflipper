/**
 * Mutable per-frame simulation state, shared between systems and renderers.
 *
 * This is deliberately NOT React state: it changes every frame and is read
 * inside useFrame callbacks. The Zustand store receives throttled snapshots
 * for the HUD. Call resetRuntime() at the start of each run.
 */
export const runtime = {
  /** World units travelled this run. */
  distance: 0,
  /** performance.now() timestamp of the last flap input (for animation). */
  lastFlapAt: -Infinity,
};

export function resetRuntime() {
  runtime.distance = 0;
  runtime.lastFlapAt = -Infinity;
}
