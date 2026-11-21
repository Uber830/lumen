// =============================================================================
// School domain types: the school profile and its visible identity.
// -----------------------------------------------------------------------------
// Consumed by the admin "Personalización" view, the app-shell brand and
// the dashboard.
//
// The visible identity of a school is its name, its shield and its
// colour. The mission, the vision, the cover picture and the gallery
// were removed from the product.
// =============================================================================

/**
 * The school's branding, as it travels in the session.
 *
 * It is the part of the school the app needs to paint itself: the
 * colour, the logo and the name. It rides along with the session so the
 * first frame already has them.
 */
export type SchoolBranding = {
  id: string;
  name: string;
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
};

export type School = {
  id: string;
  name: string;
  short_code: string;
  status: string;
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
};

export type SchoolUpdateInput = {
  display_name?: string | null;
  primary_color?: string | null;
};
