import { Link, createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { getIcfesAccess } from "@/lib/icfes.functions";

export const Route = createFileRoute("/icfes-bloqueado")({
  head: () => ({
    meta: [
      { title: "Módulo no disponible — Lumen" },
      {
        name: "description",
        content:
          "Simulacros ICFES todavía no está habilitado para tu colegio. Tus datos se conservan intactos.",
      },
      { property: "og:title", content: "Módulo no disponible — Lumen" },
      {
        property: "og:description",
        content: "El equipo de plataforma habilita el módulo para tu colegio.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: () => getIcfesAccess(),
  component: Bloqueado,
});

function Bloqueado() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-16">
      <div className="surface-card w-full max-w-lg p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-lg bg-warning-soft text-warning-foreground">
          <Lock className="size-6" strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          Simulacros ICFES no está disponible
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          El módulo de Simulacros ICFES todavía no está habilitado para tu colegio. Es el equipo de
          plataforma quien lo habilita.
        </p>
        <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
          Tus simulacros, preguntas y resultados anteriores <strong>se conservan intactos</strong>.
          Cuando el módulo se habilite, todo estará disponible tal como lo dejaste.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/admin"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
