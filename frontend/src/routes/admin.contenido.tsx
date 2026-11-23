import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { BookOpen, CheckCircle2, Info, Search, X } from "lucide-react";
import { useState } from "react";

import {
  Chip,
  EmptyState,
  PanelTable,
  PageHeader,
  Pagination,
  SectionCard,
  Toolbar,
  tableCellClass,
  tableHeadClass,
} from "@/components/ui-kit";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  formatFileSize,
  formatShortDate,
  useSchoolMaterial,
  useSchoolMaterialDetail,
  type MaterialListItem,
} from "@/lib/school/material";

export const Route = createFileRoute("/admin/contenido")({
  head: () => ({
    meta: [
      { title: "Contenido — Lumen" },
      {
        name: "description",
        content: "Material habilitado para tu colegio, cargado por el equipo editorial de Lumen.",
      },
    ],
  }),
  component: Contenido,
});

/** The kind of the file, written the way a person says it. */
const KIND_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Documento",
  epub: "Libro",
  mp4: "Video",
  zip: "Comprimido",
};

function Contenido() {
  const { session } = useRouteContext({ from: "/admin" });

  // The filters live in the URL state of the view: the browser can go
  // back and the page keeps them.
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MaterialListItem | null>(null);

  const material = useSchoolMaterial({ q: query, area, page });

  // A new filter starts again on the first page: the second page of
  // the previous filter is not the second page of this one.
  const applyQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const applyArea = (value: string) => {
    setArea(value);
    setPage(1);
  };

  const detail = useSchoolMaterialDetail(selected?.id ?? null);
  const areas = material.data?.areas ?? [];

  return (
    <>
      <PageHeader
        title="Contenido"
        subtitle="Material habilitado para tu colegio, cargado por el equipo editorial de Lumen."
      />

      <SectionCard className="overflow-hidden" bodyClassName="p-0">
        <Toolbar>
          <div className="relative w-full max-w-[280px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.9}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => applyQuery(event.target.value)}
              placeholder="Buscar por título, área o ID"
              aria-label="Buscar por título, área o ID"
              className="w-full rounded-idx border border-input bg-card py-2 pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
          </div>

          <select
            value={area}
            onChange={(event) => applyArea(event.target.value)}
            aria-label="Filtrar por área"
            className="rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
          >
            <option value="all">Todas las áreas</option>
            {areas.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="ml-auto">
            <Chip tone="muted">{material.data ? `${material.data.total} materiales` : "—"}</Chip>
          </div>
        </Toolbar>

        {material.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {material.error.message}
          </p>
        ) : material.isLoading ? (
          <div className="space-y-2 px-[18px] py-4" aria-hidden>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-lg bg-muted"
                style={{ animationDelay: `${index * 70}ms` }}
              />
            ))}
          </div>
        ) : material.data && material.data.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <PanelTable className="w-full border-collapse">
                <caption className="sr-only">Material habilitado para tu colegio</caption>
                <thead>
                  <tr>
                    <th scope="col" className={tableHeadClass}>
                      Material
                    </th>
                    <th scope="col" className={`${tableHeadClass} w-[120px]`}>
                      Tipo
                    </th>
                    <th scope="col" className={`${tableHeadClass} w-[130px]`}>
                      Área
                    </th>
                    <th scope="col" className={`${tableHeadClass} w-[130px]`}>
                      Cursos
                    </th>
                    <th scope="col" className={`${tableHeadClass} w-[140px]`}>
                      Disponible desde
                    </th>
                    <th scope="col" className={`${tableHeadClass} w-[90px]`}>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {material.data.items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-muted">
                      <td className={tableCellClass}>
                        <div className="font-medium">{item.title}</div>
                        <div className="mt-px font-mono text-[12px] text-muted-foreground">
                          {item.ref} · {formatFileSize(item.file_size_bytes)}
                        </div>
                      </td>
                      <td className={tableCellClass}>
                        <Chip tone="muted">{KIND_LABELS[item.kind] ?? item.kind}</Chip>
                      </td>
                      <td className={tableCellClass}>{item.area}</td>
                      <td className={`${tableCellClass} text-muted-foreground`}>
                        {item.courses.length > 0
                          ? item.courses.map((course) => course.name).join(" · ")
                          : "Todo el colegio"}
                      </td>
                      <td className={`${tableCellClass} font-mono text-muted-foreground`}>
                        {formatShortDate(item.available_since)}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setSelected(item)}
                            className="rounded-md px-1.5 py-0.5 text-[13px] text-primary transition-colors hover:bg-primary-soft"
                          >
                            Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </PanelTable>
            </div>
            <Pagination
              page={material.data.page}
              pageCount={material.data.pages}
              total={material.data.total}
              pageSize={material.data.per_page}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Sin resultados"
            description="Ajusta los filtros o revisa con el equipo de plataforma los materiales que te faltan."
          />
        )}

        {/* The contact is always visible: it is the way to ask for the
            material that is missing. */}
        <p className="flex items-start gap-2 border-t border-border px-[18px] py-3.5 text-[12.5px] text-muted-foreground">
          <Info className="mt-px size-4 shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
          <span>
            ¿Falta material o una versión nueva? La carga y la habilitación las hace el equipo de
            plataforma de Lumen. Escríbele a tu coordinador para que lo agregue al catálogo.
          </span>
        </p>
      </SectionCard>

      {/* The detail of the material: what it is and that the school has
          access to it. The switches that enable the material belong to
          the platform team, and the material is not downloaded by
          anybody: it is consulted inside the platform. */}
      <Drawer open={Boolean(selected)} onOpenChange={(open: boolean) => !open && setSelected(null)}>
        <DrawerContent className="w-full border-l border-border bg-card sm:max-w-[440px]">
          <DrawerHeader className="border-b border-border px-[18px] py-4">
            <DrawerTitle className="text-[15px] font-semibold">
              {detail.data?.title ?? selected?.title ?? "Material"}
            </DrawerTitle>
            <DrawerDescription className="font-mono text-[12px] text-muted-foreground">
              {detail.data?.ref ?? selected?.ref}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-[18px] py-4">
            {detail.isLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-muted" aria-hidden />
            ) : detail.data ? (
              <dl className="grid grid-cols-[118px_1fr] gap-x-3.5 gap-y-2.5 text-[13.2px]">
                <dt className="text-[12.4px] text-muted-foreground">Área</dt>
                <dd>{detail.data.area}</dd>
                <dt className="text-[12.4px] text-muted-foreground">Tipo</dt>
                <dd>{KIND_LABELS[detail.data.kind] ?? detail.data.kind}</dd>
                <dt className="text-[12.4px] text-muted-foreground">Tamaño</dt>
                <dd className="font-mono">{formatFileSize(detail.data.file_size_bytes)}</dd>
                <dt className="text-[12.4px] text-muted-foreground">Disponible desde</dt>
                <dd className="font-mono">{formatShortDate(detail.data.available_since)}</dd>
                <dt className="text-[12.4px] text-muted-foreground">Cursos</dt>
                <dd>
                  {detail.data.courses.length > 0
                    ? detail.data.courses.map((course) => course.name).join(" · ")
                    : "Todo el colegio"}
                </dd>
                {detail.data.description && (
                  <>
                    <dt className="text-[12.4px] text-muted-foreground">Descripción</dt>
                    <dd className="text-muted-foreground">{detail.data.description}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-[13px] text-muted-foreground">No se pudo cargar el material.</p>
            )}
          </div>

          <div className="border-t border-border px-[18px] py-4">
            <p className="flex items-start gap-2 rounded-xl border border-border bg-secondary p-3 text-[12.5px] text-muted-foreground">
              <CheckCircle2
                className="mt-px size-4 shrink-0 text-success"
                strokeWidth={1.9}
                aria-hidden
              />
              <span>
                <b className="font-semibold text-foreground">Acceso confirmado.</b>{" "}
                {detail.data?.access.note ?? "Este material está habilitado para tu colegio."}
              </span>
            </p>
            <DrawerClose className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-idx border border-input bg-card px-[15px] py-2 text-[13.2px] font-medium text-foreground transition-colors hover:bg-secondary">
              <X className="size-[15.5px]" strokeWidth={1.9} aria-hidden />
              Cerrar
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
