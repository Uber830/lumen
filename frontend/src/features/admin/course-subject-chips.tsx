// =============================================================================
// The courses and subjects of a teacher, without breaking the table.
// -----------------------------------------------------------------------------
// A teacher can teach many courses and subjects. Written one after the
// other, the list grows until it breaks the row it lives in.
//
// So only the first one is shown as a chip, and the rest are counted: the
// "+2" opens a modal with the whole list. It is the same way the platform
// module shows the schools that have access to a material.
// =============================================================================

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { ExtraCount, Tag } from "@/components/ui-kit";

/** One course and subject of a teacher. */
export type CourseSubjectItem = {
  id: string;
  /** "6to A · Matemáticas" */
  label: string;
};

export function CourseSubjectChips({
  items,
  emptyLabel = "Sin curso",
  /** The name of the teacher, to title the modal. */
  who,
}: {
  items: CourseSubjectItem[];
  emptyLabel?: string;
  who?: string;
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  const shown = items.slice(0, 1);
  const extra = items.length - shown.length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map((item) => (
          <Tag key={item.id}>{item.label}</Tag>
        ))}
        <ExtraCount
          count={extra}
          onClick={() => setOpen(true)}
          title={`Ver las ${extra} materia(s) más de ${who ?? "el docente"}`}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px]">
              {who ? `Cursos y materias de ${who}` : "Cursos y materias"}
            </DialogTitle>
            <DialogDescription>
              {items.length} {items.length === 1 ? "materia asignada" : "materias asignadas"}
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-idx border border-border bg-card px-3 py-2 text-[13px] text-foreground"
              >
                {item.label}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
