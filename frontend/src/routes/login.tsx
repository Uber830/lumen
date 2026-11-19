import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { LoginPage } from "@/features/site/components/login-page";
import { destinationForSession, safeNext } from "@/features/site/destination";
import { useSiteContent } from "@/features/site/use-site-content";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Lumen" },
      {
        name: "description",
        content: "Accede a tu colegio en Lumen como admin, docente o estudiante.",
      },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Iniciar sesión — Lumen" },
      {
        property: "og:description",
        content: "Acceso unificado para administradores, docentes y estudiantes.",
      },
    ],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  /*
   * The `next` parameter is read from the URL instead of being
   * declared in `validateSearch`: declaring it would make the search
   * parameters of this route required, and every link to the login in
   * the application would have to carry them.
   */
  const [next] = useState<string | undefined>(() =>
    typeof window === "undefined"
      ? undefined
      : (new URLSearchParams(window.location.search).get("next") ?? undefined),
  );
  const site = useSiteContent();
  const contactEmail = site.data?.contact_email ?? "";

  /**
   * Where the user lands after signing in.
   *
   * The `next` parameter wins when it is a route of this site; an
   * absolute URL is ignored, because a login that forwards to another
   * domain is an open redirect.
   */
  function onSignedIn(session: Parameters<typeof destinationForSession>[0]) {
    const target = safeNext(next) ?? destinationForSession(session);
    // A full load, so the panel starts with the session it needs.
    window.location.assign(target);
  }

  return <LoginPage onSignedIn={onSignedIn} contactEmail={contactEmail} />;
}
