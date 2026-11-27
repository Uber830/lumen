import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { BookOpen, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Button,
  PanelTable,
  Chip,
  EmptyState,
  PageHeader,
  Pagination,
  SectionCard,
  TableShell,
  tableCellClass,
  tableHeadClass,
} from "@/components/ui-kit";
import { ConfirmDialog, useDeleteConfirmation } from "@/components/confirm-dialog";
import { AcademicStructureWizard } from "@/features/admin/academic-wizard";
import {
  CourseSubjectsDialog,
  type CourseSubjectItem,
} from "@/features/admin/course-subjects-dialog";
import {
  useCourseSubjects,
  useDeleteCourse,
  useDeleteCourseSubject,
  useDeleteSubject,
} from "@/features/academics/hooks";
import type { CourseSubjectSummary } from "@/features/academics/types";
import { useSchoolCoursesPage, useSchoolSubjects } from "@/lib/school/community";
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

/** How many courses are on a page. */
const PAGE_SIZE = 10;

/**
 * What is being removed.
 *
 * A course goes with its offerings and with the assignments of its
 * teachers; a subject goes with the courses that offer it; an offering
 * is just the pair (course, subject).
 */
type Removal =
  | { kind: "curso"; id: string; title: string; name: string; courses: number }
  | { kind: "materia"; id: string; title: string; name: string; courses: number }
  | { kind: "oferta"; id: string; title: string; name: string; course: string };

