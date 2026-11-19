import { createFileRoute, redirect } from "@tanstack/react-router";

import { homeFor, requireSession } from "@/lib/auth/guards";
import { AppShell, deriveRole } from "@/components/app-shell";

export const Route = createFileRoute("/docente")({
  beforeLoad: async () => {
    const session = await requireSession();
    const isTeacher = session.memberships.some((m) => m.role === "teacher");
    if (!isTeacher) {
      // The route is not for this user: they go to their own home.
      throw redirect({ to: homeFor(session) });
    }
    return { session };
  },
  component: DocenteLayout,
});

function DocenteLayout() {
  const { session } = Route.useRouteContext();
  const role = deriveRole(session);
  if (!role) return null;
  return <AppShell session={session} role={role} schoolName={null} />;
}
