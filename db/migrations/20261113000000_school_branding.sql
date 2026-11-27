-- =========================================================================
-- The school's institutional identity.
-- -------------------------------------------------------------------------
-- The branding (name, logo, colour) was enough to paint the app, but a
-- school also wants to say what it is: its mission, its vision and the
-- pictures of its campus and community. Those live here so the dashboard
-- can show them.
--
-- - mission / vision: free text, written by the admin in "Personalización".
-- - banner_url: the cover image of the dashboard hero.
-- - gallery: the pictures the school chose to show, as a JSON array of
--   {"url": ..., "caption": ...}. It is a column and not a table because
--   the list is short, always read with the school and never queried by
--   its own fields.
--
-- RLS: the schools table keeps its own policies; the API writes these
-- columns as the school's admin.
-- =========================================================================

alter table public.schools
  add column if not exists mission text,
  add column if not exists vision text,
  add column if not exists banner_url text,
  add column if not exists gallery jsonb not null default '[]'::jsonb;

comment on column public.schools.mission is
  'The school mission, shown in the dashboard. Null when it is not written yet.';

comment on column public.schools.vision is
  'The school vision, shown in the dashboard. Null when it is not written yet.';

comment on column public.schools.banner_url is
  'Public URL of the cover image used in the dashboard hero.';

comment on column public.schools.gallery is
  'Gallery images as a JSON array of {"url": string, "caption": string | null}.';
