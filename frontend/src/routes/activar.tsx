import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, GraduationCap, KeyRound } from "lucide-react";
import { useState } from "react";

import { activateAccount } from "@/lib/auth/browser";
import { PasswordInput } from "@/components/password-input";

type ActivarSearch = { token: string };

export const Route = createFileRoute("/activar")({
  // The activation link carries the one-time token as ?token=...
  validateSearch: (search: Record<string, unknown>): ActivarSearch => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Activar cuenta — Lumen" },
      {
        name: "description",
        content: "Definí tu contraseña para activar tu cuenta de Lumen.",
      },
      { property: "og:title", content: "Activar cuenta — Lumen" },
      {
        property: "og:description",
        content: "Primer ingreso: establecé tu contraseña y accedé a tu panel.",
      },
    ],
  }),
  component: ActivarPage,
});

function ActivarPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      await activateAccount({ token, password });
      setDone(true);
      // Give the user a moment to read the confirmation, then send
      // them to the login page to sign in with their new password.
      setTimeout(() => void navigate({ to: "/login" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar la cuenta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5 text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" strokeWidth={1.75} />
          </span>
          Lumen
        </Link>

        {!token ? (
          <div className="surface-card p-8 text-center">
            <h1 className="text-xl font-semibold">Enlace inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este enlace de activación no es válido o está incompleto. Pedile a tu administrador
              que te comparta uno nuevo.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Ir a ingresar
            </Link>
          </div>
        ) : done ? (
          <div className="surface-card p-8 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" strokeWidth={1.75} />
            <h1 className="mt-3 text-xl font-semibold">Cuenta activada</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu contraseña quedó lista. Te llevamos a ingresar...
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Activá tu cuenta</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Elegí una contraseña para tu primer ingreso.
            </p>

            <form className="mt-8 space-y-4" onSubmit={onSubmit} aria-busy={submitting}>
              <div>
                <label htmlFor="password" className="text-sm font-medium">
                  Nueva contraseña
                </label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  required
                  disabled={submitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="mt-1.5"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="text-sm font-medium">
                  Repetí la contraseña
                </label>
                <PasswordInput
                  id="confirm"
                  autoComplete="new-password"
                  required
                  disabled={submitting}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5"
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
                <KeyRound className="size-4" /> {submitting ? "Activando..." : "Activar cuenta"}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              ¿Ya tenés contraseña?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Ingresá acá
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
