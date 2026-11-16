/** Round, touch-sized (44px+) icon button. `label` is required for a11y. */
export default function IconButton({ label, onClick, children, className = '', pressed, ...rest }) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
