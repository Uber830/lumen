-- =========================================================================
-- The seed of the editorial catalog.
-- -------------------------------------------------------------------------
-- DEMONSTRATION DATA. It fills the panel of the platform team with
-- something to look at from the first boot:
--
--   16 materials            the pieces of the catalog, in the four
--                            states of the lifecycle.
--   the coverage             which school can see which piece.
--   the history             what happened to every piece and who did it.
--   the audit trail         the critical events, for support.
--
-- It needs the schools of `20261119100000_editorial_network_seed.sql`,
-- which is applied before it.
--
-- It is idempotent: it can be applied again without duplicating
-- anything.
-- =========================================================================

-- The material
--
-- The sixteen pieces of the demonstration: eight published, three in
-- review, three in draft and two archived.
-- ---------------------------------------------------------------------------
insert into public.materials (
  code, title, type, area, grades, visible_to, publication_year,
  description, origin, status, position, created_by, created_at, updated_at,
  published_at, archived_at
) values
  ('C-1041', 'Matemáticas 7 — Álgebra y funciones',
   'Libro', 'Matemáticas', array['7°'], 'all', 2026,
   'Desarrolla el álgebra y las funciones con ejercicios resueltos.',
   'upload', 'published', 1, '00000000-0000-0000-0000-000000000101',
   '2026-10-04T09:00:00+00:00', '2026-11-14T10:20:00+00:00', '2026-10-20T15:00:00+00:00', null),
  ('C-1042', 'Lengua 8 — Lectura y escritura',
   'Libro', 'Lenguaje', array['8°'], 'all', 2026,
   'Talleres de lectura comprensiva y escritura argumentativa.',
   'upload', 'published', 2, '00000000-0000-0000-0000-000000000101',
   '2026-10-05T09:00:00+00:00', '2026-11-13T10:20:00+00:00', '2026-10-22T15:00:00+00:00', null),
  ('C-1043', 'Ciencias 6 — El sistema solar',
   'Guía', 'Ciencias', array['6°'], 'teachers', 2026,
   'Guía de laboratorio para observar el sistema solar.',
   'upload', 'review', 3, '00000000-0000-0000-0000-000000000101',
   '2026-10-06T09:00:00+00:00', '2026-11-12T10:20:00+00:00', null, null),
  ('C-1044', 'Historia 9 — Colombia',
   'Libro', 'Sociales', array['9°'], 'all', 2026,
   'Recorre la historia de Colombia con fuentes y cronologías.',
   'upload', 'published', 4, '00000000-0000-0000-0000-000000000101',
   '2026-10-07T09:00:00+00:00', '2026-11-11T10:20:00+00:00', '2026-10-25T15:00:00+00:00', null),
  ('C-1045', 'Inglés 7 — Intermediate',
   'Guía', 'Inglés', array['7°'], 'all', 2026,
   'Guía de inglés intermedio para el grado séptimo.',
   'upload', 'draft', 5, '00000000-0000-0000-0000-000000000101',
   '2026-10-08T09:00:00+00:00', '2026-11-10T10:20:00+00:00', null, null),
  ('C-1046', 'Biología 10 — Genética',
   'Libro', 'Ciencias', array['10°'], 'all', 2026,
   'Mecanismos de herencia y genética molecular.',
   'upload', 'published', 6, '00000000-0000-0000-0000-000000000101',
   '2026-10-09T09:00:00+00:00', '2026-11-09T10:20:00+00:00', '2026-10-28T15:00:00+00:00', null),
  ('C-1047', 'Matemáticas 9 — Ecuaciones',
   'Libro', 'Matemáticas', array['9°'], 'all', 2026,
   'Ecuaciones de primer y segundo grado, con inducción.',
   'upload', 'published', 7, '00000000-0000-0000-0000-000000000101',
   '2026-10-10T09:00:00+00:00', '2026-11-08T10:20:00+00:00', '2026-10-30T15:00:00+00:00', null),
  ('C-1048', 'Arte 6 — Técnicas y materiales',
   'Documento', 'Artes', array['6°'], 'all', 2026,
   'Técnicas de dibujo y materiales para la expresión artística.',
   'upload', 'draft', 8, '00000000-0000-0000-0000-000000000101',
   '2026-10-11T09:00:00+00:00', '2026-11-07T10:20:00+00:00', null, null),
  ('C-1049', 'Sociales 7 — Constitución y permisos',
   'Guía', 'Sociales', array['7°'], 'all', 2026,
   'La Constitución y el uso de los permisos en el aula.',
   'upload', 'review', 9, '00000000-0000-0000-0000-000000000101',
   '2026-10-12T09:00:00+00:00', '2026-11-06T10:20:00+00:00', null, null),
  ('C-1050', 'Física 11 — Ondas y sonido',
   'Multimedia', 'Ciencias', array['11°'], 'teachers', 2026,
   'Ondas mecánicas y interpretación del sonido.',
   'upload', 'archived', 10, '00000000-0000-0000-0000-000000000101',
   '2026-10-13T09:00:00+00:00', '2026-11-05T10:20:00+00:00', '2026-11-01T15:00:00+00:00', '2026-11-05T10:20:00+00:00'),
  ('C-1051', 'Lengua 6 — Gramática y escritura',
   'Libro', 'Lenguaje', array['6°'], 'all', 2026,
   'Gramática y escritura para el grado sexto.',
   'upload', 'published', 11, '00000000-0000-0000-0000-000000000101',
   '2026-10-14T09:00:00+00:00', '2026-11-04T10:20:00+00:00', '2026-11-02T15:00:00+00:00', null),
  ('C-1052', 'Química 10 — Reacciones químicas',
   'Libro', 'Ciencias', array['10°'], 'all', 2026,
   'Reacciones químicas, equilibrio y estequiometría.',
   'upload', 'published', 12, '00000000-0000-0000-0000-000000000101',
   '2026-10-15T09:00:00+00:00', '2026-11-03T10:20:00+00:00', '2026-11-03T15:00:00+00:00', null),
  ('C-1053', 'Inglés 9 — Intermediate',
   'Libro', 'Inglés', array['9°'], 'all', 2026,
   'Inglés intermedio para el grado noveno.',
   'upload', 'published', 13, '00000000-0000-0000-0000-000000000101',
   '2026-10-16T09:00:00+00:00', '2026-11-02T10:20:00+00:00', '2026-11-04T15:00:00+00:00', null),
  ('C-1054', 'Matemáticas 6 — Números naturales',
   'Guía', 'Matemáticas', array['6°'], 'all', 2026,
   'Números naturales, operaciones y problemas de conteo.',
   'upload', 'review', 14, '00000000-0000-0000-0000-000000000101',
   '2026-10-17T09:00:00+00:00', '2026-11-01T10:20:00+00:00', null, null),
  ('C-1055', 'Historia 8 — Independencia',
   'Documento', 'Sociales', array['8°'], 'all', 2026,
   'Independencia de Colombia: causas y procesos.',
   'upload', 'draft', 15, '00000000-0000-0000-0000-000000000101',
   '2026-10-18T09:00:00+00:00', '2026-10-31T10:20:00+00:00', null, null),
  ('C-1056', 'Educación Física 7 — Atletismo',
   'Multimedia', 'Deportes', array['7°'], 'all', 2026,
   'Rutinas de atletismo para la clase de educación física.',
   'upload', 'archived', 16, '00000000-0000-0000-0000-000000000101',
   '2026-10-19T09:00:00+00:00', '2026-10-30T10:20:00+00:00', '2026-10-26T15:00:00+00:00', '2026-10-30T10:20:00+00:00')
