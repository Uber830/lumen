import { z } from "zod";

export const chatConversationKindSchema = z.enum(["direct", "group"]);

export const chatMessageFormSchema = z.object({
  body: z
    .string()
    .min(1, "El mensaje no puede estar vacio.")
    .max(4000, "El mensaje no puede tener mas de 4000 caracteres."),
});

export type ChatMessageFormValues = z.infer<typeof chatMessageFormSchema>;

export const chatConversationFormSchema = z.object({
  title: z
    .string()
    .min(2, "El titulo debe tener al menos 2 caracteres.")
    .max(80, "El titulo no puede tener mas de 80 caracteres.")
    .optional()
    .or(z.literal("")),
  kind: chatConversationKindSchema.default("group"),
  member_ids: z.array(z.string().uuid()).min(1, "Agrega al menos un participante."),
});

export type ChatConversationFormValues = z.infer<typeof chatConversationFormSchema>;
