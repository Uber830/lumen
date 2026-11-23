-- =========================================================================
-- School branding: the fields an admin sets in the "Personalización" view.
-- -------------------------------------------------------------------------
-- - display_name: a friendly name shown in the UI (the sidebar brand,
--   document headers). Distinct from `name`, which is unique across the
--   whole platform and used as the legal/registration name.
-- - logo_url: public URL of the school logo in the `school-logos`
--   Storage bucket (path convention: school-logos/{school_id}/logo.{ext}).
-- - primary_color: the brand colour as an oklch() string, applied to the
--   theme at runtime (the --primary CSS variable and its derivatives).
--
-- All nullable: a school without branding falls back to `name`, the
-- default Lumen logo and the default theme colour.
-- =========================================================================

alter table public.schools
  add column if not exists display_name text,
  add column if not exists logo_url text,
  add column if not exists primary_color text;

comment on column public.schools.display_name is
  'Friendly name shown in the UI; falls back to name when null.';
comment on column public.schools.logo_url is
  'Public URL of the school logo in the school-logos bucket, or null.';
comment on column public.schools.primary_color is
  'Brand primary colour as an oklch() string, applied to the theme, or null.';