on conflict (code) do update
  set title = excluded.title,
      type = excluded.type,
      area = excluded.area,
      grades = excluded.grades,
      visible_to = excluded.visible_to,
      publication_year = excluded.publication_year,
      description = excluded.description,
      status = excluded.status,
      position = excluded.position,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at,
      archived_at = excluded.archived_at;

-- ---------------------------------------------------------------------------
-- The files of the material
--
-- The demonstration pieces have their file in the storage of the
-- platform. The key is the one the catalog keeps: the public address is
-- never stored.
-- ---------------------------------------------------------------------------
delete from public.material_files where storage_key like 'catalogo/%';

insert into public.material_files (
  id, material_id, storage_key, file_name, mime_type, size_bytes,
  is_primary, content_hash, uploaded_by, created_at
)
select
  ('a1000001-0000-4000-8000-' || lpad(m.n::text, 12, '0'))::uuid,
  mat.id,
  'catalogo/' || mat.code || '/material.pdf',
  mat.title || '.pdf',
  'application/pdf',
  m.size_bytes,
  true,
  md5(mat.code || mat.title),
  '00000000-0000-0000-0000-000000000101',
  mat.created_at
from (
  values
    (1, 'C-1041', 18400000),
    (2, 'C-1042', 12100000),
    (3, 'C-1043', 24000000),
    (4, 'C-1044', 9800000),
    (5, 'C-1045', 15300000),
    (6, 'C-1046', 31700000),
    (7, 'C-1047', 20200000),
    (8, 'C-1048', 45000000),
    (9, 'C-1049', 11700000),
    (10, 'C-1050', 28400000),
    (11, 'C-1051', 14900000),
    (12, 'C-1052', 22600000),
    (13, 'C-1053', 13800000),
    (14, 'C-1054', 19500000),
    (15, 'C-1055', 10400000),
    (16, 'C-1056', 8200000)
  ) as m(n, code, size_bytes)
