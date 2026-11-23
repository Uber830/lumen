import { createFileRoute, useRouteContext, useRouter } from "@tanstack/react-router";
import { Check, Copy, Loader2, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PageHeader, SectionCard } from "@/components/ui-kit";
import { PasswordInput } from "@/components/password-input";
import { generatePassword } from "@/lib/auth/password";
import { getCurrentSession, updateProfile, type SessionContext } from "@/lib/auth/functions";
import { ProfileNav } from "@/features/profile/profile-nav";
import { AvatarUploadError, uploadAvatar } from "@/lib/profile/upload";
import { fileUrl } from "@/lib/storage/files";

export const Route = createFileRoute("/perfil/")({
  head: () => ({
    meta: [
      { title: "Mi perfil — Lumen" },
      {
        name: "description",
        content: "Editá tus datos personales, contacto y preferencias de notificaciones.",
      },
      { property: "og:title", content: "Mi perfil — Lumen" },
      {
        property: "og:description",
        content: "Datos personales y preferencias de la cuenta en Lumen.",
      },
    ],
  }),
  component: Perfil,
});

function Field({
  label,
  value,
  onChange,
  htmlFor,
  type = "text",
  readOnly = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (next: string) => void;
  htmlFor?: string;
  type?: "text" | "email" | "tel" | "password";
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={htmlFor}
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring read-only:bg-muted read-only:text-muted-foreground"
      />
    </div>
  );
}

