import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, MathUtils, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';

/**
 * A pair of big, glowing cartoon eyes for any avatar: a warm sclera with a dark rim (so it reads against a bright
 * body), a coloured iris, a pupil and a catch-light. They look forward and a little towards the viewer, glance up
 * when the bird climbs and down when it falls, blink now and then, and shut when the bird crashes.
 *
 * Placed by the parent in the bird's own units. `at` is the right-hand eye's centre (the one on the +outward side);
 * the left one is its mirror image. `outwardAxis` is the axis the eyes sit apart on ('x' for birds that face along
 * z, 'z' for birds that face along x) and `forward` (+1 or -1) is the way the head points along the other axis.
 *
 * Basic (unlit) materials keep the eyes bright whatever the lighting or flame colour. Purely cosmetic.
 */
const SPHERE = new SphereGeometry(1, 18, 14);
const Z = new Vector3(0, 0, 1);
const BLINK_TIME = 0.16;

const COLORS = { sclera: '#fff3d2', rim: '#1a0a04', pupil: '#0b0503', shine: '#ffffff' };

/** The iris takes the bird's glow colour, warmed a little so it never goes cold or dull. */
export function irisColor(palette) {
  return new Color(palette?.glow ?? '#ff9a2a').lerp(new Color('#ffb347'), 0.35);
}

export default function AvatarEyes({ at, size = 0.05, outwardAxis = 'x', forward = 1, palette, flight }) {
  const eyes = useRef([]);
  const state = useRef({ next: 1.5 + Math.random() * 2, p: -1, closed: 0, glance: 0 });
  const scratch = useMemo(() => ({ look: new Vector3(), q: new Quaternion() }), []);

  const mats = useMemo(() => {
    const basic = (color, extra = {}) => new MeshBasicMaterial({ color, toneMapped: false, ...extra });
    return {
      sclera: basic(COLORS.sclera),
      rim: basic(COLORS.rim, { side: BackSide }),
      iris: basic(irisColor(palette)),
      pupil: basic(COLORS.pupil),
      shine: basic(COLORS.shine),
    };
  }, [palette]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = state.current;
    // Blink: a quick close and open every few seconds.
    s.next -= dt;
    if (s.next <= 0 && s.p < 0) s.p = 0;
    let blink = 0;
    if (s.p >= 0) {
      s.p += dt / BLINK_TIME;
      if (s.p >= 1) {
        s.p = -1;
        s.next = 2.2 + Math.random() * 3.5;
      } else blink = Math.sin(s.p * Math.PI);
    }
    const dead = Boolean(flight?.dead);
    s.closed = MathUtils.damp(s.closed, dead ? 0.9 : 0, 14, dt);
    // Look up while climbing, down while falling.
    s.glance = MathUtils.damp(s.glance, MathUtils.clamp((flight?.vy ?? 0) / 9, -1, 1) * 0.45, 10, dt);
    const squash = 1 - 0.9 * Math.max(blink, s.closed);

    eyes.current.forEach((eye, i) => {
      if (!eye) return;
      const side = i === 0 ? 1 : -1;
      eye.blink.scale.y = squash;
      // Forward, towards the viewer (outwards) and up or down: the pupil sits on that side of the eyeball.
      scratch.look.set(0, s.glance, 0);
      if (outwardAxis === 'x') {
        scratch.look.x += 0.8 * side;
        scratch.look.z += 0.5 * forward;
      } else {
        scratch.look.z += 0.8 * side;
        scratch.look.x += 0.5 * forward;
      }
      scratch.look.normalize();
      eye.look.quaternion.copy(scratch.q.setFromUnitVectors(Z, scratch.look));
    });
  });

  const [x, y, z] = at;
  const place = (side) => (outwardAxis === 'x' ? [x * side, y, z] : [x, y, z * side]);
  return (
    <>
      {[1, -1].map((side, i) => (
        <group key={side} position={place(side)} scale={size}>
          <group
            ref={(g) => {
              if (g) eyes.current[i] = { ...(eyes.current[i] ?? {}), blink: g };
            }}
          >
            <mesh geometry={SPHERE} material={mats.rim} scale={1.22} />
            <mesh geometry={SPHERE} material={mats.sclera} />
            <group
              ref={(g) => {
                if (g) eyes.current[i] = { ...(eyes.current[i] ?? {}), look: g };
              }}
            >
              <mesh geometry={SPHERE} material={mats.iris} position={[0, 0, 0.42]} scale={0.72} />
              <mesh geometry={SPHERE} material={mats.pupil} position={[0, 0, 0.82]} scale={0.4} />
              <mesh geometry={SPHERE} material={mats.shine} position={[0.12, 0.18, 1.12]} scale={0.14} />
            </group>
          </group>
        </group>
      ))}
    </>
  );
}
