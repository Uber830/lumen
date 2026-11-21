import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { GraduationCap, Plus, Search, Upload } from "lucide-react";
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
import { Select } from "@/components/select-field";
import { ActivationLinksCard, type ActivationLink } from "@/features/admin/activation-links";
import { BulkImportSummary, type BulkImportFailure } from "@/features/admin/bulk-import-summary";
import { MemberManageDialog } from "@/features/admin/member-manage-dialog";
import type { SchoolMember } from "@/features/academics/types";
import {
  activationLink,
  parseCsvInvitations,
  useBulkInviteUsers,
  useInviteUser,
  type InviteUserResult,
} from "@/lib/users/invitations";
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
  const bulkInvite = useBulkInviteUsers();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [newCourseId, setNewCourseId] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activations, setActivations] = useState<ActivationLink[]>([]);
  const [bulkSummary, setBulkSummary] = useState<{
    created: number;
    failures: BulkImportFailure[];
  } | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<SchoolMemberRow | null>(null);

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
        subtitle={`${students.isLoading ? "—" : total} estudiantes matriculados. Controla el acceso, el curso y el promedio.`}
        actions={
          <>
            <Button variant="outline" icon={Upload} onClick={() => fileInputRef.current?.click()}>
              Carga masiva CSV
            </Button>
            <Button icon={Plus} onClick={() => setOpen(true)}>
              Nuevo estudiante
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
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={invite.isPending}
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
              className="w-full rounded-[10px] border border-input bg-card py-2 pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
          </div>

          <select
            value={status}
            onChange={(event) => applyStatus(event.target.value)}
            aria-label="Filtrar por estado"
            className="rounded-[10px] border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
          >
            <option value="all">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>

          <select
            value={courseId}
            onChange={(event) => applyCourse(event.target.value)}
            aria-label="Filtrar por curso"
            className="rounded-[10px] border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
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

        {students.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {students.error.message}
          </p>
        ) : students.isLoading ? (
          <div className="px-[18px] py-4" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-4 py-[11px]">
                <span className="h-[11px] w-[180px] animate-pulse rounded bg-[rgba(150,175,220,.11)]" />
                <span className="h-[11px] w-[150px] animate-pulse rounded bg-[rgba(150,175,220,.09)]" />
                <span className="h-[11px] w-[90px] animate-pulse rounded bg-[rgba(150,175,220,.09)]" />
                <span className="h-[18px] w-[74px] animate-pulse rounded-full bg-[rgba(150,175,220,.1)]" />
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
                    <th scope="col" className={tableHeadClass}>
                      Estudiante
                    </th>
                    <th scope="col" className={tableHeadClass}>
                      Cursos
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
                    <tr
                      key={student.membership_id}
                      className="transition-colors hover:bg-white/[0.025]"
                    >
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
                      <td className={`${tableCellClass} font-mono text-[12.4px] text-[#A0B2CE]`}>
                        {formatShortDate(student.joined_at)}
                      </td>
                      <td className={tableCellClass}>
                        <Chip tone={student.access === "activado" ? "ok" : "warn"} dot>
                          {student.access === "activado" ? "Activado" : "Pendiente"}
                        </Chip>
                      </td>
                      <td
                        className={`${tableCellClass} text-right font-mono text-[12.6px] text-[#A0B2CE]`}
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
        />
      )}
    </>
  );
}
