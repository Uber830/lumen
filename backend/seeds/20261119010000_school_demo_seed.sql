-- =========================================================================
-- The seed of the school administrator's demonstration school.
-- -------------------------------------------------------------------------
-- A school with a full academic structure, so that the panel of the
-- administrator has something real to show:
--
--   1 school        Colegio Sagrado Corazón
--   2 administrators  one principal and one secondary
--   12 teachers
--   184 students
--   5 courses       7° A, 7° B, 8° A, 9° A, 9° B
--   5 subjects      Matemáticas, Lengua, Ciencias, Historia, Inglés
--   5 assignments   a teacher, a course and a subject
--   3 periods       1st, 2nd and 3rd trimester of 2026
--   3 ICFES simulations
--   16 materials    7 of them enabled for the school
--
-- The seed is idempotent: running it twice leaves the same database.
--
-- The accounts use the development password ("lumen-dev"), like the
-- rest of the development data.
-- =========================================================================

\set dev_password_hash '$argon2id$v=19$m=65536,t=3,p=4$wtOvcQICBBqWwbf4NyIw5g$CAjBXJJ+6PFlxgNt/MRqGeIScWbtzwmVuOPC5Ant7V4'

-- ---------------------------------------------------------------------------
-- The school
--
-- The primary colour is a hex: the backend checks the contrast of that
-- colour against the background of the panel before it is saved.
-- ---------------------------------------------------------------------------
insert into public.schools (
  id, name, short_code, status, display_name, primary_color, created_at, updated_at
) values
  ('c0000000-0000-4000-8000-000000000001', 'Colegio Sagrado Corazón', 'SAGCOR',
   'active', 'Colegio Sagrado Corazón', '#2E8FFF',
   '2026-01-05T08:00:00+00:00', '2026-01-05T08:00:00+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The administrators of the school
--
-- The principal runs the school; the secondary helps. The rank is what
-- decides the permissions the API returns.
-- ---------------------------------------------------------------------------
insert into public.users (id, email, password_hash, full_name, email_verified, created_at) values
  ('c0000000-0000-4000-8000-0000000000a1', 'ana.restrepo@sagcor.edu.co',
   :'dev_password_hash', 'Ana Restrepo', true, '2026-01-05T08:00:00+00:00'),
  ('c0000000-0000-4000-8000-0000000000a2', 'carlos.mendoza@sagcor.edu.co',
   :'dev_password_hash', 'Carlos Mendoza', true, '2026-01-05T08:00:00+00:00')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, given_name, family_name, phone, created_at) values
  ('c0000000-0000-4000-8000-0000000000a1', 'Ana Restrepo', 'Ana', 'Restrepo',
   '+57 300 555 0101', '2026-01-05T08:00:00+00:00'),
  ('c0000000-0000-4000-8000-0000000000a2', 'Carlos Mendoza', 'Carlos', 'Mendoza',
   '+57 300 555 0102', '2026-01-05T08:00:00+00:00')
on conflict (id) do nothing;

