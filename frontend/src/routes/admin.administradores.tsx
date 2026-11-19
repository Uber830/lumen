import { useRouteContext, createFileRoute } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { PageHeader, SectionCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { useSchoolMembers } from "@/features/academics/hooks";
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

export const Route = createFileRoute("/admin/administradores")({
  head: () => ({
    meta: [
      { title: "Administradores — Lumen" },
      {
        name: "description",
        content: "Gestioná los administradores del colegio y sus permisos.",
      },
      { property: "og:title", content: "Administradores — Lumen" },
      {
        property: "og:description",
        content: "Control de accesos administrativos por institución.",
      },
    ],
  }),
  component: AdministradoresPage,
});

function AdministradoresPage() {
  const { session } = useRouteContext({ from: "/admin/administradores" });
  const schoolId = session.primarySchoolId;
  const admins = useSchoolMembers(schoolId, "school_admin", true);
  const invite = useInviteUser();
  const bulkInvite = useBulkInviteUsers();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Activation links for the administrators just created, shown so the
  // admin can copy and share them.
  const [activations, setActivations] = useState<ActivationLink[]>([]);
  const [bulkSummary, setBulkSummary] = useState<{
    created: number;
    failures: BulkImportFailure[];
  } | null>(null);
  // The administrator whose management modal is open.
  const [selectedAdmin, setSelectedAdmin] = useState<SchoolMember | null>(null);

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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !fullName.trim() || !schoolId) return;
    const created = await invite.mutateAsync({
      email: email.trim(),
      full_name: fullName.trim(),
      role: "school_admin",
      school_id: schoolId,
      is_primary: true,
    });
    const token = created.activation_token;
    if (token) {
      setActivations((prev) => [{ email: created.email, link: activationLink(token) }, ...prev]);
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
    // The role is forced: this is the administrators' import.
    const rows = parseCsvInvitations(csvText).map((row) => ({
      ...row,
      role: "school_admin" as const,
    }));
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
        title="Administradores"
        subtitle={`${admins.data?.length ?? 0} administradores con acceso al colegio`}
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
              <Plus className="size-4" /> Invitar administrador
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
        roleLabel="el administrador"
        onHide={() => setActivations([])}
      />

      {open && (
        <SectionCard title="Invitar administrador" bodyClassName="p-0">
          <form className="space-y-3 p-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nombre completo
              </span>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Maria Rodriguez"
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
                placeholder="admin@colegio.edu"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={invite.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {invite.isPending ? "Creando..." : "Crear administrador"}
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
              Encabezados requeridos: <code>email, full_name</code>. Una fila por administrador. Se
              crean con rol de administrador del colegio.
            </p>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"email,full_name\nmaria@example.com,Maria Rodriguez\n"}
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
                  : `Cargar ${previewRows.length} administrador(es)`}
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
        {admins.isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Cargando administradores...</p>
        ) : admins.error ? (
          <p role="alert" className="px-5 py-6 text-sm text-destructive">
            {admins.error.message}
          </p>
        ) : (admins.data ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Aun no hay administradores registrados. Usa el boton de arriba para invitar el primero.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Administrador</th>
                  <th className="px-5 py-3 font-semibold">Ingreso</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(admins.data ?? []).map((a) => {
                  const isRevoked = a.revoked_at !== null;
                  return (
                    <tr key={a.membership_id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <p className="font-medium">{a.full_name}</p>
                        <p className="text-xs text-muted-foreground">{a.email ?? "Sin correo"}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {new Date(a.joined_at).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {a.is_primary && <StatusBadge tone="info">Principal</StatusBadge>}
                          {!a.account_activated && !isRevoked && (
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
                          onClick={() => setSelectedAdmin(a)}
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

      {selectedAdmin && (
        <MemberManageDialog
          member={selectedAdmin}
          roleLabel="administrador"
          onClose={() => setSelectedAdmin(null)}
        />
      )}
    </>
  );
}
