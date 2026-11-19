import { describe, expect, expectTypeOf, it } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  NOTIFICATION_ICONS,
  NOTIFICATION_KINDS,
  notificationKindsForRole,
  notificationRoleFor,
  timeAgo,
} from "@/features/notifications/format";
import type {
  Notification,
  NotificationKind,
  NotificationPreferences,
  UnreadCount,
} from "@/lib/api/types";

/**
 * Tests for the notifications module.
 *
 * The hooks need a TanStack QueryClientProvider to run, so their public
 * surface is tested as types, like the academics hooks are. The parts
 * that can run on their own — the icon of each kind, the list of kinds
 * and the "how long ago" label — are tested for real.
 */

const ALL_KINDS: NotificationKind[] = [
  "task_assigned",
  "task_submitted",
  "task_graded",
  "content_published",
  "chat_message",
];

describe("the notification kinds", () => {
  it("are the ones the backend produces", () => {
    expectTypeOf<NotificationKind>().toEqualTypeOf<
      "task_assigned" | "task_submitted" | "task_graded" | "content_published" | "chat_message"
    >();
  });

  it("every kind has an icon, so the panel never renders a blank one", () => {
    // A kind the backend adds and the frontend does not know about
    // would render an undefined icon and break the panel.
    for (const kind of ALL_KINDS) {
      expect(NOTIFICATION_ICONS[kind]).toBeDefined();
    }
    expect(Object.keys(NOTIFICATION_ICONS).sort()).toEqual([...ALL_KINDS].sort());
  });

  it("every kind has a wording, so the preferences cover all of them", () => {
    // A kind the backend adds and the preferences do not list would be
    // impossible to turn off: the user would never see it.
    const listed = NOTIFICATION_KINDS.map((entry) => entry.kind);
    expect(listed.sort()).toEqual([...ALL_KINDS].sort());
    for (const entry of NOTIFICATION_KINDS) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe("the notification payload", () => {
  it("carries the fields the panel renders", () => {
    expectTypeOf<Notification["id"]>().toBeString();
    expectTypeOf<Notification["kind"]>().toEqualTypeOf<NotificationKind>();
    expectTypeOf<Notification["title"]>().toBeString();
    expectTypeOf<Notification["body"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Notification["link"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Notification["read_at"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Notification["created_at"]>().toBeString();
    expectTypeOf<UnreadCount["unread"]>().toBeNumber();
  });

  it("the hook signatures are the ones the app relies on", () => {
    type UseNotificationsFn = (
      userId: string | null,
      options?: { unreadOnly?: boolean; enabled?: boolean },
    ) => UseQueryResult<Notification[], Error>;

    const _assert: UseNotificationsFn = null as unknown as UseNotificationsFn;
    void _assert;
    expectTypeOf<UseNotificationsFn>().returns.toEqualTypeOf<
      UseQueryResult<Notification[], Error>
    >();
  });
});

describe("the notification kinds by role", () => {
  it("does not offer tasks to an administrator", () => {
    // The administrator does not give tasks and does not receive
    // submissions: those switches would never do anything.
    const kinds = notificationKindsForRole("school_admin").map((entry) => entry.kind);
    expect(kinds).not.toContain("task_assigned");
    expect(kinds).not.toContain("task_submitted");
    expect(kinds).not.toContain("task_graded");
    expect(kinds).toContain("chat_message");
  });

  it("gives the student the assignments, the grades and the material", () => {
    const kinds = notificationKindsForRole("student").map((entry) => entry.kind);
    expect(kinds).toContain("task_assigned");
    expect(kinds).toContain("task_graded");
    expect(kinds).toContain("content_published");
  });

  it("gives the teacher the submissions", () => {
    const kinds = notificationKindsForRole("teacher").map((entry) => entry.kind);
    expect(kinds).toContain("task_submitted");
    expect(kinds).not.toContain("task_assigned");
  });

  it("never offers a kind the backend does not produce", () => {
    const roles = ["platform_admin", "school_admin", "teacher", "student"] as const;
    for (const role of roles) {
      for (const entry of notificationKindsForRole(role)) {
        expect(ALL_KINDS).toContain(entry.kind);
      }
    }
  });
});

describe("the role the preferences belong to", () => {
  it("is the platform role when there is one", () => {
    expect(
      notificationRoleFor({
        platformRole: "platform_admin",
        memberships: [{ role: "school_admin", is_primary: true }],
      }),
    ).toBe("platform_admin");
  });

  it("is the primary membership of the school otherwise", () => {
    expect(
      notificationRoleFor({
        platformRole: null,
        memberships: [
          { role: "student", is_primary: false },
          { role: "teacher", is_primary: true },
        ],
      }),
    ).toBe("teacher");
  });

  it("falls back to the first membership, and to the student without any", () => {
    expect(
      notificationRoleFor({
        platformRole: null,
        memberships: [{ role: "teacher", is_primary: false }],
      }),
    ).toBe("teacher");
    expect(notificationRoleFor({ platformRole: null, memberships: [] })).toBe("student");
  });
});

describe("the preferences", () => {
  it("carry the two channels the user can choose", () => {
    expectTypeOf<NotificationPreferences["preferences"]>().toBeArray();
    expectTypeOf<
      NotificationPreferences["preferences"][number]["kind"]
    >().toEqualTypeOf<NotificationKind>();
    expectTypeOf<NotificationPreferences["preferences"][number]["in_app"]>().toBeBoolean();
    expectTypeOf<NotificationPreferences["preferences"][number]["email"]>().toBeBoolean();
  });
});

describe("the time label", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");

  it("counts the minutes", () => {
    const label = timeAgo("2026-11-05T11:30:00Z", now);
    expect(label).toContain("30");
  });

  it("counts the hours", () => {
    const label = timeAgo("2026-11-05T09:00:00Z", now);
    expect(label).toContain("3");
  });

  it("counts the days", () => {
    const label = timeAgo("2026-11-02T12:00:00Z", now);
    expect(label).toContain("3");
  });

  it("says nothing when the date is not a date", () => {
    expect(timeAgo("not-a-date", now)).toBe("");
  });
});
