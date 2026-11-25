import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { KeyRound, Lock, Plus, Search, Upload, UserRoundX } from "lucide-react";
import { useMemo, useRef, useState } from "react";

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
import { ActivationLinksCard, type ActivationLink } from "@/features/admin/activation-links";
import { BulkBar, SelectBox } from "@/features/admin/bulk-bar";
import { BulkImportSummary, type BulkImportFailure } from "@/features/admin/bulk-import-summary";
import { CourseSubjectChips, type CourseSubjectItem } from "@/features/admin/course-subject-chips";
import { MemberEditDialog } from "@/features/admin/member-edit-dialog";
import { MemberManageDialog } from "@/features/admin/member-manage-dialog";
import { Select } from "@/components/select-field";
import { useCourseSubjects } from "@/features/academics/hooks";
import type { SchoolMember } from "@/features/academics/types";
import {
  activationLink,
  parseCsvInvitations,
  useBulkInviteUsers,
  useInviteUser,
  useUpdateMembership,
  type InviteUserResult,
} from "@/lib/users/invitations";
import { useSchoolCourses, useSchoolTeachers, type SchoolMemberRow } from "@/lib/school/community";
import { formatShortDate } from "@/lib/school/material";

export const Route = createFileRoute("/admin/docentes")({
  head: () => ({
    meta: [
      { title: "Docentes — Lumen" },
      {
        name: "description",
        content: "Alta, búsqueda y gestión de docentes del colegio, con importación CSV.",
      },
      { property: "og:title", content: "Docentes — Lumen" },
      {
        property: "og:description",
        content: "Administra el plantel docente de tu institución.",
      },
    ],
  }),
  component: DocentesPage,
});

