-- =========================================================================
-- The canonical shape of the support desk
-- -------------------------------------------------------------------------
-- The team of the platform declares these same two tables with its own
-- columns: `subject`, `detail`, `requester_name`, `requester_role` and the
-- states in English. This project is the one that decides: the case has a
-- title, a category, and a thread that opens with the message of the
-- administrator.
--
-- `create table if not exists` does not touch a table that already exists,
-- so when the migration of the other branch ran first, the tables of this
-- project found a desk they do not understand. This migration brings a desk
-- that arrived in the other shape to this one: the columns are added, the
-- values are translated and the columns of the other shape are dropped once
-- their content is in this one.
--
-- It is idempotent: on a database where the tables were created by this
-- project, it does nothing.
--
-- Rollback:
--   the columns of the other shape are not restored: the values they held
--   are in `title`, `category` and `opened_at`.
-- =========================================================================


-- ---------------------------------------------------------------------------
-- The support desk also arrives in two shapes
--
-- The team of the platform declares these same two tables with its own
-- columns: `subject`, `detail`, `requester_name`, `requester_role` and
-- the states in English. This shape is the one that stays: the case has
-- a title, a category, and a thread that opens with the message of the
-- administrator.
--
-- `create table if not exists` does not touch a table that already
-- exists, so when that migration ran first this one would find a desk
-- it does not understand. The block below brings a desk that arrived in
-- the other shape to this one: the columns are added, the values are
-- translated and the columns of the other shape are dropped once their
-- content is in this one. It is idempotent: on a database where this
-- migration ran first, it does nothing.
-- ---------------------------------------------------------------------------
alter table public.support_cases add column if not exists title text;
alter table public.support_cases add column if not exists category text default 'otro';
alter table public.support_cases
  add column if not exists opened_by uuid references public.users(id) on delete set null;
alter table public.support_cases add column if not exists opened_at timestamptz;
alter table public.support_messages
  add column if not exists author_id uuid references public.users(id) on delete set null;

-- The checks of the other shape hold the values in English, so they go
-- before the values are translated: otherwise the translation is
-- rejected by the very constraint that has to be replaced.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'support_cases_channel_check'
  ) then
    alter table public.support_cases drop constraint support_cases_channel_check;
  end if;

  if exists (
    select 1 from pg_constraint where conname = 'support_cases_level_check'
  ) then
    alter table public.support_cases drop constraint support_cases_level_check;
  end if;

  if exists (
    select 1 from pg_constraint where conname = 'support_cases_status_check'
  ) then
    alter table public.support_cases drop constraint support_cases_status_check;
  end if;
end $$;

-- The values of the other shape, translated into this one.
do $$
declare
  tiene_subject boolean := false;
  tiene_detail boolean := false;
  tiene_created boolean := false;
  tiene_author_name boolean := false;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_cases'
      and column_name = 'subject'
  ) into tiene_subject;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_cases'
      and column_name = 'detail'
  ) into tiene_detail;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_cases'
      and column_name = 'created_at'
  ) into tiene_created;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_messages'
      and column_name = 'author_name'
  ) into tiene_author_name;

  -- The subject of the other shape is the title of this one.
  if tiene_subject then
    update public.support_cases set title = subject where title is null;
  end if;
  update public.support_cases set title = 'Solicitud de soporte' where title is null;

  -- The values of the other shape are the ones in English. They are
  -- only translated when the table arrived in that shape: on a
  -- database that already speaks this one, the values are left alone.
  if tiene_subject then
    -- The channel: how the case arrived.
    update public.support_cases
    set channel = case channel
      when 'web_form' then 'formulario_web'
      when 'email' then 'correo'
      when 'call' then 'llamada'
      else 'formulario_colegio'
    end;

    -- The urgency.
    update public.support_cases
    set level = case level
      when 'warning' then 'aviso'
      when 'urgent' then 'urgente'
      else 'info'
    end;

    -- The state of the case.
    update public.support_cases
    set status = case status
      when 'open' then 'abierto'
      when 'waiting' then 'en_espera'
      when 'resolved' then 'resuelto'
      else 'abierto'
    end;
  end if;

  -- The category does not exist in the other shape: every case it
  -- brought is a request of another kind.
  update public.support_cases set category = 'otro' where category is null;

  -- The moment the case was opened.
  if tiene_created then
    update public.support_cases set opened_at = created_at where opened_at is null;
  end if;
  update public.support_cases set opened_at = now() where opened_at is null;

  -- The description of the other shape is the first message of the
  -- thread: the case and its message are the same thing here.
  if tiene_detail then
    insert into public.support_messages (case_id, author_id, author_role, body, created_at)
    select c.id, c.opened_by, 'colegio', c.detail, coalesce(c.opened_at, now())
    from public.support_cases c
    where c.detail is not null
      and not exists (
        select 1 from public.support_messages m where m.case_id = c.id
      );
  end if;

  -- The author of the other shape is a free text: only the side that
  -- wrote it is kept. The other branch writes the side in Spanish
  -- ("Plataforma") and in English ("Platform").
  if tiene_author_name then
    update public.support_messages
    set author_role = case
      when author_role in ('Platform', 'Plataforma', 'Equipo Lumen') then 'plataforma'
      else 'colegio'
    end;
  end if;
