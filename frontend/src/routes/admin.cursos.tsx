import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { BookOpen, ChevronRight, Link2, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Button,
  PanelTable,
  Chip,
  CollapsibleCard,
  EmptyState,
  PageHeader,
  SectionCard,
  TableShell,
  tableCellClass,
  tableHeadClass,
} from "@/components/ui-kit";
import { ConfirmDialog, useDeleteConfirmation } from "@/components/confirm-dialog";
import { Select } from "@/components/select-field";
import {
  useCourseSubjects,
  useCreateCourse,
  useCreateCourseSubject,
  useCreateSubject,
  useDeleteCourse,
  useDeleteCourseSubject,
  useDeleteSubject,
  useCourses,
  useSubjects,
} from "@/features/academics/hooks";
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

  // The write side keeps using the academic hooks: creating a course, a
  // subject or an offering is the same operation it always was.
  const academicCourses = useCourses(schoolId);
  const academicSubjects = useSubjects(schoolId);
  const courseSubjects = useCourseSubjects(schoolId);
  const createCourse = useCreateCourse(schoolId ?? "");
  const deleteCourse = useDeleteCourse(schoolId ?? "");
  const createSubject = useCreateSubject(schoolId ?? "");
  const deleteSubject = useDeleteSubject(schoolId ?? "");
  const createCourseSubject = useCreateCourseSubject(schoolId ?? "");
  const deleteCourseSubject = useDeleteCourseSubject(schoolId ?? "");

  const [name, setName] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectArea, setSubjectArea] = useState("");
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const courseToDelete = useDeleteConfirmation();
  const subjectToDelete = useDeleteConfirmation();
  const offeringToDelete = useDeleteConfirmation();

  // The three creation boxes fold away. They start closed, and the form
  // keeps what was typed in it when they are opened again.
  const [openBoxes, setOpenBoxes] = useState({ course: false, subject: false, offer: false });
  function toggleBox(box: keyof typeof openBoxes) {
    setOpenBoxes((current) => ({ ...current, [box]: !current[box] }));
  }

  const courseOptions = useMemo(
    () =>
      (academicCourses.data ?? []).map((course) => ({
        value: course.id,
        label: course.name,
        hint: course.grade_label,
      })),
    [academicCourses.data],
  );

  const subjectOptions = useMemo(
    () =>
      (academicSubjects.data ?? []).map((subject) => ({
        value: subject.id,
        label: subject.name,
        hint: subject.area ?? undefined,
      })),
    [academicSubjects.data],
  );

  // The pairs already offered, so the form does not offer what exists.
  const offeredPairs = useMemo(
    () => new Set((courseSubjects.data ?? []).map((cs) => `${cs.course_id}:${cs.subject_id}`)),
    [courseSubjects.data],
  );

  // A subject already offered in the selected course cannot be offered again.
  const availableSubjects = useMemo(
    () =>
      subjectOptions.map((option) => ({
        ...option,
        disabled: courseId ? offeredPairs.has(`${courseId}:${option.value}`) : false,
      })),
    [subjectOptions, courseId, offeredPairs],
  );

  const coursesBySubject = useMemo(() => {
    const map = new Map<string, { id: string; courseName: string }[]>();
    for (const cs of courseSubjects.data ?? []) {
      const list = map.get(cs.subject_id) ?? [];
      list.push({ id: cs.id, courseName: cs.course_name });
      map.set(cs.subject_id, list);
    }
    return map;
  }, [courseSubjects.data]);

  if (!schoolId) {
    return <NoSchoolFallback onSignOut={() => navigate({ to: "/login" })} />;
  }

  async function onCreateCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !gradeLabel.trim()) return;
    await createCourse.mutateAsync({
      name: name.trim(),
      grade_label: gradeLabel.trim(),
    });
    setName("");
    setGradeLabel("");
  }

  async function onCreateSubject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subjectName.trim()) return;
    await createSubject.mutateAsync({
      name: subjectName.trim(),
      area: subjectArea.trim() || null,
    });
    setSubjectName("");
    setSubjectArea("");
  }

  async function onOfferSubject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseId || !subjectId) return;
    await createCourseSubject.mutateAsync({ course_id: courseId, subject_id: subjectId });
    setSubjectId("");
  }

  const activeCourses = (courses.data ?? []).filter((course) => course.status === "activo");
  const coveredCourses = new Set((subjects.data ?? []).flatMap((subject) => subject.courses)).size;

  return (
    <>
      <PageHeader
        title="Cursos y materias"
        subtitle="Estructura académica del colegio: cursos, materias y quién las imparte."
        actions={
          <Button icon={Plus} onClick={() => toggleBox("course")}>
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
                <Button icon={Plus} onClick={() => toggleBox("course")}>
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
                      <td className={`${tableCellClass} font-medium text-foreground`}>
                        {course.name}
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

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <CollapsibleCard
            title="Nuevo curso"
            open={openBoxes.course}
            onToggle={() => toggleBox("course")}
          >
            <form className="space-y-3" onSubmit={onCreateCourse}>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Nombre
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="4to A"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Etiqueta de grado
                </span>
                <input
                  type="text"
                  value={gradeLabel}
                  onChange={(e) => setGradeLabel(e.target.value)}
                  required
                  placeholder="Cuarto"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <button
                type="submit"
                disabled={createCourse.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="size-4" />
                {createCourse.isPending ? "Creando..." : "Crear curso"}
              </button>
              {createCourse.error && (
                <p role="alert" className="text-sm text-destructive">
                  {createCourse.error.message}
                </p>
              )}
            </form>
          </CollapsibleCard>

          <CollapsibleCard
            title="Nueva materia"
            open={openBoxes.subject}
            onToggle={() => toggleBox("subject")}
          >
            <form className="space-y-3" onSubmit={onCreateSubject}>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Nombre de la materia
                </span>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  required
                  placeholder="Matemáticas"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Área
                </span>
                <input
                  type="text"
                  list="areas-sugeridas"
                  value={subjectArea}
                  onChange={(e) => setSubjectArea(e.target.value)}
                  placeholder="Matemáticas"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <datalist id="areas-sugeridas">
                  {SUGGESTED_AREAS.map((area) => (
                    <option key={area} value={area} />
                  ))}
                </datalist>
              </label>
              <button
                type="submit"
                disabled={createSubject.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="size-4" />
                {createSubject.isPending ? "Creando..." : "Crear materia"}
              </button>
              {createSubject.error && (
                <p role="alert" className="text-sm text-destructive">
                  {createSubject.error.message}
                </p>
              )}
            </form>
          </CollapsibleCard>

          <CollapsibleCard
            title="Ofrecer materia en un curso"
            description="Las materias ofrecidas en un curso son las que después se asignan a docentes."
            open={openBoxes.offer}
            onToggle={() => toggleBox("offer")}
          >
            <form className="space-y-3" onSubmit={onOfferSubject}>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Curso
                </span>
                <div className="mt-1.5">
                  <Select
                    value={courseId}
                    onChange={setCourseId}
                    options={courseOptions}
                    placeholder={courseOptions.length ? "Elige un curso" : "Primero crea un curso"}
                    emptyLabel="Todavía no hay cursos"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Materia
                </span>
                <div className="mt-1.5">
                  <Select
                    value={subjectId}
                    onChange={setSubjectId}
                    options={availableSubjects}
                    placeholder={
                      availableSubjects.length ? "Elige una materia" : "Primero crea una materia"
                    }
                    emptyLabel="Todavía no hay materias"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={createCourseSubject.isPending || !courseId || !subjectId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Link2 className="size-4" />
                {createCourseSubject.isPending ? "Ofreciendo..." : "Ofrecer materia"}
              </button>
              {createCourseSubject.error && (
                <p role="alert" className="text-sm text-destructive">
                  {createCourseSubject.error.message}
                </p>
              )}
            </form>
          </CollapsibleCard>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="Materias y cursos" bodyClassName="p-0">
            {courseSubjects.isLoading ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Cargando la estructura...</p>
            ) : courseSubjects.error ? (
              <p role="alert" className="px-5 py-6 text-sm text-destructive">
                {courseSubjects.error.message}
              </p>
            ) : (courseSubjects.data ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Todavía no hay materias ofrecidas en los cursos. Ofrece la primera con el formulario
                de la izquierda.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(academicSubjects.data ?? []).map((subject) => {
                  const offeredIn = coursesBySubject.get(subject.id) ?? [];
                  return (
                    <li
                      key={subject.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-5 py-3.5"
                    >
                      <div className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <BookOpen
                            className="size-4 shrink-0 text-primary"
                            strokeWidth={1.9}
                            aria-hidden
                          />
                          <span className="truncate font-medium">{subject.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {subject.area ?? "Sin área"}
                          </span>
                        </span>
                        {offeredIn.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
                            {offeredIn.map((course) => (
                              <span
                                key={course.id}
                                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                              >
                                {course.courseName}
                                <button
                                  type="button"
                                  onClick={() =>
                                    offeringToDelete.ask({
                                      id: course.id,
                                      title: `"${subject.name}" de "${course.courseName}"`,
                                      description:
                                        "La materia deja de ofrecerse en ese curso. También se borran los docentes asignados, los contenidos, las tareas y las notas que dependan de ella.",
                                      confirmLabel: "Quitar materia",
                                    })
                                  }
                                  disabled={deleteCourseSubject.isPending}
                                  aria-label={`Quitar ${subject.name} de ${course.courseName}`}
                                  className="rounded-full p-0.5 hover:bg-background hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 pl-6 text-xs text-muted-foreground">
                            No ofrecida en ningún curso todavía.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          subjectToDelete.ask({
                            id: subject.id,
                            title: `la materia "${subject.name}"`,
                            description:
                              "Se borra la materia y todas las veces que estaba ofrecida en cursos, con los docentes y las notas asociadas. Esta acción no se puede deshacer.",
                          })
                        }
                        disabled={deleteSubject.isPending}
                        className={cn(
                          "rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60",
                        )}
                        aria-label={`Eliminar ${subject.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {deleteSubject.error && (
              <p role="alert" className="px-5 py-4 text-sm text-destructive">
                {deleteSubject.error.message}
              </p>
            )}
            {deleteCourseSubject.error && (
              <p role="alert" className="px-5 py-4 text-sm text-destructive">
                {deleteCourseSubject.error.message}
              </p>
            )}
          </SectionCard>

          <SectionCard title="Cursos" bodyClassName="p-0">
            {academicCourses.isLoading ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Cargando cursos...</p>
            ) : academicCourses.error ? (
              <p role="alert" className="px-5 py-6 text-sm text-destructive">
                {academicCourses.error.message}
              </p>
            ) : (academicCourses.data ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Todavía no hay cursos. Crea el primero con el formulario de la izquierda.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(academicCourses.data ?? []).map((course) => (
                  <li
                    key={course.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{course.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{course.grade_label}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        courseToDelete.ask({
                          id: course.id,
                          title: `el curso "${course.name}"`,
                          description:
                            "Se borra el curso y todas las materias que tenías ofrecidas en él, con sus docentes, contenidos y notas. Esta acción no se puede deshacer.",
                        })
                      }
                      disabled={deleteCourse.isPending}
                      className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Eliminar ${course.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {deleteCourse.error && (
              <p role="alert" className="px-5 py-4 text-sm text-destructive">
                {deleteCourse.error.message}
              </p>
            )}
          </SectionCard>
        </div>
      </div>

      {/* The foot of the view: the state of the system, so that a page
          is never a blank rectangle. */}
      <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <Chip tone="muted" dot>
          Sistema operativo
        </Chip>
        <span>Los conteos de materias y docentes se calculan en el servidor.</span>
      </p>

      <ConfirmDialog
        open={courseToDelete.target !== null}
        title={`Eliminar ${courseToDelete.target?.title ?? ""}`}
        description={courseToDelete.target?.description}
        pending={deleteCourse.isPending}
        onCancel={courseToDelete.close}
        onConfirm={() => {
          const id = courseToDelete.target?.id;
          if (!id) return;
          deleteCourse.mutate(id, { onSuccess: courseToDelete.close });
        }}
      />
      <ConfirmDialog
        open={subjectToDelete.target !== null}
        title={`Eliminar ${subjectToDelete.target?.title ?? ""}`}
        description={subjectToDelete.target?.description}
        pending={deleteSubject.isPending}
        onCancel={subjectToDelete.close}
        onConfirm={() => {
          const id = subjectToDelete.target?.id;
          if (!id) return;
          deleteSubject.mutate(id, { onSuccess: subjectToDelete.close });
        }}
      />
      <ConfirmDialog
        open={offeringToDelete.target !== null}
        title={`Quitar ${offeringToDelete.target?.title ?? ""}`}
        description={offeringToDelete.target?.description}
        confirmLabel={offeringToDelete.target?.confirmLabel ?? "Quitar materia"}
        pending={deleteCourseSubject.isPending}
        onCancel={offeringToDelete.close}
        onConfirm={() => {
          const id = offeringToDelete.target?.id;
          if (!id) return;
          deleteCourseSubject.mutate(id, { onSuccess: offeringToDelete.close });
        }}
      />
    </>
  );
}

const SUGGESTED_AREAS = [
  "Matemáticas",
  "Lengua",
  "Ciencias",
  "Sociales",
  "Inglés",
  "Arte",
  "Educación Física",
];

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
