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
-- =========================================================================

-- The cases
-- ---------------------------------------------------------------------------
insert into public.support_cases (
  id, code, subject, detail, school_id, requester_name, requester_role,
  channel, level, status, created_at, updated_at, resolved_at
) values
  ('e0000001-0000-4000-8000-000000000001', 'SOL-1042',
   'El material de 7° no aparece en el curso de los docentes',
   'El docente reporta que el material de álgebra no le aparece en el curso 7° A, aunque el colegio tiene acceso habilitado.',
   'd0000001-0000-4000-8000-000000000001', 'Julio Ramírez', 'Docente',
   'web_form', 'urgent', 'open',
   '2026-11-19T13:40:00+00:00', '2026-11-19T13:40:00+00:00', null),
  ('e0000001-0000-4000-8000-000000000002', 'SOL-1039',
   'Solicitud de obra de teatro para 9°',
   'El colegio pide una obra de teatro en español para 9° A. El material ya está en el catálogo, falta habilitarlo para la institución.',
   'd0000001-0000-4000-8000-000000000003', 'Ana Restrepo', 'Administradora',
   'email', 'info', 'waiting',
   '2026-11-18T21:20:00+00:00', '2026-11-18T22:05:00+00:00', null),
  ('e0000001-0000-4000-8000-000000000003', 'SOL-1034',
   '¿Cuándo habilitan el material de ciencias?',
   'El colegio se registró hace una semana y espera el material de Ciencias 7 en la biblioteca de sus docentes.',
   'd0000001-0000-4000-8000-000000000004', 'Carlos Medina', 'Administrador',
   'web_form', 'warning', 'open',
   '2026-11-11T21:30:00+00:00', '2026-11-11T21:30:00+00:00', null),
  ('e0000001-0000-4000-8000-000000000004', 'SOL-1031',
   'Restablecimiento de contraseña de la administradora',
   'La administradora principal no recordaba su contraseña. Se envió clave temporal al correo institucional y el acceso quedó restablecido.',
   'd0000001-0000-4000-8000-000000000007', 'Coordinación', 'Institución',
   'call', 'urgent', 'resolved',
   '2026-11-12T15:02:00+00:00', '2026-11-12T15:02:00+00:00',
   '2026-11-12T15:02:00+00:00')
on conflict (code) do update
  set subject = excluded.subject,
      detail = excluded.detail,
      school_id = excluded.school_id,
      requester_name = excluded.requester_name,
      requester_role = excluded.requester_role,
      channel = excluded.channel,
      level = excluded.level,
      status = excluded.status,
      updated_at = excluded.updated_at,
      resolved_at = excluded.resolved_at;


-- The conversation
-- ---------------------------------------------------------------------------
insert into public.support_messages (
  id, case_id, author_id, author_name, author_role, body, created_at
) values
  ('f0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000001',
   null, 'Julio Ramírez', 'Docente',
   'El material de álgebra no me aparece en el curso 7° A. ¿Debo habilitar algo o es un error?',
   '2026-11-19T13:40:00+00:00'),

  ('f0000001-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000002',
   null, 'Ana Restrepo', 'Administradora',
   'Nos gustaría «La vida es sueño» en español para 9° A. ¿Podrían habilitarla?',
   '2026-11-18T21:20:00+00:00'),
  ('f0000001-0000-4000-8000-000000000003', 'e0000001-0000-4000-8000-000000000002',
   null, 'Equipo Lumen', 'Plataforma',
   'Ya está en el catálogo. Confírmennos si además la quieren para 10° y la habilitamos para ambos cursos.',
   '2026-11-18T22:05:00+00:00'),

  ('f0000001-0000-4000-8000-000000000004', 'e0000001-0000-4000-8000-000000000003',
   null, 'Carlos Medina', 'Administrador',
   'Registramos el colegio la semana pasada. ¿Cuándo queda disponible el material de ciencias para nuestros docentes?',
   '2026-11-11T21:30:00+00:00'),

  ('f0000001-0000-4000-8000-000000000005', 'e0000001-0000-4000-8000-000000000004',
   null, 'Equipo Lumen', 'Plataforma',
   'Enviamos una clave temporal al correo institucional. El acceso se restablece en el siguiente inicio de sesión.',
   '2026-11-12T15:02:00+00:00')
on conflict (id) do update
  set body = excluded.body,
      author_name = excluded.author_name,
      author_role = excluded.author_role;
