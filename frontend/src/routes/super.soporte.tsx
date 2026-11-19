import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  EmptyHint,
  PageHeader,
  Pagination,
  SkeletonRows,
  StatusPill,
  Toolbar,
} from "@/components/ui-kit";
import { useAudit, usePlatformSchools } from "@/lib/platform/hooks";

export const Route = createFileRoute("/super/soporte")({
  head: () => ({
    meta: [
      { title: "Soporte y auditoría — Lumen Platform" },
      {
        name: "description",
        content: "Trazabilidad de los cambios del catálogo y de los avisos de la red.",
      },
      { property: "og:title", content: "Soporte y auditoría — Lumen Platform" },
      {
        property: "og:description",
        content: "Auditoría de la operación del catálogo editorial.",
      },
    ],
  }),
  component: Soporte,
});

const PER_PAGE = 8;

const LEVEL_TONE = {
  info: "info",
  warning: "warning",
  error: "danger",
} as const;

const LEVEL_LABEL = {
  info: "Info",
  warning: "Aviso",
  error: "Error",
} as const;

function Soporte() {
  const [level, setLevel] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [page, setPage] = useState(1);

  const schools = usePlatformSchools({ per_page: 50 });
  const audit = useAudit({ level, school_id: schoolId, page, per_page: PER_PAGE });

  const total = audit.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <PageHeader
        title="Soporte y auditoría"
        subtitle="Trazabilidad de los cambios del catálogo y de los avisos de la red."
      />

      <section className="surface-card overflow-hidden">
        <Toolbar>
          <select
            value={schoolId}
            onChange={(event) => {
              setSchoolId(event.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por colegio"
            className="h-9 max-w-64 rounded-lg border border-input bg-card px-2.5 text-sm"
          >
            <option value="">Todos los colegios</option>
            {(schools.data?.items ?? []).map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>

          <select
            value={level}
            onChange={(event) => {
              setLevel(event.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por nivel"
            className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm"
          >
            <option value="">Todos los niveles</option>
            <option value="info">Info</option>
            <option value="warning">Aviso</option>
            <option value="error">Error</option>
          </select>

          <p className="ml-auto text-xs text-muted-foreground">
            {audit.isLoading ? "Cargando…" : `${total} evento(s)`}
          </p>
        </Toolbar>

        {audit.isLoading ? (
          <SkeletonRows rows={6} columns={4} />
        ) : (audit.data?.items.length ?? 0) === 0 ? (
          <EmptyHint
            title="Sin eventos"
            description="No hay movimientos de la red que coincidan con el filtro."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Eventos de la auditoría de la plataforma.</caption>
                <thead className="table-head-band">
                  <tr className="text-left text-[11px] uppercase tracking-[0.09em]">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Evento
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Colegio
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Actor
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Nivel
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data?.items.map((entry) => (
                    <tr key={entry.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <span className="block font-medium">{entry.event_type}</span>
                        <span className="code-cell mt-0.5 block text-ink-3">
                          {Object.entries(entry.detail)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(" · ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{entry.school_id ?? "—"}</td>
                      <td className="px-5 py-3">{entry.actor_name ?? "Sistema"}</td>
                      <td className="px-5 py-3">
                        <StatusPill
                          label={LEVEL_LABEL[entry.level] ?? entry.level}
                          tone={LEVEL_TONE[entry.level] ?? "muted"}
                        />
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={audit.data?.page ?? 1}
              pageCount={pageCount}
              total={total}
              pageSize={PER_PAGE}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </>
  );
}
