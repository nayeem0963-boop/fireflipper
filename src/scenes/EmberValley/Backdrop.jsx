import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial } from 'three';
import { biomeBlendAt } from '../../systems/biomes/biomes.js';
import { getBiome, SKY_STOPS } from './biomeColors.js';
import { WORLD } from '../../systems/physics/constants.js';
import { createGroundTexture, createSkyTexture } from './valleyTextures.js';

/**
 * Ember Valley scenery. Everything scrolls from the simulation's distance,
 * so the world moves in lock-step with obstacles:
 *  - ground: one tiling texture, scrolled by UV offset (seamless, never pops)
 *  - three parallax layers of peaks that wrap around a span much wider than
 *    the widest view, so wrapping happens off-screen
 *  - a gradient sky fixed at the horizon
 */
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // → 4 world units per tile

export default function Backdrop({ sim }) {
  return (
    <>
      <Sky sim={sim} />
      <PeakLayer sim={sim} depth={-34} scale={8} count={14} span={160} speedFactor={0.1} tier={0} seed={1} />
      <PeakLayer sim={sim} depth={-20} scale={5} count={14} span={120} speedFactor={0.28} tier={1} seed={7} />
      <PeakLayer
        sim={sim}
        depth={-9}
        scale={2.6}
        count={12}
        span={80}
        speedFactor={0.6}
        tier={2}
        seed={13}
        spire
      />
      <Ground sim={sim} />
    </>
  );
}

/** Two stacked sky planes: the Obsidian Reach sky fades in over the Ember Valley one. */
function Sky({ sim }) {
  const ember = useMemo(() => createSkyTexture(SKY_STOPS.ember), []);
  const obsidian = useMemo(() => createSkyTexture(SKY_STOPS.obsidian), []);
  const overlay = useRef();
  useEffect(
    () => () => {
      ember.dispose();
      obsidian.dispose();
    },
    [ember, obsidian],
  );
  useFrame(() => {
    if (overlay.current) overlay.current.material.opacity = biomeBlendAt(sim.renderDistance());
  });
  return (
    <>
      <mesh position={[0, 8, -60]}>
        <planeGeometry args={[400, 60]} />
        <meshBasicMaterial map={ember} fog={false} toneMapped={false} />
      </mesh>
      <mesh ref={overlay} position={[0, 8, -59.9]}>
        <planeGeometry args={[400, 60]} />
        <meshBasicMaterial map={obsidian} fog={false} toneMapped={false} transparent opacity={0} />
      </mesh>
    </>
  );
}

function Ground({ sim }) {
  const tex = useMemo(() => {
    const t = createGroundTexture();
    t.repeat.set(GROUND_REPEAT, 25);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const mesh = useRef();

  useFrame((state) => {
    const biome = getBiome(biomeBlendAt(sim.renderDistance()));
    if (mesh.current) mesh.current.material.emissive.copy(biome.groundGlow);
    const tileSize = GROUND_WIDTH / GROUND_REPEAT;
    tex.offset.x = (sim.renderDistance() / tileSize) % 1;
    // Keep the ground centred under the camera so its edges are never seen.
    if (mesh.current) mesh.current.position.x = state.camera.position.x;
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial
        map={tex}
        emissiveMap={tex}
        emissive="#ff6a1a"
        emissiveIntensity={0.45}
        roughness={0.9}
      />
    </mesh>
  );
}

/** Deterministic pseudo-random so layouts are stable across renders. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function PeakLayer({ sim, depth, scale, count, span, speedFactor, tier, seed, spire = false }) {
  const group = useRef();
  // One shared material per layer, re-tinted per biome.
  const material = useMemo(
    () => new MeshStandardMaterial({ emissiveIntensity: 0.4, roughness: 1, flatShading: true }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const peaks = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: (i / count) * span - span / 2 + rand() * (span / count) * 0.6,
      h: scale * (0.8 + rand() * 0.9) * (spire ? 1.6 : 1),
      r: scale * (0.7 + rand() * 0.5) * (spire ? 0.35 : 1),
    }));
  }, [count, scale, seed, span, spire]);

  useFrame((state) => {
    if (!group.current) return;
    const biome = getBiome(biomeBlendAt(sim.renderDistance()));
    material.color.copy(biome.peaks[tier]);
    material.emissive.copy(biome.peakEmissive);
    const camX = state.camera.position.x;
    const offset = (sim.renderDistance() * speedFactor) % span;
    const children = group.current.children;
    for (let i = 0; i < children.length; i++) {
      let x = peaks[i].x - offset;
      if (x < -span / 2) x += span;
      children[i].position.x = x + camX;
    }
  });

  return (
    <group ref={group} position={[0, WORLD.groundY, depth]}>
      {peaks.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2, 0]} material={material}>
          <coneGeometry args={[p.r, p.h, spire ? 6 : 5]} />
        </mesh>
      ))}
    </group>
  );
}
