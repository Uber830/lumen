import { useRef, useState } from "react";

import { Dialog } from "@/components/dialog";
import type { PickedAttachment } from "@/features/admin/support-attachments";
import {
  attachmentPathsForCase,
  planAttachmentCopies,
} from "@/features/platform/attachment-copies";
import { CaseMessageForm } from "@/features/support/case-message-form";
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
 *
 * The file goes to the store of the school of the case, so when one
 * answer reaches several schools each one gets its own copy of it.
 *
 * The form is the shared one: the panel of the school and this desk
 * write in the same thread and look the same.
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
  const pendingRef = useRef(0);

  const recipients = cases.map((item) => item.school_name ?? item.opened_by_name);
  // A file lives in the store of the school: a case that does not
  // belong to one has nowhere to keep it.
  const canAttach = cases.length > 0 && cases.every((item) => item.school_id);

  async function onSubmit() {
    if (!body.trim()) {
      setProblem("Escribe la respuesta antes de enviarla.");
      return;
    }
    setProblem(null);
    try {
      // One copy of the files per school: the cases of the same school
      // share it, the ones of another school get their own.
      const copies = planAttachmentCopies(cases, attachments);
      const paths = new Map<string, string[]>();
      for (const copy of copies) {
        const stored: string[] = [];
        for (const attachment of copy.attachments) {
          if (!attachment.file) {
            stored.push(attachment.id);
            continue;
          }
          const result = await uploadFile.mutateAsync({
            caseId: copy.caseId,
            file: attachment.file,
          });
          stored.push(result.id);
        }
        paths.set(copy.schoolId, stored);
      }

      for (const item of cases) {
        await answer.mutateAsync({
          id: item.id,
          body: body.trim(),
          attachment_ids: attachmentPathsForCase(copies, item.school_id, paths),
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
      <CaseMessageForm
        title={cases.length === 1 ? "Responder al caso" : `Responder a ${cases.length} casos`}
        description={
          cases.length === 1 && cases[0]
            ? `${cases[0].code} · ${cases[0].title}`
            : "La misma respuesta queda en la conversación de cada caso."
        }
        recipients={recipients}
        message={body}
        onMessageChange={setBody}
        messagePlaceholder="Escribe la respuesta al colegio…"
        messageHint="Queda registrado en el historial del caso."
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        showAttachments={canAttach}
        notice={notice}
        problem={problem}
        submitLabel="Enviar respuesta"
        pending={answer.isPending}
        onSubmit={() => void onSubmit()}
        onCancel={onClose}
      />
    </Dialog>
  );
}
