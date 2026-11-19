import { useId } from 'react';

/**
 * The artwork of the five journey rewards, drawn as small inline SVGs (no image files, nothing to load, crisp at any size, free on the GPU). They take their
 * inspiration from the reference sheet's golden / violet look; the sheet itself is not used as an asset. `locked` shows the shape as a dim silhouette.
 */
export default function RewardArt({ id, locked = false, className = '' }) {
  const u = useId().replace(/:/g, '');
  const gold = `${u}g`;
  const goldD = `${u}d`;
  const violet = `${u}v`;
  const defs = (
    <defs>
      <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff4b8" />
        <stop offset="0.5" stopColor="#ffc43d" />
        <stop offset="1" stopColor="#d98310" />
      </linearGradient>
      <linearGradient id={goldD} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd75e" />
        <stop offset="1" stopColor="#b8680c" />
      </linearGradient>
      <radialGradient id={violet} cx="0.38" cy="0.32" r="0.8">
        <stop offset="0" stopColor="#f3e8ff" />
        <stop offset="0.45" stopColor="#a98bff" />
        <stop offset="1" stopColor="#4a2a9a" />
      </radialGradient>
    </defs>
  );
  const G = `url(#${gold})`;
  const GD = `url(#${goldD})`;
  let art = null;
  if (id === 'celestial-feather') {
    art = (
      <g>
        <path d="M18 88 C 24 54 46 22 86 10 C 84 42 66 70 26 86 Z" fill={G} stroke="#a85f0a" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M18 88 L84 12" stroke="#fff7d0" strokeWidth="2.4" strokeLinecap="round" />
        <g stroke="#b8680c" strokeWidth="1.1" strokeLinecap="round" opacity="0.75">
          <path d="M34 66 L52 62" />
          <path d="M42 56 L62 50" />
          <path d="M52 44 L72 36" />
          <path d="M36 74 L58 70" />
          <path d="M28 80 L46 78" />
        </g>
        <circle cx="19" cy="88" r="3.4" fill="#d36bff" stroke="#fff" strokeWidth="1" />
      </g>
    );
  } else if (id === 'celestial-skin') {
    art = (
      <g>
        <path d="M14 42 C 26 20 46 22 56 42 C 46 40 30 44 14 42 Z" fill={G} stroke="#a85f0a" strokeWidth="1.1" />
        <path d="M28 52 C 40 76 66 80 82 62 C 70 50 52 40 28 52 Z" fill={GD} stroke="#a85f0a" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M46 46 C 52 22 70 14 88 22 C 80 30 72 40 64 52 Z" fill={G} stroke="#a85f0a" strokeWidth="1.1" strokeLinejoin="round" />
        <circle cx="68" cy="40" r="11" fill={G} stroke="#a85f0a" strokeWidth="1.2" />
        <path d="M76 38 L90 42 L76 46 Z" fill="#ffe9a0" stroke="#a85f0a" strokeWidth="1" strokeLinejoin="round" />
        <circle cx="70" cy="37" r="2.6" fill="#1b2a6b" />
        <circle cx="70.8" cy="36.2" r="0.9" fill="#fff" />
        <path d="M26 56 C 16 62 12 72 8 82" stroke="#ffc43d" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    );
  } else if (id === 'journey-trophy') {
    art = (
      <g>
        <path d="M30 20 C 12 20 12 46 36 50" fill="none" stroke="#e0951a" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M70 20 C 88 20 88 46 64 50" fill="none" stroke="#e0951a" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M28 20 H72 V34 C 72 52 62 62 50 62 C 38 62 28 52 28 34 Z" fill={G} stroke="#a85f0a" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M50 62 V74" stroke="#d98310" strokeWidth="6" strokeLinecap="round" />
        <path d="M34 86 H66 L62 74 H38 Z" fill={GD} stroke="#a85f0a" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M50 4 L55 15 L67 16 L58 24 L61 36 L50 29 L39 36 L42 24 L33 16 L45 15 Z" fill="#fff0a6" stroke="#b8680c" strokeWidth="1.1" strokeLinejoin="round" transform="translate(0 4) scale(1 0.8) translate(0 0)" />
        <path d="M50 30 L56 40 L50 50 L44 40 Z" fill="#e46bff" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" />
      </g>
    );
  } else if (id === 'city-orb') {
    art = (
      <g>
        <circle cx="50" cy="50" r="34" fill={`url(#${violet})`} stroke="#d9c9ff" strokeWidth="1.6" />
        <path d="M22 62 Q50 56 78 62 Q70 80 50 84 Q30 80 22 62 Z" fill="#6c4bc2" opacity="0.75" />
        <g fill={G} stroke="#a85f0a" strokeWidth="0.8" strokeLinejoin="round">
          <rect x="40" y="46" width="20" height="14" />
          <path d="M40 46 L45 34 L50 46 Z" />
          <path d="M50 46 L55 30 L60 46 Z" />
          <path d="M44 34 L45 26 L46 34 Z" />
          <path d="M54 30 L55 20 L56 30 Z" />
        </g>
        <path d="M34 62 H66" stroke="#fff3c4" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <ellipse cx="38" cy="32" rx="9" ry="5" fill="#fff" opacity="0.4" transform="rotate(-30 38 32)" />
        <path d="M82 20 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#fff4b8" />
      </g>
    );
  } else {
    // treasure-cache
    art = (
      <g>
        <path d="M14 48 C 14 26 86 26 86 48 Z" fill="#7a2f58" stroke="#e0951a" strokeWidth="2.2" strokeLinejoin="round" />
        <rect x="14" y="48" width="72" height="34" rx="3" fill="#8c3a66" stroke="#e0951a" strokeWidth="2.2" />
        <path d="M14 56 H86" stroke="#ffc43d" strokeWidth="3" />
        <rect x="43" y="46" width="14" height="16" rx="2" fill={G} stroke="#a85f0a" strokeWidth="1.2" />
        <circle cx="50" cy="54" r="2.4" fill="#4a1f3a" />
        <path d="M24 42 L34 28 L44 42 Z" fill="#7fe8ff" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M44 38 L52 22 L62 38 Z" fill="#ff8fe0" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M58 42 L70 30 L78 42 Z" fill="#ffe36b" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M80 88 l4 -7 4 7 Z" fill="#b6a2ff" stroke="#fff" strokeWidth="0.8" />
        <path d="M8 86 l3 -6 3 6 Z" fill="#7fe8ff" stroke="#fff" strokeWidth="0.8" />
      </g>
    );
  }
  return (
    <svg className={`rart${locked ? ' is-locked' : ''} ${className}`.trim()} viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">
      {defs}
      {art}
    </svg>
  );
}
