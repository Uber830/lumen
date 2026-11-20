import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, CreditCard, Sparkles } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { usePlans } from "@/lib/billing/plans";
import { useStartCheckout } from "@/lib/billing/hooks";
import { useSubscription, useEntitlement } from "@/lib/billing/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/planes")({
  head: () => ({
    meta: [
      { title: "Plan del colegio — Lumen" },
      {
        name: "description",
        content: "Gestioná el plan de suscripción del colegio y la facturación.",
      },
      { property: "og:title", content: "Plan del colegio — Lumen" },
      {
        property: "og:description",
        content: "Cambiá de plan, actualizá tu método de pago o cancelá.",
      },
    ],
  }),
  component: PlanesPage,
});

function formatCop(priceCents: number, currency: string): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(priceCents);
}

function PlanesPage() {
  const { session } = useRouteContext({ from: "/admin/planes" });
  const schoolId = session.primarySchoolId;
  const plans = usePlans();
  const entitlement = useEntitlement(schoolId);
  const subscription = useSubscription(schoolId);
  const startCheckout = useStartCheckout(schoolId ?? "");

  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  if (!schoolId) {
    return (
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">No hay colegio activo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no está asociada a un colegio.
        </p>
      </div>
    );
  }

  async function onSubscribe(planId: string) {
    setPendingPlanId(planId);
    try {
      const result = await startCheckout.mutateAsync({ plan_id: planId });
      if (result.checkout_url) {
        window.location.assign(result.checkout_url);
      }
    } finally {
      setPendingPlanId(null);
    }
  }

  const currentPlanCode = entitlement.data?.plan_code;
  const isSubscribed = Boolean(
    entitlement.data &&
    (entitlement.data.status === "active" || entitlement.data.status === "trial"),
  );

  return (
    <>
      <PageHeader
        title="Plan del colegio"
        subtitle="Gestioná el plan de suscripción del colegio."
        actions={<CreditCard className="size-5 text-muted-foreground" aria-hidden />}
      />

      {isSubscribed && entitlement.data && (
        <SectionCard title="Plan actual">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Plan vigente
              </p>
              <p className="text-2xl font-bold tracking-tight">{entitlement.data.plan_name}</p>
              <p className="text-xs text-muted-foreground">
                Codigo: {entitlement.data.plan_code} · Estado: {entitlement.data.status}
              </p>
            </div>
            <div className="ml-auto text-right">
              <StatusBadge tone="success">Activo</StatusBadge>
              {subscription.data?.current_period_end && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Proximo cobro:{" "}
                  {new Date(subscription.data.current_period_end).toLocaleDateString("es-CO")}
                </p>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {!isSubscribed && (
        <SectionCard title="Todavia no hay suscripcion activa">
          <p className="text-sm text-muted-foreground">
            Elegi uno de los planes de abajo para empezar. El checkout se completa en Wompi y la
            suscripcion queda activa inmediatamente despues del webhook.
          </p>
        </SectionCard>
      )}

      <SectionCard title="Planes disponibles" bodyClassName="p-0">
        {plans.isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Cargando planes...</p>
        ) : plans.error ? (
          <p role="alert" className="px-5 py-6 text-sm text-destructive">
            {plans.error.message}
          </p>
        ) : !plans.data || plans.data.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No hay planes configurados.</p>
        ) : (
          <ul className="grid gap-5 p-5 md:grid-cols-3">
            {plans.data.map((p) => {
              const isCurrent = currentPlanCode === p.code;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "rounded-lg border p-5",
                    isCurrent ? "border-primary bg-primary-soft" : "border-border bg-card",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-bold tracking-tight">{p.name}</h3>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                        <CheckCircle2 className="size-3" /> Actual
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight">
                    {formatCop(p.price_cents, p.currency)}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">
                      /{p.interval === "annual" ? "año" : "mes"}
                    </span>
                  </p>
                  {p.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                  )}
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <li>· Estudiantes: {p.max_students ?? "Ilimitado"}</li>
                    <li>· Docentes: {p.max_teachers ?? "Ilimitado"}</li>
                    <li>· Almacenamiento: {p.max_storage_gb ?? "—"} GB</li>
                    <li>· Simulacros ICFES: {p.includes_icfes ? "Incluido" : "No incluido"}</li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => onSubscribe(p.id)}
                    disabled={
                      startCheckout.isPending ||
                      isCurrent ||
                      ((isSubscribed && p.code !== currentPlanCode) === false && isSubscribed)
                    }
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className="size-4" />
                    {pendingPlanId === p.id
                      ? "Abriendo checkout..."
                      : isCurrent
                        ? "Tu plan actual"
                        : isSubscribed
                          ? "Cambiar a este plan"
                          : "Suscribirme"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {startCheckout.error && (
        <p role="alert" className="text-sm text-destructive">
          {startCheckout.error.message}
        </p>
      )}
    </>
  );
}
