export const ICFES_AREAS = [
  "Lectura crítica",
  "Matemáticas",
  "Ciencias naturales",
  "Sociales y ciudadanas",
  "Inglés",
] as const;
export type IcfesArea = (typeof ICFES_AREAS)[number];

export const ICFES_GRADOS = ["3º", "5º", "9º", "10º", "11º"] as const;
export type IcfesGrado = (typeof ICFES_GRADOS)[number];

export const ICFES_DIFICULTADES = ["Básico", "Medio", "Alto"] as const;
export type IcfesDificultad = (typeof ICFES_DIFICULTADES)[number];

export const ICFES_COMPETENCIAS = ["Interpretativa", "Argumentativa", "Propositiva"] as const;
export type IcfesCompetencia = (typeof ICFES_COMPETENCIAS)[number];

export type IcfesQuestion = {
  id: string;
  enunciado: string;
  lectura?: string;
  imagen?: string;
  opciones: [string, string, string, string];
  correcta: 0 | 1 | 2 | 3;
  area: IcfesArea;
  grado: IcfesGrado;
  dificultad: IcfesDificultad;
  competencia: IcfesCompetencia;
};

export const initialQuestions: IcfesQuestion[] = [
  {
    id: "q1",
    enunciado: "Según el texto, la intención principal del autor es",
    lectura:
      "El río que atraviesa la vereda dejó de crecer hace tres inviernos. Los mayores recuerdan cuando el agua llegaba a la mitad del puente; hoy los niños cruzan a pie. Nadie ha querido nombrar lo que todos ven.",
    opciones: [
      "describir un paisaje rural con fines turísticos",
      "advertir sobre un cambio ambiental silenciado por la comunidad",
      "narrar un accidente ocurrido en el puente",
      "explicar el funcionamiento de las cuencas hidrográficas",
    ],
    correcta: 1,
    area: "Lectura crítica",
    grado: "11º",
    dificultad: "Medio",
    competencia: "Interpretativa",
  },
  {
    id: "q2",
    enunciado: "Si 3x − 7 = 14, el valor de x es",
    opciones: ["3", "5", "7", "9"],
    correcta: 2,
    area: "Matemáticas",
    grado: "9º",
    dificultad: "Básico",
    competencia: "Interpretativa",
  },
  {
    id: "q3",
    enunciado:
      "Un estudiante afirma que al aumentar la temperatura de un gas en un recipiente rígido aumenta su presión. La mejor justificación es",
    opciones: [
      "el volumen del recipiente disminuye",
      "las moléculas chocan con mayor frecuencia y energía contra las paredes",
      "la masa del gas aumenta con el calor",
      "la densidad del gas se mantiene constante",
    ],
    correcta: 1,
    area: "Ciencias naturales",
    grado: "10º",
    dificultad: "Alto",
    competencia: "Argumentativa",
  },
  {
    id: "q4",
    enunciado:
      "Ante el aumento de residuos en el colegio, la propuesta más pertinente para reducirlos en la fuente sería",
    opciones: [
      "aumentar la frecuencia de recolección",
      "instalar más canecas en los pasillos",
      "implementar estaciones de separación y jornadas de reutilización",
      "contratar personal adicional de aseo",
    ],
    correcta: 2,
    area: "Sociales y ciudadanas",
    grado: "11º",
    dificultad: "Medio",
    competencia: "Propositiva",
  },
  {
    id: "q5",
    enunciado:
      "Choose the option that best completes the sentence: “She ____ in Bogotá since 2019.”",
    opciones: ["live", "is living", "has lived", "lived"],
    correcta: 2,
    area: "Inglés",
    grado: "11º",
    dificultad: "Básico",
    competencia: "Interpretativa",
  },
  {
    id: "q6",
    enunciado: "El área de un triángulo de base 12 cm y altura 7 cm es",
    opciones: ["19 cm²", "42 cm²", "84 cm²", "38 cm²"],
    correcta: 1,
    area: "Matemáticas",
    grado: "5º",
    dificultad: "Básico",
    competencia: "Interpretativa",
  },
  {
    id: "q7",
    enunciado: "La función principal de los glóbulos rojos en el cuerpo humano es",
    opciones: [
      "transportar oxígeno",
      "coagular la sangre",
      "combatir infecciones",
      "producir anticuerpos",
    ],
    correcta: 0,
    area: "Ciencias naturales",
    grado: "9º",
    dificultad: "Básico",
    competencia: "Interpretativa",
  },
  {
    id: "q8",
    enunciado:
      "En el texto, la expresión “nadie ha querido nombrar lo que todos ven” sugiere que la comunidad",
    lectura:
      "El río que atraviesa la vereda dejó de crecer hace tres inviernos. Los mayores recuerdan cuando el agua llegaba a la mitad del puente; hoy los niños cruzan a pie. Nadie ha querido nombrar lo que todos ven.",
    opciones: [
      "desconoce el problema",
      "evita reconocer públicamente el problema",
      "celebra el nuevo cauce del río",
      "planea mudarse de la vereda",
    ],
    correcta: 1,
    area: "Lectura crítica",
    grado: "9º",
    dificultad: "Alto",
    competencia: "Argumentativa",
  },
  {
    id: "q9",
    enunciado: "La separación de poderes en el Estado colombiano busca principalmente",
    opciones: [
      "acelerar los trámites administrativos",
      "evitar la concentración del poder y garantizar control mutuo",
      "reducir el gasto público",
      "descentralizar los impuestos",
    ],
    correcta: 1,
    area: "Sociales y ciudadanas",
    grado: "10º",
    dificultad: "Medio",
    competencia: "Argumentativa",
  },
  {
    id: "q10",
    enunciado: "Read the sign: “No littering”. It means you must not",
    opciones: ["run", "throw trash on the ground", "speak loudly", "take pictures"],
    correcta: 1,
    area: "Inglés",
    grado: "9º",
    dificultad: "Básico",
    competencia: "Interpretativa",
  },
];

