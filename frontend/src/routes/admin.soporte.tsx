import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { Info, Inbox, Paperclip, Search, Send, X } from "lucide-react";
import { useState } from "react";

import {
  Button,
  PanelTable,
  Chip,
  EmptyState,
  PageHeader,
  SectionCard,
  TableShell,
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
  SupportAttachmentField,
  type PickedAttachment,
} from "@/features/admin/support-attachments";
import {
  SUPPORT_CATEGORIES,
  useAddSupportMessage,
  useOpenSupportCase,
  useSchoolSupportCase,
  useSchoolSupportCases,
  type SupportCaseSummary,
} from "@/lib/school/support";

export const Route = createFileRoute("/admin/soporte")({
  head: () => ({
    meta: [
      { title: "Soporte — Lumen" },
      {
        name: "description",
        content: "Envía una solicitud al equipo de Lumen y sigue aquí la respuesta.",
      },
      { property: "og:title", content: "Soporte — Lumen" },
      {
        property: "og:description",
        content: "El canal de ayuda entre el colegio y el equipo de plataforma.",
      },
    ],
  }),
  component: SoportePage,
});

/** The category, written the way a person says it. */
const CATEGORY_LABELS: Record<string, string> = {
  problema_tecnico: "Problema técnico",
  solicitud_material: "Solicitud de material",
  duda_acceso: "Duda de acceso",
  otro: "Otro",
};

/** The state of a case: the platform team is the one that resolves it. */
function statusLabel(status: string): string {
  if (status === "abierto") return "Abierto";
  if (status === "en_espera") return "En espera";
  if (status === "resuelto") return "Resuelto";
  return status;
}

function statusTone(status: string): "info" | "warn" | "ok" {
  if (status === "abierto") return "info";
  if (status === "en_espera") return "warn";
  return "ok";
}

/** The date, the way the panel writes them: 14/11/2026. */
function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** The name of an attached file, read from the path it has in the store. */
function attachmentName(path: string): string {
  const file = path.split("/").pop() ?? path;
  // The store prefixes the name with the moment of the upload.
  const dash = file.indexOf("-");
  return dash > 0 ? file.slice(dash + 1) : file;
}

