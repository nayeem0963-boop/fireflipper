import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { PHYSICS } from '../physics/constants.js';
import { createAutopilot } from '../bot/autopilot.js';
import { createRunnerAutopilot } from '../runner/autopilot.js';
import { gameEvents } from '../events/gameEvents.js';
import { routeSimEvent } from './routeEvents.js';

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
  const acc = useRef(0);
  const hudTimer = useRef(0);
  // Auto play: the bot presses the same inputs a player would, once per fixed step. Each simulation has its own bot (the flyer's and the runner's).
  const bot = useMemo(() => (sim.kind === 'runner' ? createRunnerAutopilot(sim) : createAutopilot(sim)), [sim]);

  useEffect(() => {
    // the Journey Preview flies a verified track seed; a normal run and plain Auto play keep a random one
    sim.reset(useGameStore.getState().previewSeed ?? undefined);
    bot.reset();
    acc.current = 0;
    hudTimer.current = 0;
  }, [runId, sim, bot]);

  useFrame((_, rawDelta) => {
    const store = useGameStore.getState();
    if (store.status === STATUS.PAUSED || store.status === STATUS.IDLE) return;

    const step = PHYSICS.fixedStep;
    acc.current += Math.min(rawDelta, PHYSICS.maxFrameDelta);
    while (acc.current >= step) {
      if (store.demo) bot.control();
      sim.step(step);
      acc.current -= step;
    }
    sim.alpha = acc.current / step;

    if (sim.events.length) {
      for (const e of sim.events) {
        routeSimEvent(store, sim, e);
        gameEvents.emit(e.type, e);
      }
      sim.events.length = 0;
    }

    hudTimer.current += rawDelta;
    if (hudTimer.current >= HUD_INTERVAL) {
      hudTimer.current = 0;
      store.setHud(sim.metres, sim.score, sim.orbsCollected, Math.ceil(sim.magnetLeft), sim.shield, Math.ceil(sim.shieldLeft));
    }
  });
}
