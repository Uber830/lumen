import { createFileRoute } from "@tanstack/react-router";
import { IcfesAggregateResults } from "@/components/icfes/aggregate-results";
import { requireIcfesAccess } from "@/lib/icfes-guard";

export const Route = createFileRoute("/docente/icfes-resultados")({
  beforeLoad: () => requireIcfesAccess(),
  head: () => ({
    meta: [
      { title: "Resultados ICFES por curso — Lumen" },
      {
        name: "description",
        content: "Analizá el desempeño de tus cursos por área y exportá el reporte a PDF.",
      },
      { property: "og:title", content: "Resultados ICFES por curso — Lumen" },
      { property: "og:description", content: "Promedios por área y comparativa entre cursos." },
    ],
  }),
  component: IcfesAggregateResults,
});
