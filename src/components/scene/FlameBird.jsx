import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { AdditiveBlending, AnimationClip, AnimationMixer, Color, Matrix4, Quaternion, Vector3, Vector4 } from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { getGlowTexture } from '../../utils/textures.js';
import { modelUrl } from '../../systems/avatars/avatars.js';
import { createMotion, stepMotion } from './flameBirdMotion.js';

/**
 * FlameBird, the Fire Flipper mascot (see systems/avatars/avatars.js and public/models/CREDITS.md). A rigged GLB with
 * its own clips; this draws it with the real `FB_Fly` and `FB_WingFlap` clips, timed from the flight state:
 *
 *  - the cruise beat (FB_Fly) runs at `wingSpeed`, easing slower in a dive and to a stop after a crash; each flap
 *    cross-fades in FB_WingFlap's powered downstroke (STROKE_TIME, the same stroke as every other bird), so taps never
 *    make the wings jump; the head, crest and tail follow through on springs (see flameBirdMotion.js);
 *  - in flight it is seen in profile, facing the direction of flight (+X), and pitches with the game; in menus and the
 *    picker (no flight state) it turns to face the viewer (FACE_YAW);
 *  - the face is animated in the bird's own material, so nothing is added on top of the model: lids slide down over
 *    the painted eyes to blink (half shut after a crash), and the lower jaw of the beak hinges open (a pop on each flap,
 *    chirps in menus, hanging open after a crash). Both are worked out in the model's rest pose and then skinned like
 *    the rest of the head, so they follow every head movement;
 *  - Fire shows the model's own painted textures; Blue and White re-colour them by brightness (see `palette.mix`);
 *  - a soft halo and a warm light in the colour's `glow`, like the other fire birds.
 *
 * Purely cosmetic: the simulation never reads it, so collision and physics are the same for every bird.
 * The other clips in the file (FB_Idle, FB_TailSway, FB_Celebrate) are available for later use.
 *
 * Props: avatar, float (bob amplitude), wingSpeed (radians/sec), glow (halo opacity), lightIntensity, flight
 * ({ vy, pitch, sinceFlap, dead } or omitted for menus), plus group props.
 */
const MODEL_HEIGHT = 1.903; // the model's own height in metres
const SIZE = 2.6; // drawn height, in the Firebird's local units: matches the Fire Eagle's on-screen size (it is a chunky, upright bird, so it needs more height than the 2.0 to 2.4 length of the slim model birds)
const MODEL_SCALE = SIZE / MODEL_HEIGHT;
const FLIGHT_YAW = Math.PI / 2; // in flight: profile, the beak towards +X (the direction of flight)
const FACE_YAW = 0.35; // in menus: front to the viewer, turned a little towards +X

// Face features, measured on the model (its own glTF space, metres; it faces +Z with Y up).
const EYES = [new Vector3(-0.1525, 0.252, 0.47), new Vector3(0.1475, 0.258, 0.46)]; // painted eye centres
const EYE_RADII = [0.088, 0.1]; // half width, half height of a painted eye (with its dark outline)
const LID_SRGB = [0.86, 0.78, 0.68]; // the cream of the face around the eyes
const LASH_SRGB = [0.16, 0.07, 0.04];
// The lower jaw: the orange beak below the painted mouth (centre x, half width, bottom y, mouth-line y), the depth
// in front of which a vertex belongs to it (the mouth inside is set back), and the hinge it opens around.
const JAW = { x: -0.012, halfWidth: 0.075, bottom: 0.045, top: 0.118, front: 0.48 };
const JAW_HINGE = new Vector3(0, 0.12, 0.47);
const JAW_OPEN = 0.5; // radians when fully open

const VERTEX_HEAD = `
uniform float fbBeak;
uniform vec3 fbHinge;
uniform vec4 fbJaw;
uniform float fbJawFront;
varying vec3 vFbPos;
float fbJawWeight(vec3 p) {
  float wx = 1.0 - smoothstep(fbJaw.y * 0.8, fbJaw.y, abs(p.x - fbJaw.x));
  float wy = smoothstep(fbJaw.z - 0.015, fbJaw.z + 0.005, p.y) * (1.0 - smoothstep(fbJaw.w - 0.012, fbJaw.w + 0.004, p.y));
  float wz = smoothstep(fbJawFront - 0.012, fbJawFront + 0.012, p.z);
  return wx * wy * wz;
}
vec3 fbRotX(vec3 d, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(d.x, c * d.y - s * d.z, s * d.y + c * d.z);
}
`;

