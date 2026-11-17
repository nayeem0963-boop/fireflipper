import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, MeshStandardMaterial } from 'three';
import FlameAura from './FlameAura.jsx';
import { wingLiftTarget } from './birdMotion.js';

/**
 * Bulbuli, the red-whiskered bulbul mascot, as a fire bird: a low-poly figure built from primitives (a dark body,
 * a pointed crest, red cheek patches, a pale belly and a vent under the tail), ported from the Bulbuli project's
 * own player bird. Its wings really beat (an arm and a hand segment with the hand lagging, using the same stroke
 * as the original firebird). The crest, cheeks and vent glow.
 *
 * Takes the same props as Firebird so either can be dropped into the same scene.
 */
const SCALE = 1.25; // the figure is about 1.6 units nose to tail

export default function BulbuliBird({
  avatar,
  float = 0.12,
  wingSpeed = 7,
  glow = 0.55,
  lightIntensity = 6,
  flight,
  ...props
}) {
  const { palette } = avatar;
  const wrap = useRef();
  const wingL = useRef();
  const wingR = useRef();
  const handL = useRef();
  const handR = useRef();
  const tailRef = useRef();
  const state = useRef({ phase: Math.random() * 6, lift: 0.25, lag: 0.25 });

  const m = useMemo(() => {
    const lit = (color, intensity = 2.5) =>
      new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, toneMapped: false });
    return {
      body: new MeshStandardMaterial({
        color: palette.body,
        emissive: palette.glow,
        emissiveIntensity: 0.3,
        flatShading: true,
        roughness: 0.55,
      }),
      wing: new MeshStandardMaterial({
        color: palette.wing,
        emissive: palette.glow,
        emissiveIntensity: 0.45,
        flatShading: true,
        roughness: 0.6,
      }),
      belly: new MeshStandardMaterial({
        color: palette.belly,
        emissive: palette.belly,
        emissiveIntensity: 0.25,
        flatShading: true,
      }),
      crest: lit(palette.crest, 3),
      cheek: lit(palette.cheek, 3),
      accent: lit(palette.accent, 2.5),
      beak: lit(palette.beak, 1.6),
      eye: new MeshStandardMaterial({
        color: palette.eye,
        emissive: palette.eye,
        emissiveIntensity: 1.5,
        toneMapped: false,
      }),
    };
  }, [palette]);
  useEffect(() => () => Object.values(m).forEach((mat) => mat.dispose()), [m]);

  useFrame((frame, delta) => {
    const g = wrap.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const s = state.current;
    s.phase += dt * wingSpeed;
    const beat = Math.sin(s.phase);
    s.lift = MathUtils.damp(s.lift, wingLiftTarget(flight, beat), 22, dt);
    s.lag = MathUtils.damp(s.lag, s.lift, 12, dt);
    g.position.y = Math.sin(frame.clock.elapsedTime * 1.8 + 1) * float;
    g.rotation.x = flight?.dead ? 1.1 : 0;
    // The wings hang from the shoulders along +-x; raising the tip is a turn about z (opposite for each side).
    if (wingR.current) wingR.current.rotation.z = s.lift;
    if (wingL.current) wingL.current.rotation.z = -s.lift;
    const hand = (s.lag - s.lift) * 0.9 + s.lift * 0.35;
    if (handR.current) handR.current.rotation.z = hand;
    if (handL.current) handL.current.rotation.z = -hand;
    if (tailRef.current) tailRef.current.rotation.x = -0.2 + s.lift * 0.12;
  });

  return (
    <group {...props}>
      <FlameAura palette={palette} tailX={-avatar.length / 2} glow={glow} lightIntensity={lightIntensity} />
      <group ref={wrap} scale={SCALE}>
        {/* Bulbuli faces +z; turn it to face the direction of flight (+x) and centre it. */}
        <group rotation={[0, Math.PI / 2, 0]} position={[0, -0.1, 0.12]}>
          <mesh material={m.body} scale={[0.38, 0.34, 0.52]}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          <mesh material={m.belly} position={[0, -0.12, 0.2]} scale={[0.28, 0.22, 0.3]}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          {/* head, pointed crest and beak */}
          <mesh material={m.body} position={[0, 0.34, 0.2]} scale={0.24}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          <mesh
            material={m.crest}
            position={[0, 0.59, 0.18]}
            rotation={[-0.35, 0, 0]}
            scale={[0.1, 0.32, 0.1]}
          >
            <coneGeometry args={[1, 1, 5]} />
          </mesh>
          <mesh
            material={m.beak}
            position={[0, 0.32, 0.49]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[0.07, 0.17, 0.07]}
          >
            <coneGeometry args={[1, 1, 5]} />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh material={m.belly} position={[side * 0.17, 0.25, 0.27]} scale={[0.07, 0.08, 0.08]}>
                <icosahedronGeometry args={[1, 1]} />
              </mesh>
              <mesh material={m.cheek} position={[side * 0.2, 0.36, 0.22]} scale={0.06}>
                <icosahedronGeometry args={[1, 1]} />
              </mesh>
              <mesh material={m.eye} position={[side * 0.13, 0.37, 0.37]} scale={0.04}>
                <icosahedronGeometry args={[1, 1]} />
              </mesh>
            </group>
          ))}
          {/* wings: shoulder pivots, an arm and a hand that lags it */}
          {[-1, 1].map((side) => (
            <group key={`w${side}`} ref={side < 0 ? wingL : wingR} position={[side * 0.28, 0.1, 0]}>
              <mesh material={m.wing} position={[side * 0.24, 0, -0.02]} scale={[0.34, 0.06, 0.26]}>
                <icosahedronGeometry args={[1, 1]} />
              </mesh>
              <group ref={side < 0 ? handL : handR} position={[side * 0.48, 0, -0.02]}>
                <mesh material={m.wing} position={[side * 0.2, 0, -0.03]} scale={[0.26, 0.045, 0.18]}>
                  <icosahedronGeometry args={[1, 1]} />
                </mesh>
                <mesh material={m.accent} position={[side * 0.44, 0, -0.04]} scale={[0.04, 0.04, 0.12]}>
                  <boxGeometry args={[1, 1, 1]} />
                </mesh>
              </group>
            </group>
          ))}
          {/* tail and the vent beneath it */}
          <group ref={tailRef} position={[0, 0.02, -0.5]}>
            <mesh material={m.accent} position={[0, 0, -0.26]} scale={[0.16, 0.04, 0.5]}>
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
          </group>
          <mesh material={m.cheek} position={[0, -0.06, -0.55]} scale={[0.12, 0.07, 0.2]}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
