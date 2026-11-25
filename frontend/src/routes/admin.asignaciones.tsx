import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { ClipboardList, GraduationCap, Link2, Plus } from "lucide-react";
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
  Toolbar,
  tableCellClass,
  tableHeadClass,
} from "@/components/ui-kit";
import { ConfirmDialog, useDeleteConfirmation } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { MemberAvatar } from "@/components/member-avatar";
import { Select } from "@/components/select-field";
import {
  AssignmentSubjectChips,
  type AssignmentChipItem,
} from "@/features/admin/assignment-subject-chips";
import {
  useCourseSubjects,
  useCreateTeacherAssignment,
  useDeleteTeacherAssignment,
  useSchoolMembers,
  useUpdateTeacherAssignment,
} from "@/features/academics/hooks";
import { paginate } from "@/lib/pagination";
import { useSchoolAssignments, type SchoolAssignment } from "@/lib/school/cycles";
import { useSchoolCourses } from "@/lib/school/community";

export const Route = createFileRoute("/admin/asignaciones")({
  head: () => ({
    meta: [
      { title: "Asignaciones — Lumen" },
      {
        name: "description",
        content:
          "Vincula docentes con cursos y materias. Cada asignación habilita el acceso al contenido.",
      },
      { property: "og:title", content: "Asignaciones — Lumen" },
      {
        property: "og:description",
        content: "Vincula docentes con cursos y materias en pocos clics.",
      },
    ],
  }),
  component: AsignacionesPage,
});

/** How many teachers are on a page. */
const PAGE_SIZE = 10;

