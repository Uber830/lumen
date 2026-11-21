import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { ShieldCheck, UserPlus, X } from "lucide-react";
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
import { MemberAvatar } from "@/components/member-avatar";
import { ActivationLinksCard, type ActivationLink } from "@/features/admin/activation-links";
import {
  useInviteAdmin,
  useRemoveAdmin,
  useSchoolAdmins,
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

  const admins = useSchoolAdmins();
  const invite = useInviteAdmin();
  const updateRank = useUpdateAdminRank();
  const removeAdmin = useRemoveAdmin();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [rank, setRank] = useState("secundario");
  const [activations, setActivations] = useState<ActivationLink[]>([]);
  // The administrator whose detail is open.
  const [detail, setDetail] = useState<SchoolAdmin | null>(null);
  const adminToRemove = useDeleteConfirmation();

  // The frontend does not decide what a rank may do: the API returns
  // the list. The action is disabled **with the reason**, not invisible.
  const canManage = session.permissions.includes("admins.manage");
  const total = admins.data?.length ?? 0;

  async function onInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !fullName.trim()) return;

    const created = await invite.mutateAsync({
      email: email.trim(),
      full_name: fullName.trim(),
      admin_role: rank,
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
              setOpen((value) => !value);
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

      <ActivationLinksCard
        links={activations}
        roleLabel="el administrador"
        onHide={() => setActivations([])}
      />

      {open && (
        <SectionCard className="mb-4" title="Invitar administrador" bodyClassName="p-0">
          <form className="space-y-3 p-4" onSubmit={onInvite}>
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
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rango
              </span>
              <select
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="secundario">
                  Secundario — administra la comunidad y los cursos
                </option>
                <option value="principal">
                  Principal — además cierra periodos y gestiona el equipo
                </option>
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                El colegio siempre tiene al menos un administrador principal.
              </p>
            </label>
            {invite.error && (
              <p role="alert" className="text-[13px] text-destructive">
                {invite.error.message}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" icon={UserPlus} disabled={invite.isPending}>
                {invite.isPending ? "Invitando..." : "Enviar invitación"}
              </Button>
              <Button variant="ghost" icon={X} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard className="overflow-hidden" bodyClassName="p-0">
        {admins.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {admins.error.message}
          </p>
        ) : admins.isLoading ? (
          <div className="px-[18px] py-4" aria-hidden>
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center gap-4 py-[11px]">
                <span className="h-[11px] w-[190px] animate-pulse rounded bg-[rgba(150,175,220,.11)]" />
                <span className="h-[18px] w-[84px] animate-pulse rounded-full bg-[rgba(150,175,220,.1)]" />
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
                  <tr
                    key={admin.membership_id}
                    className="transition-colors hover:bg-white/[0.025]"
                  >
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
                    <td className={`${tableCellClass} font-mono text-[12.4px] text-[#A0B2CE]`}>
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
                          Ver permisos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={X}
                          aria-disabled={!canManage}
                          aria-describedby={canManage ? undefined : "admins-manage-reason"}
                          title={
                            canManage
                              ? "Quitar del equipo"
                              : "Esta acción la hace el administrador principal del colegio."
                          }
                          onClick={() => {
                            if (!canManage) return;
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
        <Chip tone="muted" dot>
          Sistema operativo
        </Chip>
        <span>
          Los permisos de cada rango los devuelve la API: el panel no decide qué puede hacer cada
          uno.
        </span>
      </p>

      {detail && (
        <SectionCard
          className="mt-4"
          title={`${detail.full_name} · ${detail.admin_role === "principal" ? "Principal" : "Secundario"}`}
          description="Qué puede hacer este rango en el colegio"
          actions={
            <Button variant="ghost" size="sm" icon={X} onClick={() => setDetail(null)}>
              Cerrar
            </Button>
          }
        >
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {detail.permissions.map((permission) => (
              <li key={permission.permission} className="flex items-start gap-2 text-[13px]">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                <span className="text-muted-foreground">{permission.label}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

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
    </>
  );
}
