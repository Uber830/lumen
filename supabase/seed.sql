-- =========================================================================
-- The seed data of a development database.
-- -------------------------------------------------------------------------
-- This mirrors the data of the Supabase project, so a local database
-- behaves like the real one: the same schools, the same plans, the same
-- users and memberships.
--
-- The password hashes are NOT copied. The development accounts use a
-- known password ("lumen-dev") so they can be signed in without
-- hunting for credentials. The Argon2id hash below is that password.
--
-- Apply it with `scripts/dev-db.sh up`, or by hand:
--   psql "$DATABASE_URL" -f supabase/seed.sql
-- =========================================================================

-- The Argon2id hash of "lumen-dev".
\set dev_password_hash '$argon2id$v=19$m=65536,t=3,p=4$wtOvcQICBBqWwbf4NyIw5g$CAjBXJJ+6PFlxgNt/MRqGeIScWbtzwmVuOPC5Ant7V4'

-- ---------------------------------------------------------------------------
-- The plan catalog
--
-- The schema migration already seeds it. This only makes sure the
-- prices and the limits are the current ones.
-- ---------------------------------------------------------------------------
insert into public.plans (
  id, code, name, description, price_cents, currency, interval,
  max_students, max_teachers, max_storage_gb, includes_icfes, is_active
) values
  ('5d7cb672-da17-43cb-9065-2ca5a9f3d2dd', 'basico', 'Basico',
   'Para colegios pequenos que empiezan a digitalizarse.',
   49000, 'COP', 'monthly', 200, 15, 10, false, true),
  ('6cc3f56f-2b42-44a3-aedd-b4d1f69193a3', 'estandar', 'Estandar',
   'El plan mas elegido por instituciones en crecimiento.',
   129000, 'COP', 'monthly', 1500, null, 100, true, true),
  ('4b6abe71-8c02-463c-abf7-09b51036d507', 'premium', 'Premium',
   'Para redes educativas con multiples sedes.',
   299000, 'COP', 'monthly', null, null, 1024, true, true)
on conflict (code) do update
  set id = excluded.id,
      name = excluded.name,
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

