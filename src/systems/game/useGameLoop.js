import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { createStepper } from './fixedStep.js';
import { GAME_EVENTS, gameEvents } from '../events/gameEvents.js';

const HUD_INTERVAL = 0.1; // seconds; the HUD only needs ~10 updates/s

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
  const stepper = useMemo(() => createStepper(sim), [sim]);
  const hudTimer = useRef(0);
  const wasPaused = useRef(false);

  useEffect(() => {
    sim.reset();
    stepper.reset();
    hudTimer.current = 0;
  }, [runId, sim, stepper]);

  useFrame((_, rawDelta) => {
    const store = useGameStore.getState();
    if (store.status === STATUS.PAUSED || store.status === STATUS.IDLE) {
      wasPaused.current = true;
      return;
    }
    // The first frame after a pause reports the whole time spent paused;
    // dropping it keeps resume from lurching the simulation forward.
    if (wasPaused.current) {
      wasPaused.current = false;
      return;
    }

    stepper.advance(rawDelta);

    if (sim.events.length) {
      for (const e of sim.events) {
        if (e.type === GAME_EVENTS.START) store.beginRun();
        else if (e.type === GAME_EVENTS.CRASH) store.crash();
        else if (e.type === GAME_EVENTS.OVER) store.endRun(sim.results());
        gameEvents.emit(e.type, e);
      }
      sim.events.length = 0;
    }

    hudTimer.current += rawDelta;
    if (hudTimer.current >= HUD_INTERVAL) {
      hudTimer.current = 0;
      store.setHud(sim.metres, sim.score, sim.orbsCollected, sim.gemsCollected);
    }
  });
}
