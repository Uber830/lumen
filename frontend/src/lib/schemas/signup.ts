import { z } from "zod";

export const planCodeSchema = z.enum(["basico", "estandar", "premium"], {
  message: "Selecciona un plan valido.",
});

export const signupFormSchema = z.object({
  schoolName: z
    .string()
    .min(2, "El nombre del colegio debe tener al menos 2 caracteres.")
    .max(120, "El nombre del colegio no puede superar los 120 caracteres."),
  shortCode: z
    .string()
    .min(2, "El codigo corto debe tener al menos 2 caracteres.")
    .max(16, "El codigo corto no puede superar los 16 caracteres.")
    .regex(/^[A-Za-z0-9-]+$/, "Solo letras, numeros y guiones."),
  adminFullName: z
    .string()
    .min(2, "Tu nombre debe tener al menos 2 caracteres.")
    .max(120, "Tu nombre no puede superar los 120 caracteres."),
  email: z
    .string()
    .min(1, "El correo institucional es obligatorio.")
    .email("Ingresa un correo electronico valido.")
    .max(254, "El correo no puede superar los 254 caracteres."),
  password: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres.")
    .max(128, "La contrasena no puede superar los 128 caracteres."),
  planCode: planCodeSchema,
  acceptTerms: z
    .boolean()
    .refine((v) => v === true, { message: "Debes aceptar los terminos para continuar." }),
});

export type SignupFormValues = z.infer<typeof signupFormSchema>;

export const PLAN_CODE_TO_DISPLAY: Record<SignupFormValues["planCode"], string> = {
  basico: "Basico",
  estandar: "Estandar",
  premium: "Premium",
};

export const TRIAL_DAYS = 30;