join public.materials mat on mat.code = m.code;

-- ---------------------------------------------------------------------------
-- The access, colegio por colegio
--
-- The published pieces are the ones the schools see. The coverage is
-- spread: some institutions see a lot of the catalog, some see a
-- little, which is what the panel has to show.
-- ---------------------------------------------------------------------------
insert into public.material_schools (material_id, school_id, enabled_at, enabled_by)
select
  m.id,
  s.id,
  '2026-10-20T15:00:00+00:00',
  '00000000-0000-0000-0000-000000000101'
from (
  values
    ('C-1041', 'DEMO01'), ('C-1041', 'DEMO02'), ('C-1041', 'DEMO03'),
    ('C-1041', 'DEMO04'), ('C-1041', 'DEMO05'), ('C-1041', 'DEMO06'),
    ('C-1042', 'DEMO01'), ('C-1042', 'DEMO02'), ('C-1042', 'DEMO07'),
    ('C-1042', 'DEMO08'), ('C-1042', 'DEMO09'), ('C-1042', 'DEMO10'),
    ('C-1043', 'DEMO01'), ('C-1043', 'DEMO02'), ('C-1043', 'DEMO03'),
    ('C-1044', 'DEMO01'), ('C-1044', 'DEMO02'), ('C-1044', 'DEMO03'),
    ('C-1044', 'DEMO04'), ('C-1044', 'DEMO11'), ('C-1044', 'DEMO12'),
    ('C-1044', 'DEMO13'),
    ('C-1045', 'DEMO01'),
    ('C-1046', 'DEMO01'), ('C-1046', 'DEMO02'), ('C-1046', 'DEMO03'),
    ('C-1046', 'DEMO14'), ('C-1046', 'DEMO15'), ('C-1046', 'DEMO16'),
    ('C-1047', 'DEMO01'), ('C-1047', 'DEMO02'), ('C-1047', 'DEMO04'),
    ('C-1047', 'DEMO17'), ('C-1047', 'DEMO18'),
    ('C-1048', 'DEMO01'),
    ('C-1049', 'DEMO01'), ('C-1049', 'DEMO02'),
    ('C-1050', 'DEMO01'), ('C-1050', 'DEMO02'),
    ('C-1051', 'DEMO01'), ('C-1051', 'DEMO02'), ('C-1051', 'DEMO03'),
    ('C-1051', 'DEMO05'), ('C-1051', 'DEMO19'), ('C-1051', 'DEMO20'),
    ('C-1052', 'DEMO01'), ('C-1052', 'DEMO02'), ('C-1052', 'DEMO06'),
    ('C-1052', 'DEMO21'), ('C-1052', 'DEMO22'), ('C-1052', 'DEMO23'),
    ('C-1053', 'DEMO01'), ('C-1053', 'DEMO02'), ('C-1053', 'DEMO03'),
    ('C-1053', 'DEMO07'), ('C-1053', 'DEMO24'),
    ('C-1054', 'DEMO01'), ('C-1054', 'DEMO02'), ('C-1054', 'DEMO03'),
    ('C-1055', 'DEMO01'),
    ('C-1056', 'DEMO01'), ('C-1056', 'DEMO02')
  ) as a(code, short_code)
join public.materials m on m.code = a.code
join public.schools s on s.short_code = a.short_code
on conflict (material_id, school_id) do nothing;

