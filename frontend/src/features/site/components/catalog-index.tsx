// =============================================================================
// The index of the catalog.
// -----------------------------------------------------------------------------
// A real table: the reference, the material, the area, the schools with
// access and the state. The header is ink with white text; the rows
// are separated by hairlines and light up with the accent colour on
// hover.
//
// Below 1024px the area and the state leave the table and the state
// travels under the title. Below 768px the table becomes a stack of
// cards: a table that has to be scrolled sideways is a table nobody
// reads on a phone.
// =============================================================================

import type { CatalogEntry, SiteCatalog } from "../types";
import { CONTAINER, Chip, SectionKicker, SectionTitle, StateChip } from "./ui";

/*
 * The columns that do not fit in a narrow screen. The state travels
 * under the title of the material instead.
 */
const HIDDEN_COLUMN: Record<string, string> = {
  area: "hidden lg:table-cell",
  state: "hidden lg:table-cell",
};

export function CatalogIndex({
  catalog,
  entries,
  total,
}: {
  catalog: SiteCatalog;
  entries: CatalogEntry[];
  total: number;
}) {
  const shown = entries.length;

  return (
    <section id="indice" className="border-b border-line scroll-mt-16">
      <div className={`${CONTAINER} pt-16 pb-16 sm:pt-24 sm:pb-24`}>
        <SectionKicker text={catalog.kicker} />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle>{catalog.title}</SectionTitle>
          <p className="max-w-[46ch] text-[15px] leading-relaxed text-ink-2">{catalog.lead}</p>
        </div>

        {/* The table, from 768px up. */}
        <div className="mt-8 hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{catalog.title}</caption>
            <thead>
              <tr className="bg-[var(--head-bg)] text-[var(--head-fg)]">
                {catalog.columns.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={`px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] ${HIDDEN_COLUMN[column.id] ?? ""}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.ref}
                  className="border-b border-line transition-colors hover:bg-brand-soft"
                >
                  <td className="px-4 py-4 align-top font-mono text-[12px] text-ink-3">
                    {entry.ref}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="font-medium tracking-[-0.01em] text-ink">{entry.title}</p>
                    {entry.meta && (
                      <p className="mt-1 font-mono text-[12px] text-ink-3">{entry.meta}</p>
                    )}
                    {/* Below 1024px the state leaves the table and travels here. */}
                    <div className="mt-2 lg:hidden">
                      <StateChip state={entry.state} />
                    </div>
                  </td>
                  <td className="hidden px-4 py-4 align-top font-mono text-[12px] text-ink-2 lg:table-cell">
                    {entry.area}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <ul className="flex flex-wrap gap-1.5">
                      {entry.schools.map((school) => (
                        <li key={school}>
                          <Chip>{school}</Chip>
                        </li>
                      ))}
                      {entry.schools_extra > 0 && (
                        <li>
                          <Chip>+{entry.schools_extra}</Chip>
                        </li>
                      )}
                    </ul>
                  </td>
                  <td className="hidden px-4 py-4 align-top lg:table-cell">
                    <StateChip state={entry.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* The same rows as cards, below 768px. */}
        <ul className="mt-8 grid gap-3 md:hidden">
          {entries.map((entry) => (
            <li key={entry.ref} className="border border-line bg-paper p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-[12px] text-ink-3">{entry.ref}</p>
                <StateChip state={entry.state} />
              </div>
              <p className="mt-2 font-medium tracking-[-0.01em] text-ink">{entry.title}</p>
              {entry.meta && <p className="mt-1 font-mono text-[12px] text-ink-3">{entry.meta}</p>}
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                {entry.area}
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {entry.schools.map((school) => (
                  <li key={school}>
                    <Chip>{school}</Chip>
                  </li>
                ))}
                {entry.schools_extra > 0 && (
                  <li>
                    <Chip>+{entry.schools_extra}</Chip>
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ul>

        <p className="mt-5 font-mono text-[12px] text-ink-3">
          {catalog.footer_prefix} {shown} de {total} {catalog.footer_suffix}
        </p>
      </div>
    </section>
  );
}
