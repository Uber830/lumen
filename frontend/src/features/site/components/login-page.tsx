// =============================================================================
// The login of the public site.
// -----------------------------------------------------------------------------
// Same direction visual as the landing: paper, hairline borders,
// monospaced labels, rectangular buttons.
//
// The left column shows a miniature of the index. Its rows are
// illustrative, not real customers: a public screen cannot publish the
// list of client schools.
//
// The form knows six states —rest, sending, wrong credentials, locked
// account, rate limit and network error— and every one of them is
// readable without relying on the colour.
// =============================================================================

import { useEffect, useId, useMemo, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { signIn } from "@/lib/auth/browser";
import type { SessionInfo } from "@/lib/api/types";
import { isValidEmail } from "../destination";
import { SiteThemeToggle } from "./site-theme-toggle";
import { CheckMark, SiteLogo, SpecPanel } from "./ui";

/** The rows of the miniature index. Illustrative data, on purpose. */
const SAMPLE_INDEX = [
  { school: "Colegio Alfa", plan: "Cobertura media", state: "Habilitado" },
  { school: "Colegio Beta", plan: "Cobertura completa", state: "Habilitado" },
  { school: "Colegio Gamma", plan: "Cobertura básica", state: "Habilitado" },
  { school: "Colegio Delta", plan: "Cobertura completa", state: "Habilitado" },
];

type FormState =
  | { kind: "rest" }
  | { kind: "sending" }
  | { kind: "error"; message: string; retryable: boolean }
  | { kind: "locked"; message: string }
  | { kind: "rate-limited"; message: string; secondsLeft: number };

export function LoginPage({
  onSignedIn,
  contactEmail,
}: {
  onSignedIn: (session: SessionInfo) => void | Promise<void>;
  contactEmail: string;
}) {
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<FormState>({ kind: "rest" });

  const emailValid = isValidEmail(email);
  const sending = state.kind === "sending";

  // The countdown of the rate limit.
  useEffect(() => {
    if (state.kind !== "rate-limited") return;
    if (state.secondsLeft <= 0) return;

    const timer = setTimeout(() => {
      setState((current) =>
        current.kind === "rate-limited"
          ? { ...current, secondsLeft: current.secondsLeft - 1 }
          : current,
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  const message = useMemo(() => {
    if (state.kind === "error" || state.kind === "locked" || state.kind === "rate-limited") {
      return state.message;
    }
    return null;
  }, [state]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !emailValid) return;

    setState({ kind: "sending" });

    try {
      const session = await signIn({ email: email.trim(), password, remember_me: rememberMe });
      await onSignedIn(session);
    } catch (error) {
      setState(toFormState(error));
    }
  }

  return (
    <div className="idx-site min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[42fr_58fr]">
        {/* --- The left column: what is waiting for you --- */}
        <aside className="flex flex-col justify-between border-b border-line bg-paper px-5 py-10 sm:px-10 lg:border-r lg:border-b-0 lg:py-14">
          <div>
            <div className="flex items-center justify-between gap-4">
              <a
                href="/"
                className="inline-flex items-center gap-2.5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <SiteLogo className="text-ink" />
                <span className="text-[17px] font-bold tracking-[-0.02em]">Lumen</span>
              </a>
              <SiteThemeToggle compact />
            </div>

            <p className="mt-12 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
              IDX-000 / Acceso
            </p>
            <h1 className="mt-5 max-w-[16ch] text-[30px] leading-[1.1] font-bold tracking-[-0.04em] text-ink sm:text-[38px]">
              Su colegio ya tiene el material cargado.
            </h1>
            <p className="mt-4 max-w-[38ch] text-[15px] leading-relaxed text-ink-2">
              Todo el material habilitado para su institución, en el mismo lugar.
            </p>

            {/* A miniature of the index. The rows are illustrative. */}
            <div className="mt-10">
              <table className="w-full max-w-[420px] border-collapse text-left">
                <caption className="sr-only">
                  Ejemplo del índice de material habilitado por colegio
                </caption>
                <thead>
                  <tr className="bg-[var(--head-bg)] text-[var(--head-fg)]">
                    <th
                      scope="col"
                      className="px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em]"
                    >
                      Colegio
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em]"
                    >
                      Plan
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em]"
                    >
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_INDEX.map((row) => (
                    <tr key={row.school} className="border-b border-line">
                      <td className="px-3 py-2.5 text-[13px] text-ink">{row.school}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-ink-3">{row.plan}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ok-fg)]">
                          <CheckMark />
                          {row.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-12 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
            Lumen · Bogotá, Colombia
          </p>
        </aside>

        {/* --- The right column: the form --- */}
        <main className="relative z-10 flex items-center justify-center px-5 py-14 sm:px-10">
          <div className="w-full max-w-[420px]">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">Acceso</p>
            <h2 className="mt-4 text-[30px] leading-tight font-bold tracking-[-0.035em] text-ink">
              Iniciar sesión
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Use el correo institucional con el que su colegio fue registrado.
            </p>

            <form className="mt-9" onSubmit={onSubmit} aria-busy={sending} noValidate>
              <div>
                <label
                  htmlFor={emailId}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2"
                >
                  Correo institucional
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  required
                  disabled={sending}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@colegio.edu.co"
                  aria-invalid={message ? true : undefined}
                  aria-describedby={message ? errorId : undefined}
                  className="mt-2 w-full rounded-idx border border-line-2 bg-bg px-3.5 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
                />
              </div>

              <div className="mt-5">
                <label
                  htmlFor={passwordId}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2"
                >
                  Contraseña
                </label>
                <div className="relative mt-2">
                  <input
                    id={passwordId}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={sending}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    aria-invalid={message ? true : undefined}
                    aria-describedby={message ? errorId : undefined}
                    className="w-full rounded-idx border border-line-2 bg-bg px-3.5 py-3 pr-12 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                  >
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-[14px] text-ink-2">
                  <input
                    type="checkbox"
                    name="remember_me"
                    checked={rememberMe}
                    disabled={sending}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="size-4 rounded-idx border border-line-2 accent-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  />
                  Recordarme en este equipo
                </label>
                <a
                  href={`mailto:${contactEmail}?subject=Restablecer%20contrase%C3%B1a`}
                  className="text-[14px] text-ink-2 underline underline-offset-4 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  ¿Olvidó su contraseña?
                </a>
              </div>

              {message && (
                <div
                  id={errorId}
                  role="alert"
                  aria-live="polite"
                  className="mt-5 border border-[var(--bad-line)] bg-[var(--bad-bg)] px-4 py-3"
                >
                  <p className="text-[14px] leading-relaxed text-[var(--bad-fg)]">{message}</p>
                  {state.kind === "rate-limited" && (
                    <p className="mt-1 font-mono text-[12px] text-[var(--bad-fg)]">
                      {state.secondsLeft > 0
                        ? `Intente de nuevo en ${formatSeconds(state.secondsLeft)}.`
                        : "Ya puede intentarlo de nuevo."}
                    </p>
                  )}
                  {state.kind === "error" && state.retryable && (
                    <button
                      type="button"
                      onClick={() => setState({ kind: "rest" })}
                      className="mt-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--bad-fg)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  !emailValid || sending || (state.kind === "rate-limited" && state.secondsLeft > 0)
                }
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-idx bg-ink px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--on-ink)] transition-colors hover:bg-[var(--ink-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Entrando…" : "Entrar"}
              </button>
            </form>

            <SpecPanel className="mt-8">
              <p className="px-5 py-4 text-[14px] leading-relaxed text-ink-2">
                ¿Su colegio todavía no está registrado?{" "}
                <a
                  href={`mailto:${contactEmail}?subject=Solicitud%20de%20acceso`}
                  className="text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  Solicite su acceso
                </a>{" "}
                y el equipo de Lumen deja el catálogo listo para usted.
              </p>
            </SpecPanel>

            <div className="mt-8 flex flex-col gap-2 text-[14px] text-ink-2">
              <p>
                ¿Busca el sitio institucional?{" "}
                <a
                  href="/"
                  className="text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  Volver al inicio
                </a>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * The state a failed sign-in leaves the form in.
 *
 * The message never says whether the email exists: a login that
 * answers "no such account" is an account enumerator.
 */
function toFormState(error: unknown): FormState {
  const apiError = error instanceof ApiError ? error : findApiError(error);

  if (!apiError) {
    return {
      kind: "error",
      message: "No pudimos conectar con el servidor. Intenta de nuevo.",
      retryable: true,
    };
  }

  if (apiError.status === 401) {
    return { kind: "error", message: "El correo o la contraseña no coinciden.", retryable: false };
  }

  if (apiError.status === 423) {
    return {
      kind: "locked",
      message: "La cuenta está bloqueada. Contacta a la coordinación de tu colegio.",
    };
  }

  if (apiError.status === 429) {
    const retryAfter = readRetryAfter(apiError);
    const minutes = Math.max(1, Math.ceil(retryAfter / 60));
    return {
      kind: "rate-limited",
      message: `Demasiados intentos. Intenta de nuevo en ${minutes} ${
        minutes === 1 ? "minuto" : "minutos"
      }.`,
      secondsLeft: retryAfter,
    };
  }

  if (apiError.status >= 500) {
    return {
      kind: "error",
      message: "No pudimos conectar con el servidor. Intenta de nuevo.",
      retryable: true,
    };
  }

  return {
    kind: "error",
    message: "No pudimos iniciar sesión. Intenta de nuevo.",
    retryable: false,
  };
}

/** The API error, even when it arrives wrapped in another error. */
function findApiError(error: unknown): ApiError | null {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && error.cause instanceof ApiError) return error.cause;
  return null;
}

/** How many seconds the caller has to wait, when the API says so. */
function readRetryAfter(error: ApiError): number {
  const body = error.body as { retry_after?: unknown } | null;
  if (body && typeof body.retry_after === "number") return body.retry_after;
  return 60;
}

/** Seconds, as minutes and seconds. */
function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return `${minutes} min ${rest.toString().padStart(2, "0")} s`;
}

/** The eye of the password field. */
function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className="size-[18px]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {visible ? (
        <>
          <path
            d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3.5 16.5l13-13" stroke="currentColor" strokeWidth="1.4" />
        </>
      ) : (
        <>
          <path
            d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
        </>
      )}
    </svg>
  );
}
