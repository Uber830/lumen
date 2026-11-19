// Mock data still used by the routes that are not wired to the API
// yet (landing, super admin). The admin home page is real data via
// useSchoolStats; this file should shrink to zero once each remaining
// route is wired up.

export const plans = [
  {
    name: "Basico",
    price: "$49",
    desc: "Para colegios pequenos que empiezan a digitalizarse.",
    features: [
      "Hasta 200 estudiantes",
      "15 docentes",
      "Cursos y materias",
      "Calificaciones",
      "Soporte por email",
    ],
    highlight: false,
  },
  {
    name: "Estandar",
    price: "$129",
    desc: "El plan mas elegido por instituciones en crecimiento.",
    features: [
      "Hasta 1.500 estudiantes",
      "Docentes ilimitados",
      "Evaluaciones online",
      "Simulacros ICFES (Saber 11 y 3-5-9)",
      "Chat interno",
      "Personalizacion de marca",
      "Soporte prioritario",
    ],
    highlight: true,
  },
  {
    name: "Premium",
    price: "$299",
    desc: "Para redes educativas con multiples sedes.",
    features: [
      "Estudiantes ilimitados",
      "Multiples sedes",
      "Simulacros ICFES (Saber 11 y 3-5-9)",
      "Reportes avanzados",
      "Integraciones y API",
      "Onboarding dedicado",
      "SLA 99,9%",
    ],
    highlight: false,
  },
];

export const schoolsTable = [
  {
    id: 1,
    name: "Colegio San Martin",
    plan: "Estandar",
    estado: "Activo",
    alumnos: 1284,
    alta: "12 Feb 2025",
  },
  {
    id: 2,
    name: "Instituto Belgrano",
    plan: "Premium",
    estado: "Activo",
    alumnos: 3120,
    alta: "03 Ene 2025",
  },
  {
    id: 3,
    name: "Escuela Los Alamos",
    plan: "Basico",
    estado: "Trial",
    alumnos: 180,
    alta: "28 Jun 2026",
  },
  {
    id: 4,
    name: "Colegio del Valle",
    plan: "Estandar",
    estado: "Suspendido",
    alumnos: 640,
    alta: "19 Sep 2025",
  },
  {
    id: 5,
    name: "Liceo Nuevo Sur",
    plan: "Premium",
    estado: "Activo",
    alumnos: 2210,
    alta: "07 Mar 2025",
  },
];

export const mrrTrend = [
  { mes: "Feb", mrr: 42000 },
  { mes: "Mar", mrr: 47500 },
  { mes: "Abr", mrr: 51200 },
  { mes: "May", mrr: 55800 },
  { mes: "Jun", mrr: 61400 },
  { mes: "Jul", mrr: 68900 },
];

export const studentClasses = [
  {
    id: 1,
    materia: "Matematica",
    docente: "Lucia Ferreyra",
    progreso: 78,
    proximo: "Ecuaciones cuadraticas",
    pendientes: 2,
  },
  {
    id: 2,
    materia: "Lengua y Literatura",
    docente: "Martin Ocampo",
    progreso: 92,
    proximo: "Ensayo argumentativo",
    pendientes: 0,
  },
  {
    id: 3,
    materia: "Biologia",
    docente: "Sofia Bianchi",
    progreso: 45,
    proximo: "Sistema circulatorio",
    pendientes: 3,
  },
  {
    id: 4,
    materia: "Historia",
    docente: "Diego Paredes",
    progreso: 61,
    proximo: "Revolucion industrial",
    pendientes: 1,
  },
  {
    id: 5,
    materia: "Ingles",
    docente: "Camila Rossi",
    progreso: 88,
    proximo: "Present perfect",
    pendientes: 1,
  },
  {
    id: 6,
    materia: "Fisica",
    docente: "Andres Vega",
    progreso: 33,
    proximo: "Movimiento rectilineo",
    pendientes: 2,
  },
];

export const studentTasks = [
  {
    id: 1,
    titulo: "TP Ecuaciones",
    materia: "Matematica",
    vence: "Vence en 2 dias",
    estado: "Pendiente",
  },
  {
    id: 2,
    titulo: "Informe de laboratorio",
    materia: "Biologia",
    vence: "Vence hoy",
    estado: "Urgente",
  },
  {
    id: 3,
    titulo: "Ensayo argumentativo",
    materia: "Lengua",
    vence: "Entregado",
    estado: "Entregado",
  },
  {
    id: 4,
    titulo: "Linea de tiempo",
    materia: "Historia",
    vence: "Vence en 5 dias",
    estado: "Pendiente",
  },
];
