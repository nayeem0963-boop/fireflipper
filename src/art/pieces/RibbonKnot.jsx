import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide } from 'three';
import { ribbonKnotGeometry } from '../geometry/ribbonKnot.js';

/** Generative sculpture: a ribbon twisted along a torus knot (geometry in geometry/ribbonKnot.js), slowly turning and breathing. */
export default function RibbonKnot({ params, palette, clock, quality }) {
  const { p, q, twist, width, wobble, metalness, roughness, clearcoat, counter } = params;
  const group = useRef();
  const second = useRef();
  const segments = quality === 'low' ? 240 : 520;
  const [c0, c1, c2] = palette.colors;

  // The geometry is rebuilt only when its shape or colours change, never per frame.
  const main = useMemo(
    () => ribbonKnotGeometry({ p, q, twist, width, noise: wobble, segments, colors: [c0, c1, c2] }),
    [p, q, twist, width, wobble, segments, c0, c1, c2],
  );
  const other = useMemo(
    () => (counter ? ribbonKnotGeometry({ p, q, twist: -twist, width: width * 0.7, noise: wobble, segments, radius: 1.35, colors: [c2, c1, c0] }) : null),
    [counter, p, q, twist, width, wobble, segments, c0, c1, c2],
  );
  useEffect(() => () => main.dispose(), [main]);
  useEffect(() => () => other?.dispose(), [other]);

  useFrame(() => {
    const t = clock.current.t;
    if (group.current) {
      group.current.rotation.y = t * 0.15;
      group.current.rotation.x = Math.sin(t * 0.2) * 0.15;
      group.current.scale.setScalar(1 + 0.03 * Math.sin(t * 1.3));
    }
    if (second.current) second.current.rotation.y = -t * 0.24;
  });

  const material = (
    <meshPhysicalMaterial
      vertexColors
      side={DoubleSide}
      metalness={metalness}
      roughness={roughness}
      clearcoat={clearcoat}
      clearcoatRoughness={0.15}
      envMapIntensity={1.3}
    />
  );
  return (
    <group ref={group}>
      <mesh geometry={main}>{material}</mesh>
      {other && (
        <group ref={second}>
          <mesh geometry={other}>{material}</mesh>
        </group>
      )}
    </group>
  );
}
