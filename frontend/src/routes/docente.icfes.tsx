import { createFileRoute } from "@tanstack/react-router";
import { QuestionBank } from "@/components/icfes/question-bank";
import { requireIcfesAccess } from "@/lib/icfes-guard";

export const Route = createFileRoute("/docente/icfes")({
  beforeLoad: () => requireIcfesAccess(),
  head: () => ({
    meta: [
      { title: "Banco de preguntas ICFES · Docente — Lumen" },
      {
        name: "description",
        content: "Creá y etiquetá preguntas de simulacros Saber para tus cursos.",
      },
      { property: "og:title", content: "Banco de preguntas ICFES · Docente — Lumen" },
      {
        property: "og:description",
        content: "Preguntas por área, grado, dificultad y competencia.",
      },
    ],
  }),
  component: QuestionBank,
});
