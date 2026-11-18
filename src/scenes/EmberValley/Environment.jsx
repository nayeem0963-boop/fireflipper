import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Fog } from 'three';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { envState, environmentAt } from '../../systems/world/environments.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { sfx } from '../../systems/audio/sfx.js';
import { envFx } from './envFx.js';

/**
 * Drives the scene's fog, background and lights from the journey's blended environment, once per
 * frame (a handful of uniform writes: no allocation, no per-environment assets to load).
 * Also owns the two atmospheric effects that are not scenery:
 *  - forest firelight: the key light flickers
 *  - storm lightning: rare, soft, two-pulse flashes of the sky and ambient light (never darker than
 *    normal, never a strobe, and skipped entirely for reduced-motion)
 * and the ambient wind sound, whose level follows the environment.
 */
export default function Environment({ sim }) {
  const { scene } = useThree();
  const ambient = useRef();
  const hemi = useRef();
  const key = useRef();
  const fog = useRef(new Fog('#120806', 22, 75));
  const bg = useRef(new Color('#0b0907'));
  const calm = useRef(prefersReducedMotion());
  const flash = useRef({ next: 5, pulses: 0, at: 0 });
  const windTimer = useRef(0);
  const paused = useGameStore((s) => s.status === STATUS.PAUSED);
  const soundOn = useGameStore((s) => s.soundEnabled);

  useEffect(() => {
    scene.fog = fog.current;
    scene.background = bg.current;
    return () => sfx.setWind(0);
  }, [scene]);

  // No wind while paused or muted.
  useEffect(() => {
    if (paused || !soundOn) sfx.setWind(0);
  }, [paused, soundOn]);

  useFrame(({ clock }, delta) => {
    const e = environmentAt(sim.renderDistance(), envState);
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // Lightning: only deep in the storm, every 7-16 s, two soft pulses a fraction of a second apart.
    const f = flash.current;
    envFx.flash *= Math.exp(-9 * dt);
    if (!calm.current && e.effects.storm > 0.5 && sim.phase === 'running') {
      if (t >= f.next && f.pulses === 0) {
        f.pulses = 2;
        f.at = t;
        f.next = t + 7 + Math.random() * 9;
      }
      if (f.pulses > 0 && t >= f.at) {
        envFx.flash = Math.max(envFx.flash, f.pulses === 2 ? 0.26 : 0.18);
        f.pulses -= 1;
        f.at = t + 0.16;
      }
    } else if (f.pulses > 0) {
      f.pulses = 0;
    }

    bg.current.setRGB(...e.sky.top);
    fog.current.color.setRGB(...e.fog.color);
    fog.current.near = e.fog.near;
    fog.current.far = e.fog.far;

    if (ambient.current) {
      ambient.current.color.setRGB(...e.ambient.color);
      ambient.current.intensity = e.ambient.intensity + envFx.flash * 0.5;
    }
    if (hemi.current) {
      hemi.current.color.setRGB(...e.hemi.sky);
      hemi.current.groundColor.setRGB(...e.hemi.ground);
      hemi.current.intensity = e.hemi.intensity;
    }
    if (key.current) {
      key.current.color.setRGB(...e.key.color);
      // Burning forest: the firelight wavers a little.
      const flicker = calm.current ? 0 : e.effects.flicker * (Math.sin(t * 11) * 0.05 + Math.sin(t * 23.7) * 0.03);
      key.current.intensity = e.key.intensity * (1 + flicker) + envFx.flash * 0.6;
    }

    // Ambient wind, ~10 updates a second.
    windTimer.current += delta;
    if (windTimer.current > 0.1) {
      windTimer.current = 0;
      sfx.setWind(soundOn && !paused ? e.effects.wind : 0);
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.3} color="#ffb27a" />
      <hemisphereLight ref={hemi} args={['#ff9a4a', '#0a0503', 0.7]} />
      {/* Key light from the front so obstacle faces read clearly */}
      <directionalLight ref={key} position={[-3, 6, 10]} intensity={1.6} color="#ffd8b0" />
    </>
  );
}
