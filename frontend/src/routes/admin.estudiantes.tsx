import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { GraduationCap, KeyRound, Lock, Plus, Search } from "lucide-react";
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
import { Select } from "@/components/select-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { ActivationLinksCard, type ActivationLink } from "@/features/admin/activation-links";
import { BulkBar, SelectBox } from "@/features/admin/bulk-bar";
import { MemberEditDialog } from "@/features/admin/member-edit-dialog";
import { MemberManageDialog } from "@/features/admin/member-manage-dialog";
import type { SchoolMember } from "@/features/academics/types";
import { activationLink, useInviteUser, useUpdateMembership } from "@/lib/users/invitations";
import { useSchoolCourses, useSchoolStudents, type SchoolMemberRow } from "@/lib/school/community";
import { formatShortDate } from "@/lib/school/material";

export const Route = createFileRoute("/admin/estudiantes")({
  head: () => ({
    meta: [
      { title: "Estudiantes — Lumen" },
      {
        name: "description",
        content: "Matrícula, búsqueda y control de acceso de los estudiantes del colegio.",
      },
      { property: "og:title", content: "Estudiantes — Lumen" },
      {
        property: "og:description",
        content: "Administra la matrícula de tu institución.",
      },
    ],
  }),
  component: EstudiantesPage,
});

