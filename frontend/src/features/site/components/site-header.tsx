// =============================================================================
// The header of the public site.
// -----------------------------------------------------------------------------
// Sticky, with a blurred paper background. Below 860px the links
// collapse into a menu that can be operated with the keyboard: the
// button carries `aria-expanded`, Escape closes it and the focus
// returns to the button.
// =============================================================================

import { useEffect, useRef, useState } from "react";

import type { SiteNav } from "../types";
import { SiteThemeToggle } from "./site-theme-toggle";
import { CONTAINER, SiteButton, SiteLogo } from "./ui";

export function SiteHeader({
  nav,
  brand,
  contactEmail,
}: {
  nav: SiteNav;
  brand: string;
  contactEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Escape closes the menu and gives the focus back to the button
  // that opened it.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-[12px]">
      <div className={`${CONTAINER} flex h-16 items-center justify-between gap-6`}>
        <a
          href="/"
          className="flex items-center gap-2.5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <SiteLogo className="text-ink" />
          <span className="text-[17px] font-bold tracking-[-0.02em]">{brand}</span>
        </a>

        <nav aria-label="Secciones" className="hidden items-center gap-7 md:flex">
          {nav.links.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <SiteThemeToggle compact />
          <SiteButton href="/login" variant="outline" className="px-4 py-2.5">
            {nav.login_label}
          </SiteButton>
          <SiteButton href={`mailto:${contactEmail}`} variant="accent" className="px-4 py-2.5">
            {nav.contact_label}
          </SiteButton>
        </div>

        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-idx border border-line-2 px-3 py-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <MenuIcon open={open} />
          Menú
        </button>
      </div>

      <div
        id="site-menu"
        ref={menuRef}
        hidden={!open}
        className="border-t border-line bg-bg md:hidden"
      >
        <nav aria-label="Secciones" className={`${CONTAINER} flex flex-col py-3`}>
          {nav.links.map((link) => (
            <a
              key={link.id}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-line py-3 font-mono text-[13px] uppercase tracking-[0.14em] text-ink-2 last:border-b-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-4">
            <SiteThemeToggle />
            <SiteButton href="/login" variant="outline">
              {nav.login_label}
            </SiteButton>
            <SiteButton href={`mailto:${contactEmail}`} variant="accent">
              {nav.contact_label}
            </SiteButton>
          </div>
        </nav>
      </div>
    </header>
  );
}

/** The hamburger of the menu: three lines that become a cross. */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className="size-4"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {open ? (
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" />
      ) : (
        <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
}
