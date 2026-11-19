// =============================================================================
// The footer of the public site.
// -----------------------------------------------------------------------------
// The mark, four columns of links and the legal line.
// =============================================================================

import type { SiteFooter } from "../types";
import { CONTAINER, SiteLogo } from "./ui";

export function SiteFooter({ footer }: { footer: SiteFooter }) {
  return (
    <footer className="border-t border-line bg-paper">
      <div className={`${CONTAINER} py-14`}>
        <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
          <div>
            <div className="flex items-center gap-2.5 text-ink">
              <SiteLogo className="text-ink" />
              <span className="text-[17px] font-bold tracking-[-0.02em]">{footer.brand}</span>
            </div>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
              {footer.location}
            </p>
          </div>

          <nav aria-label="Enlaces del pie" className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {footer.columns.map((column) => (
              <div key={column.title}>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
                  {column.title}
                </h2>
                <ul className="mt-4 space-y-2">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.id}`}>
                      <a
                        href={link.href}
                        className="text-[14px] text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="mt-12 border-t border-line pt-6 font-mono text-[11px] tracking-[0.08em] text-ink-3">
          {footer.legal}
        </p>
      </div>
    </footer>
  );
}
