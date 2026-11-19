import { z } from "zod";

export const academicPeriodModalitySchema = z.enum(["bimestre", "trimestre", "semestre", "anual"]);

export const academicPeriodFormSchema = z
  .object({
    name: z
      .string()
      .min(2, "El nombre debe tener al menos 2 caracteres.")
      .max(60, "El nombre no puede tener mas de 60 caracteres."),
    modality: academicPeriodModalitySchema,
    start_date: z.string().min(1, "Indica la fecha de inicio."),
    end_date: z.string().min(1, "Indica la fecha de fin."),
    is_current: z.boolean().default(false),
  })
  .refine((data) => data.start_date <= data.end_date, {
    message: "La fecha de fin debe ser igual o posterior a la de inicio.",
    path: ["end_date"],
  });

export type AcademicPeriodFormValues = z.infer<typeof academicPeriodFormSchema>;
