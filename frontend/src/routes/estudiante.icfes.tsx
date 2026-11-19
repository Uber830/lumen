import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { Calendar, Clock, Loader2, Sparkles } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { IcfesRunner } from "@/features/student/icfes-runner";
import { useIcfesSimulations } from "@/features/student/use-icfes";
import type { IcfesSimulation } from "@/lib/api/types";

export const Route = createFileRoute("/estudiante/icfes")({
  head: () => ({
    meta: [
      { title: "Simulacros ICFES — Lumen" },
      {
        name: "description",
        content: "Entrena con simulacros tipo Saber 11. Banco de preguntas por area.",
      },
      { property: "og:title", content: "Simulacros ICFES — Lumen" },
      {
        property: "og:description",
        content: "Simulacros cronometrados con puntaje por area y global.",
      },
    ],
  }),
  component: ICFES,
});

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("es-CO");
}

function ICFES() {
  const { session } = useRouteContext({ from: "/estudiante/icfes" });
  const schoolId = session.primarySchoolId;
  const simulations = useIcfesSimulations(schoolId);
  const [runningId, setRunningId] = useState<string | null>(null);

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

  const running = simulations.data?.find((simulation) => simulation.id === runningId) ?? null;
  if (running) {
    return <IcfesRunner simulation={running} onExit={() => setRunningId(null)} />;
  }

  return (
    <>
      <PageHeader title="Simulacros ICFES" subtitle="Entrena con simulacros tipo Saber 11" />

      {simulations.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando simulacros...</p>
      ) : simulations.error ? (
        <p role="alert" className="text-sm text-destructive">
          {simulations.error.message}
        </p>
      ) : !simulations.data || simulations.data.length === 0 ? (
        <SectionCard title="Sin simulacros disponibles">
          <p className="text-sm text-muted-foreground">
            Tu colegio todavia no ha publicado simulacros. Pide al docente o al administrador que
            cree uno.
          </p>
        </SectionCard>
      ) : (
        <SectionCard title="Simulacros disponibles" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {simulations.data.map((simulation) => (
              <SimulationRow
                key={simulation.id}
                simulation={simulation}
                onStart={() => setRunningId(simulation.id)}
              />
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}

function SimulationRow({
  simulation,
  onStart,
}: {
  simulation: IcfesSimulation;
  onStart: () => void;
}) {
  const [starting, setStarting] = useState(false);

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 hover:bg-muted/40">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{simulation.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          <Calendar className="mr-1 inline size-3" />
          {formatDate(simulation.available_from)} → {formatDate(simulation.available_until)}
        </p>
        {simulation.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {simulation.description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge tone="info">
          <Clock className="mr-1 inline size-3" />
          {simulation.duration_minutes ?? 60} min
        </StatusBadge>
        <button
          type="button"
          onClick={() => {
            setStarting(true);
            onStart();
          }}
          disabled={starting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Iniciar
        </button>
      </div>
    </li>
  );
}
