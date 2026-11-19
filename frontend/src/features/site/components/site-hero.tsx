// =============================================================================
// The hero of the landing.
// -----------------------------------------------------------------------------
// The cover of the page: the index identifier, the title in two
// sentences —the first in ink, the second in the accent colour— the
// support text, the two calls to action and the figures.
//
// The figures are a grid of hairlines, not cards: there is no shadow
// and no card, only lines.
// =============================================================================

import type { SiteHero, SiteStat } from "../types";
import { CONTAINER, SectionKicker, SiteButton } from "./ui";

export function SiteHeroSection({ hero, stats }: { hero: SiteHero; stats: SiteStat[] }) {
  return (
    <section id="hero" className="border-b border-line">
      <div className={`${CONTAINER} pt-14 pb-16 sm:pt-20 sm:pb-24`}>
        <SectionKicker text={hero.kicker} />

        <h1 className="mt-6 max-w-[18ch] text-[40px] leading-[1.05] font-bold tracking-[-0.045em] text-ink sm:text-[58px] lg:text-[68px]">
          {hero.title_lead} <span className="text-brand">{hero.title_tail}</span>
        </h1>

        <p className="mt-6 max-w-[62ch] text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          {hero.lead}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SiteButton href={hero.cta_primary.href} variant={hero.cta_primary.variant}>
            {hero.cta_primary.label}
          </SiteButton>
          <SiteButton href={hero.cta_secondary.href} variant={hero.cta_secondary.variant}>
            {hero.cta_secondary.label}
          </SiteButton>
        </div>

        <dl className="mt-14 grid grid-cols-2 border-t border-l border-line sm:mt-20 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="border-r border-b border-line px-4 py-6 sm:px-6 sm:py-8"
            >
              <dd className="font-display text-[30px] leading-none font-bold tracking-[-0.04em] text-ink sm:text-[38px]">
                {stat.value}
              </dd>
              <dt className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
