import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { createStepper } from './fixedStep.js';
import { demoBot } from '../bot/demo.js';
import { GAME_EVENTS, gameEvents } from '../events/gameEvents.js';

const HUD_INTERVAL = 0.1; // seconds; the HUD only needs ~10 updates/s
/** Events after which the HUD's streak / power-up readout must be refreshed. */
const PLAY_EVENTS = new Set([
  GAME_EVENTS.SCORE,
  GAME_EVENTS.MULTIPLIER,
  GAME_EVENTS.STREAK_BREAK,
  GAME_EVENTS.POWERUP,
  GAME_EVENTS.SHIELD_BREAK,
  GAME_EVENTS.MAGNET_END,
]);

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
  const demo = useGameStore((s) => s.demo);
  const stepper = useMemo(() => createStepper(sim), [sim]);
  const hudTimer = useRef(0);
  const wasPaused = useRef(false);

  useEffect(() => {
    sim.reset();
    stepper.reset();
    hudTimer.current = 0;
    demoBot.reset();
  }, [runId, sim, stepper]);

  // In auto-play the bot presses the inputs, at the start of every fixed step.
  useEffect(() => {
    sim.controller = demo ? () => demoBot.control() : null;
    demoBot.reset();
    return () => {
      sim.controller = null;
    };
  }, [demo, sim]);

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
    // A little planning each frame (never more than a few ms, so a phone never hitches).
    // More when frames are slow (there is spare time in a long frame), never less than one layer.
    if (store.demo) demoBot.think(Math.min(12, Math.max(3, rawDelta * 250)), rawDelta);

    if (sim.events.length) {
      let playDirty = false;
      let magnetPicked = false;
      let streakBroke = false;
      let lastBreakReason = null;
      for (const e of sim.events) {
        if (e.type === GAME_EVENTS.POWERUP && e.kind === 'magnet') magnetPicked = true;
        if (e.type === GAME_EVENTS.STREAK_BREAK) {
          streakBroke = true;
          lastBreakReason = e.reason;
        }
        if (e.type === GAME_EVENTS.START) store.beginRun();
        else if (e.type === GAME_EVENTS.CRASH) store.crash();
        else if (e.type === GAME_EVENTS.OVER) store.endRun(sim.results());
        if (PLAY_EVENTS.has(e.type)) playDirty = true;
        gameEvents.emit(e.type, e);
      }
      sim.events.length = 0;
      if (playDirty) {
        // Streak and power-up state for the HUD: read once, after the whole batch.
        const p = store.play;
        store.setPlay({
          streak: sim.streak.count,
          mult: sim.streak.mult,
          stamp: sim.streak.stamp,
          shield: sim.shield,
          magnet: sim.magnetTime > 0,
          magnetStamp: p.magnetStamp + (magnetPicked ? 1 : 0),
          breakStamp: p.breakStamp + (streakBroke ? 1 : 0),
          breakReason: streakBroke ? lastBreakReason : p.breakReason,
        });
      }
    }

    hudTimer.current += rawDelta;
    if (hudTimer.current >= HUD_INTERVAL) {
      hudTimer.current = 0;
      store.setHud(sim.metres, sim.score, sim.orbsCollected, sim.gemsCollected);
    }
  });
}
