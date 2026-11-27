// =============================================================================
// The contract of the public site.
// -----------------------------------------------------------------------------
// These types mirror GET /v1/public/site. Every visible string of the
// landing comes from that endpoint: nothing is hardcoded in a
// component, so the platform team can edit the page from the database
// without a redeploy.
//
// The field names are the API's own (snake_case), like the rest of the
// API types in this project.
// =============================================================================

export type SiteActionVariant = "solid" | "outline" | "accent";

export type SiteLink = {
  id: string;
  label: string;
  href: string;
};

export type SiteAction = SiteLink & {
  variant: SiteActionVariant;
};

export type SiteStat = {
  label: string;
  value: string;
};

export type SiteColumn = {
  id: string;
  label: string;
};

export type CatalogState = "published" | "review" | "draft" | "archived";

export type CatalogEntry = {
  ref: string;
  title: string;
  meta: string | null;
  area: string;
  /** Up to two school names; the rest is counted in `schools_extra`. */
  schools: string[];
  schools_extra: number;
  state: CatalogState;
};

export type SiteNav = {
  links: SiteLink[];
  login_label: string;
  contact_label: string;
};

export type SiteHero = {
  kicker: string;
  /** The first sentence of the title, in ink. */
  title_lead: string;
  /** The second sentence, in the accent colour. */
  title_tail: string;
  lead: string;
  cta_primary: SiteAction;
  cta_secondary: SiteAction;
};

export type SiteCatalog = {
  kicker: string;
  title: string;
  lead: string;
  columns: SiteColumn[];
  footer_prefix: string;
  footer_suffix: string;
};

export type SiteProcessStep = {
  number: string;
  title: string;
  body: string;
  owner: string;
};

export type SiteProcess = {
  kicker: string;
  title: string;
  steps: SiteProcessStep[];
};

export type SiteRole = {
  id: string;
  summary: string;
  detail: string;
  scope: string;
};

export type SiteRoles = {
  kicker: string;
  title: string;
  items: SiteRole[];
};

export type SiteCoverageItem = {
  label: string;
  included: boolean;
};

export type SiteCoverageRow = {
  id: string;
  label: string;
  size: string;
  items: SiteCoverageItem[];
};

export type SiteCoverage = {
  kicker: string;
  title: string;
  lead: string;
  rows: SiteCoverageRow[];
};

export type SiteFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type SiteFaq = {
  kicker: string;
  title: string;
  items: SiteFaqItem[];
};

export type SiteSpecRow = {
  label: string;
  value: string;
};

export type SiteCta = {
  kicker: string;
  title: string;
  body: string;
  buttons: SiteAction[];
  spec: SiteSpecRow[];
};

export type SiteFooterColumn = {
  title: string;
  links: SiteLink[];
};

export type SiteFooter = {
  brand: string;
  location: string;
  columns: SiteFooterColumn[];
  legal: string;
};

export type SiteCopy = {
  nav: SiteNav;
  hero: SiteHero;
  catalog: SiteCatalog;
  process: SiteProcess;
  roles: SiteRoles;
  /** The block is only drawn when the copy carries it. */
  coverage?: SiteCoverage | null;
  faq: SiteFaq;
  cta: SiteCta;
  footer: SiteFooter;
};

export type SitePayload = {
  stats: SiteStat[];
  catalog: CatalogEntry[];
  catalog_total: number;
  contact_email: string;
  content: SiteCopy;
};
