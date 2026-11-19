// =============================================================================
// The bulk import summary (admin).
// -----------------------------------------------------------------------------
// Shown after a CSV import: how many rows were created and which ones
// failed. It used to be a `window.alert`, a native dialog that cannot be
// styled and blocks the page.
// =============================================================================

import type { BulkInviteFailure } from "@/lib/users/types";

export type BulkImportFailure = BulkInviteFailure;

export function BulkImportSummary({
  created,
  failures,
}: {
  created: number;
  failures: BulkImportFailure[];
}) {
  return (
    <div role="status" className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
      <p className="font-semibold">
        Carga masiva: {created} creados, {failures.length} con error.
      </p>
      {failures.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-destructive">
          {failures.map((failure, index) => (
            <li key={`${failure.email ?? "sin-correo"}-${index}`}>
              <span className="font-medium">{failure.email ?? "Sin correo"}</span>: {failure.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
