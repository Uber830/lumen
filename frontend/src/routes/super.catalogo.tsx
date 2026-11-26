import { createFileRoute } from "@tanstack/react-router";
import { Search, Upload } from "lucide-react";
import { useState } from "react";

import {
  Button,
  Chip,
  EmptyState,
  PageHeader,
  Pagination,
  SearchField,
  SectionCard,
  StatusPill,
  Toolbar,
} from "@/components/ui-kit";
import { MaterialPanel } from "@/features/platform/material-panel";
import { UploadWizard } from "@/features/platform/upload-wizard";
import { audienceLabel, ResourceCard } from "@/features/resources/resource-card";
import { useCatalog, useCatalogOptions, usePlatformMetrics } from "@/lib/platform/hooks";
import {
  MATERIAL_STATUS_LABEL,
  MATERIAL_STATUS_TONE,
  type MaterialSummary,
} from "@/lib/platform/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super/catalogo")({
  head: () => ({
    meta: [
      { title: "Biblioteca de recursos — Lumen Platform" },
      {
        name: "description",
        content:
          "La biblioteca de la plataforma: decide a quién va dirigido cada recurso y publícalo.",
      },
      { property: "og:title", content: "Biblioteca de recursos — Lumen Platform" },
      {
        property: "og:description",
        content: "Administración de la biblioteca de recursos y de su acceso por colegio.",
      },
    ],
  }),
  component: Catalogo,
});

/** How many resources the shelf shows at once. */
const PER_PAGE = 12;

/** The line under the name of a resource: area, grades and size. */
function metaOf(item: MaterialSummary): string {
  const grades = item.grades.length > 0 ? item.grades.join(" · ") : "Todos los grados";
  return `${item.area} · ${grades} · ${item.size_label}`;
}

function Catalogo() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [visibleTo, setVisibleTo] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const options = useCatalogOptions();
  const metrics = usePlatformMetrics();
  const catalog = useCatalog({
    q,
    type,
    status,
    visible_to: visibleTo,
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
  // How much the library holds, with no filters: the counter of the
  // toolbar talks about the whole library, not about the search.
  const libraryTotal = metrics.data?.materials ?? 0;

  const filtersActive = Boolean(q || type || status || visibleTo);

  return (
    <>
      <PageHeader
        title="Biblioteca de recursos"
        subtitle="Todo lo que el equipo de Lumen carga para los colegios: libros, guías, videos y simuladores. Define a quién va dirigido cada recurso y publícalo."
        actions={
          <Button icon={Upload} onClick={() => setWizardOpen(true)}>
            Cargar recurso
          </Button>
        }
      />

      <SectionCard className="overflow-hidden" bodyClassName="p-0">
        <Toolbar>
          <SearchField
            value={q}
            onChange={filter(setQ)}
            placeholder="Buscar en la biblioteca"
            className="h-9 w-full border border-input sm:w-72"
          />

          <select
            value={type}
            onChange={(event) => filter(setType)(event.target.value)}
            aria-label="Filtrar por tipo"
            className="h-9 rounded-idx border border-input bg-card px-2.5 text-sm"
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
            className="h-9 rounded-idx border border-input bg-card px-2.5 text-sm"
          >
            <option value="">Todos los estados</option>
            {(options.data?.statuses ?? []).map((value) => (
              <option key={value} value={value}>
                {MATERIAL_STATUS_LABEL[value as keyof typeof MATERIAL_STATUS_LABEL] ?? value}
              </option>
            ))}
          </select>

          <select
            value={visibleTo}
            onChange={(event) => filter(setVisibleTo)(event.target.value)}
            aria-label="Filtrar por destinatario"
            className="h-9 rounded-idx border border-input bg-card px-2.5 text-sm"
          >
            <option value="">Todos los destinatarios</option>
            {(options.data?.visible_to ?? []).map((value) => (
              <option key={value} value={value}>
                {audienceLabel(value)}
              </option>
            ))}
          </select>

          <div className="ml-auto">
            <Chip tone="muted">
              {libraryTotal > 0 ? `${total} de ${libraryTotal}` : `${total} recursos`}
            </Chip>
          </div>
        </Toolbar>

        {catalog.isLoading ? (
          <div
            className="grid gap-4 px-[18px] py-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-hidden
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-idx border border-border">
                <div className="h-[104px] animate-pulse bg-muted" />
                <div className="space-y-2 p-3">
                  <div
                    className="h-[13px] w-full animate-pulse rounded bg-muted"
                    style={{ animationDelay: `${index * 70}ms` }}
                  />
                  <div className="h-[11px] w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin recursos en la biblioteca"
            description={
              filtersActive
                ? "Los filtros no encontraron nada. Quítalos o carga el primer recurso de la biblioteca."
                : "La biblioteca de la plataforma está vacía. Carga el primer recurso."
            }
            icon={Search}
            action={
              filtersActive ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    setType("");
                    setStatus("");
                    setVisibleTo("");
                    setPage(1);
                  }}
                >
                  Quitar los filtros
                </Button>
              ) : (
                <Button icon={Upload} onClick={() => setWizardOpen(true)}>
                  Cargar recurso
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* The shelf: every resource as a card, with its cover. */}
            <ul className="grid gap-4 px-[18px] py-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <li key={item.id}>
                  <ResourceCard
                    data={{
                      title: item.title,
                      type: item.type,
                      area: item.area,
                      meta: metaOf(item),
                      audience: audienceLabel(item.visible_to),
                    }}
                    chips={
                      <>
                        <StatusPill
                          label={MATERIAL_STATUS_LABEL[item.status]}
                          tone={MATERIAL_STATUS_TONE[item.status]}
                        />
                        <Chip tone={item.visible_to === "all" ? "muted" : "info"}>
                          {audienceLabel(item.visible_to)}
                        </Chip>
                      </>
                    }
                    actions={
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setOpenId(item.id)}
                        aria-label={`Gestionar ${item.title}`}
                      >
                        Gestionar
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>

            <Pagination
              page={catalog.data?.page ?? 1}
              pageCount={pageCount}
              total={total}
              pageSize={PER_PAGE}
              onPageChange={setPage}
              always
            />
          </>
        )}
      </SectionCard>

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
