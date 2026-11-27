import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/features/site/components/landing-page";

// The typeface of the title, preloaded: it is the first thing the
// reader waits for.
import spaceGroteskWoff2 from "@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url";

const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "https://lumen.co").replace(/\/$/, "");

const TITLE = "Lumen — El material de su colegio, ordenado y listo para usar";
const DESCRIPTION =
  "Lumen resuelve la gestión del material académico en los colegios: el colegio entrega lo que ya tiene y Lumen lo deja disponible para el docente y para el estudiante.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      {
        name: "description",
        content: DESCRIPTION,
      },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Lumen" },
      {
        property: "og:title",
        content: TITLE,
      },
      {
        property: "og:description",
        content: DESCRIPTION,
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/og-lumen.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: TITLE,
      },
      {
        name: "twitter:description",
        content: DESCRIPTION,
      },
      { name: "twitter:image", content: `${SITE_URL}/og-lumen.png` },
    ],
    links: [
      { rel: "canonical", href: SITE_URL },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
        href: spaceGroteskWoff2,
      },
      // The site has its own mark: the sun of El Índice.
      { rel: "icon", href: "/favicon-lumen.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-lumen-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/favicon-lumen-180.png" },
    ],
  }),
  component: LandingPage,
});
