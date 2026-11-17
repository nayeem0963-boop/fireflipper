import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, Shape } from 'three';
import { getGlowTexture } from '../../utils/textures.js';

/**
 * Primitive-geometry firebird. It faces +X, so a side-scrolling camera sees
 * it in profile. Firebird.jsx renders the GLB fire eagle and falls back to
 * this version while the model loads or if it fails to load, so keep the
 * props identical to Firebird's.
 *
 * Props:
 *  - float:       vertical bob amplitude (world units)
 *  - wingSpeed:   base wing-beat speed (radians/sec)
 *  - glow:        halo sprite opacity
 *  - lightIntensity: strength of the warm point light the bird casts
 *  - flight:      optional live flight state { vy, sinceFlap, dead } from the
 *                 simulation. When given, wings perform a real downstroke on
 *                 each flap, tuck back in a dive and go limp after a crash.
 */
export const STROKE_TIME = 0.26; // seconds for one powered wing stroke

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

/** Wing angle over one flap: snap up, power down, recover. u ∈ [0, 1). */
function flapStroke(u) {
  if (u < 0.12) return 0.4 + (1.05 - 0.4) * easeOut(u / 0.12);
  if (u < 0.5) return 1.05 + (-0.8 - 1.05) * easeOut((u - 0.12) / 0.38);
  return -0.8 + (0.3 + 0.8) * easeInOut((u - 0.5) / 0.5);
}

const COLORS = {
  body: '#ff5a14',
  bodyEmissive: '#c22a06',
  belly: '#ffb347',
  wing: '#ff6a1a',
  wingEmissive: '#ff3c00',
  wingInner: '#ffd36b',
  flame: '#ffe39a',
  eye: '#1a0a04',
};

function createWingShape() {
  // Drawn in the XY plane: x = chord (front/back), y = span (outwards).
  const s = new Shape();
  s.moveTo(0.28, 0);
  s.quadraticCurveTo(0.55, 0.55, 0.3, 1.15);
  s.quadraticCurveTo(0.1, 1.5, -0.25, 1.72); // wing tip
  s.lineTo(-0.3, 1.38);
  s.lineTo(-0.48, 1.28); // feather notches along the trailing edge
  s.lineTo(-0.45, 0.98);
  s.lineTo(-0.62, 0.86);
  s.lineTo(-0.52, 0.56);
  s.lineTo(-0.66, 0.42);
  s.quadraticCurveTo(-0.45, 0.1, -0.3, 0);
  s.closePath();
  return s;
}

