// =============================================================================
// The confirmation modal (shared).
// -----------------------------------------------------------------------------
// Every destructive action in the app asks for confirmation with this
// component: the same panel, the same wording, the same buttons. The
// browser's `window.confirm` is not used anywhere: it cannot be styled,
// it is impossible to translate consistently and it blocks the whole
// page.
//
// A self-contained overlay (the pattern used by the member dialog), so it
// does not depend on a portal or on a dialog library.
// =============================================================================

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

/** What is about to be deleted: the row and how to name it in the modal. */
export type DeleteTarget = {
  id: string;
  /** The name of the row: "el curso 4to A". */
  title: string;
  /** What the user is about to lose. */
  description?: string;
  /** A different label for the destructive button, when it fits better. */
  confirmLabel?: string;
};

/**
 * The state a list needs to ask "are you sure?" before deleting a row.
 *
 * The list keeps the target, the modal asks about it, and the row is
 * removed when the user confirms.
 */
export function useDeleteConfirmation() {
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  return {
    target,
    /** Ask about a row. */
    ask: (next: DeleteTarget) => setTarget(next),
    /** Close the modal (cancel, or the deletion is done). */
    close: () => setTarget(null),
  };
}

export type ConfirmDialogProps = {
  /** Whether the modal is on screen. */
  open: boolean;
  /** The question, in the language of the app: "Eliminar el curso 4to A?". */
  title: string;
  /** What happens if the user confirms. One or two short sentences. */
  description?: ReactNode;
  /** The label of the destructive button. */
  confirmLabel?: string;
  /** The label of the button that leaves things as they are. */
  cancelLabel?: string;
  /** True while the action is running: the modal stays open, disabled. */
  pending?: boolean;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the user cancels (button, backdrop or Escape). */
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // Close on Escape, the expected behaviour for a modal. While the
  // action is running the modal stays put: closing it would hide the
  // result of the request that is still in flight.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  // Put the focus on the destructive button, so the keyboard user knows
  // where the modal opened. Escape still cancels from anywhere.
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 sm:place-items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(e) => {
        // Click on the backdrop (not the panel) closes.
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-t-lg bg-card p-5 shadow-lift sm:rounded-lg sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive-soft text-destructive">
            <AlertTriangle className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold leading-snug">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {pending ? "Eliminando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
