// =============================================================================
// The structure of the college: courses and subjects, step by step.
// -----------------------------------------------------------------------------
// The three things the school needs to build its academic year live in
// one form: a course (4to A), a subject (Mathematics) and the offering
// of that subject in that course.
//
// They come in that order, because each one needs the previous: a
// subject is offered in a course, and a course is what the offering
// hangs on.
//
// The form is big and central, in a modal: the list of the courses does
// not move while the principal of the school builds the year. Each step
// can be skipped: an empty step just moves to the next one.
// =============================================================================

import { Check, Link2, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { Button } from "@/components/ui-kit";
import { Select } from "@/components/select-field";
import {
  useCourseSubjects,
  useCreateCourse,
  useCreateCourseSubject,
  useCreateSubject,
  useCourses,
  useSubjects,
} from "@/features/academics/hooks";
import { cn } from "@/lib/utils";

/** The steps of the form, in the order they happen. */
const STEPS = [
  { id: "curso", label: "Curso", title: "Crear curso" },
  { id: "materia", label: "Materia", title: "Crear materia" },
  { id: "ofrecer", label: "Ofrecer", title: "Ofrecer la materia en un curso" },
] as const;

/** The areas a school uses, as suggestions for the field. */
const SUGGESTED_AREAS = [
  "Matemáticas",
  "Lengua",
  "Ciencias",
  "Sociales",
  "Inglés",
  "Arte",
  "Educación Física",
];

export function AcademicStructureWizard({
  schoolId,
  open,
  onClose,
}: {
  schoolId: string;
  open: boolean;
  onClose: () => void;
}) {
  const academicCourses = useCourses(schoolId);
  const academicSubjects = useSubjects(schoolId);
  const courseSubjects = useCourseSubjects(schoolId);
  const createCourse = useCreateCourse(schoolId);
  const createSubject = useCreateSubject(schoolId);
  const createCourseSubject = useCreateCourseSubject(schoolId);

  const [step, setStep] = useState(0);
  const [courseName, setCourseName] = useState("");
  const [courseGrade, setCourseGrade] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectArea, setSubjectArea] = useState("");
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const courseOptions = useMemo(
    () =>
      (academicCourses.data ?? []).map((course) => ({
        value: course.id,
        label: course.name,
        hint: course.grade_label,
      })),
    [academicCourses.data],
  );

  const subjectOptions = useMemo(
    () =>
      (academicSubjects.data ?? []).map((subject) => ({
        value: subject.id,
        label: subject.name,
        hint: subject.area ?? undefined,
      })),
    [academicSubjects.data],
  );

  // The pairs already offered, so the form does not offer what exists.
  const offeredPairs = useMemo(
    () => new Set((courseSubjects.data ?? []).map((cs) => `${cs.course_id}:${cs.subject_id}`)),
    [courseSubjects.data],
  );

  // A subject already offered in the selected course cannot be offered again.
  const availableSubjects = useMemo(
    () =>
      subjectOptions.map((option) => ({
        ...option,
        disabled: courseId ? offeredPairs.has(`${courseId}:${option.value}`) : false,
      })),
    [subjectOptions, courseId, offeredPairs],
  );

  function reset() {
    setStep(0);
    setCourseName("");
    setCourseGrade("");
    setSubjectName("");
    setSubjectArea("");
    setCourseId("");
    setSubjectId("");
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  /** The course of the step, when it has something to save. */
  async function onNextCourse(): Promise<boolean> {
    const empty = !courseName.trim() && !courseGrade.trim();
    if (empty) {
      // An empty step is a step that is skipped.
      setError(null);
      return true;
    }
    if (!courseName.trim() || !courseGrade.trim()) {
      setError("Escribe el nombre y la etiqueta de grado, o deja el paso en blanco para saltarlo.");
      return false;
    }
    setError(null);
    await createCourse.mutateAsync({
      name: courseName.trim(),
      grade_label: courseGrade.trim(),
    });
    setCourseName("");
    setCourseGrade("");
    return true;
  }

  /** The subject of the step, when it has something to save. */
  async function onNextSubject(): Promise<boolean> {
    if (!subjectName.trim()) {
      setError(null);
      return true;
    }
    setError(null);
    await createSubject.mutateAsync({
      name: subjectName.trim(),
      area: subjectArea.trim() || null,
    });
    setSubjectName("");
    setSubjectArea("");
    return true;
  }

  /** The offering of the step. */
  async function onOffer(): Promise<boolean> {
    if (!courseId || !subjectId) {
      setError("Elige el curso y la materia que quieres ofrecer.");
      return false;
    }
    setError(null);
    await createCourseSubject.mutateAsync({ course_id: courseId, subject_id: subjectId });
    setSubjectId("");
    return true;
  }

  async function onNext() {
    try {
      const done =
        step === 0 ? await onNextCourse() : step === 1 ? await onNextSubject() : await onOffer();
      if (!done) return;
      if (step === STEPS.length - 1) {
        close();
        return;
      }
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo guardar.");
    }
  }

  function onBack() {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  const pending =
    createCourse.isPending || createSubject.isPending || createCourseSubject.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-[17px]">Cursos y materias</DialogTitle>
          <DialogDescription>
            La estructura académica del colegio, paso a paso. Un paso en blanco se salta.
          </DialogDescription>
        </DialogHeader>

        {/* The path of the form: where the administrator is and what is
            still ahead. */}
        <ol className="flex items-stretch gap-2 border-b border-border bg-secondary/60 px-6 py-3">
          {STEPS.map((item, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={item.id} className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-idx border text-[12px] font-semibold",
                    done && "border-primary bg-primary text-primary-foreground",
                    current && "border-primary bg-primary-soft text-primary",
                    !done && !current && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={2.2} /> : index + 1}
                </span>
                <span
                  className={cn(
                    "truncate text-[12.5px]",
                    current ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="px-6 py-5">
          <h3 className="text-[15px] font-semibold text-foreground">{STEPS[step].title}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {step === 0
              ? "El curso agrupa a los estudiantes de un grado: 4to A, 7mo B…"
              : step === 1
                ? "La materia es la asignatura que después se imparte y se asigna a un docente."
                : "Las materias ofrecidas en un curso son las que después se asignan a docentes."}
          </p>

          <div className="mt-4">
            {step === 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nombre
                  </span>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(event) => setCourseName(event.target.value)}
                    placeholder="4to A"
                    className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Etiqueta de grado
                  </span>
                  <input
                    type="text"
                    value={courseGrade}
                    onChange={(event) => setCourseGrade(event.target.value)}
                    placeholder="Cuarto"
                    className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                  />
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nombre de la materia
                  </span>
                  <input
                    type="text"
                    value={subjectName}
                    onChange={(event) => setSubjectName(event.target.value)}
                    placeholder="Matemáticas"
                    className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Área
                  </span>
                  <input
                    type="text"
                    list="areas-sugeridas"
                    value={subjectArea}
                    onChange={(event) => setSubjectArea(event.target.value)}
                    placeholder="Matemáticas"
                    className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                  />
                  <datalist id="areas-sugeridas">
                    {SUGGESTED_AREAS.map((area) => (
                      <option key={area} value={area} />
                    ))}
                  </datalist>
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Curso
                  </span>
                  <div className="mt-1.5">
                    <Select
                      value={courseId}
                      onChange={setCourseId}
                      options={courseOptions}
                      placeholder={
                        courseOptions.length ? "Elige un curso" : "Primero crea un curso"
                      }
                      emptyLabel="Todavía no hay cursos"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Materia
                  </span>
                  <div className="mt-1.5">
                    <Select
                      value={subjectId}
                      onChange={setSubjectId}
                      options={availableSubjects}
                      placeholder={
                        availableSubjects.length ? "Elige una materia" : "Primero crea una materia"
                      }
                      emptyLabel="Todavía no hay materias"
                    />
                  </div>
                </label>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 text-[13px] text-destructive">
                {error}
              </p>
            )}
            {(createCourse.error || createSubject.error || createCourseSubject.error) && (
              <p role="alert" className="mt-3 text-[13px] text-destructive">
                {(createCourse.error ?? createSubject.error ?? createCourseSubject.error)?.message}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 sm:justify-between">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" type="button" onClick={onBack} disabled={pending}>
                Atrás
              </Button>
            )}
            <Button variant="ghost" type="button" onClick={close} disabled={pending}>
              Cancelar
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12.4px] text-muted-foreground">
              Paso {step + 1} de {STEPS.length}
            </span>
            <Button
              type="button"
              icon={step === STEPS.length - 1 ? Link2 : Plus}
              onClick={() => void onNext()}
              disabled={pending}
            >
              {pending
                ? "Guardando..."
                : step === STEPS.length - 1
                  ? "Ofrecer materia"
                  : "Siguiente"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
