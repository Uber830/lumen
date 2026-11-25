import { createFileRoute } from "@tanstack/react-router";
import { Archive, BookOpen, CheckCircle2, FileText, Film, Info, Search, Users } from "lucide-react";
import { useState } from "react";

import {
  Chip,
  EmptyState,
  PageHeader,
  Pagination,
  SectionCard,
  Toolbar,
} from "@/components/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import {
  formatFileSize,
  formatShortDate,
  useSchoolMaterial,
  useSchoolMaterialDetail,
  type MaterialListItem,
} from "@/lib/school/material";
import { cn } from "@/lib/utils";

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

/** The cover of a book is the color of its area. */
const COVER_TONES = [
  "bg-chart-1/12 text-chart-1",
  "bg-chart-2/12 text-chart-2",
  "bg-chart-3/12 text-chart-3",
  "bg-chart-4/14 text-chart-4",
  "bg-chart-5/12 text-chart-5",
] as const;

/** The color of a cover: the same area always has the same one. */
function toneOf(area: string): string {
  let sum = 0;
  for (const letter of area) sum += letter.charCodeAt(0);
  return COVER_TONES[sum % COVER_TONES.length];
}

function IconOf({ kind, className }: { kind: string; className?: string }) {
  const strokeWidth = 1.8;
  if (kind === "mp4") {
    return <Film className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (kind === "zip") {
    return <Archive className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (kind === "epub") {
    return <BookOpen className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  return <FileText className={className} strokeWidth={strokeWidth} aria-hidden />;
}

function Contenido() {
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
            <Chip tone="muted">
              {material.data ? `${material.data.available_total} materiales` : "—"}
            </Chip>
          </div>
        </Toolbar>

        {material.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {material.error.message}
          </p>
        ) : material.isLoading ? (
          <div className="grid gap-4 px-[18px] py-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex gap-3.5">
                <div
                  className="h-[132px] w-[96px] shrink-0 animate-pulse rounded-sm bg-muted"
                  style={{ animationDelay: `${index * 70}ms` }}
                />
                <div className="flex-1 space-y-2 py-1">
                  <div
                    className="h-[13px] w-full animate-pulse rounded bg-muted"
                    style={{ animationDelay: `${index * 70}ms` }}
                  />
                  <div className="h-[11px] w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : material.data && material.data.items.length > 0 ? (
          <>
            {/* The shelf: the material as the books it is. Each one opens
                in place, without leaving the view. */}
            <ul className="grid gap-5 px-[18px] py-5 sm:grid-cols-2 lg:grid-cols-3">
              {material.data.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="group flex w-full gap-3.5 text-left"
                  >
                    <span
                      className={cn(
                        "relative flex h-[132px] w-[96px] shrink-0 flex-col justify-between overflow-hidden rounded-sm border border-border p-2.5 transition-colors group-hover:border-primary/40",
                        toneOf(item.area),
                      )}
                    >
                      {/* The spine of the book. */}
                      <span
                        className="absolute inset-y-0 left-0 w-[5px] bg-current opacity-25"
                        aria-hidden
                      />
                      <span className="pl-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] opacity-90">
                        {item.area}
                      </span>
                      <IconOf kind={item.kind} className="size-6 self-end opacity-80" />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col py-0.5">
                      <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-foreground">
                        {item.title}
                      </span>
                      <span className="mt-1 font-mono text-[11.5px] text-muted-foreground">
                        {item.ref} · {formatFileSize(item.file_size_bytes)}
                      </span>
                      <span className="mt-1.5 text-[12px] text-muted-foreground">
                        {item.courses.length > 0
                          ? item.courses.map((course) => course.name).join(" · ")
                          : "Todo el colegio"}
                      </span>
                      <span className="mt-auto pt-2 text-[11.5px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Ver el material
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

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

      {/* The material, as it is: it opens on top of the shelf, without
          leaving the view. The switches that enable the material belong
          to the platform team, and the material is not downloaded by
          anybody: it is consulted inside the platform. */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[16px]">
              {detail.data?.title ?? selected?.title ?? "Material"}
            </DialogTitle>
            <DialogDescription className="font-mono text-[12px]">
              {detail.data?.ref ?? selected?.ref} ·{" "}
              {formatFileSize(detail.data?.file_size_bytes ?? selected?.file_size_bytes ?? null)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 sm:flex-row">
            <div
              className={cn(
                "relative flex h-[220px] w-[152px] shrink-0 flex-col justify-between overflow-hidden rounded-sm border border-border p-4",
                toneOf(detail.data?.area ?? selected?.area ?? ""),
              )}
            >
              <span
                className="absolute inset-y-0 left-0 w-[7px] bg-current opacity-25"
                aria-hidden
              />
              <span className="pl-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">
                {detail.data?.area ?? selected?.area}
              </span>
              <IconOf
                kind={detail.data?.kind ?? selected?.kind ?? ""}
                className="size-9 self-end opacity-80"
              />
              <span className="pl-1.5 text-[12px] font-semibold leading-snug opacity-95">
                {detail.data?.title ?? selected?.title}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              {detail.isLoading ? (
                <div className="h-24 animate-pulse rounded-xl bg-muted" aria-hidden />
              ) : detail.data ? (
                <>
                  <dl className="grid grid-cols-[112px_1fr] gap-x-3.5 gap-y-2.5 text-[13.2px]">
                    <dt className="text-[12.4px] text-muted-foreground">Área</dt>
                    <dd>{detail.data.area}</dd>
                    <dt className="text-[12.4px] text-muted-foreground">Tipo</dt>
                    <dd>{KIND_LABELS[detail.data.kind] ?? detail.data.kind}</dd>
                    <dt className="text-[12.4px] text-muted-foreground">Disponible desde</dt>
                    <dd className="font-mono">{formatShortDate(detail.data.available_since)}</dd>
                    <dt className="text-[12.4px] text-muted-foreground">Cursos</dt>
                    <dd className="flex flex-wrap items-center gap-1.5">
                      {detail.data.courses.length > 0
                        ? detail.data.courses.map((course) => (
                            <Chip key={course.id} tone="muted">
                              <Users className="size-3" strokeWidth={1.9} aria-hidden />
                              {course.name}
                            </Chip>
                          ))
                        : "Todo el colegio"}
                    </dd>
                    {detail.data.description && (
                      <>
                        <dt className="text-[12.4px] text-muted-foreground">Descripción</dt>
                        <dd className="text-muted-foreground">{detail.data.description}</dd>
                      </>
                    )}
                  </dl>

                  <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-secondary p-3 text-[12.5px] text-muted-foreground">
                    <CheckCircle2
                      className="mt-px size-4 shrink-0 text-success"
                      strokeWidth={1.9}
                      aria-hidden
                    />
                    <span>
                      <b className="font-semibold text-foreground">Acceso confirmado.</b>{" "}
                      {detail.data.access.note ?? "Este material está habilitado para tu colegio."}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground">No se pudo cargar el material.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
