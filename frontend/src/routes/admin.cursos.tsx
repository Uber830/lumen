import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { BookOpen, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

import {
  Button,
  PanelTable,
  Chip,
  EmptyState,
  PageHeader,
  SectionCard,
  TableShell,
  tableCellClass,
  tableHeadClass,
} from "@/components/ui-kit";
import { AcademicStructureWizard } from "@/features/admin/academic-wizard";
import { useSchoolCourses, useSchoolSubjects } from "@/lib/school/community";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/cursos")({
  head: () => ({
    meta: [
      { title: "Cursos y materias — Lumen" },
      {
        name: "description",
        content: "Estructura académica del colegio: cursos, materias y quién las imparte.",
      },
      { property: "og:title", content: "Cursos y materias — Lumen" },
      {
        property: "og:description",
        content: "Administra los cursos y las materias de tu institución.",
      },
    ],
  }),
  component: CursosPage,
});

function CursosPage() {
  const navigate = useNavigate();
  const { session } = useRouteContext({ from: "/admin/cursos" });
  const schoolId = session.primarySchoolId;

  // The read side comes from the panel's own endpoints: the counts of
  // subjects and teachers per course are computed in the server.
  const courses = useSchoolCourses();
  const subjects = useSchoolSubjects();

  // The creation of the structure happens in one big form: course,
  // subject and offering, one step after the other.
  const [wizardOpen, setWizardOpen] = useState(false);

  if (!schoolId) {
    return <NoSchoolFallback onSignOut={() => navigate({ to: "/login" })} />;
  }

  const activeCourses = (courses.data ?? []).filter((course) => course.status === "activo");
  const coveredCourses = new Set((subjects.data ?? []).flatMap((subject) => subject.courses)).size;

  return (
    <>
      <PageHeader
        title="Cursos y materias"
        subtitle="Estructura académica del colegio: cursos, materias y quién las imparte."
        actions={
          <Button icon={Plus} onClick={() => setWizardOpen(true)}>
            Nuevo curso
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          className="overflow-hidden"
          bodyClassName="p-0"
          title="Cursos del colegio"
          description={`${courses.isLoading ? "—" : activeCourses.length} cursos en el periodo vigente`}
        >
          {courses.isError ? (
            <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
              {courses.error.message}
            </p>
          ) : courses.isLoading ? (
            <div className="px-[18px] py-4" aria-hidden>
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-4 py-[11px]">
                  <span className="h-[11px] w-[150px] animate-pulse rounded bg-muted" />
                  <span className="h-[11px] w-[70px] animate-pulse rounded bg-muted" />
                  <span className="h-[11px] w-[70px] animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : (courses.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Sin cursos"
              description="Crea el primer curso del colegio para empezar a estructurar el año."
              action={
                <Button icon={Plus} onClick={() => setWizardOpen(true)}>
                  Nuevo curso
                </Button>
              }
            />
          ) : (
            <TableShell>
              <PanelTable className="w-full border-collapse">
                <caption className="sr-only">
                  Cursos del colegio, con sus materias, sus docentes y su estado
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={tableHeadClass}>
                      Curso
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Grado
                    </th>
                    <th scope="col" className={`${tableHeadClass} text-right`}>
                      Materias
                    </th>
                    <th scope="col" className={`${tableHeadClass} text-right`}>
                      Docentes
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Estado
                    </th>
                    <th scope="col" className={`${tableHeadClass} text-right`}>
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(courses.data ?? []).map((course) => (
                    <tr key={course.id} className="transition-colors hover:bg-muted">
                      <td className={tableCellClass}>
                        <p className="font-medium text-foreground">{course.name}</p>
                        <p className="text-[12px] text-muted-foreground">{course.grade_label}</p>
                      </td>
                      <td className={tableCellClass}>{course.grade_label}</td>
                      <td
                        className={`${tableCellClass} text-right font-mono text-[12.6px] text-foreground`}
                      >
                        {course.subject_count}
                      </td>
                      <td
                        className={`${tableCellClass} text-right font-mono text-[12.6px] text-foreground`}
                      >
                        {course.teacher_count}
                      </td>
                      <td className={tableCellClass}>
                        <Chip tone={course.status === "activo" ? "teal" : "muted"} dot>
                          {course.status === "activo" ? "Activo" : "Inactivo"}
                        </Chip>
                      </td>
                      <td className={`${tableCellClass} text-right`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate({ to: "/admin/asignaciones" })}
                        >
                          Abrir
                          <ChevronRight className="size-[15.5px]" strokeWidth={1.9} aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </PanelTable>
            </TableShell>
          )}
        </SectionCard>

        <SectionCard
          className="overflow-hidden"
          bodyClassName="p-0"
          title="Materias"
          description={`${subjects.isLoading ? "—" : (subjects.data?.length ?? 0)} materias · ${subjects.isLoading ? "—" : coveredCourses} cursos cubiertos`}
        >
          {subjects.isError ? (
            <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
              {subjects.error.message}
            </p>
          ) : subjects.isLoading ? (
            <div className="px-[18px] py-4" aria-hidden>
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3 py-[11px]">
                  <span className="h-[11px] w-[130px] animate-pulse rounded bg-muted" />
                  <span className="h-[18px] w-[64px] animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : (subjects.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Sin materias"
              description="Crea la primera materia para poder ofrecerla en los cursos."
            />
          ) : (
            <ul>
              {(subjects.data ?? []).map((subject) => (
                <li
                  key={subject.id}
                  className="border-b border-border px-[18px] py-[13px] last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen
                      className="size-[15px] shrink-0 text-primary"
                      strokeWidth={1.9}
                      aria-hidden
                    />
                    <span className="truncate text-[13.4px] font-medium">{subject.name}</span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {subject.area ?? "Sin área"}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[12.4px] text-foreground">
                      {subject.course_count}
                    </span>
                  </div>
                  {subject.courses.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-[23px]">
                      {subject.courses.map((course) => (
                        <Chip key={course} tone="muted">
                          {course}
                        </Chip>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* The foot of the view: the state of the system, so that a page
          is never a blank rectangle. */}
      <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <Chip tone="muted" dot>
          Sistema operativo
        </Chip>
        <span>Los conteos de materias y docentes se calculan en el servidor.</span>
      </p>

      {/* The whole structure is built in one form: course, subject and
          offering, one step after the other. */}
      <AcademicStructureWizard
        schoolId={schoolId}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </>
  );
}

function NoSchoolFallback({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className={cn("surface-card mx-auto max-w-md p-8 text-center")}>
      <h1 className="text-xl font-semibold">No hay colegio activo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tu cuenta no está asociada a un colegio. Pedile al administrador de tu institución que te
        invite.
      </p>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Cerrar sesion
      </button>
    </div>
  );
}
