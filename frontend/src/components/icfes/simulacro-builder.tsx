import { useMemo, useState } from "react";
import { CheckCircle2, Shuffle, Wand2 } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import {
  ICFES_AREAS,
  ICFES_GRADOS,
  initialQuestions,
  initialSimulacros,
  shuffle,
} from "@/lib/icfes-data";
import type { IcfesArea, IcfesGrado, Simulacro } from "@/lib/icfes-data";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export function SimulacroBuilder() {
  const [simulacros, setSimulacros] = useState<Simulacro[]>(initialSimulacros);
  const [nombre, setNombre] = useState("");
  const [grado, setGrado] = useState<IcfesGrado>("11º");
  const [curso, setCurso] = useState("11º A");
  const [minutos, setMinutos] = useState(90);
  const [desde, setDesde] = useState("2026-08-15");
  const [hasta, setHasta] = useState("2026-08-22");
  const [aleatorizarPreguntas, setAleatorizarPreguntas] = useState(true);
  const [aleatorizarOpciones, setAleatorizarOpciones] = useState(true);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [porArea, setPorArea] = useState<Record<IcfesArea, number>>(
    () => Object.fromEntries(ICFES_AREAS.map((a) => [a, 0])) as Record<IcfesArea, number>,
  );

  const disponibles = useMemo(
    () => initialQuestions.filter((q) => q.grado === grado || true),
    [grado],
  );

  function toggle(id: string) {
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function generarAleatorio() {
    const ids: string[] = [];
    for (const area of ICFES_AREAS) {
      const n = porArea[area] ?? 0;
      if (n <= 0) continue;
      ids.push(
        ...shuffle(initialQuestions.filter((q) => q.area === area).map((q) => q.id)).slice(0, n),
      );
    }
    setSeleccion(ids);
  }

  function crear() {
    setSimulacros((prev) => [
      {
        id: `s${Date.now()}`,
        nombre: nombre || "Simulacro sin título",
        grado,
        curso,
        minutos,
        desde,
        hasta,
        preguntas: seleccion,
        aleatorizarPreguntas,
        aleatorizarOpciones,
        estado: "Programado",
      },
      ...prev,
    ]);
    setNombre("");
    setSeleccion([]);
  }

  return (
    <>
      <PageHeader
        title="Simulacros"
        subtitle="Armá pruebas estilo Saber seleccionando preguntas del banco"
        actions={
          <button
            onClick={crear}
            disabled={seleccion.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" /> Crear simulacro ({seleccion.length})
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <SectionCard title="Configuración" description="Datos generales de la prueba">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nombre del simulacro
              </span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Simulacro Saber 11 · Nº 3"
                className={cn(inputCls, "mt-1.5")}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Grado
                </span>
                <select
                  value={grado}
                  onChange={(e) => setGrado(e.target.value as IcfesGrado)}
                  className={cn(inputCls, "mt-1.5")}
                >
                  {ICFES_GRADOS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Curso
                </span>
                <input
                  value={curso}
                  onChange={(e) => setCurso(e.target.value)}
                  className={cn(inputCls, "mt-1.5")}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tiempo límite (min)
                </span>
                <input
                  type="number"
                  min={5}
                  value={minutos}
                  onChange={(e) => setMinutos(Number(e.target.value))}
                  className={cn(inputCls, "mt-1.5")}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Disponible desde
                </span>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className={cn(inputCls, "mt-1.5")}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Disponible hasta
                </span>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className={cn(inputCls, "mt-1.5")}
                />
              </label>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={aleatorizarPreguntas}
                  onChange={(e) => setAleatorizarPreguntas(e.target.checked)}
                  className="accent-[var(--color-primary)]"
                />
                Aleatorizar orden de preguntas por estudiante
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={aleatorizarOpciones}
                  onChange={(e) => setAleatorizarOpciones(e.target.checked)}
                  className="accent-[var(--color-primary)]"
                />
                Aleatorizar orden de opciones por estudiante
              </label>
            </div>

            <div className="rounded-lg border border-dashed border-border p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Wand2 className="size-4 text-primary" /> Generación aleatoria por área
              </p>
              <div className="mt-3 space-y-2">
                {ICFES_AREAS.map((a) => (
                  <div key={a} className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3">
                    <span className="truncate text-sm text-muted-foreground">{a}</span>
                    <input
                      type="number"
                      min={0}
                      value={porArea[a]}
                      onChange={(e) =>
                        setPorArea((p) => ({ ...p, [a]: Math.max(0, Number(e.target.value)) }))
                      }
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={generarAleatorio}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold hover:bg-muted"
              >
                <Shuffle className="size-3.5" /> Generar selección
              </button>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            title={`Preguntas del banco (${seleccion.length} seleccionadas)`}
            bodyClassName="p-0"
          >
            <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
              {disponibles.map((q) => (
                <li key={q.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-5 py-3.5 hover:bg-muted/60">
                    <input
                      type="checkbox"
                      checked={seleccion.includes(q.id)}
                      onChange={() => toggle(q.id)}
                      className="mt-1 accent-[var(--color-primary)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{q.enunciado}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <StatusBadge tone="info">{q.area}</StatusBadge>
                        <StatusBadge tone="neutral">{q.grado}</StatusBadge>
                        <StatusBadge tone="neutral">{q.dificultad}</StatusBadge>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Simulacros creados" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head-band text-left text-[11px] uppercase tracking-[0.09em]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Nombre</th>
                    <th className="px-5 py-3 font-semibold">Curso</th>
                    <th className="px-5 py-3 font-semibold">Preg.</th>
                    <th className="px-5 py-3 font-semibold">Tiempo</th>
                    <th className="px-5 py-3 font-semibold">Ventana</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {simulacros.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">{s.nombre}</td>
                      <td className="px-5 py-3">{s.curso}</td>
                      <td className="px-5 py-3">{s.preguntas.length}</td>
                      <td className="px-5 py-3">{s.minutos} min</td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                        {s.desde} → {s.hasta}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge
                          tone={
                            s.estado === "Activo"
                              ? "success"
                              : s.estado === "Programado"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {s.estado}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
