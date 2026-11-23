-- =========================================================================
-- The payment provider leaves the project.
-- -------------------------------------------------------------------------
-- The app does not sell anything: the plan of a school and what it
-- enables are set by the platform team when the school is registered.
-- The provider of payments (and its webhook, its ledger and the
-- columns that pointed at it) is gone:
--
--   subscriptions.wompi_subscription_id     — the id of the payment
--   subscriptions.wompi_payment_source_id   — the card of the payer
--   public.wompi_events_processed            — the ledger of the webhook
--
-- The tables `subscriptions` and `entitlements` stay: they are the
-- plan of the school and the permission to use ICFES, and the API
-- reads them.
--
-- Rollback:
--   alter table public.subscriptions
--     add column wompi_subscription_id text,
--     add column wompi_payment_source_id text;
--   create table public.wompi_events_processed (
--     event_id     text primary key,
--     event_type   text not null,
--     payload      jsonb not null,
--     processed_at timestamptz not null default now()
--   );
-- =========================================================================

alter table public.subscriptions
  drop column if exists wompi_subscription_id;

alter table public.subscriptions
  drop column if exists wompi_payment_source_id;

drop table if exists public.wompi_events_processed;

drop index if exists public.subscriptions_wompi_subscription_id_idx;
