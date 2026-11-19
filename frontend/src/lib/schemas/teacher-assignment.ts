import { z } from "zod";

export const teacherAssignmentFormSchema = z.object({
  course_subject_id: z.string().uuid("Selecciona un curso-materia valido."),
  teacher_id: z.string().uuid("Selecciona un docente valido."),
});

export type TeacherAssignmentFormValues = z.infer<typeof teacherAssignmentFormSchema>;
