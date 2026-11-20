import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Plus } from "lucide-react";
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
import { EnableMaterials } from "@/features/platform/enable-materials";
import { RegisterSchool } from "@/features/platform/register-school";
import { SchoolPanel } from "@/features/platform/school-panel";
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
  const [selected, setSelected] = useState<string[]>([]);
  const [sheetOf, setSheetOf] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [enableOpen, setEnableOpen] = useState(false);

  const options = useCatalogOptions();
  const schools = usePlatformSchools({ q, plan, status, page, per_page: PER_PAGE });

  const total = schools.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const items = schools.data?.items ?? [];

  const selectedSchools = items.filter((school) => selected.includes(school.id));

  function toggleSchool(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <>
      <PageHeader
        title="Colegios"
        subtitle="Instituciones registradas en la plataforma y cobertura del catálogo."
        actions={
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" strokeWidth={1.9} aria-hidden />
            Registrar colegio
          </button>
        }
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

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary-soft px-5 py-2.5">
            <span className="text-xs font-semibold text-primary">
              {selected.length} seleccionado(s)
            </span>
            <button
              type="button"
              onClick={() => setEnableOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
            >
              <BookOpen className="size-3.5" strokeWidth={1.9} aria-hidden />
              Habilitar material
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="ml-auto text-xs font-semibold text-primary hover:underline"
            >
              Quitar la selección
            </button>
          </div>
        )}

        {schools.isLoading ? (
          <SkeletonRows rows={6} columns={6} />
        ) : items.length === 0 ? (
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
                    <th scope="col" className="w-10 px-5 py-3">
                      <span className="sr-only">Seleccionar</span>
                    </th>
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
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((school) => (
                    <tr key={school.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-primary"
                          checked={selected.includes(school.id)}
                          onChange={() => toggleSchool(school.id)}
                          aria-label={`Seleccionar ${school.name}`}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <span className="block font-medium">{school.name}</span>
                        <span className="code-cell mt-0.5 block text-ink-3">
                          {[school.short_code, school.city].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {school.plan ? (
                          <Tag>{school.plan}</Tag>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {school.students > 0 ? (
                          school.students.toLocaleString("es-CO")
                        ) : (
                          <span className="text-muted-foreground">Sin reportar</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {school.teachers > 0 ? (
                          school.teachers.toLocaleString("es-CO")
                        ) : (
                          <span className="text-muted-foreground">Sin reportar</span>
                        )}
                      </td>
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
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSheetOf(school.id)}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Gestionar
                        </button>
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

      <SchoolPanel key={sheetOf ?? "none"} schoolId={sheetOf} onClose={() => setSheetOf(null)} />

      <EnableMaterials
        open={enableOpen}
        schoolIds={selectedSchools.map((school) => school.id)}
        schoolNames={selectedSchools.map((school) => school.name)}
        onClose={() => setEnableOpen(false)}
      />

      <RegisterSchool open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </>
  );
}
