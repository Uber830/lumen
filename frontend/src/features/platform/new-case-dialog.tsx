// =============================================================================
// The form that opens a conversation with a school.
// -----------------------------------------------------------------------------
// The platform team does not only answer: it can also start the
// conversation. The case belongs to the school and appears in its own
// support desk, with the message of the team at the head of the thread.
//
// The form is the shared one: the school and the platform write in the
// same thread, so the two look the same.
// =============================================================================

import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { Select } from "@/components/select-field";
import { CaseMessageForm } from "@/features/support/case-message-form";
import { useCreateCase, usePlatformSchools } from "@/lib/platform/hooks";
import { CASE_CATEGORY_LABEL, type CaseCategory } from "@/lib/platform/types";

const CATEGORIES = ["problema_tecnico", "solicitud_material", "duda_acceso", "otro"] as const;

export function NewCaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const schools = usePlatformSchools({ per_page: 50 });
  const create = useCreateCase();

  const [schoolId, setSchoolId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("problema_tecnico");
  const [body, setBody] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const schoolName =
    (schools.data?.items ?? []).find((school) => school.id === schoolId)?.name ?? "";

  async function onSubmit() {
    if (!schoolId || !title.trim() || !body.trim()) {
      setProblem("Elige el colegio, escribe el asunto y el mensaje.");
      return;
    }
    setProblem(null);
    try {
      await create.mutateAsync({
        school_id: schoolId,
        title: title.trim(),
        category,
        body: body.trim(),
      });
      setSchoolId("");
      setTitle("");
      setCategory("problema_tecnico");
      setBody("");
      onClose();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo enviar la solicitud.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setProblem(null);
          onClose();
        }
      }}
    >
      <CaseMessageForm
        title="Enviar solicitud"
        description="Escribe al colegio: la solicitud queda en su panel de soporte, con su hilo."
        recipients={schoolName ? [schoolName] : []}
        fields={
          <>
            <label className="block max-w-[320px]">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Colegio
              </span>
              <div className="mt-1.5">
                <Select
                  value={schoolId}
                  onChange={setSchoolId}
                  options={(schools.data?.items ?? []).map((school) => ({
                    value: school.id,
                    label: school.name,
                  }))}
                  placeholder="Elige un colegio"
                  emptyLabel="Todavía no hay colegios en la red"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Asunto
              </span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                placeholder="Lo que necesita el colegio"
                className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
              />
            </label>

            <label className="block max-w-[320px]">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Categoría
              </span>
              <div className="mt-1.5">
                <Select
                  value={category}
                  onChange={setCategory}
                  options={CATEGORIES.map((value) => ({
                    value,
                    label: CASE_CATEGORY_LABEL[value as CaseCategory] ?? value,
                  }))}
                  placeholder="Elige la categoría"
                />
              </div>
            </label>
          </>
        }
        message={body}
        onMessageChange={setBody}
        messagePlaceholder="Escribe el mensaje al colegio."
        messageHint="Queda registrado en el historial del caso."
        attachments={[]}
        onAttachmentsChange={() => {}}
        showAttachments={false}
        problem={problem ?? create.error?.message ?? null}
        submitLabel="Enviar solicitud"
        pending={create.isPending}
        onSubmit={() => void onSubmit()}
        onCancel={onClose}
        cancelLabel="Cancelar"
      />
    </Dialog>
  );
}