function EstudiantesPage() {
  const { session } = useRouteContext({ from: "/admin/estudiantes" });
  const schoolId = session.primarySchoolId;

  // The list is filtered and paginated in the server. The filter by
  // course is the one the administrator uses the most: the thinking
  // goes by courses, not by the whole list.
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [page, setPage] = useState(1);

  const students = useSchoolStudents({ q: query, status, course_id: courseId, page });
  const courses = useSchoolCourses();

  const invite = useInviteUser();
  const updateMembership = useUpdateMembership();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [newCourseId, setNewCourseId] = useState("");
  const [activations, setActivations] = useState<ActivationLink[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<SchoolMemberRow | null>(null);
  // The student whose edit form is open.
  const [editingStudent, setEditingStudent] = useState<SchoolMemberRow | null>(null);
  // The rows the administrator picked: the bar acts on all of them.
  const [picked, setPicked] = useState<string[]>([]);

  const total = students.data?.total ?? 0;

  const courseOptions = useMemo(
    () =>
      (courses.data ?? []).map((course) => ({
        value: course.id,
        label: course.name,
        hint: course.grade_label,
      })),
    [courses.data],
  );

  function asMember(row: SchoolMemberRow): SchoolMember {
    return {
      membership_id: row.membership_id,
      school_id: schoolId ?? "",
      user_id: row.user_id,
      role: "student",
      is_primary: true,
      joined_at: row.joined_at,
      full_name: row.full_name ?? "",
      email: row.email,
      phone: null,
      avatar_url: null,
      revoked_at: row.revoked_at,
      account_activated: row.account_activated,
      access: row.access,
      access_reason: row.access_reason,
      courses: row.courses,
      course_ids: row.course_ids,
      average: row.average,
    };
  }

  const applyQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const applyStatus = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const applyCourse = (value: string) => {
    setCourseId(value);
    setPage(1);
  };

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !fullName.trim() || !schoolId) return;
    const created = await invite.mutateAsync({
      email: email.trim(),
      full_name: fullName.trim(),
      role: "student",
      school_id: schoolId,
      is_primary: true,
      // The course the admin picked: the student is enrolled in it, so
      // it has material to see from the start.
      ...(newCourseId ? { course_ids: [newCourseId] } : {}),
    });
    const activationToken = created.activation_token;
    if (activationToken) {
      setActivations((prev) => [
        { email: created.email, link: activationLink(activationToken) },
        ...prev,
      ]);
    }
    setEmail("");
    setFullName("");
    setNewCourseId("");
    setOpen(false);
  }

  /** Turn the access of the picked students on or off. */
  async function onBulkAccess(revoked: boolean) {
    for (const membershipId of picked) {
      try {
        await updateMembership.mutateAsync({ membershipId, revoked });
      } catch {
        // The error of the last one is shown below the bar.
      }
    }
    setPicked([]);
  }

  return (
    <>
      <PageHeader
        title="Estudiantes"
        subtitle={`${students.isLoading ? "—" : total} estudiantes matriculados. Controla el acceso, el curso y el promedio.`}
        actions={
          <Button icon={Plus} onClick={() => setOpen(true)}>
            Nuevo estudiante
          </Button>
        }
      />

      <ActivationLinksCard
        links={activations}
        roleLabel="el estudiante"
        onHide={() => setActivations([])}
      />

      {/* The form lives in a modal: the list of the students does not
          move when the admin opens it. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo estudiante</DialogTitle>
            <DialogDescription>
              Entra con el acceso pendiente hasta que lo matricules en un curso.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={onCreate}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nombre completo
              </span>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Lucia Ferreyra"
                className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Correo institucional
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="estudiante@colegio.edu"
                className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Curso
              </span>
              <div className="mt-1.5">
                <Select
                  value={newCourseId}
                  onChange={setNewCourseId}
                  options={courseOptions}
                  placeholder={
                    courseOptions.length ? "Elige un curso (opcional)" : "Primero crea un curso"
                  }
                  emptyLabel="Todavía no hay cursos"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Si eliges un curso, el estudiante queda matriculado en él.
              </p>
            </label>
            {invite.error && (
              <p role="alert" className="text-[13px] text-destructive">
                {invite.error.message}
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Creando..." : "Crear estudiante"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SectionCard className="overflow-hidden" bodyClassName="p-0">
        <Toolbar>
          <div className="relative w-full max-w-[280px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.9}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => applyQuery(event.target.value)}
              placeholder="Buscar por nombre o correo"
              aria-label="Buscar por nombre o correo"
              className="w-full rounded-idx border border-input bg-card py-2 pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
          </div>

          <select
            value={status}
            onChange={(event) => applyStatus(event.target.value)}
            aria-label="Filtrar por estado"
            className="rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
          >
            <option value="all">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>

          <select
            value={courseId}
            onChange={(event) => applyCourse(event.target.value)}
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
            <Chip tone="muted">{students.data ? `${total} estudiantes` : "—"}</Chip>
          </div>
        </Toolbar>

        <BulkBar count={picked.length} onClear={() => setPicked([])}>
          <Button
            variant="outline"
            size="sm"
            icon={KeyRound}
            disabled={updateMembership.isPending}
            onClick={() => void onBulkAccess(false)}
          >
            Activar acceso
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={Lock}
            disabled={updateMembership.isPending}
            onClick={() => void onBulkAccess(true)}
          >
            Desactivar acceso
          </Button>
          {updateMembership.error && (
            <span role="alert" className="text-[12.5px] text-destructive">
              {updateMembership.error.message}
            </span>
          )}
        </BulkBar>

        {students.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {students.error.message}
          </p>
        ) : students.isLoading ? (
          <div className="px-[18px] py-4" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-4 py-[11px]">
                <span className="h-[11px] w-[180px] animate-pulse rounded bg-muted" />
                <span className="h-[11px] w-[150px] animate-pulse rounded bg-muted" />
                <span className="h-[11px] w-[90px] animate-pulse rounded bg-muted" />
                <span className="h-[18px] w-[74px] animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : (students.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Sin resultados"
            description="Ajusta los filtros o matricula al primer estudiante del colegio."
            action={
              <Button icon={Plus} onClick={() => setOpen(true)}>
                Nuevo estudiante
              </Button>
            }
          />
        ) : (
          <>
            <TableShell>
              <PanelTable className="w-full border-collapse">
                <caption className="sr-only">
                  Estudiantes del colegio, con su curso, su acceso y su promedio
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={`${tableHeadClass} w-[38px]`}>
                      <SelectBox
                        checked={
                          (students.data?.items.length ?? 0) > 0 &&
                          picked.length === students.data?.items.length
                        }
                        onChange={(checked) =>
                          setPicked(
                            checked
                              ? (students.data?.items ?? []).map((row) => row.membership_id)
                              : [],
                          )
                        }
                        label="Seleccionar todos los estudiantes"
                      />
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Estudiante
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Curso
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Ingreso
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Acceso
                    </th>
                    <th scope="col" className={`${tableHeadClass} text-right`}>
                      Promedio
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
                  {(students.data?.items ?? []).map((student) => (
                    <tr key={student.membership_id} className="transition-colors hover:bg-muted">
                      <td className={tableCellClass}>
                        <SelectBox
                          checked={picked.includes(student.membership_id)}
                          onChange={(checked) =>
                            setPicked((current) =>
                              checked
                                ? [...current, student.membership_id]
                                : current.filter((id) => id !== student.membership_id),
                            )
                          }
                          label={`Seleccionar a ${student.full_name ?? "el estudiante"}`}
                        />
                      </td>
                      <td className={tableCellClass}>
                        <p className="font-medium text-foreground">{student.full_name ?? "—"}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {student.email ?? "Sin correo"}
                        </p>
                      </td>
                      <td className={tableCellClass}>
                        {student.courses.length > 0 ? (
                          student.courses.join(" · ")
                        ) : (
                          <span className="text-muted-foreground">Sin curso</span>
                        )}
                      </td>
                      <td className={`${tableCellClass} font-mono text-[12.4px] text-foreground`}>
                        {formatShortDate(student.joined_at)}
                      </td>
                      <td className={tableCellClass}>
                        <Chip tone={student.access === "activado" ? "ok" : "warn"} dot>
                          {student.access === "activado" ? "Activado" : "Sin activar"}
                        </Chip>
                      </td>
                      <td
                        className={`${tableCellClass} text-right font-mono text-[12.6px] text-foreground`}
                      >
                        {student.average === null || student.average === undefined
                          ? "—"
                          : student.average.toFixed(2)}
                      </td>
                      <td className={tableCellClass}>
                        <Chip tone={student.status === "activo" ? "teal" : "muted"} dot>
                          {student.status === "activo" ? "Activo" : "Inactivo"}
                        </Chip>
                      </td>
                      <td className={`${tableCellClass} text-right`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedStudent(student)}
                        >
                          Gestionar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </PanelTable>
            </TableShell>

            <Pagination
              page={students.data?.page ?? 1}
              pageCount={students.data?.pages ?? 0}
              total={students.data?.total ?? 0}
              pageSize={students.data?.per_page ?? 10}
              onPageChange={setPage}
            />
          </>
        )}
      </SectionCard>

      {/* The foot of the view: the state of the system, so that a page
          is never a blank rectangle. */}
      <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <Chip tone="muted" dot>
          Sistema operativo
        </Chip>
        <span>El filtro por curso y la búsqueda se ejecutan en el servidor.</span>
      </p>

      {selectedStudent && (
        <MemberManageDialog
          member={asMember(selectedStudent)}
          roleLabel="estudiante"
          onClose={() => setSelectedStudent(null)}
          onEdit={() => {
            setEditingStudent(selectedStudent);
            setSelectedStudent(null);
          }}
        />
      )}

      {editingStudent && (
        <MemberEditDialog
          member={{
            membership_id: editingStudent.membership_id,
            full_name: editingStudent.full_name,
            email: editingStudent.email,
            course_ids: editingStudent.course_ids,
          }}
          role="student"
          schoolId={schoolId}
          onClose={() => setEditingStudent(null)}
          onSaved={() => setEditingStudent(null)}
        />
      )}
    </>
  );
}
