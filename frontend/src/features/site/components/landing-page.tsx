// =============================================================================
// The landing of the public site.
// -----------------------------------------------------------------------------
// The page is an index, not a collection of cards: eight blocks in a
// fixed order, all of them filled with the content the API serves.
//
// The first element of the page is the skip link: it is the first
// thing a keyboard reaches.
// =============================================================================

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { SiteHeroSection } from "./SiteHeroSection";
import { CONTAINER } from "./ui";
import { useSiteContent } from "../use-site-content";

export function LandingPage() {
  const site = useSiteContent();

  if (site.isPending) {
    return <LandingSkeleton />;
  }

  if (site.isError) {
    return <LandingError onRetry={() => void site.refetch()} />;
  }

  const {
    content,
    stats,
    catalog,
    catalog_total: catalogTotal,
    contact_email: contactEmail,
  } = site.data;

  return (
    <div className="idx-site flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-idx focus:bg-ink focus:px-4 focus:py-2 focus:font-mono focus:text-[12px] focus:uppercase focus:tracking-[0.14em] focus:text-white"
      >
        Saltar al contenido
      </a>

      <SiteHeader nav={content.nav} brand={content.footer.brand} contactEmail={contactEmail} />

      <main id="contenido" className="relative z-10 flex-1">
        <SiteHeroSection />
      </main>

      <SiteFooter footer={content.footer} />
    </div>
  );
}

/** While the content is on its way, the page keeps its shape. */
function LandingSkeleton() {
  return (
    <div className="idx-site min-h-screen">
      <div className={`${CONTAINER} py-24`}>
        <div className="h-3 w-40 bg-paper-2" />
        <div className="mt-6 h-14 w-full max-w-[18ch] bg-paper-2" />
        <div className="mt-4 h-14 w-full max-w-[22ch] bg-paper-2" />
        <div className="mt-8 h-4 w-full max-w-[60ch] bg-paper" />
      </div>
    </div>
  );
}

/** When the content does not arrive, the page says so and offers a retry. */
function LandingError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="idx-site flex min-h-screen items-center justify-center px-5">
      <div className="relative z-10 max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
          IDX-000 / Contenido
        </p>
        <h1 className="mt-4 text-[24px] font-bold tracking-[-0.03em] text-ink">
          No pudimos cargar el contenido del sitio.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Intenta de nuevo en unos segundos. Si el problema sigue, escríbenos.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center justify-center rounded-idx bg-ink px-5 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
