-- =========================================================================
-- The city of the school.
-- -------------------------------------------------------------------------
-- The platform team registers the institutions of the network and the
-- city is part of that registration. It is optional: a school that
-- does not report it simply does not show it.
--
-- The tables of the support desk (`support_cases` and
-- `support_messages`) are NOT created here: they are created by
-- `20261120020000_school_icfes_support.sql`, in the canonical shape
-- shared with the school panel (title, category, channel, level,
-- status, opened_by, opened_at). Creating them in the two migrations
-- would leave the database with the shape of whichever one ran first,
-- so this migration only adds what is new.
--
-- Rollback:
--   alter table public.schools drop column if exists city;
-- =========================================================================

alter table public.schools add column if not exists city text;

comment on column public.schools.city is
  'The city where the school is, reported when it is registered.';
