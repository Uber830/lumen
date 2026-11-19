import { useRouteContext, createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { usePlansWithCounts } from "@/lib/billing/plans";

export const Route = createFileRoute("/super/planes")({
  head: () => ({
    meta: [
      { title: "Planes de suscripción — Lumen Platform" },
      {
        name: "description",
        content: "Creá y editá planes de suscripción, precios y límites por institución.",
      },
      { property: "og:title", content: "Planes de suscripción — Lumen Platform" },
      { property: "og:description", content: "Configuración comercial de la plataforma." },
    ],
  }),
  component: Planes,
});

function formatCop(priceCents: number, currency: string): string {
  const formatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  return formatter.format(priceCents);
}

function formatLimit(value: number | null, suffix: string): string {
  if (value === null) return `Ilimitado ${suffix}`.trim();
  return `${value.toLocaleString("es-CO")} ${suffix}`.trim();
}

function Planes() {
  const { session } = useRouteContext({ from: "/super/planes" });
  void session; // session is not used here but proves the guard runs
  const plans = usePlansWithCounts();

  return (
    <>
      <PageHeader
        title="Planes de suscripción"
        subtitle="Precios y límites aplicados a cada institución"
        actions={
          <button
            type="button"
            disabled
            title="La creación de planes desde el frontend llega en una iteración posterior; por ahora se gestionan en la DB."
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="size-4" /> Nuevo plan
          </button>
        }
      />

      {plans.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando planes...</p>
      ) : plans.error ? (
        <p role="alert" className="text-sm text-destructive">
          {plans.error.message}
        </p>
      ) : !plans.data || plans.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay planes activos configurados.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.data.map((p) => (
            <SectionCard
              key={p.id}
              title={p.name}
              description={p.description ?? undefined}
              actions={
                <button
                  type="button"
                  disabled
                  title="Edición de planes desde el frontend llega en una iteración posterior."
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Editar
                </button>
              }
            >
              <p className="text-3xl font-extrabold tracking-tight">
                {formatCop(p.price_cents, p.currency)}
                <span className="text-sm font-medium text-muted-foreground">
                  /{p.interval === "annual" ? "año" : "mes"}
                </span>
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                <li>· Estudiantes: {formatLimit(p.max_students, "")}</li>
                <li>· Docentes: {formatLimit(p.max_teachers, "")}</li>
                <li>· Almacenamiento: {formatLimit(p.max_storage_gb, "GB")}</li>
                <li>
                  · Simulacros ICFES:{" "}
                  <span
                    className={
                      p.includes_icfes ? "font-semibold text-success" : "text-muted-foreground"
                    }
                  >
                    {p.includes_icfes ? "Incluido" : "No incluido"}
                  </span>
                </li>
                <li>· Colegios activos: {p.schools_count}</li>
              </ul>
            </SectionCard>
          ))}
        </div>
      )}
    </>
  );
}
