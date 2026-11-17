import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { PHYSICS } from '../physics/constants.js';
import { GAME_EVENTS, gameEvents } from '../events/gameEvents.js';
import { PHASE } from './createGameSim.js';
import { ghostState } from './gameInstance.js';
import { createGhost } from '../replay/ghost.js';

const HUD_INTERVAL = 0.1; // seconds; the HUD only needs ~10 updates/s
/** Real-time freeze on impact (seconds): a few frames of stillness makes a crash land. Skipped for reduced-motion users. */
const HIT_PAUSE = 0.07;
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Bridges the pure simulation to React/R3F:
 *  - steps the sim at a fixed timestep (frame-rate independent physics),
 *    with leftover time used for render interpolation
 *  - forwards sim events to the gameEvents bus and to the store
 *  - publishes HUD numbers at a throttled rate, only when they change
 * Must be used inside the <Canvas>.
 */
export function useGameLoop(sim) {
  const runId = useGameStore((s) => s.runId);
  const seed = useGameStore((s) => s.seed);
  const acc = useRef(0);
  const hudTimer = useRef(0);
  const hitPause = useRef(0);

  useEffect(() => {
    sim.reset(seed ?? undefined);
    // Race the best attempt of today's daily challenge, if there is one.
    const { mode, ghost, dailyKey } = useGameStore.getState();
    ghostState.ghost = mode === 'daily' && ghost?.key === dailyKey ? createGhost(seed, ghost.inputs) : null;
    acc.current = 0;
    hudTimer.current = 0;
    hitPause.current = 0;
  }, [runId, seed, sim]);

  useFrame((_, rawDelta) => {
    const store = useGameStore.getState();
    if (store.status === STATUS.PAUSED || store.status === STATUS.IDLE) return;

    if (hitPause.current > 0) {
      // Frozen on impact: the sim waits, the camera shake and FOV kick hold, then play resumes.
      hitPause.current -= rawDelta;
      return;
    }

    const step = PHYSICS.fixedStep;
    acc.current += Math.min(rawDelta, PHYSICS.maxFrameDelta);
    while (acc.current >= step) {
      const racing = sim.phase === PHASE.RUNNING;
      sim.step(step);
      // The ghost takes one step for every step of the live run, so both fly the same clock.
      if (racing) ghostState.ghost?.step();
      acc.current -= step;
    }
    sim.alpha = acc.current / step;

    if (sim.events.length) {
      for (const e of sim.events) {
        if (e.type === GAME_EVENTS.START) store.beginRun();
        else if (e.type === GAME_EVENTS.NEAR_MISS) store.nearMiss(e.streak, e.points);
        else if (e.type === GAME_EVENTS.CRASH) {
          store.crash();
          if (!prefersReducedMotion()) hitPause.current = HIT_PAUSE;
        } else if (e.type === GAME_EVENTS.OVER) store.endRun(sim.results(), sim.inputLog.slice());
        gameEvents.emit(e.type, e);
      }
      sim.events.length = 0;
    }

    hudTimer.current += rawDelta;
    if (hudTimer.current >= HUD_INTERVAL) {
      hudTimer.current = 0;
      store.setHud(sim.metres, sim.score, sim.orbsCollected);
      const pw = sim.power;
      store.setPower(pw.shield, Math.ceil(pw.magnet), Math.ceil(pw.slow));
    }
  });
}
