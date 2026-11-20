// =============================================================================
// The CSV export of the panel.
// -----------------------------------------------------------------------------
// The file is built in the browser: the panel already has the rows it
// shows, and there is no need to ask the server for the same data.
// =============================================================================

/** One cell of the file: a text, a number or a date. */
export type CsvCell = string | number | null | undefined;

/**
 * Build a CSV file and hand it to the browser.
 *
 * The separator is the comma and the file carries a BOM, so that Excel
 * opens it with the accents in place.
 */
export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]): void {
  const quote = (value: CsvCell) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(quote).join(","), ...rows.map((row) => row.map(quote).join(","))].join(
    "\n",
  );

  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}
