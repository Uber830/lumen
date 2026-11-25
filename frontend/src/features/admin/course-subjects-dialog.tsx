// =============================================================================
// The subjects of a course, in a modal.
// -----------------------------------------------------------------------------
// The list of the subjects of a course lives in a modal, not in a row
// that unfolds under the course: opening it does not move the table,
// and the courses keep the place they had.
//
// A subject leaves the course from here: the school stops offering it
// in that course. The assignments of the teachers that had it stay,
// and the way to give them another subject is the assign view.
// =============================================================================

import { BookOpen, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { Chip } from "@/components/ui-kit";

/** One subject the course offers. */
export type CourseSubjectItem = {
  /** The id of the offering: what leaves the course. */
  id: string;
  subjectName: string;
  area: string | null;
  assignedTeachers: number;
};

export function CourseSubjectsDialog({
  open,
  onOpenChange,
  courseName,
  items,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The name of the course, to title the modal. */
  courseName: string;
  items: CourseSubjectItem[];
  /** Asks to stop offering the subject in this course. */
  onRemove: (item: CourseSubjectItem) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Materias de {courseName}</DialogTitle>
          <DialogDescription>
            {items.length === 0
              ? "Este curso no ofrece ninguna materia todavía."
              : `${items.length} ${items.length === 1 ? "materia ofrecida" : "materias ofrecidas"}`}
          </DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Crea una materia y ofrécela en este curso para que los docentes puedan impartirla.
          </p>
        ) : (
          <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2.5 rounded-idx border border-border bg-card px-3 py-2"
              >
                <BookOpen
                  className="size-[15px] shrink-0 text-primary"
                  strokeWidth={1.9}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[13.4px] font-medium">
                  {item.subjectName}
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {item.area ?? "Sin área"}
                </span>
                <Chip tone="muted">
                  {item.assignedTeachers} docente{item.assignedTeachers === 1 ? "" : "s"}
                </Chip>
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  aria-label={`Quitar ${item.subjectName} del curso`}
                  title="Quitar del curso"
                  className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <X className="size-3.5" strokeWidth={1.9} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
