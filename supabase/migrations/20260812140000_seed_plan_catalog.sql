-- =========================================================================
-- Seed the subscription plan catalog.
-- -------------------------------------------------------------------------
-- The plan catalog is read-only for regular users and mutated by
-- platform_admin via the backend. Three tiers match the original
-- Lumen landing/pricing UI:
--
--   Basico:     up to 200 students,  15 teachers,  no ICFES,  10 GB
--   Estandar:   up to 1,500 students, unlimited teachers, ICFES, 100 GB
--   Premium:    unlimited students/teachers, ICFES, 1 TB
--
-- Prices are stored in price_cents. For COP the smallest unit is the
-- peso itself, so 49000 means 49,000 COP. The amount is in cents (or
-- the smallest currency unit when the provider does not support
-- fractions); Wompi and Stripe treat it identically.
-- =========================================================================

insert into public.plans (code, name, description, price_cents, currency, interval,
                          max_students, max_teachers, max_storage_gb, includes_icfes)
values
  (
    'basico',
    'Basico',
    'Para colegios pequenos que empiezan a digitalizarse.',
    49000,
    'COP',
    'monthly',
    200,
    15,
    10,
    false
  ),
  (
    'estandar',
    'Estandar',
    'El plan mas elegido por instituciones en crecimiento.',
    129000,
    'COP',
    'monthly',
    1500,
    null,
    100,
    true
  ),
  (
    'premium',
    'Premium',
    'Para redes educativas con multiples sedes.',
    299000,
    'COP',
    'monthly',
    null,
    null,
    1024,
    true
  )
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      currency = excluded.currency,
      interval = excluded.interval,
      max_students = excluded.max_students,
      max_teachers = excluded.max_teachers,
      max_storage_gb = excluded.max_storage_gb,
      includes_icfes = excluded.includes_icfes,
      is_active = excluded.is_active,
      updated_at = now();
