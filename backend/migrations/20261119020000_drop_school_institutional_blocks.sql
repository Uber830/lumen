-- =========================================================================
-- The purge of the institutional identity blocks.
-- -------------------------------------------------------------------------
-- The school administrator's "Personalización" view holds the visible
-- identity of the school: its name, its shield and its primary
-- colour. The four blocks that used to live there are gone:
--
--   schools.mission       the institution's mission statement
--   schools.vision        the institution's vision statement
--   schools.banner_url    the cover picture of the dashboard
--   schools.gallery       the pictures the school chose to show
--
-- The mission and the vision are not part of the school's work in the
-- product, and the pictures do not take part in any academic task.
--
-- WHY THIS MIGRATION DELETES DATA
--
-- The columns are dropped, and with them the content they held. The
-- rows are not kept as `null` forever: a null column nobody reads is
-- a lie about the data, and the texts are written by hand. If the
-- business needs them, they have to be exported BEFORE this migration
-- runs:
--
--   psql "$DATABASE_URL" -c \
--     "select id, name, mission, vision, banner_url, gallery from public.schools" \
--     > schools_identity_legacy.csv
--
-- The cover picture moves to the platform team, which manages it as a
-- single institutional strip for every school.
--
-- Rollback:
--   alter table public.schools add column if not exists mission text;
--   alter table public.schools add column if not exists vision text;
--   alter table public.schools add column if not exists banner_url text;
--   alter table public.schools add column if not exists gallery jsonb
--     not null default '[]'::jsonb;
--   (the content of the dropped columns is not restored)
-- =========================================================================

alter table public.schools drop column if exists mission;
alter table public.schools drop column if exists vision;
alter table public.schools drop column if exists banner_url;
alter table public.schools drop column if exists gallery;
