import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { StatusBadge, toneForEstado } from "@/components/status-badge";
import { schoolsTable } from "@/lib/edu-data";

export const Route = createFileRoute("/super/colegios")({
  head: () => ({
    meta: [
      { title: "Colegios — Lumen Platform" },
      {
        name: "description",
        content: "Listado de instituciones con plan, estado de suscripción y uso.",
      },
      { property: "og:title", content: "Colegios — Lumen Platform" },
      {
        property: "og:description",
        content: "Administración de las instituciones de la plataforma.",
      },
    ],
  }),
  component: Colegios,
});

function Colegios() {
  return (
    <>
      <PageHeader title="Colegios" subtitle="149 instituciones registradas" />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              placeholder="Buscar colegio"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <select className="rounded-lg border border-input bg-card px-3 py-2 text-sm">
            <option>Todos los planes</option>
            <option>Básico</option>
            <option>Estándar</option>
            <option>Premium</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Colegio</th>
                <th className="px-5 py-3 font-semibold">Plan</th>
                <th className="px-5 py-3 font-semibold">Alumnos</th>
                <th className="px-5 py-3 font-semibold">Alta</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 text-right font-semibold">Uso</th>
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
                  <td className="px-5 py-3 text-right">
                    <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft">
                      Ver métricas
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          La plataforma solo accede a métricas de uso. Los datos académicos de cada colegio
          permanecen aislados.
        </p>
      </SectionCard>
    </>
  );
}
