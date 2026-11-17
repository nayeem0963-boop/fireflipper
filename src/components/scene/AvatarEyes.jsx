import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, MathUtils, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';

/**
 * Big, glossy cartoon eyes for any avatar, drawn after a children's-book bird: a tall dark oval that is almost all
 * pupil, a bright rim of the bird's flame colour showing as a crescent at its lower edge, a large catch-light at the
 * upper back and a small one at the lower front, and a heavy dark upper lid. They look forward and a little towards
 * the viewer, glance up when the bird climbs and down when it falls, blink now and then, and shut on a crash.
 *
 * Placed by the parent in the bird's own units. `at` is the right-hand eye's centre (the one on the +outward side);
 * the left one is its mirror image. `outwardAxis` is the axis the eyes sit apart on ('x' for birds that face along
 * z, 'z' for birds that face along x) and `forward` (+1 or -1) is the way the head points along the other axis.
 *
 * Basic (unlit) materials keep the eyes bright whatever the lighting or flame colour. Purely cosmetic.
 */
const SPHERE = new SphereGeometry(1, 20, 16);
// The upper lid: a shallow cap over the top of the eyeball (a sphere from the pole down to 0.62 rad).
const LID = new SphereGeometry(1.08, 20, 8, 0, Math.PI * 2, 0, 0.62);
const BLINK_TIME = 0.16;
/** The eye is a little taller than wide, like the reference. */
const OVAL = [0.94, 1.08, 0.94];
const PUPIL_RADIUS = 0.82;
/** How far the pupil sits towards the look direction, so only a crescent of the iris shows behind it. */
const PUPIL_SHIFT = 0.3;

const COLORS = { dark: '#0d0604', rim: '#1a0a04', shine: '#ffffff' };

/** The visible rim of the eye takes the bird's glow colour, warmed a little so it never goes cold or dull. */
export function irisColor(palette) {
  return new Color(palette?.glow ?? '#ff9a2a').lerp(new Color('#ffb347'), 0.35);
}

export default function AvatarEyes({ at, size = 0.05, outwardAxis = 'x', forward = 1, palette, flight }) {
  const eyes = useRef([]);
  const state = useRef({ next: 1.5 + Math.random() * 2, p: -1, closed: 0, glance: 0 });
  const v = useMemo(
    () => ({ look: new Vector3(), n: new Vector3(), back: new Vector3(), up: new Vector3(0, 1, 0) }),
    [],
  );

  const mats = useMemo(() => {
    const basic = (color, extra = {}) => new MeshBasicMaterial({ color, toneMapped: false, ...extra });
    return {
      rim: basic(COLORS.rim, { side: BackSide }),
      iris: basic(irisColor(palette)),
      pupil: basic(COLORS.dark),
      lid: basic(COLORS.rim),
      shine: basic(COLORS.shine),
      glint: basic(new Color(COLORS.shine).lerp(irisColor(palette), 0.35)),
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
      if (!eye?.blink || !eye.pupil) return;
      const side = i === 0 ? 1 : -1;
      eye.blink.scale.y = OVAL[1] * squash;
      // Forward, towards the viewer (outwards) and up or down: the pupil sits on that side of the eyeball.
      const fx = outwardAxis === 'x' ? 0 : forward;
      const fz = outwardAxis === 'x' ? forward : 0;
      const ox = outwardAxis === 'x' ? side : 0;
      const oz = outwardAxis === 'x' ? 0 : side;
      v.look.set(ox * 0.8 + fx * 0.5, s.glance, oz * 0.8 + fz * 0.5).normalize();
      eye.pupil.position.copy(v.look).multiplyScalar(PUPIL_SHIFT);
      // The big catch-light sits on the pupil towards the upper back; the small one at the lower front.
      v.n
        .copy(v.look)
        .addScaledVector(v.up, 0.6)
        .add(v.back.set(-fx * 0.55, 0, -fz * 0.55))
        .normalize();
      eye.shine.position.copy(eye.pupil.position).addScaledVector(v.n, PUPIL_RADIUS * 0.93);
      v.n
        .copy(v.look)
        .addScaledVector(v.up, -0.65)
        .add(v.back.set(fx * 0.55, 0, fz * 0.55))
        .normalize();
      eye.glint.position.copy(eye.pupil.position).addScaledVector(v.n, PUPIL_RADIUS * 0.97);
    });
  });

  const [x, y, z] = at;
  const place = (side) => (outwardAxis === 'x' ? [x * side, y, z] : [x, y, z * side]);
  const keep = (i, key) => (g) => {
    if (g) eyes.current[i] = { ...(eyes.current[i] ?? {}), [key]: g };
  };
  return (
    <>
      {[1, -1].map((side, i) => (
        <group key={side} position={place(side)} scale={size}>
          <group ref={keep(i, 'blink')} scale={OVAL}>
            <mesh geometry={SPHERE} material={mats.rim} scale={1.2} />
            <mesh geometry={SPHERE} material={mats.iris} />
            <mesh ref={keep(i, 'pupil')} geometry={SPHERE} material={mats.pupil} scale={PUPIL_RADIUS} />
            <mesh ref={keep(i, 'shine')} geometry={SPHERE} material={mats.shine} scale={0.27} />
            <mesh ref={keep(i, 'glint')} geometry={SPHERE} material={mats.glint} scale={0.11} />
            <mesh geometry={LID} material={mats.lid} />
          </group>
        </group>
      ))}
    </>
  );
}
