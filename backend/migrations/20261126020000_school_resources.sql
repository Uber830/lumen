-- =========================================================================
-- The school loads its own resources, and sees the file inside the app.
-- -------------------------------------------------------------------------
-- Two things change in the catalogue of the material:
--
--   1. the audience of a piece is not only "everyone" or "the teachers":
--      a school decides who sees what it uploads (a manual for the
--      administrators, a guide for the teachers, a text for the students);
--   2. a piece can be an image: a manual of the school is often a photo
--      of a page or a poster.
--
-- The resource of the school is a row of `materials` like any other: the
-- origin is what tells it apart (`created_by` is somebody of the school).
-- =========================================================================

-- The audiences: everybody, the teachers, the students or the
-- administrators of the school.
alter table public.materials drop constraint if exists materials_visible_to_check;
alter table public.materials
  add constraint materials_visible_to_check
  check (visible_to in ('all', 'teachers', 'students', 'admins'));

-- The formats: on top of the pdf, the epub, the docx, the mp4 and the
-- zip, an image can be a piece of the catalogue.
alter table public.materials drop constraint if exists materials_kind_ck;
alter table public.materials
  add constraint materials_kind_ck
  check (kind in ('pdf', 'docx', 'epub', 'mp4', 'zip', 'image'));
