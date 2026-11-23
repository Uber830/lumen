// =============================================================================
// The bulk bar (admin).
// -----------------------------------------------------------------------------
// When the administrator picks several rows of a list, the bar appears
// above the table with what can be done with the selection.
//
// The bar is the one of the reference prototype: how many are selected,
// the actions, and a way to leave the selection behind.
// =============================================================================

import type { ReactNode } from "react";

export function BulkBar({
  count,
  onClear,
  children,
}: {
  /** How many rows are selected. */
  count: number;
  /** Leaves the selection behind. */
  onClear: () => void;
  /** The actions of the selection. */
  children: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary-soft/40 px-[18px] py-2.5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[12px] font-medium text-foreground">
        <b className="font-semibold">{count}</b> seleccionados
      </span>
      {children}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-[12.5px] font-medium text-primary transition-colors hover:underline"
      >
        Quitar selección
      </button>
    </div>
  );
}

/** The checkbox of a row, and the one that picks the whole table. */
export function SelectBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
      className="size-[15px] accent-primary"
    />
  );
}
