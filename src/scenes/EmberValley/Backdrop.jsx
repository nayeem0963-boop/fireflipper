import { useEffect, useMemo, useRef } from 'react';
import { Object3D } from 'three';
import { useFrame } from '@react-three/fiber';
import { WORLD } from '../../systems/physics/constants.js';
import { createGroundTexture, createSkyTexture } from './valleyTextures.js';
import { useTheme } from '../../hooks/useTheme.js';
import { zoneStrength } from '../../systems/world/biomes.js';

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
  const { scene } = useTheme();
  return (
    <>
      <Sky scene={scene} />
      <PeakLayer sim={sim} depth={-34} scale={8} count={14} span={160} speedFactor={0.1} color={scene.peaks[0]} emissive={scene.peakEmissive} seed={1} />
      <PeakLayer sim={sim} depth={-20} scale={5} count={14} span={120} speedFactor={0.28} color={scene.peaks[1]} emissive={scene.peakEmissive} seed={7} />
      <PeakLayer sim={sim} depth={-9} scale={2.6} count={12} span={80} speedFactor={0.6} color={scene.peaks[2]} emissive={scene.peakEmissive} seed={13} spire />
      <Ground sim={sim} scene={scene} />
    </>
  );
}

function Sky({ scene }) {
  const tex = useMemo(() => createSkyTexture(scene), [scene]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 8, -60]}>
      <planeGeometry args={[400, 60]} />
      <meshBasicMaterial map={tex} fog={false} toneMapped={false} />
    </mesh>
  );
}

function Ground({ sim, scene }) {
  const tex = useMemo(() => {
    const t = createGroundTexture(scene);
    t.repeat.set(GROUND_REPEAT, 25);
    return t;
  }, [scene]);
  useEffect(() => () => tex.dispose(), [tex]);
  const mesh = useRef();

  useFrame((state) => {
    const tileSize = GROUND_WIDTH / GROUND_REPEAT;
    tex.offset.x = (sim.renderDistance() / tileSize) % 1;
    // Keep the ground centred under the camera so its edges are never seen.
    if (mesh.current) mesh.current.position.x = state.camera.position.x;
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive={scene.groundEmissive} emissiveIntensity={0.45} roughness={0.9} />
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

/**
 * One layer of distant peaks as a single InstancedMesh (one draw call for the whole layer instead of one per
 * peak). Each peak is a unit cone scaled to its own radius and height; positions are rewritten every frame as the
 * layer scrolls with parallax.
 */
function PeakLayer({ sim, depth, scale, count, span, speedFactor, color, emissive, seed, spire = false }) {
  const mesh = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const peaks = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: (i / count) * span - span / 2 + rand() * (span / count) * 0.6,
      h: scale * (0.8 + rand() * 0.9) * (spire ? 1.6 : 1),
      r: scale * (0.7 + rand() * 0.5) * (spire ? 0.35 : 1),
    }));
  }, [count, scale, seed, span, spire]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const camX = state.camera.position.x;
    const offset = (sim.renderDistance() * speedFactor) % span;
    // The mountains rise out of the ground as a scenery zone (Sundarbans, Amazon) fades away, and sink while one grows in.
    const rise = Math.max(0.0001, 1 - zoneStrength(sim.renderDistance()));
    m.visible = rise > 0.001;
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      let x = p.x - offset;
      if (x < -span / 2) x += span;
      dummy.position.set(x + camX, p.h / 2, 0);
      dummy.scale.set(p.r, p.h * rise, p.r);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[0, WORLD.groundY, depth]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
        <coneGeometry args={[1, 1, spire ? 6 : 5]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.4} roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
