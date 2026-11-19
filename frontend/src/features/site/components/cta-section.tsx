// =============================================================================
// The closing call to action.
// -----------------------------------------------------------------------------
// The last thing the reader sees: the message on the left, the spec of
// the meeting on the right.
// =============================================================================

import type { SiteCta } from "../types";
import { CONTAINER, SectionKicker, SiteButton, SpecPanel } from "./ui";

export function CtaSection({ cta }: { cta: SiteCta }) {
  return (
    <section id="contacto" className="scroll-mt-16">
      <div className={`${CONTAINER} pt-16 pb-16 sm:pt-24 sm:pb-24`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-16">
          <div>
            <SectionKicker text={cta.kicker} />
            <h2 className="mt-5 max-w-[22ch] text-[28px] leading-[1.15] font-bold tracking-[-0.035em] text-ink sm:text-[36px]">
              {cta.title}
            </h2>
            <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-ink-2">{cta.body}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {cta.buttons.map((button) => (
                <SiteButton key={button.id} href={button.href} variant={button.variant}>
                  {button.label}
                </SiteButton>
              ))}
            </div>
          </div>

          <SpecPanel>
            <dl className="divide-y divide-line">
              {cta.spec.map((row) => (
                <div key={row.label} className="px-6 py-5">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
                    {row.label}
                  </dt>
                  <dd className="mt-1.5 text-[15px] text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          </SpecPanel>
        </div>
      </div>
    </section>
  );
}
