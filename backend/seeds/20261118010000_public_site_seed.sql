-- =========================================================================
-- The seed of the public site.
-- -------------------------------------------------------------------------
-- The copy of the landing. The platform team edits the `site_content`
-- row; the site serves whatever is there.
--
-- The catalog the landing shows lives in `materials` and in the schools
-- that have access to each piece. It is seeded in
-- `20261119100000_editorial_catalog_seed.sql`.
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
