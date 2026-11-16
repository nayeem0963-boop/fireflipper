import { useMemo } from 'react';
import { useGameStore, QUALITY } from '../store/useGameStore.js';
import { isLowPowerDevice } from '../utils/device.js';

/**
 * Resolves the user's quality setting into concrete renderer parameters.
 * 'auto' picks conservative values on phones and low-core devices.
 */
export function useRenderSettings() {
  const quality = useGameStore((s) => s.quality);
  return useMemo(() => {
    const low = quality === QUALITY.LOW || (quality === QUALITY.AUTO && isLowPowerDevice());
    return low
      ? { tier: 'low', maxDpr: 1.25, antialias: false, emberCount: 60 }
      : { tier: 'high', maxDpr: 2, antialias: true, emberCount: 160 };
  }, [quality]);
}
