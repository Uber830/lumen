import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  Info,
  Layers,
  Link2,
  ListChecks,
  Upload,
  Users,
} from "lucide-react";

import { Button, Chip, PageHeader, SectionCard, StatCard } from "@/components/ui-kit";
import { useSchoolOverview, type ActivityEntry } from "@/lib/school/overview";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Panel del colegio — Lumen" },
      {
        name: "description",
        content: "Comunidad, material disponible y operación del periodo vigente.",
      },
      { property: "og:title", content: "Panel del colegio — Lumen" },
      {
        property: "og:description",
        content: "Métricas y accesos rápidos para la administración del colegio.",
      },
    ],
  }),
  component: AdminDashboard,
});

/**
 * The quick actions of the panel: the four things the administrator
 * of a school does most of the time.
 */
const quickActions = [
  {
    to: "/admin/docentes",
    label: "Nuevo docente",
    hint: "Registra a un docente del colegio",
    icon: Users,
  },
  {
    to: "/admin/estudiantes",
    label: "Nuevo estudiante",
    hint: "Matrícula a un estudiante",
    icon: GraduationCap,
  },
  { to: "/admin/cursos", label: "Crear curso", hint: "Abre un grado o ciclo", icon: Layers },
  {
    to: "/admin/asignaciones",
    label: "Asignar materia",
    hint: "Vincula docente y curso",
    icon: Link2,
  },
];

/** The icon of each kind of activity. */
const activityIcons: Record<string, typeof Upload> = {
  upload: Upload,
  layers: Layers,
  users: Users,
  link: Link2,
};

const activityTones: Record<string, string> = {
  success: "text-success",
  info: "text-primary",
  teal: "text-primary",
  muted: "text-muted-foreground",
};

/** How long ago it happened, in the words of the panel. */
function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 60) return "Hace un momento";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const date = new Date(then);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const Icon = activityIcons[entry.icon] ?? Info;
  return (
    <li className="flex items-start gap-3 border-b border-border px-[18px] py-3 last:border-b-0">
      <span className={`mt-px shrink-0 ${activityTones[entry.tone] ?? "text-muted-foreground"}`}>
        <Icon className="size-4" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.2px] font-medium">{entry.title}</p>
        <p className="truncate text-[12px] text-muted-foreground">{entry.detail}</p>
      </div>
      <span className="shrink-0 text-[12px] text-muted-foreground">{relativeTime(entry.at)}</span>
    </li>
  );
}

