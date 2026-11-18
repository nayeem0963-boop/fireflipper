/**
 * Scoring balance model. Run with: npm run balance   (node scripts/balance-model.mjs [metres] [seeds])
 *
 * Question it answers: of a finished run's score, how much comes from DISTANCE, which is never
 * multiplied? Distance must stay the backbone, so the bonus sources (orbs, gems, rings, near misses,
 * all paid at the streak multiplier) must not be able to swamp it.
 *
 * Method: generate real tracks, take the orbs and gems actually placed on them (each is tagged as
 * on the safe line or on a risky route), and let idealised collectors pick them up with the real
 * streak rules (window, tiers, multipliers). Collectors differ only in how many safe-line and risky
 * pickups they get. Fire rings and near misses are added from per-kilometre rates. It is a MODEL: a
 * real player cannot reach every pickup (risky ones on opposite sides of a hazard are mutually
 * exclusive), so the last row is a ceiling, not a prediction.
 */
import { fileURLToPath } from 'node:url';
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { timeAtDistance } from '../src/systems/obstacles/dynamics.js';
import { SCORING, STREAK } from '../src/systems/physics/constants.js';
import { multiplierFor } from '../src/systems/scoring/streak.js';

/** Near misses a skilled player picks up per kilometre (a guess; they only matter at the margin). */
export const NEAR_MISSES_PER_KM = 6;

export const COLLECTORS = [
  { name: 'casual: 70% of safe-line orbs', safe: 0.7, risky: 0 },
  { name: 'skilled: 70% safe + 40% risky', safe: 0.7, risky: 0.4 },
  { name: 'elite: 90% safe + 70% risky', safe: 0.9, risky: 0.7 },
  { name: 'ceiling: every pickup', safe: 1, risky: 1 },
];

const mulberry = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function generate(seed, length) {
  const s = createGameSim();
  s.reset(seed);
  const pickups = [];
  for (let d = 0; d <= length + 60; d += 2) {
    s.distance = s.prevDistance = d;
    s.phase = PHASE.RUNNING;
    s.step(0);
    s.events.length = 0;
    for (const o of s.orbs.active) {
      if (o.x < d - 12) {
        if (o.kind <= 1 && o.x < length) pickups.push({ x: o.x, gem: o.kind === 1, risky: o.risk });
        s.orbs.release(o);
      }
    }
    for (const o of s.obstacles.active) if (o.x + o.extent < d - 12) s.obstacles.release(o);
    s.bird.y = 0.4;
  }
  return { pickups: pickups.sort((a, b) => a.x - b.x), rings: s.track.stats.rings };
}

export function modelScores({ length = 3000, seeds = 16 } = {}) {
  const tracks = [];
  for (let i = 1; i <= seeds; i++) tracks.push(generate(i, length));
  const km = (length / 1000) * seeds;
  const supply = {
    safe: tracks.reduce((a, t) => a + t.pickups.filter((p) => !p.gem && !p.risky).length, 0) / km,
    risky: tracks.reduce((a, t) => a + t.pickups.filter((p) => !p.gem && p.risky).length, 0) / km,
    gems: tracks.reduce((a, t) => a + t.pickups.filter((p) => p.gem).length, 0) / km,
    rings: tracks.reduce((a, t) => a + t.rings, 0) / km,
  };
  const rows = COLLECTORS.map((c, ci) => {
    let bonus = 0;
    let best = 0;
    tracks.forEach((t, ti) => {
      const rng = mulberry(ti * 31 + ci + 5);
      let count = 0;
      let last = -99;
      let mSum = 0;
      let mN = 0;
      for (const p of t.pickups) {
        if (rng() >= (p.gem || p.risky ? c.risky : c.safe)) continue;
        const at = timeAtDistance(p.x);
        if (count > 0 && at - last > STREAK.window) count = 0;
        count++;
        last = at;
        const m = multiplierFor(count);
        best = Math.max(best, count);
        bonus += (p.gem ? SCORING.gemPoints : SCORING.orbPoints) * m;
        mSum += m;
        mN++;
      }
      const avgM = mN ? mSum / mN : 1;
      bonus += t.rings * SCORING.ringPoints * c.risky * avgM; // rings are optional: only collectors who take risks fly through them
      bonus += NEAR_MISSES_PER_KM * (length / 1000) * ((SCORING.nearMissMin + SCORING.nearMissMax) / 2) * avgM * Math.min(1, 0.5 + 0.5 * c.risky);
    });
    bonus /= seeds;
    const distance = length * SCORING.pointsPerMetre;
    return { ...c, distance, bonus, total: distance + bonus, share: distance / (distance + bonus), bestStreak: best };
  });
  return { supply, rows, length, seeds };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const length = Number(process.argv[2]) || 3000;
  const seeds = Number(process.argv[3]) || 16;
  const r = modelScores({ length, seeds });
  console.log(`Pickup supply per 1000 m: ${r.supply.safe.toFixed(0)} safe-line orbs, ${r.supply.risky.toFixed(0)} risky orbs, ${r.supply.gems.toFixed(1)} gems, ${r.supply.rings.toFixed(1)} rings`);
  console.log(`Constants: orb ${SCORING.orbPoints}, gem ${SCORING.gemPoints}, ring ${SCORING.ringPoints}, near miss ${SCORING.nearMissMin}-${SCORING.nearMissMax}, streak tiers ${STREAK.tiers.map((t) => `x${t.mult}@${t.at}`).join(' ')}, window ${STREAK.window}s`);
  console.log(`\nA ${length} m run, by collector:`);
  for (const row of r.rows) {
    console.log(`  ${row.name.padEnd(34)} total ${Math.round(row.total).toString().padStart(6)}  distance ${(100 * row.share).toFixed(0).padStart(3)}%  bonus ${(100 * (1 - row.share)).toFixed(0).padStart(3)}%  (longest streak ${row.bestStreak})`);
  }
}
