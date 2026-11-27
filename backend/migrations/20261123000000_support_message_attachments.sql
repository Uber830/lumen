-- =========================================================================
-- The files a message of the support thread carries.
-- -------------------------------------------------------------------------
-- A school can attach a file to the request it opens and to the messages
-- it adds to the thread. The thread has to show them again, so the paths
-- of the store are kept with the message.
--
-- The paths are the ones of the file store ("support-attachments/{school}/
-- {file}"): they point at the file, they do not carry it.
-- =========================================================================

alter table public.support_messages
  add column if not exists attachment_ids jsonb not null default '[]'::jsonb;
