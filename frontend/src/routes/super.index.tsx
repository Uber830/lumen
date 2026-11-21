import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Building2, GraduationCap, Users } from "lucide-react";

import {
  MeterRow,
  PageHeader,
  SectionCard,
  SkeletonCards,
  StatCard,
  StatusPill,
} from "@/components/ui-kit";
import { usePlatformMetrics } from "@/lib/platform/hooks";
import { MATERIAL_STATUS_LABEL, type MaterialStatus } from "@/lib/platform/types";

export const Route = createFileRoute("/super/")({
  head: () => ({
    meta: [
      { title: "Panel de plataforma — Lumen" },
      {
        name: "description",
        content: "Estado de la red: colegios, comunidad y catálogo editorial.",
      },
      { property: "og:title", content: "Panel de plataforma — Lumen" },
      {
        property: "og:description",
        content: "Vista de operación de la plataforma, sin acceso a datos académicos.",
      },
    ],
  }),
  component: SuperDashboard,
});

const STATUS_ORDER: MaterialStatus[] = ["published", "review", "draft", "archived"];

/**
 * How many schools fit in the coverage card.
 *
 * The card has a fixed height and no scroll bar: the schools that do
 * not fit are not drawn. The list of all of them, with the filters,
 * is one click away in "Ver todos".
 */
const MAX_COVERAGE = 12;

function SuperDashboard() {
  const metrics = usePlatformMetrics();

  if (metrics.isLoading) {
    return (
      <>
        <PageHeader
          title="Panel global"
          subtitle="Estado de la red: colegios, comunidad y catálogo editorial."
        />
        <SkeletonCards />
      </>
    );
  }

  const data = metrics.data;
  const byStatus = data?.materials_by_status ?? {};
  const byArea = data?.materials_by_area ?? {};
  const maxStatus = Math.max(1, ...Object.values(byStatus));
  const maxArea = Math.max(1, ...Object.values(byArea));
  const coverage = data?.school_coverage ?? [];
  const covered = coverage.filter((school) => school.covered > 0).length;

  return (
    <>
      <PageHeader
        title="Panel global"
        subtitle="Estado de la red: colegios, comunidad y catálogo editorial."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Colegios en la red"
          value={String(data?.schools ?? 0)}
          delta={`${covered} con material habilitado`}
          icon={Building2}
        />
        <StatCard
          label="Docentes"
          value={(data?.teachers ?? 0).toLocaleString("es-CO")}
          delta="en las instituciones registradas"
          icon={Users}
          tone="teal"
        />
        <StatCard
          label="Estudiantes"
          value={(data?.students ?? 0).toLocaleString("es-CO")}
          delta="matriculados en la red"
          icon={GraduationCap}
          tone="success"
        />
        <StatCard
          label="Material en catálogo"
          value={String(data?.materials ?? 0)}
          delta={`${byStatus.published ?? 0} publicados`}
          icon={BookOpen}
          tone="warning"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          className="flex h-[39.5rem] flex-col"
          title="Catálogo editorial"
          description="El material por estado y por área"
          bodyClassName="min-h-0 flex-1 overflow-hidden"
          leading={
            <Link
              to="/super/catalogo"
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
            >
              Abrir catálogo
            </Link>
          }
        >
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
              Por estado
            </p>
            {Object.keys(byStatus).length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Todavía no hay material.</p>
            ) : (
              STATUS_ORDER.filter((status) => byStatus[status] !== undefined).map((status) => (
                <MeterRow
                  key={status}
                  label={MATERIAL_STATUS_LABEL[status]}
                  value={byStatus[status] ?? 0}
                  max={maxStatus}
                />
              ))
            )}

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                Por área
              </p>
              {Object.keys(byArea).length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">Todavía no hay material.</p>
              ) : (
                Object.entries(byArea)
                  .sort((a, b) => b[1] - a[1])
                  .map(([area, count]) => (
                    <MeterRow key={area} label={area} value={count} max={maxArea} />
                  ))
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="flex h-[39.5rem] flex-col"
          title="Cobertura del catálogo"
          description="Qué colegio ve qué parte del catálogo"
          leading={
            <Link
              to="/super/colegios"
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
            >
              Ver todos
            </Link>
          }
          bodyClassName="min-h-0 flex-1 overflow-hidden p-0"
        >
          {coverage.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Sin colegios registrados.</p>
          ) : (
            <ul className="flex flex-col">
              {coverage.slice(0, MAX_COVERAGE).map((school) => (
                <li
                  key={school.school_id}
                  className="flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{school.name}</span>
                  <StatusPill
                    label={`${school.covered} de ${school.total}`}
                    tone={school.covered === school.total ? "success" : "muted"}
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
