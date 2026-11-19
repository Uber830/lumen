import { z } from "zod";

export const contentKindSchema = z.enum(["document", "video", "link", "text"]);

export const contentItemFormSchema = z
  .object({
    title: z
      .string()
      .min(2, "El titulo debe tener al menos 2 caracteres.")
      .max(120, "El titulo no puede tener mas de 120 caracteres."),
    description: z
      .string()
      .max(500, "La descripcion no puede tener mas de 500 caracteres.")
      .optional()
      .or(z.literal("")),
    kind: contentKindSchema,
    course_subject_id: z.string().uuid("Selecciona un curso-materia valido."),
    external_url: z
      .string()
      .url("La URL externa no es valida.")
      .max(2048)
      .optional()
      .or(z.literal("")),
    body: z
      .string()
      .max(20000, "El contenido no puede tener mas de 20000 caracteres.")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) =>
      (data.kind === "document" && data.external_url === "") /* file in storage */ ||
      (data.kind === "video" && data.external_url !== "") ||
      (data.kind === "link" && data.external_url !== "") ||
      (data.kind === "text" && data.body !== ""),
    {
      message:
        "El formulario esta incompleto: link / video requieren URL externa; text requiere cuerpo.",
      path: ["kind"],
    },
  );

export type ContentItemFormValues = z.infer<typeof contentItemFormSchema>;
