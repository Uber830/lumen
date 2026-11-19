// =============================================================================
// The activation links card (admin).
// -----------------------------------------------------------------------------
// When an admin creates a teacher or a student, the API returns a one-time
// activation token. The admin can share the link with the new member so
// they can set their password and sign in.
//
// The card is shared by the teachers and the students pages so both show
// the same thing.
// =============================================================================

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { SectionCard } from "@/components/ui-kit";

export type ActivationLink = {
  email: string;
  link: string;
};

/** One activation link with a copy-to-clipboard button. */
export function ActivationRow({ email, link }: ActivationLink) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied (e.g. insecure context): fall back to a prompt
      // so the admin can still copy the link manually.
      window.prompt("Copiá el enlace de activación:", link);
    }
  }

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{email}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{link}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-success" /> Copiado
          </>
        ) : (
          <>
            <Copy className="size-3.5" /> Copiar enlace
          </>
        )}
      </button>
    </li>
  );
}

/**
 * The activation link, shown as a copyable box.
 *
 * Used by the member card: the admin keeps it there while the account
 * is pending, so the link never gets lost.
 */
export function CopyableActivationLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá el enlace de activación:", link);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <p className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
        {link}
      </p>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-success" /> Copiado
          </>
        ) : (
          <>
            <Copy className="size-3.5" /> Copiar
          </>
        )}
      </button>
    </div>
  );
}

/** The card that lists the activation links the admin can share. */
export function ActivationLinksCard({
  links,
  roleLabel,
  onHide,
}: {
  links: ActivationLink[];
  roleLabel: string;
  onHide: () => void;
}) {
  if (links.length === 0) return null;

  return (
    <SectionCard
      title="Enlaces de activación"
      description={`Compartí cada enlace con ${roleLabel} para que defina su contraseña e ingrese. Son de un solo uso.`}
      actions={
        <button
          type="button"
          onClick={onHide}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          Ocultar
        </button>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-border">
        {links.map((link) => (
          <ActivationRow key={link.link} email={link.email} link={link.link} />
        ))}
      </ul>
    </SectionCard>
  );
}
