import { Loader2 } from "lucide-react";

import { notificationKindsForRole, type NotificationRole } from "@/features/notifications/format";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/features/notifications/hooks";
import { cn } from "@/lib/utils";

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

/**
 * The notification preferences: what the user wants to be told about,
 * and how.
 *
 * Each change is saved as soon as it is made. The toggle moves right
 * away and goes back if the API refuses the change.
 *
 * Only the kinds the role actually receives are shown: an administrator
 * has no tasks and no submissions to hear about.
 */
export function NotificationPreferences({
  userId,
  role,
}: {
  userId: string;
  role: NotificationRole;
}) {
  const preferences = useNotificationPreferences(userId);
  const update = useUpdateNotificationPreferences(userId);

  const rows = preferences.data?.preferences ?? [];
  const kinds = notificationKindsForRole(role);

  if (preferences.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando tus preferencias...</p>;
  }

  if (preferences.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {preferences.error.message}
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-border">
        {kinds.map((entry) => {
          const current = rows.find((preference) => preference.kind === entry.kind);
          const inApp = current?.in_app ?? true;

          return (
            <li
              key={entry.kind}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{entry.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
              </div>

              {/* The label goes before the switch: the switch can never
                  land on top of the text, whatever the width of the row. */}
              <div className="flex shrink-0 items-center gap-3">
                <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                  En la app
                </span>
                <Toggle
                  checked={inApp}
                  label={`${entry.label} en la app`}
                  disabled={update.isPending}
                  onChange={() => update.mutate([{ kind: entry.kind, in_app: !inApp }])}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {update.isPending && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden />
          Guardando...
        </p>
      )}

      {update.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {update.error.message}
        </p>
      )}

      <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
        <strong className="font-semibold text-foreground">En la app</strong> son los avisos que
        aparecen en la campana de notificaciones de Lumen, dentro de la plataforma. Los correos que
        sí enviamos son los de la cuenta: activar tu acceso, confirmar tu correo y restablecer tu
        contraseña.
      </p>
    </div>
  );
}