-- ---------------------------------------------------------------------------
-- The history of the material
-- ---------------------------------------------------------------------------
insert into public.material_history (id, material_id, action, detail, actor_id, created_at)
select
  ('b1000001-0000-4000-8000-' || lpad(m.n::text, 12, '0'))::uuid,
  mat.id,
  'created',
  jsonb_build_object('title', mat.title, 'type', mat.type, 'area', mat.area),
  '00000000-0000-0000-0000-000000000101',
  mat.created_at
from (
  values
    (1, 'C-1041'), (2, 'C-1042'), (3, 'C-1043'), (4, 'C-1044'),
    (5, 'C-1045'), (6, 'C-1046'), (7, 'C-1047'), (8, 'C-1048'),
    (9, 'C-1049'), (10, 'C-1050'), (11, 'C-1051'), (12, 'C-1052'),
    (13, 'C-1053'), (14, 'C-1054'), (15, 'C-1055'), (16, 'C-1056')
  ) as m(n, code)
join public.materials mat on mat.code = m.code
where not exists (
  select 1 from public.material_history h
  where h.material_id = mat.id and h.action = 'created'
);

insert into public.material_history (id, material_id, action, detail, actor_id, created_at)
select
  ('b2000001-0000-4000-8000-' || lpad(row_number() over (order by m.code)::text, 12, '0'))::uuid,
  m.id,
  'status_changed',
  jsonb_build_object('from', 'draft', 'to', m.status),
  '00000000-0000-0000-0000-000000000101',
  coalesce(m.published_at, m.updated_at)
from public.materials m
where m.code between 'C-1041' and 'C-1056'
  and m.status <> 'draft'
  and not exists (
    select 1 from public.material_history h
    where h.material_id = m.id and h.action = 'status_changed'
  );

insert into public.material_history (id, material_id, action, detail, actor_id, created_at)
select
  ('b3000001-0000-4000-8000-' || lpad(row_number() over (order by m.code)::text, 12, '0'))::uuid,
  m.id,
  'access_changed',
  jsonb_build_object(
    'added', jsonb_build_array(
      jsonb_build_object('id', s.id::text, 'name', s.name)
    ),
    'removed', jsonb_build_array()
  ),
  '00000000-0000-0000-0000-000000000101',
  '2026-10-20T15:00:00+00:00'
from public.materials m
join public.material_schools ms on ms.material_id = m.id
join public.schools s on s.id = ms.school_id
where m.code between 'C-1041' and 'C-1056'
  and not exists (
    select 1 from public.material_history h
    where h.material_id = m.id and h.action = 'access_changed'
  );

-- ---------------------------------------------------------------------------
-- The audit trail
-- ---------------------------------------------------------------------------
insert into public.audit_log (
  id, event_type, level, actor_id, actor_name, school_id, subject_type,
  subject_id, detail, created_at
)
select
  ('c1000001-0000-4000-8000-' || lpad(row_number() over (order by m.code)::text, 12, '0'))::uuid,
  'material.published',
  'info',
  '00000000-0000-0000-0000-000000000101',
  'Super Lumen',
  null,
  'material',
  m.id,
  jsonb_build_object('code', m.code, 'title', m.title),
  coalesce(m.published_at, m.updated_at)
from public.materials m
where m.status = 'published'
  and not exists (
    select 1 from public.audit_log a
    where a.subject_id = m.id and a.event_type = 'material.published'
  );

insert into public.audit_log (
  id, event_type, level, actor_id, actor_name, school_id, subject_type,
  subject_id, detail, created_at
)
select
  ('c2000001-0000-4000-8000-' || lpad(row_number() over (order by m.code, s.name)::text, 12, '0'))::uuid,
  'school.access_revoked',
  'warning',
  '00000000-0000-0000-0000-000000000101',
  'Super Lumen',
  s.id,
  'material',
  m.id,
  jsonb_build_object('code', m.code, 'school', s.name),
  '2026-11-05T10:20:00+00:00'
from public.materials m
join public.material_schools ms on ms.material_id = m.id
join public.schools s on s.id = ms.school_id
where m.status = 'archived'
  and not exists (
    select 1 from public.audit_log a
    where a.subject_id = m.id and a.event_type = 'school.access_revoked'
  );
