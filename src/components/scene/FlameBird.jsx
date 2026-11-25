import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { AdditiveBlending, AnimationClip, AnimationMixer, Color, Matrix4, Quaternion, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { getGlowTexture } from '../../utils/textures.js';
import { modelUrl } from '../../systems/avatars/avatars.js';
import { createMotion, stepMotion } from './flameBirdMotion.js';
import AvatarEyes from './AvatarEyes.jsx';

/**
 * FlameBird, the Fire Flipper mascot (see systems/avatars/avatars.js and public/models/CREDITS.md). A rigged GLB with
 * its own clips; this draws it with the real `FB_Fly` and `FB_WingFlap` clips, timed from the flight state:
 *
 *  - the cruise beat (FB_Fly) runs at `wingSpeed`, easing slower in a dive and to a stop after a crash; each flap
 *    cross-fades in FB_WingFlap's powered downstroke (STROKE_TIME, the same stroke as every other bird), so taps never
 *    make the wings jump; the head, crest and tail follow through on springs (see flameBirdMotion.js);
 *  - Fire shows the model's own painted textures; Blue and White re-colour them by brightness (see `palette.mix`);
 *  - a soft halo and a warm light in the colour's `glow`, like the other fire birds;
 *  - in flight it is seen in profile, facing the direction of flight (+X), and pitches with the game; in menus and the
 *    picker (no flight state) it turns to face the viewer (FACE_YAW), so its face and eyes show;
 *  - animated eyes (AvatarEyes: blink, look ahead with small glances, look up when climbing, shut on a crash) are
 *    flattened into the face over the painted eyes, on the head bone, so they follow every head movement.
 *
 * Purely cosmetic: the simulation never reads it, so collision and physics are the same for every bird.
 * The other clips in the file (FB_Idle, FB_TailSway, FB_Celebrate) are available for later use.
 *
 * Props: avatar, float (bob amplitude), wingSpeed (radians/sec), glow (halo opacity), lightIntensity, flight
 * ({ vy, sinceFlap, dead } or omitted for menus), plus group props.
 */
const MODEL_HEIGHT = 1.903; // the model's own height in metres
const SIZE = 2.6; // drawn height, in the Firebird's local units: matches the Fire Eagle's on-screen size (it is a chunky, upright bird, so it needs more height than the 2.0 to 2.4 length of the slim model birds)
const MODEL_SCALE = SIZE / MODEL_HEIGHT;
const FLIGHT_YAW = Math.PI / 2; // in flight: profile, the beak towards +X (the direction of flight)
const FACE_YAW = 0.35; // in menus: front to the viewer, turned a little towards +X
// The painted eyes, in the model's own glTF space (metres; the model faces +Z): the point between them, half the
// distance between their centres, and the eye size (AvatarEyes units: its rim is 1.2 x this across).
const EYE_MID = new Vector3(-0.0025, 0.255, 0.452); // just under the face surface (about 0.476), so the eyes sit in it
const EYE_HALF = 0.15;
const EYE_SIZE = 0.072;
const EYE_FLATTEN = 0.38; // the eyes are discs, not balls: they barely rise from the face
const EYE_TURN_OUT = 0.2; // radians: each eye follows the face as it curves back to the side
const GAZE = [0, 0, 1]; // straight ahead along the beak (in flight that is the direction of flight)
/** Re-colour the painted texture by brightness onto a low / mid / high ramp (Blue and White); `mix` 0 leaves it as painted. */
function recolour(material, palette) {
  const m = material.clone();
  if (!palette.mix) return m;
  const uniforms = {
    fbMix: { value: palette.mix },
    fbLow: { value: new Color(palette.low) },
    fbMid: { value: new Color(palette.mid) },
    fbHigh: { value: new Color(palette.high) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float fbMix;\nuniform vec3 fbLow;\nuniform vec3 fbMid;\nuniform vec3 fbHigh;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float fbL = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) * 1.6, 0.0, 1.0);
        vec3 fbRamp = fbL < 0.5 ? mix(fbLow, fbMid, fbL * 2.0) : mix(fbMid, fbHigh, fbL * 2.0 - 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, fbRamp, fbMix);`,
      );
  };
  m.customProgramCacheKey = () => 'flamebird-recolour';
  return m;
}

export default function FlameBird({ avatar, float = 0.12, wingSpeed = 7, glow = 0.45, lightIntensity = 5, flight, ...props }) {
  const gltf = useGLTF(modelUrl(avatar));
  const palette = avatar.palette;
  const root = useRef();
  const halo = useRef();
  const glowMap = useMemo(getGlowTexture, []);

  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene);
    const materials = [];
    scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.material = recolour(o.material, palette);
      o.frustumCulled = false; // the skinned pose moves the wings well outside the rest bounds
      materials.push(o.material);
    });
    // A frame on the head bone, aligned with the model's own axes, centred between the painted eyes.
    scene.updateMatrixWorld(true);
    const head = scene.getObjectByName('head');
    let eyeFrame = null;
    if (head) {
      const inv = new Matrix4().copy(head.matrixWorld).invert();
      const q = new Quaternion();
      const sc = new Vector3();
      head.matrixWorld.decompose(new Vector3(), q, sc);
      eyeFrame = { position: EYE_MID.clone().applyMatrix4(inv), quaternion: q.invert(), scale: 1 / sc.x };
    }
    return { scene, materials, head, eyeFrame };
  }, [gltf, palette]);

  const mixer = useMemo(() => {
    const byName = (n) => gltf.animations.find((c) => c.name === n);
    const fly = byName('FB_Fly') ?? gltf.animations[0];
    const flap = byName('FB_WingFlap') ?? fly;
    // Only the wings blend between the cruise beat and a stroke: FB_WingFlap is a standing flap (feet down), so its
    // body and legs are left out and the flight clip keeps the legs tucked.
    const isWing = (track) => track.name.startsWith('wing_');
    const part = (clip, name, keep) => new AnimationClip(name, clip.duration, clip.tracks.filter(keep));
    const clips = [
      part(fly, 'FB_Fly_body', (tr) => !isWing(tr)),
      part(fly, 'FB_Fly_wings', isWing),
      part(flap, 'FB_WingFlap_A', isWing),
      part(flap, 'FB_WingFlap_B', isWing), // a second slot, so a new stroke can start while the last one fades out
    ];
    const m = new AnimationMixer(rig.scene);
    const actions = clips.map((clip) => {
      const a = m.clipAction(clip);
      a.play();
      a.paused = true; // times and weights are set by hand each frame (see flameBirdMotion.js)
      return a;
    });
    const bone = (n) => rig.scene.getObjectByName(n);
    return { m, flyBody: actions[0], flyWings: actions[1], strokes: actions.slice(2), bones: { head: bone('head'), crest: bone('head_crest'), tail: bone('tail_root'), fan: bone('tail_fan_root') } };
  }, [rig, gltf]);

  const motion = useMemo(createMotion, [mixer]);
  const tilt = useRef(0);
  const turn = useRef(null);
  const model = useRef();
  const tmp = useMemo(() => ({ rootQ: new Quaternion(), parentQ: new Quaternion(), add: new Quaternion(), axis: new Vector3() }), []);
  const X = useMemo(() => new Vector3(1, 0, 0), []);
  const Y = useMemo(() => new Vector3(0, 1, 0), []);

  /** Rotate a bone by `angle` about an axis given in the model's own space (lateral X, up Y), on top of the clip pose. */
  const addRotation = (bone, axisModel, angle) => {
    if (!bone || !bone.parent || !angle) return;
    rig.scene.getWorldQuaternion(tmp.rootQ).invert();
    bone.parent.getWorldQuaternion(tmp.parentQ).premultiply(tmp.rootQ).invert();
    tmp.axis.copy(axisModel).applyQuaternion(tmp.parentQ);
    bone.quaternion.premultiply(tmp.add.setFromAxisAngle(tmp.axis, angle));
  };

  useEffect(
    () => () => {
      mixer.m.stopAllAction();
      rig.materials.forEach((m) => m.dispose());
    },
    [mixer, rig],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const out = stepMotion(motion, flight ?? null, dt, wingSpeed, t);

    mixer.flyBody.time = out.flyTime;
    mixer.flyWings.time = out.flyTime;
    mixer.flyWings.setEffectiveWeight(out.flyWeight);
    out.strokes.forEach((s, i) => {
      mixer.strokes[i].time = s.time;
      mixer.strokes[i].setEffectiveWeight(s.weight);
    });
    mixer.m.update(0);

    // follow-through on top of the clip pose
    rig.scene.updateMatrixWorld(true);
    const b = mixer.bones;
    addRotation(b.head, X, out.bones.head);
    addRotation(b.crest, X, out.bones.crest);
    addRotation(b.tail, X, out.bones.tail);
    addRotation(b.fan, X, out.bones.fan);
    addRotation(b.fan, Y, out.bones.fanSway);

    if (root.current) {
      tilt.current += ((flight?.dead ? -0.3 : 0) - tilt.current) * (1 - Math.exp(-dt / 0.25)); // ease into the crash slump
      root.current.position.y = Math.sin(t * 1.6) * float - out.beat * 0.03;
      root.current.rotation.z = Math.sin(t * 1.1) * 0.05 + tilt.current;
    }
    if (model.current) {
      const target = flight ? FLIGHT_YAW : FACE_YAW;
      turn.current = turn.current === null ? target : turn.current + (target - turn.current) * (1 - Math.exp(-dt / 0.2));
      model.current.rotation.y = turn.current;
    }
    if (halo.current) {
      const target = flight?.dead ? glow * 0.35 : glow;
      halo.current.opacity += (target - halo.current.opacity) * (1 - Math.exp(-4 * dt));
    }
  });

  return (
    <group {...props}>
      <group ref={root}>
        <pointLight color={palette.glow} intensity={lightIntensity} distance={8} decay={1.6} position={[0.4, 0.4, 1]} />
        <sprite scale={[4.4, 4.4, 1]} renderOrder={-1}>
          <spriteMaterial
            ref={halo}
            map={glowMap}
            color={palette.glow}
            transparent
            opacity={glow}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
        {/* The model faces +Z with its origin at its centre: in flight it turns to profile (+X), in menus it faces the viewer. */}
        <group ref={model} rotation={[0, flight ? FLIGHT_YAW : FACE_YAW, 0]} scale={MODEL_SCALE}>
          <primitive object={rig.scene} />
        </group>
        {rig.head &&
          rig.eyeFrame &&
          createPortal(
            <group position={rig.eyeFrame.position} quaternion={rig.eyeFrame.quaternion} scale={rig.eyeFrame.scale}>
              <AvatarEyes
                at={[EYE_HALF, 0, 0]}
                size={EYE_SIZE}
                outwardAxis="x"
                forward={1}
                palette={palette}
                flight={flight}
                gaze={GAZE}
                wander
                flatten={EYE_FLATTEN}
                turnOut={EYE_TURN_OUT}
              />
            </group>,
            rig.head,
          )}
      </group>
    </group>
  );
}
