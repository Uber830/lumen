-- =========================================================================
-- chat_conversations, chat_members, chat_messages.
-- -------------------------------------------------------------------------
-- A conversation belongs to a school (the school_id is denormalized so
-- RLS predicates stay fast). Membership is recorded once per user per
-- conversation in chat_members. Messages carry a body and tie to the
-- conversation.
-- =========================================================================

create type chat_conversation_kind as enum ('direct', 'group');

create table public.chat_conversations (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete restrict,
  title        text,
  kind         chat_conversation_kind not null default 'group',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint chat_conversations_kind_title_check check (
    (kind = 'group' and (title is not null or title = '')) or kind = 'direct'
  )
);

create index chat_conversations_school_id_idx on public.chat_conversations (school_id);
create index chat_conversations_created_by_idx on public.chat_conversations (created_by);

comment on table public.chat_conversations is
  'A chat conversation. Direct conversations have no title; group conversations must have a title.';

create trigger chat_conversations_set_updated_at
  before update on public.chat_conversations
  for each row execute function public.set_updated_at();

create table public.chat_members (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  conversation_id  uuid not null references public.chat_conversations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  joined_at        timestamptz not null default now(),
  last_read_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint chat_members_conversation_user_uq unique (conversation_id, user_id)
);

create index chat_members_school_id_idx on public.chat_members (school_id);
create index chat_members_user_id_idx on public.chat_members (user_id);
create index chat_members_conversation_id_idx on public.chat_members (conversation_id);

comment on table public.chat_members is
  'Membership of a user in a chat conversation. Unique per (conversation, user).';

create trigger chat_members_set_updated_at
  before update on public.chat_members
  for each row execute function public.set_updated_at();

create table public.chat_messages (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  conversation_id  uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id        uuid not null references auth.users(id) on delete restrict,
  body             text not null,
  sent_at          timestamptz not null default now(),
  edited_at         timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint chat_messages_body_check check (length(body) > 0)
);

create index chat_messages_school_id_idx on public.chat_messages (school_id);
create index chat_messages_conversation_id_idx on public.chat_messages (conversation_id);
create index chat_messages_sender_id_idx on public.chat_messages (sender_id);

comment on table public.chat_messages is
  'A message in a chat conversation. Only members of the conversation can read or post; sender must be the authenticated user.';

create trigger chat_messages_set_updated_at
  before update on public.chat_messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.chat_conversations enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

-- chat_conversations
drop policy if exists chat_conversations_select on public.chat_conversations;
create policy chat_conversations_select
  on public.chat_conversations
  for select
  to authenticated
  using (
    is_platform_admin()
    or created_by = (select auth.uid())
    or (select public.has_school_role(school_id, 'school_admin'))
    or exists (
      select 1
      from public.chat_members m
      where m.conversation_id = chat_conversations.id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists chat_conversations_insert on public.chat_conversations;
create policy chat_conversations_insert
  on public.chat_conversations
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.is_school_member(school_id))
  );

drop policy if exists chat_conversations_update on public.chat_conversations;
create policy chat_conversations_update
  on public.chat_conversations
  for update
  to authenticated
  using (
    is_platform_admin()
    or created_by = (select auth.uid())
  )
  with check (
    is_platform_admin()
    or created_by = (select auth.uid())
  );

drop policy if exists chat_conversations_delete on public.chat_conversations;
create policy chat_conversations_delete
  on public.chat_conversations
  for delete
  to authenticated
  using (
    is_platform_admin()
    or created_by = (select auth.uid())
    or (select public.has_school_role(school_id, 'school_admin'))
  );

-- chat_members
drop policy if exists chat_members_select on public.chat_members;
create policy chat_members_select
  on public.chat_members
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.chat_members me
      where me.conversation_id = chat_members.conversation_id
        and me.user_id = (select auth.uid())
    )
  );

drop policy if exists chat_members_insert on public.chat_members;
create policy chat_members_insert
  on public.chat_members
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.is_school_member(school_id))
  );

drop policy if exists chat_members_delete on public.chat_members;
create policy chat_members_delete
  on public.chat_members
  for delete
  to authenticated
  using (
    is_platform_admin()
    or user_id = (select auth.uid())
    or (select public.has_school_role(school_id, 'school_admin'))
  );

-- chat_messages
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select
  on public.chat_messages
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or exists (
      select 1
      from public.chat_members m
      where m.conversation_id = chat_messages.conversation_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert
  on public.chat_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.chat_members m
      where m.conversation_id = chat_messages.conversation_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists chat_messages_update on public.chat_messages;
create policy chat_messages_update
  on public.chat_messages
  for update
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (sender_id = (select auth.uid()) and sent_at > now() - interval '5 minutes')
  )
  with check (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or sender_id = (select auth.uid())
  );

-- No policy on chat_messages DELETE: messages are immutable.
-- platform_admin can hard-delete via the service role if needed.
