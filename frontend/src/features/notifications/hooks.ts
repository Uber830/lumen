// =============================================================================
// The notifications hooks: the list, the unread count and the read markers.
// -----------------------------------------------------------------------------
// The bell in the app shell reads two things: how many notifications are
// unread (the badge) and the list itself (the panel). The list is only
// fetched when the panel is open, so the badge stays cheap.
//
// The badge is not polled: the server pushes an event when there is
// something new, and the count is asked for again. The event says what
// happened, not what it is, so what is shown always comes from the API.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { useEvent } from "@/lib/events/event-stream";
import type {
  Notification,
  NotificationKind,
  NotificationPreferences,
  UnreadCount,
} from "@/lib/api/types";

export type { Notification, NotificationKind, NotificationPreferences, UnreadCount };

/** How many notifications the panel asks for. */
export const NOTIFICATION_PAGE_SIZE = 20;

export const queryKeys = {
  list: (userId: string, unreadOnly: boolean) =>
    ["notifications", "list", userId, unreadOnly] as const,
  unreadCount: (userId: string) => ["notifications", "unread_count", userId] as const,
  preferences: (userId: string) => ["notifications", "preferences", userId] as const,
};

/**
 * The notifications of the signed-in user, newest first.
 *
 * The panel mounts this when it opens, so the query is disabled while it
 * is closed.
 */
export function useNotifications(
  userId: string | null,
  options: { unreadOnly?: boolean; enabled?: boolean } = {},
): UseQueryResult<Notification[], Error> {
  const unreadOnly = options.unreadOnly ?? false;
  return useQuery({
    queryKey: userId ? queryKeys.list(userId, unreadOnly) : ["notifications", "list", "none"],
    enabled: Boolean(userId) && options.enabled !== false,
    queryFn: () =>
      api.get<Notification[]>("/v1/notifications", {
        limit: NOTIFICATION_PAGE_SIZE,
        unread_only: unreadOnly,
      }),
  });
}

/**
 * How many notifications the user has not read.
 *
 * This is what the badge shows, so it has to be right the moment it
 * changes: the server pushes the event and the count is asked for
 * again. There is no polling.
 */
export function useUnreadCount(userId: string | null): UseQueryResult<UnreadCount, Error> {
  const qc = useQueryClient();

  useEvent("notification", () => {
    if (!userId) return;
    qc.invalidateQueries({ queryKey: queryKeys.unreadCount(userId) });
    qc.invalidateQueries({ queryKey: ["notifications", "list", userId] });
  });

  return useQuery({
    queryKey: userId ? queryKeys.unreadCount(userId) : ["notifications", "unread_count", "none"],
    enabled: !!userId,
    queryFn: () => api.get<UnreadCount>("/v1/notifications/unread-count"),
  });
}

/** Mark one notification as read. */
export function useMarkNotificationRead(
  userId: string | null,
): UseMutationResult<Notification, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      api.post<Notification>(`/v1/notifications/${notificationId}/read`),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.unreadCount(userId) });
        qc.invalidateQueries({ queryKey: ["notifications", "list", userId] });
      }
    },
  });
}

/** Mark every unread notification as read. */
export function useMarkAllNotificationsRead(
  userId: string | null,
): UseMutationResult<{ updated: number }, Error, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ updated: number }>("/v1/notifications/read-all"),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.unreadCount(userId) });
        qc.invalidateQueries({ queryKey: ["notifications", "list", userId] });
      }
    },
  });
}

/** Dismiss a notification: it is removed for good. */
export function useDismissNotification(
  userId: string | null,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => api.delete<void>(`/v1/notifications/${notificationId}`),
    onSuccess: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.unreadCount(userId) });
        qc.invalidateQueries({ queryKey: ["notifications", "list", userId] });
      }
    },
  });
}

/**
 * What the user wants to be told about, and how.
 *
 * The answer has one entry per kind, with the defaults already
 * filled in by the API.
 */
export function useNotificationPreferences(
  userId: string | null,
): UseQueryResult<NotificationPreferences, Error> {
  return useQuery({
    queryKey: userId ? queryKeys.preferences(userId) : ["notifications", "preferences", "none"],
    enabled: !!userId,
    queryFn: () => api.get<NotificationPreferences>("/v1/notifications/preferences"),
  });
}

/**
 * Change what the user wants to be told about.
 *
 * The change is applied to the cache right away, so the toggle moves
 * with the finger, and the cache is rolled back if the API refuses it.
 */
export function useUpdateNotificationPreferences(
  userId: string | null,
): UseMutationResult<
  NotificationPreferences,
  Error,
  { kind: NotificationKind; in_app?: boolean; email?: boolean }[]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes) =>
      api.patch<NotificationPreferences>("/v1/notifications/preferences", {
        preferences: changes,
      }),
    onMutate: async (changes) => {
      if (!userId) return { previous: undefined };
      await qc.cancelQueries({ queryKey: queryKeys.preferences(userId) });
      const previous = qc.getQueryData<NotificationPreferences>(queryKeys.preferences(userId));
      qc.setQueryData<NotificationPreferences>(queryKeys.preferences(userId), (old) => {
        if (!old) return old;
        return {
          preferences: old.preferences.map((preference) => {
            const change = changes.find((item) => item.kind === preference.kind);
            if (!change) return preference;
            return {
              ...preference,
              ...(change.in_app === undefined ? {} : { in_app: change.in_app }),
              ...(change.email === undefined ? {} : { email: change.email }),
            };
          }),
        };
      });
      return { previous };
    },
    onError: (_error, _changes, context) => {
      if (userId && context?.previous) {
        qc.setQueryData(queryKeys.preferences(userId), context.previous);
      }
    },
    onSettled: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: queryKeys.preferences(userId) });
      }
    },
  });
}
