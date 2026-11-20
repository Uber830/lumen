import { cn } from "@/lib/utils";

/**
 * The switch of the access.
 *
 * It is a button with the role of a switch: the design of the project
 * does not use a component library for this, and the switch has to
 * work with the keyboard and with the screen readers.
 */
export function AccessSwitch({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "border-primary bg-primary" : "border-input bg-muted",
      )}
    >
      <span
        className={cn(
          "block size-3.5 rounded-full bg-background transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
        aria-hidden
      />
    </button>
  );
}
