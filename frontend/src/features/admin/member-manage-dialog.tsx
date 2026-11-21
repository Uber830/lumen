// =============================================================================
// The member management modal (admin).
// -----------------------------------------------------------------------------
// Opens when an admin clicks a teacher or a student in the list. Shows the
// account state (activated or pending) and lets the admin activate/deactivate
// the membership. Deactivating soft-revokes it; the backend refuses to
// revoke the admin themselves or the last admin.
//
// A self-contained overlay (the pattern used elsewhere in the app, e.g.
// the ICFES question modal) rather than the Radix dialog barrel, which
// the current bundler does not resolve from the route graph.
// =============================================================================

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, KeyRound, Link2, Power, PowerOff, X } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { CopyableActivationLink } from "@/features/admin/activation-links";
import { useCreateActivationLink, useUpdateMembership } from "@/lib/users/invitations";
import { activationLink } from "@/lib/users/invitations";
import type { SchoolMember } from "@/features/academics/types";

export function MemberManageDialog({
  member,
  roleLabel,
  onClose,
}: {
  member: SchoolMember;
  /** How the role is named in the button: "docente" or "estudiante". */
  roleLabel: string;
  onClose: () => void;
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

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Membresía</p>
              <p className="text-xs text-muted-foreground">
                {isRevoked ? "Desactivado: no puede ingresar." : "Activo en el colegio."}
              </p>
            </div>
            <StatusBadge tone={isRevoked ? "danger" : "success"}>
              {isRevoked ? "Inactivo" : "Activo"}
            </StatusBadge>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Cuenta</p>
              <p className="text-xs text-muted-foreground">
                {activated
                  ? "Ya definió su contraseña."
                  : "Pendiente: aún no activó su cuenta con el enlace."}
              </p>
            </div>
            <span
              className={
                "inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold " +
                (activated ? "text-success" : "text-warning-foreground")
              }
            >
              {activated ? (
                <>
                  <CheckCircle2 className="size-4" /> Activada
                </>
              ) : (
                <>
                  <Clock className="size-4" /> Pendiente
                </>
              )}
            </span>
          </div>

          {updateMembership.error && (
            <p role="alert" className="text-sm text-destructive">
              {updateMembership.error.message}
            </p>
          )}
        </div>

        {/* The activation link is issued on demand. It is shown right
            after the admin asks for it, and it is never kept: the next
            request gives a new one and the previous stops working. */}
        {!activated && (
          <div className="mt-3 rounded-lg border border-border bg-primary-soft/40 p-4">
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
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
                ? `Reactivar ${roleLabel}`
                : `Desactivar ${roleLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
