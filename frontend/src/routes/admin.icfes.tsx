import { createFileRoute } from "@tanstack/react-router";
import { QuestionBank } from "@/components/icfes/question-bank";
import { requireIcfesAccess } from "@/lib/icfes-guard";

export const Route = createFileRoute("/admin/icfes")({
  beforeLoad: () => requireIcfesAccess(),
  head: () => ({
    meta: [
      { title: "Banco de preguntas ICFES — Lumen" },
      {
        name: "description",
        content:
          "Administrá el banco de preguntas de simulacros Saber por área, grado y competencia.",
      },
      { property: "og:title", content: "Banco de preguntas ICFES — Lumen" },
      {
        property: "og:description",
        content: "Preguntas de práctica estilo Saber 11 y Saber 3-5-9.",
      },
    ],
  }),
  component: QuestionBank,
});
