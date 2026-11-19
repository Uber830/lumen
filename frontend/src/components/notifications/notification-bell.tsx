import { Bell, Check, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { NOTIFICATION_ICONS, timeAgo } from "@/features/notifications/format";
import {
  useDismissNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/features/notifications/hooks";
import type { Notification } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * The bell of the app shell: the badge with the unread count, and the
 * panel with the notifications themselves.
 *
 * The panel is hand-rolled, like the mobile menu of the shell: the
 * shadcn primitives under `components/ui` are not wired into the app.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const unread = useUnreadCount(userId);
  const notifications = useNotifications(userId, { enabled: open });
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);
  const dismiss = useDismissNotification(userId);

  const unreadCount = unread.data?.unread ?? 0;

  function onNotificationClick(notification: Notification) {
    if (!notification.read_at) {
      markRead.mutate(notification.id);
    }
    setOpen(false);
    if (notification.link) {
      void navigate({ to: notification.link });
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notificaciones"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-10 place-items-center rounded-lg hover:bg-muted"
      >
        <Bell className="size-5" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* The overlay closes the panel when the user clicks away. */}
          <button
            type="button"
            aria-label="Cerrar notificaciones"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 z-40 mt-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lift">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-4 py-3">
              <h2 className="truncate text-sm font-semibold">Notificaciones</h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="size-3.5" strokeWidth={2} />
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {notifications.isLoading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Cargando notificaciones...</p>
            ) : notifications.error ? (
              <p role="alert" className="px-4 py-6 text-sm text-destructive">
                {notifications.error.message}
              </p>
            ) : notifications.data && notifications.data.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No tenés notificaciones nuevas.
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-border overflow-y-auto">
                {notifications.data?.map((notification) => {
                  const Icon = NOTIFICATION_ICONS[notification.kind];
                  const unreadItem = !notification.read_at;
                  return (
                    <li key={notification.id}>
                      <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                        <button
                          type="button"
                          onClick={() => onNotificationClick(notification)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                              unreadItem
                                ? "bg-primary-soft text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon className="size-4" strokeWidth={1.75} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-sm",
                                unreadItem ? "font-semibold" : "font-medium",
                              )}
                            >
                              {notification.title}
                            </span>
                            {notification.body && (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {notification.body}
                              </span>
                            )}
                            <span className="mt-1 block text-[11px] text-muted-foreground">
                              {timeAgo(notification.created_at)}
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          aria-label={`Descartar ${notification.title}`}
                          onClick={() => dismiss.mutate(notification.id)}
                          disabled={dismiss.isPending}
                          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <X className="size-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