function AsignacionesPage() {
  const { session } = useRouteContext({ from: "/admin/asignaciones" });
  const schoolId = session.primarySchoolId;

  const [teacherFilter, setTeacherFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  // The page of the list of teachers.
  const [page, setPage] = useState(1);
  const assignments = useSchoolAssignments(
    teacherFilter === "all" ? undefined : teacherFilter,
    courseFilter === "all" ? undefined : courseFilter,
  );

  // The write side keeps using the academic hooks: an assignment is the
  // same operation it always was.
  const courseSubjects = useCourseSubjects(schoolId);
  const teachers = useSchoolMembers(schoolId, "teacher");
  const courses = useSchoolCourses();
  const createAssignment = useCreateTeacherAssignment(schoolId ?? "");
  const updateAssignment = useUpdateTeacherAssignment(schoolId ?? "");
  const deleteAssignment = useDeleteTeacherAssignment(schoolId ?? "");

  // The form is the same for creating and for editing: what changes is
  // what it holds and what the button says.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolAssignment | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [courseSubjectId, setCourseSubjectId] = useState("");
  const [justAssigned, setJustAssigned] = useState<string | null>(null);

  // Removing an assignment asks for confirmation: the teacher stops
  // seeing the content of that subject.
  const assignmentToDelete = useDeleteConfirmation();

  const teacherOptions = useMemo(
    () =>
      (teachers.data ?? []).map((teacher) => ({
        value: teacher.user_id,
        label: teacher.full_name,
        hint: teacher.email ?? undefined,
      })),
    [teachers.data],
  );

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

  const noTeachers = teacherOptions.length === 0;
  const noCourseSubjects = courseSubjectOptions.length === 0;

  // One row per teacher, not one per assignment: the person is the
  // one that repeats, and what matters is what each one teaches.
  const byTeacher = useMemo(() => {
    const groups = new Map<
      string,
      {
        teacherId: string;
        name: string;
        email: string | null;
        avatarUrl: string | null;
        assignments: SchoolAssignment[];
      }
    >();
    for (const assignment of assignments.data ?? []) {
      const group = groups.get(assignment.teacher_id) ?? {
        teacherId: assignment.teacher_id,
        name: assignment.teacher_name ?? "Docente",
        email: assignment.teacher_email,
        avatarUrl: assignment.teacher_avatar_url,
        assignments: [],
      };
      group.assignments.push(assignment);
      groups.set(assignment.teacher_id, group);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments.data]);

  const totalAssignments = (assignments.data ?? []).length;

  // The rows are the teachers: the list is cut in pages, so the view
  // keeps its place when the school grows.
  const teacherPage = paginate(byTeacher, page, PAGE_SIZE);
  const visibleGroups = teacherPage.items;

  function openCreate() {
    setEditing(null);
    setTeacherId("");
    setCourseSubjectId("");
    setJustAssigned(null);
    setFormOpen(true);
  }

  function openEdit(assignment: SchoolAssignment) {
    setEditing(assignment);
    setTeacherId(assignment.teacher_id);
    setCourseSubjectId(assignment.course_subject_id);
    setJustAssigned(null);
    setFormOpen(true);
  }

  /** Removing an assignment asks for confirmation: the teacher stops
      seeing the content of that subject. */
  function askRemoveAssignment(assignment: SchoolAssignment) {
    assignmentToDelete.ask({
      id: assignment.id,
      title: `la asignación de ${
        assignment.teacher_name ?? "el docente"
      } a ${assignment.subject_name}`,
      description:
        "El docente deja de tener esa materia asignada y deja de ver su material. Los contenidos y las tareas que ya subió se conservan.",
      confirmLabel: "Quitar asignación",
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teacherId || !courseSubjectId) return;

    if (editing) {
      await updateAssignment.mutateAsync({
        id: editing.id,
        patch: { teacher_id: teacherId, course_subject_id: courseSubjectId },
      });
      setJustAssigned("Cambios guardados");
    } else {
      await createAssignment.mutateAsync({
        course_subject_id: courseSubjectId,
        teacher_id: teacherId,
      });
      setJustAssigned("Asignación creada");
    }
    setFormOpen(false);
    setEditing(null);
  }

  const pending = createAssignment.isPending || updateAssignment.isPending;

  return (
    <>
      <PageHeader
        title="Asignaciones"
        subtitle="Vincula docentes con cursos y materias. Cada asignación habilita el acceso al contenido."
        actions={
          <Button icon={Plus} onClick={openCreate}>
            Nueva asignación
          </Button>
        }
      />

      {/* The form lives in a modal: the list of the assignments does not
          move when the admin opens it. */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[16px]">
              {editing ? "Editar asignación" : "Nueva asignación"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "El docente deja de ver el material de la materia anterior y empieza a ver el de la nueva."
                : "La asignación habilita el acceso del docente al material de esa materia."}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Docente
                </span>
                <div className="mt-1.5">
                  <Select
                    value={teacherId}
                    onChange={setTeacherId}
                    options={teacherOptions}
                    placeholder={noTeachers ? "No hay docentes" : "Elige un docente"}
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
                    value={courseSubjectId}
                    onChange={setCourseSubjectId}
                    options={courseSubjectOptions}
                    placeholder={
                      noCourseSubjects ? "No hay materias de cursos" : "Elige curso y materia"
                    }
                    emptyLabel="Todavía no hay materias ofrecidas en los cursos"
                  />
                </div>
              </label>
            </div>

            {noTeachers && (
              <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
                <GraduationCap className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Todavía no hay docentes. Crea uno desde <strong>Docentes</strong> para poder
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

            {(createAssignment.error || updateAssignment.error) && (
              <p role="alert" className="text-[13px] text-destructive">
                {(createAssignment.error ?? updateAssignment.error)?.message}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditing(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                icon={Link2}
                disabled={pending || !teacherId || !courseSubjectId}
              >
                {pending
                  ? "Guardando..."
                  : editing
                    ? "Guardar cambios"
                    : "Asignar docente a la materia"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {justAssigned && (
        <p role="status" className="mb-3 text-[13px] text-success">
          {justAssigned}
        </p>
      )}

      <SectionCard className="overflow-hidden" bodyClassName="p-0">
        <Toolbar>
          <select
            value={teacherFilter}
            onChange={(event) => setTeacherFilter(event.target.value)}
            aria-label="Filtrar por docente"
            className="rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
          >
            <option value="all">Todos los docentes</option>
            {teacherOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value)}
            aria-label="Filtrar por curso"
            className="rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
          >
            <option value="all">Todos los cursos</option>
            {(courses.data ?? []).map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>

          <div className="ml-auto">
            <Chip tone="muted">
              {assignments.data
                ? `${byTeacher.length} docente(s) · ${totalAssignments} asignación(es)`
                : "—"}
            </Chip>
          </div>
        </Toolbar>

        {assignments.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {assignments.error.message}
          </p>
        ) : assignments.isLoading ? (
          <div className="px-[18px] py-4" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-4 py-[11px]">
                <span className="h-[11px] w-[190px] animate-pulse rounded bg-muted" />
                <span className="h-[11px] w-[90px] animate-pulse rounded bg-muted" />
                <span className="h-[11px] w-[110px] animate-pulse rounded bg-muted" />
                <span className="h-[18px] w-[92px] animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : (assignments.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin asignaciones"
            description="Vincula un docente con un curso y una materia para que tenga acceso al contenido."
            action={
              <Button icon={Plus} onClick={openCreate}>
                Nueva asignación
              </Button>
            }
          />
        ) : (
          <TableShell>
            <PanelTable className="w-full border-collapse">
              <caption className="sr-only">
                Docentes del colegio y las materias que tiene asignadas
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={tableHeadClass}>
                    Docente
                  </th>
                  <th scope="col" className={tableHeadClass}>
                    Materias asignadas
                  </th>
                  <th scope="col" className={`${tableHeadClass} text-right`}>
                    Material
                  </th>
                  <th scope="col" className={`${tableHeadClass} text-right`}>
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map((group) => (
                  <tr key={group.teacherId} className="transition-colors hover:bg-muted">
                    <td className={tableCellClass}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <MemberAvatar name={group.name} avatarUrl={group.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{group.name}</p>
                          <p className="truncate text-[12px] text-muted-foreground">
                            {group.email ?? "Sin correo"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      {/* What the teacher teaches: one chip and the
                          count of the rest, so the person is not
                          repeated and the row does not grow. */}
                      <AssignmentSubjectChips
                        items={group.assignments.map((assignment) => ({
                          id: assignment.id,
                          courseName: assignment.course_name,
                          subjectName: assignment.subject_name,
                        }))}
                        who={group.name}
                        onEdit={(item) => {
                          const assignment = group.assignments.find((one) => one.id === item.id);
                          if (assignment) openEdit(assignment);
                        }}
                        onRemove={(item) => {
                          const assignment = group.assignments.find((one) => one.id === item.id);
                          if (assignment) askRemoveAssignment(assignment);
                        }}
                      />
                    </td>
                    <td
                      className={`${tableCellClass} text-right font-mono text-[12.6px] text-foreground`}
                    >
                      {group.assignments.reduce(
                        (total, assignment) => total + assignment.visible_materials_count,
                        0,
                      )}
                    </td>
                    <td className={`${tableCellClass} text-right`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Plus}
                        onClick={() => {
                          openCreate();
                          setTeacherId(group.teacherId);
                        }}
                      >
                        Asignar otra
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </PanelTable>
          </TableShell>
        )}
        {deleteAssignment.error && (
          <p role="alert" className="px-[18px] py-4 text-[13px] text-destructive">
            {deleteAssignment.error.message}
          </p>
        )}
        {(assignments.data?.length ?? 0) > 0 && (
          <Pagination
            page={teacherPage.page}
            pageCount={teacherPage.pageCount}
            total={teacherPage.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </SectionCard>

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
          deleteAssignment.mutate(id, {
            onSuccess: () => {
              setJustAssigned("Asignación quitada");
              assignmentToDelete.close();
            },
          });
        }}
      />

      {/* The foot of the view: the state of the system, so that a page
          is never a blank rectangle. */}
      <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <Chip tone="muted" dot>
          Sistema operativo
        </Chip>
        <span>
          Cada docente aparece una sola vez con todas sus materias: cada asignación habilita el
          acceso del docente al material de esa materia, que es lo que abre el contenido que el
          equipo de plataforma habilitó para el colegio.
        </span>
      </p>
    </>
  );
}
