-- =========================================================================
-- The editorial catalog of the platform role.
-- -------------------------------------------------------------------------
-- The catalog the platform team fills is a model of its own:
--
--   materials           the piece itself: title, type, area, grades, the
--                       audience it is visible to and where it is in its
--                       lifecycle.
--   material_files      the files of the piece. A material may have
--                       several (the book and its evaluation).
--   material_schools    who can see it. This is the switch the platform
--                       team flips, colegio por colegio.
--   material_history    what happened to it and who did it.
--   audit_log           the trace of the critical events, for support.
--
-- The old `catalog_items` table was the first version of the same idea:
-- the landing showed a list of pieces and the schools that had access,
-- with the school names written by hand. It is transformed here instead
-- of being duplicated: the pieces become materials, and the schools that
-- had access become rows of `material_schools`.
--
-- Rollback:
--   drop table if exists public.audit_log;
--   drop table if exists public.material_history;
--   drop table if exists public.material_schools;
--   drop table if exists public.material_files;
--   drop table if exists public.materials;
--   -- The legacy catalog is left as it was; it is dropped by its own
--   -- migration, whose rollback brings it back.
-- =========================================================================


-- ---------------------------------------------------------------------------
-- The material
-- ---------------------------------------------------------------------------
create table if not exists public.materials (
  id               uuid primary key default gen_random_uuid(),
  -- The readable identifier the platform team uses: "C-1041".
  code             varchar(12) not null,
  title            varchar(240) not null,
  type             varchar(32) not null,
  area             varchar(32) not null,
  -- The grades it applies to, as "7°" or "10°".
  grades           text[] not null default '{}',
  -- "all" (teachers and students) or "teachers" (only the teachers).
  visible_to       varchar(16) not null default 'all',
  publication_year smallint,
  description      text,
  -- "upload" (the platform team uploaded a file) or "link" (an external
  -- resource, which is neither downloaded nor backed up).
  origin           varchar(16) not null default 'upload',
  external_url     text,
  status           varchar(16) not null default 'draft',
  -- The editorial order of the landing.
  position         integer not null default 0,
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  published_at     timestamptz,
  archived_at      timestamptz,
  constraint materials_code_uq unique (code),
  constraint materials_type_check
    check (type in ('Libro', 'Guía', 'Evaluación', 'Multimedia', 'Documento')),
  constraint materials_area_check
    check (area in ('Matemáticas', 'Lenguaje', 'Ciencias', 'Sociales', 'Inglés',
                    'Convivencia', 'Orientación', 'ICFES', 'Artes', 'Deportes')),
  constraint materials_visible_to_check
    check (visible_to in ('all', 'teachers')),
  constraint materials_origin_check
    check (origin in ('upload', 'link')),
  constraint materials_status_check
    check (status in ('draft', 'review', 'published', 'archived')),
  -- An external resource needs its address; an uploaded one does not.
  constraint materials_link_needs_url_check
    check (origin <> 'link' or external_url is not null)
);

comment on table public.materials is
  'The material the platform team loads into the editorial catalog.';

create index if not exists materials_status_idx
  on public.materials (status);

create index if not exists materials_type_idx
  on public.materials (type);

create index if not exists materials_area_idx
  on public.materials (area);

create index if not exists materials_updated_at_idx
  on public.materials (updated_at desc);

create index if not exists materials_position_idx
  on public.materials (position);

drop trigger if exists materials_set_updated_at on public.materials;
create trigger materials_set_updated_at
  before update on public.materials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- The files of the material
