// =============================================================================
// The member edit modal (admin).
// -----------------------------------------------------------------------------
// Opens from the drawer of a teacher or a student: the admin changes the
// name and the email. The courses of a student are part of the form; the
// courses of a teacher are not: they are changed in Asignaciones, where
// each one is a row.
//
// The list of the community is the truth: what the form sends is what the
// member ends up having.
//
// A self-contained overlay (the pattern used elsewhere in the app) rather
// than the Radix dialog barrel, which the current bundler does not resolve
// from the route graph.
// =============================================================================

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui-kit";
import { useSchoolCourseOptions, useUpdateMember } from "@/lib/school/community";

export type EditableMember = {
  membership_id: string;
  full_name: string | null;
  email: string | null;
  /** The courses of a student, by id. */
  course_ids?: string[];
  /** The course subjects of a teacher, by id. */
  course_subject_ids?: string[];
};

export function MemberEditDialog({
  member,
  role,
  onClose,
  onSaved,
}: {
  member: EditableMember;
  /** Whether the member is a teacher or a student. */
  role: "teacher" | "student";
  onClose: () => void;
  /** Called when the changes are saved. */
  onSaved: () => void;
}) {
  const updateMember = useUpdateMember();

  const [fullName, setFullName] = useState(member.full_name ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  // The course of a student. The courses of a teacher are not here:
  // they are changed in Asignaciones.
  // A student belongs to **one** course: the school has one grade per
  // student, and a student in two courses has no average and no tasks.
  const [courseId, setCourseId] = useState<string>(
    role === "student" ? (member.course_ids?.[0] ?? "") : "",
  );
  // The error of the request is shown by the hook itself.

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSave() {
    try {
      await updateMember.mutateAsync({
        membershipId: member.membership_id,
        full_name: fullName.trim(),
        email: email.trim(),
        // The courses of a student are part of the form. The courses
        // of a teacher are not: they are changed in Asignaciones, where
        // each one is a row. Not sending them leaves them as they are.
        ...(role === "student" ? { course_ids: courseId ? [courseId] : [] } : {}),
      });
      onSaved();
      onClose();
    } catch {
      // Surfaced below via updateMember.error.
    }
  }

  const isTeacher = role === "teacher";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 sm:place-items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isTeacher ? "Editar docente" : "Editar estudiante"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-card p-5 sm:rounded-lg sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <h2 className="text-lg font-bold">
            {isTeacher ? "Editar docente" : "Editar estudiante"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nombre completo
            </span>
            <input
              type="text"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nombre y apellidos"
              className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Correo institucional
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@colegio.edu.co"
              className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
            />
          </label>

          {/* The course of a student is part of the form. The courses
              of a teacher are not: they are changed in Asignaciones,
              where each one is a row. */}
          {!isTeacher && (
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Curso
              </legend>
              <StudentCourses courseId={courseId} onPick={setCourseId} />
            </fieldset>
          )}

          {updateMember.error && (
            <p role="alert" className="text-[13px] text-destructive">
              {updateMember.error.message}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose} type="button">
              Cancelar
            </Button>
            <Button type="submit" icon={Check} disabled={updateMember.isPending}>
              {updateMember.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * The course of a student.
 *
 * A student is in **one** course: the one that says what he studies, what
 * he is graded on and what tasks he has. The list is a radio group, not a
 * set of checkboxes, so two courses can never be picked at once.
 */
function StudentCourses({ courseId, onPick }: { courseId: string; onPick: (id: string) => void }) {
  const courses = useSchoolCourseOptions();
  return (
    <div className="mt-2 max-h-[220px] space-y-1.5 overflow-y-auto">
      {(courses.data ?? []).map((course) => {
        const checked = courseId === course.id;
        return (
          <label
            key={course.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-idx border px-3 py-2 text-[13px] transition-colors ${
              checked
                ? "border-primary/50 bg-primary-soft text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-input"
            }`}
          >
            <input
              type="radio"
              name="curso-del-estudiante"
              checked={checked}
              onChange={() => onPick(course.id)}
              className="size-[15px] accent-primary"
            />
            {course.name}
          </label>
        );
      })}
      {(courses.data ?? []).length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          El colegio todavía no tiene cursos. Crea uno en «Cursos y materias».
        </p>
      )}
      {(courses.data ?? []).length > 0 && (
        <p className="pt-1 text-[12px] text-muted-foreground">
          El estudiante pertenece a un solo curso. Cambiarlo lo matricula en el nuevo.
        </p>
      )}
    </div>
  );
}
