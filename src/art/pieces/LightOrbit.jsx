import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D } from 'three';
import Glow from '../Glow.jsx';

/** Three lights circling on tilted orbits: radius (as a share of the shell), tilt, speed and starting angle. */
const ORBITS = [
  { r: 0.62, tilt: 0.5, speed: 0.55, phase: 0 },
  { r: 0.78, tilt: -0.9, speed: -0.4, phase: 2.1 },
  { r: 0.48, tilt: 1.4, speed: 0.8, phase: 4.2 },
];
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Points spread evenly over a unit sphere (a Fibonacci spiral). */
function shellPoints(count) {
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * GOLDEN;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
}

/**
 * Kinetic light composition: an instanced shell of metal octahedra, each breathing and turning, lit by three coloured
 * point lights that circle through the shell. Each light carries a small bright core and, optionally, an additive halo.
 */
export default function LightOrbit({ params, palette, clock }) {
  const { count, radius, breath, lightIntensity, roughness, halos } = params;
  const mesh = useRef();
  const lights = useRef([]);
  const core = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const points = useMemo(() => shellPoints(count), [count]);
  const tints = useMemo(() => palette.colors.slice(0, 3).map((c) => new Color(c)), [palette]);

  // Give every form a colour from the palette (the shell is re-created when `count` changes, so this runs again).
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new Color();
    for (let i = 0; i < count; i++) m.setColorAt(i, c.copy(tints[i % tints.length]).lerp(new Color('#ffffff'), 0.35));
    m.instanceColor.needsUpdate = true;
  }, [count, tints]);

  useFrame(() => {
    const t = clock.current.t;
    const m = mesh.current;
    if (m) {
      for (let i = 0; i < count; i++) {
        const [x, y, z] = points[i];
        const swell = 1 + 0.07 * breath * Math.sin(t * 0.9 + i * 0.3);
        dummy.position.set(x * radius * swell, y * radius * swell, z * radius * swell);
        dummy.rotation.set(t * 0.4 + i, t * 0.3 + i * 0.7, 0);
        dummy.scale.setScalar(0.17 * (0.75 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.4 * breath + i * 0.6))));
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }
    ORBITS.forEach((o, i) => {
      const g = lights.current[i];
      if (!g) return;
      const a = t * o.speed + o.phase;
      const R = radius * o.r;
      const x = Math.cos(a) * R;
      const z0 = Math.sin(a) * R;
      g.position.set(x, -z0 * Math.sin(o.tilt), z0 * Math.cos(o.tilt));
    });
    if (core.current) core.current.scale.setScalar(1 + 0.12 * Math.sin(t * 1.7) * breath);
  });

  return (
    <group>
      <instancedMesh key={count} ref={mesh} args={[undefined, undefined, count]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial metalness={1} roughness={roughness} flatShading envMapIntensity={1.2} />
      </instancedMesh>

      {ORBITS.map((o, i) => (
        <group key={i} ref={(g) => (lights.current[i] = g)}>
          <pointLight color={tints[i]} intensity={lightIntensity} distance={radius * 3.2} decay={1.6} />
          <mesh>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshBasicMaterial color={tints[i]} toneMapped={false} />
          </mesh>
          {halos && <Glow color={palette.colors[i]} size={1.1} opacity={0.85} />}
        </group>
      ))}

      <mesh ref={core}>
        <icosahedronGeometry args={[0.45, 2]} />
        <meshStandardMaterial color="#120a06" emissive={palette.accent} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      {halos && <Glow color={palette.accent} size={2.4} opacity={0.5} />}
    </group>
  );
}
