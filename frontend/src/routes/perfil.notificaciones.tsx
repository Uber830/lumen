import { createFileRoute, useRouteContext } from "@tanstack/react-router";

import { PageHeader, SectionCard } from "@/components/ui-kit";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";
import { notificationRoleFor } from "@/features/notifications/format";
import { ProfileNav } from "@/features/profile/profile-nav";

export const Route = createFileRoute("/perfil/notificaciones")({
  head: () => ({
    meta: [
      { title: "Notificaciones — Lumen" },
      {
        name: "description",
        content: "Elegí qué avisos querés recibir y por dónde te los avisamos.",
      },
      { property: "og:title", content: "Notificaciones — Lumen" },
      {
        property: "og:description",
        content: "Preferencias de notificación de tu cuenta en Lumen.",
      },
    ],
  }),
  component: PerfilNotificaciones,
});

/**
 * The notifications of the account, on their own screen.
 *
 * They live apart from the profile data on purpose: the menu of the
 * user has one entry for each of them, and each entry opens what it
 * says.
 */
function PerfilNotificaciones() {
  // The session comes from the parent /perfil route, which already
  // loaded it: the view does not pay for a second round-trip.
  const { session } = useRouteContext({ from: "/perfil" });

  return (
    <>
      <PageHeader
        title="Notificaciones"
        subtitle="Elegí qué querés que te avisen y por dónde te lo avisos."
      />
      <ProfileNav active="notificaciones" />

      <div className="space-y-4">
        <SectionCard
          title="Qué te avisamos"
          description="Cada aviso se guarda en cuanto lo cambiás."
        >
          {session?.user.id ? (
            <NotificationPreferences
              userId={session.user.id}
              role={notificationRoleFor({
                platformRole: session.platformRole,
                memberships: session.memberships,
              })}
            />
          ) : null}
        </SectionCard>
      </div>
    </>
  );
}
