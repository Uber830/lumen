import { History, MessageSquare, Paperclip, Send, X } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { StatusPill, Tag } from "@/components/ui-kit";
import { useCase, useResolveCase } from "@/lib/platform/hooks";
import { fileNameFromPath, fileUrl } from "@/lib/storage/files";
import {
  auditEventLabel,
  CASE_CATEGORY_LABEL,
  CASE_LEVEL_LABEL,
  CASE_LEVEL_TONE,
  CASE_STATUS_LABEL,
  CASE_STATUS_TONE,
} from "@/lib/platform/types";
import { cn } from "@/lib/utils";

/**
 * The sheet of a support case.
 *
 * It shows what was asked, the conversation with the school and the
 * movements of the platform for that school. The case can be closed
 * from here, and the answer is written from the drawer.
 */
export function CasePanel({
  caseId,
  onClose,
  onReply,
  className,
}: {
  caseId: string | null;
  onClose: () => void;
  onReply: (caseId: string) => void;
  className?: string;
}) {
  const supportCase = useCase(caseId);
  const resolve = useResolveCase();
  const [problem, setProblem] = useState<string | null>(null);

  const detail = supportCase.data;

  async function onResolve() {
    if (!detail) return;
    setProblem(null);
    try {
      await resolve.mutateAsync(detail.id);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo cerrar el caso.");
    }
  }

  return (
    <Dialog open={Boolean(caseId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showClose={false}
        className={cn(
          "fixed right-0 top-0 left-auto flex h-dvh max-h-none w-full max-w-lg translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-border bg-card p-0 shadow-lift sm:rounded-none",
          className,
        )}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4 text-left">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[16px]">{detail?.title ?? "Caso"}</DialogTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {detail && (
                <>
                  <StatusPill
                    label={CASE_LEVEL_LABEL[detail.level]}
                    tone={CASE_LEVEL_TONE[detail.level]}
                  />
                  <StatusPill
                    label={CASE_STATUS_LABEL[detail.status]}
                    tone={CASE_STATUS_TONE[detail.status]}
                  />
                  <Tag>{detail.code}</Tag>
                </>
              )}
            </div>
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
          {problem && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs text-destructive"
            >
              {problem}
            </p>
          )}

          {detail && (
            <>
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  El caso
                </h3>
                <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Colegio</dt>
                  <dd>{detail.school_name ?? "Sin colegio"}</dd>
                  <dt className="text-muted-foreground">Solicita</dt>
                  <dd>{detail.opened_by_name}</dd>
                  <dt className="text-muted-foreground">Motivo</dt>
                  <dd>{CASE_CATEGORY_LABEL[detail.category]}</dd>
                  <dt className="text-muted-foreground">Recibido</dt>
                  <dd>
                    {new Date(detail.opened_at).toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </dd>
                </dl>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  <MessageSquare className="size-3.5" strokeWidth={1.9} aria-hidden />
                  Conversación con el colegio
                </h3>
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
                      {message.attachment_ids.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {message.attachment_ids.map((attachment) => (
                            <li key={attachment}>
                              <a
                                href={fileUrl(attachment) ?? "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-idx border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                              >
                                <Paperclip
                                  className="size-3.5 shrink-0"
                                  strokeWidth={1.9}
                                  aria-hidden
                                />
                                {fileNameFromPath(attachment)}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                  {detail.messages.length === 0 && (
                    <li className="text-sm text-muted-foreground">
                      Todavía no hay mensajes en este caso.
                    </li>
                  )}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  <History className="size-3.5" strokeWidth={1.9} aria-hidden />
                  Registro de la plataforma
                </h3>
                <ul className="flex flex-col divide-y divide-border">
                  {detail.audit.map((event) => (
                    <li key={event.id} className="py-2.5">
                      <p className="text-sm">{auditEventLabel(event.event_type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.actor_name ?? "Sistema"} ·{" "}
                        {new Date(event.created_at).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </li>
                  ))}
                  {detail.audit.length === 0 && (
                    <li className="py-2.5 text-sm text-muted-foreground">
                      Sin movimientos registrados para este colegio.
                    </li>
                  )}
                </ul>
              </section>
            </>
          )}
        </div>

        {detail && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
            {detail.can_resolve && (
              <button
                type="button"
                onClick={() => void onResolve()}
                disabled={resolve.isPending}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-60"
              >
                Marcar como resuelto
              </button>
            )}
            <button
              type="button"
              onClick={() => onReply(detail.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Send className="size-3.5" strokeWidth={1.9} aria-hidden />
              Responder
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