function CursosPage() {
  const navigate = useNavigate();
  const { session } = useRouteContext({ from: "/admin/cursos" });
  const schoolId = session.primarySchoolId;

  // The creation of the structure happens in one big form: course,
  // subject and offering, one step after the other.
  const [wizardOpen, setWizardOpen] = useState(false);
  // The course whose subjects are open in the modal.
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  // The pages of the two lists.
  const [page, setPage] = useState(1);
  const [orphanPageNumber, setOrphanPage] = useState(1);

  // The read side comes from the panel's own endpoints: the counts of
  // subjects and teachers per course are computed in the server, and
  // so is the page of the list.
  const courses = useSchoolCoursesPage(page);
  // The subjects that are in no course: the server knows which ones
  // are offered and which ones are not.
  const subjects = useSchoolSubjects({ offered: false, page: orphanPageNumber });
  // The offerings: the pairs (curso, materia) the school has.
  const courseSubjects = useCourseSubjects(schoolId);

  const deleteCourse = useDeleteCourse(schoolId ?? "");
  const deleteSubject = useDeleteSubject(schoolId ?? "");
  const deleteOffering = useDeleteCourseSubject(schoolId ?? "");
  const removal = useDeleteConfirmation<Removal>();

  // The offerings of each course: the modal of the course shows them.
  const offeringsByCourse = useMemo(() => {
    const map = new Map<string, CourseSubjectSummary[]>();
    for (const offering of courseSubjects.data ?? []) {
      map.set(offering.course_id, [...(map.get(offering.course_id) ?? []), offering]);
    }
    return map;
  }, [courseSubjects.data]);

  if (!schoolId) {
    return <NoSchoolFallback onSignOut={() => navigate({ to: "/login" })} />;
  }

  // The page of the courses and the page of the subjects that are in
  // no course: the server cuts both.
  const courseList = courses.data?.items ?? [];
  const visibleCourses = courseList;
  const orphanSubjects = subjects.data?.items ?? [];
  const visibleOrphans = orphanSubjects;

  // The course whose subjects the modal shows.
  const openCourse = openCourseId
    ? (courseList.find((course) => course.id === openCourseId) ?? null)
    : null;
  const openCourseSubjects: CourseSubjectItem[] = openCourse
    ? (offeringsByCourse.get(openCourse.id) ?? []).map((offering) => ({
        id: offering.id,
        subjectName: offering.subject_name,
        area: offering.subject_area ?? null,
        assignedTeachers: offering.assigned_teachers,
      }))
    : [];

  function askRemoveCourse(courseId: string, name: string) {
    const offered = offeringsByCourse.get(courseId)?.length ?? 0;
    removal.ask({
      id: courseId,
      title: name,
      kind: "curso",
      name,
      courses: offered,
    });
  }

  function askRemoveSubject(subjectId: string, name: string) {
    const offered = (courseSubjects.data ?? []).filter(
      (offering) => offering.subject_id === subjectId,
    ).length;
    removal.ask({
      id: subjectId,
      title: name,
      kind: "materia",
      name,
      courses: offered,
    });
  }

  function askRemoveOffering(offeringId: string, subjectName: string, courseName: string) {
    removal.ask({
      id: offeringId,
      title: subjectName,
      kind: "oferta",
      name: subjectName,
      course: courseName,
    });
  }

  async function onRemove() {
    const target = removal.target;
    if (!target) return;
    try {
      if (target.kind === "curso") {
        await deleteCourse.mutateAsync(target.id);
      } else if (target.kind === "materia") {
        await deleteSubject.mutateAsync(target.id);
      } else {
        await deleteOffering.mutateAsync(target.id);
      }
      removal.close();
    } catch {
      // The error is shown by the dialog, in Spanish.
    }
  }

  // What is about to be lost: the modal says it in words.
  const removalTitle = (() => {
    if (!removal.target) return "Quitar";
    if (removal.target.kind === "curso") return `Quitar el curso ${removal.target.name}`;
    if (removal.target.kind === "materia") return `Quitar la materia ${removal.target.name}`;
    return `Quitar ${removal.target.name} de ${removal.target.course}`;
  })();

  const removalConfirmLabel = (() => {
    if (!removal.target) return "Quitar";
    if (removal.target.kind === "curso") return "Quitar el curso";
    if (removal.target.kind === "materia") return "Quitar la materia";
    return "Quitar del curso";
  })();

  const removalDescription = (() => {
    const target = removal.target;
    if (!target) return undefined;
    if (target.kind === "curso") {
      const offered =
        target.courses > 0
          ? `Sus ${target.courses} materia(s) ofrecidas y las asignaciones de los docentes que las impartían se borran con él.`
          : "No tiene materias ofrecidas.";
      return `El curso ${target.name} se borra del colegio. ${offered} El material ya subido se conserva.`;
    }
    if (target.kind === "materia") {
      const offered =
        target.courses > 0 ? ` y de los ${target.courses} curso(s) donde estaba ofrecida` : "";
      return `La materia ${target.name} se borra del colegio${offered}.`;
    }
    return `La materia deja de ofrecerse en ${target.course}.`;
  })();

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

      <SectionCard
        className="mb-5 overflow-hidden"
        bodyClassName="p-0"
        title="Cursos del colegio"
        description={`${courses.isLoading ? "—" : (courses.data?.total ?? 0)} cursos en el colegio`}
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
        ) : (courses.data?.total ?? 0) === 0 ? (
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
          <>
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
                    <th scope="col" className={tableHeadClass}>
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
                  {visibleCourses.map((course) => {
                    const offerings = offeringsByCourse.get(course.id) ?? [];
                    return (
                      <tr key={course.id} className="transition-colors hover:bg-muted">
                        <td className={tableCellClass}>
                          <p className="font-medium text-foreground">{course.name}</p>
                          <p className="text-[12px] text-muted-foreground">{course.grade_label}</p>
                        </td>
                        <td className={tableCellClass}>{course.grade_label}</td>
                        <td className={tableCellClass}>
                          {/* The subjects of the course live in a modal:
                              the table does not move when it opens. */}
                          <button
                            type="button"
                            onClick={() => setOpenCourseId(course.id)}
                            className="inline-flex items-center gap-1.5 rounded-idx border border-border bg-card px-2.5 py-1 text-[12.4px] font-medium text-foreground transition-colors hover:border-foreground/40 hover:bg-secondary"
                          >
                            {offerings.length === 0
                              ? "Sin materias"
                              : `${offerings.length} materia${offerings.length === 1 ? "" : "s"}`}
                            <ChevronRight
                              className="size-3.5 shrink-0 text-muted-foreground"
                              strokeWidth={1.9}
                              aria-hidden
                            />
                          </button>
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
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate({ to: "/admin/asignaciones" })}
                            >
                              Asignar
                              <ChevronRight
                                className="size-[15.5px]"
                                strokeWidth={1.9}
                                aria-hidden
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              onClick={() => askRemoveCourse(course.id, course.name)}
                            >
                              Quitar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </PanelTable>
            </TableShell>

            <Pagination
              page={courses.data?.page ?? 1}
              pageCount={courses.data?.pages ?? 0}
              total={courses.data?.total ?? 0}
              pageSize={courses.data?.per_page ?? PAGE_SIZE}
              onPageChange={setPage}
              always
            />
          </>
        )}
      </SectionCard>

      {/* The subjects that are in no course: without this list they
          would not be seen anywhere and could never be removed. */}
      {orphanSubjects.length > 0 && (
        <SectionCard
          className="overflow-hidden"
          bodyClassName="p-0"
          title="Materias sin curso"
          description="No están ofrecidas en ningún curso: ofrece la que quieras usar o quítala."
        >
          <ul>
            {visibleOrphans.map((subject) => (
              <li
                key={subject.id}
                className="flex flex-wrap items-center gap-2.5 border-b border-border px-[18px] py-[13px] last:border-b-0"
              >
                <BookOpen
                  className="size-[15px] shrink-0 text-muted-foreground"
                  strokeWidth={1.9}
                  aria-hidden
                />
                <span className="truncate text-[13.4px] font-medium">{subject.name}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {subject.area ?? "Sin área"}
                </span>
                <div className="ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => askRemoveSubject(subject.id, subject.name)}
                  >
                    Quitar la materia
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={subjects.data?.page ?? 1}
            pageCount={subjects.data?.pages ?? 0}
            total={subjects.data?.total ?? 0}
            pageSize={subjects.data?.per_page ?? PAGE_SIZE}
            onPageChange={setOrphanPage}
            always
          />
        </SectionCard>
      )}

      {/* The foot of the view: the state of the system, so that a page
          is never a blank rectangle. */}
      <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span>Los conteos de materias y docentes se calculan en el servidor.</span>
      </p>

      {/* The whole structure is built in one form: course, subject and
          offering, one step after the other. */}
      <AcademicStructureWizard
        schoolId={schoolId}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      {/* The subjects of a course, in a modal. */}
      <CourseSubjectsDialog
        open={openCourse !== null}
        onOpenChange={(open) => {
          if (!open) setOpenCourseId(null);
        }}
        courseName={openCourse?.name ?? ""}
        items={openCourseSubjects}
        onRemove={(item) => {
          const courseName = openCourse?.name ?? "el curso";
          // The modal closes first: the confirmation of the removal
          // opens on top of it, not behind it.
          setOpenCourseId(null);
          askRemoveOffering(item.id, item.subjectName, courseName);
        }}
      />

      <ConfirmDialog
        open={removal.target !== null}
        title={removalTitle}
        description={removalDescription}
        confirmLabel={removalConfirmLabel}
        pending={deleteCourse.isPending || deleteSubject.isPending || deleteOffering.isPending}
        onCancel={removal.close}
        onConfirm={() => {
          void onRemove();
        }}
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
