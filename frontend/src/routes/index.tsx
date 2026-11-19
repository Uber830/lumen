import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/features/site/components/landing-page";

const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "https://lumen.co").replace(/\/$/, "");

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen — El material de la editorial, indexado por colegio" },
      {
        name: "description",
        content:
          "Lumen mantiene un solo catálogo de material y le asigna a cada colegio las piezas que le corresponden.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Lumen" },
      {
        property: "og:title",
        content: "Lumen — El material de la editorial, indexado por colegio",
      },
      {
        property: "og:description",
        content:
          "Lumen mantiene un solo catálogo de material y le asigna a cada colegio las piezas que le corresponden.",
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/og-lumen.svg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Lumen — El material de la editorial, indexado por colegio",
      },
      {
        name: "twitter:description",
        content:
          "Lumen mantiene un solo catálogo de material y le asigna a cada colegio las piezas que le corresponden.",
      },
      { name: "twitter:image", content: `${SITE_URL}/og-lumen.svg` },
    ],
    links: [
      { rel: "canonical", href: SITE_URL },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // The site has its own mark: the sun of El Índice.
      { rel: "icon", href: "/favicon-lumen.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-lumen-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/favicon-lumen-180.png" },
    ],
  }),
  component: LandingPage,
});
