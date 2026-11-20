import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, Shape } from 'three';
import { getGlowTexture, getNeutralGlowTexture } from '../../utils/textures.js';
import { secondaryMotion } from './birdMotion.js';
import AvatarEyes from './AvatarEyes.jsx';

/**
 * The Flipper: a blue-and-yellow macaw built from primitive geometry. It faces +X, so a side-scrolling camera sees it in profile. (The file keeps its old name: it was the original
 * "firebird".) Cobalt-blue back, head and wings with a yellow lining, a green forehead, a yellow breast and belly, a white face patch with a dark chin strap, a big dark hooked beak and a
 * long narrow blue tail with yellow tips. Purely cosmetic: the same size and the same collision as before (the simulation never reads the avatar). It could be replaced by a GLB model loaded
 * with drei's useGLTF; keep the public props stable so the swap is local to this file.
 *
 * Props:
 *  - palette:     optional colour overrides (see systems/skins/skins.js): body, bodyEmissive, belly, bellyEmissive, wing, wingEmissive, wingInner, flame (the tail tips), beak, beakEmissive,
 *                 glow, and for the head crown, face and chin
 *  - neutralGlow: use a plain white halo texture (for the Blue and White colours) instead of the warm one
 *  - float:       vertical bob amplitude (world units)
 *  - wingSpeed:   base wing-beat speed (radians/sec)
 *  - glow:        halo sprite opacity
 *  - lightIntensity: strength of the warm point light the bird casts
 *  - flight:      optional live flight state { vy, sinceFlap, dead } from the
 *                 simulation. When given, wings perform a real downstroke on
 *                 each flap, tuck back in a dive and go limp after a crash.
 */
const STROKE_TIME = 0.26; // seconds for one powered wing stroke

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
  body: '#1f5fe0',
  bodyEmissive: '#0b2f8a',
  belly: '#ffd23a',
  bellyEmissive: '#e0a000',
  wing: '#1b52d4',
  wingEmissive: '#0a3fb8',
  wingInner: '#ffd84a',
  flame: '#fff0a0',
  beak: '#25252c',
  beakEmissive: '#050508',
  glow: '#ffe08a',
  crown: '#2faa6a',
  face: '#f6f3ea',
  chin: '#14141a',
};

/**
 * A macaw's wing, drawn in the XY plane (x = chord, front is +x; y = span, outwards from the shoulder): a broad rounded leading edge, a long tip, four long splayed primary feathers with
 * notches between them, and the shorter scalloped secondaries running back to the body.
 */
function createWingShape() {
  const s = new Shape();
  s.moveTo(0.3, 0);
  s.quadraticCurveTo(0.64, 0.45, 0.44, 0.95); // the leading edge out to the wrist
  s.quadraticCurveTo(0.26, 1.5, 0.02, 2.0); // and on to the tip of the longest primary
  s.lineTo(-0.1, 1.72); // between the primaries
  s.lineTo(-0.2, 1.84);
  s.lineTo(-0.27, 1.52);
  s.lineTo(-0.38, 1.62);
  s.lineTo(-0.43, 1.28);
  s.lineTo(-0.56, 1.34);
  s.lineTo(-0.56, 1.0);
  s.lineTo(-0.68, 0.92); // the secondaries
  s.lineTo(-0.6, 0.62);
  s.lineTo(-0.72, 0.46);
  s.lineTo(-0.5, 0.14);
  s.lineTo(-0.3, 0);
  s.closePath();
  return s;
}

/** The yellow-gold lining of the wing: the underwing coverts, a scoop along the body end of the wing and the secondaries. */
function createLiningShape() {
  const s = new Shape();
  s.moveTo(0.22, 0.04);
  s.quadraticCurveTo(0.42, 0.45, 0.22, 0.92);
  s.quadraticCurveTo(0.0, 1.1, -0.2, 1.0);
  s.lineTo(-0.42, 0.86);
  s.lineTo(-0.5, 0.5);
  s.lineTo(-0.38, 0.3);
  s.lineTo(-0.28, 0.06);
  s.closePath();
  return s;
}

