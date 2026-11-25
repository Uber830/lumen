// =============================================================================
// The form of a message in the support thread.
// -----------------------------------------------------------------------------
// The school opens a case and answers in its thread; the platform team
// answers in the same thread. The two write in the same place, so the
// two see the same form: the design lives here, once, and both sides
// use it.
//
// The style is the one of the panel: square corners, the same fields,
// the same buttons and the same way of attaching files.
// =============================================================================

import { Send } from "lucide-react";
import type { ReactNode } from "react";

import {
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

export function CaseMessageForm({
  title,
  description,
  recipients,
  fields,
  message,
  onMessageChange,
  messageLabel = "Mensaje *",
  messagePlaceholder,
  messageHint,
  attachments,
  onAttachmentsChange,
  showAttachments = true,
  notice,
  problem,
  submitLabel,
  onSubmit,
  pending,
  onCancel,
  cancelLabel = "Cerrar",
  submitIcon = Send,
}: {
  /** The name of the window: "Nueva solicitud", "Responder al caso". */
  title: string;
  /** The line under the name: what this message is about. */
  description?: string;
  /** Who the message is for. It is shown as a row of tags. */
  recipients?: string[];
  /** The fields that are not the message: the subject, the category. */
  fields?: ReactNode;
  message: string;
  onMessageChange: (value: string) => void;
  messageLabel?: string;
  messagePlaceholder?: string;
  /** The line under the message: what happens with it. */
  messageHint?: string;
  attachments: PickedAttachment[];
  onAttachmentsChange: (next: PickedAttachment[]) => void;
  /** Some threads cannot carry a file: there is nowhere to keep it. */
  showAttachments?: boolean;
  /** The good news: the message is in the thread. */
  notice?: string | null;
  /** The bad news: the message did not go out. */
  problem?: string | null;
  submitLabel: string;
  onSubmit: () => void;
  pending?: boolean;
  onCancel: () => void;
  cancelLabel?: string;
  submitIcon?: typeof Send;
}) {
  const Icon = submitIcon;

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle className="text-[16px]">{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>

      {recipients && recipients.length > 0 && (
        <div className="grid gap-1.5 text-sm">
          <span className="text-xs font-medium">Para</span>
          <div className="flex flex-wrap gap-1.5">
            {recipients.map((name) => (
              <Tag key={name}>{name}</Tag>
            ))}
          </div>
        </div>
      )}

      {fields}

      <label className="grid gap-1.5 text-sm">
        <span className="text-xs font-medium">{messageLabel}</span>
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          rows={6}
          placeholder={messagePlaceholder}
          className="w-full resize-y rounded-idx border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
        {messageHint && <span className="text-xs text-muted-foreground">{messageHint}</span>}
      </label>

      {showAttachments && (
        <SupportAttachmentField attachments={attachments} onChange={onAttachmentsChange} />
      )}

      {notice && (
        <p
          role="status"
          className="rounded-idx border border-success/40 bg-success-soft px-3 py-2 text-xs text-success"
        >
          {notice}
        </p>
      )}

      {problem && (
        <p
          role="alert"
          className="rounded-idx border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs text-destructive"
        >
          {problem}
        </p>
      )}

      <DialogFooter>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-idx border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-idx bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <Icon className="size-4" strokeWidth={1.9} aria-hidden />
          {pending ? "Enviando..." : submitLabel}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}
