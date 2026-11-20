import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Building2, ChevronRight, GraduationCap, Users } from "lucide-react";

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          title="Catálogo editorial"
          description="El material por estado y por área"
          leading={
            <Link
              to="/super/catalogo"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:border-primary hover:bg-primary-soft"
            >
              Abrir catálogo
              <ChevronRight className="size-3.5" strokeWidth={1.9} aria-hidden />
            </Link>
          }
        >
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
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
            </div>

            <div>
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
          title="Cobertura del catálogo"
          description="Qué colegio ve qué parte del catálogo"
          actions={
            <Link
              to="/super/colegios"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver todos
            </Link>
          }
          bodyClassName="p-0"
        >
          {coverage.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Sin colegios registrados.</p>
          ) : (
            <ul className="flex flex-col">
              {coverage.slice(0, 6).map((school) => (
                <li
                  key={school.school_id}
                  className="flex items-center gap-3 border-b border-border px-5 py-2 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{school.name}</span>
                  <StatusPill
                    label={`${school.covered} de ${school.total}`}
                    tone={school.covered === school.total ? "success" : "muted"}
                  />
                </li>
              ))}
              {coverage.length > 6 && (
                <li className="px-5 py-2 text-xs text-muted-foreground">
                  y {coverage.length - 6} colegios más
                </li>
              )}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
