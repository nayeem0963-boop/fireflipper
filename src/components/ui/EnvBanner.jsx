import { useEffect, useState } from 'react';
import { GAME_EVENTS, gameEvents } from '../../systems/events/gameEvents.js';

const SHOW_MS = 3600;

/**
 * "Rocky Canyon: Walls of red stone". Appears for a few seconds as you cross into a new environment,
 * low on the screen (over the lava, below the flight band) so it never covers an obstacle.
 */
export default function EnvBanner() {
  const [shown, setShown] = useState(null);

  useEffect(() => {
    let timer = 0;
    const off = gameEvents.on(GAME_EVENTS.ENVIRONMENT, (e) => {
      setShown({ id: e.id, name: e.name, tagline: e.tagline, key: e.index });
      clearTimeout(timer);
      timer = setTimeout(() => setShown(null), SHOW_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);

  if (!shown) return null;
  return (
    <div className={`env-banner env-banner--${shown.id}`} key={shown.key} aria-live="polite">
      <span className="env-banner__name">{shown.name}</span>
      <span className="env-banner__tagline">{shown.tagline}</span>
    </div>
  );
}
