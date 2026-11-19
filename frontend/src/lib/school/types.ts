// =============================================================================
// School domain types: the school profile and its branding.
// -----------------------------------------------------------------------------
// Consumed by the admin "Personalización" view, the app-shell brand and
// the dashboard hero.
// =============================================================================

/** One picture of the school's gallery. */
export type SchoolGalleryImage = {
  url: string;
  caption: string | null;
};

/**
 * The school's branding, as it travels in the session.
 *
 * It is the part of the school the app needs to paint itself: the
 * colour, the logo and the name. It rides along with the session so the
 * first frame already has them. The mission, the vision and the
 * pictures travel with it for the same reason: the dashboard shows them
 * as soon as the page arrives.
 */
export type SchoolBranding = {
  id: string;
  name: string;
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  mission: string | null;
  vision: string | null;
  banner_url: string | null;
  gallery: SchoolGalleryImage[];
};

export type School = {
  id: string;
  name: string;
  short_code: string;
  status: string;
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  /** What the school says it is for, in its own words. */
  mission: string | null;
  /** What the school wants to become, in its own words. */
  vision: string | null;
  /** The cover image of the dashboard hero. */
  banner_url: string | null;
  /** The pictures the school chose to show in the dashboard. */
  gallery: SchoolGalleryImage[];
};

export type SchoolUpdateInput = {
  display_name?: string | null;
  primary_color?: string | null;
  mission?: string | null;
  vision?: string | null;
  banner_url?: string | null;
  gallery?: SchoolGalleryImage[];
};
