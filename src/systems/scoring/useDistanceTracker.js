import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { PHYSICS } from '../physics/constants.js';
import { runtime, resetRuntime } from '../runtime.js';

const HUD_UPDATE_INTERVAL = 0.1; // seconds; 10 Hz is plenty for a counter

/**
 * Advances run distance every frame while running and publishes it to the
 * store at a throttled rate. Must be used inside the R3F <Canvas>.
 */
export function useDistanceTracker() {
  const runId = useGameStore((s) => s.runId);
  const sinceUpdate = useRef(0);

  useEffect(() => {
    resetRuntime();
    sinceUpdate.current = 0;
  }, [runId]);

  useFrame((_, rawDelta) => {
    if (useGameStore.getState().status !== STATUS.RUNNING) return;
    const delta = Math.min(rawDelta, PHYSICS.maxFrameDelta);
    runtime.distance += PHYSICS.worldSpeed * delta;

    sinceUpdate.current += delta;
    if (sinceUpdate.current >= HUD_UPDATE_INTERVAL) {
      sinceUpdate.current = 0;
      useGameStore.getState().setDistance(runtime.distance);
    }
  });
}
