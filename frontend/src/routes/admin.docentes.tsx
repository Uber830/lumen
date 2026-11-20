import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import {
  useCourseSubjects,
  useSchoolMembers,
  useTeacherAssignments,
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
        content: "Administrá el plantel docente de tu institución.",
      },
    ],
  }),
  component: DocentesPage,
});

function DocentesPage() {
  const { session } = useRouteContext({ from: "/admin/docentes" });
  const schoolId = session.primarySchoolId;
  const teachers = useSchoolMembers(schoolId, "teacher", true);
  const assignments = useTeacherAssignments(schoolId);
  const courseSubjects = useCourseSubjects(schoolId);
  const invite = useInviteUser();
  const bulkInvite = useBulkInviteUsers();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
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
  // The teacher whose management modal is open.
  const [selectedTeacher, setSelectedTeacher] = useState<SchoolMember | null>(null);

  // The courses each teacher teaches, so the table can show them.
  const coursesByTeacher = useMemo(() => {
    const labelByCourseSubject = new Map(
      (courseSubjects.data ?? []).map((cs) => [cs.id, `${cs.course_name} · ${cs.subject_name}`]),
    );
    const map = new Map<string, string[]>();
    for (const assignment of assignments.data ?? []) {
      const label = labelByCourseSubject.get(assignment.course_subject_id);
      if (!label) continue;
      const list = map.get(assignment.teacher_id) ?? [];
      list.push(label);
      map.set(assignment.teacher_id, list);
    }
    return map;
  }, [assignments.data, courseSubjects.data]);

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
      role: "teacher",
      school_id: schoolId,
      is_primary: true,
    });
    if (created.activation_token) {
      setActivations((prev) => [
        { email: created.email, link: activationLink(created.activation_token!) },
        ...prev,
      ]);
    }
    setEmail("");
    setFullName("");
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
        subtitle={`${teachers.data?.length ?? 0} docentes registrados`}
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
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> Nuevo docente
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
        <SectionCard title="Nuevo docente" bodyClassName="p-0">
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

      <SectionCard bodyClassName="p-0">
        {teachers.isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Cargando docentes...</p>
        ) : teachers.error ? (
          <p role="alert" className="px-5 py-6 text-sm text-destructive">
            {teachers.error.message}
          </p>
        ) : (teachers.data ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Aún no hay docentes. Usá "Nuevo docente" para crear el primero.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head-band text-left text-[11px] uppercase tracking-[0.09em]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Docente</th>
                  <th className="px-5 py-3 font-semibold">Curso</th>
                  <th className="px-5 py-3 font-semibold">Ingreso</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(teachers.data ?? []).map((t) => {
                  const isRevoked = t.revoked_at !== null;
                  const teacherCourses = coursesByTeacher.get(t.user_id) ?? [];
                  return (
                    <tr key={t.membership_id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <p className="font-medium">{t.full_name}</p>
                        <p className="text-xs text-muted-foreground">{t.email ?? "Sin correo"}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {teacherCourses.length > 0 ? teacherCourses.join(", ") : "Sin curso"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {new Date(t.joined_at).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {!t.account_activated && !isRevoked && (
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
                          onClick={() => setSelectedTeacher(t)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft"
                        >
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {selectedTeacher && (
        <MemberManageDialog
          member={selectedTeacher}
          roleLabel="docente"
          onClose={() => setSelectedTeacher(null)}
        />
      )}
    </>
  );
}
