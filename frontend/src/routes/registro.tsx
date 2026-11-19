import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, GraduationCap, Sparkles } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { signUpSchool, type BootstrapSchoolResult } from "@/lib/auth/signup";
import { generatePassword } from "@/lib/auth/password";
import { PasswordInput } from "@/components/password-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { PLAN_CODE_TO_DISPLAY, TRIAL_DAYS, type SignupFormValues } from "@/lib/schemas/signup";

export const Route = createFileRoute("/registro")({
  head: () => ({
    meta: [
      { title: "Registrar colegio — Lumen" },
      {
        name: "description",
        content: "Crea la instancia de tu colegio en Lumen con 30 dias de prueba.",
      },
      { property: "og:title", content: "Registrar colegio — Lumen" },
      {
        property: "og:description",
        content: "Alta de institucion con seleccion de plan y prueba de 30 dias.",
      },
    ],
  }),
  component: Registro,
});

const STEPS = ["Datos del colegio", "Administrador", "Plan"] as const;

type PlanOption = {
  code: SignupFormValues["planCode"];
  name: string;
  price: string;
  blurb: string;
  features: readonly string[];
  highlight?: boolean;
};

const PLAN_OPTIONS: readonly PlanOption[] = [
  {
    code: "basico",
    name: "Basico",
    price: "$49/mes",
    blurb: "Para colegios pequenos que empiezan a digitalizarse.",
    features: [
      "Hasta 200 estudiantes",
      "15 docentes",
      "Cursos y materias",
      "Calificaciones",
      "Soporte por email",
    ],
  },
  {
    code: "estandar",
    name: "Estandar",
    price: "$129/mes",
    blurb: "El plan mas elegido por instituciones en crecimiento.",
    features: [
      "Hasta 1.500 estudiantes",
      "Docentes ilimitados",
      "Evaluaciones online",
      "Simulacros ICFES",
      "Chat interno",
      "Personalizacion de marca",
    ],
    highlight: true,
  },
  {
    code: "premium",
    name: "Premium",
    price: "$299/mes",
    blurb: "Para redes educativas con multiples sedes.",
    features: [
      "Estudiantes ilimitados",
      "Multiples sedes",
      "Simulacros ICFES",
      "Reportes avanzados",
      "Integraciones y API",
      "SLA 99.9%",
    ],
  },
];

function slugifyShortCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16);
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
function Registro() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [schoolName, setSchoolName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [shortCodeTouched, setShortCodeTouched] = useState(false);

  const [adminFullName, setAdminFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [planCode, setPlanCode] = useState<SignupFormValues["planCode"]>("estandar");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BootstrapSchoolResult | null>(null);

  const effectiveShortCode = shortCodeTouched ? shortCode : slugifyShortCode(schoolName);

  function onGeneratePassword() {
    const next = generatePassword();
    setPassword(next);
    setPasswordConfirm(next);
  }

  const stepValid = (() => {
    if (step === 0) {
      return schoolName.trim().length >= 2 && /^[A-Za-z0-9-]+$/.test(effectiveShortCode);
    }
    if (step === 1) {
      return (
        adminFullName.trim().length >= 2 &&
        /.+@.+\..+/.test(email) &&
        password.length >= 8 &&
        password === passwordConfirm
      );
    }
    return acceptTerms && !!planCode;
  })();
  function onNext() {
    if (!stepValid) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function onBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function onSubmit() {
    if (!stepValid || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: SignupFormValues = {
        schoolName: schoolName.trim(),
        shortCode: effectiveShortCode,
        adminFullName: adminFullName.trim(),
        email: email.trim(),
        password,
        planCode,
        acceptTerms,
      };
      const result = await signUpSchool(payload);
      setSuccess(result);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="surface-card w-full max-w-md p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">Tu colegio esta creado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Activamos {TRIAL_DAYS} dias de prueba en el plan{" "}
            <strong>{PLAN_CODE_TO_DISPLAY[planCode]}</strong>. Te llevamos al panel de
            administracion.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/admin" })}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Ir al panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-2.5 px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-bold">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-5" strokeWidth={1.75} />
            </span>
            Lumen
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Registrá tu colegio</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {TRIAL_DAYS} dias de prueba sin tarjeta. Configuralo en menos de 5 minutos.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium",
                i === step
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                  i < step
                    ? "bg-success text-success-foreground"
                    : i === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="truncate">{s}</span>
            </li>
          ))}
        </ol>

        <div className="surface-card mt-6 p-6">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre del colegio"
                htmlFor="school-name"
                error={
                  schoolName.length > 0 && schoolName.trim().length < 2
                    ? "Minimo 2 caracteres."
                    : undefined
                }
              >
                <input
                  id="school-name"
                  name="schoolName"
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Colegio San Martin"
                  className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field
                label="Codigo corto (unico)"
                htmlFor="short-code"
                error={
                  shortCodeTouched && !/^[A-Za-z0-9-]+$/.test(effectiveShortCode)
                    ? "Solo letras, numeros y guiones."
                    : undefined
                }
              >
                <input
                  id="short-code"
                  name="shortCode"
                  type="text"
                  required
                  value={effectiveShortCode}
                  onChange={(e) => {
                    setShortCode(e.target.value);
                    setShortCodeTouched(true);
                  }}
                  placeholder="csm"
                  className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tu nombre completo" htmlFor="admin-name">
                <input
                  id="admin-name"
                  name="adminFullName"
                  type="text"
                  required
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="Ricardo Lema"
                  className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="Correo institucional" htmlFor="admin-email">
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@csm.edu"
                  className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field
                label="Contraseña"
                htmlFor="admin-password"
                error={
                  password.length > 0 && password.length < 8 ? "Minimo 8 caracteres." : undefined
                }
              >
                <PasswordInput
                  id="admin-password"
                  name="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                />
              </Field>
              <Field
                label={
                  <span className="flex items-center justify-between gap-2">
                    <span>Repetir contrasena</span>
                    <button
                      type="button"
                      onClick={onGeneratePassword}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Sparkles className="size-3.5" strokeWidth={1.75} aria-hidden />
                      Generar
                    </button>
                  </span>
                }
                htmlFor="admin-password-confirm"
                error={
                  passwordConfirm.length > 0 && password !== passwordConfirm
                    ? "No coincide."
                    : undefined
                }
              >
                <PasswordInput
                  id="admin-password-confirm"
                  name="passwordConfirm"
                  autoComplete="new-password"
                  required
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="********"
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                {PLAN_OPTIONS.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => setPlanCode(p.code)}
                    className={cn(
                      "rounded-xl border p-5 text-left transition-shadow",
                      planCode === p.code
                        ? "border-primary ring-2 ring-primary"
                        : "border-border hover:shadow-card",
                    )}
                  >
                    <p className="text-base font-bold">{p.name}</p>
                    <p className="mt-1 text-2xl font-extrabold">{p.price}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{p.blurb}</p>
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                />
                <span>
                  Acepto los terminos del servicio y la politica de privacidad. Entiendo que durante
                  los primeros {TRIAL_DAYS} dias no se realizara ningun cobro.
                </span>
              </label>
              <p className="rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
                No se realizara ningun cobro durante los primeros {TRIAL_DAYS} dias. Cuando decidas
                pagar, lo haras a traves de Wompi desde el panel.
              </p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={onBack}
              disabled={step === 0 || submitting}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              Atras
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={onNext}
                disabled={!stepValid}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!stepValid || submitting}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Creando..." : "Crear colegio"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function extractError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: string }).message;
    if (message.includes("correo de confirmacion")) {
      return "No se pudo enviar el correo de confirmacion. Verifica la configuracion del servidor.";
    }
    if (message.toLowerCase().includes("already") || message.toLowerCase().includes("registrad")) {
      return "Ya existe una cuenta con ese correo. Inicia sesion.";
    }
    return message;
  }
  return "No se pudo crear el colegio. Intentalo de nuevo.";
}
