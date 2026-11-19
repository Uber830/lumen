import { createFileRoute } from "@tanstack/react-router";
import { SimulacroBuilder } from "@/components/icfes/simulacro-builder";
import { requireIcfesAccess } from "@/lib/icfes-guard";

export const Route = createFileRoute("/docente/icfes-simulacros")({
  beforeLoad: () => requireIcfesAccess(),
  head: () => ({
    meta: [
      { title: "Mis simulacros ICFES — Lumen" },
      {
        name: "description",
        content: "Armá simulacros Saber para tus cursos con tiempo límite y aleatorización.",
      },
      { property: "og:title", content: "Mis simulacros ICFES — Lumen" },
      { property: "og:description", content: "Selección manual o generación aleatoria por área." },
    ],
  }),
  component: SimulacroBuilder,
});
