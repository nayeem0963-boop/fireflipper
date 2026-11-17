import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Euler, MathUtils, Matrix4, Vector3 } from 'three';
import { modelUrl } from '../../systems/avatars/avatars.js';
import { createFireMaterial, createFireUniforms } from './fireMaterial.js';
import FlameAura from './FlameAura.jsx';
import { secondaryMotion, wingLiftTarget } from './birdMotion.js';
import { splitWing } from '../../systems/avatars/splitWing.js';

/**
 * The blue morpho butterfly model as a fire butterfly. The model is one static mesh per wing pair, but the two
 * wings are joined only at the body, so each wing mesh is split into a left and a right half at run time (by which
 * side of the body each triangle lies on, sharing the same vertex data). Each half hangs from a hinge along the
 * body, so the wings beat for real: a snap up, a powered downstroke, a recovery, with the same stroke as the birds.
 *
 * Takes the same props as Firebird so either can be dropped into the same scene.
 */

export default function ButterflyBird({
  avatar,
  float = 0.12,
  wingSpeed = 7,
  glow = 0.55,
  lightIntensity = 6,
  flight,
  ...props
}) {
  const { scene } = useGLTF(modelUrl(avatar));
  const wrap = useRef();
  const leftPivot = useRef();
  const rightPivot = useRef();
  const state = useRef({ phase: Math.random() * 6, lift: 0.25, lag: 0.25 });

  const prepared = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    // The wings keep their shape; only the body mesh bends (head and abdomen) with the wing stroke. The head is at the
    // model's -z end for this butterfly, which `facing` encodes.
    const wingUniforms = createFireUniforms(avatar.palette, box.min.y, box.max.y);
    const halfLength = (box.max.z - box.min.z) / 2;
    const bodyUniforms = createFireUniforms(avatar.palette, box.min.y, box.max.y, null, {
      start: 0.3 * halfLength,
      full: 0.8 * halfLength,
      headSign: Math.sign(avatar.facing) || 1,
      hinge: avatar.hingePoint,
    });
    const wings = [];
    let body = null;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const isWing = /wing/i.test(o.name);
      const material = createFireMaterial(o.material, isWing ? wingUniforms : bodyUniforms, 'butterfly');
      if (isWing) {
        const { left, right } = splitWing(o.geometry);
        wings.push({ left, right, material });
      } else {
        body = { geometry: o.geometry, material };
      }
    });
    // The size the camera sees once the model is turned, rolled and pitched.
    const turn = new Matrix4()
      .makeRotationFromEuler(new Euler(0, 0, avatar.pitch))
      .multiply(new Matrix4().makeRotationFromEuler(new Euler(avatar.roll, 0, 0)))
      .multiply(new Matrix4().makeRotationFromEuler(new Euler(0, avatar.facing, 0)));
    const seen = box.clone().translate(center.clone().negate()).applyMatrix4(turn).getSize(new Vector3());
    return { wings, body, center, bodyUniforms, scale: avatar.length / Math.max(seen.x, seen.y, 0.001) };
  }, [scene, avatar]);

  useEffect(
    () => () => {
      prepared.wings.forEach((w) => {
        w.left.dispose();
        w.right.dispose();
        w.material.dispose();
      });
      prepared.body?.material.dispose();
    },
    [prepared],
  );

  useFrame((frame, delta) => {
    const g = wrap.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const s = state.current;
    s.phase += dt * wingSpeed;
    s.lift = MathUtils.damp(s.lift, wingLiftTarget(flight, Math.sin(s.phase)), 22, dt);
    s.lag = MathUtils.damp(s.lag, s.lift, 12, dt);
    // The body moves with the wings: it heaves and pitches, the head and abdomen counter the pitch.
    const move = secondaryMotion(s.lift, s.lag, flight?.dead);
    prepared.bodyUniforms.uHeadPitch.value = move.headPitch;
    prepared.bodyUniforms.uTailPitch.value = move.tailPitch;
    g.position.y = Math.sin(frame.clock.elapsedTime * 1.8 + 1) * float + move.heave;
    g.rotation.x = flight?.dead ? 1.1 : 0;
    g.rotation.z = move.bodyPitch;
    // The wings rest raised in a V; the stroke swings them about the body axis, higher on the upstroke and down
    // past level on the downstroke.
    const swing = (s.lift - 0.35) * avatar.beat;
    // The hinge axis points toward the head, so a positive turn about it lowers the right wing.
    if (rightPivot.current) rightPivot.current.rotation.z = -swing;
    if (leftPivot.current) leftPivot.current.rotation.z = swing;
  });

  const { center, scale } = prepared;
  const [hx, hy, hz] = avatar.hingePoint;
  return (
    <group {...props}>
      <FlameAura
        palette={avatar.palette}
        tailX={-avatar.length / 2}
        glow={glow}
        lightIntensity={lightIntensity}
      />
      <group ref={wrap} scale={scale}>
        <group rotation={[0, 0, avatar.pitch]}>
          {/* Rolled about the line of flight so the camera sees the faces of the wings, not just their edge */}
          <group rotation={[avatar.roll, 0, 0]}>
            <group rotation={[0, avatar.facing, 0]}>
              <group position={[-center.x, -center.y, -center.z]}>
                {prepared.body && (
                  <mesh geometry={prepared.body.geometry} material={prepared.body.material} />
                )}
                {[
                  [leftPivot, 'left'],
                  [rightPivot, 'right'],
                ].map(([ref, side]) => (
                  // The hinge runs along the body, which is tilted in the model's resting pose: tilt a frame to
                  // line its z axis up with the body, turn the wing about that axis, and undo the tilt.
                  <group key={side} position={[hx, hy, hz]} rotation={[avatar.hingeTilt, 0, 0]}>
                    <group ref={ref}>
                      <group rotation={[-avatar.hingeTilt, 0, 0]}>
                        <group position={[-hx, -hy, -hz]}>
                          {prepared.wings.map((w, i) => (
                            <mesh key={i} geometry={w[side]} material={w.material} />
                          ))}
                        </group>
                      </group>
                    </group>
                  </group>
                ))}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
