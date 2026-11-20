import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  EmptyHint,
  PageHeader,
  Pagination,
  SearchField,
  SkeletonRows,
  StatusPill,
  Tag,
  Toolbar,
} from "@/components/ui-kit";
import { useCatalogOptions, usePlatformSchools } from "@/lib/platform/hooks";

export const Route = createFileRoute("/super/colegios")({
  head: () => ({
    meta: [
      { title: "Colegios — Lumen Platform" },
      {
        name: "description",
        content: "Instituciones de la red y su cobertura del catálogo editorial.",
      },
      { property: "og:title", content: "Colegios — Lumen Platform" },
      {
        property: "og:description",
        content: "Administración de las instituciones de la plataforma.",
      },
    ],
  }),
  component: Colegios,
});

const PER_PAGE = 8;

function Colegios() {
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const options = useCatalogOptions();
  const schools = usePlatformSchools({ q, plan, status, page, per_page: PER_PAGE });

  const total = schools.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <PageHeader
        title="Colegios"
        subtitle="Instituciones registradas en la plataforma y cobertura del catálogo."
      />

      <section className="surface-card overflow-hidden">
        <Toolbar>
          <SearchField
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Buscar colegio"
            className="h-9 w-full border border-input sm:w-72"
          />

          <select
            value={plan}
            onChange={(event) => {
              setPlan(event.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por plan"
            className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm"
          >
            <option value="">Todos los planes</option>
            {(options.data?.plans ?? []).map((value) => (
              <option key={value.code} value={value.code}>
                {value.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por estado"
            className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
            <option value="inactive">Inactivo</option>
          </select>

          <p className="ml-auto text-xs text-muted-foreground">
            {schools.isLoading ? "Cargando…" : `${total} colegio(s)`}
          </p>
        </Toolbar>

        {schools.isLoading ? (
          <SkeletonRows rows={6} columns={6} />
        ) : (schools.data?.items.length ?? 0) === 0 ? (
          <EmptyHint
            title="Sin colegios"
            description="Los filtros no encontraron ninguna institución en la red."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Colegios de la red y su cobertura del catálogo.
                </caption>
                <thead className="table-head-band">
                  <tr className="text-left text-[11px] uppercase tracking-[0.09em]">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Colegio
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Plan
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Estudiantes
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Docentes
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Cobertura
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schools.data?.items.map((school) => (
                    <tr key={school.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <span className="block font-medium">{school.name}</span>
                        <span className="code-cell mt-0.5 block text-ink-3">
                          {school.short_code}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {school.plan ? (
                          <Tag>{school.plan}</Tag>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">{school.students.toLocaleString("es-CO")}</td>
                      <td className="px-5 py-3">{school.teachers.toLocaleString("es-CO")}</td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{
                                width: `${
                                  school.total > 0
                                    ? Math.round((school.covered / school.total) * 100)
                                    : 0
                                }%`,
                              }}
                              aria-hidden
                            />
                          </span>
                          <span className="code-cell text-xs text-muted-foreground">
                            {school.covered} de {school.total}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill
                          label={school.status === "active" ? "Activo" : school.status}
                          tone={school.status === "active" ? "success" : "muted"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={schools.data?.page ?? 1}
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