const FRAGMENT_HEAD = `
uniform float fbMix;
uniform vec3 fbLow;
uniform vec3 fbMid;
uniform vec3 fbHigh;
uniform float fbBlink;
uniform vec3 fbEyeA;
uniform vec3 fbEyeB;
uniform vec2 fbEyeR;
uniform vec3 fbLid;
uniform vec3 fbLash;
varying vec3 vFbPos;
// A lid slides from the top of the painted eye to below its bottom as fbBlink goes 0 -> 1, with a dark lash line on its edge.
vec3 fbEyelid(vec3 col, vec3 centre) {
  vec3 d = vFbPos - centre;
  if (fbBlink < 0.001 || d.z < -0.07) return col;
  vec2 q = vec2(d.x / fbEyeR.x, d.y / fbEyeR.y);
  float r = length(q);
  if (r >= 1.0) return col;
  float line = 1.05 - 2.2 * fbBlink - 0.3 * q.x * q.x;
  float lid = smoothstep(line - 0.04, line + 0.04, q.y);
  float rim = 1.0 - smoothstep(0.88, 1.0, r);
  vec3 skin = fbLid * mix(0.8, 1.0, smoothstep(line, line + 0.6, q.y));
  col = mix(col, skin, lid * rim);
  float lash = 1.0 - smoothstep(0.0, 0.1, abs(q.y - line));
  return mix(col, fbLash, lash * rim * 0.9);
}
`;

/** The bird's material: the GLB's PBR material plus eyelids, a hinged jaw and (Blue / White) the brightness re-colour. */
function faceMaterial(material, palette, toGeometry) {
  const m = material.clone();
  const lin = (c) => new Color().setRGB(...c).convertSRGBToLinear();
  const eyes = EYES.map((e) => e.clone().applyMatrix4(toGeometry));
  const uniforms = {
    fbMix: { value: palette.mix ?? 0 },
    fbLow: { value: new Color(palette.low) },
    fbMid: { value: new Color(palette.mid) },
    fbHigh: { value: new Color(palette.high) },
    fbBlink: { value: 0 },
    fbEyeA: { value: eyes[0] },
    fbEyeB: { value: eyes[1] },
    fbEyeR: { value: { x: EYE_RADII[0], y: EYE_RADII[1] } },
    fbLid: { value: lin(LID_SRGB) },
    fbLash: { value: lin(LASH_SRGB) },
    fbBeak: { value: 0 },
    fbHinge: { value: JAW_HINGE.clone().applyMatrix4(toGeometry) },
    fbJaw: { value: new Vector4(JAW.x, JAW.halfWidth, JAW.bottom, JAW.top) },
    fbJawFront: { value: JAW.front },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${VERTEX_HEAD}\nvoid main() {`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        float fbW = fbJawWeight(position);
        objectNormal = fbRotX(objectNormal, fbBeak * ${JAW_OPEN.toFixed(3)} * fbW);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFbPos = position;
        transformed = fbHinge + fbRotX(transformed - fbHinge, fbBeak * ${JAW_OPEN.toFixed(3)} * fbW);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${FRAGMENT_HEAD}\nvoid main() {`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        diffuseColor.rgb = fbEyelid(diffuseColor.rgb, fbEyeA);
        diffuseColor.rgb = fbEyelid(diffuseColor.rgb, fbEyeB);
        if (fbMix > 0.0) {
          float fbL = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) * 1.6, 0.0, 1.0);
          vec3 fbRamp = fbL < 0.5 ? mix(fbLow, fbMid, fbL * 2.0) : mix(fbMid, fbHigh, fbL * 2.0 - 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, fbRamp, fbMix);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'flamebird-face';
  return { material: m, uniforms };
}

export default function FlameBird({ avatar, float = 0.12, wingSpeed = 7, glow = 0.45, lightIntensity = 5, flight, ...props }) {
  const gltf = useGLTF(modelUrl(avatar));
  const palette = avatar.palette;
  const root = useRef();
  const halo = useRef();
  const model = useRef();
  const glowMap = useMemo(getGlowTexture, []);

  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene);
    scene.updateMatrixWorld(true);
    const faces = [];
    scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      // model space -> the mesh's geometry space (the space `position` is in), in the rest pose
      const toGeometry = new Matrix4().copy(o.matrixWorld).invert();
      const f = faceMaterial(o.material, palette, toGeometry);
      o.material = f.material;
      o.frustumCulled = false; // the skinned pose moves the wings well outside the rest bounds
      faces.push(f);
    });
    return { scene, faces };
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

  const motion = useMemo(() => createMotion(), [mixer]);
  const tilt = useRef(0);
  const turn = useRef(null);
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
      rig.faces.forEach((f) => f.material.dispose());
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

    // face: blink and beak
    rig.faces.forEach((f) => {
      f.uniforms.fbBlink.value = out.eyes;
      f.uniforms.fbBeak.value = out.beak;
    });

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
      </group>
    </group>
  );
}