export default function PlaceholderFirebird({ float = 0.12, wingSpeed = 7, glow = 0.55, lightIntensity = 6, flight, ...props }) {
  const root = useRef();
  const leftWing = useRef();
  const rightWing = useRef();
  const tail = useRef();
  const crest = useRef();
  const halo = useRef();
  const phase = useRef(0);
  const lift = useRef(0.25);

  const wingShape = useMemo(createWingShape, []);
  const glowMap = useMemo(getGlowTexture, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    let targetLift;
    let sweep = 0;
    let beat;

    if (flight) {
      // Gameplay mode: wings are driven by the flight state.
      const tuck = flight.dead ? 0 : clamp01((-flight.vy - 5) / 7); // fold back in a dive
      phase.current += dt * wingSpeed * (1 - tuck * 0.6);
      beat = Math.sin(phase.current);
      if (flight.dead) {
        targetLift = -0.35 + beat * 0.08; // limp
      } else if (flight.sinceFlap < STROKE_TIME) {
        targetLift = flapStroke(flight.sinceFlap / STROKE_TIME);
      } else {
        targetLift = 0.25 - tuck * 0.2 + beat * 0.5 * (1 - tuck * 0.85);
      }
      sweep = tuck * 0.75;
      if (halo.current) {
        const target = flight.dead ? glow * 0.35 : glow;
        halo.current.opacity += (target - halo.current.opacity) * (1 - Math.exp(-4 * dt));
      }
    } else {
      // Showcase mode: steady idle beat.
      phase.current += dt * wingSpeed;
      beat = Math.sin(phase.current);
      targetLift = 0.25 + beat * 0.55;
    }

    // Smooth toward the target so stroke/idle transitions never pop.
    lift.current += (targetLift - lift.current) * (1 - Math.exp(-30 * dt));
    if (rightWing.current) {
      rightWing.current.rotation.x = Math.PI / 2 - lift.current;
      rightWing.current.rotation.z = sweep;
    }
    if (leftWing.current) {
      leftWing.current.rotation.x = -Math.PI / 2 + lift.current;
      leftWing.current.rotation.z = sweep;
    }

    if (root.current) {
      root.current.position.y = Math.sin(t * 1.6) * float - beat * 0.03;
      root.current.rotation.z = Math.sin(t * 1.1) * 0.06;
      root.current.rotation.x = Math.sin(t * 0.8) * 0.04;
    }
    if (tail.current) {
      tail.current.rotation.z = Math.sin(t * 2.4) * 0.12;
      tail.current.rotation.y = Math.sin(t * 1.7) * 0.1;
    }
    if (crest.current) {
      const flicker = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 21) * 0.05;
      crest.current.scale.set(1, flicker, 1);
    }
  });

  return (
    <group {...props}>
      <group ref={root}>
        {/* Warm light the bird casts onto the scene */}
        <pointLight color="#ff7a2a" intensity={lightIntensity} distance={8} decay={1.6} position={[0.2, 0.3, 0.8]} />

        {/* Halo */}
        <sprite scale={[4.2, 4.2, 1]} renderOrder={-1}>
          <spriteMaterial
            ref={halo}
            map={glowMap}
            color="#ff7a24"
            transparent
            opacity={glow}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </sprite>

        {/* Body */}
        <mesh scale={[1.25, 0.82, 0.78]}>
          <sphereGeometry args={[0.5, 32, 24]} />
          <meshStandardMaterial color={COLORS.body} emissive={COLORS.bodyEmissive} emissiveIntensity={1.4} roughness={0.45} metalness={0.1} />
        </mesh>
        {/* Belly highlight */}
        <mesh position={[0.12, -0.12, 0]} scale={[0.9, 0.55, 0.62]}>
          <sphereGeometry args={[0.5, 24, 16]} />
          <meshStandardMaterial color={COLORS.belly} emissive="#ff9a2e" emissiveIntensity={1.1} roughness={0.5} />
        </mesh>

        {/* Head */}
        <group position={[0.6, 0.3, 0]}>
          <mesh>
            <sphereGeometry args={[0.3, 28, 20]} />
            <meshStandardMaterial color={COLORS.body} emissive={COLORS.bodyEmissive} emissiveIntensity={1.4} roughness={0.4} />
          </mesh>
          {/* Beak */}
          <mesh position={[0.34, -0.04, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.085, 0.3, 12]} />
            <meshStandardMaterial color="#ffcf6a" emissive="#ff9d2a" emissiveIntensity={1.2} roughness={0.3} />
          </mesh>
          {/* Eyes */}
          {[0.2, -0.2].map((z) => (
            <group key={z} position={[0.17, 0.08, z]}>
              <mesh>
                <sphereGeometry args={[0.055, 12, 10]} />
                <meshStandardMaterial color={COLORS.eye} roughness={0.2} />
              </mesh>
              <mesh position={[0.025, 0.02, z > 0 ? 0.03 : -0.03]}>
                <sphereGeometry args={[0.016, 8, 6]} />
                <meshBasicMaterial color="#fff4d6" toneMapped={false} />
              </mesh>
            </group>
          ))}
          {/* Flame crest */}
          <group ref={crest} position={[-0.05, 0.22, 0]}>
            {[
              [0.06, 0.1, -0.35, 0.34],
              [-0.08, 0.06, -0.7, 0.28],
              [-0.2, 0.0, -1.0, 0.22],
            ].map(([x, y, rz, h], i) => (
              <mesh key={i} position={[x, y + h / 2, 0]} rotation={[0, 0, rz]}>
                <coneGeometry args={[0.07, h * 1.6, 10]} />
                <meshBasicMaterial color={COLORS.flame} transparent opacity={0.92} toneMapped={false} />
              </mesh>
            ))}
          </group>
        </group>

        {/* Wings: pivot at the shoulder; rotation.x is animated */}
        <group position={[0.05, 0.18, 0.22]}>
          <group ref={rightWing} rotation={[Math.PI / 2, 0, 0]}>
            <Wing shape={wingShape} />
          </group>
        </group>
        <group position={[0.05, 0.18, -0.22]}>
          <group ref={leftWing} rotation={[-Math.PI / 2, 0, 0]}>
            <Wing shape={wingShape} />
          </group>
        </group>

        {/* Tail plumes */}
        <group ref={tail} position={[-0.55, 0.02, 0]}>
          {[
            [0.25, 0, 1.15],
            [0.05, 0.22, 1.35],
            [0.05, -0.22, 1.35],
            [-0.18, 0.4, 1.0],
            [-0.18, -0.4, 1.0],
          ].map(([rz, ry, len], i) => (
            <group key={i} rotation={[0, ry, rz]}>
              <mesh position={[-len / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.35]}>
                <coneGeometry args={[0.13, len, 10]} />
                <meshStandardMaterial
                  color={COLORS.wing}
                  emissive={COLORS.wingEmissive}
                  emissiveIntensity={1.6}
                  toneMapped={false}
                  roughness={0.6}
                />
              </mesh>
              <mesh position={[-len + 0.05, 0, 0]}>
                <sphereGeometry args={[0.07, 10, 8]} />
                <meshBasicMaterial color={COLORS.flame} toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

function Wing({ shape }) {
  return (
    <>
      <mesh>
        <shapeGeometry args={[shape, 12]} />
        <meshStandardMaterial
          color={COLORS.wing}
          emissive={COLORS.wingEmissive}
          emissiveIntensity={1.3}
          side={DoubleSide}
          roughness={0.55}
          toneMapped={false}
        />
      </mesh>
      {/* Inner, brighter layer for a hot-core gradient */}
      <mesh position={[0.06, 0.02, 0.01]} scale={[0.62, 0.6, 1]}>
        <shapeGeometry args={[shape, 8]} />
        <meshBasicMaterial color={COLORS.wingInner} side={DoubleSide} transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </>
  );
}
