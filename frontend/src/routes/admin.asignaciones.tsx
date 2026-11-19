import { useRouteContext, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardList, GraduationCap, Plus, Trash2 } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { ConfirmDialog, useDeleteConfirmation } from "@/components/confirm-dialog";
import { MemberAvatar } from "@/components/member-avatar";
import { Select } from "@/components/select-field";
import {
  useCreateTeacherAssignment,
  useDeleteTeacherAssignment,
  useSchoolMembers,
  useTeacherAssignments,
  useCourseSubjects,
} from "@/features/academics/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/asignaciones")({
  head: () => ({
    meta: [
      { title: "Asignaciones — Lumen" },
      {
        name: "description",
        content: "Asigná docentes a materias y designá el docente encargado de cada curso.",
      },
      { property: "og:title", content: "Asignaciones — Lumen" },
      {
        property: "og:description",
        content: "Vinculá docentes con cursos y materias en pocos clics.",
      },
    ],
  }),
  component: AsignacionesPage,
});

function AsignacionesPage() {
  const { session } = useRouteContext({ from: "/admin/asignaciones" });
  const schoolId = session.primarySchoolId;

  const teacherAssignments = useTeacherAssignments(schoolId);
  const courseSubjects = useCourseSubjects(schoolId);
  const teachers = useSchoolMembers(schoolId, "teacher");
  const createAssignment = useCreateTeacherAssignment(schoolId ?? "");
  const deleteAssignment = useDeleteTeacherAssignment(schoolId ?? "");

  const [teacherId, setTeacherId] = useState<string>("");
  const [courseSubjectId, setCourseSubjectId] = useState<string>("");
  const [justAssigned, setJustAssigned] = useState<string | null>(null);

  // Removing an assignment asks for confirmation with the shared modal.
  const assignmentToDelete = useDeleteConfirmation();

  // The course subjects carry the names they are shown with, so there is
  // no need to join them with the courses and the subjects here.
  const courseSubjectOptions = useMemo(
    () =>
      (courseSubjects.data ?? []).map((cs) => ({
        value: cs.id,
        label: `${cs.course_name} · ${cs.subject_name}`,
        hint:
          cs.assigned_teachers > 0
            ? `${cs.assigned_teachers} docente(s) asignado(s)`
            : "Sin docentes",
      })),
    [courseSubjects.data],
  );

  const teacherOptions = useMemo(
    () =>
      (teachers.data ?? []).map((teacher) => ({
        value: teacher.user_id,
        label: teacher.full_name,
        hint: teacher.email ?? undefined,
      })),
    [teachers.data],
  );

  // The select falls back to the first available option while the user has
  // not picked one yet. Deriving the value beats syncing it through a
  // useEffect + setState: no extra render pass, and the select stays
  // consistent if the option list changes under us.
  const selectedTeacherId = teacherId || teacherOptions[0]?.value || "";
  const selectedCourseSubjectId = courseSubjectId || courseSubjectOptions[0]?.value || "";

  // The teachers already teaching the selected course subject cannot be
  // assigned again: the backend rejects the duplicate.
  const alreadyAssigned = useMemo(() => {
    const ids = new Set(
      (teacherAssignments.data ?? [])
        .filter((assignment) => assignment.course_subject_id === selectedCourseSubjectId)
        .map((assignment) => assignment.teacher_id),
    );
    return ids;
  }, [teacherAssignments.data, selectedCourseSubjectId]);

  const availableTeachers = useMemo(
    () =>
      teacherOptions.map((option) => ({
        ...option,
        disabled: alreadyAssigned.has(option.value),
      })),
    [teacherOptions, alreadyAssigned],
  );

  const teacherNameById = useMemo(
    () => new Map((teachers.data ?? []).map((t) => [t.user_id, t.full_name])),
    [teachers.data],
  );

  const teacherEmailById = useMemo(
    () => new Map((teachers.data ?? []).map((t) => [t.user_id, t.email ?? ""])),
    [teachers.data],
  );

  // The teacher's photo, when they uploaded one: the list shows it
  // instead of the generic icon.
  const teacherAvatarById = useMemo(
    () => new Map((teachers.data ?? []).map((t) => [t.user_id, t.avatar_url])),
    [teachers.data],
  );

  const courseSubjectLabelById = useMemo(
    () => new Map(courseSubjectOptions.map((option) => [option.value, option.label])),
    [courseSubjectOptions],
  );

  if (!schoolId) {
    return (
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">No hay colegio activo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no está asociada a un colegio.
        </p>
      </div>
    );
  }

  async function onAssign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeacherId || !selectedCourseSubjectId) return;
    const teacher = teacherNameById.get(selectedTeacherId) ?? selectedTeacherId;
    const courseSubject = courseSubjectLabelById.get(selectedCourseSubjectId) ?? "";
    await createAssignment.mutateAsync({
      course_subject_id: selectedCourseSubjectId,
      teacher_id: selectedTeacherId,
    });
    setJustAssigned(`${teacher} → ${courseSubject}`);
  }

  const noTeachers = teacherOptions.length === 0;
  const noCourseSubjects = courseSubjectOptions.length === 0;

  return (
    <>
      <PageHeader
        title="Asignaciones"
        subtitle="Vinculá docentes con cursos y materias"
        actions={<ClipboardList className="size-5 text-muted-foreground" aria-hidden />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Nueva asignación" className="lg:col-span-1">
          <form className="space-y-3" onSubmit={onAssign}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Docente
              </span>
              <div className="mt-1.5">
                <Select
                  value={selectedTeacherId}
                  onChange={setTeacherId}
                  options={availableTeachers}
                  placeholder={noTeachers ? "No hay docentes" : "Elegí un docente"}
                  emptyLabel="Todavía no hay docentes en el colegio"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Curso · Materia
              </span>
              <div className="mt-1.5">
                <Select
                  value={selectedCourseSubjectId}
                  onChange={setCourseSubjectId}
                  options={courseSubjectOptions}
                  placeholder={
                    noCourseSubjects ? "No hay materias de cursos" : "Elegí curso y materia"
                  }
                  emptyLabel="Todavía no hay materias ofrecidas en los cursos"
                />
              </div>
            </label>

            {noTeachers && (
              <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
                <GraduationCap className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Todavía no hay docentes. Creá uno desde <strong>Docentes</strong> para poder
                  asignarlo.
                </span>
              </p>
            )}

            {noCourseSubjects && (
              <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
                <ClipboardList className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  No hay materias ofrecidas en los cursos. Vas a <strong>Cursos y materias</strong>{" "}
                  para crear una y ofrecerla en un curso.
                </span>
              </p>
            )}

            <button
              type="submit"
              disabled={
                createAssignment.isPending || !selectedTeacherId || !selectedCourseSubjectId
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="size-4" />
              {createAssignment.isPending ? "Asignando..." : "Asignar"}
            </button>
            {createAssignment.error && (
              <p role="alert" className="text-sm text-destructive">
                {createAssignment.error.message}
              </p>
            )}
            {justAssigned && !createAssignment.error && (
              <p role="status" className="text-sm text-success">
                {justAssigned}
              </p>
            )}
          </form>
        </SectionCard>

        <SectionCard
          title="Asignaciones vigentes"
          description={`${teacherAssignments.data?.length ?? 0} docente(s) asignado(s)`}
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          {teacherAssignments.isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Cargando asignaciones...</p>
          ) : teacherAssignments.error ? (
            <p role="alert" className="px-5 py-6 text-sm text-destructive">
              {teacherAssignments.error.message}
            </p>
          ) : teacherAssignments.data && teacherAssignments.data.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Aun no hay asignaciones. Usa el formulario de la izquierda para crear la primera.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {teacherAssignments.data?.map((a) => (
                <li
                  key={a.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar
                      name={teacherNameById.get(a.teacher_id) ?? "Docente"}
                      avatarUrl={teacherAvatarById.get(a.teacher_id) ?? null}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {teacherNameById.get(a.teacher_id) ?? a.teacher_id}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {teacherEmailById.get(a.teacher_id) || "Sin correo"} ·{" "}
                        {courseSubjectLabelById.get(a.course_subject_id) ?? a.course_subject_id}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      assignmentToDelete.ask({
                        id: a.id,
                        title: `la asignación de ${
                          teacherNameById.get(a.teacher_id) ?? "el docente"
                        } a ${courseSubjectLabelById.get(a.course_subject_id) ?? "la materia"}`,
                        description:
                          "El docente deja de tener esa materia asignada. Los contenidos y las tareas que ya subió se conservan.",
                        confirmLabel: "Quitar asignación",
                      })
                    }
                    disabled={deleteAssignment.isPending}
                    className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Quitar asignación"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {deleteAssignment.error && (
            <p role="alert" className="px-5 py-4 text-sm text-destructive">
              {deleteAssignment.error.message}
            </p>
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        open={assignmentToDelete.target !== null}
        title={`Quitar ${assignmentToDelete.target?.title ?? "la asignación"}`}
        description={assignmentToDelete.target?.description}
        confirmLabel={assignmentToDelete.target?.confirmLabel ?? "Quitar asignación"}
        pending={deleteAssignment.isPending}
        onCancel={assignmentToDelete.close}
        onConfirm={() => {
          const id = assignmentToDelete.target?.id;
          if (!id) return;
          deleteAssignment.mutate(id, { onSuccess: assignmentToDelete.close });
        }}
      />
    </>
  );
}
