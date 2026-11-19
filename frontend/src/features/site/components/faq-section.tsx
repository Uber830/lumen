// =============================================================================
// The questions of the landing.
// -----------------------------------------------------------------------------
// A native accordion: no script, no state, and it works with the
// keyboard out of the box. The first question comes open.
// =============================================================================

import type { SiteFaq } from "../types";
import { CONTAINER, SectionKicker, SectionTitle } from "./ui";

export function FaqSection({ faq }: { faq: SiteFaq }) {
  return (
    <section id="preguntas" className="border-b border-line scroll-mt-16">
      <div className={`${CONTAINER} pt-16 pb-16 sm:pt-24 sm:pb-24`}>
        <SectionKicker text={faq.kicker} />
        <div className="mt-5">
          <SectionTitle>{faq.title}</SectionTitle>
        </div>

        <div className="mt-10 border-t border-line">
          {faq.items.map((item, index) => (
            <details key={item.id} open={index === 0} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <span className="font-mono text-[12px] tracking-[0.14em] text-ink-3">
                  {item.id}
                </span>
                <span className="flex-1 text-[16px] font-medium tracking-[-0.01em] text-ink">
                  {item.question}
                </span>
                <span
                  aria-hidden="true"
                  className="relative flex size-5 shrink-0 items-center justify-center transition-transform duration-150 group-open:rotate-45"
                >
                  <span className="absolute h-px w-3.5 bg-ink" />
                  <span className="absolute h-3.5 w-px bg-ink" />
                </span>
              </summary>
              <p className="max-w-[70ch] pb-6 pl-[52px] text-[15px] leading-relaxed text-ink-2">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
