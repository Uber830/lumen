import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { PageHeader, SectionCard, StatCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { ICFES_AREAS, ICFES_GRADOS, resultadosPorCurso } from "@/lib/icfes-data";
import { exportElementToPdf } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";

const inputCls =
  "min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export function IcfesAggregateResults() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [grado, setGrado] = useState("");
  const [curso, setCurso] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const rows = useMemo(
    () =>
      resultadosPorCurso.filter(
        (r) =>
          (!grado || r.grado === grado) &&
          (!curso || r.curso.toLowerCase().includes(curso.toLowerCase())) &&
          (!desde || r.fecha >= desde) &&
          (!hasta || r.fecha <= hasta),
      ),
    [grado, curso, desde, hasta],
  );

  const promedios = useMemo(
    () =>
      ICFES_AREAS.map((area) => ({
        area,
        corto: area.split(" ")[0],
        promedio: rows.length
          ? Math.round(rows.reduce((acc, r) => acc + r.areas[area], 0) / rows.length)
          : 0,
      })),
    [rows],
  );

  const mejor = [...promedios].sort((a, b) => b.promedio - a.promedio)[0];
  const peor = [...promedios].sort((a, b) => a.promedio - b.promedio)[0];
  const globalProm = rows.length
    ? Math.round(rows.reduce((a, r) => a + r.global, 0) / rows.length)
    : 0;

  return (
    <>
      <PageHeader
        title="Resultados de simulacros"
        subtitle="Comparativa por curso, con promedio y desempeño por área"
        actions={
          <button
            onClick={() =>
              exportElementToPdf(reportRef.current, "Reporte agregado de simulacros ICFES")
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Download className="size-4" /> Exportar a PDF
          </button>
        }
      />

      <SectionCard title="Filtros">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select className={inputCls} value={grado} onChange={(e) => setGrado(e.target.value)}>
            <option value="">Todos los grados</option>
            {ICFES_GRADOS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <input
            className={inputCls}
            placeholder="Curso (ej. 11º A)"
            value={curso}
            onChange={(e) => setCurso(e.target.value)}
          />
          <input
            type="date"
            className={inputCls}
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
          <input
            type="date"
            className={inputCls}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
      </SectionCard>

      <div ref={reportRef} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Cursos evaluados" value={String(rows.length)} />
          <StatCard
            label="Puntaje global promedio"
            value={String(globalProm)}
            delta="Escala 0 – 500"
          />
          <StatCard
            label="Mejor área"
            value={mejor ? `${mejor.promedio}` : "—"}
            delta={mejor?.area}
            tone="success"
          />
          <StatCard
            label="Área más baja"
            value={peor ? `${peor.promedio}` : "—"}
            delta={peor?.area}
            tone="danger"
          />
        </div>

        <SectionCard
          title="Promedio por área"
          description="Promedio de los cursos filtrados (0 – 100)"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={promedios} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis dataKey="corto" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                  }}
                />
                <Bar dataKey="promedio" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Comparativa por curso" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head-band text-left text-[11px] uppercase tracking-[0.09em]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Curso</th>
                  <th className="px-5 py-3 font-semibold">Simulacro</th>
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  <th className="px-5 py-3 font-semibold">Est.</th>
                  {ICFES_AREAS.map((a) => (
                    <th key={a} className="px-5 py-3 font-semibold">
                      {a.split(" ")[0]}
                    </th>
                  ))}
                  <th className="px-5 py-3 font-semibold">Global</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const vals = ICFES_AREAS.map((a) => r.areas[a]);
                  const max = Math.max(...vals);
                  const min = Math.min(...vals);
                  return (
                    <tr key={r.curso + r.simulacro} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">{r.curso}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.simulacro}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                        {r.fecha}
                      </td>
                      <td className="px-5 py-3">{r.estudiantes}</td>
                      {ICFES_AREAS.map((a) => (
                        <td
                          key={a}
                          className={cn(
                            "px-5 py-3 font-medium",
                            r.areas[a] === max && "text-success",
                            r.areas[a] === min && "text-destructive",
                          )}
                        >
                          {r.areas[a]}
                        </td>
                      ))}
                      <td className="px-5 py-3">
                        <StatusBadge tone={r.global >= 300 ? "success" : "warning"}>
                          {r.global}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
