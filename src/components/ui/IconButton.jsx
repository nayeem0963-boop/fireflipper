/**
 * Round, touch-sized (44px+) icon button. `label` is required for a11y.
 * Mouse clicks don't move focus to the button, so a later Space press
 * flaps instead of re-clicking it. Keyboard (Tab) focus still works.
 */
const keepFocus = (e) => e.preventDefault();

export default function IconButton({ label, onClick, children, className = '', pressed, ...rest }) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onMouseDown={keepFocus}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
