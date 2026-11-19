import { z } from "zod";

export const taskSubmissionStatusSchema = z.enum(["draft", "submitted", "graded", "returned"]);

export const taskFormSchema = z.object({
  title: z
    .string()
    .min(2, "El titulo debe tener al menos 2 caracteres.")
    .max(120, "El titulo no puede tener mas de 120 caracteres."),
  description: z
    .string()
    .max(2000, "La descripcion no puede tener mas de 2000 caracteres.")
    .optional()
    .or(z.literal("")),
  course_subject_id: z.string().uuid("Selecciona un curso-materia valido."),
  due_at: z.string().min(1, "Indica la fecha de entrega.").optional().or(z.literal("")),
  max_score: z
    .number()
    .min(0, "La calificacion maxima no puede ser negativa.")
    .max(1000, "La calificacion maxima es 1000.")
    .optional(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const taskSubmissionFormSchema = z.object({
  body: z
    .string()
    .max(20000, "La entrega no puede tener mas de 20000 caracteres.")
    .optional()
    .or(z.literal("")),
  status: taskSubmissionStatusSchema.default("submitted"),
});

export type TaskSubmissionFormValues = z.infer<typeof taskSubmissionFormSchema>;
