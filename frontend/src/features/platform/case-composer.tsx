import { AlertTriangle, Send } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { Tag } from "@/components/ui-kit";
import {
  SupportAttachmentField,
  type PickedAttachment,
} from "@/features/admin/support-attachments";
import { useAnswerCase, useUploadCaseAttachment } from "@/lib/platform/hooks";
import type { CaseSummary } from "@/lib/platform/types";

/**
 * The answer of the platform team.
 *
 * It answers one case or several at once: the body is the same for
 * all of them and each conversation keeps its own turn. What is
 * written here stays in the history of the case.
 *
 * The answer may carry files, the same way the school's request does:
 * a guide, a capture of the fix, the document the school asked for.
 */
export function CaseComposer({
  open,
  cases,
  onClose,
}: {
  open: boolean;
  cases: CaseSummary[];
  onClose: () => void;
}) {
  const answer = useAnswerCase();
  const uploadFile = useUploadCaseAttachment();

  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const recipients = cases.map((item) => item.school_name ?? item.opened_by_name);
  // The file belongs to the case: with several cases at once there is
  // no single case to attach it to.
  const singleCase = cases.length === 1 ? cases[0] : null;

  async function onSubmit() {
    if (!body.trim()) {
      setProblem("Escribe la respuesta antes de enviarla.");
      return;
    }
    setProblem(null);
    try {
      for (const item of cases) {
        await answer.mutateAsync({
          id: item.id,
          body: body.trim(),
          attachment_ids: item.id === singleCase?.id ? attachments.map((file) => file.id) : [],
        });
      }
      setNotice(
        cases.length === 1
          ? "La respuesta quedó en el caso."
          : `La respuesta quedó en ${cases.length} casos.`,
      );
      setBody("");
      setAttachments([]);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo enviar la respuesta.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setBody("");
          setAttachments([]);
          setNotice(null);
          setProblem(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {cases.length === 1 ? "Responder al caso" : `Responder a ${cases.length} casos`}
          </DialogTitle>
          <DialogDescription>
            {cases.length === 1 && cases[0]
              ? `${cases[0].code} · ${cases[0].title}`
              : "La misma respuesta queda en la conversación de cada caso."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5 text-sm">
          <span className="text-xs font-medium">Para</span>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set(recipients)].map((name) => (
              <Tag key={name}>{name}</Tag>
            ))}
            {recipients.length === 0 && (
              <span className="text-xs text-muted-foreground">Sin destinatario</span>
            )}
          </div>
        </div>

        <label className="grid gap-1.5 text-sm">
          <span className="text-xs font-medium">Mensaje *</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            placeholder="Escribe la respuesta al colegio…"
            className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <span className="text-xs text-muted-foreground">
            Queda registrado en el historial del caso.
          </span>
        </label>

        {singleCase && (
          <SupportAttachmentField
            attachments={attachments}
            onChange={setAttachments}
            upload={(file) =>
              uploadFile
                .mutateAsync({ caseId: singleCase.id, file })
                .then((item) => ({ id: item.id, name: item.name, size: item.size }))
            }
          />
        )}

        {notice && (
          <p
            role="status"
            className="rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-xs text-success"
          >
            {notice}
          </p>
        )}

        {problem && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
            {problem}
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              setBody("");
              setAttachments([]);
              setNotice(null);
              setProblem(null);
              onClose();
            }}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={answer.isPending || body.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Send className="size-4" strokeWidth={1.9} aria-hidden />
            Enviar respuesta
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
