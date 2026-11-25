// =============================================================================
// The member management drawer (admin).
// -----------------------------------------------------------------------------
// Opens when an admin clicks a teacher or a student in the list. Shows the
// data of the person (Correo, curso, ingreso, acceso, estado) and lets the
// admin edit them or turn the access off.
//
// Deactivating soft-revokes the membership: the backend refuses to revoke
// the admin themselves or the last admin.
//
// A self-contained overlay (the pattern used elsewhere in the app, e.g.
// the ICFES question modal) rather than the Radix dialog barrel, which
// the current bundler does not resolve from the route graph.
// =============================================================================

import { useEffect, useState } from "react";
import { Info, KeyRound, Link2, Power, PowerOff, X } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { CopyableActivationLink } from "@/features/admin/activation-links";
import { useCreateActivationLink, useUpdateMembership } from "@/lib/users/invitations";
import { activationLink } from "@/lib/users/invitations";
import type { SchoolMember } from "@/features/academics/types";

export function MemberManageDialog({
  member,
  roleLabel,
  onClose,
  onEdit,
}: {
  member: SchoolMember;
  /** How the role is named in the button: "docente" or "estudiante". */
  roleLabel: string;
  onClose: () => void;
  /** Opens the edit form of the person. */
  onEdit: () => void;
}) {
  const updateMembership = useUpdateMembership();
  const createActivationLink = useCreateActivationLink();

  // The link the admin can share. It comes with the member; when the
  // admin asks for a new one, it is kept here until the list catches up.
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  // Close on Escape, the expected behaviour for a modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isRevoked = member.revoked_at !== null;
  const activated = member.account_activated;
  // The link is not stored: it is issued on demand and the previous one
  // stops working. The admin sees it right after asking for it.
  const token = issuedToken;

  // One signal, not two: whether the member can reach the content of the
  // school. The backend says why when the answer is "pendiente".
  const hasAccess = member.access === "activado";
  const accessReason =
    member.access_reason ??
    (hasAccess
      ? "Puede ver el material de sus cursos."
      : isRevoked
        ? "La membresía está desactivada: reactivala para que pueda entrar."
        : activated
          ? "Todavía no tiene cursos asignados."
          : "La cuenta está pendiente de activación: compartí el enlace de abajo.");

  // A teacher teaches many courses and subjects: they do not live in
  // this drawer. The courses and the subjects of a person are changed
  // in the assign view, where each one is a row.
  const isTeacher = roleLabel === "docente";

  async function toggle() {
    try {
      await updateMembership.mutateAsync({
        membershipId: member.membership_id,
        revoked: !isRevoked,
      });
      onClose();
    } catch {
      // Surfaced below via updateMembership.error.
    }
  }

  async function onGenerateLink() {
    try {
      const result = await createActivationLink.mutateAsync(member.membership_id);
      setIssuedToken(result.activation_token);
    } catch {
      // Surfaced below via createActivationLink.error.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 sm:place-items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Gestionar a ${member.full_name}`}
      onClick={(e) => {
        // Click on the backdrop (not the panel) closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-lg bg-card p-5 sm:rounded-lg sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{member.full_name}</h2>
            <p className="truncate text-sm text-muted-foreground">{member.email ?? "Sin correo"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* The data of the person, as the panel writes it. */}
        <dl className="mt-5 grid grid-cols-[118px_1fr] gap-x-3.5 gap-y-2.5 text-[13.2px]">
          <dt className="text-[12.4px] text-muted-foreground">Correo</dt>
          <dd className="min-w-0 truncate">{member.email ?? "Sin correo"}</dd>

          <dt className="text-[12.4px] text-muted-foreground">Ingreso</dt>
          <dd className="font-mono text-[12.4px]">
            {new Date(member.joined_at).toLocaleDateString("es-CO")}
          </dd>

          {member.average !== undefined && (
            <>
              <dt className="text-[12.4px] text-muted-foreground">Promedio</dt>
              <dd className="font-mono text-[12.4px]">
                {member.average === null ? "—" : member.average.toFixed(2)}
              </dd>
            </>
          )}

          <dt className="text-[12.4px] text-muted-foreground">Acceso</dt>
          <dd>
            <StatusBadge tone={hasAccess ? "success" : "warning"}>
              {hasAccess ? "Activado" : "Sin activar"}
            </StatusBadge>
          </dd>

          <dt className="text-[12.4px] text-muted-foreground">Estado</dt>
          <dd>
            <StatusBadge tone={isRevoked ? "neutral" : "success"}>
              {isRevoked ? "Inactivo" : "Activo"}
            </StatusBadge>
          </dd>
        </dl>

        <p className="mt-4 flex items-start gap-2 rounded-idx bg-primary-soft/40 px-3 py-2.5 text-[13px] text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
          <span>
            <strong className="font-semibold">Acceso al material.</strong>{" "}
            {roleLabel === "docente"
              ? "El docente ve el material publicado de los cursos en los que imparte. Activar el acceso no cambia sus asignaciones."
              : "El estudiante ve el material publicado de sus cursos. Activar el acceso le permite entrar a la plataforma."}
          </span>
        </p>

        <p className="mt-3 text-[12.5px] text-muted-foreground">{accessReason}</p>

        {updateMembership.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {updateMembership.error.message}
          </p>
        )}

        {/* The activation link is issued on demand. It is shown right
            after the admin asks for it, and it is never kept: the next
            request gives a new one and the previous stops working. */}
        {!activated && (
          <div className="mt-3 rounded-lg border border-border bg-primary-soft/40 p-4">
            <div className="flex items-start gap-2">
              <KeyRound
                className="mt-0.5 size-4 shrink-0 text-primary"
                strokeWidth={1.75}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Enlace de activación</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {token
                    ? `Compartí este enlace con ${roleLabel} para que defina su contraseña e ingrese. Es de un solo uso.`
                    : `Generá un enlace para ${roleLabel} y compartilo con esa persona. Cada enlace nuevo deja de funcionar el anterior.`}
                </p>
              </div>
            </div>

            <div className="mt-3">
              {token ? (
                <div className="space-y-2">
                  <CopyableActivationLink link={activationLink(token)} />
                  <button
                    type="button"
                    onClick={onGenerateLink}
                    disabled={createActivationLink.isPending}
                    className="text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {createActivationLink.isPending
                      ? "Generando..."
                      : "Generar un enlace nuevo (invalida el anterior)"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onGenerateLink}
                  disabled={createActivationLink.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Link2 className="size-3.5" />
                  {createActivationLink.isPending ? "Generando..." : "Generar enlace de activación"}
                </button>
              )}
            </div>

            {createActivationLink.error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {createActivationLink.error.message}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={updateMembership.isPending}
            className={
              "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 " +
              (isRevoked
                ? "bg-success hover:bg-success/90"
                : "bg-destructive hover:bg-destructive/90")
            }
          >
            {isRevoked ? <Power className="size-4" /> : <PowerOff className="size-4" />}
            {updateMembership.isPending
              ? "Guardando..."
              : isRevoked
                ? "Activar acceso"
                : "Desactivar acceso"}
          </button>
        </div>
      </div>
    </div>
  );
}