export default function Firebird({
  palette,
  neutralGlow = false,
  float = 0.12,
  wingSpeed = 7,
  glow = 0.55,
  lightIntensity = 6,
  flight,
  ...props
}) {
  const root = useRef();
  const leftWing = useRef();
  const rightWing = useRef();
  const tail = useRef();
  const halo = useRef();
  const colors = useMemo(() => ({ ...COLORS, ...palette }), [palette]);
  const phase = useRef(0);
  const lift = useRef(0.25);
  const lag = useRef(0.25);

  const wingShape = useMemo(createWingShape, []);
  const liningShape = useMemo(createLiningShape, []);
  const glowMap = useMemo(() => (neutralGlow ? getNeutralGlowTexture() : getGlowTexture()), [neutralGlow]);

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
    lag.current += (lift.current - lag.current) * (1 - Math.exp(-12 * dt));
    // The rest of the body moves with the wings: it heaves and pitches, and the tail flexes against the pitch.
    const move = secondaryMotion(lift.current, lag.current, flight?.dead);
    if (rightWing.current) {
      rightWing.current.rotation.x = Math.PI / 2 - lift.current;
      rightWing.current.rotation.z = sweep;
    }
    if (leftWing.current) {
      leftWing.current.rotation.x = -Math.PI / 2 + lift.current;
      leftWing.current.rotation.z = sweep;
    }

    if (root.current) {
      root.current.position.y = Math.sin(t * 1.6) * float + move.heave;
      root.current.rotation.z = Math.sin(t * 1.1) * 0.06 + move.bodyPitch;
      root.current.rotation.x = Math.sin(t * 0.8) * 0.04;
    }
    if (tail.current) {
      tail.current.rotation.z = Math.sin(t * 2.4) * 0.12 + move.tailPitch;
      tail.current.rotation.y = Math.sin(t * 1.7) * 0.1;
    }
  });

  return (
    <group {...props}>
      <group ref={root}>
        {/* Warm light the bird casts onto the scene */}
        <pointLight
          color={colors.glow}
          intensity={lightIntensity}
          distance={8}
          decay={1.6}
          position={[0.2, 0.3, 0.8]}
        />

        {/* Halo */}
        <sprite scale={[4.2, 4.2, 1]} renderOrder={-1}>
          <spriteMaterial
            ref={halo}
            map={glowMap}
            color={colors.glow}
            transparent
            opacity={glow}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </sprite>

        {/* Body: the blue back, with the yellow breast and belly in front of and below it */}
        <mesh scale={[1.25, 0.82, 0.78]}>
          <sphereGeometry args={[0.5, 32, 24]} />
          <meshStandardMaterial color={colors.body} emissive={colors.bodyEmissive} emissiveIntensity={0.8} roughness={0.5} metalness={0.05} />
        </mesh>
        <mesh position={[0.2, -0.08, 0]} scale={[1.05, 0.76, 0.8]}>
          <sphereGeometry args={[0.5, 24, 16]} />
          <meshStandardMaterial color={colors.belly} emissive={colors.bellyEmissive} emissiveIntensity={0.55} roughness={0.55} />
        </mesh>

        {/* Head */}
        <group position={[0.62, 0.32, 0]}>
          <mesh>
            <sphereGeometry args={[0.3, 28, 20]} />
            <meshStandardMaterial color={colors.body} emissive={colors.bodyEmissive} emissiveIntensity={0.8} roughness={0.45} />
          </mesh>
          {/* The green forehead: a cap over the front of the crown */}
          <mesh position={[0.03, 0.02, 0]} rotation={[0, 0, -0.55]} scale={1.02}>
            <sphereGeometry args={[0.3, 24, 12, 0, Math.PI * 2, 0, 0.78]} />
            <meshStandardMaterial color={colors.crown} emissive={colors.crown} emissiveIntensity={0.35} roughness={0.5} />
          </mesh>
          {/* The white face patch round each eye, and the dark chin strap under the beak */}
          {[1, -1].map((side) => (
            <mesh key={side} position={[0.15, 0.04, 0.235 * side]} scale={[0.17, 0.14, 0.05]}>
              <sphereGeometry args={[1, 18, 12]} />
              <meshStandardMaterial color={colors.face} emissive={colors.face} emissiveIntensity={0.25} roughness={0.7} />
            </mesh>
          ))}
          <mesh position={[0.27, -0.2, 0]} scale={[0.12, 0.05, 0.12]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color={colors.chin} roughness={0.6} />
          </mesh>
          {/* The big hooked beak: a deep upper mandible curving down to a point over a smaller lower one */}
          <group position={[0.3, -0.03, 0]}>
            <mesh position={[0.06, 0.0, 0]} scale={[1.5, 1.0, 0.78]}>
              <sphereGeometry args={[0.14, 20, 14]} />
              <meshStandardMaterial color={colors.beak} emissive={colors.beakEmissive} emissiveIntensity={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[0.26, -0.09, 0]} rotation={[0, 0, -2.5]}>
              <coneGeometry args={[0.065, 0.16, 12]} />
              <meshStandardMaterial color={colors.beak} emissive={colors.beakEmissive} emissiveIntensity={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[0.02, -0.12, 0]} scale={[1.2, 0.55, 0.7]}>
              <sphereGeometry args={[0.1, 16, 10]} />
              <meshStandardMaterial color={colors.beak} emissive={colors.beakEmissive} emissiveIntensity={0.5} roughness={0.4} />
            </mesh>
          </group>
          {/* Eyes: big and bright, on the white patch */}
          <AvatarEyes at={[0.17, 0.08, 0.23]} size={0.07} outwardAxis="z" forward={1} palette={colors} flight={flight} />
        </group>

        {/* Wings: pivot at the shoulder; rotation.x is animated */}
        <group position={[0.05, 0.18, 0.22]}>
          <group ref={rightWing} rotation={[Math.PI / 2, 0, 0]}>
            <Wing shape={wingShape} lining={liningShape} colors={colors} />
          </group>
        </group>
        <group position={[0.05, 0.18, -0.22]}>
          <group ref={leftWing} rotation={[-Math.PI / 2, 0, 0]}>
            <Wing shape={wingShape} lining={liningShape} colors={colors} />
          </group>
        </group>

        {/* A long graduated tail: five leaf-shaped blue feathers, the two in the middle longest, fanned a little, with yellow tips */}
        <group ref={tail} position={[-0.55, 0.02, 0]}>
          {[
            [0.08, 0.0, 2.8, 0.05],
            [0.15, 0.1, 2.55, -0.05],
            [0.02, -0.1, 2.55, 0.0],
            [0.22, 0.22, 2.1, -0.03],
            [-0.04, -0.22, 2.1, 0.03],
          ].map(([rz, ry, len, lift], i) => (
            <group key={i} rotation={[0, ry, rz]} position={[0, lift, 0]}>
              <mesh position={[-len / 2, 0, 0]} scale={[len / 2, 0.095, 0.03]}>
                <sphereGeometry args={[1, 14, 8]} />
                <meshStandardMaterial color={colors.wing} emissive={colors.wingEmissive} emissiveIntensity={0.9} toneMapped={false} roughness={0.6} />
              </mesh>
              <mesh position={[-len + 0.14, 0, 0.004]} scale={[0.17, 0.075, 0.03]}>
                <sphereGeometry args={[1, 12, 8]} />
                <meshBasicMaterial color={colors.flame} toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

function Wing({ shape, lining, colors }) {
  return (
    <>
      <mesh>
        <shapeGeometry args={[shape, 12]} />
        <meshStandardMaterial color={colors.wing} emissive={colors.wingEmissive} emissiveIntensity={0.9} side={DoubleSide} roughness={0.55} toneMapped={false} />
      </mesh>
      {/* The yellow-gold lining of the underwing, showing as the wing beats */}
      <mesh position={[0, 0, 0.012]}>
        <shapeGeometry args={[lining, 8]} />
        <meshBasicMaterial color={colors.wingInner} side={DoubleSide} transparent opacity={0.92} toneMapped={false} />
      </mesh>
    </>
  );
}
