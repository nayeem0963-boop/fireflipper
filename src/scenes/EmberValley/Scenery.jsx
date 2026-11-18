import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Object3D } from 'three';
import { WORLD } from '../../systems/physics/constants.js';
import { SCENERY_BUDGET, envState, environmentAt } from '../../systems/world/environments.js';
import { getGlowTexture, getSoftTexture } from '../../utils/textures.js';

/**
 * Parallax scenery behind the track, one InstancedMesh per kind (peaks, cliffs, islands, trees,
 * clouds), so the whole backdrop is a few draw calls whatever the environment.
 *
 * Seamless transitions: every layer is scaled by its environment weight (0..1) from the blended
 * state. Peaks and cliffs sink into / rise out of the horizon, islands and trees grow in, clouds
 * thicken. A layer at ~0 weight is hidden entirely and costs nothing.
 *
 * Everything scrolls from the simulation's distance at a fraction of track speed (parallax) and
 * wraps around a span much wider than any view, so wrapping happens off-screen.
 */

/** Deterministic pseudo-random so layouts are stable across renders. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const wrap = (x, span) => {
  let v = x;
  if (v < -span / 2) v += span;
  return v;
};

/** Spread items along a span with a little jitter. */
function spread(count, span, rand, jitter = 0.6) {
  return Array.from({ length: count }, (_, i) => (i / count) * span - span / 2 + rand() * (span / count) * jitter);
}

const MIN_WEIGHT = SCENERY_BUDGET.minWeight;

/** Shared per-frame preamble: the blended environment, camera x and parallax offset. */
function useLayerFrame(sim, weightKey, mesh, speedFactor, span, draw) {
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const e = environmentAt(sim.renderDistance(), envState);
    const w = e.scenery[weightKey];
    m.visible = w >= MIN_WEIGHT;
    if (!m.visible) return;
    const camX = state.camera.position.x;
    const offset = (sim.renderDistance() * speedFactor) % span;
    draw(m, dummy, w, e, camX, offset, state.clock.elapsedTime);
    m.instanceMatrix.needsUpdate = true;
  });
}

/** Volcanic peaks (the original scenery), now instanced: 1 draw call per layer instead of 1 per peak. */
export function PeakLayer({ sim, depth, scale, count, span, speedFactor, seed, spire = false, tone = 'a' }) {
  const mesh = useRef();
  const mat = useRef();
  const peaks = useMemo(() => {
    const rand = seeded(seed);
    const xs = spread(count, span, rand);
    return xs.map((x) => ({ x, h: scale * (0.8 + rand() * 0.9) * (spire ? 1.6 : 1), r: scale * (0.7 + rand() * 0.5) * (spire ? 0.35 : 1) }));
  }, [count, scale, seed, span, spire]);

  useLayerFrame(sim, 'peaks', mesh, speedFactor, span, (m, dummy, w, e, camX, offset) => {
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      dummy.position.set(wrap(p.x - offset, span) + camX, (p.h * w) / 2, 0);
      dummy.scale.set(p.r * (0.55 + 0.45 * w), p.h * w, p.r * (0.55 + 0.45 * w));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    mat.current.color.setRGB(...e.peak[tone]);
    mat.current.emissive.setRGB(...e.peak.emissive);
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} position={[0, WORLD.groundY, depth]} frustumCulled={false}>
      <coneGeometry args={[1, 1, spire ? 6 : 5]} />
      <meshStandardMaterial ref={mat} color="#1d0c07" emissive="#3a1206" emissiveIntensity={0.4} roughness={1} flatShading />
    </instancedMesh>
  );
}

