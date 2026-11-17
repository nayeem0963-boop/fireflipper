import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Euler, MathUtils, Matrix4, Vector3 } from 'three';
import { modelUrl } from '../../systems/avatars/avatars.js';
import FlameAura from './FlameAura.jsx';
import AvatarEyes from './AvatarEyes.jsx';
import { secondaryMotion, wingLiftTarget } from './birdMotion.js';
import { createFireMaterial, createFireUniforms } from './fireMaterial.js';

/**
 * A third-party bird model (see systems/avatars/credits.js) turned into a fire bird: its plumage is re-lit with a
 * flame gradient and glow, and it gets a flame tail, a halo and a warm light. The models are static (no skeleton),
 * so wing beats are suggested by a gentle body pulse and rocking, and each flap by a quick nose-up kick.
 *
 * Takes the same props as Firebird so either can be dropped into the same scene.
 */
const STROKE_TIME = 0.22;
const easeOut = (u) => 1 - (1 - u) * (1 - u);

export default function ModelBird({
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
  const eyeRig = useRef();
  const phase = useRef(Math.random() * 6);
  const kick = useRef(0);
  const lift = useRef(0.25);
  const lag = useRef(0.25);

  // A private copy of the model with fire materials, centred and scaled to the avatar's length.
  const prepared = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    // Wing beats are done in the shader (see fireMaterial.js): everything beyond `start` from the body's centre line
    // bends about the shoulder. `start`/`full` are fractions of the half wingspan.
    const f = avatar.flap;
    const half = (box.max.x - box.min.x) / 2;
    const flap = f && {
      start: f.start * half,
      full: f.full * half,
      hinge: [center.x, box.min.y + (box.max.y - box.min.y) * f.hingeFrac, center.z],
      axis: f.axis,
    };
    // Head and tail follow the wings (see birdMotion.js): the ends of the body pitch about the shoulder, the head end
    // being +z when the model faces +x after turning by +90 degrees, and -z otherwise.
    const halfLength = (box.max.z - box.min.z) / 2;
    const bend = {
      start: (avatar.bend?.start ?? 0.3) * halfLength,
      full: (avatar.bend?.full ?? 0.8) * halfLength,
      headSign: Math.sign(avatar.facing) || 1,
      hinge: flap?.hinge ?? [center.x, center.y, center.z],
    };
    const uniforms = createFireUniforms(avatar.palette, box.min.y, box.max.y, flap, bend);
    const root = scene.clone(true);
    const materials = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = createFireMaterial(o.material, uniforms, 'bird');
      materials.push(o.material);
    });
    // Fit the silhouette the camera sees (its x-y extent once turned and pitched) to the avatar's target size.
    const turn = new Matrix4().makeRotationFromEuler(new Euler(0, avatar.facing, 0));
    const tilt = new Matrix4().makeRotationFromEuler(new Euler(0, 0, avatar.pitch));
    const seen = box
      .clone()
      .translate(center.clone().negate())
      .applyMatrix4(turn)
      .applyMatrix4(tilt)
      .getSize(new Vector3());
    // The eyes ride the head: a rig at the shoulder hinge pitches them with the head end, as the shader does.
    const hinge = new Vector3(...bend.hinge);
    const eyeAbs = center.clone().add(new Vector3(...avatar.eye.at));
    const eye = {
      hinge,
      at: [avatar.eye.at[0], eyeAbs.y - hinge.y, eyeAbs.z - hinge.z],
      along: (eyeAbs.z - hinge.z) * bend.headSign,
      start: bend.start,
      full: bend.full,
    };
    return { root, materials, center, uniforms, eye, scale: avatar.length / Math.max(seen.x, seen.y, 0.001) };
  }, [scene, avatar]);

  useEffect(() => () => prepared.materials.forEach((m) => m.dispose()), [prepared]);

  const tail = -avatar.length / 2;

  useFrame((state, delta) => {
    const g = wrap.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    phase.current += dt * wingSpeed;
    const beat = Math.sin(phase.current);

    let dead = false;
    if (flight) {
      dead = flight.dead;
      kick.current =
        !dead && flight.sinceFlap < STROKE_TIME
          ? easeOut(1 - flight.sinceFlap / STROKE_TIME)
          : kick.current * 0.85;
    }
    const k = kick.current;
    const s = prepared.scale;
    g.position.y = avatar.lift + Math.sin(t * 1.8 + 1) * float;
    // Flap suggestion: nose-up kick, a little stretch, and a soft pulse and rock in between.
    g.rotation.z = k * 0.2;
    g.rotation.x = dead ? 1.1 : beat * 0.05;
    if (avatar.flap) {
      // Real wing beats: the same stroke as the other birds, bending the wings about the shoulders in the shader.
      lift.current = MathUtils.damp(lift.current, wingLiftTarget(flight, beat), 22, dt);
      lag.current = MathUtils.damp(lag.current, lift.current, 12, dt);
      prepared.uniforms.uFlap.value = (lift.current - 0.25) * avatar.flap.strength;
      // The rest of the body moves with the wings: the body heaves and pitches, the head and tail counter it.
      const move = secondaryMotion(lift.current, lag.current, dead);
      prepared.uniforms.uHeadPitch.value = move.headPitch;
      prepared.uniforms.uTailPitch.value = move.tailPitch;
      const e = prepared.eye;
      if (eyeRig.current) {
        const w = MathUtils.smoothstep(e.along, e.start, e.full);
        eyeRig.current.rotation.x = -Math.sign(avatar.facing || 1) * move.headPitch * w;
      }
      g.position.y += move.heave;
      g.rotation.z += move.bodyPitch;
      g.scale.set(s, s, s);
    } else {
      // No wing data for this model: suggest the beat with a body pulse.
      g.scale.set(s * (1 - 0.04 * k), s * (1 + 0.07 * k + (dead ? 0 : beat * 0.025)), s);
    }
  });

  const { palette } = avatar;
  return (
    <group {...props}>
      <FlameAura
        palette={palette}
        neutral={avatar.color !== 'fire'}
        tailX={tail}
        glow={glow}
        lightIntensity={lightIntensity}
      />

      <group ref={wrap}>
        <group rotation={[0, 0, avatar.pitch]}>
          <group rotation={[0, avatar.facing, 0]}>
            <primitive
              object={prepared.root}
              scale={1}
              position={[-prepared.center.x, -prepared.center.y, -prepared.center.z]}
            />
            <group position={[-prepared.center.x, -prepared.center.y, -prepared.center.z]}>
              <group ref={eyeRig} position={prepared.eye.hinge}>
                <AvatarEyes
                  at={prepared.eye.at}
                  size={avatar.eye.size}
                  outwardAxis="x"
                  forward={Math.sign(avatar.facing) || 1}
                  palette={palette}
                  flight={flight}
                />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
