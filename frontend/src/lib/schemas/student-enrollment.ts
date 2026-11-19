import { z } from "zod";

export const enrollmentStatusSchema = z.enum(["active", "withdrawn", "completed"]);

export const studentEnrollmentFormSchema = z.object({
  course_id: z.string().uuid("Selecciona un curso valido."),
  student_id: z.string().uuid("Selecciona un estudiante valido."),
  status: enrollmentStatusSchema.default("active"),
});

export type StudentEnrollmentFormValues = z.infer<typeof studentEnrollmentFormSchema>;
