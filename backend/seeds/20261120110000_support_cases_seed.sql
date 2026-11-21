-- =========================================================================
-- The support desk of the platform role.
-- -------------------------------------------------------------------------
-- DEMONSTRATION DATA. It fills the desk with something to look at from
-- the first boot:
--
--   4 cases      what the schools asked, with the conversation of each
--                one and how urgent it is.
--   the messages the turns of every conversation.
--
-- It needs the schools of `20261119100000_editorial_network_seed.sql`,
-- which is applied before it.
--
-- It is idempotent: it can be applied again without duplicating
-- anything.
--
-- The vocabulary is the canonical one of the product: the case has a
-- title, a category, a channel, a level and a state, all in Spanish
-- (abierto, en_espera, resuelto). The description of the case is the
-- first message of the thread.
-- =========================================================================

-- The cases
-- ---------------------------------------------------------------------------
insert into public.support_cases (
  id, code, title, category, channel, level, status,
  school_id, opened_by, opened_at, resolved_at
) values
  ('c9000001-0000-4000-8000-000000000001', 'SOL-1042',
   'El material de 7° no aparece en el curso de los docentes',
   'problema_tecnico', 'formulario_web', 'urgente', 'abierto',
   'd0000001-0000-4000-8000-000000000001',
   'a0000001-0000-4000-8000-000000000001',
   '2026-11-19T13:40:00+00:00', null),
  ('c9000001-0000-4000-8000-000000000002', 'SOL-1039',
   'Solicitud de obra de teatro para 9°',
   'solicitud_material', 'correo', 'info', 'en_espera',
   'd0000001-0000-4000-8000-000000000003',
   'a0000001-0000-4000-8000-000000000003',
   '2026-11-18T21:20:00+00:00', null),
  ('c9000001-0000-4000-8000-000000000003', 'SOL-1034',
   '¿Cuándo habilitan el material de ciencias?',
   'solicitud_material', 'formulario_web', 'aviso', 'abierto',
   'd0000001-0000-4000-8000-000000000004',
   'a0000001-0000-4000-8000-000000000004',
   '2026-11-11T21:30:00+00:00', null),
  ('c9000001-0000-4000-8000-000000000007', 'SOL-1031',
   'Restablecimiento de contraseña de la administradora',
   'duda_acceso', 'llamada', 'urgente', 'resuelto',
   'd0000001-0000-4000-8000-000000000007',
   'a0000001-0000-4000-8000-000000000007',
   '2026-11-12T15:02:00+00:00', '2026-11-12T15:02:00+00:00')
on conflict (code) do update
  set title = excluded.title,
      category = excluded.category,
      channel = excluded.channel,
      level = excluded.level,
      status = excluded.status,
      school_id = excluded.school_id,
      opened_by = excluded.opened_by,
      opened_at = excluded.opened_at,
      resolved_at = excluded.resolved_at;


-- The conversation
--
-- The school writes with the role "colegio" and the platform team with
-- the role "plataforma". The author comes from the account: the name
-- is read from the user, it is not written twice.
-- ---------------------------------------------------------------------------
insert into public.support_messages (
  id, case_id, author_id, author_role, body, created_at
) values
  ('f0000001-0000-4000-8000-000000000001', 'c9000001-0000-4000-8000-000000000001',
   'a0000001-0000-4000-8000-000000000001', 'colegio',
   'El material de álgebra no me aparece en el curso 7° A, aunque el colegio tiene acceso habilitado. ¿Debo habilitar algo o es un error?',
   '2026-11-19T13:40:00+00:00'),

  ('f0000001-0000-4000-8000-000000000002', 'c9000001-0000-4000-8000-000000000002',
   'a0000001-0000-4000-8000-000000000003', 'colegio',
   'Nos gustaría «La vida es sueño» en español para 9° A. ¿Podrían habilitarla?',
   '2026-11-18T21:20:00+00:00'),
  ('f0000001-0000-4000-8000-000000000003', 'c9000001-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000101', 'plataforma',
   'Ya está en el catálogo. Confírmennos si además la quieren para 10° y la habilitamos para ambos cursos.',
   '2026-11-18T22:05:00+00:00'),

  ('f0000001-0000-4000-8000-000000000004', 'c9000001-0000-4000-8000-000000000003',
   'a0000001-0000-4000-8000-000000000004', 'colegio',
   'Registramos el colegio la semana pasada. ¿Cuándo queda disponible el material de ciencias para nuestros docentes?',
   '2026-11-11T21:30:00+00:00'),

  ('f0000001-0000-4000-8000-000000000005', 'c9000001-0000-4000-8000-000000000007',
   '00000000-0000-0000-0000-000000000101', 'plataforma',
   'Enviamos una clave temporal al correo institucional. El acceso se restablece en el siguiente inicio de sesión.',
   '2026-11-12T15:02:00+00:00')
on conflict (id) do update
  set body = excluded.body,
      author_role = excluded.author_role,
      created_at = excluded.created_at;
