import { redirect } from "@tanstack/react-router";
import { getIcfesAccess } from "@/lib/icfes.functions";

/**
 * Guard reutilizable: consulta el plan en el servidor y bloquea el acceso
 * completo al módulo si el colegio no está en Estándar o Premium.
 */
export async function requireIcfesAccess() {
  const access = await getIcfesAccess();
  if (!access.allowed) {
    throw redirect({ to: "/icfes-bloqueado" });
  }
  return access;
}
