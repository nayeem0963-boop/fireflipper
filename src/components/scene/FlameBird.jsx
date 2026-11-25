import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { AdditiveBlending, AnimationMixer, Color } from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { getGlowTexture } from '../../utils/textures.js';
import { modelUrl } from '../../systems/avatars/avatars.js';

/**
 * FlameBird, the Fire Flipper mascot (see systems/avatars/avatars.js and public/models/CREDITS.md). A rigged GLB with
 * its own clips; this draws it with the real `FB_Fly` clip, timed by hand from the flight state like the Fire Eagle:
 *
 *  - in flight the wings beat at `wingSpeed`; each flap plays the clip's downstroke (top of the upstroke to the bottom)
 *    in STROKE_TIME, the same stroke length as every other bird; a dive slows the beat; after a crash the wings go still;
 *  - Fire shows the model's own painted textures; Blue and White re-colour them by brightness (see `palette.mix`);
 *  - a soft halo and a warm light in the colour's `glow`, like the other fire birds.
 *
 * Purely cosmetic: the simulation never reads it, so collision and physics are the same for every bird.
 * The other clips in the file (FB_WingFlap, FB_Idle, FB_TailSway, FB_Celebrate) are available for later use.
 *
 * Props: avatar, float (bob amplitude), wingSpeed (radians/sec), glow (halo opacity), lightIntensity, flight
 * ({ vy, sinceFlap, dead } or omitted for menus), plus group props.
 */
const STROKE_TIME = 0.26; // seconds for one powered wing stroke (the same as the Firebird's)
const MODEL_HEIGHT = 1.903; // the model's own height in metres
const SIZE = 2.6; // drawn height, in the Firebird's local units: matches the Fire Eagle's on-screen size (it is a chunky, upright bird, so it needs more height than the 2.0 to 2.4 length of the slim model birds)
const MODEL_SCALE = SIZE / MODEL_HEIGHT;
// FB_Fly (0.8 s): the wing raise is 20 + 20 sin(2 pi t / 0.8) degrees, so the upstroke peaks at 0.2 s and the downstroke ends at 0.6 s.
const FLY_LEN = 0.8;
const FLY_TOP = 0.2;
const FLY_BOTTOM = 0.6;
const FLY_RATE = (2 * Math.PI) / FLY_LEN; // radians of wing beat per second of clip

const clamp01 = (v) => Math.min(1, Math.max(0, v));

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
  const clipTime = useRef(FLY_TOP);
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
    return { scene, materials };
  }, [gltf, palette]);

  const mixer = useMemo(() => {
    const clip = gltf.animations.find((c) => c.name === 'FB_Fly') ?? gltf.animations[0];
    const m = new AnimationMixer(rig.scene);
    const action = m.clipAction(clip);
    action.play();
    action.paused = true; // time is driven by hand
    return { m, action };
  }, [rig, gltf]);

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
    const rate = wingSpeed / FLY_RATE; // clip seconds per real second

    if (flight && flight.dead) {
      clipTime.current = 0.4; // wings half open, still
    } else if (flight && flight.sinceFlap < STROKE_TIME) {
      clipTime.current = FLY_TOP + (FLY_BOTTOM - FLY_TOP) * (flight.sinceFlap / STROKE_TIME); // the powered downstroke
    } else {
      const tuck = flight ? clamp01((-flight.vy - 5) / 7) : 0; // diving: slower beats
      clipTime.current = (clipTime.current + dt * rate * (1 - tuck * 0.6)) % FLY_LEN;
    }
    mixer.action.time = clipTime.current;
    mixer.m.update(0);

    if (root.current) {
      const beat = Math.sin((clipTime.current / FLY_LEN) * 2 * Math.PI);
      root.current.position.y = Math.sin(t * 1.6) * float - beat * 0.03;
      root.current.rotation.z = Math.sin(t * 1.1) * 0.05 + (flight?.dead ? -0.3 : 0);
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
        {/* The model faces +Z with its origin at its centre; turn it to face +X (the direction of flight). */}
        <group rotation={[0, Math.PI / 2, 0]} scale={MODEL_SCALE}>
          <primitive object={rig.scene} />
        </group>
      </group>
    </group>
  );
}
