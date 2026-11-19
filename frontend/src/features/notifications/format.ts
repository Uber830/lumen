// =============================================================================
// The presentation of a notification.
// -----------------------------------------------------------------------------
// The wording comes from the backend: it knows who did what, and to
// whom. What is left here is the icon that goes with each kind and the
// "how long ago" label.
//
// These are pure functions, so they can be tested without a browser.
// =============================================================================

import { BookOpen, CheckCircle2, ClipboardList, FileCheck2, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { NotificationKind, SchoolRole } from "@/lib/api/types";

/** The icon that goes with each kind. */
export const NOTIFICATION_ICONS: Record<NotificationKind, LucideIcon> = {
  task_assigned: ClipboardList,
  task_submitted: FileCheck2,
  task_graded: CheckCircle2,
  content_published: BookOpen,
  chat_message: MessageSquare,
};

/**
 * What each kind of notification is about, in the words of the person
 * who receives it.
 *
 * The wording is per recipient: a teacher receives the submissions and
 * a student receives the assignments, so each kind is described from
 * the point of view of whoever gets it.
 */
export const NOTIFICATION_KINDS: {
  kind: NotificationKind;
  label: string;
  description: string;
}[] = [
  {
    kind: "task_assigned",
    label: "Tarea asignada",
    description: "Cuando te asignan una tarea.",
  },
  {
    kind: "task_submitted",
    label: "Entrega recibida",
    description: "Cuando un estudiante te entrega una tarea.",
  },
  {
    kind: "task_graded",
    label: "Tarea calificada",
    description: "Cuando califican una entrega tuya.",
  },
  {
    kind: "content_published",
    label: "Contenido nuevo",
    description: "Cuando se publica material en tu materia.",
  },
  {
    kind: "chat_message",
    label: "Mensajes de chat",
    description: "Cuando te escriben en una conversación.",
  },
];

/**
 * The roles the notification preferences know about.
 *
 * The platform admin is not a member of a school, but still has a
 * profile with preferences.
 */
export type NotificationRole = "platform_admin" | "school_admin" | "teacher" | "student";

/**
 * The kinds each role actually receives.
 *
 * The backend decides who gets what: a student is told about the tasks
 * they are given, a teacher about the submissions they receive. An
 * administrator does not take part in either, so showing them those
 * switches would be noise.
 */
const KINDS_BY_ROLE: Record<NotificationRole, NotificationKind[]> = {
  platform_admin: ["chat_message"],
  school_admin: ["chat_message"],
  teacher: ["task_submitted", "task_graded", "content_published", "chat_message"],
  student: ["task_assigned", "task_graded", "content_published", "chat_message"],
};

/** The notification kinds that make sense for a role. */
export function notificationKindsForRole(role: NotificationRole) {
  const allowed = new Set(KINDS_BY_ROLE[role]);
  return NOTIFICATION_KINDS.filter((entry) => allowed.has(entry.kind));
}

/**
 * The role the notification preferences belong to.
 *
 * The platform role wins when there is one; otherwise it is the primary
 * membership of the school.
 */
export function notificationRoleFor(input: {
  platformRole: "platform_admin" | null;
  memberships: { role: SchoolRole; is_primary: boolean }[];
}): NotificationRole {
  if (input.platformRole === "platform_admin") return "platform_admin";
  const primary = input.memberships.find((m) => m.is_primary) ?? input.memberships[0];
  return primary?.role ?? "student";
}

/**
 * How long ago the notification arrived, in words.
 *
 * `Intl.RelativeTimeFormat` does the work, in the language of the
 * browser.
 */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.round((then - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return formatter.format(seconds, "second");
}