insert into public.school_memberships (
  id, school_id, user_id, role, admin_role, is_primary, joined_at, invited_by, invited_at, created_at
) values
  ('c0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-0000000000a1', 'school_admin', 'principal', true,
   '2026-01-05T08:00:00+00:00', null, '2026-01-05T08:00:00+00:00', '2026-01-05T08:00:00+00:00'),
  ('c0000000-0000-4000-8000-0000000000b2', 'c0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-0000000000a2', 'school_admin', 'secundario', true,
   '2026-01-05T08:00:00+00:00', 'c0000000-0000-4000-8000-0000000000a1',
   '2026-01-05T08:00:00+00:00', '2026-01-05T08:00:00+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The preferences of the school
-- ---------------------------------------------------------------------------
insert into public.school_settings (
  school_id, notify_new_material, notify_period_reminders, notify_channel,
  enrollment_open, enrollment_notes, created_at, updated_at
) values
  ('c0000000-0000-4000-8000-000000000001', true, true, 'inapp', true,
   'La matrícula del segundo trimestre abre el 15 de enero.', '2026-01-05T08:00:00+00:00',
   '2026-01-05T08:00:00+00:00')
on conflict (school_id) do nothing;

-- ---------------------------------------------------------------------------
-- The teachers
--
-- The names come from a small list, repeated with the number of the
-- teacher, so that the list of the school looks like a real one.
-- ---------------------------------------------------------------------------
insert into public.users (id, email, password_hash, full_name, email_verified, created_at)
select
  ('d0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'docente' || lpad(n::text, 2, '0') || '@sagcor.edu.co',
  :'dev_password_hash',
  (array[
    'Lucía Fernández', 'Andrés Quintero', 'Marcela Ríos', 'Javier Ospina',
    'Patricia Londoño', 'Sebastián Vega', 'Carolina Salas', 'Andrés Peláez',
    'Verónica Ortiz', 'Mauricio Escobar', 'Diana Cabrera', 'Felipe Arango'
  ])[((n - 1) % 12) + 1] || ' #' || n,
  true,
  '2026-01-10T08:00:00+00:00'
from generate_series(1, 12) as n
on conflict (id) do nothing;

insert into public.school_memberships (
  id, school_id, user_id, role, admin_role, is_primary, joined_at, created_at
)
select
  ('d1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'c0000000-0000-4000-8000-000000000001',
  ('d0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'teacher',
  null,
  false,
  '2026-01-10T08:00:00+00:00',
  '2026-01-10T08:00:00+00:00'
from generate_series(1, 12) as n
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The students
-- ---------------------------------------------------------------------------
insert into public.users (id, email, password_hash, full_name, email_verified, created_at)
select
  ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'estudiante' || lpad(n::text, 3, '0') || '@sagcor.edu.co',
  :'dev_password_hash',
  (array[
    'Mateo Acosta', 'Isabella Ruiz', 'Santiago Torres', 'Valentina Gómez',
    'Samuel Ramírez', 'Mariana Jansen', 'Tomás Herrera', 'Isabel Moreno'
  ])[((n - 1) % 8) + 1] || ' #' || n,
  true,
  '2026-01-15T08:00:00+00:00'
from generate_series(1, 184) as n
on conflict (id) do nothing;

insert into public.school_memberships (
  id, school_id, user_id, role, admin_role, is_primary, joined_at, created_at
)
select
  ('e1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'c0000000-0000-4000-8000-000000000001',
  ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'student',
  null,
  false,
  '2026-01-15T08:00:00+00:00',
  '2026-01-15T08:00:00+00:00'
from generate_series(1, 184) as n
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The courses
-- ---------------------------------------------------------------------------
insert into public.courses (id, school_id, name, grade_label, created_at) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '7° A', '7°', '2026-01-05T08:00:00+00:00'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', '7° B', '7°', '2026-01-05T08:00:00+00:00'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', '8° A', '8°', '2026-01-05T08:00:00+00:00'),
  ('f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', '9° A', '9°', '2026-01-05T08:00:00+00:00'),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', '9° B', '9°', '2026-01-05T08:00:00+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The subjects
-- ---------------------------------------------------------------------------
insert into public.subjects (id, school_id, name, area, created_at) values
  ('a1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Matemáticas', 'Matemáticas', '2026-01-05T08:00:00+00:00'),
  ('a1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Lengua Castellana', 'Lengua', '2026-01-05T08:00:00+00:00'),
  ('a1000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Ciencias Naturales', 'Ciencias', '2026-01-05T08:00:00+00:00'),
  ('a1000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Historia', 'Sociales', '2026-01-05T08:00:00+00:00'),
  ('a1000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'Inglés', 'Inglés', '2026-01-05T08:00:00+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The subjects each course offers
--
-- Every course offers the five subjects: 25 rows.
-- ---------------------------------------------------------------------------
insert into public.course_subjects (id, school_id, course_id, subject_id, created_at)
select
  ('b1000000-0000-4000-8000-' || lpad((course_n * 100 + subject_n)::text, 12, '0'))::uuid,
  'c0000000-0000-4000-8000-000000000001',
  ('f0000000-0000-4000-8000-' || lpad(course_n::text, 12, '0'))::uuid,
  ('a1000000-0000-4000-8000-' || lpad(subject_n::text, 12, '0'))::uuid,
  '2026-01-05T08:00:00+00:00'
from generate_series(1, 5) as course_n
cross join generate_series(1, 5) as subject_n
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The assignments
--
-- Each one links a teacher with a course and a subject. The
-- assignment is what gives a teacher access to the material of that
-- course.
-- ---------------------------------------------------------------------------
insert into public.teacher_assignments (
  id, school_id, course_subject_id, teacher_id, assigned_at, created_at
) values
  ('a2000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000101', 'd0000000-0000-4000-8000-000000000001',
   '2026-01-12T08:00:00+00:00', '2026-01-12T08:00:00+00:00'),
  ('a2000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000002',
   '2026-01-12T08:00:00+00:00', '2026-01-12T08:00:00+00:00'),
  ('a2000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000302', 'd0000000-0000-4000-8000-000000000003',
   '2026-01-12T08:00:00+00:00', '2026-01-12T08:00:00+00:00'),
  ('a2000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000403', 'd0000000-0000-4000-8000-000000000004',
   '2026-01-12T08:00:00+00:00', '2026-01-12T08:00:00+00:00'),
  ('a2000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000504', 'd0000000-0000-4000-8000-000000000005',
   '2026-01-12T08:00:00+00:00', '2026-01-12T08:00:00+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The enrollments of the students
--
-- The students are spread over the five courses.
-- ---------------------------------------------------------------------------
insert into public.student_enrollments (
  id, school_id, course_id, student_id, status, enrolled_at, created_at
)
select
  ('e2000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'c0000000-0000-4000-8000-000000000001',
  ('f0000000-0000-4000-8000-' || lpad((((n - 1) % 5) + 1)::text, 12, '0'))::uuid,
  ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'active',
  '2026-01-15T08:00:00+00:00',
  '2026-01-15T08:00:00+00:00'
from generate_series(1, 184) as n
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The academic periods
--
-- The third trimester of 2026 is the current one.
-- ---------------------------------------------------------------------------
insert into public.academic_periods (
  id, school_id, name, modality, start_date, end_date, is_current, delivery_modality, created_at
) values
  ('a3000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '1er Trimestre 2026', 'trimestre', '2026-01-05', '2026-03-31', false, 'presencial',
   '2026-01-05T08:00:00+00:00'),
  ('a3000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '2do Trimestre 2026', 'trimestre', '2026-04-01', '2026-06-30', false, 'hibrida',
   '2026-01-05T08:00:00+00:00'),
  ('a3000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   '3er Trimestre 2026', 'trimestre', '2026-07-01', '2026-09-30', true, 'presencial',
   '2026-01-05T08:00:00+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The simulations of the school
--
-- Three of them: one closed, one in correction and one scheduled.
-- ---------------------------------------------------------------------------
insert into public.icfes_simulations (
  id, school_id, course_subject_id, posted_by, title, description, duration_minutes,
  available_from, available_until, is_published, status, average_score, created_at
) values
  ('a4000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000102',
   'c0000000-0000-4000-8000-0000000000a1',
   'Simulacro ICFES 7° — Matemáticas', 'Sesión de práctica del primer trimestre.', 120,
   '2026-02-01', '2026-03-15', true, 'cerrado', 312.00, '2026-01-20T08:00:00+00:00'),
  ('a4000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000203',
   'c0000000-0000-4000-8000-0000000000a1',
   'Simulacro ICFES 9° — Matemáticas', 'Sesión de práctica del segundo trimestre.', 120,
   '2026-05-01', '2026-06-15', true, 'en_correccion', null, '2026-01-20T08:00:00+00:00'),
  ('a4000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000403',
   'c0000000-0000-4000-8000-0000000000a1',
   'Simulacro ICFES 8° — Lectura crítica', 'Sesión de práctica del tercer trimestre.', 120,
   '2026-08-01', '2026-09-15', true, 'programado', null, '2026-01-20T08:00:00+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The editorial catalog
--
-- Sixteen pieces of material, of which seven are enabled for the
-- demonstration school. The material is uploaded by the platform
-- team: the school never writes here.
-- ---------------------------------------------------------------------------
insert into public.materials (
  id, ref, title, description, area, kind, storage_path, file_name, file_size_bytes,
  state, published_at, created_at, updated_at
)
select
  ('a5000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'C-' || (1040 + n)::text,
  (array[
    'Guide de álgebra para 7°', 'Lecturas de comprensión lectora', 'Cuaderno de laboratorio de ciencias',
    'Rutas de la historia de Colombia', 'English practice workbook', 'Álgebra: stepwise exercises',
    'Atlas de biología', 'Ensayos de historia universal', 'Grammar in use',
    'Problemas de aritmética', 'Ecología y su entorno', 'Taller de lectura crítica',
    'Serie numérica: guía de problemas', 'Biología celular: guía', 'Listening comprehension 8°',
    'Álgebra 9°: Preparation'
  ])[n],
  'Material del catálogo editorial de Lumen.',
  (array['Matemáticas', 'Lengua', 'Ciencias', 'Sociales', 'Inglés'])[((n - 1) % 5) + 1],
  (array['pdf', 'pdf', 'docx', 'pdf', 'epub', 'zip'])[((n - 1) % 6) + 1],
  'materials/' || (1040 + n)::text,
  'material-' || (1040 + n)::text,
  1000000 + n * 1000,
  'publicado',
  '2026-01-20T08:00:00+00:00',
  '2026-01-18T08:00:00+00:00',
  '2026-01-20T08:00:00+00:00'
from generate_series(1, 16) as n
on conflict (id) do nothing;

-- Seven of them are enabled for the demonstration school.
insert into public.material_schools (
  id, material_id, school_id, enabled, enabled_at
)
select
  ('a6000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('a5000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'c0000000-0000-4000-8000-000000000001',
  true,
  '2026-01-20T08:00:00+00:00'
from generate_series(1, 7) as n
on conflict (id) do nothing;

-- The first two pieces apply to the courses of 7°; the rest apply to
-- the whole school.
insert into public.material_courses (id, material_id, course_id)
select
  ('a7000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('a5000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('f0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(1, 2) as n
on conflict (id) do nothing;
