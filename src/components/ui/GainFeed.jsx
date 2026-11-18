import { useEffect, useRef, useState } from 'react';
import { GAME_EVENTS, gameEvents } from '../../systems/events/gameEvents.js';

const LABEL = { orbs: 'Orb', gems: 'Gem', rings: 'Fire ring', nearMiss: 'Near miss', other: 'Bonus' };
const MAX_ITEMS = 3;
const LIFE_MS = 1500;

/**
 * Every point earned appears briefly as "+6 Orb ×3": what it was, and the multiplier it was
 * paid at, so the score is never a mystery. Distance is not listed: it simply ticks up.
 */
export default function GainFeed() {
  const [items, setItems] = useState([]);
  const next = useRef(0);

  useEffect(() => {
    const off = gameEvents.on(GAME_EVENTS.SCORE, (e) => {
      const id = next.current++;
      setItems((cur) => [...cur.slice(-(MAX_ITEMS - 1)), { id, points: e.points, source: e.source, mult: e.mult }]);
      setTimeout(() => setItems((cur) => cur.filter((it) => it.id !== id)), LIFE_MS);
    });
    return off;
  }, []);

  return (
    <div className="gains" aria-hidden="true">
      {items.map((it) => (
        <span key={it.id} className={`gain gain--${it.source}`}>
          +{it.points} {LABEL[it.source]}
          {it.mult > 1 && it.source !== 'other' ? <b> ×{it.mult}</b> : null}
        </span>
      ))}
    </div>
  );
}
