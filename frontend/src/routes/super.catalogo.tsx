import { createFileRoute } from "@tanstack/react-router";
import { Search, Upload } from "lucide-react";
import { useMemo, useState } from "react";

import {
  EmptyState,
  ExtraCount,
  PageHeader,
  Pagination,
  SearchField,
  SkeletonRows,
  StatusPill,
  Tag,
  Toolbar,
} from "@/components/ui-kit";
import { MaterialPanel } from "@/features/platform/material-panel";
import { SchoolsOfMaterial } from "@/features/platform/schools-of-material";
import { UploadWizard } from "@/features/platform/upload-wizard";
import { useCatalog, useCatalogOptions, usePlatformSchools } from "@/lib/platform/hooks";
import {
  MATERIAL_STATUS_LABEL,
  MATERIAL_STATUS_TONE,
  type MaterialSummary,
} from "@/lib/platform/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo editorial — Lumen Platform" },
      {
        name: "description",
        content: "Material de la editorial: decide qué colegio ve cada pieza y publícala.",
      },
      { property: "og:title", content: "Catálogo editorial — Lumen Platform" },
      {
        property: "og:description",
        content: "Administración del material de la editorial y de su acceso por colegio.",
      },
    ],
  }),
  component: Catalogo,
});

const PER_PAGE = 8;

function Catalogo() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [accessOf, setAccessOf] = useState<MaterialSummary | null>(null);

  const options = useCatalogOptions();
  const schools = usePlatformSchools({ per_page: 50 });
  const catalog = useCatalog({
    q,
    type,
    status,
    school_id: schoolId,
    page,
    per_page: PER_PAGE,
  });

  // Every filter sends the page back to the first one: the result of
  // the previous page does not belong to the new search.
  const filter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const total = catalog.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const items = catalog.data?.items ?? [];

  const schoolNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const school of schools.data?.items ?? []) map.set(school.id, school.name);
    return map;
  }, [schools.data]);

  const filtersActive = Boolean(q || type || status || schoolId);

  return (
    <>
      <PageHeader
        title="Catálogo editorial"
        subtitle="Material de la editorial. Decide qué colegio puede ver cada pieza y publícala."
        actions={
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Upload className="size-4" strokeWidth={1.9} aria-hidden />
            Cargar contenido
          </button>
        }
      />

      <section className="surface-card overflow-hidden">
        <Toolbar>
          <SearchField
            value={q}
            onChange={filter(setQ)}
            placeholder="Buscar en el catálogo"
            className="h-9 w-full border border-input sm:w-72"
          />

          <select
            value={type}
            onChange={(event) => filter(setType)(event.target.value)}
            aria-label="Filtrar por tipo"
            className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm"
          >
            <option value="">Todos los tipos</option>
            {(options.data?.types ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => filter(setStatus)(event.target.value)}
            aria-label="Filtrar por estado"
            className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm"
          >
            <option value="">Todos los estados</option>
            {(options.data?.statuses ?? []).map((value) => (
              <option key={value} value={value}>
                {MATERIAL_STATUS_LABEL[value as keyof typeof MATERIAL_STATUS_LABEL] ?? value}
              </option>
            ))}
          </select>

          <select
            value={schoolId}
            onChange={(event) => filter(setSchoolId)(event.target.value)}
            aria-label="Filtrar por colegio"
            className="h-9 max-w-56 rounded-lg border border-input bg-card px-2.5 text-sm"
          >
            <option value="">Todos los colegios</option>
            {(schools.data?.items ?? []).map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>

          <p className="ml-auto text-xs text-muted-foreground">
            {catalog.isLoading ? "Cargando…" : `${total} material(es)`}
          </p>
        </Toolbar>

        {catalog.isLoading ? (
          <SkeletonRows rows={6} columns={6} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin material en el catálogo"
            description={
              filtersActive
                ? "Los filtros no encontraron nada. Quítalos o carga el primer material de esta colección."
                : "El catálogo editorial está vacío. Carga el primer material de la editorial."
            }
            icon={Search}
            action={
              filtersActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setType("");
                    setStatus("");
                    setSchoolId("");
                    setPage(1);
                  }}
                  className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold hover:bg-muted"
                >
                  Quitar los filtros
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Upload className="size-4" strokeWidth={1.9} aria-hidden />
                  Cargar contenido
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Material del catálogo editorial con los colegios que pueden verlo.
                </caption>
                <thead className="table-head-band">
                  <tr className="text-left text-[11px] uppercase tracking-[0.09em]">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Material
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Tipo
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Área
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Colegios con acceso
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Estado
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Actualizado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setOpenId(item.id)}
                          className="text-left font-medium hover:text-primary"
                        >
                          {item.title}
                        </button>
                        <span className="code-cell mt-0.5 block text-ink-3">
                          {item.code} · {item.size_label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Tag>{item.type}</Tag>
                      </td>
                      <td className="px-5 py-3">{item.area}</td>
                      <td className="px-5 py-3">
                        {item.schools.length === 0 ? (
                          <span className="text-muted-foreground">Ninguno</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.schools.slice(0, 2).map((school) => (
                              <button
                                key={school.id}
                                type="button"
                                onClick={() => setAccessOf(item)}
                                title="Ver todos los colegios con acceso"
                                className="inline-flex items-center whitespace-nowrap rounded-idx bg-muted px-2.5 py-0.5 text-xs font-medium text-ink-2 transition-opacity hover:opacity-80"
                              >
                                {schoolNames.get(school.id) ?? school.name}
                              </button>
                            ))}
                            <ExtraCount
                              count={item.schools_extra}
                              onClick={() => setAccessOf(item)}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill
                          label={MATERIAL_STATUS_LABEL[item.status]}
                          tone={MATERIAL_STATUS_TONE[item.status]}
                        />
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                        {new Date(item.updated_at).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={catalog.data?.page ?? 1}
              pageCount={pageCount}
              total={total}
              pageSize={PER_PAGE}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <SchoolsOfMaterial materialId={accessOf?.id ?? null} onClose={() => setAccessOf(null)} />

      <MaterialPanel
        key={openId ?? "none"}
        materialId={openId}
        onClose={() => setOpenId(null)}
        className={cn("w-full sm:max-w-lg")}
      />

      {/* The assistant is mounted only while it is open, so it always
          starts from a clean state. */}
      {wizardOpen && <UploadWizard open onClose={() => setWizardOpen(false)} />}
    </>
  );
}
