/** Small seeded PRNG (mulberry32). Deterministic runs make generation testable. */
export function createRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (min, max) => min + next() * (max - min);
  next.chance = (p) => next() < p;
  next.reseed = (s) => {
    a = s >>> 0;
  };
  return next;
}

export function randomSeed() {
  return (Math.random() * 2 ** 32) >>> 0;
}
