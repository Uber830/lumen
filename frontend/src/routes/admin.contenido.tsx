import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  CheckCircle2,
  Eye,
  Info,
  Pencil,
  Search,
  Settings2,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
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
import { SchoolResourceDialog } from "@/features/admin/school-resource-dialog";
import { SchoolMaterialCard } from "@/features/admin/school-material-card";
import { SchoolMaterialEditor } from "@/features/admin/school-material-editor";
import { SchoolMaterialPreview } from "@/features/admin/school-material-preview";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { audienceLabel, coverOf, ResourceCard } from "@/features/resources/resource-card";
import {
  formatFileSize,
  MATERIAL_PAGE_SIZE,
  useDeleteSchoolMaterial,
  useSchoolMaterial,
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
  // The three controls of a resource of the school: the eye, the pencil
  // and the characteristics.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
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
                      /* Los controles son solo el icono: la tarjeta no
                         pierde el espacio con los nombres. */
                      <div className="flex items-center gap-1.5">
                        {/* El ojo: la pieza se ve antes de decidir
                            nada sobre ella. */}
                        <Button
                          variant="outline"
                          size="xs"
                          icon={Eye}
                          className="size-[26px] justify-center px-0"
                          onClick={() => setPreviewId(item.id)}
                          aria-label={`Ver ${item.title}`}
                          title="Ver el recurso"
                        />
                        {/* Los recursos del colegio son suyos: se editan
                            y se miran. Los del equipo de Lumen se
                            consultan, nada más. */}
                        {item.origin === "colegio" ? (
                          <>
                            {/* El lápiz: los valores del recurso. */}
                            <Button
                              variant="outline"
                              size="xs"
                              icon={Pencil}
                              className="size-[26px] justify-center px-0"
                              onClick={() => setEditorId(item.id)}
                              aria-label={`Editar ${item.title}`}
                              title="Editar el recurso"
                            />
                            {/* Las características: la ficha de la
                                pieza y de su archivo. */}
                            <Button
                              variant="outline"
                              size="xs"
                              icon={Settings2}
                              className="size-[26px] justify-center px-0"
                              onClick={() => setCardId(item.id)}
                              aria-label={`Características de ${item.title}`}
                              title="Ver las características del recurso"
                            />
                            {/* Solo los recursos del colegio son suyos
                                para quitar: los del equipo de Lumen no. */}
                            <Button
                              variant="ghost"
                              size="xs"
                              icon={Trash2}
                              className="size-[26px] justify-center px-0 text-destructive hover:text-destructive"
                              onClick={() => setToDelete(item)}
                              aria-label={`Quitar ${item.title}`}
                              title="Quitar el recurso"
                            />
                          </>
                        ) : null}
                      </div>
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

      {/* El recurso, como es: el ojo. Se abre sobre la estantería, sin
          salir de la vista. */}
      <SchoolMaterialPreview
        key={previewId ?? "vista-previa-cerrada"}
        materialId={previewId}
        onClose={() => setPreviewId(null)}
      />

      {/* El lápiz: los valores del recurso del colegio. */}
      <SchoolMaterialEditor
        key={editorId ?? "editor-cerrado"}
        materialId={editorId}
        onClose={() => setEditorId(null)}
      />

      {/* Las características: la ficha de la pieza y de su archivo. */}
      <SchoolMaterialCard
        key={cardId ?? "ficha-cerrada"}
        materialId={cardId}
        onClose={() => setCardId(null)}
      />

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
