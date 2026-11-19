// =============================================================================
// The signup flow, in the browser.
// -----------------------------------------------------------------------------
// The page used to call a server function that did everything:
// create the auth user, insert the profile, call the `bootstrap_school`
// RPC and sign in.
//
// Now the account and the school are two API calls, and the API sets
// the session cookies.
// =============================================================================

import { api, ApiError } from "@/lib/api/client";
import type { SessionInfo } from "@/lib/api/types";
import type { SignupFormValues } from "@/lib/schemas/signup";

export type BootstrapSchoolResult = {
  schoolId: string;
  membershipId: string | null;
  subscriptionId: string | null;
  entitlementId: string | null;
  alreadyExisted: boolean;
};

/**
 * Register a school.
 *
 * The account is created first, so the caller is signed in; then the
 * school is bootstrapped for them.
 */
export async function signUpSchool(payload: SignupFormValues): Promise<BootstrapSchoolResult> {
  let session: SessionInfo;
  try {
    const auth = await api.post<{ session: SessionInfo }>("/v1/auth/register", {
      email: payload.email,
      password: payload.password,
      full_name: payload.adminFullName,
    });
    session = auth.session;
  } catch (error) {
    throw new Error(translateAuthError(error), { cause: error });
  }
  void session;

  try {
    const school = await api.post<{
      school_id: string;
      membership_id: string | null;
      subscription_id: string | null;
      entitlement_id: string | null;
      already_existed: boolean;
    }>("/v1/schools/bootstrap", {
      school_name: payload.schoolName,
      short_code: payload.shortCode,
      plan_code: payload.planCode,
    });

    return {
      schoolId: school.school_id,
      membershipId: school.membership_id,
      subscriptionId: school.subscription_id,
      entitlementId: school.entitlement_id,
      alreadyExisted: school.already_existed,
    };
  } catch (error) {
    // The account exists but the school could not be created. The
    // caller can retry the bootstrap from the admin panel.
    console.error("[signUpSchool] bootstrap failed:", error);
    throw new Error(translateBootstrapError(error), { cause: error });
  }
}

/** Turn an API error into a message the user can act on. */
function translateAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "Ya existe una cuenta registrada con ese correo.";
    if (error.status === 422) return error.message;
    return error.message || "No se pudo crear la cuenta. Intentalo de nuevo.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "No se pudo crear la cuenta. Intentalo de nuevo.";
}

function translateBootstrapError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return "Ese colegio ya existe con ese nombre o codigo corto.";
    }
    if (error.status === 404) {
      return "El plan seleccionado no esta disponible.";
    }
    return error.message || "No se pudo crear el colegio. Intentalo de nuevo.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "No se pudo crear el colegio. Intentalo de nuevo.";
}
