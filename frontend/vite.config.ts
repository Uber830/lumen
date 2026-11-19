import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { devtools } from "@tanstack/devtools-vite";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";

// Load every variable from .env into process.env at config-evaluation
// time so both the build-time define below and the runtime
// `process.env.SUPABASE_SECRET_KEY` reads in the server functions see
// the same value. loadEnv only runs in dev/test; production reads
// from the Cloudflare secret binding. The envDir is "." because Vite
// already pins the config dir; resolving it via import.meta.url
// crashes Vite's HMR re-evaluator when it re-loads the config
// in a context where import.meta is not populated.
loadEnv("development", ".", "VITE_");
loadEnv("development", ".", "");

export default defineConfig(({ command }) => ({
  resolve: {
    // `@/*` alias is picked up from tsconfig.json's `paths` field.
    tsconfigPaths: true,
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: {
    host: "::",
    // Port 5174, not the usual 8080: the EduSuite stack keeps 8080 on
    // this machine and both projects can run at the same time.
    port: 5174,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    ...(command === "serve"
      ? [
          devtools({
            logging: false,
            eventBusConfig: { enabled: false },
            enhancedLogs: { enabled: false },
            consolePiping: { enabled: false },
            removeDevtoolsOnBuild: false,
            // `data-tsd-source` is a dev-only AST transform that adds
            // the source position to every JSX element. It broke
            // hydration because the SSR pass and the CSR pass computed
            // different column positions for the same line; the
            // resulting attribute mismatch prevents React from
            // reusing the server-rendered DOM. Disabling it here
            // matches the upstream default and clears the warning.
            injectSource: { enabled: false },
          }),
        ]
      : []),
    viteReact(),
    ...(command === "build"
      ? [
          // Cloudflare Workers / Pages deployment target.
          nitro({ preset: "cloudflare-module" }),
        ]
      : []),
  ],
}));