function AdminDashboard() {
  const { session } = useRouteContext({ from: "/admin/" });
  const overview = useSchoolOverview(session.primarySchoolId);
  const data = overview.data;
  // While the numbers are on their way the cards show their own shape:
  // a zero would be a lie about a school that has material and teachers.
  const loading = overview.isLoading;

  const material = data?.material;
  const teachers = data?.teachers;
  const students = data?.students;
  const tasks = data?.tasks;

  const maxArea = Math.max(1, ...(material?.by_area ?? []).map((row) => row.count));
  const accessPct =
    teachers && teachers.total > 0 ? Math.round((teachers.with_access / teachers.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Panel del colegio"
        subtitle="Comunidad, material disponible y operación del periodo vigente."
      />

      {overview.isError ? (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-destructive"
        >
          {overview.error.message}
        </p>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Material disponible"
          value={String(material?.available ?? 0)}
          tone="success"
          icon={BookOpen}
          loading={loading}
          delta="cargado por el equipo editorial de Lumen"
        />
        <StatCard
          label="Docentes"
          value={String(teachers?.total ?? 0)}
          tone="primary"
          icon={Users}
          loading={loading}
          delta={
            teachers && teachers.pending > 0 ? (
              <>
                <b className="font-semibold text-foreground">{teachers.pending}</b> sin acceso
              </>
            ) : (
              "todos con acceso al material"
            )
          }
        />
        <StatCard
          label="Estudiantes matriculados"
          value={String(students?.total ?? 0)}
          tone="teal"
          icon={GraduationCap}
          loading={loading}
          delta={
            students ? (
              <>
                en {students.courses} cursos ·{" "}
                <b className="font-semibold text-foreground">{students.with_access}</b> con acceso
                activo
              </>
            ) : (
              ""
            )
          }
        />
        <StatCard
          label="Tareas por revisar"
          value={String(tasks?.pending ?? 0)}
          tone="warning"
          icon={ListChecks}
          loading={loading}
          delta={
            tasks && tasks.stale > 0 ? (
              <>
                <b className="font-semibold text-foreground">{tasks.stale}</b> con más de 3 días
              </>
            ) : (
              "entregas por calificar"
            )
          }
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          title="Material habilitado para tu colegio"
          description="Lo que el equipo de plataforma cargó y dejó visible para tu institución"
          actions={
            <Link to="/admin/contenido">
              <Button variant="ghost" size="sm">
                Ver todo
                <ChevronRight className="size-[15.5px]" strokeWidth={1.9} aria-hidden />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <div className="flex flex-col gap-2.5" aria-hidden>
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="grid grid-cols-[150px_1fr_54px] items-center gap-3">
                  <span className="h-[11px] animate-pulse rounded bg-muted" />
                  <span className="h-[9px] animate-pulse rounded-full bg-muted" />
                  <span className="h-[11px] animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : material && material.by_area.length > 0 ? (
            material.by_area.map((row) => (
              <div
                key={row.area}
                className="grid grid-cols-[150px_1fr_54px] items-center gap-3 py-1.5 text-[12.8px]"
              >
                <span className="truncate text-muted-foreground">{row.area}</span>
                <span className="h-[9px] overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((row.count / maxArea) * 100)}%` }}
                  />
                </span>
                <span className="text-right font-mono text-[12px] text-foreground">
                  {row.count}
                </span>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Todavía no hay material habilitado para tu colegio.
            </p>
          )}

          <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary-soft p-3 text-[12.5px] text-foreground">
            <Info className="mt-px size-4 shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
            <span>
              <b className="font-semibold text-foreground">
                El material lo carga el equipo editorial de Lumen
              </b>
              <br />
              Tu colegio tiene {loading ? "—" : (material?.available ?? 0)} de{" "}
              {loading ? "—" : (material?.catalog_total ?? 0)} materiales habilitados y publicados.
              Lo que ves es todo lo que puedes usar; para pedir más, escríbele a tu coordinador.
            </span>
          </p>
        </SectionCard>

        <SectionCard title="Estado del colegio" description="Resumen del periodo y la operación">
          <dl className="grid grid-cols-[118px_1fr] gap-x-3.5 gap-y-2.5 text-[13.2px]">
            <dt className="text-[12.4px] text-muted-foreground">Periodo</dt>
            <dd>
              {loading ? (
                <span className="inline-block h-[11px] w-[132px] animate-pulse rounded bg-muted" />
              ) : (
                (data?.period?.name ?? "Sin periodo vigente")
              )}
            </dd>

            <dt className="text-[12.4px] text-muted-foreground">Cursos</dt>
            <dd>{loading ? "—" : `${data?.courses ?? 0} activos`}</dd>

            <dt className="text-[12.4px] text-muted-foreground">Material</dt>
            <dd>{loading ? "—" : `${material?.available ?? 0} disponibles`}</dd>

            <dt className="text-[12.4px] text-muted-foreground">Docentes con acceso</dt>
            <dd>
              <span className="mt-1 block h-[9px] overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${accessPct}%` }}
                />
              </span>
              <span className="mt-1.5 block text-[12px] text-muted-foreground">
                {loading
                  ? "—"
                  : `${teachers?.with_access ?? 0} de ${teachers?.total ?? 0} docentes con acceso activo`}
              </span>
            </dd>
          </dl>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          title="Actividad reciente"
          description="Cargas y cambios de la última semana"
          bodyClassName="p-0"
        >
          {loading ? (
            <ul aria-hidden>
              {[0, 1, 2].map((row) => (
                <li
                  key={row}
                  className="flex items-start gap-3 border-b border-border px-[18px] py-3 last:border-b-0"
                >
                  <span className="size-4 animate-pulse rounded-full bg-muted" />
                  <span className="h-[11px] flex-1 animate-pulse rounded bg-muted" />
                </li>
              ))}
            </ul>
          ) : data && data.activity.length > 0 ? (
            <ul>
              {data.activity.map((entry) => (
                <ActivityRow key={`${entry.title}-${entry.at}`} entry={entry} />
              ))}
            </ul>
          ) : (
            <p className="px-[18px] py-6 text-[13px] text-muted-foreground">
              Todavía no hay actividad registrada en el colegio.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Acciones rápidas" description="Atajos de alta frecuencia">
          <div className="flex flex-col gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="flex items-center gap-[11px] rounded-idx border border-border bg-secondary px-[10px] py-[9px] transition-colors hover:border-input hover:bg-secondary"
              >
                <action.icon
                  className="size-[17px] shrink-0 opacity-85"
                  strokeWidth={1.9}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-left">
                  <b className="block text-[13.2px] font-medium text-foreground">{action.label}</b>
                  <span className="block text-[11.6px] text-muted-foreground">{action.hint}</span>
                </span>
                <ChevronRight
                  className="size-[15px] shrink-0 text-muted-foreground"
                  strokeWidth={1.9}
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* The foot of the view: the state of the system, so that a page
          is never a blank rectangle. */}
      <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <Chip tone="muted" dot>
          Sistema operativo
        </Chip>
        <span>Los datos son del colegio y se cuentan en el servidor al abrir la vista.</span>
      </p>
    </>
  );
}
