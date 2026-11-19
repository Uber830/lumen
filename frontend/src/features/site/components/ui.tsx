// =============================================================================
// The pieces the public site is built from.
// -----------------------------------------------------------------------------
// El Índice: paper, hairlines, square corners, one accent colour. The
// components here carry the rules that repeat across the page, so the
// sections only have to worry about their own content.
//
// Buttons are rectangular on purpose (4px): it is part of the identity
// of the design.
// =============================================================================

import type { ReactNode } from "react";

import type { CatalogState, SiteActionVariant } from "../types";

/** The width of the page. */
export const CONTAINER = "mx-auto w-full max-w-[1220px] px-5 sm:px-8";

/** The class of a button, by variant. */
const BUTTON_VARIANTS: Record<SiteActionVariant, string> = {
  solid: "bg-ink text-[var(--on-ink)] hover:bg-[var(--ink-hover)]",
  outline: "border border-line-2 bg-transparent text-ink hover:border-ink hover:bg-paper",
  accent: "bg-[var(--accent-solid)] text-white hover:bg-[var(--accent-solid-hover)]",
};

/**
 * The button of the design.
 *
 * There is one primary action per screen: that is the caller's job to
 * decide, not the button's.
 */
export function SiteButton({
  href,
  children,
  variant = "solid",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: SiteActionVariant;
  className?: string;
}) {
  const isInternal = href.startsWith("/") && !href.startsWith("//");
  const classes = [
    "inline-flex items-center justify-center rounded-idx border border-transparent px-5 py-3",
    "font-mono text-[12px] uppercase tracking-[0.14em] transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    BUTTON_VARIANTS[variant],
    className,
  ].join(" ");

  if (isInternal) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}

/**
 * The kicker of a section: the index identifier in monospace and a
 * line that stretches to the edge.
 */
export function SectionKicker({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">{text}</p>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}

/** The title of a section. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[28px] leading-[1.15] font-bold tracking-[-0.035em] text-ink sm:text-[34px]">
      {children}
    </h2>
  );
}

/**
 * The sun of the logo: a square of ink with a ring of rays.
 *
 * It is decorative: the name of the brand travels next to it as text.
 */
export function SiteLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 30"
      aria-hidden="true"
      focusable="false"
      className={`size-[30px] shrink-0 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="30" height="30" fill="currentColor" />
      <circle cx="15" cy="15" r="4.2" className="fill-[var(--bg)]" />
      <g className="stroke-[var(--bg)]" strokeWidth="1.4" strokeLinecap="square">
        <path d="M15 2.6v3.4M15 24v3.4M2.6 15h3.4M24 15h3.4" />
        <path d="M6.1 6.1l2.4 2.4M21.5 21.5l2.4 2.4M23.9 6.1l-2.4 2.4M8.5 21.5l-2.4 2.4" />
      </g>
    </svg>
  );
}

/**
 * The state of a catalog piece.
 *
 * The state is written out, not only coloured: the reader has to tell
 * them apart without relying on the colour.
 */
const STATE_LABELS: Record<CatalogState, string> = {
  published: "Publicado",
  review: "En revisión",
  draft: "Borrador",
  archived: "Archivado",
};

const STATE_CLASSES: Record<CatalogState, string> = {
  published: "border-[var(--ok-line)] bg-[var(--ok-bg)] text-[var(--ok-fg)]",
  review: "border-[var(--warn-line)] bg-[var(--warn-bg)] text-[var(--warn-fg)]",
  draft: "border-line-2 bg-paper-2 text-ink-2",
  archived: "border-[var(--bad-line)] bg-[var(--bad-bg)] text-[var(--bad-fg)]",
};

export function StateChip({ state }: { state: CatalogState }) {
  return (
    <span
      className={`inline-flex items-center rounded-idx border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] ${STATE_CLASSES[state]}`}
    >
      {STATE_LABELS[state]}
    </span>
  );
}

/**
 * The panel that looks like a printed spec sheet: hairline border and
 * two registration marks in opposite corners.
 */
export function SpecPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative border border-line bg-paper ${className}`}>
      <span
        aria-hidden="true"
        className="absolute -top-px -left-px h-[14px] w-[14px] border-t border-l border-brand/50"
      />
      <span
        aria-hidden="true"
        className="absolute -right-px -bottom-px h-[14px] w-[14px] border-r border-b border-brand/50"
      />
      {children}
    </div>
  );
}

/** A small chip, used for the schools with access and the coverage. */
export function Chip({
  children,
  included = true,
  className = "",
}: {
  children: ReactNode;
  included?: boolean;
  className?: string;
}) {
  return (
    <span
      className={
        included
          ? `inline-flex items-center rounded-idx border border-line-2 bg-bg px-2 py-0.5 font-mono text-[11px] text-ink-2 ${className}`
          : `inline-flex items-center rounded-idx border border-dashed border-line-2 px-2 py-0.5 font-mono text-[11px] text-ink-3 line-through ${className}`
      }
    >
      {children}
    </span>
  );
}

/** The check of an included feature. */
export function CheckMark() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
      className="size-3 shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M1.5 6.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

/** The dash of a feature that is not included. */
export function DashMark() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
      className="size-3 shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}
