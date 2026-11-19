import { createFileRoute } from "@tanstack/react-router";
import { SimulacroBuilder } from "@/components/icfes/simulacro-builder";
import { requireIcfesAccess } from "@/lib/icfes-guard";

export const Route = createFileRoute("/admin/icfes-simulacros")({
  beforeLoad: () => requireIcfesAccess(),
  head: () => ({
    meta: [
      { title: "Simulacros ICFES — Lumen" },
      {
        name: "description",
        content: "Creá simulacros Saber con selección manual o aleatoria de preguntas por área.",
      },
      { property: "og:title", content: "Simulacros ICFES — Lumen" },
      { property: "og:description", content: "Configurá tiempo, disponibilidad y aleatorización." },
    ],
  }),
  component: SimulacroBuilder,
});
