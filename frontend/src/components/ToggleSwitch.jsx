export default function ToggleSwitch({
  checked = false,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  id,
  size = "md",
}) {
  const toggle = () => {
    if (!disabled) onChange?.(!checked);
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`mabaso-toggle mabaso-toggle-${size} ${checked ? "is-on" : "is-off"}`}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          toggle();
        }
      }}
    >
      <span className="mabaso-toggle-knob" aria-hidden="true" />
    </button>
  );
}