function PasswordFieldWithActions({
  id,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [justCopied, setJustCopied] = useState(false);

  function onGenerate() {
    onChange(generatePassword());
  }

  async function onCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setJustCopied(true);
      window.setTimeout(() => setJustCopied(false), 1500);
    } catch {
      // Clipboard access can fail if the document is not focused
      // (e.g. the user just opened DevTools). Swallow — the user
      // can still copy by selecting the input manually.
    }
  }

  return (
    <div>
      <label htmlFor={id} className="flex items-center justify-between gap-2 text-sm font-medium">
        <span>Nueva contrasena</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onGenerate}
            aria-label="Generar contrasena aleatoria"
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} aria-hidden />
            Generar
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={!value}
            aria-label={
              justCopied
                ? "Contraseña copiada al portapapeles"
                : "Copiar contrasena al portapapeles"
            }
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {justCopied ? (
              <>
                <Check className="size-3.5" strokeWidth={2} aria-hidden />
                Copiado
              </>
            ) : (
              <>
                <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
                Copiar
              </>
            )}
          </button>
        </div>
      </label>
      <PasswordInput
        id={id}
        name={name}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function AvatarField({
  userId,
  avatarUrl,
  displayName,
  onUploaded,
}: {
  userId: string;
  avatarUrl: string | null;
  displayName: string;
  onUploaded: (newUrl: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(fileUrl(avatarUrl));
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";

  async function onPick(file: File) {
    setErrorMsg(null);
    setUploading(true);
    try {
      const result = await uploadAvatar(userId, file, localUrl);
      // The API answers with the path of the file; the browser needs
      // the address the API serves it under.
      setLocalUrl(fileUrl(result.avatarUrl));
      onUploaded(result.avatarUrl);
    } catch (err) {
      if (err instanceof AvatarUploadError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err instanceof Error ? err.message : "No se pudo subir la imagen.");
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative">
        {localUrl ? (
          <img
            src={localUrl}
            alt={`Foto de perfil de ${displayName}`}
            className="size-24 shrink-0 rounded-idx object-cover ring-1 ring-border"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-24 shrink-0 place-items-center rounded-idx bg-primary-soft text-2xl font-bold text-primary"
          >
            {initials}
          </span>
        )}
        {uploading && (
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center rounded-idx bg-card/70"
          >
            <Loader2 className="size-5 animate-spin text-primary" />
          </span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label="Subir foto de perfil"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
          // Reset so picking the same file again still triggers change.
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Upload className="size-4" strokeWidth={1.75} aria-hidden />
        {uploading ? "Subiendo..." : localUrl ? "Cambiar foto" : "Subir foto"}
      </button>
      {errorMsg && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Turn a save failure into a message the user can act on. */
function saveErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  // The backend sends "A user with that email already exists." (409)
  // via the server function's thrown error; show a Spanish message.
  if (/already exists/i.test(raw) || /ya existe/i.test(raw)) {
    return "Ese correo ya está en uso por otra cuenta.";
  }
  return raw || "No se pudieron guardar los cambios.";
}

function Perfil() {
  // The session is already loaded by the parent /perfil route's
  // beforeLoad. Pull it through the router context to know the user id
  // and the current avatar URL without an extra round-trip.
  const { session } = useRouteContext({ from: "/perfil" });
  const router = useRouter();

  // Form state — controlled inputs. Initialised exactly once from
  // the route context snapshot, never from refreshSession() so the
  // user's in-flight edits are not clobbered when an upload or save
  // triggers a re-fetch. After onSave, refreshSession() updates the
  // *snapshot* used for the avatar and the page title; the typed
  // values are written by the form itself.
  const [fullName, setFullName] = useState<string>(() => session?.profile?.full_name ?? "");
  const [familyName, setFamilyName] = useState<string>(() => session?.profile?.family_name ?? "");
  const [email, setEmail] = useState<string>(() => session?.user.email ?? "");
  const [phone, setPhone] = useState<string>(() => session?.profile?.phone ?? "");
  const [serverSnapshot, setServerSnapshot] = useState(session?.profile ?? null);
  const [serverEmail, setServerEmail] = useState<string>(() => session?.user.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Compute the display name once the data is loaded. The schema
  // stores the full name in profiles.full_name; given_name and
  // family_name were never populated by the signup form, so we use
  // full_name as the source of truth and fall back to email.
  const displayName = serverSnapshot?.full_name || session?.user.email || "Usuario";

  // Re-fetch the session after a successful avatar upload so every
  // consumer (this page, the app-shell header) sees the new URL
  // without us having to thread state through TanStack Router.
  async function refreshSession() {
    const next = await getCurrentSession();
    setServerSnapshot(next?.profile ?? null);
    setServerEmail(next?.user.email ?? "");
    // Re-run the parent route's beforeLoad so the app-shell header
    // (which reads the avatar/name from the route context, not from
    // this page's state) reflects the change without a manual nav.
    await router.invalidate();
  }

  async function onSave() {
    if (saveStatus === "saving") return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const patch: {
        full_name?: string;
        family_name?: string | null;
        phone?: string;
        email?: string;
      } = {};
      const currentName = serverSnapshot?.full_name ?? "";
      const currentFamily = serverSnapshot?.family_name ?? "";
      const currentPhone = serverSnapshot?.phone ?? "";
      if (fullName.trim() !== currentName.trim()) patch.full_name = fullName.trim();
      if (familyName.trim() !== currentFamily.trim()) patch.family_name = familyName.trim() || null;
      if (phone.trim() !== currentPhone.trim()) patch.phone = phone.trim();
      if (email.trim().toLowerCase() !== serverEmail.trim().toLowerCase()) {
        patch.email = email.trim();
      }

      if (Object.keys(patch).length === 0) {
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
        return;
      }

      const result = await updateProfile({ data: patch });
      setFullName(result.full_name ?? "");
      setFamilyName(result.family_name ?? "");
      setPhone(result.phone ?? "");
      setEmail(result.email ?? "");
      // Re-pull the whole snapshot so any server-side defaults
      // (updated_at, etc.) flow into the page state.
      await refreshSession();
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err) {
      console.error("[perfil] save failed:", err);
      setSaveError(saveErrorMessage(err));
      setSaveStatus("error");
    }
  }

  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Datos visibles para tu comunidad educativa" />
      <ProfileNav active="perfil" />

      <div className="space-y-4">
        <SectionCard title="Datos personales">
          {session?.user.id ? (
            <AvatarField
              userId={session.user.id}
              avatarUrl={serverSnapshot?.avatar_url ?? null}
              displayName={displayName}
              onUploaded={refreshSession}
            />
          ) : null}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="profile-name" value={fullName} onChange={setFullName} />
            <Field
              label="Apellido"
              htmlFor="profile-lastname"
              value={familyName}
              onChange={setFamilyName}
              placeholder="Sin especificar"
            />
            <Field
              label="Correo institucional"
              htmlFor="profile-email"
              type="email"
              value={email}
              onChange={setEmail}
            />
            <Field
              label="Teléfono"
              htmlFor="profile-phone"
              type="tel"
              value={phone}
              onChange={setPhone}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Seguridad"
          description="Cambiá tu contrasena cuando lo necesites. Si no se te ocurre una, generamos una por vos."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Contraseña actual"
              htmlFor="current-password"
              type="password"
              value=""
              onChange={() => {}}
              readOnly
              placeholder="No se puede cambiar en esta versión"
            />
            <PasswordFieldWithActions
              id="new-password"
              name="newPassword"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              placeholder="********"
            />
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {saveError && (
          <p role="alert" className="grow text-sm text-destructive">
            {saveError}
          </p>
        )}
        {saveStatus === "saved" && <p className="grow text-sm text-success">Cambios guardados.</p>}
        {saveStatus === "saving" && (
          <p className="grow text-sm text-muted-foreground">Guardando...</p>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saveStatus === "saving"}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="mr-2 inline-block size-4 animate-spin" aria-hidden />
              Guardando...
            </>
          ) : (
            "Guardar cambios"
          )}
        </button>
      </div>
    </>
  );
}
