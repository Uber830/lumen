import { z } from "zod";

export const subjectFormSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre de la materia debe tener al menos 2 caracteres.")
    .max(60, "El nombre no puede tener mas de 60 caracteres."),
  area: z
    .string()
    .max(60, "El area no puede tener mas de 60 caracteres.")
    .optional()
    .or(z.literal("")),
});

export type SubjectFormValues = z.infer<typeof subjectFormSchema>;
