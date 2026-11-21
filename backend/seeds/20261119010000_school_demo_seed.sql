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
  ('a1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Lengua Castellana', 'Lenguaje', '2026-01-05T08:00:00+00:00'),
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
-- The grades of the current period
--
-- One score per student and course subject, so the panel has an
-- average to show and the student view is not empty. The scores are on
-- the Colombian scale: from 0 to 5.
-- ---------------------------------------------------------------------------
with enrolled as (
  select
    se.student_id,
    se.course_id,
    row_number() over (order by se.id) as n
  from public.student_enrollments se
  where se.school_id = 'c0000000-0000-4000-8000-000000000001'
),
subjects_of_course as (
  select
    cs.id as course_subject_id,
    cs.course_id,
    row_number() over (partition by cs.course_id order by cs.id) as k
  from public.course_subjects cs
  where cs.school_id = 'c0000000-0000-4000-8000-000000000001'
)
insert into public.grades (
  id, school_id, course_subject_id, student_id, academic_period_id, score, created_at
)
select
  ('f1000000-0000-4000-8000-' || lpad((e.n * 100 + s.k)::text, 12, '0'))::uuid,
  'c0000000-0000-4000-8000-000000000001',
  s.course_subject_id,
  e.student_id,
  'a3000000-0000-4000-8000-000000000003',
  (3.0 + ((e.n + s.k * 7) % 21) / 10.0)::numeric(4,2),
  '2026-08-01T08:00:00+00:00'
