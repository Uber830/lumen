import { createFileRoute } from "@tanstack/react-router";
import { Building2, DollarSign, LineChart, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, SectionCard, StatCard } from "@/components/ui-kit";
import { StatusBadge, toneForEstado } from "@/components/status-badge";
import { mrrTrend, schoolsTable } from "@/lib/edu-data";

export const Route = createFileRoute("/super/")({
  head: () => ({
    meta: [
      { title: "Panel de plataforma — Lumen" },
      {
        name: "description",
        content: "Métricas globales de Lumen: colegios activos, MRR y uso por módulo.",
      },
      { property: "og:title", content: "Panel de plataforma — Lumen" },
      {
        property: "og:description",
        content: "Vista de negocio de la plataforma, sin acceso a datos académicos.",
      },
    ],
  }),
  component: SuperDashboard,
});

const usage = [
  { modulo: "Evaluaciones", pct: 87 },
  { modulo: "Calificaciones", pct: 94 },
  { modulo: "Chat interno", pct: 62 },
  { modulo: "Contenidos", pct: 78 },
];

function SuperDashboard() {
  return (
    <>
      <PageHeader title="Plataforma Lumen" subtitle="Métricas globales · Julio 2026" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Colegios activos" value="128" delta="+9 este mes" icon={Building2} />
        <StatCard
          label="En trial"
          value="17"
          delta="Conversión 41%"
          icon={TrendingUp}
          tone="warning"
        />
        <StatCard
          label="Suspendidos"
          value="4"
          delta="Pago vencido"
          icon={LineChart}
          tone="danger"
        />
        <StatCard label="MRR" value="$68.900" delta="+12,2% MoM" icon={DollarSign} tone="success" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          title="Crecimiento de ingresos"
          description="MRR de los últimos 6 meses"
          className="lg:col-span-2"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrrTrend} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gMrr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  fill="url(#gMrr)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Uso por módulo" description="% de colegios que lo usan semanalmente">
          <ul className="space-y-4">
            {usage.map((u) => (
              <li key={u.modulo}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{u.modulo}</span>
                  <span className="text-muted-foreground">{u.pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${u.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Colegios"
        description="Estado de suscripción y plan contratado"
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Colegio</th>
                <th className="px-5 py-3 font-semibold">Plan</th>
                <th className="px-5 py-3 font-semibold">Alumnos</th>
                <th className="px-5 py-3 font-semibold">Alta</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {schoolsTable.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-5 py-3">{s.plan}</td>
                  <td className="px-5 py-3">{s.alumnos.toLocaleString("es-AR")}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.alta}</td>
                  <td className="px-5 py-3">
                    <StatusBadge tone={toneForEstado(s.estado)}>{s.estado}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
