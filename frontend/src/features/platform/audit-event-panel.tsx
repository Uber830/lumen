import { Info, MessageSquare, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { StatusPill, Tag } from "@/components/ui-kit";
import { useCase } from "@/lib/platform/hooks";
import {
  auditEventLabel,
  CASE_LEVEL_LABEL,
  CASE_LEVEL_TONE,
  CASE_STATUS_LABEL,
  CASE_STATUS_TONE,
  type AuditEntry,
} from "@/lib/platform/types";

/**
 * The drawer of an audit event.
 *
 * It opens when a row of the audit trail is clicked: it says who did
 * what and when. When the event belongs to a support case, the
 * conversation of that ticket is shown too, so the trail and the
 * history of the case are read in the same place.
 */

const LEVEL_LABEL = {
  info: "Info",
  warning: "Aviso",
  error: "Error",
} as const;

const LEVEL_TONE = {
  info: "info",
  warning: "warning",
  error: "danger",
} as const;

export function AuditEventPanel({
  event,
  schoolName,
  onClose,
}: {
  event: AuditEntry | null;
  schoolName?: string | null;
  onClose: () => void;
}) {
  // Only a case event carries a conversation; the rest of the trail is
  // about the catalog or the network.
  const caseId = event?.subject_type === "support_case" ? event.subject_id : null;
  const supportCase = useCase(caseId);
  const detail = supportCase.data;

  const entries = event ? Object.entries(event.detail) : [];

  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showClose={false}
        className="fixed right-0 top-0 left-auto flex h-dvh max-h-none w-full max-w-lg translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-border bg-card p-0 shadow-lift sm:rounded-none"
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4 text-left">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[16px]">
              {event ? auditEventLabel(event.event_type) : "Evento"}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {event ? event.id : "El movimiento en la operación de la plataforma."}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar el panel"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" strokeWidth={1.9} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {event && (
            <>
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  El evento
                </h3>
                <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Colegio</dt>
                  <dd>{schoolName ?? (event.school_id ? "Colegio de la red" : "Sin colegio")}</dd>
                  <dt className="text-muted-foreground">Actor</dt>
                  <dd>{event.actor_name ?? "Sistema"}</dd>
                  <dt className="text-muted-foreground">Fecha</dt>
                  <dd>
                    {new Date(event.created_at).toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </dd>
                  <dt className="text-muted-foreground">Nivel</dt>
                  <dd>
                    <StatusPill
                      label={LEVEL_LABEL[event.level] ?? event.level}
                      tone={LEVEL_TONE[event.level] ?? "muted"}
                    />
                  </dd>
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  Detalle del evento
                </h3>
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">El evento no tiene detalle.</p>
                ) : (
                  <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                    {entries.map(([key, value]) => (
                      <div key={key} className="contents">
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd className="code-cell">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            </>
          )}

          {caseId && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                <MessageSquare className="size-3.5" strokeWidth={1.9} aria-hidden />
                Historial del caso
              </h3>

              {supportCase.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando la conversación…</p>
              ) : !detail ? (
                <p className="text-sm text-muted-foreground">
                  No se pudo cargar la conversación del caso.
                </p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    <StatusPill
                      label={CASE_LEVEL_LABEL[detail.level]}
                      tone={CASE_LEVEL_TONE[detail.level]}
                    />
                    <StatusPill
                      label={CASE_STATUS_LABEL[detail.status]}
                      tone={CASE_STATUS_TONE[detail.status]}
                    />
                    <Tag>{detail.code}</Tag>
                  </div>
                  <p className="mb-3 text-sm font-medium">{detail.title}</p>

                  <ul className="flex flex-col gap-3">
                    {detail.messages.map((message) => (
                      <li
                        key={message.id}
                        className={`rounded-lg border px-3 py-2.5 ${
                          message.author_role === "plataforma"
                            ? "border-primary/40 bg-primary-soft"
                            : "border-border bg-muted/30"
                        }`}
                      >
                        <p className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold">{message.author_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {message.author_role} ·{" "}
                            {new Date(message.created_at).toLocaleString("es-CO", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{message.body}</p>
                      </li>
                    ))}
                    {detail.messages.length === 0 && (
                      <li className="text-sm text-muted-foreground">
                        Este caso todavía no tiene mensajes.
                      </li>
                    )}
                  </ul>
                </>
              )}
            </section>
          )}

          {event && !caseId && (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
              <span>
                Este evento no viene de un caso de soporte, así que no tiene conversación.
              </span>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