from enrolled e
join subjects_of_course s on s.course_id = e.course_id
on conflict do nothing;

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
--
-- The short code of a piece is unique in the network: the numbering
-- belongs to the editorial team. The demonstration catalog takes the
-- numbering that is free, so the demo data of two branches can live in
-- the same database without a piece wearing the code of another one.
-- ---------------------------------------------------------------------------
with base as (
  select count(*)::int as taken from public.materials
)
insert into public.materials (
  id, ref, title, description, area, kind, storage_path, file_name, file_size_bytes,
  state, published_at, created_at, updated_at
)
select
  ('a5000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'C-' || (1040 + n + base.taken)::text,
  (array[
    'Guide de álgebra para 7°', 'Lecturas de comprensión lectora', 'Cuaderno de laboratorio de ciencias',
    'Rutas de la historia de Colombia', 'English practice workbook', 'Álgebra: stepwise exercises',
    'Atlas de biología', 'Ensayos de historia universal', 'Grammar in use',
    'Problemas de aritmética', 'Ecología y su entorno', 'Taller de lectura crítica',
    'Serie numérica: guía de problemas', 'Biología celular: guía', 'Listening comprehension 8°',
    'Álgebra 9°: Preparation'
  ])[n],
  'Material del catálogo editorial de Lumen.',
  (array['Matemáticas', 'Lenguaje', 'Ciencias', 'Sociales', 'Inglés'])[((n - 1) % 5) + 1],
  (array['pdf', 'pdf', 'docx', 'pdf', 'epub', 'zip'])[((n - 1) % 6) + 1],
  'materials/' || (1040 + n + base.taken)::text,
  'material-' || (1040 + n + base.taken)::text,
  1000000 + n * 1000,
  'publicado',
  '2026-01-20T08:00:00+00:00',
  '2026-01-18T08:00:00+00:00',
  '2026-01-20T08:00:00+00:00'
from generate_series(1, 16) as n, base
on conflict do nothing;

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

-- ---------------------------------------------------------------------------
-- The catalog of simulators
--
-- Four simulators of the platform team. Three of them were corrected,
-- and the fourth is published and waiting: that is the one the school
-- can still activate.
--
-- The `simulation_id` points to the exam the students take, so the
-- results of the panel are the ones of a real run.
-- ---------------------------------------------------------------------------
insert into public.icfes_simulators (
  id, code, name, grade, question_count, duration_min, scheduled_at, status,
  average_score, simulation_id, created_at, updated_at
) values
  ('a9000000-0000-4000-8000-000000000001', 'SIM-2026-2-S7',
   'Simulacro 7° — Saber 11 y 3-5-9 (2026-2)', '7°', 32, 120, '2026-09-14',
   'cerrado', 312.00, 'a4000000-0000-4000-8000-000000000001',
   '2026-08-20T08:00:00+00:00', '2026-09-14T08:00:00+00:00'),
  ('a9000000-0000-4000-8000-000000000002', 'SIM-2026-2-S9',
   'Simulacro 9° — Saber 11 y 3-5-9 (2026-2)', '9°', 28, 120, '2026-09-08',
   'cerrado', 341.00, 'a4000000-0000-4000-8000-000000000002',
   '2026-08-20T08:00:00+00:00', '2026-09-08T08:00:00+00:00'),
  ('a9000000-0000-4000-8000-000000000003', 'SIM-2026-1-S8',
   'Simulacro 8° — Diagnóstico (2026-1)', '8°', 35, 120, '2026-04-11',
   'cerrado', 298.00, 'a4000000-0000-4000-8000-000000000003',
   '2026-02-10T08:00:00+00:00', '2026-04-11T08:00:00+00:00'),
  ('a9000000-0000-4000-8000-000000000004', 'SIM-2026-2-S11',
   'Simulacro 11° — Saber 11 (2026-2)', '11°', 45, 120, '2026-11-26',
   'publicado', null, null,
   '2026-09-01T08:00:00+00:00', '2026-09-01T08:00:00+00:00')
on conflict (id) do nothing;

-- The platform team enabled the four of them for the demonstration
-- school. The school cannot enable or disable a simulator.
insert into public.icfes_simulator_schools (
  id, simulator_id, school_id, enabled_at, enabled_by
)
select
  ('aa000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('a9000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'c0000000-0000-4000-8000-000000000001',
  '2026-08-20T08:00:00+00:00',
  'c0000000-0000-4000-8000-0000000000a1'
from generate_series(1, 4) as n
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- What the school did with them
--
-- The school activated three of them, one course each. The fourth one
-- is published and waits: that is the one the panel offers to activate.
-- ---------------------------------------------------------------------------
insert into public.icfes_activations (
  id, school_id, simulator_id, course_id, deadline, activated_at
) values
  ('ab000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'a9000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
   '2026-09-14', '2026-08-25T08:00:00+00:00'),
  ('ab000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'a9000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000004',
   '2026-09-08', '2026-08-25T08:00:00+00:00'),
  ('ab000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'a9000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003',
   '2026-04-11', '2026-02-12T08:00:00+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The runs of the exams
--
-- The students of the course took the simulation of their grade. The
-- score is on the 0-500 scale of the exam.
-- ---------------------------------------------------------------------------
with runs as (
  select
    se.student_id,
    sim.simulation_id,
    sim.scheduled_at,
    row_number() over (partition by sim.simulation_id order by se.student_id) as n
  from public.student_enrollments se
  join (
    values
      ('f0000000-0000-4000-8000-000000000001'::uuid, 'a4000000-0000-4000-8000-000000000001'::uuid, '2026-09-14'::date),
      ('f0000000-0000-4000-8000-000000000004'::uuid, 'a4000000-0000-4000-8000-000000000002'::uuid, '2026-09-08'::date),
      ('f0000000-0000-4000-8000-000000000003'::uuid, 'a4000000-0000-4000-8000-000000000003'::uuid, '2026-04-11'::date)
  ) as sim(course_id, simulation_id, scheduled_at) on sim.course_id = se.course_id
  where se.school_id = 'c0000000-0000-4000-8000-000000000001'
    and se.status = 'active'
), scored as (
  select
    ('ae000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
    student_id,
    simulation_id,
    scheduled_at,
    (260 + ((n * 7) % 100))::numeric(6,2) as global_score
  from runs
)
insert into public.icfes_attempts (
  id, school_id, simulation_id, student_id, status, started_at, submitted_at,
  graded_at, global_score, max_score, percent, created_at, updated_at
)
select
  id,
  'c0000000-0000-4000-8000-000000000001',
  simulation_id,
  student_id,
  'graded',
  scheduled_at::timestamptz + interval '8 hours',
  scheduled_at::timestamptz + interval '10 hours',
  scheduled_at::timestamptz + interval '11 hours',
  global_score,
  500,
  (global_score / 5.0)::numeric(5,2),
  scheduled_at::timestamptz,
  scheduled_at::timestamptz
from scored
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The requests of the school to the support team
--
-- Three of them: one open, one waiting for the platform team and one
-- already resolved. The thread of each one is in the same order it
-- was written.
--
-- The code of a case is unique in the network: the numbering belongs
-- to the support team. These three start where the numbering of the
-- other branch ends, so both sets of demo data can live in the same
-- database without a case wearing the code of another one.
-- ---------------------------------------------------------------------------
insert into public.support_cases (
  id, school_id, code, title, category, channel, level, status, opened_by,
  opened_at, resolved_at
) values
  ('ac000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'SOL-1043', 'Los docentes no ven el material de ciencias', 'problema_tecnico',
   'formulario_colegio', 'aviso', 'abierto', 'c0000000-0000-4000-8000-0000000000a1',
   '2026-11-14T09:15:00+00:00', null),
  ('ac000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'SOL-1044', 'Solicitud de material de lectura para 9°', 'solicitud_material',
   'correo', 'info', 'en_espera', 'c0000000-0000-4000-8000-0000000000a1',
   '2026-11-13T16:20:00+00:00', null),
  ('ac000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'SOL-1045', 'Restablecimiento de contraseña de la administradora', 'duda_acceso',
   'formulario_colegio', 'info', 'resuelto', 'c0000000-0000-4000-8000-0000000000a1',
   '2026-11-10T10:02:00+00:00', '2026-11-10T10:48:00+00:00')
on conflict do nothing;

-- The thread of each case: the school writes, the platform team
-- answers in the same thread.
--
-- The messages only go in when their case is there: the code of a case
-- is unique in the network, and a case that another seed already owns
-- with that code is not a case of this school.
insert into public.support_messages (
  id, case_id, author_id, author_role, body, created_at
)
select
  v.id, v.case_id, v.author_id, v.author_role, v.body, v.created_at
from (values
  ('ad000000-0000-4000-8000-000000000001'::uuid,
   'ac000000-0000-4000-8000-000000000001'::uuid,
   'c0000000-0000-4000-8000-0000000000a1'::uuid,
   'colegio'::text,
   'Varios docentes del curso 7° A no ven el material de ciencias en su biblioteca. '
   || '¿Deben habilitar algo o es un error?',
   '2026-11-14T09:15:00+00:00'::timestamptz),
  ('ad000000-0000-4000-8000-000000000002'::uuid,
   'ac000000-0000-4000-8000-000000000001'::uuid,
   null::uuid,
   'plataforma'::text,
   'Revisamos el acceso del material de ciencias para su colegio. Apenas confirmemos '
   || 'te escribimos aquí mismo.',
   '2026-11-14T10:02:00+00:00'::timestamptz),
  ('ad000000-0000-4000-8000-000000000003'::uuid,
   'ac000000-0000-4000-8000-000000000002'::uuid,
   'c0000000-0000-4000-8000-0000000000a1'::uuid,
   'colegio'::text,
   'Nos gustaría una obra de lectura en español para 9° A. ¿Podrían habilitarla para el colegio?',
   '2026-11-13T16:20:00+00:00'::timestamptz),
  ('ad000000-0000-4000-8000-000000000004'::uuid,
   'ac000000-0000-4000-8000-000000000002'::uuid,
   null::uuid,
   'plataforma'::text,
   'Ya está en el catálogo. Confírmennos si además la quieren para 10° y la habilitamos '
   || 'para ambos cursos.',
   '2026-11-13T17:05:00+00:00'::timestamptz),
  ('ad000000-0000-4000-8000-000000000005'::uuid,
   'ac000000-0000-4000-8000-000000000003'::uuid,
   'c0000000-0000-4000-8000-0000000000a1'::uuid,
   'colegio'::text,
   'La administradora principal no logra entrar con su correo institucional.',
   '2026-11-10T10:02:00+00:00'::timestamptz),
  ('ad000000-0000-4000-8000-000000000006'::uuid,
   'ac000000-0000-4000-8000-000000000003'::uuid,
   null::uuid,
   'plataforma'::text,
   'Enviamos una clave temporal al correo institucional de la administradora principal.',
   '2026-11-10T10:48:00+00:00'::timestamptz)
) as v(id, case_id, author_id, author_role, body, created_at)
where exists (
  select 1 from public.support_cases c where c.id = v.case_id
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- The plan of the demonstration school
--
-- The school is on the Premium plan: it has the ICFES module enabled, and
-- the panel shows the simulators of the college. The plan belongs to the
-- platform team: the administrator only reads it.
-- ---------------------------------------------------------------------------
insert into public.subscriptions (
  id, school_id, plan_id, status, interval, customer_email, started_at,
  current_period_start, current_period_end, created_at, updated_at
)
select
  'af000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  p.id,
  'active',
  'monthly',
  'ana.restrepo@sagcor.edu.co',
  '2026-01-10T08:00:00+00:00',
  '2026-01-10T08:00:00+00:00',
  '2027-01-10T08:00:00+00:00',
  '2026-01-10T08:00:00+00:00',
  '2026-01-10T08:00:00+00:00'
from public.plans p
where p.code = 'premium'
on conflict (id) do nothing;

-- The limits of the plan, copied into the entitlement the panel reads.
insert into public.entitlements (
  school_id, plan_code, plan_name, max_students, max_teachers, max_storage_gb,
  includes_icfes, subscription_id, status, current_period_end, updated_at
)
select
  s.school_id,
  p.code,
  p.name,
  p.max_students,
  p.max_teachers,
  p.max_storage_gb,
  p.includes_icfes,
  s.id,
  s.status,
  s.current_period_end,
  now()
from public.subscriptions s
join public.plans p on p.id = s.plan_id
where s.school_id = 'c0000000-0000-4000-8000-000000000001'
on conflict (school_id) do nothing;
