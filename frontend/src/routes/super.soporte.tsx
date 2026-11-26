import { createFileRoute } from "@tanstack/react-router";
import { Check, Send } from "lucide-react";
import { useState } from "react";

import {
  Button,
  Chip,
  EmptyState,
  PageHeader,
  Pagination,
  SearchField,
  SectionCard,
  SkeletonRows,
  StatusPill,
  TableShell,
  Tag,
  Toolbar,
  tableCellClass,
  tableHeadClass,
} from "@/components/ui-kit";
import { AuditEventPanel } from "@/features/platform/audit-event-panel";
import { CaseComposer } from "@/features/platform/case-composer";
import { CasePanel } from "@/features/platform/case-panel";
import { NewCaseDialog } from "@/features/platform/new-case-dialog";
import {
  useAudit,
  useCaseOptions,
  useCases,
  usePlatformSchools,
  useResolveCase,
} from "@/lib/platform/hooks";
import {
  auditEventLabel,
  CASE_CATEGORY_LABEL,
  CASE_CHANNEL_LABEL,
  CASE_LEVEL_LABEL,
  CASE_LEVEL_TONE,
  CASE_STATUS_LABEL,
  CASE_STATUS_TONE,
  type AuditEntry,
  type CaseCategory,
  type CaseChannel,
  type CaseLevel,
  type CaseStatus,
  type CaseSummary,
} from "@/lib/platform/types";

export const Route = createFileRoute("/super/soporte")({
  head: () => ({
    meta: [
      { title: "Soporte y auditoría — Lumen Platform" },
      {
        name: "description",
        content:
          "Casos que llegan de los colegios, con su conversación y el registro de cada respuesta.",
      },
      { property: "og:title", content: "Soporte y auditoría — Lumen Platform" },
      {
        property: "og:description",
        content: "Auditoría de la operación de la biblioteca de recursos.",
      },
    ],
  }),
  component: Soporte,
});

const PER_PAGE = 10;

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

type Tab = "casos" | "auditoria";

