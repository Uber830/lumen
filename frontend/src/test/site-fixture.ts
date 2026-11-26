// =============================================================================
// The fixture of the public site.
// -----------------------------------------------------------------------------
// A small payload with the same shape the API returns. The tests use it
// instead of a copy of the real response, so they do not break every
// time the platform team edits the copy.
// =============================================================================

import type { SitePayload } from "@/features/site/types";

export const siteFixture: SitePayload = {
  stats: [
    { label: "Materiales", value: "16" },
    { label: "Colegios", value: "24" },
    { label: "Docentes", value: "1.842" },
    { label: "Estudiantes", value: "28.960" },
  ],
  catalog: [
    {
      ref: "C-1041",
      title: "Matemáticas 7 — Álgebra y funciones",
      meta: "18,4 MB · 7° A, 7° B",
      area: "Matemáticas",
      schools: ["Sagrado Corazón", "Los Alpes"],
      schools_extra: 2,
      state: "published",
    },
    {
      ref: "C-1042",
      title: "Lengua 8 — Lectura y escritura",
      meta: "12,1 MB · 8° A",
      area: "Lengua",
      schools: ["Los Alpes"],
      schools_extra: 0,
      state: "review",
    },
  ],
  catalog_total: 16,
  contact_email: "hola@lumen.co",
  content: {
    nav: {
      links: [
        { id: "indice", label: "Índice", href: "#indice" },
        { id: "proceso", label: "Proceso", href: "#proceso" },
        { id: "roles", label: "Roles", href: "#roles" },
        { id: "preguntas", label: "Preguntas", href: "#preguntas" },
      ],
      login_label: "Iniciar sesión",
      contact_label: "Hablar con el equipo",
    },
    hero: {
      kicker: "IDX-001 / Solución para colegios",
      title_lead: "El material de su colegio,",
      title_tail: "ordenado y listo para usar.",
      lead: "Lumen es una empresa de software que resuelve la gestión del material académico.",
      cta_primary: { id: "proceso", label: "Ver el proceso", href: "#proceso", variant: "solid" },
      cta_secondary: { id: "panel", label: "Abrir el panel", href: "/login", variant: "outline" },
    },
    catalog: {
      kicker: "IDX-002 / Catálogo",
      title: "El catálogo de material",
      lead: "Cada pieza se carga una vez y se habilita colegio por colegio.",
      columns: [
        { id: "ref", label: "Ref." },
        { id: "material", label: "Material" },
        { id: "area", label: "Área" },
        { id: "schools", label: "Colegios con acceso" },
        { id: "state", label: "Estado" },
      ],
      footer_prefix: "Mostrando",
      footer_suffix: "entradas · filtro por colegio, área y estado",
    },
    process: {
      kicker: "IDX-003 / Proceso",
      title: "Cómo el colegio pone en marcha su material",
      steps: [
        {
          number: "01",
          title: "El colegio entrega su información",
          body: "Grados, materias, matrícula y el material que ya tiene.",
          owner: "Colegio",
        },
        {
          number: "02",
          title: "Lumen carga y habilita",
          body: "Sube el material y marca los colegios con acceso.",
          owner: "Equipo Lumen",
        },
        {
          number: "03",
          title: "La comunidad lo usa",
          body: "El material aparece en el curso del docente.",
          owner: "Docente · Estudiante",
        },
      ],
    },
    roles: {
      kicker: "IDX-004 / Roles",
      title: "Quién usa Lumen y hasta dónde",
      items: [
        {
          id: "ADMIN COLEGIO",
          summary: "Administra su comunidad.",
          detail: "Docentes, estudiantes, cursos y períodos.",
          scope: "Solo lo de su colegio",
        },
        {
          id: "DOCENTE",
          summary: "Enseña con el material al día.",
          detail: "Consulta y descarga el material de sus cursos.",
          scope: "Material de sus cursos",
        },
        {
          id: "ESTUDIANTE",
          summary: "Estudia en su biblioteca.",
          detail: "Material, tareas y calificaciones del periodo.",
          scope: "Material de su matrícula",
        },
      ],
    },
    faq: {
      kicker: "IDX-005 / Preguntas",
      title: "Preguntas frecuentes",
      items: [
        {
          id: "Q-01",
          question: "¿El colegio tiene que subir el material?",
          answer: "No. El equipo de Lumen carga el material y lo habilita.",
        },
        {
          id: "Q-02",
          question: "¿Qué pasa cuando un material cambia?",
          answer: "El archivo se reemplaza en el catálogo.",
        },
      ],
    },
    cta: {
      kicker: "IDX-006 / Contacto",
      title: "Veamos su colegio con el material ya cargado.",
      body: "Preparamos una demostración con la información de su institución.",
      buttons: [
        {
          id: "demo",
          label: "Solicitar demostración",
          href: "mailto:hola@lumen.co",
          variant: "accent",
        },
        { id: "login", label: "Iniciar sesión", href: "/login", variant: "outline" },
      ],
      spec: [
        { label: "TIEMPO", value: "30 minutos" },
        { label: "ENTREGABLE", value: "Catálogo de ejemplo con su acceso" },
        { label: "CONTACTO", value: "hola@lumen.co" },
      ],
    },
    footer: {
      brand: "Lumen",
      location: "LUMEN · BOGOTÁ, COLOMBIA",
      columns: [
        {
          title: "Solución",
          links: [{ id: "indice", label: "Índice", href: "#indice" }],
        },
        {
          title: "Material",
          links: [{ id: "roles", label: "Roles", href: "#roles" }],
        },
        {
          title: "Colegio",
          links: [{ id: "login", label: "Iniciar sesión", href: "/login" }],
        },
        {
          title: "Ayuda",
          links: [{ id: "faq", label: "Preguntas frecuentes", href: "#preguntas" }],
        },
      ],
      legal: "© 2026 Lumen S.A.S. Todos los derechos reservados.",
    },
  },
};