-- ---------------------------------------------------------------------------
-- The schools
-- ---------------------------------------------------------------------------
insert into public.schools (id, name, short_code, status, created_at) values
  ('00000000-0000-0000-0000-000000000001', 'Shared ICFES Bank', 'shared-bank',
   'active', '2026-10-20T04:26:28.305905+00:00'),
  ('168aa116-36d1-4524-a6cf-bf130e03138e', 'Colegio San Martin', 'COLEGIO-SAN-MART',
   'trial', '2026-10-20T15:38:52.782089+00:00'),
  ('bd27f21b-72be-4b22-bf32-3da070985cac', 'Colegio San Juan', 'COLEGIO-SAN-JUAN',
   'trial', '2026-10-20T15:50:13.553762+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The users
--
-- The real project has eight accounts that came from Supabase Auth. They
-- keep their bcrypt hashes there, so their passwords still work. Here
-- they all use the known development password.
-- ---------------------------------------------------------------------------
insert into public.users (id, email, password_hash, full_name, email_verified, created_at) values
  ('a44bf071-eb84-4908-80ad-f29b2cbed3a6', 'admin@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('fdc8aab8-58b4-4d5d-adef-86a02bd6e446', 'admin1@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('8cfa9f34-3bd0-4d69-9a30-254a277bb907', 'admin2@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('bfc1e842-a6fc-4cb4-a37e-43903457761a', 'admin3@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('300bd3b7-7b8d-437f-bab2-09e92be25559', 'admin4@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('4c900db5-671d-4d8d-ac98-a712cf03dbde', 'admin5@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('8add5b62-71f0-4fd2-853f-f63b334a500d', 'admin6@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('fa624505-d51f-45c4-9abe-8768c9992075', 'uber@edu.com',
   :'dev_password_hash', 'Uber Cardoso', true, '2026-10-20T15:50:13.553762+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The profiles
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, locale) values
  ('a44bf071-eb84-4908-80ad-f29b2cbed3a6', 'Ricardo Lema', 'es-CO'),
  ('fdc8aab8-58b4-4d5d-adef-86a02bd6e446', 'Ricardo Lema', 'es-CO'),
  ('8cfa9f34-3bd0-4d69-9a30-254a277bb907', 'Ricardo Lema', 'es-CO'),
  ('bfc1e842-a6fc-4cb4-a37e-43903457761a', 'Ricardo Lema', 'es-CO'),
  ('300bd3b7-7b8d-437f-bab2-09e92be25559', 'Ricardo Lema', 'es-CO'),
  ('4c900db5-671d-4d8d-ac98-a712cf03dbde', 'Ricardo Lema', 'es-CO'),
  ('8add5b62-71f0-4fd2-853f-f63b334a500d', 'Ricardo Lema', 'es-CO'),
  ('fa624505-d51f-45c4-9abe-8768c9992075', 'Uber Cardoso', 'es-CO')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The memberships
-- ---------------------------------------------------------------------------
insert into public.school_memberships (
  id, school_id, user_id, role, is_primary, joined_at
) values
  ('e2abb3cc-d241-449d-a3fd-b93c4ab8be74',
   '168aa116-36d1-4524-a6cf-bf130e03138e',
   '8add5b62-71f0-4fd2-853f-f63b334a500d',
   'school_admin', true, '2026-10-20T15:38:52.782089+00:00'),
  ('b1163b8d-4be3-4295-a765-935c89abf872',
   'bd27f21b-72be-4b22-bf32-3da070985cac',
   'fa624505-d51f-45c4-9abe-8768c9992075',
   'school_admin', true, '2026-10-20T15:50:13.553762+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The academic structure of the shared bank
-- ---------------------------------------------------------------------------
insert into public.courses (id, school_id, name, grade_label, created_at) values
  ('00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'Shared Course', 'Demo', '2026-10-20T04:26:28.305905+00:00')
on conflict (id) do nothing;

insert into public.subjects (id, school_id, name, area, created_at) values
  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   'Demo Subject', null, '2026-10-20T04:26:28.305905+00:00')
on conflict (id) do nothing;

insert into public.course_subjects (
  id, school_id, course_id, subject_id, created_at
) values
  ('00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000011',
   '2026-10-20T04:26:28.305905+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The accounts of the three roles that drive Lumen
--
-- The data inherited from EduSuite only had school admins. Lumen needs a
-- super admin (the one who uploads the platform content), a teacher and a
-- student, because those are the three roles the content module connects.
--
-- All three use the same development password as the rest of the seed.
--
--   super@lumen.co       super admin de plataforma
--   docente@lumen.co     docente del colegio compartido
--   estudiante@lumen.co  estudiante del colegio compartido
-- ---------------------------------------------------------------------------
insert into public.users (id, email, password_hash, full_name, email_verified, created_at) values
  ('00000000-0000-0000-0000-000000000101', 'super@lumen.co',
   :'dev_password_hash', 'Super Lumen', true, '2026-10-20T04:26:28.305905+00:00'),
  ('00000000-0000-0000-0000-000000000102', 'docente@lumen.co',
   :'dev_password_hash', 'Docente Lumen', true, '2026-10-20T04:26:28.305905+00:00'),
  ('00000000-0000-0000-0000-000000000103', 'estudiante@lumen.co',
   :'dev_password_hash', 'Estudiante Lumen', true, '2026-10-20T04:26:28.305905+00:00')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, locale) values
  ('00000000-0000-0000-0000-000000000101', 'Super Lumen', 'es-CO'),
  ('00000000-0000-0000-0000-000000000102', 'Docente Lumen', 'es-CO'),
  ('00000000-0000-0000-0000-000000000103', 'Estudiante Lumen', 'es-CO')
on conflict (id) do nothing;

-- The super admin is not a member of any school: the platform role is
-- what gives it access, and it spans every school.
insert into public.platform_roles (user_id, role, granted_at) values
  ('00000000-0000-0000-0000-000000000101', 'platform_admin',
   '2026-10-20T04:26:28.305905+00:00')
on conflict (user_id) do nothing;

insert into public.school_memberships (
  id, school_id, user_id, role, is_primary, joined_at
) values
  ('00000000-0000-0000-0000-000000000130',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000102',
   'teacher', true, '2026-10-20T04:26:28.305905+00:00'),
  ('00000000-0000-0000-0000-000000000131',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000103',
   'student', true, '2026-10-20T04:26:28.305905+00:00')
on conflict (id) do nothing;

-- The teacher is assigned to the shared course subject and the student
-- is enrolled in its course. Those two rows are what let them read the
-- material of the subject.
insert into public.teacher_assignments (
  id, school_id, course_subject_id, teacher_id, assigned_at
) values
  ('00000000-0000-0000-0000-000000000140',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000102',
   '2026-10-20T04:26:28.305905+00:00')
on conflict (id) do nothing;

insert into public.student_enrollments (
  id, school_id, course_id, student_id, status, enrolled_at
) values
  ('00000000-0000-0000-0000-000000000150',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000103',
   'active', '2026-10-20T04:26:28.305905+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The public site
--
-- The copy of the landing and the editorial catalog. The platform team
-- edits the `site_content` row and the `catalog_items` table; the site
-- serves whatever is there.
--
-- The schools of the catalog are demonstration names: they are not the
-- tenants of this database, and publishing a client is an explicit
-- decision.
-- ---------------------------------------------------------------------------
insert into public.site_content (key, content) values
  ('landing', $json${
  "stats": [
    {
      "label": "Materiales",
      "value": "16"
    },
    {
      "label": "Colegios",
      "value": "24"
    },
    {
      "label": "Docentes",
      "value": "1.842"
    },
    {
      "label": "Estudiantes",
      "value": "28.960"
    }
  ],
  "contact_email": "hola@lumen.co",
  "nav": {
    "links": [
      {
        "id": "indice",
        "label": "Índice",
        "href": "#indice"
      },
      {
        "id": "proceso",
        "label": "Proceso",
        "href": "#proceso"
      },
      {
        "id": "roles",
        "label": "Roles",
        "href": "#roles"
      },
      {
        "id": "cobertura",
        "label": "Cobertura",
        "href": "#cobertura"
      },
      {
        "id": "preguntas",
        "label": "Preguntas",
        "href": "#preguntas"
      }
    ],
    "login_label": "Iniciar sesión",
    "contact_label": "Hablar con el equipo"
  },
  "hero": {
    "kicker": "IDX-001 / Catálogo editorial",
    "title_lead": "El material de la editorial,",
    "title_tail": "indexado por colegio.",
    "lead": "Lumen mantiene un solo catálogo de material y le asigna a cada colegio las piezas que le corresponden. La misma página que el equipo usa para cargar es la que el colegio ve para consumir.",
    "cta_primary": {
      "id": "proceso",
      "label": "Ver el proceso",
      "href": "#proceso",
      "variant": "solid"
    },
    "cta_secondary": {
      "id": "panel",
      "label": "Abrir el panel",
      "href": "/login",
      "variant": "outline"
    }
  },
  "catalog": {
    "kicker": "IDX-002 / Catálogo",
    "title": "Índice del catálogo",
    "lead": "Cada pieza se carga una vez y se habilita colegio por colegio.",
    "columns": [
      {
        "id": "ref",
        "label": "Ref."
      },
      {
        "id": "material",
        "label": "Material"
      },
      {
        "id": "area",
        "label": "Área"
      },
      {
        "id": "schools",
        "label": "Colegios con acceso"
      },
      {
        "id": "state",
        "label": "Estado"
      }
    ],
    "footer_prefix": "Mostrando",
    "footer_suffix": "entradas · filtro por colegio, área y estado"
  },
  "process": {
    "kicker": "IDX-003 / Proceso",
    "title": "Cómo llega el material al colegio",
    "steps": [
      {
        "number": "01",
        "title": "El colegio entrega su información",
        "body": "Grados, materias, matrícula y el material que ya tiene. Con eso se sabe qué necesita cada institución.",
        "owner": "Colegio"
      },
      {
        "number": "02",
        "title": "El equipo carga y habilita",
        "body": "Sube el material, completa los metadatos y marca los colegios con acceso. Cambiar ese acceso es un interruptor.",
        "owner": "Equipo Lumen"
      },
      {
        "number": "03",
        "title": "La comunidad lo usa",
        "body": "El material aparece en el curso del docente y en la biblioteca del estudiante, con versión y fecha.",
        "owner": "Docente · Estudiante"
      }
    ]
  },
  "roles": {
    "kicker": "IDX-004 / Roles",
    "title": "Quién usa Lumen y hasta dónde",
    "items": [
      {
        "id": "PLATAFORMA",
        "summary": "Carga, habilita y publica.",
        "detail": "Administra el catálogo editorial completo, la cobertura por colegio y el historial de cambios.",
        "scope": "Acceso total al catálogo"
      },
      {
        "id": "ADMIN COLEGIO",
        "summary": "Administra su comunidad.",
        "detail": "Docentes, estudiantes, cursos, períodos y asignaciones. Consulta el material habilitado para su institución.",
        "scope": "Solo lo de su colegio"
      },
      {
        "id": "DOCENTE",
        "summary": "Enseña con el material al día.",
        "detail": "Consulta y descarga el material de sus cursos, crea tareas y califica.",
        "scope": "Material de sus cursos"
      },
      {
        "id": "ESTUDIANTE",
        "summary": "Estudia en su biblioteca.",
        "detail": "Material, tareas, fechas de entrega y calificaciones del periodo.",
        "scope": "Material de su matrícula"
      }
    ]
  },
  "coverage": {
    "kicker": "IDX-005 / Cobertura",
    "title": "Cobertura por tamaño de colegio",
    "lead": "Cada tamaño de colegio recibe el catálogo que le corresponde. Sin precios: esto es lo que incluye cada nivel.",
    "rows": [
      {
        "id": "pequeno",
        "label": "PEQUEÑO",
        "size": "hasta 300",
        "items": [
          {
            "label": "Catálogo por grado y área",
            "included": true
          },
          {
            "label": "3 administradores",
            "included": true
          },
          {
            "label": "Carga incluida",
            "included": true
          },
          {
            "label": "Soporte por correo",
            "included": true
          },
          {
            "label": "Simulacros ICFES",
            "included": false
          },
          {
            "label": "Reportes de uso",
            "included": false
          }
        ]
      },
      {
        "id": "mediano",
        "label": "MEDIANO",
        "size": "300–1.000",
        "items": [
          {
            "label": "Catálogo editorial completo",
            "included": true
          },
          {
            "label": "10 administradores",
            "included": true
          },
          {
            "label": "Simulacros ICFES",
            "included": true
          },
          {
            "label": "Reportes de uso",
            "included": true
          },
          {
            "label": "Habilitación por grado",
            "included": true
          },
          {
            "label": "Material propio del colegio",
            "included": false
          }
        ]
      },
      {
        "id": "grande",
        "label": "GRANDE",
        "size": "+1.000",
        "items": [
          {
            "label": "Catálogo y material propio",
            "included": true
          },
          {
            "label": "Docentes sin límite",
            "included": true
          },
          {
            "label": "Multi-sede y plantillas propias",
            "included": true
          },
          {
            "label": "Acompañamiento dedicado 24/7",
            "included": false
          }
        ]
      }
    ]
  },
  "faq": {
    "kicker": "IDX-006 / Preguntas",
    "title": "Preguntas frecuentes",
    "items": [
      {
        "id": "Q-01",
        "question": "¿El colegio tiene que subir el material?",
        "answer": "No. El equipo editorial de Lumen carga el material y lo habilita. El colegio solo entrega su información y usa lo que queda disponible."
      },
      {
        "id": "Q-02",
        "question": "¿Qué pasa cuando un material cambia?",
        "answer": "El archivo se reemplaza en el catálogo y queda registrada la fecha y el responsable. Los docentes ven la versión nueva de inmediato."
      },
      {
        "id": "Q-03",
        "question": "¿Puede un colegio ver material que no le corresponde?",
        "answer": "No. El acceso se configura colegio por colegio y se puede quitar en cualquier momento."
      },
      {
        "id": "Q-04",
        "question": "¿Quién da soporte?",
        "answer": "El equipo de plataforma, que también carga el material. Puede habilitar una pieza o quitar un acceso desde el panel."
      }
    ]
  },
  "cta": {
    "kicker": "IDX-007 / Contacto",
    "title": "Veamos su colegio con el material ya cargado.",
    "body": "Preparamos una demostración con la información de su institución: sus cursos, su material y cómo quedaría la habilitación colegio por colegio.",
    "buttons": [
      {
        "id": "demo",
        "label": "Solicitar demostración",
        "href": "mailto:hola@lumen.co?subject=Solicitud%20de%20demostraci%C3%B3n",
        "variant": "accent"
      },
      {
        "id": "login",
        "label": "Iniciar sesión",
        "href": "/login",
        "variant": "outline"
      }
    ],
    "spec": [
      {
        "label": "TIEMPO",
        "value": "30 minutos"
      },
      {
        "label": "ENTREGABLE",
        "value": "Catálogo de ejemplo con su acceso"
      },
      {
        "label": "CONTACTO",
        "value": "hola@lumen.co"
      }
    ]
  },
  "footer": {
    "brand": "Lumen",
    "location": "LUMEN · BOGOTÁ, COLOMBIA",
    "columns": [
      {
        "title": "Producto",
        "links": [
          {
            "id": "indice",
            "label": "Índice",
            "href": "#indice"
          },
          {
            "id": "proceso",
            "label": "Proceso",
            "href": "#proceso"
          },
          {
            "id": "cobertura",
            "label": "Cobertura",
            "href": "#cobertura"
          }
        ]
      },
      {
        "title": "Plataforma",
        "links": [
          {
            "id": "roles",
            "label": "Roles",
            "href": "#roles"
          },
          {
            "id": "catalogo",
            "label": "Índice del catálogo",
            "href": "#indice"
          },
          {
            "id": "preguntas",
            "label": "Preguntas",
            "href": "#preguntas"
          }
        ]
      },
      {
        "title": "Colegio",
        "links": [
          {
            "id": "login",
            "label": "Iniciar sesión",
            "href": "/login"
          },
          {
            "id": "demo",
            "label": "Solicitar demostración",
            "href": "mailto:hola@lumen.co?subject=Solicitud%20de%20demostraci%C3%B3n"
          },
          {
            "id": "contacto",
            "label": "Hablar con el equipo",
            "href": "mailto:hola@lumen.co"
          }
        ]
      },
      {
        "title": "Ayuda",
        "links": [
          {
            "id": "faq",
            "label": "Preguntas frecuentes",
            "href": "#preguntas"
          },
          {
            "id": "soporte",
            "label": "Contactar soporte",
            "href": "mailto:hola@lumen.co"
          },
          {
            "id": "panel",
            "label": "Abrir el panel",
            "href": "/login"
          }
        ]
      }
    ],
    "legal": "© 2026 Grupo Editorial Educar. Lumen. Todos los derechos reservados."
  }
}$json$::jsonb)
on conflict (key) do update
  set content = excluded.content,
      updated_at = now();

insert into public.catalog_items (ref, title, meta, area, state, position) values
  ('C-1041', 'Matemáticas 7 — Álgebra y funciones', '18,4 MB · 7° A, 7° B', 'Matemáticas', 'published', 1),
  ('C-1042', 'Lengua 8 — Lectura y escritura', '12,1 MB · 8° A', 'Lengua', 'published', 2),
  ('C-1043', 'Ciencias 6 — El sistema solar', '24,0 MB · 6° B', 'Ciencias', 'review', 3),
  ('C-1044', 'Historia 9 — Colombia', '9,8 MB · 9° A', 'Sociales', 'published', 4),
  ('C-1045', 'Inglés 7 — Intermediate', '15,3 MB · 7° C', 'Inglés', 'draft', 5),
  ('C-1046', 'Biología 10 — Genética', '31,7 MB · 10° A', 'Ciencias', 'published', 6),
  ('C-1047', 'Matemáticas 9 — Ecuaciones', '20,2 MB · 9° B', 'Matemáticas', 'published', 7),
  ('C-1048', 'Arte 6 — Técnicas y materiales', '45,0 MB · 6° A', 'Artes', 'draft', 8),
  ('C-1049', 'Sociales 7 — Constitución y permisos', '11,7 MB · 7° A', 'Sociales', 'review', 9),
  ('C-1050', 'Física 11 — Ondas y sonido', '28,4 MB · 11° A', 'Ciencias', 'archived', 10),
  ('C-1051', 'Lengua 6 — Gramática y escritura', '14,9 MB · 6° A', 'Lengua', 'published', 11),
  ('C-1052', 'Química 10 — Reacciones químicas', '22,6 MB · 10° B', 'Ciencias', 'published', 12),
  ('C-1053', 'Inglés 9 — Intermediate', '13,8 MB · 9° A', 'Inglés', 'published', 13),
  ('C-1054', 'Matemáticas 6 — Números naturales', '19,5 MB · 6° B', 'Matemáticas', 'review', 14),
  ('C-1055', 'Historia 8 — Independencia', '10,4 MB · 8° B', 'Sociales', 'draft', 15),
  ('C-1056', 'Educación Física 7 — Atletismo', '8,2 MB · 7° B', 'Deportes', 'archived', 16)
on conflict (ref) do update
  set title = excluded.title,
      meta = excluded.meta,
      area = excluded.area,
      state = excluded.state,
      position = excluded.position;

delete from public.catalog_item_schools;

insert into public.catalog_item_schools (catalog_item_id, school_name, position)
select c.id, s.name, s.position
from public.catalog_items c
join (values
    ('C-1041', 'Sagrado Corazón', 1),
    ('C-1041', 'Los Alpes', 2),
    ('C-1041', 'Santa María', 3),
    ('C-1041', 'El Roble', 4),
    ('C-1042', 'Sagrado Corazón', 1),
    ('C-1042', 'Los Alpes', 2),
    ('C-1043', 'Sagrado Corazón', 1),
    ('C-1043', 'Los Alpes', 2),
    ('C-1043', 'Santa María', 3),
    ('C-1044', 'Sagrado Corazón', 1),
    ('C-1044', 'Los Alpes', 2),
    ('C-1044', 'Santa María', 3),
    ('C-1044', 'El Roble', 4),
    ('C-1044', 'La Primavera', 5),
    ('C-1045', 'Sagrado Corazón', 1),
    ('C-1046', 'Sagrado Corazón', 1),
    ('C-1046', 'Los Alpes', 2),
    ('C-1046', 'Santa María', 3),
    ('C-1047', 'Sagrado Corazón', 1),
    ('C-1047', 'Los Alpes', 2),
    ('C-1048', 'Sagrado Corazón', 1),
    ('C-1049', 'Sagrado Corazón', 1),
    ('C-1049', 'Los Alpes', 2),
    ('C-1050', 'Sagrado Corazón', 1),
    ('C-1050', 'Los Alpes', 2),
    ('C-1051', 'Sagrado Corazón', 1),
    ('C-1051', 'Los Alpes', 2),
    ('C-1051', 'Santa María', 3),
    ('C-1051', 'El Roble', 4),
    ('C-1052', 'Sagrado Corazón', 1),
    ('C-1052', 'Los Alpes', 2),
    ('C-1052', 'Santa María', 3),
    ('C-1053', 'Sagrado Corazón', 1),
    ('C-1053', 'Los Alpes', 2),
    ('C-1054', 'Sagrado Corazón', 1),
    ('C-1054', 'Los Alpes', 2),
    ('C-1054', 'Santa María', 3),
    ('C-1055', 'Sagrado Corazón', 1),
    ('C-1056', 'Sagrado Corazón', 1),
    ('C-1056', 'Los Alpes', 2)
  ) as s(catalog_ref, name, position) on c.ref = s.catalog_ref;
