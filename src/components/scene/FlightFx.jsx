import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Object3D } from 'three';
import { GAME_EVENTS, gameEvents } from '../../systems/events/gameEvents.js';
import { prefersReducedMotion } from '../../utils/device.js';

/**
 * Flight feedback drawn in the world:
 *  - Near-miss streaks: thin light trails along the bird's edge nearest the
 *    obstacle it just shaved. Anchored in track coordinates, so they stay put
 *    and slide past as the world scrolls, which reads as speed.
 *  - Impact shockwave: a quick expanding ring at the point of a crash.
 *
 * Both are pooled (no per-frame allocation), additive and short-lived, drawn
 * behind the bird's silhouette priority and never over the gap ahead, so
 * obstacle visibility is unaffected. Purely visual: it never touches gameplay.
 */
const MAX_STREAKS = 12;
const STREAK_LIFE = 0.42;
const STREAK_COLOR = new Color('#ffcf8a');
/** Additive trails read dim at low alpha; push the brightness (toneMapped is off). */
const STREAK_GAIN = 1.9;
const RING_LIFE = 0.38;

const easeOut = (u) => 1 - (1 - u) * (1 - u);

export default function FlightFx({ sim }) {
  const streaks = useRef();
  const ring = useRef();
  const ringMat = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const tint = useMemo(() => new Color(), []);
  const calm = useMemo(prefersReducedMotion, []);

  const pool = useMemo(
    () => ({
      next: 0,
      tx: new Float32Array(MAX_STREAKS),
      y: new Float32Array(MAX_STREAKS),
      len: new Float32Array(MAX_STREAKS),
      thick: new Float32Array(MAX_STREAKS),
      power: new Float32Array(MAX_STREAKS),
      life: new Float32Array(MAX_STREAKS), // seconds remaining; <= 0 = free
      ring: { x: 0, y: 0, t: RING_LIFE, flat: 1 },
    }),
    [],
  );

  // Create the per-instance colour buffer up front so the shader is compiled
  // with instance colours from the first frame.
  useLayoutEffect(() => {
    const mesh = streaks.current;
    for (let i = 0; i < MAX_STREAKS; i++) mesh.setColorAt(i, STREAK_COLOR);
    mesh.count = 0;
  }, []);

  useEffect(() => {
    const offNear = gameEvents.on(GAME_EVENTS.NEAR_MISS, (e) => {
      // 0 = barely under the threshold, 1 = grazed the rock.
      const tight = Math.min(1, Math.max(0, 1 - e.clearance / 0.3));
      const lines = calm ? 1 : 3;
      for (let i = 0; i < lines; i++) {
        const k = pool.next;
        pool.next = (pool.next + 1) % MAX_STREAKS;
        pool.tx[k] = e.x + 0.45 - i * 0.2;
        pool.y[k] = e.y + e.side * (0.28 + i * 0.1) + (i - 1) * 0.02;
        pool.len[k] = (1.6 + tight * 1.8) * (1 - i * 0.22);
        pool.thick[k] = 0.065 - i * 0.015;
        pool.power[k] = 0.55 + tight * 0.45;
        pool.life[k] = STREAK_LIFE * (1 - i * 0.12);
      }
    });
    const offCrash = gameEvents.on(GAME_EVENTS.CRASH, (e) => {
      const r = pool.ring;
      r.x = e.x;
      r.y = e.y;
      r.t = 0;
      r.flat = e.cause === 'lava' ? 1 : 0;
    });
    return () => {
      offNear();
      offCrash();
    };
  }, [pool, calm]);

  useFrame((_, delta) => {
    const mesh = streaks.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    const dist = sim.renderDistance();

    let n = 0;
    for (let i = 0; i < MAX_STREAKS; i++) {
      if (pool.life[i] <= 0) continue;
      pool.life[i] -= dt;
      const u = 1 - Math.max(0, pool.life[i]) / STREAK_LIFE; // 0 → 1
      const grow = 0.45 + 0.55 * easeOut(Math.min(1, u * 3.5)); // stretches out fast, then trails
      const fade = (1 - u) * (1 - u);
      const len = pool.len[i] * grow;
      dummy.position.set(pool.tx[i] - dist - len / 2, pool.y[i], 0.35);
      dummy.scale.set(len, pool.thick[i], 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, tint.copy(STREAK_COLOR).multiplyScalar(fade * pool.power[i] * STREAK_GAIN));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const r = pool.ring;
    const rm = ring.current;
    if (rm) {
      if (r.t < RING_LIFE) {
        r.t += dt;
        const u = Math.min(1, r.t / RING_LIFE);
        const radius = 0.3 + 2.1 * easeOut(u);
        rm.visible = true;
        // Ground impacts splash outward along the lava rather than ringing in the air.
        rm.position.set(r.x - dist, r.flat ? r.y - 0.2 : r.y, 0.4);
        rm.scale.set(radius * (r.flat ? 1.5 : 1), radius * (r.flat ? 0.45 : 1), 1);
        if (ringMat.current) ringMat.current.opacity = (1 - u) * (1 - u) * 0.7;
      } else {
        rm.visible = false;
      }
    }
  });

  return (
    <group>
      <instancedMesh ref={streaks} args={[undefined, undefined, MAX_STREAKS]} frustumCulled={false} renderOrder={3}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <mesh ref={ring} visible={false} frustumCulled={false} renderOrder={3}>
        <ringGeometry args={[0.86, 1, 48]} />
        <meshBasicMaterial ref={ringMat} color="#ff9a3a" transparent opacity={0} depthWrite={false} depthTest={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}
