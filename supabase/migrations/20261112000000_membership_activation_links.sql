-- =========================================================================
-- The activation link an admin shares with an invited member.
-- -------------------------------------------------------------------------
-- When a school admin creates a teacher or a student, the backend issues a
-- single-use token and mails it. Until the member redeems it, the admin
-- needs to be able to see the link again: the mail may never arrive, the
-- member may ask for it, or the admin may simply close the tab.
--
-- The plaintext lives here so the admin can copy it from the member's
-- "Gestionar" card. It is cleared as soon as the account is activated and
-- the API never hands it to anybody but a school admin of that school.
--
-- RLS: the existing policy on school_memberships only lets a member read
-- their own row (their own link, which they already received by mail) and
-- platform admins read it as trusted staff. No other role can read this
-- column through PostgREST.
-- =========================================================================

alter table public.school_memberships
  add column if not exists activation_token text,
  add column if not exists activation_expires_at timestamptz;

comment on column public.school_memberships.activation_token is
  'Plaintext one-time token that lets the invited member set their password. Null once the account is activated.';

comment on column public.school_memberships.activation_expires_at is
  'When the activation token stops working.';