--
-- `material_id` is null while the file is uploaded but not attached to a
-- material yet: the upload assistant collects the files first and names
-- them when the piece is created.
-- ---------------------------------------------------------------------------
create table if not exists public.material_files (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid references public.materials(id) on delete cascade,
  -- The key of the object in the storage, never the public address.
  storage_key  text not null,
  file_name    text not null,
  mime_type    varchar(120) not null,
  size_bytes   bigint not null default 0,
  -- The file that proposes the title of the piece.
  is_primary   boolean not null default false,
  -- The digest of the content, to tell a duplicate from a new file.
  content_hash varchar(64),
  uploaded_by  uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.material_files is
  'The files of a material. A null material_id means the file is uploaded but not attached yet.';

create index if not exists material_files_material_idx
  on public.material_files (material_id);

create index if not exists material_files_hash_idx
  on public.material_files (content_hash);

-- ---------------------------------------------------------------------------
-- The access, colegio por colegio
-- ---------------------------------------------------------------------------
create table if not exists public.material_schools (
  material_id uuid not null references public.materials(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  enabled_at  timestamptz not null default now(),
  enabled_by  uuid references public.users(id) on delete set null,
  constraint material_schools_pkey primary key (material_id, school_id)
);

comment on table public.material_schools is
  'The schools that can see a material. Enabling access for a school publishes its name.';

create index if not exists material_schools_school_idx
  on public.material_schools (school_id);

-- ---------------------------------------------------------------------------
-- The history of the material
-- ---------------------------------------------------------------------------
create table if not exists public.material_history (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  action      varchar(32) not null,
  -- What changed, as a list of {"field", "before", "after"}.
  detail      jsonb not null default '{}'::jsonb,
  actor_id    uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint material_history_action_check
    check (action in ('created', 'status_changed', 'access_changed',
                      'metadata_changed', 'file_replaced'))
);

comment on table public.material_history is
  'What happened to a material and who did it.';

create index if not exists material_history_material_idx
  on public.material_history (material_id, created_at desc);

-- ---------------------------------------------------------------------------
-- The audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  event_type   varchar(64) not null,
  level        varchar(16) not null default 'info',
  actor_id     uuid references public.users(id) on delete set null,
  -- The name of the actor at the time of the event.
  actor_name   varchar(160),
  school_id    uuid references public.schools(id) on delete set null,
  subject_type varchar(32),
  subject_id   uuid,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  constraint audit_log_level_check check (level in ('info', 'warning', 'error'))
);

comment on table public.audit_log is
  'The trace of the critical events, for support and for the audit view.';

create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);

create index if not exists audit_log_school_idx
  on public.audit_log (school_id);

create index if not exists audit_log_event_type_idx
  on public.audit_log (event_type);

-- ---------------------------------------------------------------------------
-- The transformation of the old catalog
--
-- The pieces of `catalog_items` become materials: the reference is the
-- code, the state is the status and the size and the grades are read
-- from the descriptive line ("18,4 MB · 7° A, 7° B").
--
-- The tables are only there in a database that already applied the
-- previous migration, so the transformation is conditional: a fresh
-- database starts with the catalog empty and the seed fills it.
--
-- The access of the old rows named schools that were not tenants of the
-- database, so it cannot be carried over: the seed recreates it with the
-- schools that now exist.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.catalog_items') is null then
    return;
  end if;

  insert into public.materials (
    code, title, type, area, grades, status, position, created_at, updated_at, published_at
  )
  select
    c.ref,
    c.title,
    'Libro',
    -- The old catalog wrote "Lengua"; the area of the catalog is
    -- "Lenguaje".
    case when c.area = 'Lengua' then 'Lenguaje' else c.area end,
    coalesce(g.grades, '{}'),
    c.state,
    c.position,
    c.created_at,
    c.updated_at,
    case when c.state = 'published' then c.updated_at end
  from public.catalog_items c
  left join lateral (
    select array_agg(g.grade order by g.number) as grades
    from (
      select distinct (m[1])::int as number, (m[1])::int || '°' as grade
      from regexp_matches(coalesce(c.meta, ''), '(\d+)°', 'g') as m
    ) g
  ) g on true
  on conflict (code) do nothing;

  -- The old descriptive line also carried the size of the file, which
  -- becomes the primary file of the material.
  insert into public.material_files (
    material_id, storage_key, file_name, mime_type, size_bytes, is_primary, created_at
  )
  select
    m.id,
    'catalogo/' || m.code || '/material.pdf',
    m.title || '.pdf',
    'application/pdf',
    coalesce(
      round(
        replace(
          (regexp_match(coalesce(c.meta, ''), '([0-9]+(?:,[0-9]+)?) MB'))[1],
          ',', '.'
        )::numeric * 1048576
      )::bigint,
      0
    ),
    true,
    m.created_at
  from public.materials m
  join public.catalog_items c on c.ref = m.code;

end
$$;

-- The old catalog is replaced by the new model in
-- `20261119100000_drop_legacy_catalog.sql`.

-- ---------------------------------------------------------------------------
-- RLS, with no policies
--
-- The tables of the catalog and of the audit trail are read and written
-- by the API, which connects with the owner role. Row level security is
-- enabled on all of them, so that a table that later gets a policy
-- starts from a closed door instead of an open one.
-- ---------------------------------------------------------------------------
alter table public.materials enable row level security;
alter table public.material_files enable row level security;
alter table public.material_schools enable row level security;
alter table public.material_history enable row level security;
alter table public.audit_log enable row level security;
