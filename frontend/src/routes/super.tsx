import { createFileRoute, redirect } from "@tanstack/react-router";

import { homeFor, requireSession } from "@/lib/auth/guards";
import { AppShell, deriveRole } from "@/components/app-shell";

export const Route = createFileRoute("/super")({
  beforeLoad: async () => {
    const session = await requireSession();
    if (session.platformRole !== "platform_admin") {
      // The route is not for this user: they go to their own home.
      throw redirect({ to: homeFor(session) });
    }
    return { session };
  },
  component: SuperLayout,
});

function SuperLayout() {
  const { session } = Route.useRouteContext();
  const role = deriveRole(session);
  if (!role) return null;
  return <AppShell session={session} role={role} schoolName={null} />;
}
