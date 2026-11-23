-- =========================================================================
-- The activation link is no longer kept on the membership.
-- -------------------------------------------------------------------------
-- The link an admin shares with an invited member used to be stored in
-- plaintext on school_memberships, so the admin could find it again in
-- "Gestionar" after closing the tab. The link is now rotated instead:
-- every time the admin asks for it, a new one is issued and the
-- previous one stops working. Nothing readable is kept at rest.
--
-- The token itself lives in password_reset_tokens, as a hash, exactly
-- like the password-reset link. These two columns are no longer used.
-- =========================================================================

alter table public.school_memberships
  drop column if exists activation_token,
  drop column if exists activation_expires_at;