/** Rocky Canyon: tall flat-topped cliffs with a stepped mesa on top, in two depths. */
export function CliffLayer({ sim, depth, scale, count, span, speedFactor, seed, tone = 'b' }) {
  const mesh = useRef();
  const mat = useRef();
  const cliffs = useMemo(() => {
    const rand = seeded(seed);
    return spread(count, span, rand, 0.5).map((x) => ({ x, w: scale * (3 + rand() * 4), h: scale * (4.5 + rand() * 6), step: 0.45 + rand() * 0.25 }));
  }, [count, scale, seed, span]);

  useLayerFrame(sim, 'cliffs', mesh, speedFactor, span, (m, dummy, w, e, camX, offset) => {
    for (let i = 0; i < cliffs.length; i++) {
      const c = cliffs[i];
      const x = wrap(c.x - offset, span) + camX;
      const h = c.h * w;
      dummy.position.set(x, h / 2, 0);
      dummy.scale.set(c.w, h, 2.4);
      dummy.updateMatrix();
      m.setMatrixAt(i * 2, dummy.matrix);
      // The narrower step on top gives each cliff a terraced silhouette.
      const sh = c.h * 0.22 * w;
      dummy.position.set(x + c.w * 0.12, h + sh / 2, 0);
      dummy.scale.set(c.w * c.step, sh, 2.0);
      dummy.updateMatrix();
      m.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    mat.current.color.setRGB(...e.peak[tone]);
    mat.current.emissive.setRGB(...e.peak.emissive);
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count * 2]} position={[0, WORLD.groundY, depth]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial ref={mat} color="#3a1c0e" emissive="#3a1608" emissiveIntensity={0.4} roughness={1} flatShading />
    </instancedMesh>
  );
}

/** Floating Islands: flat-topped rock masses hanging in the sky, each with a warm glow beneath. */
export function IslandLayer({ sim, depth, scale, count, span, speedFactor, seed, yMin, yMax }) {
  const rock = useRef();
  const glow = useRef();
  const mat = useRef();
  const glowMap = useMemo(getGlowTexture, []);
  const islands = useMemo(() => {
    const rand = seeded(seed);
    return spread(count, span, rand, 0.5).map((x) => ({ x, y: yMin + rand() * (yMax - yMin), w: scale * (1.2 + rand() * 2.0), phase: rand() * 6.28 }));
  }, [count, scale, seed, span, yMin, yMax]);

  const dummy = useMemo(() => new Object3D(), []);
  useFrame((state) => {
    const m = rock.current;
    const g = glow.current;
    if (!m) return;
    const e = environmentAt(sim.renderDistance(), envState);
    const w = e.scenery.islands;
    m.visible = g.visible = w >= MIN_WEIGHT;
    if (!m.visible) return;
    const camX = state.camera.position.x;
    const offset = (sim.renderDistance() * speedFactor) % span;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < islands.length; i++) {
      const s = islands[i];
      const x = wrap(s.x - offset, span) + camX;
      // They drift up and down slowly, and rise into place as the environment arrives.
      const bob = Math.sin(t * 0.5 + s.phase) * 0.25;
      const y = s.y * (0.4 + 0.6 * w) + bob - (1 - w) * 6;
      const thick = s.w * 0.55;
      dummy.position.set(x, y, 0);
      dummy.scale.set(s.w, thick, s.w * 0.7);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, y - thick * 0.62, 0.3);
      dummy.scale.set(s.w * 1.7, s.w * 0.8, 1);
      dummy.updateMatrix();
      g.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    g.instanceMatrix.needsUpdate = true;
    mat.current.color.setRGB(...e.peak.c);
    mat.current.emissive.setRGB(...e.peak.emissive);
  });

  return (
    <group position={[0, 0, depth]}>
      <instancedMesh ref={rock} args={[undefined, undefined, count]} frustumCulled={false}>
        <cylinderGeometry args={[1, 0.3, 1, 7]} />
        <meshStandardMaterial ref={mat} color="#3a1a34" emissive="#2a0e2a" emissiveIntensity={0.45} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={glow} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowMap} color="#ff8a3a" transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Burning Forest: charred trunks with a flame crown that flickers (two draw calls per layer). */
export function TreeLayer({ sim, depth, scale, count, span, speedFactor, seed }) {
  const trunks = useRef();
  const crowns = useRef();
  const mat = useRef();
  const glowMap = useMemo(getGlowTexture, []);
  const trees = useMemo(() => {
    const rand = seeded(seed);
    return spread(count, span, rand, 0.9).map((x) => ({ x, h: scale * (2.6 + rand() * 3.4), phase: rand() * 6.28 }));
  }, [count, scale, seed, span]);

  const dummy = useMemo(() => new Object3D(), []);
  useFrame((state) => {
    const m = trunks.current;
    const c = crowns.current;
    if (!m) return;
    const e = environmentAt(sim.renderDistance(), envState);
    const w = e.scenery.trees;
    m.visible = c.visible = w >= MIN_WEIGHT;
    if (!m.visible) return;
    const camX = state.camera.position.x;
    const offset = (sim.renderDistance() * speedFactor) % span;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < trees.length; i++) {
      const tr = trees[i];
      const x = wrap(tr.x - offset, span) + camX;
      const h = tr.h * w;
      dummy.position.set(x, h / 2, 0);
      dummy.scale.set(scale * 0.6, h, scale * 0.6);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      const flick = 1 + 0.22 * Math.sin(t * 9 + tr.phase) + 0.12 * Math.sin(t * 17.3 + tr.phase * 2);
      dummy.position.set(x, h + 0.25 * scale, 0.1);
      dummy.scale.set(scale * 1.5 * flick * w, scale * 2.3 * flick * w, 1);
      dummy.updateMatrix();
      c.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    c.instanceMatrix.needsUpdate = true;
    mat.current.color.setRGB(...e.peak.a);
  });

  return (
    <group position={[0, WORLD.groundY, depth]}>
      <instancedMesh ref={trunks} args={[undefined, undefined, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.3, 0.55, 1, 5]} />
        <meshStandardMaterial ref={mat} color="#1a0806" emissive="#4a1408" emissiveIntensity={0.5} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowMap} color="#ff6a1e" transparent opacity={0.85} depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Ash Storm: big soft clouds of ash drifting across the sky. A handful of large quads, one draw call. */
export function CloudLayer({ sim, count, span }) {
  const mesh = useRef();
  const mat = useRef();
  const soft = useMemo(getSoftTexture, []);
  const clouds = useMemo(() => {
    const rand = seeded(91);
    return spread(count, span, rand, 1).map((x, i) => ({ x, y: -1 + rand() * 9, z: -26 + (i % 3) * 7, w: 14 + rand() * 12, h: 5 + rand() * 4, speed: 0.5 + rand() * 0.8 }));
  }, [count, span]);

  useLayerFrame(sim, 'clouds', mesh, 1, span, (m, dummy, w, e, camX, _offset, t) => {
    const dist = sim.renderDistance();
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      // Parallax by depth, plus a steady drift of their own: the storm is moving.
      const x = wrap(c.x - dist * 0.05 * (1 + c.speed) - t * 1.6 * c.speed * e.particles.wind, span) + camX;
      dummy.position.set(x, c.y, c.z);
      dummy.scale.set(c.w * w, c.h * w, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    // Lighter than the fog behind it, so the clouds read as billows of ash against the horizon glow.
    mat.current.color.setRGB(e.fog.color[0] * 3.2 + 0.05, e.fog.color[1] * 3.0 + 0.045, e.fog.color[2] * 2.8 + 0.04);
    mat.current.opacity = 0.62 * w;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={soft} color="#4a403a" transparent opacity={0.5} depthWrite={false} fog={false} toneMapped={false} />
    </instancedMesh>
  );
}