function SoportePage() {
  const { session } = useRouteContext({ from: "/admin" });

  const cases = useSchoolSupportCases();
  const openCase = useOpenSupportCase();
  const addMessage = useAddSupportMessage();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SupportCaseSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("problema_tecnico");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<PickedAttachment[]>([]);

  const detail = useSchoolSupportCase(selected?.id ?? null);

  // The frontend does not decide what the rank may do: it receives the
  // list from the API.
  const canWrite = session.permissions.includes("support.write");

  const filtered = (cases.data ?? []).filter((item) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return item.title.toLowerCase().includes(needle) || item.code.toLowerCase().includes(needle);
  });

  async function onOpenCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      setFormError("Escribe el asunto y el mensaje de la solicitud.");
      return;
    }
    setFormError(null);
    try {
      await openCase.mutateAsync({
        title: title.trim(),
        category,
        body: body.trim(),
        attachment_ids: attachments.map((attachment) => attachment.id),
      });
      setTitle("");
      setBody("");
      setAttachments([]);
      setCategory("problema_tecnico");
      setFormOpen(false);
    } catch {
      // The error is shown under the form, in Spanish.
    }
  }

  async function onReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    try {
      await addMessage.mutateAsync({
        caseId: selected.id,
        body: reply.trim(),
        attachment_ids: replyAttachments.map((attachment) => attachment.id),
      });
      setReply("");
      setReplyAttachments([]);
    } catch {
      // The error is shown under the form, in Spanish.
    }
  }

  return (
    <>
      <PageHeader
        title="Soporte"
        subtitle="Envía una solicitud al equipo de Lumen y sigue aquí la respuesta."
        actions={
          <Button
            icon={Send}
            onClick={() => {
              if (!canWrite) return;
              setFormOpen((open) => !open);
            }}
            aria-disabled={!canWrite}
            aria-describedby={canWrite ? undefined : "soporte-write-reason"}
            title={
              canWrite
                ? "Abrir una solicitud al equipo de Lumen"
                : "Esta acción la hace el administrador principal del colegio."
            }
          >
            Enviar solicitud
          </Button>
        }
      />

      {!canWrite && (
        <p id="soporte-write-reason" className="sr-only">
          Abrir una solicitud al equipo de Lumen lo hace el administrador principal del colegio.
        </p>
      )}

      {formOpen && (
        <SectionCard className="mb-4" title="Nueva solicitud">
          <form className="space-y-3" onSubmit={onOpenCase}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Asunto
              </span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                placeholder="El material de 7° no aparece en el curso"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <label className="block max-w-[320px]">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Categoría
              </span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {SUPPORT_CATEGORIES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mensaje
              </span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                rows={4}
                placeholder="Cuéntale qué pasó, con qué curso y qué material."
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="mt-1.5 block text-xs text-muted-foreground">
                Queda registrado en el historial del caso.
              </span>
            </label>

            <SupportAttachmentField attachments={attachments} onChange={setAttachments} />

            {formError && (
              <p role="alert" className="text-[13px] text-destructive">
                {formError}
              </p>
            )}
            {openCase.error && (
              <p role="alert" className="text-[13px] text-destructive">
                {openCase.error.message}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" icon={Send} disabled={openCase.isPending}>
                {openCase.isPending ? "Enviando..." : "Enviar solicitud"}
              </Button>
              <Button variant="ghost" icon={X} type="button" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en tus solicitudes"
              aria-label="Buscar en tus solicitudes"
              className="w-full rounded-idx border border-input bg-card py-2 pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
          </div>

          <div className="ml-auto">
            <Chip tone="muted">{cases.data ? `${cases.data.length} solicitudes` : "—"}</Chip>
          </div>
        </Toolbar>

        {cases.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {cases.error.message}
          </p>
        ) : cases.isLoading ? (
          <div className="space-y-2 px-[18px] py-4" aria-hidden>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-lg bg-muted"
                style={{ animationDelay: `${index * 70}ms` }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={cases.data && cases.data.length > 0 ? "Sin resultados" : "Sin solicitudes"}
            description={
              cases.data && cases.data.length > 0
                ? "Ninguna solicitud coincide con la búsqueda."
                : "Envía una solicitud al equipo de Lumen y sigue aquí la respuesta."
            }
            action={
              <Button icon={Send} onClick={() => setFormOpen(true)} disabled={!canWrite}>
                Enviar solicitud
              </Button>
            }
          />
        ) : (
          <TableShell>
            <PanelTable className="w-full border-collapse">
              <caption className="sr-only">Solicitudes del colegio al equipo de Lumen</caption>
              <thead>
                <tr>
                  <th scope="col" className={tableHeadClass}>
                    Solicitud
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[170px]`}>
                    Categoría
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[130px]`}>
                    Estado
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[130px]`}>
                    Abierta
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[100px]`}>
                    Mensajes
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[90px]`}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted">
                    <td className={tableCellClass}>
                      <div className="font-medium">{item.title}</div>
                      <div className="mt-px font-mono text-[12px] text-muted-foreground">
                        {item.code}
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <Chip tone="muted">{CATEGORY_LABELS[item.category] ?? item.category}</Chip>
                    </td>
                    <td className={tableCellClass}>
                      <Chip tone={statusTone(item.status)} dot>
                        {statusLabel(item.status)}
                      </Chip>
                    </td>
                    <td
                      className={`${tableCellClass} font-mono text-[12.4px] text-muted-foreground`}
                    >
                      {shortDate(item.opened_at)}
                    </td>
                    <td className={`${tableCellClass} font-mono text-[12.5px] font-semibold`}>
                      {item.messages}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelected(item)}
                          className="rounded-md px-1.5 py-0.5 text-[13px] text-primary transition-colors hover:bg-primary-soft"
                        >
                          Abrir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </PanelTable>
          </TableShell>
        )}

        <p className="flex items-start gap-2 border-t border-border px-[18px] py-3.5 text-[12.5px] text-muted-foreground">
          <Info className="mt-px size-4 shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
          <span>
            <b className="font-semibold text-foreground">¿Quién responde?</b> El equipo de Lumen, de
            operación de plataforma, responde en este mismo hilo. Cuéntale qué pasó, con qué curso y
            qué material; con eso responden el mismo día.
          </span>
        </p>
      </SectionCard>

      {/* The case: the thread and the one action the school has. */}
      <Drawer open={Boolean(selected)} onOpenChange={(open: boolean) => !open && setSelected(null)}>
        <DrawerContent className="w-full border-l border-border bg-card sm:max-w-[480px]">
          <DrawerHeader className="border-b border-border px-[18px] py-4">
            <DrawerTitle className="text-[15px] font-semibold">
              {detail.data?.title ?? selected?.title ?? "Solicitud"}
            </DrawerTitle>
            <DrawerDescription className="font-mono text-[12px] text-muted-foreground">
              {detail.data?.code ?? selected?.code}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-[18px] py-4">
            {detail.isLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-muted" aria-hidden />
            ) : detail.data ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={statusTone(detail.data.status)} dot>
                    {statusLabel(detail.data.status)}
                  </Chip>
                  <Chip tone="muted">
                    {CATEGORY_LABELS[detail.data.category] ?? detail.data.category}
                  </Chip>
                </div>

                <ol className="mt-4 space-y-3">
                  {detail.data.messages.map((message) => (
                    <li
                      key={message.id}
                      className={`rounded-xl border p-3 ${
                        message.author_role === "plataforma"
                          ? "border-border bg-secondary"
                          : "border-primary/30 bg-primary-soft"
                      }`}
                    >
                      <p className="text-[12.4px] font-semibold">
                        {message.author_name}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          {message.author_role === "plataforma" ? "· Plataforma" : "· Colegio"}
                        </span>
                      </p>
                      <p className="mt-1 text-[13.2px] leading-relaxed">{message.body}</p>
                      {message.attachment_ids.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {message.attachment_ids.map((attachment) => (
                            <li key={attachment}>
                              <a
                                href={`/v1/files/${attachment}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-idx border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary"
                              >
                                <Paperclip
                                  className="size-3.5 shrink-0"
                                  strokeWidth={1.9}
                                  aria-hidden
                                />
                                {attachmentName(attachment)}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-1.5 font-mono text-[11.6px] text-muted-foreground">
                        {shortDate(message.created_at)}
                      </p>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">No se pudo cargar la solicitud.</p>
            )}
          </div>

          {selected && (
            <div className="border-t border-border px-[18px] py-4">
              <form className="space-y-2" onSubmit={onReply}>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Agregar información
                  </span>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    rows={3}
                    placeholder="Escribe aquí lo que el equipo de Lumen necesita saber."
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
                {addMessage.error && (
                  <p role="alert" className="text-[13px] text-destructive">
                    {addMessage.error.message}
                  </p>
                )}
                <SupportAttachmentField
                  attachments={replyAttachments}
                  onChange={setReplyAttachments}
                />
                <Button
                  type="submit"
                  icon={Send}
                  disabled={addMessage.isPending || !reply.trim()}
                  aria-disabled={!canWrite}
                  aria-describedby={canWrite ? undefined : "soporte-write-reason"}
                  title={
                    canWrite
                      ? "Agregar información al hilo"
                      : "Esta acción la hace el administrador principal del colegio."
                  }
                >
                  {addMessage.isPending ? "Enviando..." : "Agregar información"}
                </Button>
              </form>
              <p className="mt-3 text-[12px] text-muted-foreground">
                El caso no lo resuelve el colegio: eso lo hace el equipo de Lumen.
              </p>
              <DrawerClose className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-idx border border-input bg-card px-[15px] py-2 text-[13.2px] font-medium text-foreground transition-colors hover:bg-secondary">
                <X className="size-[15.5px]" strokeWidth={1.9} aria-hidden />
                Cerrar
              </DrawerClose>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
