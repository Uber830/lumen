import { useRouteContext, createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Plus, Search, Upload } from "lucide-react";
import { PageHeader, Pagination, SectionCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { Select } from "@/components/select-field";
import {
  useCourses,
  useCreateStudentEnrollment,
  useSchoolMembers,
  useStudentEnrollments,
} from "@/features/academics/hooks";
import { ActivationLinksCard, type ActivationLink } from "@/features/admin/activation-links";
import { BulkImportSummary, type BulkImportFailure } from "@/features/admin/bulk-import-summary";
import { MemberManageDialog } from "@/features/admin/member-manage-dialog";
import {
  activationLink,
  parseCsvInvitations,
  useBulkInviteUsers,
  useInviteUser,
  type InviteUserResult,
} from "@/lib/users/invitations";
import type { SchoolMember } from "@/features/academics/types";

export const Route = createFileRoute("/admin/estudiantes")({
  head: () => ({
    meta: [
      { title: "Estudiantes — Lumen" },
      {
        name: "description",
        content: "Listado de estudiantes con búsqueda, filtros por curso y carga masiva CSV.",
      },
      { property: "og:title", content: "Estudiantes — Lumen" },
      {
        property: "og:description",
        content: "Gestioná la matrícula de tu colegio desde un solo lugar.",
      },
    ],
  }),
  component: EstudiantesPage,
});

/** How many students fit in a page of the table. */
const PAGE_SIZE = 10;

function EstudiantesPage() {
  const { session } = useRouteContext({ from: "/admin/estudiantes" });
  const schoolId = session.primarySchoolId;
  const students = useSchoolMembers(schoolId, "student", true);
  const courses = useCourses(schoolId);
  const enrollments = useStudentEnrollments(schoolId);
  const invite = useInviteUser();
  const bulkInvite = useBulkInviteUsers();
  const createEnrollment = useCreateStudentEnrollment(schoolId ?? "");

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [query, setQuery] = useState("");
  const [activations, setActivations] = useState<ActivationLink[]>([]);
  const [bulkSummary, setBulkSummary] = useState<{
    created: number;
    failures: BulkImportFailure[];
  } | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<SchoolMember | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const courseOptions = useMemo(
    () =>
      (courses.data ?? []).map((course) => ({
        value: course.id,
        label: course.name,
        hint: course.grade_label,
      })),
    [courses.data],
  );

  // The courses each student is enrolled in.
  const coursesByStudent = useMemo(() => {
    const courseNameById = new Map((courses.data ?? []).map((c) => [c.id, c.name]));
    const map = new Map<string, string[]>();
    for (const enrollment of enrollments.data ?? []) {
      const name = courseNameById.get(enrollment.course_id);
      if (!name) continue;
      const list = map.get(enrollment.student_id) ?? [];
      list.push(name);
      map.set(enrollment.student_id, list);
    }
    return map;
  }, [enrollments.data, courses.data]);

  const filteredStudents = useMemo(() => {
    const all = students.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (student) =>
        student.full_name.toLowerCase().includes(needle) ||
        (student.email ?? "").toLowerCase().includes(needle),
    );
  }, [students.data, query]);

  // The list is paginated: ten students per page.
  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const [page, setPage] = useState(1);

  // A new search starts on the first page, and a list that shrank never
  // leaves the user on a page that does not exist. Both are adjustments
  // during the render, not an effect.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setPage(1);
  }
  if (page > pageCount) {
    setPage(pageCount);
  }

  const visibleStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, page]);

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

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !fullName.trim() || !schoolId) return;
    const created = await invite.mutateAsync({
      email: email.trim(),
      full_name: fullName.trim(),
      role: "student",
      school_id: schoolId,
      is_primary: true,
    });
    const activationToken = created.activation_token;
    if (activationToken) {
      setActivations((prev) => [
        { email: created.email, link: activationLink(activationToken) },
        ...prev,
      ]);
    }
    // The enrolment is part of the same action: a student without a course
    // cannot see anything of the platform.
    if (courseId) {
      await createEnrollment.mutateAsync({
        course_id: courseId,
        student_id: created.user_id,
      });
    }
    setEmail("");
    setFullName("");
    setCourseId("");
    setOpen(false);
  }

  async function onBulkFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  async function onBulkSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The role is forced: this is the students' import.
    const rows = parseCsvInvitations(csvText).map((row) => ({ ...row, role: "student" as const }));
    if (!rows.length) return;
    const result = await bulkInvite.mutateAsync(rows);
    setBulkOpen(false);
    setCsvText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        title="Estudiantes"
        subtitle={`${students.data?.length ?? 0} estudiantes matriculados`}
        actions={
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              <Upload className="size-4" /> Carga masiva CSV
            </button>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> Nuevo estudiante
            </button>
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
        roleLabel="el estudiante"
        onHide={() => setActivations([])}
      />

      {open && (
        <SectionCard title="Nuevo estudiante" bodyClassName="p-0">
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
                placeholder="estudiante@colegio.edu"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Curso
              </span>
              <div className="mt-1.5">
                <Select
                  value={courseId}
                  onChange={setCourseId}
                  options={courseOptions}
                  placeholder={
                    courseOptions.length ? "Elegí un curso (opcional)" : "Primero creá un curso"
                  }
                  emptyLabel="Todavía no hay cursos"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Si elegís un curso, el estudiante queda matriculado en él.
              </p>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={invite.isPending || createEnrollment.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {invite.isPending ? "Creando..." : "Crear estudiante"}
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
            {createEnrollment.error && (
              <p role="alert" className="text-sm text-destructive">
                {createEnrollment.error.message}
              </p>
            )}
          </form>
        </SectionCard>
      )}

      {bulkOpen && (
        <SectionCard title="Carga masiva CSV" bodyClassName="p-0">
          <form className="space-y-3 p-4" onSubmit={onBulkSubmit}>
            <p className="text-xs text-muted-foreground">
              Encabezados requeridos: <code>email, full_name</code>. Una fila por estudiante. Se
              crean con rol de estudiante.
            </p>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"email,full_name\nmaria@example.com,Maria Lopez\n"}
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
                {bulkInvite.isPending
                  ? "Procesando..."
                  : `Cargar ${previewRows.length} estudiante(s)`}
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

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              placeholder="Buscar estudiante"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Estudiante</th>
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">Ingreso</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {students.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-sm text-muted-foreground">
                    Cargando estudiantes...
                  </td>
                </tr>
              ) : students.error ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-sm text-destructive" role="alert">
                    {students.error.message}
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-sm text-muted-foreground">
                    {students.data && students.data.length > 0
                      ? "Ningun estudiante coincide con la busqueda."
                      : 'Aun no hay estudiantes matriculados. Usá "Nuevo estudiante" para crear el primero.'}
                  </td>
                </tr>
              ) : (
                visibleStudents.map((s) => {
                  const isRevoked = s.revoked_at !== null;
                  const studentCourses = coursesByStudent.get(s.user_id) ?? [];
                  return (
                    <tr key={s.user_id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <p className="font-medium">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.email ?? "Sin correo"}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {studentCourses.length > 0 ? studentCourses.join(", ") : "Sin curso"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {new Date(s.joined_at).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {!s.account_activated && !isRevoked && (
                            <StatusBadge tone="warning">Sin activar</StatusBadge>
                          )}
                          <StatusBadge tone={isRevoked ? "danger" : "success"}>
                            {isRevoked ? "Inactivo" : "Activo"}
                          </StatusBadge>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(s)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft"
                        >
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageCount={pageCount}
          total={filteredStudents.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </SectionCard>

      {selectedStudent && (
        <MemberManageDialog
          member={selectedStudent}
          roleLabel="estudiante"
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </>
  );
}
