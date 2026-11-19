import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { plans } from "@/lib/edu-data";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen — Plataforma de gestión académica para colegios" },
      {
        name: "description",
        content:
          "Lumen centraliza estudiantes, docentes, cursos, evaluaciones y calificaciones en una plataforma multi-colegio con planes desde $49.",
      },
      { property: "og:title", content: "Lumen — Gestión académica para colegios" },
      {
        property: "og:description",
        content: "Multi-colegio, roles diferenciados y todo el ciclo académico en un solo lugar.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Users,
    title: "Gestión de personas",
    desc: "Docentes, estudiantes y administradores con altas masivas por CSV.",
  },
  {
    icon: BookOpen,
    title: "Cursos y materias",
    desc: "Estructura académica flexible con períodos configurables.",
  },
  {
    icon: BarChart3,
    title: "Calificaciones",
    desc: "Grilla editable por materia y período, con reportes automáticos.",
  },
  {
    icon: MessageSquare,
    title: "Comunicación",
    desc: "Chat interno entre administración, docentes y estudiantes.",
  },
  {
    icon: ShieldCheck,
    title: "Datos aislados",
    desc: "Cada colegio con su instancia; la plataforma solo ve métricas.",
  },
  {
    icon: Sparkles,
    title: "Marca propia",
    desc: "Logo, colores y nombre visible personalizados por institución.",
  },
];

const roles = [
  { to: "/super", label: "Super Admin", desc: "Métricas globales, colegios y planes" },
  {
    to: "/admin",
    label: "Admin de colegio",
    desc: "Docentes, estudiantes, cursos y configuración",
  },
  { to: "/docente", label: "Docente", desc: "Materias, evaluaciones y calificaciones" },
  { to: "/estudiante", label: "Estudiante", desc: "Clases, tareas, exámenes y notas" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-5" strokeWidth={1.75} />
            </span>
            <span className="truncate text-lg font-bold tracking-tight">Lumen</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link
              to="/login"
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Ingresar
            </Link>
            <Link
              to="/registro"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
            >
              Registrar colegio
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" /> Plataforma multi-colegio
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl">
              Toda la gestión académica de tu colegio, en un solo lugar
            </h1>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Lumen conecta administración, docentes y estudiantes: cursos, materias, evaluaciones,
              tareas, calificaciones y comunicación interna con la seguridad de una instancia propia
              por institución.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/registro"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
              >
                Empezar prueba de 30 días <ArrowRight className="size-4" />
              </Link>
              <a
                href="#planes"
                className="inline-flex items-center rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-muted"
              >
                Ver planes
              </a>
            </div>
          </div>

          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="surface-card group p-5 transition-shadow hover:shadow-lift"
              >
                <p className="flex items-center justify-between text-sm font-semibold">
                  {r.label}
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">{r.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Un módulo para cada parte del ciclo académico
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="rounded-xl border border-border p-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <f.icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="planes" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Planes por institución
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Precios mensuales por colegio. Sin costo por docente. Cancelá cuando quieras.
            </p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={cn(
                  "surface-card flex flex-col p-6",
                  p.highlight && "ring-2 ring-primary shadow-lift",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  {p.highlight && (
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                      Más elegido
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                <p className="mt-5 text-4xl font-extrabold tracking-tight">
                  {p.price}
                  <span className="text-sm font-medium text-muted-foreground">/mes</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.25} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/registro"
                  className={cn(
                    "mt-6 inline-flex justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                    p.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border bg-card hover:bg-muted",
                  )}
                >
                  Elegir {p.name}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>© 2026 Lumen. Gestión académica para colegios.</p>
          <Link to="/login" className="font-semibold text-foreground hover:underline">
            Ingresar a mi colegio
          </Link>
        </div>
      </footer>
    </div>
  );
}