end $$;

-- Each value has one name only. The columns of the other shape are
-- dropped once their content is in `title`, `category` and `opened_at`.
--
-- The trigger that filled `updated_at` goes with it: a trigger that
-- writes a column that no longer exists breaks every update of the
-- table.
do $$
begin
  drop trigger if exists support_cases_set_updated_at on public.support_cases;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_cases'
      and column_name = 'subject'
  ) then
    alter table public.support_cases drop column subject;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_cases'
      and column_name = 'detail'
  ) then
    alter table public.support_cases drop column detail;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_cases'
      and column_name = 'requester_name'
  ) then
    alter table public.support_cases drop column requester_name;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_cases'
      and column_name = 'requester_role'
  ) then
    alter table public.support_cases drop column requester_role;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_cases'
      and column_name = 'created_at'
  ) then
    alter table public.support_cases drop column created_at;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_cases'
      and column_name = 'updated_at'
  ) then
    alter table public.support_cases drop column updated_at;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_messages'
      and column_name = 'author_name'
  ) then
    alter table public.support_messages drop column author_name;
  end if;
end $$;

-- The constraints of this shape, when the table arrived in the other one.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_cases_code_uq'
  ) then
    alter table public.support_cases add constraint support_cases_code_uq unique (code);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'support_cases_category_ck'
  ) then
    alter table public.support_cases add constraint support_cases_category_ck
      check (category in ('problema_tecnico', 'solicitud_material', 'duda_acceso', 'otro'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'support_cases_channel_ck'
  ) then
    alter table public.support_cases add constraint support_cases_channel_ck
      check (channel in ('formulario_colegio', 'formulario_web', 'correo', 'llamada'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'support_cases_level_ck'
  ) then
    alter table public.support_cases add constraint support_cases_level_ck
      check (level in ('info', 'aviso', 'urgente'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'support_cases_status_ck'
  ) then
    alter table public.support_cases add constraint support_cases_status_ck
      check (status in ('abierto', 'en_espera', 'resuelto'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'support_messages_author_role_ck'
  ) then
    alter table public.support_messages add constraint support_messages_author_role_ck
      check (author_role in ('colegio', 'plataforma'));
  end if;
end $$;

-- The code is text in this shape: the one of the other shape was
-- shorter, and the cases of the network do not fit in it.
alter table public.support_cases alter column code type text;
alter table public.support_cases alter column channel type text;
alter table public.support_cases alter column level type text;
alter table public.support_cases alter column status type text;
alter table public.support_messages alter column author_role type text;

-- A school that is deleted takes its cases with it. The foreign key of
-- the other shape left the cases of a school that no longer exists.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'support_cases_school_id_fkey'
      and pg_get_constraintdef(oid) like '%ON DELETE SET NULL%'
  ) then
    alter table public.support_cases drop constraint support_cases_school_id_fkey;
    alter table public.support_cases add constraint support_cases_school_id_fkey
      foreign key (school_id) references public.schools(id) on delete cascade;
  end if;
end $$;

alter table public.support_cases alter column title set not null;
alter table public.support_cases alter column category set not null;
alter table public.support_cases alter column category set default 'otro';
alter table public.support_cases alter column channel set not null;
alter table public.support_cases alter column channel set default 'formulario_colegio';
alter table public.support_cases alter column level set not null;
alter table public.support_cases alter column level set default 'info';
alter table public.support_cases alter column status set not null;
alter table public.support_cases alter column status set default 'abierto';
alter table public.support_cases alter column opened_at set not null;
-- The moment the case was opened is written by the database: the
-- column of the other shape carried that default and it went with it.
alter table public.support_cases alter column opened_at set default now();
alter table public.support_messages alter column author_role set not null;
alter table public.support_messages alter column author_role set default 'colegio';
alter table public.support_messages alter column created_at set default now();

-- A case without a school does not belong to this shape: it only
-- exists when the other shape brought cases of the platform team.
do $$
begin
  if not exists (
    select 1 from public.support_cases where school_id is null
  ) then
    alter table public.support_cases alter column school_id set not null;
  end if;
end $$;