function Soporte() {
  const [tab, setTab] = useState<Tab>("casos");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [level, setLevel] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<CaseSummary[] | null>(null);

  const [auditLevel, setAuditLevel] = useState("");
  const [auditSchool, setAuditSchool] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  // The event whose detail is open, if any.
  const [auditEvent, setAuditEvent] = useState<AuditEntry | null>(null);
  // The form that opens a conversation with a school.
  const [newCaseOpen, setNewCaseOpen] = useState(false);

  const schools = usePlatformSchools({ per_page: 50 });
  const caseOptions = useCaseOptions();
  const cases = useCases({ q, status, level, school_id: schoolId, page, per_page: PER_PAGE });
  const audit = useAudit({
    level: auditLevel,
    school_id: auditSchool,
    page: auditPage,
    per_page: PER_PAGE,
  });

  const total = cases.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const items = cases.data?.items ?? [];
  const selectedCases = items.filter((item) => selected.includes(item.id));
  const resolve = useResolveCase();

  function toggleCase(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function resolveSelected() {
    for (const item of selectedCases) {
      await resolve.mutateAsync(item.id);
    }
    setSelected([]);
  }

  return (
    <>
      <PageHeader
        title="Soporte y auditoría"
        subtitle="Casos que llegan de los colegios, con su conversación y el registro de cada respuesta."
        actions={
          <Button icon={Send} onClick={() => setNewCaseOpen(true)}>
            Enviar solicitud
          </Button>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-border">
        {(
          [
            ["casos", "Casos"],
            ["auditoria", "Auditoría"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "casos" ? (
        <SectionCard className="overflow-hidden" bodyClassName="p-0">
          <Toolbar>
            <SearchField
              value={q}
              onChange={(value) => {
                setQ(value);
                setPage(1);
              }}
              placeholder="Buscar caso"
              className="h-9 w-full rounded-idx border border-input sm:w-72"
            />

            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por estado del caso"
              className="h-9 rounded-idx border border-input bg-card px-2.5 text-sm"
            >
              <option value="">Todos los estados</option>
              {(caseOptions.data?.statuses ?? []).map((value) => (
                <option key={value} value={value}>
                  {CASE_STATUS_LABEL[value as CaseStatus] ?? value}
                </option>
              ))}
            </select>

            <select
              value={level}
              onChange={(event) => {
                setLevel(event.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por nivel del caso"
              className="h-9 rounded-idx border border-input bg-card px-2.5 text-sm"
            >
              <option value="">Todos los niveles</option>
              {(caseOptions.data?.levels ?? []).map((value) => (
                <option key={value} value={value}>
                  {CASE_LEVEL_LABEL[value as CaseLevel] ?? value}
                </option>
              ))}
            </select>

            <select
              value={schoolId}
              onChange={(event) => {
                setSchoolId(event.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por colegio"
              className="h-9 max-w-64 rounded-idx border border-input bg-card px-2.5 text-sm"
            >
              <option value="">Todos los colegios</option>
              {(schools.data?.items ?? []).map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>

            <div className="ml-auto">
              <Chip tone="muted">{cases.isLoading ? "—" : `${total} caso(s)`}</Chip>
            </div>
          </Toolbar>

          <p className="border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
            Todo caso entra como <b className="text-foreground">Abierto</b>. Al responderlo queda{" "}
            <b className="text-foreground">En espera</b> (ya le respondimos y esperamos al colegio);
            al marcarlo como resuelto queda <b className="text-foreground">Resuelto</b>.
          </p>

          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary-soft px-5 py-2.5">
              <span className="text-xs font-semibold text-primary">
                {selected.length} seleccionado(s)
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(selectedCases)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
              >
                <Send className="size-3.5" strokeWidth={1.9} aria-hidden />
                Responder
              </button>
              <button
                type="button"
                onClick={() => void resolveSelected()}
                disabled={resolve.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-60"
              >
                <Check className="size-3.5" strokeWidth={1.9} aria-hidden />
                Marcar como resuelto
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

          {cases.isLoading ? (
            <SkeletonRows rows={6} columns={7} />
          ) : items.length === 0 ? (
            <EmptyState title="Sin casos" description="No hay casos que coincidan con el filtro." />
          ) : (
            <>
              <TableShell>
                <table className="w-full text-[13.4px]">
                  <caption className="sr-only">Casos que abriron los colegios.</caption>
                  <thead className="table-head-band">
                    <tr>
                      <th
                        scope="col"
                        aria-label="Seleccionar"
                        className={`${tableHeadClass} w-10`}
                      />
                      <th scope="col" className={tableHeadClass}>
                        Caso
                      </th>
                      <th scope="col" className={tableHeadClass}>
                        Colegio
                      </th>
                      <th scope="col" className={tableHeadClass}>
                        Solicita
                      </th>
                      <th scope="col" className={tableHeadClass}>
                        Canal
                      </th>
                      <th scope="col" className={tableHeadClass}>
                        Nivel
                      </th>
                      <th scope="col" className={tableHeadClass}>
                        Estado
                      </th>
                      <th scope="col" className={`${tableHeadClass} text-right`}>
                        Recibido
                      </th>
                      <th scope="col" className={`${tableHeadClass} text-right`}>
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-muted">
                        <td className={tableCellClass}>
                          <input
                            type="checkbox"
                            className="size-3.5 accent-primary"
                            checked={selected.includes(item.id)}
                            onChange={() => toggleCase(item.id)}
                            aria-label={`Seleccionar ${item.code}`}
                          />
                        </td>
                        <td className={tableCellClass}>
                          <button
                            type="button"
                            onClick={() => setOpenId(item.id)}
                            className="text-left font-medium text-foreground hover:text-primary"
                          >
                            {item.title}
                          </button>
                          <span className="mt-px block font-mono text-[12px] text-muted-foreground">
                            {item.code} · {item.message_count} mensaje(s)
                          </span>
                        </td>
                        <td className={tableCellClass}>{item.school_name ?? "—"}</td>
                        <td className={tableCellClass}>
                          <span className="block">{item.opened_by_name}</span>
                          <span className="block text-[12px] text-muted-foreground">
                            {CASE_CATEGORY_LABEL[item.category as CaseCategory] ?? item.category}
                          </span>
                        </td>
                        <td className={tableCellClass}>
                          <Tag>
                            {CASE_CHANNEL_LABEL[item.channel as CaseChannel] ?? item.channel}
                          </Tag>
                        </td>
                        <td className={tableCellClass}>
                          <StatusPill
                            label={CASE_LEVEL_LABEL[item.level as CaseLevel] ?? item.level}
                            tone={CASE_LEVEL_TONE[item.level as CaseLevel] ?? "muted"}
                          />
                        </td>
                        <td className={tableCellClass}>
                          <StatusPill
                            label={CASE_STATUS_LABEL[item.status as CaseStatus] ?? item.status}
                            tone={CASE_STATUS_TONE[item.status as CaseStatus] ?? "muted"}
                          />
                        </td>
                        <td
                          className={`${tableCellClass} text-right text-[12.5px] text-muted-foreground`}
                        >
                          {new Date(item.opened_at).toLocaleString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        {/* The answer to the school, from the list: the
                            platform does not have to open the case first. */}
                        <td className={`${tableCellClass} text-right`}>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Send}
                            onClick={() => setReplyTo([item])}
                            aria-label={`Responder ${item.code}`}
                          >
                            Responder
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
              <Pagination
                page={cases.data?.page ?? 1}
                pageCount={pageCount}
                total={total}
                pageSize={PER_PAGE}
                onPageChange={setPage}
                always
              />
            </>
          )}
        </SectionCard>
      ) : (
        <SectionCard className="overflow-hidden" bodyClassName="p-0">
          <Toolbar>
            <select
              value={auditSchool}
              onChange={(event) => {
                setAuditSchool(event.target.value);
                setAuditPage(1);
              }}
              aria-label="Filtrar por colegio"
              className="h-9 max-w-64 rounded-idx border border-input bg-card px-2.5 text-sm"
            >
              <option value="">Todos los colegios</option>
              {(schools.data?.items ?? []).map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>

            <select
              value={auditLevel}
              onChange={(event) => {
                setAuditLevel(event.target.value);
                setAuditPage(1);
              }}
              aria-label="Filtrar por nivel"
              className="h-9 rounded-idx border border-input bg-card px-2.5 text-sm"
            >
              <option value="">Todos los niveles</option>
              <option value="info">Info</option>
              <option value="warning">Aviso</option>
              <option value="error">Error</option>
            </select>

            <div className="ml-auto">
              <Chip tone="muted">
                {audit.isLoading ? "—" : `${audit.data?.total ?? 0} evento(s)`}
              </Chip>
            </div>
          </Toolbar>

          <p className="border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
            Haz clic en un evento para ver su detalle. Los que vienen de un caso de soporte muestran
            también la conversación del ticket.
          </p>

          {audit.isLoading ? (
            <SkeletonRows rows={6} columns={4} />
          ) : (audit.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin eventos"
              description="No hay movimientos de la red que coincidan con el filtro."
            />
          ) : (
            <>
              <TableShell>
                <table className="w-full text-[13.4px]">
                  <caption className="sr-only">Eventos de la auditoría de la plataforma.</caption>
                  <thead className="table-head-band">
                    <tr>
                      <th scope="col" className={tableHeadClass}>
                        Evento
                      </th>
                      <th scope="col" className={tableHeadClass}>
                        Actor
                      </th>
                      <th scope="col" className={tableHeadClass}>
                        Nivel
                      </th>
                      <th scope="col" className={`${tableHeadClass} text-right`}>
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data?.items.map((entry) => (
                      <tr
                        key={entry.id}
                        className="cursor-pointer transition-colors hover:bg-muted"
                        onClick={() => setAuditEvent(entry)}
                      >
                        <td className={tableCellClass}>
                          <button
                            type="button"
                            onClick={() => setAuditEvent(entry)}
                            className="text-left font-medium text-foreground hover:text-primary"
                          >
                            {auditEventLabel(entry.event_type)}
                          </button>
                          <span className="mt-px block font-mono text-[12px] text-muted-foreground">
                            {Object.entries(entry.detail)
                              .map(([key, value]) => `${key}: ${String(value)}`)
                              .join(" · ")}
                          </span>
                        </td>
                        <td className={tableCellClass}>{entry.actor_name ?? "Sistema"}</td>
                        <td className={tableCellClass}>
                          <StatusPill
                            label={LEVEL_LABEL[entry.level] ?? entry.level}
                            tone={LEVEL_TONE[entry.level] ?? "muted"}
                          />
                        </td>
                        <td
                          className={`${tableCellClass} text-right text-[12.5px] text-muted-foreground`}
                        >
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
              </TableShell>
              <Pagination
                page={audit.data?.page ?? 1}
                pageCount={Math.max(1, Math.ceil((audit.data?.total ?? 0) / PER_PAGE))}
                total={audit.data?.total ?? 0}
                pageSize={PER_PAGE}
                onPageChange={setAuditPage}
                always
              />
            </>
          )}
        </SectionCard>
      )}

      <CasePanel
        key={openId ?? "sin-caso"}
        caseId={openId}
        onClose={() => setOpenId(null)}
        onReply={(id) => {
          const target = items.find((item) => item.id === id);
          setReplyTo(target ? [target] : []);
        }}
      />

      <AuditEventPanel
        key={auditEvent?.id ?? "sin-evento"}
        event={auditEvent}
        schoolName={
          auditEvent?.school_id
            ? (schools.data?.items.find((school) => school.id === auditEvent.school_id)?.name ??
              null)
            : null
        }
        onClose={() => setAuditEvent(null)}
      />

      <CaseComposer
        open={replyTo !== null}
        cases={replyTo ?? []}
        onClose={() => setReplyTo(null)}
      />

      <NewCaseDialog open={newCaseOpen} onClose={() => setNewCaseOpen(false)} />
    </>
  );
}
