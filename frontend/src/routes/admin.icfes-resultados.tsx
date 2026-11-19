import { createFileRoute } from "@tanstack/react-router";
import { IcfesAggregateResults } from "@/components/icfes/aggregate-results";
import { requireIcfesAccess } from "@/lib/icfes-guard";

export const Route = createFileRoute("/admin/icfes-resultados")({
  beforeLoad: () => requireIcfesAccess(),
  head: () => ({
    meta: [
      { title: "Resultados de simulacros ICFES — Lumen" },
      {
        name: "description",
        content: "Comparativa de resultados por curso y área, con exportación a PDF.",
      },
      { property: "og:title", content: "Resultados de simulacros ICFES — Lumen" },
      {
        property: "og:description",
        content: "Promedios por área, mejor y peor desempeño por curso.",
      },
    ],
  }),
  component: IcfesAggregateResults,
});
