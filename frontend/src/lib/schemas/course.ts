import { z } from "zod";

export const courseFormSchema = z.object({
  name: z
    .string()
    .min(1, "Indica un nombre para el curso.")
    .max(60, "El nombre no puede tener mas de 60 caracteres."),
  grade_label: z
    .string()
    .min(1, "Indica la etiqueta de grado.")
    .max(40, "La etiqueta de grado no puede tener mas de 40 caracteres."),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;