function DocentesPage() {
  const { session } = useRouteContext({ from: "/admin/docentes" });
  const schoolId = session.primarySchoolId;

  // The list is filtered and paginated in the server: the school may
  // have hundreds of teachers and the browser never sees all of them.
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [page, setPage] = useState(1);

  const teachers = useSchoolTeachers({ q: query, status, course_id: courseId, page });
  const courses = useSchoolCourses();
  const courseSubjects = useCourseSubjects(schoolId);

  const invite = useInviteUser();
  const bulkInvite = useBulkInviteUsers();
  const updateMembership = useUpdateMembership();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  // The course and the subject the new teacher is assigned to.
  const [newCourseSubjectId, setNewCourseSubjectId] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Activation links for users just created, shown so the admin can
  // copy and share them (there is no email provider yet).
  const [activations, setActivations] = useState<ActivationLink[]>([]);
  const [bulkSummary, setBulkSummary] = useState<{
    created: number;
    failures: BulkImportFailure[];
  } | null>(null);
  // The teacher whose management modal is open, and the one being edited.
  const [selectedTeacher, setSelectedTeacher] = useState<SchoolMemberRow | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<SchoolMemberRow | null>(null);
  // The rows the administrator picked: the bar acts on all of them.
  const [picked, setPicked] = useState<string[]>([]);

  const total = teachers.data?.total ?? 0;

  // The name of each course subject: the row of the teacher carries the
  // ids, the list of the school carries the names.
  const labelOfCourseSubject = useMemo(() => {
    const labels = new Map<string, string>();
    for (const item of courseSubjects.data ?? []) {
      labels.set(item.id, `${item.course_name} · ${item.subject_name}`);
    }
    return labels;
  }, [courseSubjects.data]);

  /** The courses and subjects of a teacher, ready to be shown. */
  function courseSubjectsOf(teacher: SchoolMemberRow): CourseSubjectItem[] {
    return (teacher.course_subject_ids ?? []).map((id) => ({
      id,
      label: labelOfCourseSubject.get(id) ?? "Materia",
    }));
  }

  // The dialog of the old view works with the member of the school. The
  // row of the new list carries everything it needs.
  function asMember(row: SchoolMemberRow): SchoolMember {
    return {
      membership_id: row.membership_id,
      school_id: schoolId ?? "",
      user_id: row.user_id,
      role: "teacher",
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
      subjects: row.subjects,
      course_subject_ids: row.course_subject_ids,
    };
  }

  // A new filter starts again on the first page: the second page of the
  // previous filter is not the second page of this one.
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
      role: "teacher",
      school_id: schoolId,
      is_primary: true,
      // The course and the subject the admin picked: the teacher is
      // assigned to it, so it has material to see from the start.
      ...(newCourseSubjectId ? { course_subject_ids: [newCourseSubjectId] } : {}),
    });
    if (created.activation_token) {
      setActivations((prev) => [
        { email: created.email, link: activationLink(created.activation_token!) },
        ...prev,
      ]);
    }
    setEmail("");
    setFullName("");
    setNewCourseSubjectId("");
    setOpen(false);
  }

  /** Turn the access of the picked teachers on or off. */
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

  async function onBulkFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  async function onBulkSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rows = parseCsvInvitations(csvText);
    if (!rows.length) return;
    const result = await bulkInvite.mutateAsync(rows);
    setBulkOpen(false);
    setCsvText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    // Collect activation links for the rows that were created, so the
    // admin can share them. The failures are reported below the form.
    const newLinks = result.created
      .filter((c): c is InviteUserResult & { activation_token: string } => !!c.activation_token)
      .map((c) => ({ email: c.email, link: activationLink(c.activation_token) }));
    if (newLinks.length > 0) setActivations((prev) => [...newLinks, ...prev]);

    setBulkSummary({ created: result.created.length, failures: result.failures });
  }

  const previewRows = csvText ? parseCsvInvitations(csvText) : [];

  return (
    <>
      <PageHeader
        title="Docentes"
        subtitle={`${teachers.isLoading ? "—" : total} docentes registrados en el colegio. Asigna cursos y revisa el acceso a la plataforma.`}
        actions={
          <>
            <Button variant="outline" icon={Upload} onClick={() => fileInputRef.current?.click()}>
              Carga masiva CSV
            </Button>
            <Button icon={Plus} onClick={() => setOpen(true)}>
              Nuevo docente
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                void onBulkFile(e);
                setBulkOpen(true);
              }}
            />
          </>
        }
      />

      {bulkSummary && (
        <BulkImportSummary created={bulkSummary.created} failures={bulkSummary.failures} />
      )}

      <ActivationLinksCard
        links={activations}
        roleLabel="el docente"
        onHide={() => setActivations([])}
      />

      {bulkOpen && (
        <SectionCard title="Carga masiva CSV" bodyClassName="p-0">
          <form className="space-y-3 p-4" onSubmit={onBulkSubmit}>
            <p className="text-xs text-muted-foreground">
              Encabezados requeridos: <code>email, full_name, role</code> (role: school_admin |
              teacher | student). Una fila por docente.
            </p>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"email,full_name,role\nmaria@example.com,Maria Lopez,teacher\n"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground">
              {previewRows.length === 0
                ? "Sin filas pendientes"
                : `${previewRows.length} fila(s) detectadas`}
            </p>
            {bulkInvite.error && (
              <p role="alert" className="text-sm text-destructive">
                {bulkInvite.error.message}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={bulkInvite.isPending || previewRows.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkInvite.isPending ? "Procesando..." : `Cargar ${previewRows.length} docente(s)`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkOpen(false);
                  setCsvText("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      {open && (
        <SectionCard
          title="Nuevo docente"
          description="Entra con el acceso pendiente hasta que le asignes un curso."
          bodyClassName="p-0"
        >
          <form className="space-y-3 p-4" onSubmit={onCreate}>
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
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
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
                placeholder="docente@colegio.edu"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Curso y materia
              </span>
              <div className="mt-1.5">
                <Select
                  value={newCourseSubjectId}
                  onChange={setNewCourseSubjectId}
                  options={(courseSubjects.data ?? []).map((courseSubject) => ({
                    value: courseSubject.id,
                    label: `${courseSubject.course_name} · ${courseSubject.subject_name}`,
                  }))}
                  placeholder="7° A · Matemáticas"
                  emptyLabel="Todavía no hay materias ofrecidas en los cursos"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Sin asignación el docente entra con el acceso pendiente.
              </p>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={invite.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {invite.isPending ? "Creando..." : "Crear docente"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
            {invite.error && (
              <p role="alert" className="text-sm text-destructive">
                {invite.error.message}
              </p>
            )}
          </form>
        </SectionCard>
      )}

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
            <Chip tone="muted">{teachers.data ? `${total} docentes` : "—"}</Chip>
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

        {teachers.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {teachers.error.message}
          </p>
        ) : teachers.isLoading ? (
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
        ) : (teachers.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={UserRoundX}
            title="Sin resultados"
            description="Ajusta los filtros o registra al primer docente del colegio."
            action={
              <Button icon={Plus} onClick={() => setOpen(true)}>
                Nuevo docente
              </Button>
            }
          />
        ) : (
          <>
            <TableShell>
              <PanelTable className="w-full border-collapse">
                <caption className="sr-only">
                  Docentes del colegio, con su curso, su acceso y su estado
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={`${tableHeadClass} w-[38px]`}>
                      <SelectBox
                        checked={
                          (teachers.data?.items.length ?? 0) > 0 &&
                          picked.length === teachers.data?.items.length
                        }
                        onChange={(checked) =>
                          setPicked(
                            checked
                              ? (teachers.data?.items ?? []).map((row) => row.membership_id)
                              : [],
                          )
                        }
                        label="Seleccionar todos los docentes"
                      />
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Docente
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Curso · Materia
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Ingreso
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Acceso
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
                  {(teachers.data?.items ?? []).map((teacher) => (
                    <tr key={teacher.membership_id} className="transition-colors hover:bg-muted">
                      <td className={tableCellClass}>
                        <SelectBox
                          checked={picked.includes(teacher.membership_id)}
                          onChange={(checked) =>
                            setPicked((current) =>
                              checked
                                ? [...current, teacher.membership_id]
                                : current.filter((id) => id !== teacher.membership_id),
                            )
                          }
                          label={`Seleccionar a ${teacher.full_name ?? "el docente"}`}
                        />
                      </td>
                      <td className={tableCellClass}>
                        <p className="font-medium text-foreground">{teacher.full_name ?? "—"}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {teacher.email ?? "Sin correo"}
                        </p>
                      </td>
                      <td className={tableCellClass}>
                        <CourseSubjectChips
                          items={courseSubjectsOf(teacher)}
                          who={teacher.full_name ?? "el docente"}
                        />
                      </td>
                      <td className={`${tableCellClass} font-mono text-[12.4px] text-foreground`}>
                        {formatShortDate(teacher.joined_at)}
                      </td>
                      <td className={tableCellClass}>
                        <Chip tone={teacher.access === "activado" ? "ok" : "warn"} dot>
                          {teacher.access === "activado" ? "Activado" : "Sin activar"}
                        </Chip>
                      </td>
                      <td className={tableCellClass}>
                        <Chip tone={teacher.status === "activo" ? "teal" : "muted"} dot>
                          {teacher.status === "activo" ? "Activo" : "Inactivo"}
                        </Chip>
                      </td>
                      <td className={`${tableCellClass} text-right`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTeacher(teacher)}
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
              page={teachers.data?.page ?? 1}
              pageCount={teachers.data?.pages ?? 0}
              total={teachers.data?.total ?? 0}
              pageSize={teachers.data?.per_page ?? 10}
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
        <span>
          La búsqueda y los filtros se ejecutan en el servidor, sobre los datos del colegio.
        </span>
      </p>

      {selectedTeacher && (
        <MemberManageDialog
          member={asMember(selectedTeacher)}
          roleLabel="docente"
          courseSubjects={courseSubjectsOf(selectedTeacher)}
          onClose={() => setSelectedTeacher(null)}
          onEdit={() => {
            setEditingTeacher(selectedTeacher);
            setSelectedTeacher(null);
          }}
        />
      )}

      {editingTeacher && (
        <MemberEditDialog
          member={{
            membership_id: editingTeacher.membership_id,
            full_name: editingTeacher.full_name,
            email: editingTeacher.email,
            course_subject_ids: editingTeacher.course_subject_ids,
          }}
          role="teacher"
          schoolId={schoolId}
          onClose={() => setEditingTeacher(null)}
          onSaved={() => setEditingTeacher(null)}
        />
      )}
    </>
  );
}
