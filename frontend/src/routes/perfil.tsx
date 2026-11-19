import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "@/lib/auth/guards";
import { AppShell, deriveRole } from "@/components/app-shell";
import type { SessionContext } from "@/lib/auth/functions";

export const Route = createFileRoute("/perfil")({
  beforeLoad: async () => {
    // requireSession redirects to /login if the caller is not
    // authenticated, so the session is guaranteed to be non-null.
    const session = (await requireSession()) as SessionContext;
    return { session };
  },
  component: PerfilLayout,
});

function PerfilLayout() {
  const { session } = Route.useRouteContext();
  const role = deriveRole(session);
  return <AppShell session={session} role={role ?? "admin"} schoolName={null} />;
}
