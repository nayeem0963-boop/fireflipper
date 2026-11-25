/** Small HUD icons for the two power-ups (inline SVG: nothing to load). */
export function MagnetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 4h5v9a2 2 0 0 0 4 0V4h5v9a7 7 0 0 1-14 0z" fill="#ff3b2e" stroke="#7a0f08" strokeWidth="1" strokeLinejoin="round" />
      <rect x="5" y="3" width="5" height="4.5" fill="#7fe8ff" stroke="#1a6a88" strokeWidth="0.8" />
      <rect x="14" y="3" width="5" height="4.5" fill="#7fe8ff" stroke="#1a6a88" strokeWidth="0.8" />
    </svg>
  );
}
export function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="#ffc43d" stroke="#a85f0a" strokeWidth="1" strokeLinejoin="round" />
      <path d="M12 5l5 1.9V11c0 3.4-2.2 6.2-5 7.6-2.8-1.4-5-4.2-5-7.6V6.9z" fill="#2a8cff" />
      <path d="M12 8.2l1.1 2.7 2.7 1.1-2.7 1.1L12 15.8l-1.1-2.7L8.2 12l2.7-1.1z" fill="#fff4b8" />
    </svg>
  );
}
