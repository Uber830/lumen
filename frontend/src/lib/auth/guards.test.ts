import { describe, expect, it } from "vitest";

import { homeFor } from "@/lib/auth/guards";
import type { SessionContext } from "@/lib/auth/functions";

function session(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    user: { id: "user-1", email: "user@example.com" },
    profile: null,
    memberships: [],
    platformRole: null,
    primarySchoolId: null,
    school: null,
    currentPeriod: null,
    permissions: [],
    ...overrides,
  };
}

describe("homeFor", () => {
  it("sends the platform admin to the platform", () => {
    const ctx = session({ platformRole: "platform_admin" });
    expect(homeFor(ctx)).toBe("/super");
  });

  it("sends each role to its own home", () => {
    const membership = (role: "school_admin" | "teacher" | "student") => ({
      id: "membership-1",
      school_id: "school-1",
      role,
      is_primary: true,
      joined_at: "2026-11-01T00:00:00Z",
    });

    expect(homeFor(session({ memberships: [membership("school_admin")] }))).toBe("/admin");
    expect(homeFor(session({ memberships: [membership("teacher")] }))).toBe("/docente");
    expect(homeFor(session({ memberships: [membership("student")] }))).toBe("/estudiante");
  });

  it("uses the primary membership when there is more than one", () => {
    const ctx = session({
      memberships: [
        {
          id: "membership-1",
          school_id: "school-1",
          role: "student",
          is_primary: false,
          joined_at: "2026-11-01T00:00:00Z",
        },
        {
          id: "membership-2",
          school_id: "school-2",
          role: "teacher",
          is_primary: true,
          joined_at: "2026-11-01T00:00:00Z",
        },
      ],
    });
    expect(homeFor(ctx)).toBe("/docente");
  });

  it("falls back to the landing page without a membership", () => {
    expect(homeFor(session())).toBe("/");
  });
});
