import { createFileRoute, useRouteContext, useRouter } from "@tanstack/react-router";
import { AlertTriangle, ShieldCheck, UserPlus, X } from "lucide-react";
import { useState } from "react";

import {
  Button,
  PanelTable,
  Chip,
  EmptyState,
  PageHeader,
  SectionCard,
  TableShell,
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
import { ActivationLinksCard, type ActivationLink } from "@/features/admin/activation-links";
import { BulkBar, SelectBox } from "@/features/admin/bulk-bar";
import {
  useInviteAdmin,
  useRemoveAdmin,
  useSchoolAdmins,
  useTransferPrincipal,
  useUpdateAdminRank,
  type SchoolAdmin,
} from "@/lib/school/team";
import { formatShortDate } from "@/lib/school/material";
import { activationLink } from "@/lib/users/invitations";

export const Route = createFileRoute("/admin/administradores")({
  head: () => ({
    meta: [
      { title: "Administradores — Lumen" },
      {
        name: "description",
        content: "El equipo de administradores del colegio, con su rango y sus permisos.",
      },
      { property: "og:title", content: "Administradores — Lumen" },
      {
        property: "og:description",
        content: "Administra el equipo de administradores de tu institución.",
      },
    ],
  }),
  component: AdministradoresPage,
});

function AdministradoresPage() {
  const { session } = useRouteContext({ from: "/admin/administradores" });
  const router = useRouter();

  const admins = useSchoolAdmins();
  const invite = useInviteAdmin();
  const updateRank = useUpdateAdminRank();
  const transfer = useTransferPrincipal();
  const removeAdmin = useRemoveAdmin();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [activations, setActivations] = useState<ActivationLink[]>([]);
  // The administrator whose detail is open.
  const [detail, setDetail] = useState<SchoolAdmin | null>(null);
  // The rows the administrator picked: the bar acts on all of them.
  const [picked, setPicked] = useState<string[]>([]);
  const adminToRemove = useDeleteConfirmation();
  // The administrator who is about to receive the principal rank.
  const [toTransfer, setToTransfer] = useState<SchoolAdmin | null>(null);

  // The frontend does not decide what a rank may do: the API returns
  // the list. The action is disabled **with the reason**, not invisible.
  const canManage = session.permissions.includes("admins.manage");
  const total = admins.data?.length ?? 0;

  // The school has a single principal. The one who is in the team is
  // the one who can invite, so the new administrator always enters as
  // secondary: the rank is handed over from the file of the team.
  const principal = (admins.data ?? []).find((admin) => admin.admin_role === "principal") ?? null;
  const pickedIncludesPrincipal = picked.includes(principal?.membership_id ?? "");
  const bulkReason = pickedIncludesPrincipal
    ? "El colegio tiene un solo administrador principal: no se puede degradar al último."
    : "";

  async function onInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !fullName.trim()) return;

    const created = await invite.mutateAsync({
      email: email.trim(),
      full_name: fullName.trim(),
      admin_role: "secundario",
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

  /** Pass the picked administrators to the secondary rank. */
  async function onBulkRank() {
    for (const membershipId of picked) {
      try {
        await updateRank.mutateAsync({ membership_id: membershipId, admin_role: "secundario" });
      } catch {
        // The error of the last one is shown below the bar.
      }
    }
    setPicked([]);
  }

  async function onTransfer() {
    if (!toTransfer) return;
    try {
      await transfer.mutateAsync({ membership_id: toTransfer.membership_id });
      setToTransfer(null);
      setDetail(null);
      // The caller gave the rank away: its own permissions change, so
      // the session is read again.
      await router.invalidate();
    } catch {
      // The error is shown below the detail, in Spanish.
    }
  }

  return (
    <>
      <PageHeader
        title="Administradores"
        subtitle={`${total} administradores con acceso al colegio. El principal puede administrar al resto.`}
        actions={
          <Button
            icon={UserPlus}
            aria-disabled={!canManage}
            aria-describedby={canManage ? undefined : "admins-manage-reason"}
            title={
              canManage
                ? "Invitar a un administrador del colegio"
                : "Esta acción la hace el administrador principal del colegio."
            }
            onClick={() => {
              if (!canManage) return;
              setOpen(true);
            }}
          >
            Invitar administrador
          </Button>
        }
      />

      {!canManage && (
        <p
          id="admins-manage-reason"
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground"
        >
          Tu rango es Secundario: puedes ver el equipo, pero no invitar a nadie ni cambiar un rango.
          Esa acción la hace el administrador principal del colegio.
        </p>
      )}

      <p id="admins-remove-principal" className="sr-only">
        El colegio debe tener al menos un administrador principal: a esa persona no se le puede
        quitar del equipo.
      </p>

      <ActivationLinksCard
        links={activations}
        roleLabel="el administrador"
        onHide={() => setActivations([])}
      />

      {/* The form lives in a modal: the list of the team does not move
          when the principal opens it. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Invitar administrador</DialogTitle>
            <DialogDescription>
              La persona recibe un enlace para crear su contraseña y entra al panel del colegio.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={onInvite}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nombre completo
              </span>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Carlos Mendoza"
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
                placeholder="admin@colegio.edu"
                className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
              />
            </label>

            {/* The rank is not a choice: the school has one principal
                and the person inviting is that principal. */}
            <div className="rounded-idx border border-border bg-secondary px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rango
              </p>
              <p className="mt-1 text-[13px] font-medium text-foreground">Secundario</p>
              <p className="mt-1 text-[12.4px] leading-snug text-muted-foreground">
                El colegio tiene un solo administrador principal. Los administradores nuevos entran
                como secundarios; para cederles el rango, usa «Ceder el rango» en su ficha.
              </p>
            </div>

            {invite.error && (
              <p role="alert" className="text-[13px] text-destructive">
                {invite.error.message}
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" icon={UserPlus} disabled={invite.isPending}>
                {invite.isPending ? "Invitando..." : "Enviar invitación"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SectionCard className="overflow-hidden" bodyClassName="p-0">
        <BulkBar count={picked.length} onClear={() => setPicked([])}>
          <Button
            variant="outline"
            size="sm"
            icon={ShieldCheck}
            disabled={updateRank.isPending || pickedIncludesPrincipal}
            aria-disabled={pickedIncludesPrincipal}
            aria-describedby={bulkReason ? "admins-bulk-reason" : undefined}
            title={bulkReason || "Pasar los seleccionados a administrador secundario"}
            onClick={() => {
              if (pickedIncludesPrincipal) return;
              void onBulkRank();
            }}
          >
            Cambiar a secundario
          </Button>
          {bulkReason && (
            <span id="admins-bulk-reason" className="text-[12.5px] text-muted-foreground">
              {bulkReason}
            </span>
          )}
          {updateRank.error && (
            <span role="alert" className="text-[12.5px] text-destructive">
              {updateRank.error.message}
            </span>
          )}
        </BulkBar>

        {admins.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {admins.error.message}
          </p>
        ) : admins.isLoading ? (
          <div className="px-[18px] py-4" aria-hidden>
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center gap-4 py-[11px]">
                <span className="h-[11px] w-[190px] animate-pulse rounded bg-muted" />
                <span className="h-[18px] w-[84px] animate-pulse rounded-idx bg-muted" />
              </div>
            ))}
          </div>
        ) : (admins.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Sin administradores"
            description="Invita al primer administrador del colegio para que pueda entrar al panel."
          />
        ) : (
          <TableShell>
            <PanelTable className="w-full border-collapse">
              <caption className="sr-only">
                Administradores del colegio, con su rango y su estado
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={tableHeadClass}>
                    Administrador
                  </th>
                  <th scope="col" className={tableHeadClass}>
                    Ingreso
                  </th>
                  <th scope="col" className={tableHeadClass}>
                    Rol
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
                {(admins.data ?? []).map((admin) => (
                  <tr key={admin.membership_id} className="transition-colors hover:bg-muted">
                    <td className={tableCellClass}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <MemberAvatar name={admin.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{admin.full_name}</p>
                          <p className="truncate text-[12px] text-muted-foreground">
                            {admin.email ?? "Sin correo"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`${tableCellClass} font-mono text-[12.4px] text-foreground`}>
                      {formatShortDate(admin.joined_at)}
                    </td>
                    <td className={tableCellClass}>
                      <Chip tone={admin.admin_role === "principal" ? "info" : "muted"} dot>
                        {admin.admin_role === "principal" ? "Principal" : "Secundario"}
                      </Chip>
                    </td>
                    <td className={tableCellClass}>
                      <Chip tone={admin.status === "activo" ? "teal" : "muted"} dot>
                        {admin.status === "activo" ? "Activo" : "Inactivo"}
                      </Chip>
                    </td>
                    <td className={`${tableCellClass} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(admin)}>
                          Gestionar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={X}
                          aria-disabled={!canManage || admin.admin_role === "principal"}
                          aria-describedby={
                            canManage
                              ? admin.admin_role === "principal"
                                ? "admins-remove-principal"
                                : undefined
                              : "admins-manage-reason"
                          }
                          title={
                            !canManage
                              ? "Esta acción la hace el administrador principal del colegio."
                              : admin.admin_role === "principal"
                                ? "El colegio debe tener al menos un administrador principal."
                                : "Quitar del equipo"
                          }
                          onClick={() => {
                            if (!canManage || admin.admin_role === "principal") return;
                            adminToRemove.ask({
                              id: admin.membership_id,
                              title: `a ${admin.full_name}`,
                              description:
                                "La persona deja de tener acceso al panel del colegio. Su historial se conserva.",
                              confirmLabel: "Quitar del equipo",
                            });
                          }}
                        >
                          Quitar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </PanelTable>
          </TableShell>
        )}
        {(updateRank.error || removeAdmin.error) && (
          <p role="alert" className="px-[18px] py-4 text-[13px] text-destructive">
            {(updateRank.error ?? removeAdmin.error)?.message}
          </p>
        )}
      </SectionCard>

      {/* The foot of the view: the state of the system, so that a page
          is never a blank rectangle. */}
      <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span>
          Los permisos de cada rango los devuelve la API: el panel no decide qué puede hacer cada
          uno.
        </span>
      </p>

      {/* The file of the administrator lives in a modal: the list of the
          team does not move when the principal opens it. */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[16px]">
                  {detail.full_name} ·{" "}
                  {detail.admin_role === "principal" ? "Principal" : "Secundario"}
                </DialogTitle>
                <DialogDescription>Qué puede hacer este rango en el colegio</DialogDescription>
              </DialogHeader>

              <ul className="grid gap-1.5 sm:grid-cols-2">
                {detail.permissions.map((permission) => (
                  <li key={permission.permission} className="flex items-start gap-2 text-[13px]">
                    <span
                      className="mt-[7px] size-1.5 shrink-0 rounded-full bg-success"
                      aria-hidden
                    />
                    <span className="text-muted-foreground">{permission.label}</span>
                  </li>
                ))}
              </ul>

              {/* What separates the two ranks, in one place. */}
              <p className="flex items-start gap-2 rounded-idx bg-warning-soft px-3 py-2.5 text-[13px] text-warning-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} aria-hidden />
                <span>
                  <strong className="font-semibold">Permisos por rol.</strong> El colegio tiene un
                  solo administrador principal: el rango se cede, nunca se duplica. El principal
                  administra personas, períodos y personalizaciones. El secundario hace lo mismo,
                  menos administrar a otros administradores.
                </span>
              </p>

              {transfer.error && (
                <p role="alert" className="text-[13px] text-destructive">
                  {transfer.error.message}
                </p>
              )}

              <DialogFooter className="sm:justify-between">
                {detail.admin_role === "secundario" ? (
                  <Button
                    icon={ShieldCheck}
                    aria-disabled={!canManage}
                    aria-describedby={canManage ? undefined : "admins-manage-reason"}
                    title={
                      canManage
                        ? "Cederle el rango principal del colegio"
                        : "Esta acción la hace el administrador principal del colegio."
                    }
                    disabled={transfer.isPending}
                    onClick={() => {
                      if (!canManage) return;
                      setToTransfer(detail);
                    }}
                  >
                    Ceder el rango principal
                  </Button>
                ) : (
                  <span className="text-[12.5px] text-muted-foreground">
                    Es el administrador principal del colegio.
                  </span>
                )}
                <Button variant="ghost" type="button" onClick={() => setDetail(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={adminToRemove.target !== null}
        title={`Quitar ${adminToRemove.target?.title ?? "al administrador"}`}
        description={adminToRemove.target?.description}
        confirmLabel={adminToRemove.target?.confirmLabel ?? "Quitar del equipo"}
        pending={removeAdmin.isPending}
        onCancel={adminToRemove.close}
        onConfirm={() => {
          const id = adminToRemove.target?.id;
          if (!id) return;
          removeAdmin.mutate(id, { onSuccess: adminToRemove.close });
        }}
      />

      <ConfirmDialog
        open={toTransfer !== null}
        title={toTransfer ? `Ceder el rango principal a ${toTransfer.full_name}` : "Ceder el rango"}
        description={
          toTransfer ? (
            <>
              <strong className="font-semibold text-foreground">{toTransfer.full_name}</strong>{" "}
              quedará como administrador principal: podrá cerrar periodos, invitar al equipo y
              cambiar la identidad del colegio. Tú sigues en el equipo, como administrador
              secundario.
            </>
          ) : undefined
        }
        confirmLabel="Ceder el rango"
        pending={transfer.isPending}
        onCancel={() => setToTransfer(null)}
        onConfirm={() => {
          void onTransfer();
        }}
      />
    </>
  );
}
