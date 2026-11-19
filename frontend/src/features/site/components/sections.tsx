// =============================================================================
// The process, the roles and the coverage.
// -----------------------------------------------------------------------------
// Three blocks that share the same grammar: a kicker, a title and a
// grid of cells separated by hairlines. No cards, no shadows: the
// lines are what holds the page together.
// =============================================================================

import type { SiteCoverage, SiteProcess, SiteRoles } from "../types";
import { CONTAINER, CheckMark, Chip, DashMark, SectionKicker, SectionTitle, SpecPanel } from "./ui";

// --- The process -----------------------------------------------------------

export function ProcessSection({ process }: { process: SiteProcess }) {
  return (
    <section id="proceso" className="border-b border-line scroll-mt-16">
      <div className={`${CONTAINER} pt-16 pb-16 sm:pt-24 sm:pb-24`}>
        <SectionKicker text={process.kicker} />
        <div className="mt-5">
          <SectionTitle>{process.title}</SectionTitle>
        </div>

        <ol className="mt-10 grid gap-0 border-t border-line md:grid-cols-3">
          {process.steps.map((step, index) => (
            <li
              key={step.number}
              className={`border-b border-line py-8 md:border-b-0 md:py-10 ${
                index > 0 ? "md:border-l md:border-line md:pl-8" : ""
              } ${index < process.steps.length - 1 ? "md:pr-8" : ""}`}
            >
              <p className="font-mono text-[13px] tracking-[0.18em] text-ink-3">{step.number}</p>
              <h3 className="mt-4 text-[19px] leading-snug font-bold tracking-[-0.02em] text-ink">
                {step.title}
              </h3>
              <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-ink-2">
                {step.body}
              </p>
              <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                {step.owner}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// --- The roles -------------------------------------------------------------

export function RolesSection({ roles }: { roles: SiteRoles }) {
  return (
    <section id="roles" className="border-b border-line scroll-mt-16">
      <div className={`${CONTAINER} pt-16 pb-16 sm:pt-24 sm:pb-24`}>
        <SectionKicker text={roles.kicker} />
        <div className="mt-5">
          <SectionTitle>{roles.title}</SectionTitle>
        </div>

        <dl className="mt-10 border-t border-line">
          {roles.items.map((role, index) => (
            <div
              key={role.id}
              className={`grid gap-3 border-b border-line py-7 md:grid-cols-[220px_1fr_260px] md:items-start md:gap-8 ${
                index === 0 ? "md:border-l md:border-l-brand/40 md:pl-6" : ""
              }`}
            >
              <dt
                className={`font-mono text-[12px] uppercase tracking-[0.16em] ${
                  index === 0 ? "text-brand" : "text-ink"
                }`}
              >
                {role.id}
              </dt>
              <dd>
                <p className="text-[16px] font-medium italic tracking-[-0.01em] text-ink">
                  {role.summary}
                </p>
                <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
                  {role.detail}
                </p>
              </dd>
              <dd className="md:text-right">
                <Chip>{role.scope}</Chip>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// --- The coverage ----------------------------------------------------------

export function CoverageSection({ coverage }: { coverage: SiteCoverage }) {
  return (
    <section id="cobertura" className="border-b border-line scroll-mt-16">
      <div className={`${CONTAINER} pt-16 pb-16 sm:pt-24 sm:pb-24`}>
        <SectionKicker text={coverage.kicker} />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle>{coverage.title}</SectionTitle>
          {coverage.lead && (
            <p className="max-w-[42ch] text-[15px] leading-relaxed text-ink-2">{coverage.lead}</p>
          )}
        </div>

        <SpecPanel className="mt-10">
          <div className="divide-y divide-line">
            {coverage.rows.map((row) => (
              <div key={row.id} className="grid gap-4 p-6 sm:p-8 lg:grid-cols-[260px_1fr]">
                <div>
                  <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink">
                    {row.label}
                  </p>
                  <p className="mt-1 font-display text-[22px] font-bold tracking-[-0.03em] text-ink">
                    {row.size}
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {row.items.map((item) => (
                    <li key={item.label}>
                      <span
                        className={
                          item.included
                            ? "inline-flex items-center gap-1.5 rounded-idx border border-line-2 bg-bg px-2.5 py-1 font-mono text-[12px] text-ink-2"
                            : "inline-flex items-center gap-1.5 rounded-idx border border-dashed border-line-2 px-2.5 py-1 font-mono text-[12px] text-ink-3 line-through"
                        }
                      >
                        {item.included ? <CheckMark /> : <DashMark />}
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SpecPanel>
      </div>
    </section>
  );
}
