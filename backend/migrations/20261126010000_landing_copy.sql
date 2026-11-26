-- =========================================================================
-- The copy of the landing: Lumen is a company, not an editorial.
-- -------------------------------------------------------------------------
-- The landing lives in `site_content`, under the key `landing`: the API
-- validates it and serves it, and the page renders whatever it finds
-- there. This migration writes the current copy of that row.
--
-- Three things changed:
--
--   1. Lumen does not present itself as an editorial anymore. It is a
--      company that solves a problem for schools: the management of
--      the academic material. The copy says so in the hero, in the
--      process and in the questions.
--   2. The platform role is not published. It is an internal thing of
--      the team that operates the service; the people who read the
--      landing are administrators, teachers and students.
--   3. The coverage by school size is not published either, for now.
--      The block is gone from the copy and the page only draws it when
--      the copy carries it, so it can come back without a deploy.
--
-- The migration is idempotent: it writes the same copy of the same key
-- every time it runs, so a database that already had it ends up with
-- the same landing as a fresh one.
--
-- Order of the deploy: the API that accepts a copy without the
-- coverage block (`app/site/schemas.py`, where `coverage` is optional)
-- goes first, and this migration goes with it. A copy without that
-- block does not fit the contract of an older API, and the landing
-- would answer 503 until the new one is up.
--
-- Rollback:
--   the copy of a previous release is not kept: the landing is
--   edited in the database, so the rollback is to write it back.
-- =========================================================================

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
        "id": "preguntas",
        "label": "Preguntas",
        "href": "#preguntas"
      }
    ],
    "login_label": "Iniciar sesión",
    "contact_label": "Hablar con el equipo"
  },
  "hero": {
    "kicker": "IDX-001 / Solución para colegios",
    "title_lead": "El material de su colegio,",
    "title_tail": "ordenado y listo para usar.",
    "lead": "Lumen es una empresa de software que resuelve la gestión del material académico: el colegio entrega lo que ya tiene, Lumen lo ordena y lo deja disponible para el docente y para el estudiante.",
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
    "title": "El catálogo de material",
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
    "title": "Cómo el colegio pone en marcha su material",
    "steps": [
      {
        "number": "01",
        "title": "El colegio entrega su información",
        "body": "Grados, materias, matrícula y el material que ya tiene. Con eso se sabe qué necesita cada institución.",
        "owner": "Colegio"
      },
      {
        "number": "02",
        "title": "Lumen carga y habilita",
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
  "faq": {
    "kicker": "IDX-005 / Preguntas",
    "title": "Preguntas frecuentes",
    "items": [
      {
        "id": "Q-01",
        "question": "¿El colegio tiene que subir el material?",
        "answer": "No. El equipo de Lumen carga el material y lo habilita. El colegio solo entrega su información y usa lo que queda disponible."
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
        "answer": "El equipo de Lumen, que también ayuda a habilitar una pieza o a quitar un acceso desde el panel."
      }
    ]
  },
  "cta": {
    "kicker": "IDX-006 / Contacto",
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
        "title": "Solución",
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
          }
        ]
      },
      {
        "title": "Material",
        "links": [
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
    "legal": "© 2026 Lumen S.A.S. Todos los derechos reservados."
  }
}$json$::jsonb)
on conflict (key) do update
  set content = excluded.content,
      updated_at = now();
