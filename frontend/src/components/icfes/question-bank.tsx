import { useMemo, useState } from "react";
import { ImageIcon, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { PageHeader, SectionCard, EmptyHint } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import {
  ICFES_AREAS,
  ICFES_COMPETENCIAS,
  ICFES_DIFICULTADES,
  ICFES_GRADOS,
  initialQuestions,
} from "@/lib/icfes-data";
import type {
  IcfesArea,
  IcfesCompetencia,
  IcfesDificultad,
  IcfesGrado,
  IcfesQuestion,
} from "@/lib/icfes-data";
import { cn } from "@/lib/utils";

const selectCls =
  "min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

function toneForDificultad(d: IcfesDificultad) {
  return d === "Básico" ? "success" : d === "Medio" ? "warning" : "danger";
}

const emptyDraft = (): IcfesQuestion => ({
  id: "",
  enunciado: "",
  lectura: "",
  imagen: "",
  opciones: ["", "", "", ""],
  correcta: 0,
  area: "Lectura crítica",
  grado: "11º",
  dificultad: "Medio",
  competencia: "Interpretativa",
});

export function QuestionBank() {
  const [questions, setQuestions] = useState<IcfesQuestion[]>(initialQuestions);
  const [q, setQ] = useState("");
  const [area, setArea] = useState<string>("");
  const [grado, setGrado] = useState<string>("");
  const [dificultad, setDificultad] = useState<string>("");
  const [competencia, setCompetencia] = useState<string>("");
  const [draft, setDraft] = useState<IcfesQuestion | null>(null);

  const filtered = useMemo(
    () =>
      questions.filter(
        (item) =>
          (!q || item.enunciado.toLowerCase().includes(q.toLowerCase())) &&
          (!area || item.area === area) &&
          (!grado || item.grado === grado) &&
          (!dificultad || item.dificultad === dificultad) &&
          (!competencia || item.competencia === competencia),
      ),
    [questions, q, area, grado, dificultad, competencia],
  );

  function save(item: IcfesQuestion) {
    setQuestions((prev) =>
      item.id
        ? prev.map((p) => (p.id === item.id ? item : p))
        : [{ ...item, id: `q${Date.now()}` }, ...prev],
    );
    setDraft(null);
  }

  return (
    <>
      <PageHeader
        title="Banco de preguntas ICFES"
        subtitle={`${questions.length} preguntas etiquetadas por área, grado, dificultad y competencia`}
        actions={
          <button
            onClick={() => setDraft(emptyDraft())}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Nueva pregunta
          </button>
        }
      />

      <SectionCard title="Filtros" description="Buscá y filtrá el banco por cualquier etiqueta">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 lg:col-span-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar enunciado…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <select className={selectCls} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Todas las áreas</option>
            {ICFES_AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select className={selectCls} value={grado} onChange={(e) => setGrado(e.target.value)}>
            <option value="">Todos los grados</option>
            {ICFES_GRADOS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <select
            className={selectCls}
            value={dificultad}
            onChange={(e) => setDificultad(e.target.value)}
          >
            <option value="">Toda dificultad</option>
            {ICFES_DIFICULTADES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            className={selectCls}
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
          >
            <option value="">Toda competencia</option>
            {ICFES_COMPETENCIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </SectionCard>

      <SectionCard title={`Preguntas (${filtered.length})`} bodyClassName="p-0">
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyHint>No hay preguntas que coincidan con los filtros.</EmptyHint>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((item) => (
              <li key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.enunciado}</p>
                  {item.lectura && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      Lectura asociada: {item.lectura}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone="info">{item.area}</StatusBadge>
                    <StatusBadge tone="neutral">{item.grado}</StatusBadge>
                    <StatusBadge tone={toneForDificultad(item.dificultad)}>
                      {item.dificultad}
                    </StatusBadge>
                    <StatusBadge tone="neutral">{item.competencia}</StatusBadge>
                    {item.imagen && (
                      <StatusBadge tone="neutral">
                        <ImageIcon className="size-3" /> Imagen
                      </StatusBadge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                  <button
                    onClick={() => setDraft({ ...item })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    <Pencil className="size-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => setQuestions((prev) => prev.filter((p) => p.id !== item.id))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive-soft"
                  >
                    <Trash2 className="size-3.5" /> Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {draft && <QuestionModal draft={draft} onClose={() => setDraft(null)} onSave={save} />}
    </>
  );
}

function QuestionModal({
  draft,
  onClose,
  onSave,
}: {
  draft: IcfesQuestion;
  onClose: () => void;
  onSave: (q: IcfesQuestion) => void;
}) {
  const [form, setForm] = useState<IcfesQuestion>(draft);
  const set = <K extends keyof IcfesQuestion>(k: K, v: IcfesQuestion[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 sm:place-items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-lg font-bold">
            {form.id ? "Editar pregunta" : "Nueva pregunta"}
          </h2>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Enunciado">
            <textarea
              value={form.enunciado}
              onChange={(e) => set("enunciado", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Field>
          <Field label="Fragmento de lectura (opcional)">
            <textarea
              value={form.lectura ?? ""}
              onChange={(e) => set("lectura", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Field>
          <Field label="URL de imagen (opcional)">
            <input
              value={form.imagen ?? ""}
              onChange={(e) => set("imagen", e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Field>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Opciones · marcá la correcta
            </p>
            <div className="mt-2 space-y-2">
              {form.opciones.map((op, i) => (
                <label
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2",
                    form.correcta === i ? "border-success bg-success-soft" : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="correcta"
                    checked={form.correcta === i}
                    onChange={() => set("correcta", i as 0 | 1 | 2 | 3)}
                    className="accent-[var(--color-primary)]"
                  />
                  <input
                    value={op}
                    placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                    onChange={(e) => {
                      const next = [...form.opciones] as IcfesQuestion["opciones"];
                      next[i] = e.target.value;
                      set("opciones", next);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Área">
              <select
                className={cn(selectCls, "w-full")}
                value={form.area}
                onChange={(e) => set("area", e.target.value as IcfesArea)}
              >
                {ICFES_AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Grado">
              <select
                className={cn(selectCls, "w-full")}
                value={form.grado}
                onChange={(e) => set("grado", e.target.value as IcfesGrado)}
              >
                {ICFES_GRADOS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Dificultad">
              <select
                className={cn(selectCls, "w-full")}
                value={form.dificultad}
                onChange={(e) => set("dificultad", e.target.value as IcfesDificultad)}
              >
                {ICFES_DIFICULTADES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Competencia">
              <select
                className={cn(selectCls, "w-full")}
                value={form.competencia}
                onChange={(e) => set("competencia", e.target.value as IcfesCompetencia)}
              >
                {ICFES_COMPETENCIAS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.enunciado.trim()}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Guardar pregunta
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
