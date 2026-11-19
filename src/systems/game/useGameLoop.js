import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { PHYSICS } from '../physics/constants.js';
import { createAutopilot } from '../bot/autopilot.js';
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
  const acc = useRef(0);
  const hudTimer = useRef(0);
  // Auto play: the bot presses the same inputs a player would, once per fixed step.
  const bot = useMemo(() => createAutopilot(sim), [sim]);

  useEffect(() => {
    sim.reset();
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
        if (e.type === GAME_EVENTS.START) store.beginRun();
        else if (e.type === GAME_EVENTS.CRASH) store.crash();
        else if (e.type === GAME_EVENTS.OVER) store.endRun(sim.results());
        else if (e.type === GAME_EVENTS.MILESTONE) store.milestoneReached(e);
        else if (e.type === GAME_EVENTS.COMPLETE) store.endRun(sim.results());
        gameEvents.emit(e.type, e);
      }
      sim.events.length = 0;
    }

    hudTimer.current += rawDelta;
    if (hudTimer.current >= HUD_INTERVAL) {
      hudTimer.current = 0;
      store.setHud(sim.metres, sim.score, sim.orbsCollected);
    }
  });
}
