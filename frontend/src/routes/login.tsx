import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogIn } from "lucide-react";
import { useState } from "react";

import { signIn } from "@/lib/auth/browser";
import type { SessionInfo } from "@/lib/api/types";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Where to send the user after signing in, based on their role.
 *
 * The landing page ("/") is public and looks the same signed in or
 * out, so redirecting there made a successful login look like it did
 * nothing. We send the user to their panel instead.
 */
function destinationForSession(session: SessionInfo): string {
  if (session.platform_role === "platform_admin") return "/super";
  const roles = new Set(session.memberships.map((m) => m.role));
  if (roles.has("school_admin")) return "/admin";
  if (roles.has("teacher")) return "/docente";
  if (roles.has("student")) return "/estudiante";
  // No memberships yet (e.g. a brand-new account): leave them on the
  // landing so they can register a school.
  return "/";
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Ingresar — Lumen" },
      {
        name: "description",
        content: "Accedé a tu colegio en Lumen como admin, docente o estudiante.",
      },
      { property: "og:title", content: "Ingresar — Lumen" },
      {
        property: "og:description",
        content: "Acceso unificado para administradores, docentes y estudiantes.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const session = await signIn({ email: email.trim(), password });
      await navigate({ to: destinationForSession(session) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2.5 text-lg font-bold">
          <GraduationCap className="size-6" strokeWidth={1.75} /> Lumen
        </Link>
        <div>
          <p className="text-3xl font-bold leading-snug">
            Una sola puerta de entrada para toda la comunidad educativa.
          </p>
          <p className="mt-4 max-w-md text-sm opacity-85">
            Detectamos automaticamente tu rol y te llevamos al panel correspondiente.
          </p>
        </div>
        <p className="text-xs opacity-70">© 2026 Lumen</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2.5 text-lg font-bold lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-5" strokeWidth={1.75} />
            </span>
            Lumen
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Ingresar</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Usa tu correo institucional para acceder.
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit} aria-busy={submitting}>
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Correo institucional
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={submitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@colegio.edu"
                className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={submitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="size-4" /> {submitting ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <p className="mt-8 text-sm text-muted-foreground">
            ¿Tu colegio todavia no esta?{" "}
            <Link to="/registro" className="font-semibold text-primary hover:underline">
              Regístralo acá
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