export type Simulacro = {
  id: string;
  nombre: string;
  grado: IcfesGrado;
  curso: string;
  minutos: number;
  desde: string;
  hasta: string;
  preguntas: string[];
  aleatorizarPreguntas: boolean;
  aleatorizarOpciones: boolean;
  estado: "Programado" | "Activo" | "Cerrado";
};

export const initialSimulacros: Simulacro[] = [
  {
    id: "s1",
    nombre: "Simulacro Saber 11 · Nº 2",
    grado: "11º",
    curso: "11º A",
    minutos: 90,
    desde: "2026-08-03",
    hasta: "2026-08-10",
    preguntas: ["q1", "q2", "q3", "q4", "q5"],
    aleatorizarPreguntas: true,
    aleatorizarOpciones: true,
    estado: "Activo",
  },
  {
    id: "s2",
    nombre: "Diagnóstico Saber 9 · Lectura y Matemáticas",
    grado: "9º",
    curso: "9º B",
    minutos: 60,
    desde: "2026-08-12",
    hasta: "2026-08-18",
    preguntas: ["q8", "q2", "q7", "q10"],
    aleatorizarPreguntas: false,
    aleatorizarOpciones: false,
    estado: "Programado",
  },
  {
    id: "s3",
    nombre: "Simulacro Saber 5 · Áreas básicas",
    grado: "5º",
    curso: "5º A",
    minutos: 45,
    desde: "2026-07-10",
    hasta: "2026-07-17",
    preguntas: ["q6", "q7"],
    aleatorizarPreguntas: true,
    aleatorizarOpciones: false,
    estado: "Cerrado",
  },
];

/** Resultados agregados por curso (mock). */
export const resultadosPorCurso = [
  {
    curso: "11º A",
    grado: "11º" as IcfesGrado,
    simulacro: "Simulacro Saber 11 · Nº 2",
    fecha: "2026-08-05",
    estudiantes: 32,
    global: 312,
    areas: {
      "Lectura crítica": 68,
      Matemáticas: 61,
      "Ciencias naturales": 57,
      "Sociales y ciudadanas": 64,
      Inglés: 72,
    } as Record<IcfesArea, number>,
  },
  {
    curso: "11º B",
    grado: "11º" as IcfesGrado,
    simulacro: "Simulacro Saber 11 · Nº 2",
    fecha: "2026-08-05",
    estudiantes: 29,
    global: 288,
    areas: {
      "Lectura crítica": 63,
      Matemáticas: 52,
      "Ciencias naturales": 55,
      "Sociales y ciudadanas": 59,
      Inglés: 66,
    } as Record<IcfesArea, number>,
  },
  {
    curso: "9º B",
    grado: "9º" as IcfesGrado,
    simulacro: "Diagnóstico Saber 9",
    fecha: "2026-07-22",
    estudiantes: 30,
    global: 271,
    areas: {
      "Lectura crítica": 59,
      Matemáticas: 48,
      "Ciencias naturales": 54,
      "Sociales y ciudadanas": 57,
      Inglés: 61,
    } as Record<IcfesArea, number>,
  },
  {
    curso: "5º A",
    grado: "5º" as IcfesGrado,
    simulacro: "Simulacro Saber 5",
    fecha: "2026-07-14",
    estudiantes: 27,
    global: 264,
    areas: {
      "Lectura crítica": 61,
      Matemáticas: 55,
      "Ciencias naturales": 58,
      "Sociales y ciudadanas": 52,
      Inglés: 49,
    } as Record<IcfesArea, number>,
  },
];

export type IntentoEstudiante = {
  id: string;
  simulacroId: string;
  nombre: string;
  grado: IcfesGrado;
  minutos: number;
  estado: "Disponible" | "Pendiente" | "Completado";
  ventana: string;
  puntaje?: number;
  fecha?: string;
};

export const intentosEstudiante: IntentoEstudiante[] = [
  {
    id: "i1",
    simulacroId: "s1",
    nombre: "Simulacro Saber 11 · Nº 2",
    grado: "11º",
    minutos: 90,
    estado: "Disponible",
    ventana: "3 – 10 Ago 2026",
  },
  {
    id: "i2",
    simulacroId: "s2",
    nombre: "Diagnóstico Saber 9 · Lectura y Matemáticas",
    grado: "9º",
    minutos: 60,
    estado: "Pendiente",
    ventana: "12 – 18 Ago 2026",
  },
  {
    id: "i3",
    simulacroId: "s3",
    nombre: "Simulacro Saber 5 · Áreas básicas",
    grado: "5º",
    minutos: 45,
    estado: "Completado",
    ventana: "10 – 17 Jul 2026",
    puntaje: 318,
    fecha: "14 Jul 2026",
  },
];

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
