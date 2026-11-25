// =============================================================================
// The select field: a styled dropdown.
// -----------------------------------------------------------------------------
// The native `<select>` looks out of place in the app and cannot show a
// second line per option (the email of a teacher, for example). This
// component replaces it: a button that opens a floating list.
//
// The list is rendered in a portal on `document.body`, so it is never
// clipped by the card it opens over (the cards are `overflow-hidden`).
//
// Keyboard: Up/Down move, Home/End jump, Enter picks, Escape closes.
// =============================================================================

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { panelContainer } from "@/components/panel/scope";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  /** A second line under the label: the email, the grade, whatever helps. */
  hint?: string;
  disabled?: boolean;
};

export type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** The text shown when there is nothing to pick. */
  emptyLabel?: string;
  "aria-label"?: string;
};

type Placement = {
  left: number;
  width: number;
  maxHeight: number;
  /** Set when the list opens upwards: the distance to the bottom of the window. */
  bottom?: number;
  top?: number;
};

export function Select({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  id,
  disabled,
  className,
  emptyLabel = "No hay opciones",
  "aria-label": ariaLabel,
}: SelectProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const selected = options.find((option) => option.value === value);

  /** Where the list goes: under the button, or above it when there is no room. */
  const updatePlacement = useCallback(() => {
    const element = buttonRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const opensUp = spaceBelow < 180 && spaceAbove > spaceBelow;

    setPlacement({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(320, Math.max(140, opensUp ? spaceAbove : spaceBelow)),
      ...(opensUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  }, []);

  // The list follows the button when the page scrolls or the window resizes.
  useEffect(() => {
    if (!open) return;
    const onReflow = () => updatePlacement();
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, updatePlacement]);

  // A click anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Open with the current selection highlighted, and move the focus to the
  // list so the keyboard works right away.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
  }, [open]);

  // Keep the highlighted option in sight while navigating with the keyboard.
  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList() {
    if (disabled || options.length === 0) return;
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    updatePlacement();
    setOpen(true);
  }

  function closeList(refocus = true) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function pick(next: string) {
    onChange(next);
    closeList();
  }

  function move(delta: number) {
    if (options.length === 0) return;
    setActiveIndex((current) => {
      const next = current + delta;
      if (next < 0) return options.length - 1;
      if (next >= options.length) return 0;
      return next;
    });
  }

  function onButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
      event.preventDefault();
      openList();
    }
  }

  function onListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const option = options[activeIndex];
        if (option && !option.disabled) pick(option.value);
        break;
      }
      case "Escape":
        event.preventDefault();
        closeList();
        break;
      case "Tab":
        closeList(false);
        break;
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled || options.length === 0}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onButtonKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm outline-none transition-colors",
          "hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70",
          className,
        )}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      {open &&
        placement &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={`${listboxId}-option-${activeIndex}`}
            onKeyDown={onListKeyDown}
            // The modal of the panel blocks the scroll of the page with
            // a listener on the document: without this, the wheel never
            // reaches the list and the options below cannot be reached
            // with the mouse.
            onWheel={(event) => event.stopPropagation()}
            style={{
              position: "fixed",
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
              ...(placement.bottom !== undefined
                ? { bottom: placement.bottom }
                : { top: placement.top }),
            }}
            className="pointer-events-auto z-50 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lift outline-none"
          >
            {options.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              options.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={option.value}
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      if (!option.disabled) pick(option.value);
                    }}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      index === activeIndex && !option.disabled && "bg-muted",
                      option.disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                      {isSelected && <Check className="size-4 text-primary" strokeWidth={2.25} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.hint && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>,
          // The list is drawn inside the panel: there it has the type and
          // the colours of the app.
          panelContainer() ?? document.body,
        )}
    </>
  );
}
