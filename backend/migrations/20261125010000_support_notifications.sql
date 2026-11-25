-- =========================================================================
-- The support thread reaches the bell of the other side.
-- -------------------------------------------------------------------------
-- A case that a school opens has to be known by the platform team, and
-- the answer of the platform team has to be known by the school. Both
-- are notifications: the bell of the app shell shows them.
--
-- The kind of the notification says what happened; the wording and the
-- link are written by the backend, so the platform admin opens the desk
-- of the cases and the school admin opens its own thread.
-- =========================================================================

alter type public.notification_kind add value if not exists 'support_case_opened';
alter type public.notification_kind add value if not exists 'support_case_replied';
