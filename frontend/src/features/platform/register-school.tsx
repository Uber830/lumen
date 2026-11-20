import { AlertTriangle, Check, Info } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { useCatalogOptions, useRegisterSchool } from "@/lib/platform/hooks";
import type { RegisteredSchool } from "@/lib/platform/types";

/**
 * The registration of a school.
 *
 * The platform team says who is in the network: the name of the
 * institution, its city and the administrator who will run it. The
 * grades, the students and the teachers are reported by the school
 * itself, from its own panel.
 *
 * The administrator's account is born without a password: the answer
 * carries the activation link that is shared with the school.
 */
export function RegisterSchool({ open, onClose }: { open: boolean; onClose: () => void }) {
  const options = useCatalogOptions();
  const register = useRegisterSchool();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [code, setCode] = useState("");
  const [plan, setPlan] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [created, setCreated] = useState<RegisteredSchool | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const plans = options.data?.plans ?? [];
  const selectedPlan = plan || plans[0]?.code || "";

  function reset() {
    setName("");
    setCity("");
    setCode("");
    setPlan("");
    setAdminName("");
    setAdminEmail("");
    setCreated(null);
    setProblem(null);
    register.reset();
  }

  async function onSubmit() {
    if (!name.trim() || !adminName.trim() || !adminEmail.trim() || !selectedPlan) {
      setProblem("Completa el nombre del colegio y los datos de su administrador.");
      return;
    }
    setProblem(null);
    try {
      const school = await register.mutateAsync({
        school_name: name.trim(),
        short_code: (code.trim() || name.trim()).slice(0, 16),
        plan_code: selectedPlan,
        admin_email: adminEmail.trim(),
        admin_name: adminName.trim(),
        city: city.trim() || null,
      });
      setCreated(school);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo registrar el colegio.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar colegio</DialogTitle>
          <DialogDescription>
            La institución entra a la plataforma con el catálogo completo y sin acceso a material
            hasta que se le habilite.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-xs text-success">
              <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
              <span>
                El colegio quedó registrado. Comparte este enlace de activación con{" "}
                {created.admin_email}: es lo que le da acceso al primer inicio de sesión.
              </span>
            </p>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
              <code className="code-cell break-all text-xs">{created.activation_token}</code>
            </div>
            <p className="text-xs text-muted-foreground">
              El enlace vence el{" "}
              {new Date(created.activation_expires_at).toLocaleString("es-CO", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium">Nombre del colegio *</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Colegio o instituto"
                className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium">Ciudad</span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Bogotá"
                className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium">Código corto</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Se toma del nombre"
                className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium">Plan</span>
              <select
                value={selectedPlan}
                onChange={(event) => setPlan(event.target.value)}
                className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm"
              >
                {plans.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium">Nombre del administrador *</span>
              <input
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
                placeholder="Nombre y apellidos"
                className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
              />
            </label>

            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium">Correo del administrador *</span>
              <input
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="coordinacion@colegio.edu.co"
                className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
              />
            </label>

            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
              <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
              <span>
                Los grados, los estudiantes y los docentes los reporta el colegio desde su panel.
                Acá solo se registra quién es.
              </span>
            </p>

            {problem && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs text-destructive sm:col-span-2"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                {problem}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold hover:bg-muted"
          >
            {created ? "Cerrar" : "Cancelar"}
          </button>
          {!created && (
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={register.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <Check className="size-4" strokeWidth={1.9} aria-hidden />
              Registrar colegio
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
