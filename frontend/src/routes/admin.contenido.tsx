import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, CheckCircle2, Eye, Info, Search, Trash2, Upload, Users } from "lucide-react";
import { useState } from "react";

import {
  Button,
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
import { SchoolResourceDialog } from "@/features/admin/school-resource-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { audienceLabel, coverOf, ResourceCard } from "@/features/resources/resource-card";
import { ResourceViewer } from "@/features/resources/resource-viewer";
import {
  fetchSchoolMaterialFile,
  formatFileSize,
  formatShortDate,
  MATERIAL_PAGE_SIZE,
  useDeleteSchoolMaterial,
  useSchoolMaterial,
  useSchoolMaterialDetail,
  type MaterialListItem,
} from "@/lib/school/material";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/contenido")({
  head: () => ({
    meta: [
      { title: "Biblioteca — Lumen" },
      {
        name: "description",
        content: "La biblioteca del colegio: los recursos que publicó el equipo de Lumen.",
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

/** The line under the name of a resource: area, courses and size. */
function metaOf(item: MaterialListItem): string {
  const courses =
    item.courses.length > 0
      ? item.courses.map((course) => course.name).join(" · ")
      : "Todo el colegio";
  return `${item.area} · ${courses} · ${formatFileSize(item.file_size_bytes)}`;
}

function Contenido() {
  // The filters live in the URL state of the view: the browser can go
  // back and the page keeps them.
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [audience, setAudience] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MaterialListItem | null>(null);
  // The form that loads a resource of the school, and the one that
  // removes it.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MaterialListItem | null>(null);

  const material = useSchoolMaterial({ q: query, area, audience, page });
  const deleteMaterial = useDeleteSchoolMaterial();

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

  const applyAudience = (value: string) => {
    setAudience(value);
    setPage(1);
  };

  const detail = useSchoolMaterialDetail(selected?.id ?? null);
  const areas = material.data?.areas ?? [];
  const audiences = material.data?.audiences ?? [];

  async function onDelete() {
    if (!toDelete) return;
    await deleteMaterial.mutateAsync(toDelete.id);
    setToDelete(null);
  }

  return (
    <>
      <PageHeader
        title="Biblioteca del colegio"
        subtitle="Los recursos que publicó el equipo de Lumen y los que cargó tu colegio. Todos los ven; lo que es solo para docentes o solo para administradores lo define quien lo carga."
        actions={
          <Button icon={Upload} onClick={() => setUploadOpen(true)}>
            Cargar recurso
          </Button>
        }
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

          <select
            value={audience}
            onChange={(event) => applyAudience(event.target.value)}
            aria-label="Filtrar por destinatario"
            className="rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
          >
            <option value="all">Todos los destinatarios</option>
            {audiences.map((item) => (
              <option key={item} value={item}>
                {audienceLabel(item)}
              </option>
            ))}
          </select>

          <div className="ml-auto">
            <Chip tone="muted">{material.data ? `${material.data.total} recursos` : "—"}</Chip>
          </div>
        </Toolbar>

        {material.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {material.error.message}
          </p>
        ) : material.isLoading ? (
          <div
            className="grid gap-4 px-[18px] py-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-hidden
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-idx border border-border"
                style={{ animationDelay: `${index * 70}ms` }}
              >
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
        ) : material.data && material.data.items.length > 0 ? (
          <>
            {/* The shelf: every resource as a card, with its cover. */}
            <ul className="grid gap-4 px-[18px] py-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {material.data.items.map((item) => (
                <li key={item.id}>
                  <ResourceCard
                    data={{
                      title: item.title,
                      type: item.type,
                      area: item.area,
                      meta: metaOf(item),
                      audience: audienceLabel(item.visible_to),
                      fromSchool: item.origin === "colegio",
                    }}
                    chips={
                      <>
                        <Chip tone={item.visible_to === "all" ? "muted" : "info"}>
                          {audienceLabel(item.visible_to)}
                        </Chip>
                        {item.origin === "colegio" ? (
                          <Chip tone="teal">Cargado por el colegio</Chip>
                        ) : null}
                      </>
                    }
                    actions={
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Eye}
                          onClick={() => setSelected(item)}
                          aria-label={`Ver ${item.title}`}
                        >
                          Ver
                        </Button>
                        {/* Only the resources of the school are its own
                            to remove: the ones of the editorial team
                            are not. */}
                        {item.origin === "colegio" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => setToDelete(item)}
                            aria-label={`Quitar ${item.title}`}
                            className="ml-1"
                          >
                            Quitar
                          </Button>
                        ) : null}
                      </>
                    }
                  />
                </li>
              ))}
            </ul>

            <Pagination
              page={material.data.page}
              pageCount={material.data.pages}
              total={material.data.total}
              pageSize={material.data.per_page || MATERIAL_PAGE_SIZE}
              onPageChange={setPage}
              always
            />
          </>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Sin resultados"
            description="Ajusta los filtros o revisa con el equipo de plataforma los recursos que te faltan."
          />
        )}

        {/* The library belongs to everybody: the rules of the access are
            written down, not guessed. */}
        <p className="flex items-start gap-2 border-t border-border px-[18px] py-3.5 text-[12.5px] text-muted-foreground">
          <Info className="mt-px size-4 shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
          <span>
            <b className="font-semibold text-foreground">La biblioteca es de todos.</b> Todo lo que
            el equipo de Lumen publica queda disponible para todos los colegios. Cada recurso define
            a quién va dirigido: a todos, solo a docentes o solo a administradores.
          </span>
        </p>
      </SectionCard>

      {/* The resource, as it is: it opens on top of the shelf, without
          leaving the view. The file is shown inside the platform: the
          material is consulted, not downloaded. */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-[16px]">
              {detail.data?.title ?? selected?.title ?? "Recurso"}
            </DialogTitle>
            <DialogDescription className="font-mono text-[12px]">
              {detail.data?.ref ?? selected?.ref} ·{" "}
              {formatFileSize(detail.data?.file_size_bytes ?? selected?.file_size_bytes ?? null)}
            </DialogDescription>
          </DialogHeader>

          {/* The data of the piece, in one line: what it is and who it
              is for. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone="muted">{detail.data?.area ?? selected?.area}</Chip>
            <Chip tone="muted">{detail.data?.type ?? selected?.type}</Chip>
            <Chip
              tone={(detail.data?.visible_to ?? selected?.visible_to) === "all" ? "muted" : "info"}
            >
              {audienceLabel(detail.data?.visible_to ?? selected?.visible_to ?? "all")}
            </Chip>
            {(detail.data?.origin ?? selected?.origin) === "colegio" ? (
              <Chip tone="teal">Cargado por el colegio</Chip>
            ) : null}
          </div>

          <ResourceViewer
            file={detail.data?.file ?? null}
            materialId={selected?.id ?? null}
            loadFile={fetchSchoolMaterialFile}
          />

          {detail.data?.description ? (
            <p className="text-[13px] text-muted-foreground">{detail.data.description}</p>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* The form that loads a resource of the school. */}
      <SchoolResourceDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />

      {/* Removing a resource of the school asks for confirmation: the
          file leaves the library with it. */}
      <ConfirmDialog
        open={toDelete !== null}
        title={`Quitar ${toDelete?.title ?? "el recurso"}`}
        description="El recurso sale de la biblioteca del colegio y el archivo que tiene deja de estar disponible."
        confirmLabel="Quitar el recurso"
        pending={deleteMaterial.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void onDelete()}
      />
    </>
  );
}
