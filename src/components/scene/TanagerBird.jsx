import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, MathUtils, MeshStandardMaterial } from 'three';
import { TANAGER, createTanagerParts, wingSegment } from '../../systems/avatars/tanager.js';
import FlameAura from './FlameAura.jsx';
import AvatarEyes from './AvatarEyes.jsx';
import { secondaryMotion, wingLiftTarget } from './birdMotion.js';

/**
 * The code-built tanager as a fire bird. Unlike the static models, its wings are real: an arm and a hand segment
 * that beat with the same stroke as the original firebird (snap up, powered downstroke, recovery), with the hand
 * lagging the arm so each beat ripples out to the wingtip. Legs tuck, the tail trails, and the head nods.
 *
 * Takes the same props as Firebird so either can be dropped into the same scene.
 */
const SCALE = 4.4; // 0.44 m long -> about 2 units, the same on-screen size as the other birds

function Wing({ side, shoulderRef, elbowRef, geometries, material, at }) {
  return (
    <group ref={shoulderRef} position={[side * at.x, at.y, at.z]} scale={[side, 1, 1]}>
      <mesh geometry={geometries.inner} material={material} />
      <group ref={elbowRef} position={[at.innerSpan * 0.97, 0, 0]}>
        <mesh geometry={geometries.outer} material={material} />
      </group>
    </group>
  );
}

export default function TanagerBird({
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
  const head = useRef();
  const tail = useRef();
  const legs = useRef();
  const shoulderR = useRef();
  const shoulderL = useRef();
  const elbowR = useRef();
  const elbowL = useRef();
  const state = useRef({ phase: Math.random() * 6, lift: 0.25, lag: 0.25 });

  // Parts, wings and the shared materials; rebuilt only if the avatar changes.
  const built = useMemo(() => {
    const parts = createTanagerParts(palette.colors);
    const L = TANAGER.length;
    const [x, y, z] = TANAGER.shoulder;
    const at = { x, y, z, innerSpan: L * 0.32 };
    return {
      parts,
      at,
      wing: {
        inner: wingSegment(at.innerSpan, L * 0.3, L * 0.27, 3, palette.wing),
        outer: wingSegment(L * 0.4, L * 0.27, L * 0.1, 5, palette.wing),
      },
      material: new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.7,
        metalness: 0,
        side: DoubleSide,
        emissive: palette.glow,
        emissiveIntensity: 0.35,
      }),
    };
  }, [palette]);

  useEffect(
    () => () => {
      Object.values(built.parts).forEach((g) => g.dispose());
      built.wing.inner.dispose();
      built.wing.outer.dispose();
      built.material.dispose();
    },
    [built],
  );

  useFrame((frame, delta) => {
    const g = wrap.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const s = state.current;
    s.phase += dt * wingSpeed;
    const beat = Math.sin(s.phase);
    s.lift = MathUtils.damp(s.lift, wingLiftTarget(flight, beat), 22, dt);
    s.lag = MathUtils.damp(s.lag, s.lift, 12, dt); // the hand follows the arm
    const dead = flight?.dead;

    // The rest of the body moves with the wings: it heaves and pitches, and the head and tail counter the pitch.
    const move = secondaryMotion(s.lift, s.lag, dead);
    g.position.y = Math.sin(frame.clock.elapsedTime * 1.8 + 1) * float + move.heave;
    g.rotation.x = dead ? 1.1 : 0;
    g.rotation.z = move.bodyPitch;

    for (const [shoulder, elbow, side] of [
      [shoulderR.current, elbowR.current, 1],
      [shoulderL.current, elbowL.current, -1],
    ]) {
      if (!shoulder || !elbow) continue;
      shoulder.rotation.set(0, 0, side * s.lift);
      elbow.rotation.z = (s.lag - s.lift) * 0.9 + s.lift * 0.35;
    }
    // In flight: legs tucked up, tail fanned down a little and trailing, head level with a slight nod.
    if (legs.current) {
      legs.current.scale.y = 0.5;
      legs.current.rotation.x = 0.7 + move.bodyPitch * 0.5; // they trail a little as the body pitches
    }
    // For this bird a positive turn about x raises the tail and lowers the head, so the pitches enter negated.
    if (tail.current) {
      tail.current.rotation.x = MathUtils.damp(
        tail.current.rotation.x,
        0.25 + s.lift * 0.1 - move.tailPitch,
        14,
        dt,
      );
    }
    if (head.current) {
      head.current.rotation.x = MathUtils.damp(
        head.current.rotation.x,
        -0.1 + beat * 0.03 - move.headPitch,
        14,
        dt,
      );
    }
  });

  const [hx, hy, hz] = TANAGER.neck;
  const [tx, ty, tz] = TANAGER.tailRoot;
  return (
    <group {...props}>
      <FlameAura palette={palette} tailX={-avatar.length / 2} glow={glow} lightIntensity={lightIntensity} />
      <group ref={wrap} scale={SCALE}>
        {/* The tanager faces +z; turn it to face the direction of flight (+x). Centre it on its middle height. */}
        <group rotation={[0, Math.PI / 2, 0]} position={[0, -TANAGER.height / 2, 0]}>
          <mesh geometry={built.parts.body} material={built.material} />
          <group ref={legs} position={[0, 0.07, 0.005]}>
            <group position={[0, -0.07, -0.005]}>
              <mesh geometry={built.parts.legs} material={built.material} />
            </group>
          </group>
          <group ref={head} position={[hx, hy, hz]}>
            <mesh geometry={built.parts.head} material={built.material} />
            {/* Big glowing eyes, on the head so they nod with it (the builder's own tiny eyes were removed). */}
            <AvatarEyes
              at={[0.05, 0.222 - hy, 0.14 - hz]}
              size={0.026}
              outwardAxis="x"
              forward={1}
              palette={palette}
              flight={flight}
            />
          </group>
          <group ref={tail} position={[tx, ty, tz]}>
            <mesh geometry={built.parts.tail} material={built.material} />
          </group>
          <Wing
            side={1}
            shoulderRef={shoulderR}
            elbowRef={elbowR}
            geometries={built.wing}
            material={built.material}
            at={built.at}
          />
          <Wing
            side={-1}
            shoulderRef={shoulderL}
            elbowRef={elbowL}
            geometries={built.wing}
            material={built.material}
            at={built.at}
          />
        </group>
      </group>
    </group>
  );
}
