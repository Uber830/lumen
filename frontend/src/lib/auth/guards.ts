import { redirect } from "@tanstack/react-router";

import { getCurrentSession, type SessionContext } from "@/lib/auth/functions";

/**
 * The signed-in state, or a redirect to the login.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await getCurrentSession();
  if (!session) {
    throw redirect({ to: "/login" });
  }
  return session;
}

/**
 * Where the signed-in user belongs, by role.
 *
 * A user who lands on a route of another role is sent to their own
 * home instead of being shown an error page: the route is not for
 * them, it is not an error on their side.
 */
export function homeFor(
  session: SessionContext,
): "/" | "/super" | "/admin" | "/docente" | "/estudiante" {
  if (session.platformRole === "platform_admin") return "/super";

  const primary = session.memberships.find((m) => m.is_primary) ?? session.memberships[0];
  switch (primary?.role) {
    case "school_admin":
      return "/admin";
    case "teacher":
      return "/docente";
    case "student":
      return "/estudiante";
    default:
      return "/";
  }
}
