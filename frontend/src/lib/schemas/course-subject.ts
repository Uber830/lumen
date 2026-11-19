import { z } from "zod";

export const courseSubjectFormSchema = z.object({
  course_id: z.string().uuid("Selecciona un curso valido."),
  subject_id: z.string().uuid("Selecciona una materia valida."),
});

export type CourseSubjectFormValues = z.infer<typeof courseSubjectFormSchema>;
