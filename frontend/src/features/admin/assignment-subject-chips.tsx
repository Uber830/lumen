// =============================================================================
// The subjects a teacher is assigned to, without breaking the table.
// -----------------------------------------------------------------------------
// A teacher can be assigned to many course subjects. Written one after
// the other, the list grows until it breaks the row it lives in.
//
// So only the first one is shown, and the rest are counted: the "+2"
// opens a modal with the whole list, where each subject can be edited
// or removed. It is the same way the panel shows the courses and
// subjects of a teacher in the drawer.
// =============================================================================

import { Pencil, X } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { Tag } from "@/components/ui-kit";

/** One course subject a teacher is assigned to. */
export type AssignmentChipItem = {
  /** The id of the assignment: what is edited or removed. */
  id: string;
  courseName: string;
  subjectName: string;
};

export function AssignmentSubjectChips({
  items,
  who,
  onEdit,
  onRemove,
}: {
  items: AssignmentChipItem[];
  /** The name of the teacher, to title the modal. */
  who?: string;
  /** Opens the edit form of the assignment. */
  onEdit: (item: AssignmentChipItem) => void;
  /** Asks to remove the assignment. */
  onRemove: (item: AssignmentChipItem) => void;
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return <span className="text-muted-foreground">Sin asignar</span>;
  }

  const shown = items.slice(0, 1);
  const extra = items.length - shown.length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map((item) => (
          <Tag key={item.id}>
            {item.courseName} · {item.subjectName}
          </Tag>
        ))}
        {extra > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            title={`Ver las ${extra} materia(s) más`}
            className="inline-flex items-center rounded-full bg-primary-soft px-[9px] py-[3px] font-mono text-[11.8px] font-semibold text-primary transition-opacity hover:opacity-80"
          >
            +{extra}
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px]">
              {who ? `Materias de ${who}` : "Materias asignadas"}
            </DialogTitle>
            <DialogDescription>
              {items.length} {items.length === 1 ? "materia asignada" : "materias asignadas"}
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-idx border border-border bg-card px-3 py-2 text-[13px] text-foreground"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{item.courseName}</span>
                  <span className="text-muted-foreground"> · {item.subjectName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onEdit(item);
                  }}
                  aria-label={`Editar la asignación de ${item.subjectName} en ${item.courseName}`}
                  title="Editar la asignación"
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-3.5" strokeWidth={1.9} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onRemove(item);
                  }}
                  aria-label={`Quitar la asignación de ${item.subjectName} en ${item.courseName}`}
                  title="Quitar la asignación"
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <X className="size-3.5" strokeWidth={1.9} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
